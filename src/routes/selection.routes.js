/**
 * Selection routes — all public (no JWT required).
 * The shareId is the access credential for the client gallery.
 */

import { Router } from 'express'
import { getSelection, togglePhoto, submitSelection } from '../controllers/selection.controller.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

router.get( '/:shareId',          asyncHandler(getSelection))
router.post('/:shareId/toggle',   asyncHandler(togglePhoto))
router.post('/:shareId/submit',   asyncHandler(submitSelection))

export default router
