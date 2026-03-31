/**
 * Auth Service — business logic for authentication and user management.
 */

import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import * as userRepo from '../repositories/user.repository.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/

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

function validateSignupFields({ name, email, phone_number, date_of_birth, address }) {
  const errors = []
  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters')
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email address is required')
  if (!phone_number || !PHONE_RE.test(phone_number)) errors.push('A valid phone number is required')
  if (!date_of_birth) errors.push('Date of birth is required')
  if (!address || address.trim().length < 5) errors.push('Address must be at least 5 characters')
  return errors
}

// ─── Service methods ─────────────────────────────────────────────────────────

export async function checkEmail(email) {
  if (!email || !EMAIL_RE.test(email)) {
    return { valid: false, error: 'A valid email address is required' }
  }

  const user = await userRepo.findIdByEmail(email.toLowerCase())
  return { valid: true, exists: !!user }
}

export function validateEmail(email) {
  return EMAIL_RE.test(email)
}

export async function signupUser({ name, email, phone_number, date_of_birth, address, otp }, verifyOtpFn) {
  const errors = validateSignupFields({ name, email, phone_number, date_of_birth, address })
  if (!otp || !/^\d{6}$/.test(otp)) errors.push('A valid 6-digit verification code is required')
  if (errors.length > 0) return { error: errors.join('. '), status: 400 }

  const normalEmail = email.toLowerCase()

  const existing = await userRepo.findIdByEmail(normalEmail)
  if (existing) return { error: 'An account with this email already exists. Please login instead.', status: 400 }

  const phoneExists = await userRepo.findByPhoneNumber(phone_number.trim())
  if (phoneExists) return { error: 'This phone number is already registered to another account', status: 400 }

  await verifyOtpFn(normalEmail, otp)

  const id = uuid()
  const newUser = await userRepo.create({
    id,
    email: normalEmail,
    name: name.trim(),
    phone_number: phone_number.trim(),
    date_of_birth,
    address: address.trim(),
    is_verified: true,
    onboarding_completed: true,
  })

  const token = signToken(newUser)
  return { data: { token, user: formatUser(newUser) } }
}

export async function loginWithOtp({ email, otp }, verifyOtpFn) {
  if (!email || !otp) return { error: 'Email and verification code are required', status: 400 }
  if (!/^\d{6}$/.test(otp)) return { error: 'Verification code must be 6 digits', status: 400 }

  const normalEmail = email.toLowerCase()
  const user = await userRepo.findByEmail(normalEmail)

  if (!user) return { error: 'No account found with this email. Please sign up first.', status: 400 }

  await verifyOtpFn(normalEmail, otp)

  if (!user.is_verified) {
    await userRepo.markVerified(user.id)
    user.is_verified = true
  }

  const token = signToken(user)
  return { data: { token, user: formatUser(user) } }
}

export async function getMe(userId) {
  const user = await userRepo.findById(userId)
  if (!user) return { error: 'User not found', status: 404 }
  return { data: formatUser(user) }
}

export async function updateMe(userId, body) {
  const allowedFields = ['name', 'phone_number', 'date_of_birth', 'address', 'avatar_url']
  const updates = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = typeof body[field] === 'string' ? body[field].trim() : body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No valid fields to update', status: 400 }
  }

  if (updates.phone_number) {
    const phoneExists = await userRepo.findByPhoneNumberExcluding(updates.phone_number, userId)
    if (phoneExists) return { error: 'This phone number is already registered to another account', status: 400 }
  }

  const user = await userRepo.update(userId, updates)
  return { data: formatUser(user) }
}
