import * as fs from 'fs';
import * as handlebars from 'handlebars';
import sendEmail, { ClientEmailConfig } from '.';
import {
  EMAIL_CONFIG,
  FE_URL,
  SETUP_TOKEN_EXPIRY_HOURS,
} from '../../../../config/config';
import { t } from '../i18n';
import { resolveEmailTemplate } from './templatePath';

// The welcome email used to render a "Role: <X>" pill, but role is a
// per-group, possibly multi-valued concept (a user belongs to multiple
// groups, each carrying a role; the effective role can change anytime
// an admin reassigns groups). Surfacing a single role label in the
// welcome email was misleading more often than helpful, so the row
// (and its palette + i18n label) is gone. Users discover their
// effective permissions by using the app.

const welcomeEmailToUser = async (
  emailTo: string,
  fullName: string,
  username: string,
  clientName: string,
  userId: string,
  clientId: string,
  setupToken: string,
  clientEmailConfig?: ClientEmailConfig,
  locale: string = 'en',
): Promise<boolean> => {
  const filePath = resolveEmailTemplate('welcome-user.html');
  const source = fs.readFileSync(filePath, 'utf-8').toString();
  const template = handlebars.compile(source);

  const supportEmail = EMAIL_CONFIG.supportEmail;
  const docsUrl = EMAIL_CONFIG.docsUrl;
  const hasGettingStarted = Boolean(docsUrl || supportEmail);

  const welcomeSubject = t('email.welcome_subject', locale).replace(
    '{{organisation}}',
    clientName,
  );

  const replacements = {
    fullName,
    username,
    organisation: clientName,
    SET_PASSWORD_URL: `${FE_URL}/set-password?token=${setupToken}&id=${userId}&clientId=${clientId}&lang=${locale}`,
    year: new Date().getFullYear(),
    senderName: clientName || 'UltraSignal',
    welcomeSubject,
    preheader: welcomeSubject,
    // Translated strings
    greeting: t('email.welcome_greeting', locale).replace(
      '{{fullName}}',
      fullName,
    ),
    body: t('email.welcome_body', locale).replace(
      '{{organisation}}',
      `<strong>${clientName}</strong>`,
    ),
    labelOrganisation: t('email.label_client', locale),
    labelUsername: t('email.label_username', locale),
    setPasswordBtn: t('email.set_password_btn', locale),
    expiryNotice: t('email.expiry_notice', locale).replace(
      '{{setupTokenExpiryHours}}',
      String(SETUP_TOKEN_EXPIRY_HOURS),
    ),
    allRightsReserved: t('email.all_rights_reserved', locale),
    // Getting-started + footer
    hasGettingStarted,
    gettingStartedHeading: t('email.getting_started_heading', locale),
    gettingStartedDocsLabel: t('email.getting_started_docs', locale),
    gettingStartedSupportLabel: t('email.getting_started_support', locale),
    docsUrl,
    supportEmail,
    supportContact: supportEmail
      ? t('email.support_contact', locale).replace(
          /\{\{supportEmail\}\}/g,
          supportEmail,
        )
      : '',
  };

  const htmlToSend = template(replacements);

  return sendEmail(emailTo, welcomeSubject, htmlToSend, clientEmailConfig, {
    senderName: clientName || undefined,
    replyTo: supportEmail || undefined,
  });
};

export default welcomeEmailToUser;
