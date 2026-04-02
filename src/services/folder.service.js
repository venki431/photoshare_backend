/**
 * Folder Service — business logic for folder management.
 */

import * as folderRepo from '../repositories/folder.repository.js'
import * as projectRepo from '../repositories/project.repository.js'
import * as photoRepo from '../repositories/photo.repository.js'

import crypto from 'crypto'

function formatFolder(row) {
  return {
    id:           row.id,
    name:         row.name,
    userId:       row.user_id,
    projectCount: row.project_count ?? 0,
    shareId:      row.share_id ?? null,
    sharedAt:     row.shared_at ?? null,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }
}

export async function listFolders(userId) {
  const rows = await folderRepo.findAllByUserId(userId)
  return { data: rows.map(formatFolder) }
}

export async function getFolder(id, userId) {
  const row = await folderRepo.findById(id, userId)
  if (!row) return { error: 'Folder not found', status: 404 }
  return { data: formatFolder(row) }
}

export async function createFolder(userId, body) {
  const { name } = body

  if (!name?.trim()) return { error: 'Folder name is required', status: 400 }

  const folder = await folderRepo.create({
    name:    name.trim(),
    user_id: userId,
  })

  folder.project_count = 0
  return { data: formatFolder(folder) }
}

export async function updateFolder(id, userId, body) {
  const existing = await folderRepo.findById(id, userId)
  if (!existing) return { error: 'Folder not found', status: 404 }

  const updates = {}
  if (body.name !== undefined) {
    if (!body.name?.trim()) return { error: 'Folder name cannot be empty', status: 400 }
    updates.name = body.name.trim()
  }

  if (Object.keys(updates).length === 0) return { error: 'No valid fields to update', status: 400 }

  const updated = await folderRepo.update(id, updates)
  return { data: formatFolder(updated) }
}

export async function deleteFolder(id, userId, deleteImagesFn) {
  const existing = await folderRepo.findById(id, userId)
  if (!existing) return { error: 'Folder not found', status: 404 }

  // Get all projects in folder to clean up their photos
  const projects = await projectRepo.findAllByFolderId(id)

  for (const project of projects) {
    const cloudinaryIds = await photoRepo.findCloudinaryIdsByProjectId(project.id)
    if (cloudinaryIds.length > 0 && deleteImagesFn) {
      await deleteImagesFn(cloudinaryIds)
    }
    await photoRepo.deleteByProjectId(project.id)
  }

  // Cascade delete will remove projects too
  await folderRepo.deleteById(id)
  return { data: null }
}

export async function shareFolder(id, userId) {
  const existing = await folderRepo.findById(id, userId)
  if (!existing) return { error: 'Folder not found', status: 404 }

  if (existing.share_id) {
    return { data: formatFolder(existing) }
  }

  const shareId = 'folder_' + crypto.randomBytes(8).toString('hex')
  const updated = await folderRepo.update(id, {
    share_id: shareId,
    shared_at: new Date().toISOString(),
  })
  updated.project_count = existing.project_count ?? 0
  return { data: formatFolder(updated) }
}

export async function unshareFolder(id, userId) {
  const existing = await folderRepo.findById(id, userId)
  if (!existing) return { error: 'Folder not found', status: 404 }

  const updated = await folderRepo.update(id, {
    share_id: null,
    shared_at: null,
  })
  updated.project_count = existing.project_count ?? 0
  return { data: formatFolder(updated) }
}

export async function getFolderByShareId(shareId) {
  const row = await folderRepo.findByShareId(shareId)
  if (!row) return { error: 'Shared folder not found', status: 404 }

  const projects = await projectRepo.findAllByFolderId(row.id)
  const formattedProjects = projects.map(p => ({
    id:            p.id,
    name:          p.name,
    eventType:     p.event_type,
    status:        p.status,
    imageCount:    p.image_count,
    selectedCount: p.selected_count,
    shareId:       p.share_id,
    coverUrl:      p.cover_url,
    createdAt:     p.created_at,
  }))

  return {
    data: {
      ...formatFolder(row),
      projects: formattedProjects,
    },
  }
}

export async function getOrCreateDefaultFolder(userId) {
  const folder = await folderRepo.findOrCreateDefault(userId)
  folder.project_count = folder.project_count ?? 0
  return { data: formatFolder(folder) }
}
