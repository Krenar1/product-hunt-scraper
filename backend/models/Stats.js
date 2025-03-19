const mongoose = require("mongoose")

const StatsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    totalProducts: {
      type: Number,
      default: 0,
    },
    totalProductsScraped: {
      type: Number,
      default: 0,
    },
    totalEmailsFound: {
      type: Number,
      default: 0,
    },
    totalTwitterHandlesFound: {
      type: Number,
      default: 0,
    },
    totalContactLinksFound: {
      type: Number,
      default: 0,
    },
    totalFacebookLinksFound: {
      type: Number,
      default: 0,
    },
    totalInstagramLinksFound: {
      type: Number,
      default: 0,
    },
    totalLinkedinLinksFound: {
      type: Number,
      default: 0,
    },
    scrapingJobs: {
      type: Number,
      default: 0,
    },
    successfulJobs: {
      type: Number,
      default: 0,
    },
    failedJobs: {
      type: Number,
      default: 0,
    },
    averageJobDuration: {
      type: Number,
      default: 0, // seconds
    },
  },
  {
    timestamps: true,
  },
)

// Create a daily stats record if it doesn't exist
StatsSchema.statics.getDailyStats = async function () {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let stats = await this.findOne({
    date: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    },
  })

  if (!stats) {
    stats = await this.create({ date: today })
  }

  return stats
}

// Update daily stats
StatsSchema.statics.updateStats = async function (updates) {
  const stats = await this.getDailyStats()

  Object.keys(updates).forEach((key) => {
    if (stats[key] !== undefined) {
      stats[key] += updates[key]
    }
  })

  await stats.save()
  return stats
}

module.exports = mongoose.model("Stats", StatsSchema)

