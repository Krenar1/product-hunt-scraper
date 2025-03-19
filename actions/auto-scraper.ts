"use server"

import { fetchProducts } from "./fetch-products"
import { sendDiscordNotification } from "./discord-webhook"
import { extractContactInfo } from "@/actions/extract-contacts"
import type { Product } from "@/types/product"

// In-memory storage for tracking seen products
// This will be synced with localStorage on the client side
let seenProductIds = new Set<string>()
let lastRunTime = 0
let isRunning = false

// Function to save seen product IDs to localStorage (will be called from client component)
export async function saveSeenProductIds(ids: string[]): Promise<boolean> {
  try {
    // This is just a server-side function that will be called from the client
    // The actual saving happens in the client component
    return true
  } catch (error) {
    console.error("Error in saveSeenProductIds server function:", error)
    return false
  }
}

// Function to load seen product IDs (will be called from client component)
export async function loadSeenProductIds(ids: string[]): Promise<boolean> {
  try {
    // Update the in-memory set with the IDs from localStorage
    seenProductIds = new Set(ids)
    console.log(`Loaded ${seenProductIds.size} product IDs from persistent storage`)
    return true
  } catch (error) {
    console.error("Error in loadSeenProductIds server function:", error)
    return false
  }
}

// Function to initialize with products from a specific time range
export async function initializeWithTimeRange(
  webhookUrl: string,
  daysBack: number,
): Promise<{
  success: boolean
  message: string
  seenIds?: string[]
  productsCount?: number
}> {
  try {
    // Check if webhook URL is valid
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      return {
        success: false,
        message: "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      }
    }

    // Clear existing seen product IDs
    seenProductIds = new Set<string>()

    console.log(`Initializing auto-scraper with products from the last ${daysBack} days...`)

    // Fetch in batches to get all products from the specified time range
    let hasMore = true
    let cursor = undefined
    let totalProducts = 0
    let batchCount = 0
    const MAX_BATCHES = 10 // Limit to prevent excessive API calls

    while (hasMore && batchCount < MAX_BATCHES) {
      batchCount++
      const batchProducts = await fetchProducts(
        {
          daysBack,
          sortBy: "newest",
          limit: 50,
        },
        cursor,
      )

      if (!batchProducts?.posts?.edges || batchProducts.posts.edges.length === 0) {
        break
      }

      batchProducts.posts.edges.forEach((edge) => {
        seenProductIds.add(edge.node.id)
      })

      totalProducts += batchProducts.posts.edges.length
      cursor = batchProducts.posts.pageInfo.endCursor
      hasMore = batchProducts.posts.pageInfo.hasNextPage

      // Avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Initialized auto-scraper with ${seenProductIds.size} products from the last ${daysBack} days`)

    // Return the seen product IDs so they can be saved to localStorage
    return {
      success: true,
      message: `Auto-scraper initialized successfully. Tracking ${seenProductIds.size} products from the last ${daysBack} days.`,
      seenIds: Array.from(seenProductIds),
      productsCount: totalProducts,
    }
  } catch (error) {
    console.error(`Error initializing auto-scraper with time range (${daysBack} days):`, error)
    return {
      success: false,
      message: `Failed to initialize auto-scraper: ${error.message}`,
    }
  }
}

// Function to initialize with only today's products
export async function initializeWithTodayOnly(webhookUrl: string): Promise<{
  success: boolean
  message: string
  seenIds?: string[]
}> {
  try {
    // Check if webhook URL is valid
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      return {
        success: false,
        message: "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      }
    }

    // Clear existing seen product IDs
    seenProductIds = new Set<string>()

    console.log("Initializing auto-scraper with today's products only...")

    // Fetch all of today's products with pagination
    let hasMore = true
    let cursor = undefined
    let totalProducts = 0

    while (hasMore) {
      const todayProducts = await fetchProducts(
        {
          daysBack: 1,
          sortBy: "newest",
          limit: 50, // Increased from 20 to 50 to get more per page
        },
        cursor,
      )

      if (!todayProducts?.posts?.edges || todayProducts.posts.edges.length === 0) {
        break
      }

      todayProducts.posts.edges.forEach((edge) => {
        seenProductIds.add(edge.node.id)
      })

      totalProducts += todayProducts.posts.edges.length
      cursor = todayProducts.posts.pageInfo.endCursor
      hasMore = todayProducts.posts.pageInfo.hasNextPage

      // Avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Initialized auto-scraper with ${seenProductIds.size} products from today`)

    // Return the seen product IDs so they can be saved to localStorage
    return {
      success: true,
      message: `Auto-scraper initialized successfully. Tracking ${seenProductIds.size} products from today.`,
      seenIds: Array.from(seenProductIds),
    }
  } catch (error) {
    console.error("Error initializing auto-scraper with today's products:", error)
    return {
      success: false,
      message: `Failed to initialize auto-scraper: ${error.message}`,
    }
  }
}

// Get the current seen product IDs
export async function getSeenProductIds(): Promise<string[]> {
  return Array.from(seenProductIds)
}

export async function initializeAutoScraper(webhookUrl: string): Promise<{
  success: boolean
  message: string
  seenIds?: string[]
}> {
  try {
    // Check if webhook URL is valid
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      return {
        success: false,
        message: "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      }
    }

    // Initialize with products from the last 7 days to avoid sending notifications for existing products
    console.log("Initializing auto-scraper with products from the last 7 days...")

    // Fetch in batches to get all products from the last 7 days
    let hasMore = true
    let cursor = undefined
    let totalProducts = 0

    while (hasMore) {
      const batchProducts = await fetchProducts(
        {
          daysBack: 7,
          sortBy: "newest",
          limit: 50,
        },
        cursor,
      )

      if (!batchProducts?.posts?.edges || batchProducts.posts.edges.length === 0) {
        break
      }

      batchProducts.posts.edges.forEach((edge) => {
        seenProductIds.add(edge.node.id)
      })

      totalProducts += batchProducts.posts.edges.length
      cursor = batchProducts.posts.pageInfo.endCursor
      hasMore = batchProducts.posts.pageInfo.hasNextPage

      // Avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Initialized auto-scraper with ${seenProductIds.size} recent products from the last 7 days`)

    // Return the seen product IDs so they can be saved to localStorage
    return {
      success: true,
      message: `Auto-scraper initialized successfully. Tracking ${seenProductIds.size} products from the last 7 days.`,
      seenIds: Array.from(seenProductIds),
    }
  } catch (error) {
    console.error("Error initializing auto-scraper:", error)
    return {
      success: false,
      message: `Failed to initialize auto-scraper: ${error.message}`,
    }
  }
}

// Update the checkForNewProducts function to ensure we're saving the exact website URL
export async function checkForNewProducts(
  webhookUrl: string,
  focus24h = false,
): Promise<{
  success: boolean
  newProducts: Product[]
  message: string
  seenIds?: string[]
}> {
  // Prevent concurrent runs
  if (isRunning) {
    console.log("Skipping check - another scraping operation is already in progress")
    return {
      success: false,
      newProducts: [],
      message: "Another scraping operation is already in progress",
    }
  }

  // Implement rate limiting to prevent too frequent calls
  const now = Date.now()
  const timeSinceLastRun = now - lastRunTime
  const MIN_INTERVAL = 30000 // 30 seconds minimum between runs (reduced from 60s)

  if (timeSinceLastRun < MIN_INTERVAL) {
    console.log(`Rate limiting - last run was ${timeSinceLastRun}ms ago, minimum interval is ${MIN_INTERVAL}ms`)
    return {
      success: false,
      newProducts: [],
      message: `Please wait ${Math.ceil((MIN_INTERVAL - timeSinceLastRun) / 1000)} seconds before checking again`,
    }
  }

  try {
    console.log("Starting check for new products...")
    isRunning = true
    lastRunTime = now

    // Set daysBack to 1 when focus24h is true
    const daysBack = focus24h ? 1 : 1 // Always 1 day for cron job approach

    // Fetch all new products with pagination
    const newProducts: Product[] = []
    let hasMore = true
    let cursor = undefined
    let retryCount = 0
    const MAX_RETRIES = 3

    console.log(`Checking for new products in the last ${daysBack} days`)

    while (hasMore) {
      try {
        console.log(`Fetching products with cursor: ${cursor || "initial"}`)
        const data = await fetchProducts(
          {
            daysBack,
            sortBy: "newest",
            limit: 50, // Increased from 20 to 50
          },
          cursor,
        )

        if (!data?.posts?.edges || data.posts.edges.length === 0) {
          console.log("No products found in this batch")
          break
        }

        console.log(`Found ${data.posts.edges.length} products in this batch`)

        // Find new products that we haven't seen before
        for (const edge of data.posts.edges) {
          const product = edge.node

          if (!seenProductIds.has(product.id)) {
            console.log(`Found new product: ${product.name} (${product.id})`)
            newProducts.push(product)
            seenProductIds.add(product.id)
          }
        }

        // Update cursor and check if there are more pages
        cursor = data.posts.pageInfo.endCursor
        hasMore = data.posts.pageInfo.hasNextPage

        // Avoid rate limiting
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (fetchError) {
        console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError)
        retryCount++

        if (retryCount >= MAX_RETRIES) {
          console.error("Failed to fetch products after all retry attempts")
          break
        }

        // Wait before retrying
        const backoffTime = 5000 * retryCount
        console.log(`Waiting ${backoffTime}ms before retry ${retryCount + 1}`)
        await new Promise((resolve) => setTimeout(resolve, backoffTime))
      }
    }

    console.log(`Found ${newProducts.length} new products in total`)

    // If we have new products, extract contact information and send notifications
    if (newProducts.length > 0) {
      console.log(`Found ${newProducts.length} new products. Immediately extracting contact information...`)

      // Process products in parallel for faster extraction
      try {
        console.log("Starting immediate contact extraction for new products...")

        // Extract contact info for all products at once
        const productsWithContacts = await extractContactInfo(newProducts, newProducts.length)
        console.log(`Successfully extracted contact info for ${productsWithContacts.length} products`)

        // Ensure we're using the exact website URL, not redirected ones
        const optimizedProducts = productsWithContacts.map((product) => {
          if (product.contactInfo && product.contactInfo.exactWebsiteUrl) {
            return {
              ...product,
              exactWebsiteUrl: product.contactInfo.exactWebsiteUrl,
              website: product.contactInfo.exactWebsiteUrl, // Use the exact URL as the main website URL
              emails: product.contactInfo.emails || [],
              twitterHandles: product.contactInfo.socialMedia?.twitter || [],
              facebookLinks: product.contactInfo.socialMedia?.facebook || [],
              instagramLinks: product.contactInfo.socialMedia?.instagram || [],
              linkedinLinks: product.contactInfo.socialMedia?.linkedin || [],
              contactLinks: product.contactInfo.contactUrl ? [product.contactInfo.contactUrl] : [],
              externalLinks: product.contactInfo.externalLinks || [],
            }
          }
          return product
        })

        // Send Discord notifications with minimal delay between them
        console.log(`Immediately sending ${optimizedProducts.length} notifications to Discord...`)

        let notificationsSent = 0
        const notificationPromises = optimizedProducts.map(async (product, index) => {
          if (webhookUrl) {
            try {
              // Stagger notifications slightly to avoid Discord rate limits
              // but keep the delay minimal (200ms between each)
              if (index > 0) {
                await new Promise((resolve) => setTimeout(resolve, 200))
              }

              console.log(`Sending notification for product: ${product.name}`)
              const sent = await sendDiscordNotification(product, webhookUrl)

              if (sent) {
                notificationsSent++
                console.log(`Successfully sent notification for ${product.name}`)
                return true
              } else {
                console.error(`Failed to send notification for ${product.name}`)
                return false
              }
            } catch (notifyError) {
              console.error(`Error sending notification for product ${product.id}:`, notifyError)
              return false
            }
          }
          return false
        })

        // Wait for all notifications to complete
        await Promise.all(notificationPromises)
        console.log(`Sent ${notificationsSent} notifications to Discord immediately after scraping`)
      } catch (extractError) {
        console.error("Error during immediate contact extraction:", extractError)

        // Even if extraction fails, try to send basic notifications
        console.log("Falling back to basic product data for notifications...")

        let fallbackNotificationsSent = 0
        for (const product of newProducts) {
          if (webhookUrl) {
            try {
              const sent = await sendDiscordNotification(product, webhookUrl)
              if (sent) {
                fallbackNotificationsSent++
              }
            } catch (notifyError) {
              console.error(`Error sending fallback notification for product ${product.id}:`, notifyError)
            }
          }
        }

        console.log(`Sent ${fallbackNotificationsSent} fallback notifications to Discord`)
      }
    }

    // Limit the size of seenProductIds to prevent memory issues
    if (seenProductIds.size > 1000) {
      // Convert to array, keep only the most recent 500
      const productIdsArray = Array.from(seenProductIds)
      seenProductIds = new Set(productIdsArray.slice(productIdsArray.length - 500))
      console.log(`Trimmed seenProductIds to ${seenProductIds.size} entries to prevent memory issues`)
    }

    console.log("Check for new products completed successfully")
    isRunning = false
    return {
      success: true,
      newProducts,
      message:
        newProducts.length > 0
          ? `Found ${newProducts.length} new products with contact information`
          : "No new products found",
      seenIds: Array.from(seenProductIds), // Return the updated list of seen IDs
    }
  } catch (error) {
    console.error("Error checking for new products:", error)
    isRunning = false
    return {
      success: false,
      newProducts: [],
      message: `Error checking for new products: ${error.message}`,
    }
  }
}

