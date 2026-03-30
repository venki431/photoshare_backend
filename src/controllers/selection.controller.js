/**
 * Selection Controller — client photo selection flow (no auth required)
 *
 * GET  /selections/:shareId         — load current selection state
 * POST /selections/:shareId/toggle  — toggle one photo in/out
 * POST /selections/:shareId/comment — set/clear a comment on a photo
 * POST /selections/:shareId/submit  — finalise the selection
 */

import { v4 as uuid } from 'uuid'
import { supabase } from '../config/supabase.js'
import * as R from '../utils/response.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureSelection(shareId) {
  const { data: sel } = await supabase
    .from('selections')
    .select('*')
    .eq('share_id', shareId)
    .single()

  if (sel) return sel

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('share_id', shareId)
    .single()

  if (!project) return null

  const id = uuid()
  const { data: newSel, error } = await supabase
    .from('selections')
    .insert({ id, share_id: shareId, project_id: project.id })
    .select('*')
    .single()

  if (error) throw error
  return newSel
}

async function buildSelectionResponse(sel) {
  const { data: rows, error } = await supabase
    .from('selected_photos')
    .select('photo_id, comment')
    .eq('selection_id', sel.id)

  if (error) throw error

  const selectedIds = rows.map(r => r.photo_id)
  const comments    = {}
  rows.forEach(r => { if (r.comment) comments[r.photo_id] = r.comment })

  return {
    shareId:      sel.share_id,
    projectId:    sel.project_id,
    selectedIds,
    comments,
    status:       sel.status,
    submittedAt:  sel.submitted_at,
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function getSelection(req, res) {
  const { shareId } = req.params

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('share_id', shareId)
    .single()

  if (!project) return R.notFound(res, 'Gallery link is invalid or has expired')

  const sel = await ensureSelection(shareId)
  if (!sel) return R.notFound(res, 'Gallery not found')

  return R.success(res, await buildSelectionResponse(sel), 'Selection fetched')
}

export async function togglePhoto(req, res) {
  const { shareId } = req.params
  const { photoId } = req.body

  if (!photoId) return R.badRequest(res, 'photoId is required')

  const sel = await ensureSelection(shareId)
  if (!sel) return R.notFound(res, 'Gallery not found')
  if (sel.status === 'submitted') {
    return R.badRequest(res, 'This gallery has already been submitted and cannot be changed')
  }

  const { data: photo } = await supabase
    .from('photos')
    .select('id')
    .eq('id', photoId)
    .eq('project_id', sel.project_id)
    .single()

  if (!photo) return R.notFound(res, 'Photo not found in this gallery')

  const { data: existing } = await supabase
    .from('selected_photos')
    .select('id')
    .eq('selection_id', sel.id)
    .eq('photo_id', photoId)
    .single()

  if (!existing) {
    const { data: project } = await supabase
      .from('projects')
      .select('selection_limit')
      .eq('id', sel.project_id)
      .single()

    const { count: currentCount } = await supabase
      .from('selected_photos')
      .select('*', { count: 'exact', head: true })
      .eq('selection_id', sel.id)

    if (project.selection_limit && currentCount >= project.selection_limit) {
      return R.badRequest(res, `Selection limit of ${project.selection_limit} photos reached`)
    }

    const { error: insertErr } = await supabase
      .from('selected_photos')
      .insert({ id: uuid(), selection_id: sel.id, photo_id: photoId })

    if (insertErr) throw insertErr

    await supabase.rpc('increment_selected_count', { project_id_input: sel.project_id })
  } else {
    const { error: delErr } = await supabase
      .from('selected_photos')
      .delete()
      .eq('selection_id', sel.id)
      .eq('photo_id', photoId)

    if (delErr) throw delErr

    await supabase.rpc('decrement_selected_count', { project_id_input: sel.project_id })
  }

  const { data: updatedRows } = await supabase
    .from('selected_photos')
    .select('photo_id')
    .eq('selection_id', sel.id)

  const updatedIds = (updatedRows || []).map(r => r.photo_id)

  return R.success(
    res,
    { selectedIds: updatedIds },
    existing ? 'Photo removed from selection' : 'Photo added to selection'
  )
}

export async function setComment(req, res) {
  const { shareId } = req.params
  const { photoId, comment } = req.body

  if (!photoId) return R.badRequest(res, 'photoId is required')

  const sel = await ensureSelection(shareId)
  if (!sel) return R.notFound(res, 'Gallery not found')
  if (sel.status === 'submitted') {
    return R.badRequest(res, 'This gallery has already been submitted')
  }

  const { data: entry } = await supabase
    .from('selected_photos')
    .select('id')
    .eq('selection_id', sel.id)
    .eq('photo_id', photoId)
    .single()

  if (!entry) return R.badRequest(res, 'Cannot comment on a photo that is not selected')

  const { error: updateErr } = await supabase
    .from('selected_photos')
    .update({ comment: comment?.trim() || '' })
    .eq('selection_id', sel.id)
    .eq('photo_id', photoId)

  if (updateErr) throw updateErr

  const { data: rows } = await supabase
    .from('selected_photos')
    .select('photo_id, comment')
    .eq('selection_id', sel.id)

  const comments = {}
  ;(rows || []).forEach(r => { if (r.comment) comments[r.photo_id] = r.comment })

  return R.success(res, { comments }, 'Comment saved')
}

export async function submitSelection(req, res) {
  const { shareId } = req.params

  const sel = await ensureSelection(shareId)
  if (!sel) return R.notFound(res, 'Gallery not found')
  if (sel.status === 'submitted') {
    return R.badRequest(res, 'This gallery has already been submitted')
  }

  const { count } = await supabase
    .from('selected_photos')
    .select('*', { count: 'exact', head: true })
    .eq('selection_id', sel.id)

  if (count === 0) {
    return R.badRequest(res, 'Please select at least one photo before submitting')
  }

  const submittedAt = new Date().toISOString()

  const { error: selErr } = await supabase
    .from('selections')
    .update({ status: 'submitted', submitted_at: submittedAt })
    .eq('id', sel.id)

  if (selErr) throw selErr

  const { error: projErr } = await supabase
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', sel.project_id)

  if (projErr) throw projErr

  return R.success(
    res,
    { shareId, selectedCount: count, submittedAt },
    'Your selection has been submitted successfully!'
  )
}
