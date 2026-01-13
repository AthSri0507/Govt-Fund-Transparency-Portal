function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default handler
  if (res.headersSent) return next(err);
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  const status = err && err.status && Number(err.status) >= 400 ? Number(err.status) : 500;
  const message = err && err.message ? err.message : 'Internal Server Error';
  const payload = { message };
  if (process.env.NODE_ENV !== 'production' && err && err.details) payload.details = err.details;
  return res.status(status).json(payload);
}

module.exports = errorHandler;
