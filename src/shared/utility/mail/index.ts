import * as aws from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { EMAIL_CONFIG } from '../../../../config/config';
import { getErrorMessage } from '../getErrorMessage';
import Logger from '../logger/logger';

let globalTransporter: nodemailer.Transporter | null = null;

const getGlobalTransporter = () => {
  if (!globalTransporter) {
    globalTransporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass,
      },
    });
  }
  return globalTransporter;
};

export interface ClientEmailConfig {
  emailProvider: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null; // Already decrypted by caller
  smtpFrom?: string | null;
  sesRegion?: string | null;
  sesAccessKeyId?: string | null;
  sesSecretAccessKey?: string | null; // Already decrypted by caller
  sesFrom?: string | null;
}

const createClientTransporter = (
  config: ClientEmailConfig,
): nodemailer.Transporter | null => {
  try {
    if (config.emailProvider === 'SMTP' && config.smtpHost && config.smtpUser) {
      return nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: (config.smtpPort || 587) === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword || '',
        },
      });
    }
    if (
      config.emailProvider === 'SES' &&
      config.sesRegion &&
      config.sesAccessKeyId &&
      config.sesSecretAccessKey
    ) {
      const sesClient = new aws.SES({
        region: config.sesRegion,
        credentials: {
          accessKeyId: config.sesAccessKeyId,
          secretAccessKey: config.sesSecretAccessKey,
        },
      });
      return nodemailer.createTransport({ SES: { ses: sesClient, aws } });
    }
  } catch (err) {
    Logger.error(
      `Failed to create client email transporter: ${getErrorMessage(err)}`,
    );
  }
  return null;
};

/**
 * Strip HTML to a plain-text equivalent for the `text/plain` MIME part.
 *
 * Sending `multipart/alternative` with both an HTML and a text body is a
 * basic transactional-email requirement: every major ESP (SendGrid,
 * Postmark, Resend, Mailgun) penalises HTML-only mail in their spam
 * scoring, and clients that block HTML (screen readers, plain-text mail
 * clients, security-conscious users) need a readable fallback.
 *
 * This is a simple regex-based stripper — sufficient for the structured
 * transactional templates this project sends. If we ever start sending
 * richer marketing-style emails, swap to `html-to-text`.
 */
const htmlToText = (html: string): string => {
  return (
    html
      // Drop entire <head>, <style>, <script> blocks (incl. content).
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      // Strip HTML comments (incl. the hidden preheader block).
      .replace(/<!--[\s\S]*?-->/g, '')
      // Linkify <a href="...">text</a> as `text (url)`.
      .replace(
        /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        '$2 ($1)',
      )
      // Block-level breaks → newlines.
      .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Strip remaining tags.
      .replace(/<[^>]+>/g, '')
      // Decode the handful of named entities the templates use.
      .replace(/&nbsp;/g, ' ')
      .replace(/&copy;/g, '©')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#10003;/g, '✓')
      // Collapse runs of whitespace, preserve paragraph breaks.
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
};

export interface SendEmailOptions {
  /**
   * Pre-computed plain-text version of the email. If omitted, a text
   * fallback is generated from the HTML via `htmlToText()`.
   */
  text?: string;
  /**
   * Display name for the From header. Defaults to "UltraSignal". Pass the
   * client name (or any white-label brand) for multi-tenant deployments.
   */
  senderName?: string;
  /**
   * Reply-To header — gives recipients a place to send questions.
   * Falls back to `EMAIL_CONFIG.supportEmail` if not provided.
   */
  replyTo?: string;
}

const sendEmail = async (
  emailTo: string,
  subject: string,
  content: string,
  clientEmailConfig?: ClientEmailConfig,
  options: SendEmailOptions = {},
): Promise<boolean> => {
  try {
    let transport: nodemailer.Transporter;
    let fromAddress: string;

    if (clientEmailConfig?.emailProvider) {
      const clientTransport = createClientTransporter(clientEmailConfig);
      if (clientTransport) {
        transport = clientTransport;
        fromAddress =
          (clientEmailConfig.emailProvider === 'SES'
            ? clientEmailConfig.sesFrom
            : clientEmailConfig.smtpFrom) || EMAIL_CONFIG.from;
      } else {
        // Fallback to global
        transport = getGlobalTransporter();
        fromAddress = EMAIL_CONFIG.from;
      }
    } else {
      transport = getGlobalTransporter();
      fromAddress = EMAIL_CONFIG.from;
    }

    const senderName = options.senderName?.trim() || 'UltraSignal';
    const replyTo = options.replyTo?.trim() || EMAIL_CONFIG.supportEmail || '';
    const text = options.text || htmlToText(content);

    await transport.sendMail({
      from: `"${senderName}" <${fromAddress}>`,
      to: emailTo,
      ...(replyTo ? { replyTo } : {}),
      subject,
      html: content,
      text,
    });
    Logger.info(`Email sent to ${emailTo}`);
    return true;
  } catch (err) {
    Logger.error(`Failed to send email to ${emailTo}: ${getErrorMessage(err)}`);
    return false;
  }
};

export default sendEmail;
