/**
 * PostgreSQL connection pool — single instance shared across the app.
 *
 * Uses pg Pool for connection pooling. Configure via DATABASE_URL
 * or individual PG_* environment variables.
 */

import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Individual vars are used as fallback when DATABASE_URL is not set
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'photoshare',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message)
})

/**
 * Run a single query against the pool.
 * @param {string} text  SQL query with $1, $2, … placeholders
 * @param {any[]}  params  Bind values
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start

  if (process.env.NODE_ENV !== 'production') {
    console.log('[DB]', { text: text.slice(0, 80), duration: `${duration}ms`, rows: result.rowCount })
  }

  return result
}

/**
 * Acquire a client from the pool for transactions.
 * Caller MUST call client.release() when done.
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return pool.connect()
}

/**
 * Run a callback inside a transaction.
 * Automatically commits on success, rolls back on error.
 * @param {(client: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Gracefully close all pool connections.
 */
export async function closePool() {
  await pool.end()
}

export default pool
