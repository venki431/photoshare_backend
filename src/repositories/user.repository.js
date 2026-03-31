/**
 * User Repository — all database queries for the users table.
 */

import { query } from '../config/db.js'

export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] || null
}

export async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
  return rows[0] || null
}

export async function findIdByEmail(email) {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email])
  return rows[0] || null
}

export async function findByPhoneNumber(phoneNumber) {
  const { rows } = await query('SELECT id FROM users WHERE phone_number = $1', [phoneNumber])
  return rows[0] || null
}

export async function findByPhoneNumberExcluding(phoneNumber, excludeUserId) {
  const { rows } = await query(
    'SELECT id FROM users WHERE phone_number = $1 AND id != $2',
    [phoneNumber, excludeUserId]
  )
  return rows[0] || null
}

export async function create({ id, email, name, phone_number, date_of_birth, address, is_verified, onboarding_completed }) {
  const { rows } = await query(
    `INSERT INTO users (id, email, name, phone_number, date_of_birth, address, is_verified, onboarding_completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, email, name, phone_number, date_of_birth, address, is_verified, onboarding_completed]
  )
  return rows[0]
}

export async function update(id, fields) {
  const keys = Object.keys(fields)
  if (keys.length === 0) return null

  const setClauses = keys.map((key, i) => `${key} = $${i + 2}`)
  const values = keys.map(k => fields[k])

  const { rows } = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

export async function markVerified(id) {
  await query('UPDATE users SET is_verified = true WHERE id = $1', [id])
}
