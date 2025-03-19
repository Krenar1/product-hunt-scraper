const express = require("express")
const router = express.Router()
const productsRoutes = require("./products")
const statsRoutes = require("./stats")
const scrapingRoutes = require("./scraping")
const authMiddleware = require("../middleware/auth")

// Apply authentication middleware to protected routes
router.use(authMiddleware)

// Register route groups
router.use("/products", productsRoutes)
router.use("/stats", statsRoutes)
router.use("/scraping", scrapingRoutes)

module.exports = router

