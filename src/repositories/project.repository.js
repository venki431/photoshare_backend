/**
 * Project Repository — all database queries for the projects table.
 */

import { query } from '../config/db.js'

export async function count(userId, { status, search } = {}) {
  let text = 'SELECT COUNT(*)::int AS total FROM projects WHERE user_id = $1'
  const params = [userId]
  let idx = 2

  if (status && status !== 'all') {
    text += ` AND status = $${idx++}`
    params.push(status)
  }

  if (search) {
    text += ` AND (name ILIKE $${idx} OR event_type ILIKE $${idx})`
    params.push(`%${search}%`)
    idx++
  }

  const { rows } = await query(text, params)
  return rows[0].total
}

export async function findAll(userId, { status, search, limit, offset } = {}) {
  let text = 'SELECT * FROM projects WHERE user_id = $1'
  const params = [userId]
  let idx = 2

  if (status && status !== 'all') {
    text += ` AND status = $${idx++}`
    params.push(status)
  }

  if (search) {
    text += ` AND (name ILIKE $${idx} OR event_type ILIKE $${idx})`
    params.push(`%${search}%`)
    idx++
  }

  text += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`
  params.push(limit, offset)

  const { rows } = await query(text, params)
  return rows
}

export async function findById(id, userId) {
  const { rows } = await query(
    'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
    [id, userId]
  )
  return rows[0] || null
}

export async function findByIdOnly(id) {
  const { rows } = await query('SELECT * FROM projects WHERE id = $1', [id])
  return rows[0] || null
}

export async function findByShareId(shareId) {
  const { rows } = await query('SELECT * FROM projects WHERE share_id = $1', [shareId])
  return rows[0] || null
}

export async function findIdByShareId(shareId) {
  const { rows } = await query('SELECT id FROM projects WHERE share_id = $1', [shareId])
  return rows[0] || null
}

export async function create(fields) {
  const keys = Object.keys(fields)
  const placeholders = keys.map((_, i) => `$${i + 1}`)
  const values = keys.map(k => fields[k])

  const { rows } = await query(
    `INSERT INTO projects (${keys.join(', ')})
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
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] || null
}

export async function deleteById(id) {
  await query('DELETE FROM projects WHERE id = $1', [id])
}

export async function incrementImageCount(projectId) {
  await query(
    'UPDATE projects SET image_count = image_count + 1 WHERE id = $1',
    [projectId]
  )
}

export async function decrementImageCount(projectId) {
  await query(
    'UPDATE projects SET image_count = GREATEST(0, image_count - 1) WHERE id = $1',
    [projectId]
  )
}

export async function decrementImageCountBy(projectId, amount) {
  await query(
    'UPDATE projects SET image_count = GREATEST(0, image_count - $2) WHERE id = $1',
    [projectId, amount]
  )
}

export async function incrementSelectedCount(projectId) {
  await query(
    'UPDATE projects SET selected_count = selected_count + 1 WHERE id = $1',
    [projectId]
  )
}

export async function decrementSelectedCount(projectId) {
  await query(
    'UPDATE projects SET selected_count = GREATEST(0, selected_count - 1) WHERE id = $1',
    [projectId]
  )
}

/**
 * Fetch project with all its photos (used by gallery endpoint).
 */
export async function findByShareIdWithPhotos(shareId) {
  const project = await findByShareId(shareId)
  if (!project) return null

  const { rows: photos } = await query(
    'SELECT * FROM photos WHERE project_id = $1 ORDER BY created_at ASC',
    [project.id]
  )

  project.photos = photos
  return project
}

export async function getSelectionLimit(projectId) {
  const { rows } = await query(
    'SELECT selection_limit FROM projects WHERE id = $1',
    [projectId]
  )
  return rows[0]?.selection_limit || null
}
