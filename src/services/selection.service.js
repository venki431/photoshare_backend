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
  const selectedIds = await selectionRepo.findSelectedPhotoIds(sel.project_id)

  return {
    shareId:     sel.share_id,
    projectId:   sel.project_id,
    selectedIds,
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

  const isSelected = await selectionRepo.isPhotoSelected(photoId)

  let message
  if (!isSelected) {
    // Adding photo — check limit
    const selectionLimit = await projectRepo.getSelectionLimit(sel.project_id)
    const currentCount = await selectionRepo.countSelectedPhotos(sel.project_id)

    if (selectionLimit && currentCount >= selectionLimit) {
      return { error: `Selection limit of ${selectionLimit} photos reached`, status: 400 }
    }

    await selectionRepo.selectPhoto(photoId)
    await projectRepo.incrementSelectedCount(sel.project_id)
    message = 'Photo added to selection'
  } else {
    await selectionRepo.deselectPhoto(photoId)
    await projectRepo.decrementSelectedCount(sel.project_id)
    message = 'Photo removed from selection'
  }

  const updatedIds = await selectionRepo.findSelectedPhotoIds(sel.project_id)
  return { data: { selectedIds: updatedIds }, message }
}

export async function submitSelection(shareId) {
  const sel = await ensureSelection(shareId)
  if (!sel) return { error: 'Gallery not found', status: 404 }
  if (sel.status === 'submitted') {
    return { error: 'This gallery has already been submitted', status: 400 }
  }

  const count = await selectionRepo.countSelectedPhotos(sel.project_id)
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
