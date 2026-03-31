/**
 * Photo Controller
 *
 * GET    /projects/:projectId/photos          — list (paginated)
 * POST   /projects/:projectId/photos          — upload (multipart, via multer + Cloudinary)
 * DELETE /photos/:id                          — delete one
 * POST   /photos/bulk-delete                  — delete many
 * GET    /projects/:projectId/photos/selected — export selected with original filenames
 */

import { v4 as uuid } from 'uuid'
import { supabase } from '../config/supabase.js'
import { uploadImage, deleteImage, deleteImages } from '../config/cloudinary.js'
import * as R from '../utils/response.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhoto(row) {
  return {
    id:                row.id,
    projectId:         row.project_id,
    filename:          row.original_file_name || row.filename,
    originalFileName:  row.original_file_name || row.filename,
    compressedFileName: row.compressed_file_name || row.filename,
    url:               row.storage_url || row.url,
    thumbUrl:          row.thumbnail_url || row.thumb_url,
    cloudinaryId:      row.cloudinary_id,
    width:             row.width,
    height:            row.height,
    size:              row.file_size_original || row.size,
    sizeOriginal:      row.file_size_original || row.size,
    sizeCompressed:    row.file_size_compressed || row.size,
    mimeType:          row.mime_type,
    uploadStatus:      row.upload_status || 'uploaded',
    takenAt:           row.taken_at,
    createdAt:         row.created_at,
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listPhotos(req, res) {
  const { projectId } = req.params
  const { page = 1, perPage = 500 } = req.query

  const pageNum    = Math.max(1, parseInt(page, 10))
  const perPageNum = Math.min(200, Math.max(1, parseInt(perPage, 10)))
  const offset     = (pageNum - 1) * perPageNum

  const { count: total, error: countErr } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (countErr) throw countErr

  const { data: rows, error: dataErr } = await supabase
    .from('photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .range(offset, offset + perPageNum - 1)

  if (dataErr) throw dataErr

  return R.success(
    res,
    rows.map(formatPhoto),
    'Photos fetched successfully',
    {
      meta: {
        total,
        page:       pageNum,
        perPage:    perPageNum,
        totalPages: Math.ceil(total / perPageNum) || 1,
      },
    }
  )
}

export async function uploadPhoto(req, res) {
  const { projectId } = req.params

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', req.user.id)
    .single()

  if (projErr || !project) return R.notFound(res, 'Project not found')
  if (!req.file) return R.badRequest(res, 'No file uploaded')

  // Extract metadata from headers (sent by the frontend upload manager)
  const originalName = req.headers['x-original-filename'] || req.file.originalname
  const originalSize = parseInt(req.headers['x-original-size'] || '0', 10) || req.file.size

  // Upload to Cloudinary
  const result = await uploadImage(req.file.buffer, {
    folder: `photoshare/${projectId}`,
  })

  const photoId = uuid()

  const { data: photo, error: insertErr } = await supabase
    .from('photos')
    .insert({
      id:                  photoId,
      project_id:          projectId,
      filename:            originalName,
      original_file_name:  originalName,
      compressed_file_name: req.file.originalname,
      cloudinary_id:       result.public_id,
      url:                 result.url,
      thumb_url:           result.thumb_url,
      storage_url:         result.url,
      thumbnail_url:       result.thumb_url,
      width:               result.width,
      height:              result.height,
      size:                result.size,
      file_size_original:  originalSize,
      file_size_compressed: req.file.size,
      mime_type:           req.file.mimetype,
      upload_status:       'uploaded',
    })
    .select('*')
    .single()

  if (insertErr) throw insertErr

  // Update project image count
  await supabase.rpc('increment_image_count', { project_id_input: projectId })

  return R.created(res, formatPhoto(photo), 'Photo uploaded successfully')
}

export async function deletePhoto(req, res) {
  const { data: photo, error: fetchErr } = await supabase
    .from('photos')
    .select('*, projects!inner(user_id)')
    .eq('id', req.params.id)
    .single()

  if (fetchErr || !photo) return R.notFound(res, 'Photo not found')
  if (photo.projects.user_id !== req.user.id) return R.forbidden(res, 'Access denied')

  if (photo.cloudinary_id) {
    await deleteImage(photo.cloudinary_id)
  }

  const { error } = await supabase
    .from('photos')
    .delete()
    .eq('id', photo.id)

  if (error) throw error

  await supabase.rpc('decrement_image_count', { project_id_input: photo.project_id })

  return R.success(res, null, 'Photo deleted successfully')
}

export async function bulkDeletePhotos(req, res) {
  const { ids = [] } = req.body

  if (!Array.isArray(ids) || ids.length === 0) return R.badRequest(res, 'Photo IDs array is required')

  const { data: photos, error: fetchErr } = await supabase
    .from('photos')
    .select('*, projects!inner(user_id)')
    .in('id', ids)
    .eq('projects.user_id', req.user.id)

  if (fetchErr) throw fetchErr
  if (!photos || photos.length === 0) return R.notFound(res, 'No matching photos found')

  const cloudinaryIds = photos
    .map(p => p.cloudinary_id)
    .filter(Boolean)

  if (cloudinaryIds.length > 0) {
    await deleteImages(cloudinaryIds)
  }

  const photoIds = photos.map(p => p.id)
  const { error: delErr } = await supabase
    .from('photos')
    .delete()
    .in('id', photoIds)

  if (delErr) throw delErr

  const projectCounts = {}
  for (const photo of photos) {
    projectCounts[photo.project_id] = (projectCounts[photo.project_id] || 0) + 1
  }

  for (const [projectId, count] of Object.entries(projectCounts)) {
    await supabase.rpc('decrement_image_count_by', {
      project_id_input: projectId,
      amount: count,
    })
  }

  return R.success(res, { deletedCount: photos.length }, `${photos.length} photo(s) deleted`)
}

/**
 * GET /projects/:projectId/photos/selected
 * Returns selected photos with original file names for photographer export.
 */
export async function getSelectedPhotos(req, res) {
  const { projectId } = req.params

  // Verify project ownership
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, share_id')
    .eq('id', projectId)
    .eq('user_id', req.user.id)
    .single()

  if (projErr || !project) return R.notFound(res, 'Project not found')

  // Get selection for this project
  const { data: sel } = await supabase
    .from('selections')
    .select('id, status, submitted_at')
    .eq('project_id', projectId)
    .single()

  if (!sel) {
    return R.success(res, { photos: [], selection: null }, 'No selection found for this project')
  }

  // Fetch selected photos with original metadata
  const { data: rows, error: fetchErr } = await supabase
    .from('selected_photos')
    .select(`
      photo_id,
      comment,
      photos (
        id,
        original_file_name,
        compressed_file_name,
        storage_url,
        thumbnail_url,
        file_size_original,
        file_size_compressed,
        mime_type,
        width,
        height,
        created_at
      )
    `)
    .eq('selection_id', sel.id)

  if (fetchErr) throw fetchErr

  const photos = (rows || []).map(r => ({
    photoId:            r.photo_id,
    comment:            r.comment || '',
    originalFileName:   r.photos?.original_file_name,
    compressedFileName: r.photos?.compressed_file_name,
    storageUrl:         r.photos?.storage_url,
    thumbnailUrl:       r.photos?.thumbnail_url,
    sizeOriginal:       r.photos?.file_size_original,
    sizeCompressed:     r.photos?.file_size_compressed,
    mimeType:           r.photos?.mime_type,
    width:              r.photos?.width,
    height:             r.photos?.height,
    uploadedAt:         r.photos?.created_at,
  }))

  return R.success(res, {
    photos,
    selection: {
      status:      sel.status,
      submittedAt: sel.submitted_at,
      totalSelected: photos.length,
    },
  }, 'Selected photos fetched successfully')
}
