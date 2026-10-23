/**
 * Email Service for Garcia College of Technology Assessment & Recommendation System
 * Sends OTP messages for password reset and notifications.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // 1. Check if custom SMTP is defined in .env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    return transporter;
  }

  // 2. Check if Gmail service is defined in .env
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
    const cleanPass = String(process.env.GMAIL_APP_PASS).replace(/\s+/g, '');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER.trim(),
        pass: cleanPass
      }
    });
    return transporter;
  }

  return null;
}

function getFromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.GMAIL_USER) {
    return `"GCT Subject Recommendation System" <${process.env.GMAIL_USER.trim()}>`;
  }
  return '"GCT Subject Recommendation System" <noreply@gct.edu.ph>';
}

/**
 * Send Password Reset OTP Email
 * @param {string} toEmail 
 * @param {string} otpCode 
 * @param {string} recipientName 
 */
async function sendPasswordResetOtp(toEmail, otpCode, recipientName = 'Student') {
  const mailTransporter = getTransporter();

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: `[GCT] Your Password Reset Verification Code: ${otpCode}`,
    text: `Hello ${recipientName},\n\nYour Garcia College of Technology one-time password (OTP) reset code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">GARCIA COLLEGE OF TECHNOLOGY</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Subject Assessment & Recommendation System</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b;">
          <h3 style="margin-top: 0; font-size: 18px; color: #0f172a;">Password Reset Request</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Hello <strong>${recipientName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to reset your password. Use the verification code below to complete your password reset:
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #2563eb; border-radius: 10px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">
              ${otpCode}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
              ⏱️ This OTP code is valid for <strong>10 minutes</strong>.
            </p>
          </div>
          <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-bottom: 0;">
            If you did not request a password reset, you can safely ignore this email. Your account credentials will remain unchanged.
          </p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          Garcia College of Technology &bull; Registrar & Academic Services
        </div>
      </div>
    `
  };

  console.log(`\n==================================================`);
  console.log(`🔑 [EMAIL OTP DISPATCH]`);
  console.log(`📧 To: ${toEmail} (${recipientName})`);
  console.log(`🔢 OTP Code: ${otpCode}`);
  console.log(`⏱️ Expiry: 10 minutes`);
  console.log(`==================================================\n`);

  if (!mailTransporter) {
    console.log('ℹ️ SMTP is not configured in .env. OTP was logged above and returned for immediate verification.');
    return { success: true, delivered: false, simulated: true, otpCode };
  }

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log('✅ Email successfully sent via SMTP:', info.messageId);
    return { success: true, delivered: true, messageId: info.messageId, otpCode };
  } catch (error) {
    console.warn('⚠️ SMTP send error (OTP still valid via console fallback):', error.message);
    return { success: true, delivered: false, error: error.message, simulated: true, otpCode };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function buildStudentAccountResetEmail(recipientName, studentId) {
  const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
  const registrationUrl = `${appUrl.replace(/\/+$/, '')}/#register`;
  const safeName = escapeHtml(recipientName || 'Student');
  const safeStudentId = escapeHtml(studentId);
  const subject = '[GCT] Weekly student account reset: register again to restore access';
  const text = `Hello ${recipientName || 'Student'},\n\nAs part of GCT's weekly account reset, your student login account is scheduled to be reset every Monday at 12:00 AM. Your permanent student record and verification photos are not deleted.\n\nAfter the reset, create your account again using Student ID ${studentId}: ${registrationUrl}\n\nIf your student record is already verified, your account will be restored automatically. Otherwise, your registration will need Registrar approval.\n\nIf you have already registered again, you can ignore this reminder.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
      <h2 style="color:#1e3a8a">GCT Student Account Reset</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>As part of GCT's weekly account reset, your student login account is scheduled to reset every Monday at 12:00 AM. Your permanent student record and verification photos are not deleted.</p>
      <p>After the reset, create your account again with Student ID <strong>${safeStudentId}</strong>.</p>
      <p><a href="${escapeHtml(registrationUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Register again</a></p>
      <p>If your student record is already verified, your account will be restored automatically. Otherwise, your registration will need Registrar approval.</p>
      <p style="color:#64748b;font-size:13px">If you have already registered again, you can ignore this reminder.</p>
    </div>`;
  return { subject, text, html, registrationUrl };
}

async function sendStudentAccountResetNotice(toEmail, recipientName, studentId) {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return { success: false, delivered: false, error: 'Email delivery is not configured.' };
  }

  const { subject, text, html } = buildStudentAccountResetEmail(recipientName, studentId);
  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject,
    text,
    html
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log('[WEEKLY RESET EMAIL] Student reset notice accepted by mail server.');
    return { success: true, delivered: true, messageId: info.messageId };
  } catch (error) {
    console.warn('[WEEKLY RESET EMAIL] Delivery failed:', error.message);
    return { success: false, delivered: false, error: error.message };
  }
}

module.exports = {
  sendPasswordResetOtp,
  buildStudentAccountResetEmail,
  sendStudentAccountResetNotice
};
