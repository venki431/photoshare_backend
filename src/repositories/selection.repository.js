/**
 * Selection Repository — all database queries for selections & photo selection via flag.
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

// ─── Photo Selection (via selected_by_client flag) ──────────────────────────

export async function isPhotoSelected(photoId) {
  const { rows } = await query(
    'SELECT selected_by_client FROM photos WHERE id = $1',
    [photoId]
  )
  return rows[0]?.selected_by_client || false
}

export async function countSelectedPhotos(projectId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS total FROM photos WHERE project_id = $1 AND selected_by_client = true',
    [projectId]
  )
  return rows[0].total
}

export async function selectPhoto(photoId) {
  await query(
    'UPDATE photos SET selected_by_client = true WHERE id = $1',
    [photoId]
  )
}

export async function deselectPhoto(photoId) {
  await query(
    'UPDATE photos SET selected_by_client = false WHERE id = $1',
    [photoId]
  )
}

export async function findSelectedPhotoIds(projectId) {
  const { rows } = await query(
    'SELECT id FROM photos WHERE project_id = $1 AND selected_by_client = true',
    [projectId]
  )
  return rows.map(r => r.id)
}

export async function photoExistsInProject(photoId, projectId) {
  const { rows } = await query(
    'SELECT id FROM photos WHERE id = $1 AND project_id = $2',
    [photoId, projectId]
  )
  return rows[0] || null
}
