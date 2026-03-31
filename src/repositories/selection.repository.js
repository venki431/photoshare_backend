/**
 * Selection Repository — all database queries for selections & selected_photos tables.
 */

import { query } from '../config/db.js'

// ─── Selections ──────────────────────────────────────────────────────────────

export async function findByShareId(shareId) {
  const { rows } = await query(
    'SELECT * FROM selections WHERE share_id = $1',
    [shareId]
  )
  return rows[0] || null
}

export async function findByProjectId(projectId) {
  const { rows } = await query(
    'SELECT id, status, submitted_at FROM selections WHERE project_id = $1',
    [projectId]
  )
  return rows[0] || null
}

export async function create({ id, share_id, project_id }) {
  const { rows } = await query(
    `INSERT INTO selections (id, share_id, project_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, share_id, project_id]
  )
  return rows[0]
}

export async function updateStatus(id, status, submittedAt) {
  await query(
    'UPDATE selections SET status = $2, submitted_at = $3 WHERE id = $1',
    [id, status, submittedAt]
  )
}

// ─── Selected Photos ─────────────────────────────────────────────────────────

export async function findSelectedPhotos(selectionId) {
  const { rows } = await query(
    'SELECT photo_id, comment FROM selected_photos WHERE selection_id = $1',
    [selectionId]
  )
  return rows
}

export async function findSelectedPhoto(selectionId, photoId) {
  const { rows } = await query(
    'SELECT id FROM selected_photos WHERE selection_id = $1 AND photo_id = $2',
    [selectionId, photoId]
  )
  return rows[0] || null
}

export async function countSelectedPhotos(selectionId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS total FROM selected_photos WHERE selection_id = $1',
    [selectionId]
  )
  return rows[0].total
}

export async function addPhoto({ id, selection_id, photo_id }) {
  await query(
    'INSERT INTO selected_photos (id, selection_id, photo_id) VALUES ($1, $2, $3)',
    [id, selection_id, photo_id]
  )
}

export async function removePhoto(selectionId, photoId) {
  await query(
    'DELETE FROM selected_photos WHERE selection_id = $1 AND photo_id = $2',
    [selectionId, photoId]
  )
}

export async function updateComment(selectionId, photoId, comment) {
  await query(
    'UPDATE selected_photos SET comment = $3 WHERE selection_id = $1 AND photo_id = $2',
    [selectionId, photoId, comment]
  )
}

export async function findSelectedPhotoIds(selectionId) {
  const { rows } = await query(
    'SELECT photo_id FROM selected_photos WHERE selection_id = $1',
    [selectionId]
  )
  return rows.map(r => r.photo_id)
}

export async function photoExistsInProject(photoId, projectId) {
  const { rows } = await query(
    'SELECT id FROM photos WHERE id = $1 AND project_id = $2',
    [photoId, projectId]
  )
  return rows[0] || null
}
