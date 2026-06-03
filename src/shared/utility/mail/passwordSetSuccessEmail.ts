/**
 * passwordSetSuccessEmail — sent after a user activates their account by
 * setting their initial password via the setup-token link. Distinct from
 * the reset-success email both in copy (welcome tone, not "you reset")
 * and in security context (this is a first-time activation, so a
 * different "wasn't you?" line is shown).
 */
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import sendEmail, { OrgEmailConfig } from '.';
import { EMAIL_CONFIG, FE_URL } from '../../../../config/config';
import { t } from '../i18n';
import { formatRequestTimestamp, RequestContext } from './requestContext';
import { resolveEmailTemplate } from './templatePath';

const passwordSetSuccessEmail = async (
  emailTo: string,
  fullName: string,
  username: string,
  organisation: string,
  orgEmailConfig?: OrgEmailConfig,
  locale: string = 'en',
  requestContext?: RequestContext,
): Promise<boolean> => {
  const filePath = resolveEmailTemplate('password-set-success.html');
  const source = fs.readFileSync(filePath, 'utf-8').toString();
  const template = handlebars.compile(source);

  const subject = t('email.password_set_subject', locale);
  const supportEmail = EMAIL_CONFIG.supportEmail;
  const unknown = t('email.unknown_value', locale);

  const replacements = {
    fullName,
    username,
    organisation,
    LOGIN_URL: `${FE_URL}/login?lang=${locale}`,
    year: new Date().getFullYear(),
    senderName: organisation || 'UltraSignal',
    subject,
    preheader: subject,
    heading: t('email.password_set_heading', locale),
    body: t('email.password_set_body', locale).replace(
      '{{fullName}}',
      `<strong>${fullName}</strong>`,
    ),
    loginButton: t('email.reset_success_button', locale),
    // Security signals
    requestDetailsHeading: t('email.request_details_heading', locale),
    labelUsername: t('email.label_username', locale),
    labelOrganisation: t('email.label_organisation', locale),
    labelIp: t('email.label_ip_address', locale),
    labelDevice: t('email.label_device', locale),
    labelTimestamp: t('email.label_set_at', locale),
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
  return sendEmail(emailTo, subject, htmlToSend, orgEmailConfig, {
    senderName: organisation || undefined,
    replyTo: supportEmail || undefined,
  });
};

export default passwordSetSuccessEmail;
