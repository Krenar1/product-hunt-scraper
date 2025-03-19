/**
 * Frontend API service to communicate with the backend
 */
import { toast } from "react-hot-toast"

// Base URL of the backend API
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

// API key stored in localStorage
let API_KEY = ""

// Initialize API key from localStorage if available
if (typeof window !== "undefined") {
  API_KEY = localStorage.getItem("ph_scraper_api_key") || ""
}

/**
 * Set API key
 */
export const setApiKey = (key) => {
  API_KEY = key
  if (typeof window !== "undefined") {
    localStorage.setItem("ph_scraper_api_key", key)
  }
}

/**
 * Get API key
 */
export const getApiKey = () => {
  return API_KEY
}

/**
 * Make API request with automatic error handling
 */
const makeRequest = async (endpoint, options = {}) => {
  try {
    const url = `${API_URL}${endpoint}`

    // Default headers
    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...options.headers,
    }

    // Fetch request
    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Handle error responses
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || "API request failed")
    }

    // Check content type for JSON or other formats
    const contentType = response.headers.get("Content-Type") || ""

    if (contentType.includes("application/json")) {
      return await response.json()
    } else if (contentType.includes("text/csv")) {
      return await response.text()
    } else {
      return await response.text()
    }
  } catch (error) {
    // Show error toast
    toast.error(error.message || "API request failed")
    throw error
  }
}

/**
 * Products API
 */
export const productsApi = {
  // Get products with pagination
  getProducts: async (page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc") => {
    return makeRequest(`/products?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`)
  },

  // Get a single product by ID
  getProduct: async (id) => {
    return makeRequest(`/products/${id}`)
  },

  // Search products with filters
  searchProducts: async (filters = {}) => {
    const params = new URLSearchParams()

    // Add filters to query string
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value)
      }
    })

    return makeRequest(`/products/search?${params.toString()}`)
  },

  // Export products as CSV/JSON
  exportProducts: async (format = "csv", filters = {}) => {
    const params = new URLSearchParams()
    params.append("format", format)

    // Add filters to query string
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value)
      }
    })

    return makeRequest(`/products/export?${params.toString()}`)
  },
}

/**
 * Scraping API
 */
export const scrapingApi = {
  // Start a scraping job
  startScraping: async (params = {}) => {
    return makeRequest("/scraping/start", {
      method: "POST",
      body: JSON.stringify(params),
    })
  },

  // Get current scraping status
  getScrapingStatus: async () => {
    return makeRequest("/scraping/status")
  },

  // Stop the current scraping job
  stopScraping: async () => {
    return makeRequest("/scraping/stop", {
      method: "POST",
    })
  },

  // Get scraping job history
  getScrapingHistory: async (page = 1, limit = 10) => {
    return makeRequest(`/scraping/history?page=${page}&limit=${limit}`)
  },

  // Get scraping settings
  getScrapingSettings: async () => {
    return makeRequest("/scraping/settings")
  },

  // Update scraping settings
  updateScrapingSettings: async (settings = {}) => {
    return makeRequest("/scraping/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    })
  },
}

/**
 * Stats API
 */
export const statsApi = {
  // Get stats summary
  getStatsSummary: async () => {
    return makeRequest("/stats/summary")
  },

  // Get email extraction stats
  getEmailStats: async () => {
    return makeRequest("/stats/emails")
  },

  // Get Twitter extraction stats
  getTwitterStats: async () => {
    return makeRequest("/stats/twitter")
  },

  // Get scraping performance stats
  getScrapingStats: async () => {
    return makeRequest("/stats/scraping")
  },
}

// Export all API functions
export default {
  products: productsApi,
  scraping: scrapingApi,
  stats: statsApi,
  setApiKey,
  getApiKey,
}

