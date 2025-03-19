const express = require("express")
const router = express.Router()
const { getStatsSummary, getEmailStats, getTwitterStats, getScrapingStats } = require("../controllers/statsController")

/**
 * @route GET /api/stats/summary
 * @desc Get overview of all stats
 * @access Private
 */
router.get("/summary", getStatsSummary)

/**
 * @route GET /api/stats/emails
 * @desc Get email extraction stats
 * @access Private
 */
router.get("/emails", getEmailStats)

/**
 * @route GET /api/stats/twitter
 * @desc Get Twitter extraction stats
 * @access Private
 */
router.get("/twitter", getTwitterStats)

/**
 * @route GET /api/stats/scraping
 * @desc Get scraping performance stats
 * @access Private
 */
router.get("/scraping", getScrapingStats)

module.exports = router

