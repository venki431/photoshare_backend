/**
 * Global error handler — last Express middleware in the chain.
 */

export function errorHandler(err, req, res, _next) {
  const status  = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path}`, err)
  }

  res.status(status).json({ success: false, data: null, message })
}

/**
 * Wraps an async Express route handler so thrown errors flow to errorHandler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
