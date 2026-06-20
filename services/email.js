const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // For development only
  }
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error.message);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

/**
 * Send OTP Email
 * @param {string} to - Recipient email
 * @param {string} otp - One-time password
 */
const sendOTPEmail = async (to, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Blogify" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: '🔐 Your Blogify Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to Blogify!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Your verification code is:
          </p>
          <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">
            This code will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send OTP to ${to}:`, error.message);
    throw error;
  }
};

/**
 * Send Reset Password Email
 * @param {string} to - Recipient email
 * @param {string} resetLink - Password reset link
 */
const sendResetPasswordEmail = async (to, resetLink) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Blogify" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: '🔐 Reset Your Blogify Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="background: #f0f0f0; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; color: #333;">
            ${resetLink}
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in <strong>30 minutes</strong>. If you didn't request this, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Blogify Security Team
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Reset Password Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send reset email to ${to}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendOTPEmail,
  sendResetPasswordEmail
};