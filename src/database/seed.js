/**
 * Database seeder — populates the database with demo data.
 *
 * Run: npm run seed   (from the backend/ directory)
 *
 * Safe to re-run: skips if demo user already exists.
 */

import 'dotenv/config'
import { query } from '../config/db.js'
import { closePool } from '../config/db.js'
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
    coverImage: 'https://picsum.photos/seed/wedding1/600/400',
    imageCount: 248, selectedCount: 0, clientEmail: 'sarah@example.com',
    notes: 'Beach ceremony, golden hour shoot',
  },
  {
    id: 'proj_demo_2', name: "Emma's 5th Birthday", eventType: 'birthday',
    status: 'completed', shareId: 'share_def456',
    coverImage: 'https://picsum.photos/seed/birthday1/600/400',
    imageCount: 156, selectedCount: 42, password: '1234',
    clientEmail: 'emma.mom@example.com', notes: 'Indoor party with balloon decor',
  },
  {
    id: 'proj_demo_3', name: 'TechCorp Annual Summit', eventType: 'corporate',
    status: 'pending', shareId: 'share_ghi789',
    coverImage: 'https://picsum.photos/seed/corporate1/600/400',
    imageCount: 312, selectedCount: 0, clientEmail: 'hr@techcorp.com',
    notes: 'Keynote + team headshots',
  },
  {
    id: 'proj_demo_4', name: 'Priya & Raj Engagement', eventType: 'engagement',
    status: 'in_review', shareId: 'share_jkl012',
    coverImage: 'https://picsum.photos/seed/engagement1/600/400',
    imageCount: 89, selectedCount: 15, clientEmail: 'priya@example.com',
    notes: 'Sunrise rooftop session',
  },
]

async function seed() {
  const { rows: existing } = await query('SELECT id FROM users WHERE id = $1', [DEMO_USER.id])

  if (existing.length > 0) {
    console.log('[SEED] Demo data already exists — skipping.')
    return
  }

  await query(
    'INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4)',
    [DEMO_USER.id, DEMO_USER.email, DEMO_USER.name, DEMO_USER.role]
  )

  for (const p of DEMO_PROJECTS) {
    await query(
      `INSERT INTO projects (id, user_id, name, event_type, status, image_count, selected_count, share_id, password, cover_url, client_email, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [p.id, DEMO_USER.id, p.name, p.eventType, p.status, p.imageCount, p.selectedCount, p.shareId, p.password || '', p.coverImage, p.clientEmail, p.notes]
    )
  }

  for (const p of DEMO_PROJECTS) {
    for (let i = 1; i <= 24; i++) {
      const seed = (DEMO_PROJECTS.indexOf(p) * 8) + i
      await query(
        `INSERT INTO photos (id, project_id, filename, url, thumb_url, width, height, size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `photo_${p.id}_${i}`,
          p.id,
          `IMG_${String(seed).padStart(4, '0')}.jpg`,
          `https://picsum.photos/seed/ps${seed}/800/600`,
          `https://picsum.photos/seed/ps${seed}/400/300`,
          800 + (seed % 5) * 80,
          600 + (seed % 4) * 60,
          3_400_000 + seed * 11_000,
        ]
      )
    }
  }

  const selId = uuid()
  await query(
    'INSERT INTO selections (id, share_id, project_id) VALUES ($1, $2, $3)',
    [selId, 'share_jkl012', 'proj_demo_4']
  )

  const selectedPhotoIds = ['photo_proj_demo_4_1', 'photo_proj_demo_4_3', 'photo_proj_demo_4_7']
  for (const photoId of selectedPhotoIds) {
    await query(
      'INSERT INTO selected_photos (id, selection_id, photo_id, comment) VALUES ($1, $2, $3, $4)',
      [uuid(), selId, photoId, photoId === 'photo_proj_demo_4_3' ? 'Please brighten this one' : '']
    )
  }

  console.log('[SEED] Demo data inserted successfully.')
  console.log(`       Login email: ${DEMO_USER.email}`)
  console.log('       Any 6-digit OTP code will work in dev mode (check console output).')
}

seed()
  .catch(err => {
    console.error('[SEED] Fatal error:', err)
    process.exit(1)
  })
  .finally(() => closePool())
