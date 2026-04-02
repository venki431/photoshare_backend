import { Router } from 'express'
import { listProjects, listProjectsByFolder, getProject, getProjectByShareId, createProject, updateProject, deleteProject } from '../controllers/project.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

// Public — must be declared before /:id so it's not captured as an id
router.get('/share/:shareId', asyncHandler(getProjectByShareId))

// Protected
router.get('/',    requireAuth, asyncHandler(listProjects))
router.get('/folder/:folderId', requireAuth, asyncHandler(listProjectsByFolder))
router.post('/',   requireAuth, asyncHandler(createProject))
router.get('/:id', requireAuth, asyncHandler(getProject))
router.put('/:id', requireAuth, asyncHandler(updateProject))
router.delete('/:id', requireAuth, asyncHandler(deleteProject))

export default router
