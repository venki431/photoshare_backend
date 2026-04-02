/**
 * PhotoShare API Server
 *
 * Start:
 *   cd backend && cp .env.example .env && npm install && npm run dev
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { errorHandler, asyncHandler } from './src/middleware/errorHandler.js'
import { closePool } from './src/config/db.js'
import * as projectService from './src/services/project.service.js'
import * as R from './src/utils/response.js'

import authRoutes from './src/routes/auth.routes.js'
import projectRoutes from './src/routes/project.routes.js'
import photoRoutes from './src/routes/photo.routes.js'
import selectionRoutes from './src/routes/selection.routes.js'
import uploadRoutes from './src/routes/upload.routes.js'
import folderRoutes from './src/routes/folder.routes.js'

// ─── App ─────────────────────────────────────────────────────────────────────
const app  = express()
const PORT = process.env.PORT || 3000

// ─── Global middleware ───────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/v1/auth',        authRoutes)
app.use('/v1/folders',     folderRoutes)
app.use('/v1/projects',    projectRoutes)
app.use('/v1',             photoRoutes)
app.use('/v1/selections',  selectionRoutes)
app.use('/api/upload',     uploadRoutes)

// ─── Gallery share link (public) ─────────────────────────────────────────────
app.get('/gallery/:share_id', asyncHandler(async (req, res) => {
  const result = await projectService.getGallery(req.params.share_id)
  if (result.error) return R.notFound(res, result.error)
  return R.success(res, result.data, 'Gallery loaded successfully')
}))

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Route not found' })
})

// ─── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Start ───────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n  PhotoShare API running`)
  console.log(`  → http://localhost:${PORT}`)
  console.log(`  → Health: http://localhost:${PORT}/health\n`)
})

// ─── Graceful shutdown ───────────────────────────────────────────────────────
async function shutdown() {
  console.log('\n[SERVER] Shutting down gracefully...')
  server.close(async () => {
    await closePool()
    console.log('[SERVER] Database pool closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
