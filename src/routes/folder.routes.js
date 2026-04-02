import { Router } from 'express'
import { listFolders, getFolder, createFolder, updateFolder, deleteFolder } from '../controllers/folder.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

router.get('/',       requireAuth, asyncHandler(listFolders))
router.post('/',      requireAuth, asyncHandler(createFolder))
router.get('/:id',    requireAuth, asyncHandler(getFolder))
router.put('/:id',    requireAuth, asyncHandler(updateFolder))
router.delete('/:id', requireAuth, asyncHandler(deleteFolder))

export default router
