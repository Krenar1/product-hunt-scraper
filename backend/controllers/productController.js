const Product = require("../models/Product")
const { logger } = require("../utils/logger")
const { createCsvStringifier } = require("csv-writer")
const createError = require("http-errors")

/**
 * Get products with pagination
 */
exports.getProducts = async (req, res, next) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const sortBy = req.query.sortBy || "createdAt"
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1

    const skip = (page - 1) * limit

    // Build sort object
    const sort = {}
    sort[sortBy] = sortOrder

    const products = await Product.find().sort(sort).skip(skip).limit(limit)

    const total = await Product.countDocuments()

    res.json({
      products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error(`Error getting products: ${error.message}`)
    next(createError(500, "Failed to fetch products"))
  }
}

/**
 * Get a single product by ID
 */
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({ productId: req.params.id })

    if (!product) {
      return next(createError(404, "Product not found"))
    }

    res.json(product)
  } catch (error) {
    logger.error(`Error getting product ${req.params.id}: ${error.message}`)
    next(createError(500, "Failed to fetch product"))
  }
}

/**
 * Search products with filters
 */
exports.searchProducts = async (req, res, next) => {
  try {
    const { query, daysBack, hasEmail, hasTwitter, hasContactLink, minVotes, sortBy, sortOrder, page, limit } =
      req.query

    // Build query
    const queryObject = {}

    // Text search
    if (query) {
      queryObject.$or = [
        { name: { $regex: query, $options: "i" } },
        { tagline: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ]
    }

    // Days back filter
    if (daysBack) {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - Number.parseInt(daysBack))
      queryObject.createdAt = { $gte: daysAgo }
    }

    // Contact info filters
    if (hasEmail === "true") {
      queryObject.emails = { $exists: true, $ne: [] }
    }

    if (hasTwitter === "true") {
      queryObject.twitterHandles = { $exists: true, $ne: [] }
    }

    if (hasContactLink === "true") {
      queryObject.contactLinks = { $exists: true, $ne: [] }
    }

    // Votes filter
    if (minVotes) {
      queryObject.votesCount = { $gte: Number.parseInt(minVotes) }
    }

    // Pagination
    const pageNum = Number.parseInt(page) || 1
    const limitNum = Number.parseInt(limit) || 20
    const skip = (pageNum - 1) * limitNum

    // Sort
    const sort = {}
    sort[sortBy || "createdAt"] = sortOrder === "asc" ? 1 : -1

    // Execute query
    const products = await Product.find(queryObject).sort(sort).skip(skip).limit(limitNum)

    const total = await Product.countDocuments(queryObject)

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    logger.error(`Error searching products: ${error.message}`)
    next(createError(500, "Failed to search products"))
  }
}

/**
 * Export products as CSV/JSON
 */
exports.exportProducts = async (req, res, next) => {
  try {
    const { format, daysBack, query, hasEmail, hasTwitter } = req.query

    // Build query
    const queryObject = {}

    // Days back filter
    if (daysBack) {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - Number.parseInt(daysBack))
      queryObject.createdAt = { $gte: daysAgo }
    }

    // Text search
    if (query) {
      queryObject.$or = [{ name: { $regex: query, $options: "i" } }, { tagline: { $regex: query, $options: "i" } }]
    }

    // Contact info filters
    if (hasEmail === "true") {
      queryObject.emails = { $exists: true, $ne: [] }
    }

    if (hasTwitter === "true") {
      queryObject.twitterHandles = { $exists: true, $ne: [] }
    }

    // Get products
    const products = await Product.find(queryObject)

    // Determine response format
    if (format === "json") {
      res.json(products)
    } else {
      // Default to CSV
      const csvHeaders = [
        { id: "productId", title: "ID" },
        { id: "name", title: "Name" },
        { id: "tagline", title: "Tagline" },
        { id: "url", title: "ProductHunt URL" },
        { id: "website", title: "Website" },
        { id: "votesCount", title: "Votes" },
        { id: "createdAt", title: "Created At" },
        { id: "emails", title: "Emails" },
        { id: "twitterHandles", title: "Twitter Handles" },
        { id: "contactLinks", title: "Contact Links" },
      ]

      const csvStringifier = createCsvStringifier({
        header: csvHeaders,
      })

      // Transform products data for CSV
      const csvData = products.map((product) => ({
        productId: product.productId,
        name: product.name,
        tagline: product.tagline,
        url: product.url,
        website: product.website || "",
        votesCount: product.votesCount,
        createdAt: product.createdAt.toISOString(),
        emails: product.emails ? product.emails.join(", ") : "",
        twitterHandles: product.twitterHandles ? product.twitterHandles.join(", ") : "",
        contactLinks: product.contactLinks ? product.contactLinks.join(", ") : "",
      }))

      // Create CSV string
      const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData)

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv")
      res.setHeader("Content-Disposition", "attachment; filename=products-export.csv")

      res.send(csvString)
    }
  } catch (error) {
    logger.error(`Error exporting products: ${error.message}`)
    next(createError(500, "Failed to export products"))
  }
}

