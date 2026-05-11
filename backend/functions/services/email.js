const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');

dotenv.config();

let isInitialized = false;

const sanitizeErrorMessage = (error) => {
  const message = error?.message || String(error || 'Unknown error');
  return String(message).slice(0, 500);
};

const logEmailEvent = async ({
  eventType,
  status,
  recipient,
  statusCode,
  providerMessageId,
  customArgs,
  errorMessage,
}) => {
  try {
    const db = admin.firestore();
    await db.collection('emailEvents').add({
      eventType: eventType || 'unknown',
      provider: 'sendgrid',
      status,
      recipient,
      statusCode: statusCode || null,
      providerMessageId: providerMessageId || null,
      donationId: customArgs?.donationId || null,
      organizationId: customArgs?.organizationId || null,
      uid: customArgs?.uid || null,
      errorMessage: errorMessage || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (logError) {
    console.error('Failed to write emailEvents audit log:', sanitizeErrorMessage(logError));
  }
};

const getEmailConfig = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || 'SwiftCause';

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not configured.');
  }

  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL is not configured.');
  }

  return {
    apiKey,
    fromEmail,
    fromName,
  };
};

const ensureEmailInitialized = () => {
  if (isInitialized) return;
  const { apiKey } = getEmailConfig();
  sgMail.setApiKey(apiKey);
  isInitialized = true;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildEmailShell = ({ preheader, title, bodyHtml }) => `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:24px; background:#f6f8fb; font-family: Arial, sans-serif; color:#1f2937;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${escapeHtml(preheader || '')}
    </div>
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;">
      <div style="background:#064e3b; color:#ffffff; padding:18px 24px;">
        <div style="font-size:12px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.9;">SwiftCause</div>
        <div style="font-size:24px; font-weight:700; margin-top:6px;">${escapeHtml(title)}</div>
      </div>
      <div style="padding:24px;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:12px;">
        Sent by SwiftCause
      </div>
    </div>
  </body>
</html>`;

const sendEmail = async ({ to, subject, text, html, categories, customArgs, auditEventType }) => {
  ensureEmailInitialized();
  const { fromEmail, fromName } = getEmailConfig();
  const recipient = Array.isArray(to) ? to.join(',') : String(to || '');

  try {
    const [response] = await sgMail.send({
      to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject,
      text,
      html,
      categories,
      customArgs,
    });

    const result = {
      statusCode: response?.statusCode,
      messageId: response?.headers?.['x-message-id'] || null,
    };

    await logEmailEvent({
      eventType: auditEventType,
      status: 'success',
      recipient,
      statusCode: result.statusCode,
      providerMessageId: result.messageId,
      customArgs,
    });

    return result;
  } catch (error) {
    await logEmailEvent({
      eventType: auditEventType,
      status: 'failed',
      recipient,
      customArgs,
      errorMessage: sanitizeErrorMessage(error),
    });
    throw error;
  }
};

const sendDonationThankYouEmail = async ({
  to,
  donorName,
  campaignName,
  organizationName,
  amount,
  currency,
  donationId,
  organizationId,
}) => {
  const safeDonorName =
    typeof donorName === 'string' && donorName.trim() ? donorName.trim() : 'Donor';
  const safeCampaignName =
    typeof campaignName === 'string' && campaignName.trim() ? campaignName.trim() : null;
  const safeOrganizationName =
    typeof organizationName === 'string' && organizationName.trim()
      ? organizationName.trim()
      : null;
  const upperCurrency = typeof currency === 'string' ? currency.toUpperCase() : '';
  const amountDisplay =
    typeof amount === 'number' ? `${(amount / 100).toFixed(2)} ${upperCurrency}`.trim() : null;

  const subject = safeCampaignName
    ? `Thank you for supporting ${safeCampaignName}!`
    : 'Thank you for your donation!';

  const textLines = [
    `Dear ${safeDonorName},`,
    '',
    'Thank you for your generous donation to our campaign.',
  ];

  if (amountDisplay) textLines.push(`Amount: ${amountDisplay}`);
  if (safeCampaignName) textLines.push(`Campaign: ${safeCampaignName}`);

  textLines.push(
    '',
    'We truly appreciate your kindness and belief in our mission.',
    '',
    'With gratitude,',
    safeOrganizationName
      ? `on behalf of the ${safeOrganizationName} team.`
      : 'on behalf of the charity team.',
    '',
    'Powered by SwiftCause',
  );

  const html = buildEmailShell({
    preheader: 'Thanks for your donation. Your support helps campaigns move forward.',
    title: 'Thank You for Your Donation',
    bodyHtml: `
      <p style="margin:0 0 12px;">Dear ${escapeHtml(safeDonorName)},</p>
      <p style="margin:0 0 12px;">Thank you for your generous donation to our campaign.</p>
      ${amountDisplay ? `<p style="margin:0 0 8px;"><strong>Amount:</strong> ${escapeHtml(amountDisplay)}</p>` : ''}
      ${safeCampaignName ? `<p style="margin:0 0 12px;"><strong>Campaign:</strong> ${escapeHtml(safeCampaignName)}</p>` : ''}
      <p style="margin:0 0 12px;">We truly appreciate your kindness and belief in our mission.</p>
      <p style="margin:0 0 10px;">With gratitude,<br/><strong>${escapeHtml(
        safeOrganizationName
          ? `on behalf of the ${safeOrganizationName} team.`
          : 'on behalf of the charity team.',
      )}</strong></p>
      <p style="margin:0; color:#6b7280; font-size:13px;">Powered by SwiftCause</p>
    `,
  });

  const normalizedRecipient = String(to || '')
    .trim()
    .toLowerCase();
  if (donationId && normalizedRecipient) {
    const existingSend = await admin
      .firestore()
      .collection('emailEvents')
      .where('eventType', '==', 'donation_thank_you')
      .where('status', '==', 'success')
      .where('donationId', '==', donationId)
      .where('recipient', '==', normalizedRecipient)
      .limit(1)
      .get();

    if (!existingSend.empty) {
      await logEmailEvent({
        eventType: 'donation_thank_you',
        status: 'deduplicated',
        recipient: normalizedRecipient,
        customArgs: {
          donationId: donationId || '',
          organizationId: organizationId || '',
        },
      });
      return {
        statusCode: 200,
        messageId: null,
        deduplicated: true,
      };
    }
  }

  return sendEmail({
    to: normalizedRecipient || to,
    subject,
    text: textLines.join('\n'),
    html,
    categories: ['donation-thank-you'],
    customArgs: {
      donationId: donationId || '',
      organizationId: organizationId || '',
    },
    auditEventType: 'donation_thank_you',
  });
};

const sendOrganizationWelcomeEmail = async ({
  to,
  organizationName,
  recipientName,
  organizationId,
  uid,
}) => {
  const safeRecipientName =
    typeof recipientName === 'string' && recipientName.trim() ? recipientName.trim() : 'there';
  const safeOrgName =
    typeof organizationName === 'string' && organizationName.trim()
      ? organizationName.trim()
      : 'your organization';

  const subject = `Welcome to SwiftCause, ${safeOrgName}!`;
  const text = [
    `Hi ${safeRecipientName},`,
    '',
    `Welcome to SwiftCause. Your organization (${safeOrgName}) is now set up.`,
    'You can now sign in and start setting up campaigns, kiosks, and Stripe onboarding.',
    'If you need help getting started, just reply to this email.',
    '',
    'Welcome aboard,',
    'SwiftCause Team',
  ].join('\n');

  const html = buildEmailShell({
    preheader: 'Your SwiftCause organization is ready. Sign in to get started.',
    title: 'Welcome to SwiftCause',
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(safeRecipientName)},</p>
      <p style="margin:0 0 12px;">Welcome to SwiftCause. Your organization <strong>${escapeHtml(safeOrgName)}</strong> is now set up.</p>
      <p style="margin:0 0 12px;">You can now sign in and start setting up campaigns, kiosks, and Stripe onboarding.</p>
      <p style="margin:0 0 12px;">If you need help getting started, just reply to this email.</p>
      <p style="margin:0;">Welcome aboard,<br/><strong>SwiftCause Team</strong></p>
    `,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
    categories: ['organization-welcome'],
    customArgs: {
      organizationId: organizationId || '',
      uid: uid || '',
    },
    auditEventType: 'org_welcome',
  });
};

const sendContactConfirmationEmail = async ({ to, firstName, message }) => {
  const safeFirstName =
    typeof firstName === 'string' && firstName.trim() ? firstName.trim() : 'there';
  const safeMessage = typeof message === 'string' ? message.trim() : '';
  const messageHtml = escapeHtml(safeMessage).replace(/\r?\n/g, '<br/>');

  const subject = 'We received your message';
  const text = [
    `Hi ${safeFirstName},`,
    '',
    'Thanks for contacting SwiftCause. We received your message and will get back to you shortly.',
    'Our team usually replies within one business day.',
    '',
    'Message:',
    safeMessage || '(No message provided)',
    '',
    'Regards,',
    'SwiftCause Team',
  ].join('\n');

  const html = buildEmailShell({
    preheader: 'We received your message and will get back to you shortly.',
    title: 'We Received Your Message',
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${escapeHtml(safeFirstName)},</p>
      <p style="margin:0 0 12px;">Thanks for contacting SwiftCause. We received your message and will get back to you shortly.</p>
      <p style="margin:0 0 12px;">Our team usually replies within one business day.</p>
      <p style="margin:0 0 6px;"><strong>Your message</strong></p>
      <div style="margin:0 0 12px; padding:12px; border:1px solid #e5e7eb; border-radius:10px; background:#f9fafb;">
        ${messageHtml || '(No message provided)'}
      </div>
      <p style="margin:0;">Regards,<br/><strong>SwiftCause Team</strong></p>
    `,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
    categories: ['contact-confirmation'],
    auditEventType: 'contact_confirmation',
  });
};

/**
 * Send subscription management magic link email
 * @param {object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.magicLink - Magic link URL
 * @param {number} params.expiresInMinutes - Link expiration time
 * @return {Promise<object>} SendGrid response
 */
const sendSubscriptionMagicLinkEmail = async ({ to, magicLink, expiresInMinutes = 15 }) => {
  const subject = 'Access Your Donations - SwiftCause';

  const text = [
    'Hello,',
    '',
    'You requested access to manage your donations.',
    '',
    'Click the link below to securely access your donation dashboard:',
    magicLink,
    '',
    `This link will expire in ${expiresInMinutes} minutes and can only be used once.`,
    '',
    "If you didn't request this, you can safely ignore this email.",
    '',
    'Best regards,',
    'SwiftCause Team',
  ].join('\n');

  const html = buildEmailShell({
    preheader: 'Click to securely access your donation dashboard',
    title: 'Access Your Donations',
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello,</p>
      <p style="margin:0 0 12px;">You requested access to manage your donations.</p>
      <p style="margin:0 0 20px;">Click the button below to securely access your donation dashboard:</p>
      
      <table role="presentation" style="width:100%; border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:10px 0;">
            <a href="${escapeHtml(magicLink)}" 
               style="display:inline-block; padding:16px 32px; background-color:#047857; color:#ffffff; text-decoration:none; border-radius:12px; font-weight:600; font-size:16px;">
              Access Dashboard
            </a>
          </td>
        </tr>
      </table>
      
      <p style="margin:24px 0 0; font-size:14px; line-height:1.6; color:#6b7280;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:8px 0 0; font-size:13px; line-height:1.6; color:#047857; word-break:break-all;">
        ${escapeHtml(magicLink)}
      </p>
      
      <div style="margin:24px 0 0; padding:16px; background:#f3f4f6; border-left:4px solid #047857; border-radius:8px;">
        <p style="margin:0; font-size:14px; line-height:1.6; color:#374151;">
          <strong>🔒 Security Notice:</strong><br>
          This link expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
        </p>
      </div>
      
      <p style="margin:16px 0 0; font-size:14px; color:#6b7280;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
    categories: ['subscription-magic-link'],
    auditEventType: 'subscription_magic_link',
  });
};

module.exports = {
  ensureEmailInitialized,
  sendEmail,
  sendDonationThankYouEmail,
  sendOrganizationWelcomeEmail,
  sendContactConfirmationEmail,
  sendSubscriptionMagicLinkEmail,
};
