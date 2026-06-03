import * as fs from 'fs';
import * as handlebars from 'handlebars';
import sendEmail, { ClientEmailConfig } from '.';
import { EMAIL_CONFIG, FE_URL } from '../../../../config/config';
import { t } from '../i18n';
import { formatRequestTimestamp, RequestContext } from './requestContext';
import { resolveEmailTemplate } from './templatePath';

const passwordResetSuccessEmail = async (
  emailTo: string,
  fullName: string,
  username: string,
  clientName: string,
  clientEmailConfig?: ClientEmailConfig,
  locale: string = 'en',
  requestContext?: RequestContext,
): Promise<boolean> => {
  const filePath = resolveEmailTemplate('password-reset-success.html');
  const source = fs.readFileSync(filePath, 'utf-8').toString();
  const template = handlebars.compile(source);

  const subject = t('email.reset_success_subject', locale);
  const supportEmail = EMAIL_CONFIG.supportEmail;
  const unknown = t('email.unknown_value', locale);

  const replacements = {
    fullName,
    username,
    organisation: clientName,
    LOGIN_URL: `${FE_URL}/login?lang=${locale}`,
    year: new Date().getFullYear(),
    senderName: clientName || 'UltraSignal',
    subject,
    preheader: subject,
    heading: t('email.reset_success_heading', locale),
    body: t('email.reset_success_body', locale).replace(
      '{{fullName}}',
      `<strong>${fullName}</strong>`,
    ),
    loginButton: t('email.reset_success_button', locale),
    // Security signals
    requestDetailsHeading: t('email.request_details_heading', locale),
    labelUsername: t('email.label_username', locale),
    labelOrganisation: t('email.label_client', locale),
    labelIp: t('email.label_ip_address', locale),
    labelDevice: t('email.label_device', locale),
    labelTimestamp: t('email.label_reset_at', locale),
    ipAddress: requestContext?.ip || unknown,
    userAgent: requestContext?.userAgent || unknown,
    timestamp: requestContext
      ? formatRequestTimestamp(requestContext.timestamp)
      : formatRequestTimestamp(new Date()),
    // Wasn't you / footer
    notYouHeading: t('email.not_you_success_heading', locale),
    notYouBody: t('email.not_you_success_body', locale),
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

export default passwordResetSuccessEmail;
