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
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getAppFrontendUrl(customOrigin) {
  // 1. If an explicit origin was passed from an active request and is a remote web URL (e.g. from Vercel)
  if (customOrigin && typeof customOrigin === 'string' && customOrigin.startsWith('http')) {
    const trimmed = customOrigin.replace(/\/+$/, '');
    if (!trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
      return trimmed;
    }
  }

  // 2. Check process.env.FRONTEND_URL or APP_URL (prefer non-localhost)
  const envUrl = process.env.FRONTEND_URL || process.env.APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    const trimmedEnv = envUrl.replace(/\/+$/, '');
    if (!trimmedEnv.includes('localhost') && !trimmedEnv.includes('127.0.0.1')) {
      return trimmedEnv;
    }
  }

  // 3. Vercel automatically exposes VERCEL_PROJECT_PRODUCTION_URL (e.g. "my-project.vercel.app")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}`;
  }

  // 4. Vercel automatically exposes VERCEL_URL (e.g. "my-project-abc123.vercel.app")
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}`;
  }

  // 5. Official live production deployment URL
  const PRODUCTION_VERCEL_URL = 'https://gct-subject-assessment-and-recommen.vercel.app';

  // 6. If customOrigin was provided
  if (customOrigin && typeof customOrigin === 'string' && customOrigin.startsWith('http')) {
    const trimmed = customOrigin.replace(/\/+$/, '');
    if (!trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
      return trimmed;
    }
  }

  // 7. If FRONTEND_URL is set and not localhost
  if (envUrl && typeof envUrl === 'string' && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 8. Default to official production Vercel system so emails always work on phones & outside localhost
  return PRODUCTION_VERCEL_URL;
}

function buildStudentAccountResetEmail(recipientName, studentId, customOrigin) {
  const appUrl = getAppFrontendUrl(customOrigin);
  const registrationUrl = `${appUrl.replace(/\/+$/, '')}/#register`;
  const safeName = escapeHtml(recipientName || 'Student');
  const safeStudentId = escapeHtml(studentId);
  const subject = '[GCT] Weekly student account reset: register again to restore access';
  const text = `Hello ${recipientName || 'Student'},\n\nAs part of GCT's weekly account reset, your student login account is scheduled to be reset every Monday at 12:00 AM. Your permanent student record and verification photos are not deleted.\n\nAfter the reset, create your account again using Student ID ${studentId}: ${registrationUrl}\n\nIf your student record is already verified, your account will be restored automatically. Otherwise, your registration will need Registrar approval.\n\nIf you have already registered again, you can ignore this reminder.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6">
      <h2 style="color:#1e3a8a">GCT Student Account Reset</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>As part of GCT's weekly account reset, your student login account is scheduled to reset every Monday at 12:00 AM. Your permanent student record is preserved.</p>
      <p>After the reset, create your account again with Student ID <strong>${safeStudentId}</strong>.</p>
      <p><a href="${escapeHtml(registrationUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Register again</a></p>
      <p>If your student record is already verified, your account will be restored automatically. Otherwise, your registration will need Registrar approval.</p>
      <p style="color:#64748b;font-size:13px">If you have already registered again, you can ignore this reminder.</p>
    </div>`;
  return { subject, text, html, registrationUrl };
}

async function sendStudentAccountResetNotice(toEmail, recipientName, studentId, customOrigin) {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return { success: false, delivered: false, error: 'Email delivery is not configured.' };
  }

  const { subject, text, html } = buildStudentAccountResetEmail(recipientName, studentId, customOrigin);
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

async function sendRegistrationOtp(toEmail, otpCode, recipientName = 'Student') {
  const mailTransporter = getTransporter();
  const safeName = escapeHtml(recipientName || 'Student');

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: `[GCT] Student Registration Verification Code: ${otpCode}`,
    text: `Hello ${recipientName},\n\nYour Garcia College of Technology registration verification code is: ${otpCode}\n\nThis OTP code will expire in 10 minutes.\n\nOnce verified, your registration will be sent to the Registrar Admin for approval.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">GARCIA COLLEGE OF TECHNOLOGY</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Subject Assessment & Recommendation System</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b;">
          <h3 style="margin-top: 0; font-size: 18px; color: #0f172a;">Student Account Registration</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Hello <strong>${safeName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Thank you for registering your student account. Please use the 6-digit verification code below to verify your email address:
          </p>
          <div style="margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #2563eb; border-radius: 10px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">
              ${otpCode}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
              ⏱️ This OTP code is valid for <strong>10 minutes</strong>.
            </p>
          </div>
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #1e40af; line-height: 1.5;">
            ℹ️ <strong>Next Step:</strong> After submitting this code, your registration will be reviewed by the Registrar Admin. Once approved, your temporary system-generated password will be emailed to this address.
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          Garcia College of Technology &bull; Registrar & Academic Services
        </div>
      </div>
    `
  };

  console.log(`\n==================================================`);
  console.log(`📩 [REGISTRATION OTP DISPATCH]`);
  console.log(`📧 To: ${toEmail} (${recipientName})`);
  console.log(`🔢 OTP Code: ${otpCode}`);
  console.log(`⏱️ Expiry: 10 minutes`);
  console.log(`==================================================\n`);

  if (!mailTransporter) {
    console.log('ℹ️ SMTP is not configured in .env. OTP was logged above and returned for simulation.');
    return { success: true, delivered: false, simulated: true, otpCode };
  }

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log('✅ Registration OTP successfully sent via SMTP:', info.messageId);
    return { success: true, delivered: true, messageId: info.messageId, otpCode };
  } catch (error) {
    console.warn('⚠️ SMTP send error (OTP still valid via fallback):', error.message);
    return { success: true, delivered: false, error: error.message, simulated: true, otpCode };
  }
}

async function sendStudentApprovalPassword(toEmail, recipientName, studentId, generatedPassword, customOrigin) {
  const mailTransporter = getTransporter();
  const safeName = escapeHtml(recipientName || 'Student');
  const safeStudentId = escapeHtml(studentId || '');
  const appUrl = getAppFrontendUrl(customOrigin);
  const loginUrl = `${appUrl.replace(/\/+$/, '')}/#login`;

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: `[GCT] Student Account Approved - Your System Generated Password`,
    text: `Hello ${recipientName},\n\nGreat news! Your student account registration for Student ID ${studentId} has been APPROVED by the Registrar Admin.\n\nYour System-Generated Password: ${generatedPassword}\n\nIMPORTANT NOTICE: This password is ONLY VALID FOR ONE WEEK. Garcia College of Technology security policy automatically resets student passwords every week.\n\nLog in here: ${loginUrl}\nUsername: ${studentId}\nPassword: ${generatedPassword}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">GARCIA COLLEGE OF TECHNOLOGY</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Subject Assessment & Recommendation System</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b;">
          <h3 style="margin-top: 0; font-size: 18px; color: #15803d;">🎉 Account Approved by Registrar Admin</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Hello <strong>${safeName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Your student account registration for Student ID <strong>${safeStudentId}</strong> has been officially approved. You may now log in to the system with the credentials below:
          </p>

          <div style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px;">
            <div style="margin-bottom: 10px; font-size: 14px; color: #334155;">
              <strong>Student ID (Username):</strong> <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: #1e3a8a;">${safeStudentId}</span>
            </div>
            <div style="font-size: 14px; color: #334155;">
              <strong>System-Generated Password:</strong>
              <div style="display: inline-block; margin-top: 6px; background-color: #ffffff; border: 2px dashed #15803d; border-radius: 8px; padding: 8px 18px; font-family: monospace; font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #15803d;">
                ${escapeHtml(generatedPassword)}
              </div>
            </div>
          </div>

          <!-- PROMINENT ONE WEEK NOTICE -->
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 10px; padding: 14px 16px; margin: 20px 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">⚠️</span>
              <strong style="color: #92400e; font-size: 14px;">NOTICE: THIS PASSWORD IS ONLY VALID FOR ONE WEEK</strong>
            </div>
            <p style="margin: 8px 0 0 0; font-size: 12.5px; line-height: 1.5; color: #78350f;">
              For security and institutional compliance, the system automatically regenerates and resets student account passwords on a weekly basis. A new password will be automatically generated and sent to this email next week.
            </p>
          </div>

          <div style="text-align: center; margin: 26px 0 10px 0;">
            <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(30, 58, 138, 0.2);">
              Log In to Student Portal &rarr;
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          Garcia College of Technology &bull; Registrar & Academic Services
        </div>
      </div>
    `
  };

  console.log(`\n==================================================`);
  console.log(`🔑 [STUDENT APPROVAL PASSWORD DISPATCH]`);
  console.log(`📧 To: ${toEmail} (${recipientName})`);
  console.log(`🎓 Student ID: ${studentId}`);
  console.log(`🔐 Generated Password: ${generatedPassword}`);
  console.log(`⏱️ Notice: This password is valid for ONE WEEK only.`);
  console.log(`==================================================\n`);

  if (!mailTransporter) {
    console.log('ℹ️ SMTP is not configured in .env. Password logged above for testing.');
    return { success: true, delivered: false, simulated: true, generatedPassword };
  }

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log('✅ Approval password email successfully sent via SMTP:', info.messageId);
    return { success: true, delivered: true, messageId: info.messageId, generatedPassword };
  } catch (error) {
    console.warn('⚠️ SMTP send error (password still valid via fallback):', error.message);
    return { success: true, delivered: false, error: error.message, simulated: true, generatedPassword };
  }
}

async function sendWeeklyPasswordRenewalEmail(toEmail, recipientName, studentId, newPassword, customOrigin) {
  const mailTransporter = getTransporter();
  const safeName = escapeHtml(recipientName || 'Student');
  const safeStudentId = escapeHtml(studentId || '');
  const appUrl = getAppFrontendUrl(customOrigin);
  const loginUrl = `${appUrl.replace(/\/+$/, '')}/#login`;

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: `[GCT] Weekly Password Reset: Your New Student Login Password`,
    text: `Hello ${recipientName},\n\nAs part of Garcia College of Technology's weekly security reset, your student password has been automatically renewed.\n\nStudent ID: ${studentId}\nNew Weekly Password: ${newPassword}\n\nNOTICE: This password is ONLY VALID FOR ONE WEEK.\n\nLog in here: ${loginUrl}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">GARCIA COLLEGE OF TECHNOLOGY</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Subject Assessment & Recommendation System</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b;">
          <h3 style="margin-top: 0; font-size: 18px; color: #1e3a8a;">🔄 Weekly Student Password Renewal</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Hello <strong>${safeName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            In accordance with our weekly security policy, your login password for Student ID <strong>${safeStudentId}</strong> has been automatically regenerated for this week:
          </p>

          <div style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px;">
            <div style="margin-bottom: 10px; font-size: 14px; color: #334155;">
              <strong>Student ID:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: 700; color: #1e3a8a;">${safeStudentId}</span>
            </div>
            <div style="font-size: 14px; color: #334155;">
              <strong>New Weekly Password:</strong>
              <div style="display: inline-block; margin-top: 6px; background-color: #ffffff; border: 2px dashed #2563eb; border-radius: 8px; padding: 8px 18px; font-family: monospace; font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #1e3a8a;">
                ${escapeHtml(newPassword)}
              </div>
            </div>
          </div>

          <!-- PROMINENT ONE WEEK NOTICE -->
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 10px; padding: 14px 16px; margin: 20px 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">⏱️</span>
              <strong style="color: #92400e; font-size: 14px;">NOTICE: THIS PASSWORD IS VALID FOR ONE WEEK ONLY</strong>
            </div>
            <p style="margin: 8px 0 0 0; font-size: 12.5px; line-height: 1.5; color: #78350f;">
              This password will remain active until the next scheduled weekly reset. A new password will be automatically sent to your Gmail upon the next reset cycle.
            </p>
          </div>

          <div style="text-align: center; margin: 26px 0 10px 0;">
            <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(30, 58, 138, 0.2);">
              Sign In with New Password &rarr;
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          Garcia College of Technology &bull; Registrar & Academic Services
        </div>
      </div>
    `
  };

  console.log(`\n==================================================`);
  console.log(`🔄 [WEEKLY PASSWORD RENEWAL DISPATCH]`);
  console.log(`📧 To: ${toEmail} (${recipientName})`);
  console.log(`🎓 Student ID: ${studentId}`);
  console.log(`🔐 New Password: ${newPassword}`);
  console.log(`⏱️ Notice: This password is valid for ONE WEEK only.`);
  console.log(`==================================================\n`);

  if (!mailTransporter) {
    console.log('ℹ️ SMTP is not configured in .env. Password logged above for testing.');
    return { success: true, delivered: false, simulated: true, newPassword };
  }

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log('✅ Weekly password renewal email sent via SMTP:', info.messageId);
    return { success: true, delivered: true, messageId: info.messageId, newPassword };
  } catch (error) {
    console.warn('⚠️ SMTP send error:', error.message);
    return { success: true, delivered: false, error: error.message, simulated: true, newPassword };
  }
}

/**
 * Early reminder notice sent to students in advance of the scheduled weekly reset.
 * Default schedule: Sunday at 12:00 PM (Noon), 12 hours before the Monday 12:00 AM reset.
 */
async function sendWeeklyPasswordResetEarlyNotice(toEmail, recipientName, studentId, customOrigin) {
  const mailTransporter = getTransporter();
  const safeName = escapeHtml(recipientName || 'Student');
  const safeStudentId = escapeHtml(studentId || '');
  const appUrl = getAppFrontendUrl(customOrigin);
  const loginUrl = `${appUrl.replace(/\/+$/, '')}/#login`;

  const mailOptions = {
    from: getFromAddress(),
    to: toEmail,
    subject: `[GCT Reminder] Notice: Upcoming Weekly Student Password Reset (Monday 12:00 AM)`,
    text: `Hello ${recipientName},\n\nThis is an advance notice that your student password for Student ID ${studentId} is scheduled for weekly renewal this coming Monday at 12:00 AM (Midnight).\n\nWhat to expect:\n- At Monday 12:00 AM, your current password will expire and a new weekly password will be automatically sent to this email address.\n- Your Student ID, profile, enrolled subjects, and academic records remain 100% intact.\n- No immediate action is required right now. Just check your email inbox on Monday morning to retrieve your new password.\n\nPortal: ${loginUrl}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">GARCIA COLLEGE OF TECHNOLOGY</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Subject Assessment & Recommendation System</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 24px;">🔔</span>
            <h3 style="margin: 0; font-size: 18px; color: #1e3a8a;">Advance Notice: Weekly Password Reset</h3>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Hello <strong>${safeName}</strong>,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            This is an early reminder that your login password for Student ID <strong>${safeStudentId}</strong> is scheduled for weekly renewal this coming <strong>Monday at 12:00 AM (Midnight)</strong>.
          </p>

          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 18px; margin: 20px 0;">
            <div style="font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 8px;">
              📌 What will happen:
            </div>
            <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.6; color: #1e3a8a;">
              <li>Your current password will expire at Monday 12:00 AM.</li>
              <li>A <strong>new temporary password</strong> will be automatically generated and emailed to this Gmail address.</li>
              <li>Your Student ID, profile, enrolled subjects, grades, and academic records remain <strong>100% intact and safe</strong>.</li>
            </ul>
          </div>

          <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #854d0e; line-height: 1.5; margin-bottom: 24px;">
            💡 <strong>Action needed:</strong> No action is required from you right now. Please check your Gmail inbox on Monday morning to retrieve your new weekly password before logging in.
          </div>

          <div style="text-align: center; margin: 20px 0 10px 0;">
            <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(30, 58, 138, 0.2);">
              Open Student Portal &rarr;
            </a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          Garcia College of Technology &bull; Registrar & Academic Services
        </div>
      </div>
    `
  };

  console.log(`\n==================================================`);
  console.log(`🔔 [WEEKLY PASSWORD RESET EARLY NOTICE DISPATCH]`);
  console.log(`📧 To: ${toEmail} (${recipientName})`);
  console.log(`🎓 Student ID: ${studentId}`);
  console.log(`⏱️ Scheduled Reset: Monday at 12:00 AM (Midnight)`);
  console.log(`==================================================\n`);

  if (!mailTransporter) {
    console.log('ℹ️ SMTP is not configured in .env. Early notice logged above for testing.');
    return { success: true, delivered: false, simulated: true };
  }

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log('✅ Weekly password reset early notice sent via SMTP:', info.messageId);
    return { success: true, delivered: true, messageId: info.messageId };
  } catch (error) {
    console.warn('⚠️ SMTP send error:', error.message);
    return { success: false, delivered: false, error: error.message, simulated: true };
  }
}

module.exports = {
  sendPasswordResetOtp,
  sendRegistrationOtp,
  sendStudentApprovalPassword,
  sendWeeklyPasswordRenewalEmail,
  sendWeeklyPasswordResetEarlyNotice,
  buildStudentAccountResetEmail,
  sendStudentAccountResetNotice
};

