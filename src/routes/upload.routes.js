/**
 * Upload routes — standalone Cloudinary upload endpoint.
 *
 * POST /api/upload — upload an image to Cloudinary, return metadata
 */

import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { uploadImage } from '../config/cloudinary.js'
import * as R from '../utils/response.js'

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

router.post('/', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) return R.badRequest(res, 'No file uploaded')

  const result = await uploadImage(req.file.buffer, {
    folder: req.body.folder || 'photoshare',
  })

  return R.created(res, {
    publicId: result.public_id,
    url:      result.url,
    thumbUrl: result.thumb_url,
    width:    result.width,
    height:   result.height,
    size:     result.size,
  }, 'Image uploaded successfully')
}))

export default router
