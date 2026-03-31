/**
 * Auth Controller
 *
 * POST /auth/send-otp      — generate + deliver OTP (login or signup)
 * POST /auth/verify-otp    — verify OTP, return JWT + user (login)
 * POST /auth/signup        — register new user with profile data + OTP verification
 * POST /auth/check-email   — check if email already exists
 * GET  /auth/me            — return current user from JWT
 * PUT  /auth/me            — update current user profile
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

function formatUser(user) {
  return {
    id:                  user.id,
    email:               user.email,
    name:                user.name,
    role:                user.role,
    dateOfBirth:         user.date_of_birth || null,
    phoneNumber:         user.phone_number || null,
    address:             user.address || null,
    avatarUrl:           user.avatar_url || null,
    isVerified:          user.is_verified,
    onboardingCompleted: user.onboarding_completed,
    createdAt:           user.created_at,
    updatedAt:           user.updated_at,
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/

function validateSignupFields({ name, email, phone_number, date_of_birth, address }) {
  const errors = []
  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters')
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email address is required')
  if (!phone_number || !PHONE_RE.test(phone_number)) errors.push('A valid phone number is required')
  if (!date_of_birth) errors.push('Date of birth is required')
  if (!address || address.trim().length < 5) errors.push('Address must be at least 5 characters')
  return errors
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /auth/check-email
 * Returns whether the email is already registered.
 */
export async function checkEmail(req, res) {
  const { email } = req.body
  if (!email || !EMAIL_RE.test(email)) {
    return R.badRequest(res, 'A valid email address is required')
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  return R.success(res, { exists: !!user }, user ? 'User exists' : 'User not found')
}

/**
 * POST /auth/send-otp
 * Generates and sends OTP to the given email.
 * Works for both signup and login flows.
 */
export async function sendOtp(req, res) {
  const { email } = req.body

  if (!email || !EMAIL_RE.test(email)) {
    return R.badRequest(res, 'A valid email address is required')
  }

  const code = generateCode()
  await saveOtp(email.toLowerCase(), code)
  await sendOtpEmail(email.toLowerCase(), code)

  return R.success(res, null, `Verification code sent to ${email}`)
}

/**
 * POST /auth/signup
 * Register a new user with profile data + OTP verification.
 * Flow: frontend collects profile → sends OTP → user enters code → calls this endpoint.
 */
export async function signup(req, res) {
  const { name, email, phone_number, date_of_birth, address, otp } = req.body

  // Validate all fields
  const errors = validateSignupFields({ name, email, phone_number, date_of_birth, address })
  if (!otp || !/^\d{6}$/.test(otp)) errors.push('A valid 6-digit verification code is required')
  if (errors.length > 0) return R.badRequest(res, errors.join('. '))

  const normalEmail = email.toLowerCase()

  // Check for duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalEmail)
    .single()

  if (existing) return R.badRequest(res, 'An account with this email already exists. Please login instead.')

  // Check for duplicate phone number
  const { data: phoneExists } = await supabase
    .from('users')
    .select('id')
    .eq('phone_number', phone_number.trim())
    .single()

  if (phoneExists) return R.badRequest(res, 'This phone number is already registered to another account')

  // Verify OTP
  await verifyOtp(normalEmail, otp)

  // Create user with full profile
  const id = uuid()
  const { data: newUser, error: insertErr } = await supabase
    .from('users')
    .insert({
      id,
      email: normalEmail,
      name: name.trim(),
      phone_number: phone_number.trim(),
      date_of_birth,
      address: address.trim(),
      is_verified: true,
      onboarding_completed: true,
    })
    .select('*')
    .single()

  if (insertErr) throw insertErr

  const token = signToken(newUser)
  return R.created(res, { token, user: formatUser(newUser) }, 'Account created successfully')
}

/**
 * POST /auth/verify-otp
 * Login flow: verify OTP for existing user and return JWT.
 */
export async function verifyOtpHandler(req, res) {
  const { email, otp } = req.body

  if (!email || !otp) return R.badRequest(res, 'Email and verification code are required')
  if (!/^\d{6}$/.test(otp)) return R.badRequest(res, 'Verification code must be 6 digits')

  const normalEmail = email.toLowerCase()

  // Check user exists (login flow only)
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalEmail)
    .single()

  if (!user) {
    return R.badRequest(res, 'No account found with this email. Please sign up first.')
  }

  await verifyOtp(normalEmail, otp)

  // Mark user as verified if not already
  if (!user.is_verified) {
    await supabase.from('users').update({ is_verified: true }).eq('id', user.id)
    user.is_verified = true
  }

  const token = signToken(user)
  return R.success(res, { token, user: formatUser(user) }, 'Signed in successfully')
}

/**
 * GET /auth/me
 * Returns the current authenticated user.
 */
export async function getMe(req, res) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single()

  if (error || !user) return R.notFound(res, 'User not found')
  return R.success(res, formatUser(user), 'User fetched')
}

/**
 * PUT /auth/me
 * Update the current user's profile.
 */
export async function updateMe(req, res) {
  const allowedFields = ['name', 'phone_number', 'date_of_birth', 'address', 'avatar_url']
  const updates = {}

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return R.badRequest(res, 'No valid fields to update')
  }

  // Validate phone uniqueness if being updated
  if (updates.phone_number) {
    const { data: phoneExists } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', updates.phone_number)
      .neq('id', req.user.id)
      .single()

    if (phoneExists) return R.badRequest(res, 'This phone number is already registered to another account')
  }

  const { data: user, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.user.id)
    .select('*')
    .single()

  if (error) throw error
  return R.success(res, formatUser(user), 'Profile updated')
}
