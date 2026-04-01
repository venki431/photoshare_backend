/**
 * Photo Controller
 *
 * GET    /projects/:projectId/photos          — list (paginated)
 * POST   /projects/:projectId/photos          — upload (multipart, via multer + Cloudinary)
 * DELETE /photos/:id                          — delete one
 * POST   /photos/bulk-delete                  — delete many
 * GET    /projects/:projectId/photos/selected — export selected with original filenames
 */

import * as photoService from '../services/photo.service.js'
import { uploadImage, deleteImage, deleteImages } from '../config/cloudinary.js'
import * as R from '../utils/response.js'

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function listPhotos(req, res) {
  const { projectId } = req.params
  const { page, perPage } = req.query

  const result = await photoService.listPhotos(projectId, { page, perPage })

  return R.success(res, result.data, 'Photos fetched successfully', { meta: result.meta })
}

export async function uploadPhoto(req, res) {
  const result = await photoService.uploadPhoto(
    req.params.projectId,
    req.user.id,
    req.file,
    req.headers,
    uploadImage
  )

  if (result.error) {
    return result.status === 404
      ? R.notFound(res, result.error)
      : R.badRequest(res, result.error)
  }

  return R.created(res, result.data, 'Photo uploaded successfully')
}

export async function deletePhoto(req, res) {
  const result = await photoService.deletePhoto(req.params.id, req.user.id, deleteImage)

  if (result.error) {
    return result.status === 403
      ? R.forbidden(res, result.error)
      : R.notFound(res, result.error)
  }

  return R.success(res, null, 'Photo deleted successfully')
}

export async function bulkDeletePhotos(req, res) {
  const result = await photoService.bulkDeletePhotos(
    req.body.ids || [],
    req.user.id,
    deleteImages
  )

  if (result.error) {
    return result.status === 404
      ? R.notFound(res, result.error)
      : R.badRequest(res, result.error)
  }

  return R.success(res, result.data, `${result.data.deletedCount} photo(s) deleted`)
}

export async function downloadSelectedNames(req, res) {
  const result = await photoService.getSelectedPhotoNames(req.params.projectId, req.user.id)

  if (result.error) return R.notFound(res, result.error)

  const content = result.data.join('\n')
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Content-Disposition', 'attachment; filename="selected_images.txt"')
  return res.send(content)
}

export async function getSelectedPhotos(req, res) {
  const result = await photoService.getSelectedPhotos(req.params.projectId, req.user.id)

  if (result.error) return R.notFound(res, result.error)

  return R.success(res, result.data, result.data.totalSelected > 0
    ? 'Selected photos fetched successfully'
    : 'No selected photos found for this project'
  )
}
