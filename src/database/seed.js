/**
 * Database seeder — populates Supabase with demo data.
 *
 * Run: npm run seed   (from the backend/ directory)
 *
 * Safe to re-run: skips if demo user already exists.
 */

import 'dotenv/config'
import { supabase } from '../config/supabase.js'
import { v4 as uuid } from 'uuid'

const DEMO_USER = {
  id:    'user_demo_001',
  email: 'alex@photoshare.com',
  name:  'Alex Morgan',
  role:  'photographer',
}

const DEMO_PROJECTS = [
  {
    id: 'proj_demo_1', name: 'Sarah & James Wedding', eventType: 'wedding',
    status: 'pending', shareId: 'share_abc123',
    coverUrl: 'https://picsum.photos/seed/wedding1/600/400',
    imageCount: 248, selectedCount: 0, clientEmail: 'sarah@example.com',
    notes: 'Beach ceremony, golden hour shoot',
  },
  {
    id: 'proj_demo_2', name: "Emma's 5th Birthday", eventType: 'birthday',
    status: 'completed', shareId: 'share_def456',
    coverUrl: 'https://picsum.photos/seed/birthday1/600/400',
    imageCount: 156, selectedCount: 42, password: '1234',
    clientEmail: 'emma.mom@example.com', notes: 'Indoor party with balloon decor',
  },
  {
    id: 'proj_demo_3', name: 'TechCorp Annual Summit', eventType: 'corporate',
    status: 'pending', shareId: 'share_ghi789',
    coverUrl: 'https://picsum.photos/seed/corporate1/600/400',
    imageCount: 312, selectedCount: 0, clientEmail: 'hr@techcorp.com',
    notes: 'Keynote + team headshots',
  },
  {
    id: 'proj_demo_4', name: 'Priya & Raj Engagement', eventType: 'engagement',
    status: 'in_review', shareId: 'share_jkl012',
    coverUrl: 'https://picsum.photos/seed/engagement1/600/400',
    imageCount: 89, selectedCount: 15, clientEmail: 'priya@example.com',
    notes: 'Sunrise rooftop session',
  },
]

async function seed() {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', DEMO_USER.id)
    .single()

  if (existing) {
    console.log('[SEED] Demo data already exists — skipping.')
    return
  }

  const { error: userErr } = await supabase
    .from('users')
    .insert(DEMO_USER)

  if (userErr) { console.error('[SEED] Failed to insert user:', userErr); return }

  const projectRows = DEMO_PROJECTS.map(p => ({
    id:             p.id,
    user_id:        DEMO_USER.id,
    name:           p.name,
    event_type:     p.eventType,
    status:         p.status,
    image_count:    p.imageCount,
    selected_count: p.selectedCount,
    share_id:       p.shareId,
    password:       p.password || '',
    cover_url:      p.coverUrl,
    client_email:   p.clientEmail,
    notes:          p.notes,
  }))

  const { error: projErr } = await supabase.from('projects').insert(projectRows)
  if (projErr) { console.error('[SEED] Failed to insert projects:', projErr); return }

  const photoRows = []
  for (const p of DEMO_PROJECTS) {
    for (let i = 1; i <= 24; i++) {
      const seed = (DEMO_PROJECTS.indexOf(p) * 8) + i
      photoRows.push({
        id:         `photo_${p.id}_${i}`,
        project_id: p.id,
        filename:   `IMG_${String(seed).padStart(4, '0')}.jpg`,
        url:        `https://picsum.photos/seed/ps${seed}/800/600`,
        thumb_url:  `https://picsum.photos/seed/ps${seed}/400/300`,
        width:      800 + (seed % 5) * 80,
        height:     600 + (seed % 4) * 60,
        size:       3_400_000 + seed * 11_000,
      })
    }
  }

  const { error: photoErr } = await supabase.from('photos').insert(photoRows)
  if (photoErr) { console.error('[SEED] Failed to insert photos:', photoErr); return }

  const selId = uuid()
  const { error: selErr } = await supabase
    .from('selections')
    .insert({ id: selId, share_id: 'share_jkl012', project_id: 'proj_demo_4' })

  if (selErr) { console.error('[SEED] Failed to insert selection:', selErr); return }

  const selectedPhotoIds = ['photo_proj_demo_4_1', 'photo_proj_demo_4_3', 'photo_proj_demo_4_7']
  const selPhotoRows = selectedPhotoIds.map(photoId => ({
    id:           uuid(),
    selection_id: selId,
    photo_id:     photoId,
    comment:      photoId === 'photo_proj_demo_4_3' ? 'Please brighten this one' : '',
  }))

  const { error: selPhotoErr } = await supabase.from('selected_photos').insert(selPhotoRows)
  if (selPhotoErr) { console.error('[SEED] Failed to insert selected photos:', selPhotoErr); return }

  console.log('[SEED] Demo data inserted successfully.')
  console.log(`       Login email: ${DEMO_USER.email}`)
  console.log('       Any 6-digit OTP code will work in dev mode (check console output).')
}

seed().catch(err => {
  console.error('[SEED] Fatal error:', err)
  process.exit(1)
})
