/**
 * Folder Service — business logic for folder management.
 */

import * as folderRepo from '../repositories/folder.repository.js'
import * as projectRepo from '../repositories/project.repository.js'
import * as photoRepo from '../repositories/photo.repository.js'

function formatFolder(row) {
  return {
    id:           row.id,
    name:         row.name,
    userId:       row.user_id,
    projectCount: row.project_count ?? 0,
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

export async function getOrCreateDefaultFolder(userId) {
  const folder = await folderRepo.findOrCreateDefault(userId)
  folder.project_count = folder.project_count ?? 0
  return { data: formatFolder(folder) }
}
