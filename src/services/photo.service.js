/**
 * Photo Service — business logic for photo management.
 */

import { v4 as uuid } from 'uuid'
import * as photoRepo from '../repositories/photo.repository.js'
import * as projectRepo from '../repositories/project.repository.js'
// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhoto(row) {
  return {
    id:                 row.id,
    projectId:          row.project_id,
    filename:           row.original_file_name || row.filename,
    originalFileName:   row.original_file_name || row.filename,
    compressedFileName: row.compressed_file_name || row.filename,
    url:                row.storage_url || row.url,
    thumbUrl:           row.thumbnail_url || row.thumb_url,
    cloudinaryId:       row.cloudinary_id,
    width:              row.width,
    height:             row.height,
    size:               row.file_size_original || row.size,
    sizeOriginal:       row.file_size_original || row.size,
    sizeCompressed:     row.file_size_compressed || row.size,
    mimeType:           row.mime_type,
    uploadStatus:       row.upload_status || 'uploaded',
    takenAt:            row.taken_at,
    createdAt:          row.created_at,
    selectedByClient:   row.selected_by_client
  }
}

// ─── Service methods ─────────────────────────────────────────────────────────

export async function listPhotos(projectId, { page = 1, perPage = 500 }) {
  const pageNum    = Math.max(1, parseInt(page, 10))
  const perPageNum = Math.min(200, Math.max(1, parseInt(perPage, 10)))
  const offset     = (pageNum - 1) * perPageNum

  const [total, rows] = await Promise.all([
    photoRepo.count(projectId),
    photoRepo.findAll(projectId, { limit: perPageNum, offset }),
  ])

  return {
    data: rows.map(formatPhoto),
    meta: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum) || 1,
    },
  }
}

export async function uploadPhoto(projectId, userId, file, headers, uploadImageFn) {
  const project = await projectRepo.findById(projectId, userId)
  if (!project) return { error: 'Project not found', status: 404 }
  if (!file) return { error: 'No file uploaded', status: 400 }

  const originalName = headers['x-original-filename'] || file.originalname
  const originalSize = parseInt(headers['x-original-size'] || '0', 10) || file.size

  const result = await uploadImageFn(file.buffer, {
    folder: `photoshare/${projectId}`,
  })

  const photoId = uuid()

  const photo = await photoRepo.create({
    id:                   photoId,
    project_id:           projectId,
    filename:             originalName,
    original_file_name:   originalName,
    compressed_file_name: file.originalname,
    cloudinary_id:        result.public_id,
    url:                  result.url,
    thumb_url:            result.thumb_url,
    storage_url:          result.url,
    thumbnail_url:        result.thumb_url,
    width:                result.width,
    height:               result.height,
    size:                 result.size,
    file_size_original:   originalSize,
    file_size_compressed: file.size,
    mime_type:            file.mimetype,
    upload_status:        'uploaded',
  })

  await projectRepo.incrementImageCount(projectId)

  return { data: formatPhoto(photo) }
}

export async function deletePhoto(photoId, userId, deleteImageFn) {
  const photo = await photoRepo.findByIdWithOwner(photoId)
  if (!photo) return { error: 'Photo not found', status: 404 }
  if (photo.project_user_id !== userId) return { error: 'Access denied', status: 403 }

  if (photo.cloudinary_id) {
    await deleteImageFn(photo.cloudinary_id)
  }

  await photoRepo.deleteById(photo.id)
  await projectRepo.decrementImageCount(photo.project_id)

  return { data: null }
}

export async function bulkDeletePhotos(ids, userId, deleteImagesFn) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: 'Photo IDs array is required', status: 400 }
  }

  const photos = await photoRepo.findByIdsWithOwner(ids, userId)
  if (!photos || photos.length === 0) return { error: 'No matching photos found', status: 404 }

  const cloudinaryIds = photos.map(p => p.cloudinary_id).filter(Boolean)
  if (cloudinaryIds.length > 0) {
    await deleteImagesFn(cloudinaryIds)
  }

  const photoIds = photos.map(p => p.id)
  await photoRepo.deleteByIds(photoIds)

  const projectCounts = {}
  for (const photo of photos) {
    projectCounts[photo.project_id] = (projectCounts[photo.project_id] || 0) + 1
  }

  for (const [projectId, count] of Object.entries(projectCounts)) {
    await projectRepo.decrementImageCountBy(projectId, count)
  }

  return { data: { deletedCount: photos.length } }
}

export async function getSelectedPhotos(projectId, userId) {
  const project = await projectRepo.findById(projectId, userId)
  if (!project) return { error: 'Project not found', status: 404 }

  const rows = await photoRepo.findSelectedByProjectId(projectId)

  const photos = rows.map(r => ({
    photoId:            r.id,
    originalFileName:   r.original_file_name,
    compressedFileName: r.compressed_file_name,
    storageUrl:         r.storage_url,
    thumbnailUrl:       r.thumbnail_url,
    sizeOriginal:       r.file_size_original,
    sizeCompressed:     r.file_size_compressed,
    mimeType:           r.mime_type,
    width:              r.width,
    height:             r.height,
    uploadedAt:         r.created_at,
  }))

  return {
    data: {
      photos,
      totalSelected: photos.length,
    },
  }
}
