/**
 * Selection Service — business logic for client photo selection flow.
 */

import { v4 as uuid } from 'uuid'
import * as selectionRepo from '../repositories/selection.repository.js'
import * as projectRepo from '../repositories/project.repository.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureSelection(shareId) {
  const sel = await selectionRepo.findByShareId(shareId)
  if (sel) return sel

  const project = await projectRepo.findIdByShareId(shareId)
  if (!project) return null

  const id = uuid()
  return selectionRepo.create({ id, share_id: shareId, project_id: project.id })
}

async function buildSelectionResponse(sel) {
  const rows = await selectionRepo.findSelectedPhotos(sel.id)

  const selectedIds = rows.map(r => r.photo_id)
  const comments = {}
  rows.forEach(r => { if (r.comment) comments[r.photo_id] = r.comment })

  return {
    shareId:     sel.share_id,
    projectId:   sel.project_id,
    selectedIds,
    comments,
    status:      sel.status,
    submittedAt: sel.submitted_at,
  }
}

// ─── Service methods ─────────────────────────────────────────────────────────

export async function getSelection(shareId) {
  const project = await projectRepo.findIdByShareId(shareId)
  if (!project) return { error: 'Gallery link is invalid or has expired', status: 404 }

  const sel = await ensureSelection(shareId)
  if (!sel) return { error: 'Gallery not found', status: 404 }

  return { data: await buildSelectionResponse(sel) }
}

export async function togglePhoto(shareId, photoId) {
  if (!photoId) return { error: 'photoId is required', status: 400 }

  const sel = await ensureSelection(shareId)
  if (!sel) return { error: 'Gallery not found', status: 404 }
  if (sel.status === 'submitted') {
    return { error: 'This gallery has already been submitted and cannot be changed', status: 400 }
  }

  const photo = await selectionRepo.photoExistsInProject(photoId, sel.project_id)
  if (!photo) return { error: 'Photo not found in this gallery', status: 404 }

  const existing = await selectionRepo.findSelectedPhoto(sel.id, photoId)

  let message
  if (!existing) {
    // Adding photo — check limit
    const selectionLimit = await projectRepo.getSelectionLimit(sel.project_id)
    const currentCount = await selectionRepo.countSelectedPhotos(sel.id)

    if (selectionLimit && currentCount >= selectionLimit) {
      return { error: `Selection limit of ${selectionLimit} photos reached`, status: 400 }
    }

    await selectionRepo.addPhoto({ id: uuid(), selection_id: sel.id, photo_id: photoId })
    await projectRepo.incrementSelectedCount(sel.project_id)
    message = 'Photo added to selection'
  } else {
    await selectionRepo.removePhoto(sel.id, photoId)
    await projectRepo.decrementSelectedCount(sel.project_id)
    message = 'Photo removed from selection'
  }

  const updatedIds = await selectionRepo.findSelectedPhotoIds(sel.id)
  return { data: { selectedIds: updatedIds }, message }
}

export async function setComment(shareId, photoId, comment) {
  if (!photoId) return { error: 'photoId is required', status: 400 }

  const sel = await ensureSelection(shareId)
  if (!sel) return { error: 'Gallery not found', status: 404 }
  if (sel.status === 'submitted') {
    return { error: 'This gallery has already been submitted', status: 400 }
  }

  const entry = await selectionRepo.findSelectedPhoto(sel.id, photoId)
  if (!entry) return { error: 'Cannot comment on a photo that is not selected', status: 400 }

  await selectionRepo.updateComment(sel.id, photoId, comment?.trim() || '')

  const rows = await selectionRepo.findSelectedPhotos(sel.id)
  const comments = {}
  rows.forEach(r => { if (r.comment) comments[r.photo_id] = r.comment })

  return { data: { comments } }
}

export async function submitSelection(shareId) {
  const sel = await ensureSelection(shareId)
  if (!sel) return { error: 'Gallery not found', status: 404 }
  if (sel.status === 'submitted') {
    return { error: 'This gallery has already been submitted', status: 400 }
  }

  const count = await selectionRepo.countSelectedPhotos(sel.id)
  if (count === 0) {
    return { error: 'Please select at least one photo before submitting', status: 400 }
  }

  const submittedAt = new Date().toISOString()

  await selectionRepo.updateStatus(sel.id, 'submitted', submittedAt)
  await projectRepo.update(sel.project_id, { status: 'completed' })

  return {
    data: { shareId, selectedCount: count, submittedAt },
  }
}
