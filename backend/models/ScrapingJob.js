const mongoose = require("mongoose")

const ScrapingJobSchema = new mongoose.Schema(
  {
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed", "stopped"],
      default: "running",
    },
    productsFound: {
      type: Number,
      default: 0,
    },
    productsScraped: {
      type: Number,
      default: 0,
    },
    newProductsFound: {
      type: Number,
      default: 0,
    },
    emailsFound: {
      type: Number,
      default: 0,
    },
    twitterHandlesFound: {
      type: Number,
      default: 0,
    },
    error: String,
    parameters: {
      daysBack: {
        type: Number,
        default: 1,
      },
      batchSize: {
        type: Number,
        default: 20,
      },
      maxConcurrentRequests: {
        type: Number,
        default: 3,
      },
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Virtual for calculating duration in seconds
ScrapingJobSchema.virtual("durationInSeconds").get(function () {
  if (!this.endTime) return 0
  return Math.floor((this.endTime - this.startTime) / 1000)
})

// Virtual for job status message
ScrapingJobSchema.virtual("statusMessage").get(function () {
  switch (this.status) {
    case "running":
      return "Scraping in progress..."
    case "completed":
      return `Completed: Found ${this.newProductsFound} new products`
    case "failed":
      return `Failed: ${this.error || "Unknown error"}`
    case "stopped":
      return "Stopped by user"
    default:
      return "Unknown status"
  }
})

module.exports = mongoose.model("ScrapingJob", ScrapingJobSchema)

