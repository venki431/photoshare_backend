/**
 * Project Service — business logic for project management.
 */

import { v4 as uuid } from 'uuid'
import * as projectRepo from '../repositories/project.repository.js'
import * as photoRepo from '../repositories/photo.repository.js'
import * as folderRepo from '../repositories/folder.repository.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateShareId() {
  return 'share_' + Math.random().toString(36).slice(2, 10)
}

function formatProject(row) {
  return {
    id:             row.id,
    name:           row.name,
    folderId:       row.folder_id,
    eventType:      row.event_type,
    status:         row.status,
    imageCount:     row.image_count,
    selectedCount:  row.selected_count,
    shareId:        row.share_id,
    password:       row.password,
    coverImage:     row.cover_image,
    clientName:     row.client_name,
    clientEmail:    row.client_email,
    clientMobile:   row.client_mobile,
    notes:          row.notes,
    allowComments:  Boolean(row.allow_comments),
    selectionLimit: row.selection_limit,
    createdAt:      row.created_at,
  }
}

// ─── Service methods ─────────────────────────────────────────────────────────

export async function listProjects(userId, { page = 1, perPage = 10, status, search }) {
  const pageNum    = Math.max(1, parseInt(page, 10))
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10)))
  const offset     = (pageNum - 1) * perPageNum

  const filters = { status, search }

  const [total, rows] = await Promise.all([
    projectRepo.count(userId, filters),
    projectRepo.findAll(userId, { ...filters, limit: perPageNum, offset }),
  ])

  return {
    data: rows.map(formatProject),
    meta: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum) || 1,
    },
  }
}

export async function getProject(id, userId) {
  const row = await projectRepo.findById(id, userId)
  if (!row) return { error: 'Project not found', status: 404 }
  return { data: formatProject(row) }
}

export async function getProjectByShareId(shareId) {
  const row = await projectRepo.findByShareId(shareId)
  if (!row) return { error: 'Gallery link is invalid or has expired', status: 404 }

  const project = formatProject(row)
  project.hasPassword = Boolean(row.password)
  delete project.password
  return { data: project }
}

export async function listProjectsByFolder(folderId, userId, { page = 1, perPage = 10, status, search }) {
  // Verify folder belongs to user
  const folder = await folderRepo.findById(folderId, userId)
  if (!folder) return { error: 'Folder not found', status: 404 }

  const pageNum    = Math.max(1, parseInt(page, 10))
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10)))
  const offset     = (pageNum - 1) * perPageNum

  const filters = { status, search }

  const [total, rows] = await Promise.all([
    projectRepo.countByFolderId(folderId, filters),
    projectRepo.findAllByFolderId(folderId, { ...filters, limit: perPageNum, offset }),
  ])

  return {
    data: rows.map(formatProject),
    meta: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum) || 1,
    },
  }
}

export async function createProject(userId, body) {
  const { name, eventType, folderId, password, coverImage, clientName, clientEmail, clientMobile, notes, allowComments, selectionLimit } = body

  if (!name?.trim()) return { error: 'Project name is required', status: 400 }
  if (!eventType) return { error: 'Event type is required', status: 400 }

  // Resolve folder: use provided folderId or default folder
  let resolvedFolderId = folderId
  if (!resolvedFolderId) {
    const defaultFolder = await folderRepo.findOrCreateDefault(userId)
    resolvedFolderId = defaultFolder.id
  } else {
    const folder = await folderRepo.findById(resolvedFolderId, userId)
    if (!folder) return { error: 'Folder not found', status: 400 }
  }

  const id = uuid()
  const shareId = generateShareId()

  const project = await projectRepo.create({
    id,
    user_id:         userId,
    folder_id:       resolvedFolderId,
    name:            name.trim(),
    event_type:      eventType,
    share_id:        shareId,
    password:        password || '',
    client_name:     clientName || '',
    client_email:    clientEmail || '',
    client_mobile:   clientMobile || '',
    cover_image:     coverImage || '',
    notes:           notes || '',
    allow_comments:  allowComments !== false,
    selection_limit: selectionLimit || null,
  })

  return { data: formatProject(project) }
}

export async function updateProject(id, userId, body) {
  const existing = await projectRepo.findById(id, userId)
  if (!existing) return { error: 'Project not found', status: 404 }

  const fieldMap = {
    name:           'name',
    folderId:       'folder_id',
    eventType:      'event_type',
    status:         'status',
    password:       'password',
    clientName:     'client_name',
    clientEmail:    'client_email',
    clientMobile:   'client_mobile',
    notes:          'notes',
    coverImage:     'cover_image',
    allowComments:  'allow_comments',
    selectionLimit: 'selection_limit',
  }

  const updates = {}
  for (const [camel, col] of Object.entries(fieldMap)) {
    if (body[camel] !== undefined) {
      updates[col] = col === 'allow_comments' ? Boolean(body[camel]) : body[camel]
    }
  }

  if (Object.keys(updates).length === 0) return { error: 'No valid fields to update', status: 400 }

  const updated = await projectRepo.update(id, updates)
  return { data: formatProject(updated) }
}

export async function deleteProject(id, userId, deleteImagesFn) {
  const existing = await projectRepo.findById(id, userId)
  if (!existing) return { error: 'Project not found', status: 404 }

  // Delete photos from Cloudinary
  const cloudinaryIds = await photoRepo.findCloudinaryIdsByProjectId(id)
  if (cloudinaryIds.length > 0 && deleteImagesFn) {
    await deleteImagesFn(cloudinaryIds)
  }

  // Delete photos from DB, then the project
  await photoRepo.deleteByProjectId(id)
  await projectRepo.deleteById(id)
  return { data: null }
}

/**
 * Gallery endpoint — fetch project with photos by share_id.
 */
export async function getGallery(shareId) {
  const project = await projectRepo.findByShareIdWithPhotos(shareId)
  if (!project) return { error: 'Gallery not found', status: 404 }

  delete project.password
  return { data: project }
}
