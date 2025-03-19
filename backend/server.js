const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const cron = require("node-cron")
const dotenv = require("dotenv")
const routes = require("./routes")
const { startScraperJob } = require("./services/scraperService")
const { logger } = require("./utils/logger")

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()
const PORT = process.env.PORT || 5000

// Apply middleware
app.use(express.json({ limit: "10mb" }))
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)

// Simple health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() })
})

// API routes
app.use("/api", routes)

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`)
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  })
})

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info("Connected to MongoDB")

    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`)

      // Setup cron jobs for continuous scraping
      setupCronJobs()
    })
  })
  .catch((error) => {
    logger.error(`MongoDB connection error: ${error.message}`)
    process.exit(1)
  })

// Setup cron jobs for automated scraping
function setupCronJobs() {
  // Run scraper every hour
  cron.schedule(process.env.SCRAPER_CRON || "0 * * * *", async () => {
    logger.info("Running scheduled product scraping job")
    try {
      const result = await startScraperJob()
      logger.info(`Scraping job completed: found ${result.newProducts.length} new products`)
    } catch (error) {
      logger.error(`Scraping job failed: ${error.message}`)
    }
  })

  // Run a daily clean-up job
  cron.schedule("0 0 * * *", async () => {
    logger.info("Running daily clean-up job")
    // Additional clean-up or maintenance tasks can be added here
  })

  logger.info("Cron jobs scheduled successfully")
}

// Handle graceful shutdown
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

function shutdown() {
  logger.info("Received shutdown signal, closing connections...")
  mongoose.connection.close(() => {
    logger.info("MongoDB connection closed")
    process.exit(0)
  })
}

