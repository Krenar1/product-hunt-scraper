const Stats = require("../models/Stats")
const Product = require("../models/Product")
const ScrapingJob = require("../models/ScrapingJob")
const { logger } = require("../utils/logger")
const createError = require("http-errors")

/**
 * Get stats summary
 */
exports.getStatsSummary = async (req, res, next) => {
  try {
    // Get daily stats
    const dailyStats = await Stats.getDailyStats()

    // Get all-time counts
    const productCount = await Product.countDocuments()
    const scrapingJobCount = await ScrapingJob.countDocuments()
    const successfulJobCount = await ScrapingJob.countDocuments({ status: "completed" })
    const failedJobCount = await ScrapingJob.countDocuments({ status: "failed" })

    // Calculate email and Twitter stats
    const emailAggregation = await Product.aggregate([
      { $match: { emails: { $exists: true, $ne: [] } } },
      { $unwind: "$emails" },
      { $group: { _id: null, count: { $sum: 1 } } },
    ])

    const twitterAggregation = await Product.aggregate([
      { $match: { twitterHandles: { $exists: true, $ne: [] } } },
      { $unwind: "$twitterHandles" },
      { $group: { _id: null, count: { $sum: 1 } } },
    ])

    const totalEmailsFound = emailAggregation.length > 0 ? emailAggregation[0].count : 0
    const totalTwitterHandlesFound = twitterAggregation.length > 0 ? twitterAggregation[0].count : 0

    res.json({
      daily: {
        date: dailyStats.date,
        productsScraped: dailyStats.totalProductsScraped,
        emailsFound: dailyStats.totalEmailsFound,
        twitterHandlesFound: dailyStats.totalTwitterHandlesFound,
        scrapingJobs: dailyStats.scrapingJobs,
        successRate: dailyStats.scrapingJobs > 0 ? (dailyStats.successfulJobs / dailyStats.scrapingJobs) * 100 : 0,
      },
      allTime: {
        totalProducts: productCount,
        totalScrapingJobs: scrapingJobCount,
        successfulJobs: successfulJobCount,
        failedJobs: failedJobCount,
        successRate: scrapingJobCount > 0 ? (successfulJobCount / scrapingJobCount) * 100 : 0,
        totalEmailsFound,
        totalTwitterHandlesFound,
      },
    })
  } catch (error) {
    logger.error(`Error getting stats summary: ${error.message}`)
    next(createError(500, "Failed to get stats summary"))
  }
}

/**
 * Get email extraction stats
 */
exports.getEmailStats = async (req, res, next) => {
  try {
    // Get products with emails
    const productsWithEmails = await Product.countDocuments({
      emails: { $exists: true, $ne: [] },
    })

    // Get total unique emails
    const emailAggregation = await Product.aggregate([
      { $match: { emails: { $exists: true, $ne: [] } } },
      { $unwind: "$emails" },
      { $group: { _id: "$emails" } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ])

    const uniqueEmailsCount = emailAggregation.length > 0 ? emailAggregation[0].count : 0

    // Get most common email domains
    const domainAggregation = await Product.aggregate([
      { $match: { emails: { $exists: true, $ne: [] } } },
      { $unwind: "$emails" },
      {
        $project: {
          domain: {
            $arrayElemAt: [{ $split: ["$emails", "@"] }, 1],
          },
        },
      },
      { $group: { _id: "$domain", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])

    res.json({
      productsWithEmails,
      uniqueEmailsCount,
      topDomains: domainAggregation,
    })
  } catch (error) {
    logger.error(`Error getting email stats: ${error.message}`)
    next(createError(500, "Failed to get email stats"))
  }
}

/**
 * Get Twitter extraction stats
 */
exports.getTwitterStats = async (req, res, next) => {
  try {
    // Get products with Twitter handles
    const productsWithTwitter = await Product.countDocuments({
      twitterHandles: { $exists: true, $ne: [] },
    })

    // Get unique Twitter handles
    const twitterAggregation = await Product.aggregate([
      { $match: { twitterHandles: { $exists: true, $ne: [] } } },
      { $unwind: "$twitterHandles" },
      { $group: { _id: "$twitterHandles" } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ])

    const uniqueTwitterHandlesCount = twitterAggregation.length > 0 ? twitterAggregation[0].count : 0

    res.json({
      productsWithTwitter,
      uniqueTwitterHandlesCount,
    })
  } catch (error) {
    logger.error(`Error getting Twitter stats: ${error.message}`)
    next(createError(500, "Failed to get Twitter stats"))
  }
}

/**
 * Get scraping performance stats
 */
exports.getScrapingStats = async (req, res, next) => {
  try {
    // Get average job duration
    const durationAggregation = await ScrapingJob.aggregate([
      { $match: { status: "completed" } },
      {
        $project: {
          duration: {
            $divide: [{ $subtract: ["$endTime", "$startTime"] }, 1000],
          },
        },
      },
      { $group: { _id: null, average: { $avg: "$duration" } } },
    ])

    const avgDuration = durationAggregation.length > 0 ? durationAggregation[0].average : 0

    // Get success rate over time (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dailyStats = await Stats.find({
      date: { $gte: sevenDaysAgo },
    }).sort({ date: 1 })

    // Calculate success rate per day
    const successRateOverTime = dailyStats.map((stat) => ({
      date: stat.date,
      successRate: stat.scrapingJobs > 0 ? (stat.successfulJobs / stat.scrapingJobs) * 100 : 0,
      jobsCount: stat.scrapingJobs,
    }))

    res.json({
      averageJobDuration: avgDuration,
      successRateOverTime,
    })
  } catch (error) {
    logger.error(`Error getting scraping stats: ${error.message}`)
    next(createError(500, "Failed to get scraping stats"))
  }
}

