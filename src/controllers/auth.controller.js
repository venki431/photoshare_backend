/**
 * Auth Controller
 *
 * POST /auth/send-otp    — generate + deliver OTP
 * POST /auth/verify-otp  — verify OTP, return JWT + user
 * GET  /auth/me          — return current user from JWT
 */

import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { supabase } from '../config/supabase.js'
import { generateCode, saveOtp, verifyOtp, sendOtpEmail } from '../utils/otp.js'
import * as R from '../utils/response.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

async function findOrCreateUser(email) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (user) return user

  // User doesn't exist — create one
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

  const id = uuid()
  const defaultName = email.split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  const { data: newUser, error: insertErr } = await supabase
    .from('users')
    .insert({ id, email, name: defaultName })
    .select('*')
    .single()

  if (insertErr) throw insertErr
  return newUser
}

function formatUser(user) {
  return {
    id:        user.id,
    email:     user.email,
    name:      user.name,
    role:      user.role,
    avatarUrl: user.avatar_url || null,
    createdAt: user.created_at,
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function sendOtp(req, res) {
  const { email } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return R.badRequest(res, 'A valid email address is required')
  }

  const code = generateCode()
  await saveOtp(email.toLowerCase(), code)
  await sendOtpEmail(email.toLowerCase(), code)

  return R.success(res, null, `Verification code sent to ${email}`)
}

export async function verifyOtpHandler(req, res) {
  const { email, otp } = req.body

  if (!email || !otp) return R.badRequest(res, 'Email and verification code are required')
  if (!/^\d{6}$/.test(otp)) return R.badRequest(res, 'Verification code must be 6 digits')

  const normalEmail = email.toLowerCase()

  await verifyOtp(normalEmail, otp)

  const user  = await findOrCreateUser(normalEmail)
  const token = signToken(user)

  return R.success(res, { token, user: formatUser(user) }, 'Signed in successfully')
}

export async function getMe(req, res) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single()

  if (error || !user) return R.notFound(res, 'User not found')
  return R.success(res, formatUser(user), 'User fetched')
}
