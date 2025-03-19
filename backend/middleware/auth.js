const createError = require("http-errors")
const { logger } = require("../utils/logger")

/**
 * Simple API key authentication middleware
 */
module.exports = (req, res, next) => {
  // Skip auth check for health endpoint
  if (req.path === "/health") {
    return next()
  }

  // Get API key from request header
  const apiKey = req.headers["x-api-key"]

  // If API key is not provided, return 401
  if (!apiKey) {
    logger.warn(`API request without key from ${req.ip}`)
    return next(createError(401, "API key is required"))
  }

  // Check if API key is valid
  if (apiKey !== process.env.API_KEY) {
    logger.warn(`Invalid API key attempt from ${req.ip}`)
    return next(createError(401, "Invalid API key"))
  }

  // If API key is valid, proceed to next middleware
  next()
}

