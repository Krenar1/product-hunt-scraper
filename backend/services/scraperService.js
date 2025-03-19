const ScrapingJob = require("../models/ScrapingJob")
const ScraperSettings = require("../models/ScraperSettings")
const Product = require("../models/Product")
const Stats = require("../models/Stats")
const { logger } = require("../utils/logger")
const { fetchProducts } = require("./productHuntService")
const { extractContactInfo, processBatches } = require("./contactExtractor")
const { sendDiscordNotification } = require("./notificationService")

// Track currently active scraping job
let activeScrapingJob = null

/**
 * Start a scraping job
 */
exports.startScraperJob = async (parameters = {}) => {
  try {
    // Get settings
    const settings = await ScraperSettings.getSettings()

    // Create a new job
    const job = new ScrapingJob({
      parameters: {
        daysBack: parameters.daysBack || settings.daysToLookBack,
        batchSize: parameters.batchSize || settings.maxProductsPerBatch,
        maxConcurrentRequests: parameters.maxConcurrentRequests || settings.maxConcurrentRequests,
      },
    })

    await job.save()

    // Set as active job
    activeScrapingJob = job

    // Run the job asynchronously
    this.runScraperJob(job).catch((error) => {
      logger.error(`Error in scraper job: ${error.message}`)
    })

    return job
  } catch (error) {
    logger.error(`Error starting scraper job: ${error.message}`)
    throw error
  }
}

/**
 * Run a scraping job
 */
exports.runScraperJob = async (job) => {
  try {
    logger.info(`Running scraping job ${job._id}`)

    // Get settings
    const settings = await ScraperSettings.getSettings()

    // Update settings.lastRun
    settings.lastRun = new Date()
    await settings.save()

    // Fetch products from Product Hunt
    logger.info(`Fetching products from the last ${job.parameters.daysBack} days`)

    const productsData = await fetchProducts({
      daysBack: job.parameters.daysBack,
      sortBy: "newest",
      limit: 100, // Fetch a good number of products
    })

    if (!productsData || !productsData.posts || !productsData.posts.edges) {
      throw new Error("Failed to fetch products from Product Hunt")
    }

    // Extract products
    const fetchedProducts = productsData.posts.edges.map((edge) => edge.node)
    job.productsFound = fetchedProducts.length

    // Check which products are new (not in our database)
    const existingProductIds = new Set((await Product.find({}, "productId")).map((p) => p.productId))

    const newProducts = fetchedProducts.filter((product) => !existingProductIds.has(product.id))

    job.newProductsFound = newProducts.length
    await job.save()

    if (newProducts.length === 0) {
      logger.info("No new products found")
      job.status = "completed"
      job.endTime = new Date()
      await job.save()

      // Update stats
      await Stats.updateStats({
        scrapingJobs: 1,
        successfulJobs: 1,
      })

      // Clear active job
      activeScrapingJob = null

      return {
        success: true,
        newProducts: [],
      }
    }

    // Process products in batches to extract contact information
    logger.info(`Extracting contact information for ${newProducts.length} new products`)

    // Prepare for batch processing
    const batches = []
    for (let i = 0; i < newProducts.length; i += job.parameters.batchSize) {
      batches.push(newProducts.slice(i, i + job.parameters.batchSize))
    }

    let processedProducts = []
    let currentBatch = 1

    for (const batch of batches) {
      logger.info(`Processing batch ${currentBatch}/${batches.length} (${batch.length} products)`)

      // Extract contact info from this batch
      const batchResults = await processBatches(
        batch,
        job.parameters.maxConcurrentRequests,
        settings.delayBetweenRequests,
      )

      processedProducts = [...processedProducts, ...batchResults]
      job.productsScraped += batchResults.length
      await job.save()

      currentBatch++
    }

    // Save processed products to database
    const savedProducts = []
    let emailsFound = 0
    let twitterHandlesFound = 0

    for (const product of processedProducts) {
      const newProduct = new Product({
        productId: product.id,
        name: product.name,
        tagline: product.tagline,
        description: product.description,
        url: product.url,
        website: product.website,
        exactWebsiteUrl: product.exactWebsiteUrl,
        imageUrl: product.imageUrl,
        votesCount: product.votesCount,
        createdAt: new Date(product.createdAt),
        makers: product.makers,
        emails: product.emails || [],
        twitterHandles: product.twitterHandles || [],
        facebookLinks: product.facebookLinks || [],
        instagramLinks: product.instagramLinks || [],
        linkedinLinks: product.linkedinLinks || [],
        contactLinks: product.contactLinks || [],
        aboutLinks: product.aboutLinks || [],
        externalLinks: product.externalLinks || [],
      })

      await newProduct.save()
      savedProducts.push(newProduct)

      // Count contact info
      emailsFound += (product.emails || []).length
      twitterHandlesFound += (product.twitterHandles || []).length
    }

    // Send notifications if enabled
    if (settings.notifyOnNewProducts && settings.webhookUrl) {
      for (const product of savedProducts) {
        try {
          await sendDiscordNotification(product, settings.webhookUrl)
        } catch (error) {
          logger.error(`Failed to send notification for product ${product.productId}: ${error.message}`)
        }
      }

      job.notificationSent = true
    }

    // Update job status
    job.status = "completed"
    job.endTime = new Date()
    job.emailsFound = emailsFound
    job.twitterHandlesFound = twitterHandlesFound
    await job.save()

    // Update stats
    await Stats.updateStats({
      totalProductsScraped: savedProducts.length,
      totalEmailsFound: emailsFound,
      totalTwitterHandlesFound: twitterHandlesFound,
      scrapingJobs: 1,
      successfulJobs: 1,
    })

    // Calculate next run time
    if (settings.isActive && settings.checkInterval) {
      const nextRun = new Date()
      nextRun.setMinutes(nextRun.getMinutes() + settings.checkInterval)
      settings.nextRun = nextRun
      await settings.save()
    }

    // Clear active job
    activeScrapingJob = null

    logger.info(`Scraping job completed successfully. Saved ${savedProducts.length} new products.`)

    return {
      success: true,
      newProducts: savedProducts,
    }
  } catch (error) {
    logger.error(`Error in scraper job ${job._id}: ${error.message}`)

    // Update job status
    job.status = "failed"
    job.endTime = new Date()
    job.error = error.message
    await job.save()

    // Update stats
    await Stats.updateStats({
      scrapingJobs: 1,
      failedJobs: 1,
    })

    // Clear active job
    activeScrapingJob = null

    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Stop the current scraping job
 */
exports.stopScraperJob = async () => {
  if (!activeScrapingJob) {
    return { success: false, message: "No active scraping job" }
  }

  try {
    activeScrapingJob.status = "stopped"
    activeScrapingJob.endTime = new Date()
    await activeScrapingJob.save()

    // Update stats
    await Stats.updateStats({
      scrapingJobs: 1,
      failedJobs: 1, // Counting stopped jobs as failed
    })

    const stoppedJob = activeScrapingJob
    activeScrapingJob = null

    return {
      success: true,
      job: stoppedJob,
    }
  } catch (error) {
    logger.error(`Error stopping scraping job: ${error.message}`)
    throw error
  }
}

/**
 * Get current scraper status
 */
exports.getScraperStatus = async () => {
  try {
    const settings = await ScraperSettings.getSettings()

    // Get most recent job
    const recentJob = await ScrapingJob.findOne().sort({ startTime: -1 })

    return {
      isActive: settings.isActive,
      currentJob: activeScrapingJob,
      lastJob: !activeScrapingJob ? recentJob : null,
      lastRun: settings.lastRun,
      nextRun: settings.nextRun,
      checkInterval: settings.checkInterval,
    }
  } catch (error) {
    logger.error(`Error getting scraper status: ${error.message}`)
    throw error
  }
}

