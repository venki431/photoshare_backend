/**
 * Folder Controller
 *
 * GET    /folders              — list all folders for user
 * POST   /folders              — create folder
 * GET    /folders/:id          — get one
 * PUT    /folders/:id          — update (rename)
 * DELETE /folders/:id          — delete folder + its projects
 */

import * as folderService from '../services/folder.service.js'
import { deleteImages } from '../config/cloudinary.js'
import * as R from '../utils/response.js'

export async function listFolders(req, res) {
  const result = await folderService.listFolders(req.user.id)
  return R.success(res, result.data, 'Folders fetched successfully')
}

export async function getFolder(req, res) {
  const result = await folderService.getFolder(req.params.id, req.user.id)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Folder fetched successfully')
}

export async function createFolder(req, res) {
  const result = await folderService.createFolder(req.user.id, req.body)
  if (result.error) return R.badRequest(res, result.error)
  return R.created(res, result.data, 'Folder created successfully')
}

export async function updateFolder(req, res) {
  const result = await folderService.updateFolder(req.params.id, req.user.id, req.body)
  if (result.error) {
    return result.status === 404
      ? R.notFound(res, result.error)
      : R.badRequest(res, result.error)
  }
  return R.success(res, result.data, 'Folder updated successfully')
}

export async function deleteFolder(req, res) {
  const result = await folderService.deleteFolder(req.params.id, req.user.id, deleteImages)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, null, 'Folder deleted successfully')
}

export async function shareFolder(req, res) {
  const result = await folderService.shareFolder(req.params.id, req.user.id)
  if (result.error) {
    return result.status === 404
      ? R.notFound(res, result.error)
      : R.badRequest(res, result.error)
  }
  return R.success(res, result.data, 'Folder shared successfully')
}

export async function unshareFolder(req, res) {
  const result = await folderService.unshareFolder(req.params.id, req.user.id)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Folder unshared successfully')
}

export async function getFolderByShareId(req, res) {
  const result = await folderService.getFolderByShareId(req.params.shareId)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Shared folder fetched successfully')
}
