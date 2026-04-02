/**
 * Folder Repository — all database queries for the folders table.
 */

import { query } from '../config/db.js'

export async function findAllByUserId(userId) {
  const { rows } = await query(
    `SELECT f.*,
            COUNT(p.id)::int AS project_count
     FROM folders f
     LEFT JOIN projects p ON p.folder_id = f.id
     WHERE f.user_id = $1
     GROUP BY f.id
     ORDER BY f.created_at ASC`,
    [userId]
  )
  return rows
}

export async function findById(id, userId) {
  const { rows } = await query(
    'SELECT * FROM folders WHERE id = $1 AND user_id = $2',
    [id, userId]
  )
  return rows[0] || null
}

export async function create(fields) {
  const keys = Object.keys(fields)
  const placeholders = keys.map((_, i) => `$${i + 1}`)
  const values = keys.map(k => fields[k])

  const { rows } = await query(
    `INSERT INTO folders (${keys.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values
  )
  return rows[0]
}

export async function update(id, fields) {
  const keys = Object.keys(fields)
  if (keys.length === 0) return null

  const setClauses = keys.map((key, i) => `${key} = $${i + 2}`)
  const values = keys.map(k => fields[k])

  const { rows } = await query(
    `UPDATE folders SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

export async function deleteById(id) {
  await query('DELETE FROM folders WHERE id = $1', [id])
}

export async function countByUserId(userId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS total FROM folders WHERE user_id = $1',
    [userId]
  )
  return rows[0].total
}

export async function findByShareId(shareId) {
  const { rows } = await query(
    `SELECT f.*,
            COUNT(p.id)::int AS project_count
     FROM folders f
     LEFT JOIN projects p ON p.folder_id = f.id
     WHERE f.share_id = $1
     GROUP BY f.id`,
    [shareId]
  )
  return rows[0] || null
}

export async function findOrCreateDefault(userId) {
  // Look for an existing "Default Folder" for this user
  const { rows } = await query(
    `SELECT * FROM folders WHERE user_id = $1 AND name = 'Default Folder' LIMIT 1`,
    [userId]
  )
  if (rows[0]) return rows[0]

  // Create one if it doesn't exist
  return create({
    name: 'Default Folder',
    user_id: userId,
  })
}
