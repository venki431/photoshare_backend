/**
 * OTP Repository — all database queries for the otp_codes table.
 */

import { query } from '../config/db.js'

export async function invalidatePreviousCodes(email) {
  await query(
    'UPDATE otp_codes SET used = true WHERE email = $1 AND used = false',
    [email]
  )
}

export async function create({ id, email, code, expiresMinutes }) {
  const { rows } = await query(
    `INSERT INTO otp_codes (id, email, code, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))
     RETURNING *`,
    [id, email, code, expiresMinutes]
  )
  return rows[0]
}

export async function findValidCode(email, code) {
  const { rows } = await query(
    `SELECT * FROM otp_codes
     WHERE email = $1 AND code = $2 AND used = false AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, code]
  )
  return rows[0] || null
}

export async function markUsed(id) {
  await query('UPDATE otp_codes SET used = true WHERE id = $1', [id])
}
