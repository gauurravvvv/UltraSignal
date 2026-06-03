import * as fs from 'fs';
import * as handlebars from 'handlebars';
import sendEmail, { ClientEmailConfig } from '.';
import {
  EMAIL_CONFIG,
  FE_URL,
  RESET_PASS_EXPIRE_TIME,
} from '../../../../config/config';
import { t } from '../i18n';
import { formatRequestTimestamp, RequestContext } from './requestContext';
import { resolveEmailTemplate } from './templatePath';

const resetPassEmail = async (
  emailTo: string,
  otp: string,
  userId: number | string,
  clientId: number | string,
  clientEmailConfig?: ClientEmailConfig,
  locale: string = 'en',
  requestContext?: RequestContext,
  clientName?: string,
): Promise<boolean> => {
  const filePath = resolveEmailTemplate('forgot-password.html');
  const source = fs.readFileSync(filePath, 'utf-8').toString();
  const template = handlebars.compile(source);

  const subject = t('email.reset_otp_subject', locale);
  const supportEmail = EMAIL_CONFIG.supportEmail;
  const unknown = t('email.unknown_value', locale);

  const replacements = {
    OTP: otp,
    RESET_URL: `${FE_URL}/reset-password?id=${userId}&clientId=${clientId}&lang=${locale}`,
    year: new Date().getFullYear(),
    senderName: clientName || 'UltraSignal',
    subject,
    preheader: subject,
    heading: t('email.reset_otp_heading', locale),
    body: t('email.reset_otp_body', locale),
    expiresIn: t('email.reset_otp_expires_in', locale).replace(
      '{{minutes}}',
      String(RESET_PASS_EXPIRE_TIME),
    ),
    resetButton: t('email.reset_otp_button', locale),
    // Security signals
    requestDetailsHeading: t('email.request_details_heading', locale),
    labelIp: t('email.label_ip_address', locale),
    labelDevice: t('email.label_device', locale),
    labelRequestedAt: t('email.label_requested_at', locale),
    ipAddress: requestContext?.ip || unknown,
    userAgent: requestContext?.userAgent || unknown,
    requestedAt: requestContext
      ? formatRequestTimestamp(requestContext.timestamp)
      : formatRequestTimestamp(new Date()),
    // Wasn't you / footer
    notYouHeading: t('email.not_you_otp_heading', locale),
    notYouBody: t('email.not_you_otp_body', locale),
    supportEmail,
    supportContact: supportEmail
      ? t('email.support_contact', locale).replace(
          /\{\{supportEmail\}\}/g,
          supportEmail,
        )
      : '',
    allRightsReserved: t('email.all_rights_reserved', locale),
  };

  const htmlToSend = template(replacements);
  return sendEmail(emailTo, subject, htmlToSend, clientEmailConfig, {
    senderName: clientName || undefined,
    replyTo: supportEmail || undefined,
  });
};

export default resetPassEmail;
