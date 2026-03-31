import { Router } from 'express'
import { sendOtp, verifyOtpHandler, signup, checkEmail, getMe, updateMe } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

router.post('/check-email', asyncHandler(checkEmail))
router.post('/send-otp',    asyncHandler(sendOtp))
router.post('/verify-otp',  asyncHandler(verifyOtpHandler))
router.post('/signup',      asyncHandler(signup))
router.get('/me',           requireAuth, asyncHandler(getMe))
router.put('/me',           requireAuth, asyncHandler(updateMe))

export default router
