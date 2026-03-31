/**
 * Selection Controller — client photo selection flow (no auth required)
 *
 * GET  /selections/:shareId         — load current selection state
 * POST /selections/:shareId/toggle  — toggle one photo in/out
 * POST /selections/:shareId/comment — set/clear a comment on a photo
 * POST /selections/:shareId/submit  — finalise the selection
 */

import * as selectionService from '../services/selection.service.js'
import * as R from '../utils/response.js'

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function getSelection(req, res) {
  const result = await selectionService.getSelection(req.params.shareId)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Selection fetched')
}

export async function togglePhoto(req, res) {
  const result = await selectionService.togglePhoto(req.params.shareId, req.body.photoId)

  if (result.error) {
    if (result.status === 404) return R.notFound(res, result.error)
    return R.badRequest(res, result.error)
  }

  return R.success(res, result.data, result.message)
}

export async function setComment(req, res) {
  const { photoId, comment } = req.body
  const result = await selectionService.setComment(req.params.shareId, photoId, comment)

  if (result.error) {
    if (result.status === 404) return R.notFound(res, result.error)
    return R.badRequest(res, result.error)
  }

  return R.success(res, result.data, 'Comment saved')
}

export async function submitSelection(req, res) {
  const result = await selectionService.submitSelection(req.params.shareId)

  if (result.error) {
    if (result.status === 404) return R.notFound(res, result.error)
    return R.badRequest(res, result.error)
  }

  return R.success(res, result.data, 'Your selection has been submitted successfully!')
}
