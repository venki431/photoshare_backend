import { Router } from 'express'
import { sendOtp, verifyOtpHandler, getMe } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

router.post('/send-otp',    asyncHandler(sendOtp))
router.post('/verify-otp',  asyncHandler(verifyOtpHandler))
router.get('/me',           requireAuth, asyncHandler(getMe))

export default router
