/**
 * Auth middleware — verifies JWT on every protected route.
 *
 * Attaches req.user = { id, email, name, role } on success.
 * Responds 401 if token is missing or invalid.
 */

import jwt from 'jsonwebtoken'
import { unauthorized } from '../utils/response.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return unauthorized(res, 'Authentication required')

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Session expired. Please sign in again.')
    return unauthorized(res, 'Invalid token')
  }
}

/**
 * Soft auth — attaches req.user if a valid token is present,
 * but does NOT block the request if there's no token.
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role }
    } catch (_) {
      // Silently ignore invalid tokens on public routes
    }
  }

  next()
}
