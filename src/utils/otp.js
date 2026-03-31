/**
 * OTP utilities — generate, store, verify, and send one-time passwords.
 *
 * In development (SMTP_ENABLED=false) the code is logged to the console
 * instead of being emailed — zero setup required to try the app.
 */

import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { v4 as uuid } from 'uuid'
import * as otpRepo from '../repositories/otp.repository.js'

const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10)
const SMTP_ENABLED        = process.env.SMTP_ENABLED === 'true'

// ─── Generation ──────────────────────────────────────────────────────────────

export function generateCode() {
  return String(crypto.randomInt(100000, 999999))
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function saveOtp(email, code) {
  // Invalidate any previous unused codes for this email
  await otpRepo.invalidatePreviousCodes(email)

  await otpRepo.create({ id: uuid(), email, code, expiresMinutes: OTP_EXPIRES_MINUTES })
}

/**
 * Returns true if code is valid, throws descriptive Error otherwise.
 */
export async function verifyOtp(email, code) {
  const row = await otpRepo.findValidCode(email, code)

  if (!row) throw new Error('Invalid or expired verification code. Please request a new one.')

  // Mark as used immediately so it can't be replayed
  await otpRepo.markUsed(row.id)

  return true
}

// ─── Email delivery ──────────────────────────────────────────────────────────

let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return _transporter
}

export async function sendOtpEmail(email, code) {
  if (!SMTP_ENABLED) {
    console.log(`\n  ┌─────────────────────────────────┐`)
    console.log(`  │  OTP for ${email.padEnd(23)}│`)
    console.log(`  │  Code: ${code.padEnd(27)}│`)
    console.log(`  │  Expires in ${OTP_EXPIRES_MINUTES} minutes            │`)
    console.log(`  └─────────────────────────────────┘\n`)
    return
  }

  await getTransporter().sendMail({
    from:    process.env.SMTP_FROM || 'PhotoShare <noreply@photoshare.app>',
    to:      email,
    subject: `Your PhotoShare verification code: ${code}`,
    text:    `Your verification code is ${code}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:24px;font-weight:800;margin:0 0 8px">PhotoShare</h2>
        <p style="color:#6B7280;margin:0 0 32px">Your verification code</p>
        <div style="background:#F3F4F6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:40px;font-weight:800;letter-spacing:8px;color:#111827">${code}</span>
        </div>
        <p style="color:#6B7280;font-size:14px;margin:0">
          This code expires in <strong>${OTP_EXPIRES_MINUTES} minutes</strong>.<br/>
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
