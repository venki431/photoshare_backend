/**
 * Photo Repository — all database queries for the photos table.
 */

import { query } from '../config/db.js'

export async function count(projectId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS total FROM photos WHERE project_id = $1',
    [projectId]
  )
  return rows[0].total
}

export async function findAll(projectId, { limit, offset }) {
  const { rows } = await query(
    `SELECT * FROM photos
     WHERE project_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [projectId, limit, offset]
  )
  return rows
}

export async function findByIdWithOwner(photoId) {
  const { rows } = await query(
    `SELECT p.*, proj.user_id AS project_user_id
     FROM photos p
     JOIN projects proj ON proj.id = p.project_id
     WHERE p.id = $1`,
    [photoId]
  )
  return rows[0] || null
}

export async function findByIdsWithOwner(ids, userId) {
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await query(
    `SELECT p.*, proj.user_id AS project_user_id
     FROM photos p
     JOIN projects proj ON proj.id = p.project_id
     WHERE p.id IN (${placeholders}) AND proj.user_id = $${ids.length + 1}`,
    [...ids, userId]
  )
  return rows
}

export async function create(fields) {
  const keys = Object.keys(fields)
  const placeholders = keys.map((_, i) => `$${i + 1}`)
  const values = keys.map(k => fields[k])

  const { rows } = await query(
    `INSERT INTO photos (${keys.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    values
  )
  return rows[0]
}

export async function deleteById(id) {
  await query('DELETE FROM photos WHERE id = $1', [id])
}

export async function deleteByIds(ids) {
  if (ids.length === 0) return
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
  await query(`DELETE FROM photos WHERE id IN (${placeholders})`, ids)
}

export async function findSelectedByProjectId(selectionId) {
  const { rows } = await query(
    `SELECT
       sp.photo_id,
       sp.comment,
       p.id,
       p.original_file_name,
       p.compressed_file_name,
       p.storage_url,
       p.thumbnail_url,
       p.file_size_original,
       p.file_size_compressed,
       p.mime_type,
       p.width,
       p.height,
       p.created_at
     FROM selected_photos sp
     JOIN photos p ON p.id = sp.photo_id
     WHERE sp.selection_id = $1`,
    [selectionId]
  )
  return rows
}
