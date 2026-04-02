/**
 * Project Controller
 *
 * GET    /projects              — list (paginated, filterable)
 * POST   /projects              — create
 * GET    /projects/:id          — get one
 * PUT    /projects/:id          — update
 * DELETE /projects/:id          — delete
 * GET    /projects/share/:shareId — public, no auth
 */

import * as projectService from '../services/project.service.js'
import { deleteImages } from '../config/cloudinary.js'
import * as R from '../utils/response.js'

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function listProjects(req, res) {
  const { page, perPage, status, search } = req.query
  const result = await projectService.listProjects(req.user.id, { page, perPage, status, search })

  return R.success(res, result.data, 'Projects fetched successfully', { meta: result.meta })
}

export async function listProjectsByFolder(req, res) {
  const { page, perPage, status, search } = req.query
  const result = await projectService.listProjectsByFolder(req.params.folderId, req.user.id, { page, perPage, status, search })
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Projects fetched successfully', { meta: result.meta })
}

export async function getProject(req, res) {
  const result = await projectService.getProject(req.params.id, req.user.id)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Project fetched successfully')
}

export async function getProjectByShareId(req, res) {
  const result = await projectService.getProjectByShareId(req.params.shareId)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Gallery loaded successfully')
}

export async function createProject(req, res) {
  const result = await projectService.createProject(req.user.id, req.body)
  if (result.error) return R.badRequest(res, result.error)
  return R.created(res, result.data, 'Project created successfully')
}

export async function updateProject(req, res) {
  const result = await projectService.updateProject(req.params.id, req.user.id, req.body)
  if (result.error) {
    return result.status === 404
      ? R.notFound(res, result.error)
      : R.badRequest(res, result.error)
  }
  return R.success(res, result.data, 'Project updated successfully')
}

export async function deleteProject(req, res) {
  const result = await projectService.deleteProject(req.params.id, req.user.id, deleteImages)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, null, 'Project deleted successfully')
}
