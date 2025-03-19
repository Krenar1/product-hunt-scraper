const ScrapingJob = require("../models/ScrapingJob")
const ScraperSettings = require("../models/ScraperSettings")
const { logger } = require("../utils/logger")
const { startScraperJob, stopScraperJob, getScraperStatus } = require("../services/scraperService")
const createError = require("http-errors")

/**
 * Start a scraping job
 */
exports.startScraping = async (req, res, next) => {
  try {
    // Check if a job is already running
    const runningJob = await ScrapingJob.findOne({ status: "running" })

    if (runningJob) {
      return next(createError(409, "A scraping job is already running"))
    }

    // Get parameters from request body
    const { daysBack, batchSize, maxConcurrentRequests } = req.body

    // Start the scraper job
    const job = await startScraperJob({
      daysBack,
      batchSize,
      maxConcurrentRequests,
    })

    res.status(201).json({
      message: "Scraping job started successfully",
      job: {
        id: job._id,
        startTime: job.startTime,
        status: job.status,
      },
    })
  } catch (error) {
    logger.error(`Error starting scraping job: ${error.message}`)
    next(createError(500, "Failed to start scraping job"))
  }
}

/**
 * Get current scraping status
 */
exports.getScrapingStatus = async (req, res, next) => {
  try {
    const status = await getScraperStatus()
    res.json(status)
  } catch (error) {
    logger.error(`Error getting scraping status: ${error.message}`)
    next(createError(500, "Failed to get scraping status"))
  }
}

/**
 * Stop the current scraping job
 */
exports.stopScraping = async (req, res, next) => {
  try {
    const result = await stopScraperJob()

    if (!result.success) {
      return next(createError(404, "No active scraping job found"))
    }

    res.json({
      message: "Scraping job stopped successfully",
      job: result.job,
    })
  } catch (error) {
    logger.error(`Error stopping scraping job: ${error.message}`)
    next(createError(500, "Failed to stop scraping job"))
  }
}

/**
 * Get scraping job history
 */
exports.getScrapingHistory = async (req, res, next) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const jobs = await ScrapingJob.find().sort({ startTime: -1 }).skip(skip).limit(limit)

    const total = await ScrapingJob.countDocuments()

    res.json({
      jobs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error(`Error getting scraping history: ${error.message}`)
    next(createError(500, "Failed to get scraping history"))
  }
}

/**
 * Get scraping settings
 */
exports.getScrapingSettings = async (req, res, next) => {
  try {
    const settings = await ScraperSettings.getSettings()
    res.json(settings)
  } catch (error) {
    logger.error(`Error getting scraping settings: ${error.message}`)
    next(createError(500, "Failed to get scraping settings"))
  }
}

/**
 * Update scraping settings
 */
exports.updateScrapingSettings = async (req, res, next) => {
  try {
    const settings = await ScraperSettings.getSettings()

    // Update settings with request body
    Object.keys(req.body).forEach((key) => {
      if (settings[key] !== undefined) {
        settings[key] = req.body[key]
      }
    })

    // Calculate next run time if active
    if (settings.isActive && settings.checkInterval) {
      const nextRun = new Date()
      nextRun.setMinutes(nextRun.getMinutes() + settings.checkInterval)
      settings.nextRun = nextRun
    }

    await settings.save()

    res.json({
      message: "Scraping settings updated successfully",
      settings,
    })
  } catch (error) {
    logger.error(`Error updating scraping settings: ${error.message}`)
    next(createError(500, "Failed to update scraping settings"))
  }
}

