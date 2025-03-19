const express = require("express")
const router = express.Router()
const { getProducts, getProductById, searchProducts, exportProducts } = require("../controllers/productController")

/**
 * @route GET /api/products
 * @desc Get all products with pagination
 * @access Private
 */
router.get("/", getProducts)

/**
 * @route GET /api/products/:id
 * @desc Get a single product by ID
 * @access Private
 */
router.get("/:id", getProductById)

/**
 * @route GET /api/products/search
 * @desc Search products with filters
 * @access Private
 */
router.get("/search", searchProducts)

/**
 * @route GET /api/products/export
 * @desc Export products as CSV/JSON
 * @access Private
 */
router.get("/export", exportProducts)

module.exports = router

