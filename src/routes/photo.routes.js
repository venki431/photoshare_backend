import { Router } from 'express'
import multer from 'multer'
import { listPhotos, uploadPhoto, deletePhoto, bulkDeletePhotos, getSelectedPhotos, downloadSelectedNames } from '../controllers/photo.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    cb(null, allowed.includes(file.mimetype))
  },
})

router.get( '/projects/:projectId/photos',          requireAuth, asyncHandler(listPhotos))
router.get( '/projects/:projectId/photos/selected',  requireAuth, asyncHandler(getSelectedPhotos))
router.get( '/projects/:projectId/photos/selected/download', requireAuth, asyncHandler(downloadSelectedNames))
router.post('/projects/:projectId/photos',           requireAuth, upload.single('photo'), asyncHandler(uploadPhoto))

router.delete('/photos/:id',        requireAuth, asyncHandler(deletePhoto))
router.post('/photos/bulk-delete',  requireAuth, asyncHandler(bulkDeletePhotos))

export default router
