/**
 * Auth Controller
 *
 * POST /auth/check-email   — check if email already exists
 * POST /auth/send-otp      — generate + deliver OTP (login or signup)
 * POST /auth/signup        — register new user with profile data + OTP verification
 * POST /auth/verify-otp    — verify OTP, return JWT + user (login)
 * GET  /auth/me            — return current user from JWT
 * PUT  /auth/me            — update current user profile
 */

import * as authService from '../services/auth.service.js'
import { generateCode, saveOtp, verifyOtp, sendOtpEmail } from '../utils/otp.js'
import * as R from '../utils/response.js'

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function checkEmail(req, res) {
  const result = await authService.checkEmail(req.body.email)
  if (!result.valid) return R.badRequest(res, result.error)
  return R.success(res, { exists: result.exists }, result.exists ? 'User exists' : 'User not found')
}

export async function sendOtp(req, res) {
  const { email } = req.body

  if (!email || !authService.validateEmail(email)) {
    return R.badRequest(res, 'A valid email address is required')
  }

  const code = generateCode()
  await saveOtp(email.toLowerCase(), code)
  await sendOtpEmail(email.toLowerCase(), code)

  return R.success(res, null, `Verification code sent to ${email}`)
}

export async function signup(req, res) {
  const result = await authService.signupUser(req.body, verifyOtp)
  if (result.error) return R.error(res, result.error, result.status)
  return R.created(res, result.data, 'Account created successfully')
}

export async function verifyOtpHandler(req, res) {
  const result = await authService.loginWithOtp(req.body, verifyOtp)
  if (result.error) return R.error(res, result.error, result.status)
  return R.success(res, result.data, 'Signed in successfully')
}

export async function getMe(req, res) {
  const result = await authService.getMe(req.user.id)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'User fetched')
}

export async function updateMe(req, res) {
  const result = await authService.updateMe(req.user.id, req.body)
  if (result.error) return R.error(res, result.error, result.status)
  return R.success(res, result.data, 'Profile updated')
}
