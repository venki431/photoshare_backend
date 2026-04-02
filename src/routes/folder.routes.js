import { Router } from 'express'
import { listFolders, getFolder, createFolder, updateFolder, deleteFolder, shareFolder, unshareFolder, getFolderByShareId } from '../controllers/folder.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

router.get('/',       requireAuth, asyncHandler(listFolders))
router.post('/',      requireAuth, asyncHandler(createFolder))

// Folder sharing — must come before /:id routes
router.get('/share/:shareId', asyncHandler(getFolderByShareId))   // public
router.post('/:id/share',    requireAuth, asyncHandler(shareFolder))
router.delete('/:id/share',  requireAuth, asyncHandler(unshareFolder))

router.get('/:id',    requireAuth, asyncHandler(getFolder))
router.put('/:id',    requireAuth, asyncHandler(updateFolder))
router.delete('/:id', requireAuth, asyncHandler(deleteFolder))

export default router
