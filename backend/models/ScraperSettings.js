const mongoose = require("mongoose")

const ScraperSettingsSchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      default: true,
    },
    checkInterval: {
      type: Number,
      default: 60, // minutes
      min: 5,
      max: 1440,
    },
    maxProductsPerBatch: {
      type: Number,
      default: 20,
      min: 5,
      max: 100,
    },
    daysToLookBack: {
      type: Number,
      default: 1,
      min: 1,
      max: 30,
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    maxConcurrentRequests: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    delayBetweenRequests: {
      type: Number,
      default: 1000, // ms
      min: 500,
      max: 10000,
    },
    extractEmails: {
      type: Boolean,
      default: true,
    },
    extractTwitter: {
      type: Boolean,
      default: true,
    },
    extractLinks: {
      type: Boolean,
      default: true,
    },
    extractFacebook: {
      type: Boolean,
      default: true,
    },
    extractLinkedin: {
      type: Boolean,
      default: true,
    },
    extractInstagram: {
      type: Boolean,
      default: true,
    },
    maxDepth: {
      type: Number,
      default: 2,
      min: 1,
      max: 5,
    },
    prioritizeContactPages: {
      type: Boolean,
      default: true,
    },
    webhookUrl: {
      type: String,
      default: "",
    },
    notifyOnNewProducts: {
      type: Boolean,
      default: true,
    },
    lastRun: {
      type: Date,
    },
    nextRun: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

// Create a singleton pattern - there should only be one settings document
ScraperSettingsSchema.statics.getSettings = async function () {
  const settings = await this.findOne({})
  if (settings) {
    return settings
  }

  // Create default settings if none exist
  return await this.create({})
}

module.exports = mongoose.model("ScraperSettings", ScraperSettingsSchema)

