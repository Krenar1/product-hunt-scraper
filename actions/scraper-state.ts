"use server"

import fs from "fs"
import path from "path"
import type { Product } from "@/types/product"

// Define the path to our state file
const stateFilePath = path.join(process.cwd(), "scraper-state.json")

// Define the state structure
export interface ScraperState {
  scrapedProducts: Product[]
  stats: {
    totalProductsFound: number
    totalProductsScraped: number
    totalEmailsFound: number
    totalTwitterHandlesFound: number
    totalLinksFound: number
    successRate: number
    lastRunDuration: number
    averageRunDuration: number
    startTime: string
    totalRunTime: number
    lastActiveTime: string
  }
  extractedData: {
    emails: string[]
    twitterHandles: string[]
    links: string[]
    lastUpdated: string
  }
  lastChecked: string
  newProductsCount: number
  isEnabled: boolean
  webhookUrl: string
  seenProductIds: string[] // Add seenProductIds to state
}

// Default state
const DEFAULT_STATE: ScraperState = {
  scrapedProducts: [],
  stats: {
    totalProductsFound: 0,
    totalProductsScraped: 0,
    totalEmailsFound: 0,
    totalTwitterHandlesFound: 0,
    successRate: 0,
    lastRunDuration: 0,
    averageRunDuration: 0,
    startTime: new Date().toISOString(),
    totalRunTime: 0,
    lastActiveTime: new Date().toISOString(),
  },
  extractedData: {
    emails: [],
    twitterHandles: [],
    links: [],
    lastUpdated: new Date().toISOString(),
  },
  lastChecked: new Date().toISOString(),
  newProductsCount: 0,
  isEnabled: false,
  webhookUrl: "",
  seenProductIds: [],
}

// Helper function to read state
export async function getScraperState(): Promise<ScraperState> {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error reading scraper state file:", error)
  }
  return DEFAULT_STATE
}

// Helper function to write state
export async function saveScraperState(state: Partial<ScraperState>): Promise<boolean> {
  try {
    // Get current state first
    const currentState = await getScraperState()

    // Merge with new state
    const newState = {
      ...currentState,
      ...state,
      // For nested objects, we need to merge them explicitly
      stats: {
        ...currentState.stats,
        ...(state.stats || {}),
      },
      extractedData: {
        ...currentState.extractedData,
        ...(state.extractedData || {}),
      },
    }

    // Write to file
    fs.writeFileSync(stateFilePath, JSON.stringify(newState, null, 2), "utf8")
    return true
  } catch (error) {
    console.error("Error writing scraper state file:", error)
    return false
  }
}

// Helper function to update seen product IDs
export async function updateSeenProductIds(ids: string[]): Promise<boolean> {
  try {
    const currentState = await getScraperState()

    // Merge with existing IDs to avoid duplicates
    const mergedIds = [...new Set([...currentState.seenProductIds, ...ids])]

    return saveScraperState({ seenProductIds: mergedIds })
  } catch (error) {
    console.error("Error updating seen product IDs:", error)
    return false
  }
}

// Helper function to get seen product IDs
export async function getSeenProductIds(): Promise<string[]> {
  try {
    const currentState = await getScraperState()
    return currentState.seenProductIds || []
  } catch (error) {
    console.error("Error getting seen product IDs:", error)
    return []
  }
}

// Helper function to update specific stats
export async function updateScraperStats(stats: Partial<ScraperState["stats"]>): Promise<boolean> {
  try {
    const currentState = await getScraperState()
    const updatedStats = {
      ...currentState.stats,
      ...stats,
    }
    return saveScraperState({ stats: updatedStats })
  } catch (error) {
    console.error("Error updating scraper stats:", error)
    return false
  }
}

// Helper function to update extracted data
export async function updateExtractedData(data: Partial<ScraperState["extractedData"]>): Promise<boolean> {
  try {
    const currentState = await getScraperState()
    const updatedData = {
      ...currentState.extractedData,
      ...data,
      lastUpdated: new Date().toISOString(), // Always update the timestamp
    }
    return saveScraperState({ extractedData: updatedData })
  } catch (error) {
    console.error("Error updating extracted data:", error)
    return false
  }
}

// Helper function to add scraped products
export async function addScrapedProducts(products: Product[]): Promise<boolean> {
  try {
    const currentState = await getScraperState()

    // Create a Set of existing product IDs for quick lookup
    const existingIds = new Set(currentState.scrapedProducts.map((p) => p.id))

    // Filter out duplicates
    const newProducts = products.filter((p) => !existingIds.has(p.id))

    // Combine with existing products
    const updatedProducts = [...currentState.scrapedProducts, ...newProducts]

    return saveScraperState({
      scrapedProducts: updatedProducts,
      stats: {
        ...currentState.stats,
        totalProductsScraped: updatedProducts.length,
      },
    })
  } catch (error) {
    console.error("Error adding scraped products:", error)
    return false
  }
}

// Helper function to get scraped products with pagination
export async function getScrapedProducts(
  page = 1,
  limit = 100,
): Promise<{
  products: Product[]
  total: number
  pages: number
}> {
  try {
    const currentState = await getScraperState()
    const total = currentState.scrapedProducts.length
    const pages = Math.ceil(total / limit)

    const start = (page - 1) * limit
    const end = start + limit

    const products = currentState.scrapedProducts.slice(start, end)

    return {
      products,
      total,
      pages,
    }
  } catch (error) {
    console.error("Error getting scraped products:", error)
    return {
      products: [],
      total: 0,
      pages: 0,
    }
  }
}

