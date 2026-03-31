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

import { v4 as uuid } from 'uuid'
import { supabase } from '../config/supabase.js'
import * as R from '../utils/response.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateShareId() {
  return 'share_' + Math.random().toString(36).slice(2, 10)
}

function formatProject(row) {
  return {
    id: row.id,
    name: row.name,
    eventType: row.event_type,
    status: row.status,
    imageCount: row.image_count,
    selectedCount: row.selected_count,
    shareId: row.share_id,
    password: row.password,
    coverImage: row.cover_image,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientMobile: row.client_mobile,
    notes: row.notes,
    allowComments: Boolean(row.allow_comments),
    selectionLimit: row.selection_limit,
    createdAt: row.created_at,
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listProjects(req, res) {
  const { page = 1, perPage = 10, status, search } = req.query

  const pageNum = Math.max(1, parseInt(page, 10))
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage, 10)))
  const offset = (pageNum - 1) * perPageNum

  let countQuery = supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)

  let dataQuery = supabase
    .from('projects')
    .select('*')
    .eq('user_id', req.user.id)

  if (status && status !== 'all') {
    countQuery = countQuery.eq('status', status)
    dataQuery = dataQuery.eq('status', status)
  }

  if (search) {
    const filter = `name.ilike.%${search}%,event_type.ilike.%${search}%`
    countQuery = countQuery.or(filter)
    dataQuery = dataQuery.or(filter)
  }

  const { count: total, error: countErr } = await countQuery
  if (countErr) throw countErr

  const { data: rows, error: dataErr } = await dataQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + perPageNum - 1)

  if (dataErr) throw dataErr

  return R.success(
    res,
    rows.map(formatProject),
    'Projects fetched successfully',
    {
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum) || 1,
      },
    }
  )
}

export async function getProject(req, res) {
  const { data: row, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (error || !row) return R.notFound(res, 'Project not found')
  return R.success(res, formatProject(row), 'Project fetched successfully')
}

export async function getProjectByShareId(req, res) {
  const { data: row, error } = await supabase
    .from('projects')
    .select('*')
    .eq('share_id', req.params.shareId)
    .single()

  if (error || !row) return R.notFound(res, 'Gallery link is invalid or has expired')

  const project = formatProject(row)
  project.hasPassword = Boolean(row.password)
  delete project.password

  return R.success(res, project, 'Gallery loaded successfully')
}

export async function createProject(req, res) {
  const { name, eventType, password, coverImage, clientName, clientEmail, clientMobile, notes, allowComments, selectionLimit } = req.body

  if (!name?.trim()) return R.badRequest(res, 'Project name is required')
  if (!eventType) return R.badRequest(res, 'Event type is required')

  const id = uuid()
  const shareId = generateShareId()

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      id,
      user_id: req.user.id,
      name: name.trim(),
      event_type: eventType,
      share_id: shareId,
      password: password || '',
      client_name: clientName || '',
      client_email: clientEmail || '',
      client_mobile: clientMobile || '',
      cover_image: coverImage || '',
      notes: notes || '',
      allow_comments: allowComments !== false,
      selection_limit: selectionLimit || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return R.created(res, formatProject(project), 'Project created successfully')
}

export async function updateProject(req, res) {
  const { data: row, error: fetchErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (fetchErr || !row) return R.notFound(res, 'Project not found')

  const fieldMap = {
    name: 'name',
    eventType: 'event_type',
    status: 'status',
    password: 'password',
    clientName: 'client_name',
    clientEmail: 'client_email',
    clientMobile: 'client_mobile',
    notes: 'notes',
    coverImage: 'coverimage',
    allowComments: 'allow_comments',
    selectionLimit: 'selection_limit',
  }

  const updates = {}

  for (const [camel, col] of Object.entries(fieldMap)) {
    if (req.body[camel] !== undefined) {
      updates[col] = col === 'allow_comments' ? Boolean(req.body[camel]) : req.body[camel]
    }
  }

  if (Object.keys(updates).length === 0) return R.badRequest(res, 'No valid fields to update')

  const { data: updated, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', req.params.id)
    .select('*')
    .single()

  if (error) throw error
  return R.success(res, formatProject(updated), 'Project updated successfully')
}

export async function deleteProject(req, res) {
  const { data: row, error: fetchErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (fetchErr || !row) return R.notFound(res, 'Project not found')

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', req.params.id)

  if (error) throw error
  return R.success(res, null, 'Project deleted successfully')
}
