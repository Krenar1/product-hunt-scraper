const mongoose = require("mongoose")

const MakerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  headline: String,
  twitterUsername: String,
})

const ProductSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    tagline: {
      type: String,
      required: true,
    },
    description: String,
    url: {
      type: String,
      required: true,
    },
    website: String,
    exactWebsiteUrl: String,
    imageUrl: String,
    votesCount: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
    makers: [MakerSchema],
    emails: [String],
    twitterHandles: [String],
    facebookLinks: [String],
    instagramLinks: [String],
    linkedinLinks: [String],
    contactLinks: [String],
    aboutLinks: [String],
    externalLinks: [String],
  },
  {
    timestamps: true,
  },
)

// Indexes for faster queries
ProductSchema.index({ productId: 1 })
ProductSchema.index({ createdAt: -1 })
ProductSchema.index({ votesCount: -1 })
ProductSchema.index({ scrapedAt: -1 })
ProductSchema.index({ "makers.name": 1 })

// Virtual for calculating product age in days
ProductSchema.virtual("ageInDays").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24))
})

module.exports = mongoose.model("Product", ProductSchema)

