const express = require("express")
const router = express.Router()
const {
  startScraping,
  getScrapingStatus,
  stopScraping,
  getScrapingHistory,
  getScrapingSettings,
  updateScrapingSettings,
} = require("../controllers/scrapingController")

/**
 * @route POST /api/scraping/start
 * @desc Start a scraping job
 * @access Private
 */
router.post("/start", startScraping)

/**
 * @route GET /api/scraping/status
 * @desc Get current scraping status
 * @access Private
 */
router.get("/status", getScrapingStatus)

/**
 * @route POST /api/scraping/stop
 * @desc Stop the current scraping job
 * @access Private
 */
router.post("/stop", stopScraping)

/**
 * @route GET /api/scraping/history
 * @desc Get scraping job history
 * @access Private
 */
router.get("/history", getScrapingHistory)

/**
 * @route GET /api/scraping/settings
 * @desc Get scraping settings
 * @access Private
 */
router.get("/settings", getScrapingSettings)

/**
 * @route PUT /api/scraping/settings
 * @desc Update scraping settings
 * @access Private
 */
router.put("/settings", updateScrapingSettings)

module.exports = router

