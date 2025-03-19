"use server"

import type { ProductsFilter, ProductsResponse } from "@/types/product"

// Update the API key system to better handle 401 errors
const API_KEYS = [
  process.env.PH_TOKEN, // Primary API key
  process.env.PH_TOKEN_2, // Secondary API key
  process.env.PH_TOKEN_3, // Third reserve API key
].filter(Boolean) // Filter out any undefined or empty keys

// If no API keys are available, add a console warning
if (API_KEYS.length === 0) {
  console.warn(
    "No Product Hunt API keys found in environment variables. Please set PH_TOKEN, PH_TOKEN_2, or PH_TOKEN_3.",
  )
}

// Improve the rate limit tracking with more information and add unauthorized tracking
const keyRateLimitStatus = API_KEYS.map(() => ({
  isRateLimited: false,
  isUnauthorized: false, // Add a flag to track unauthorized keys
  resetTime: 0,
  consecutiveFailures: 0,
  lastSuccess: Date.now(),
}))

// Track which API key is currently being used
let currentKeyIndex = 0

// Replace the entire fetchProducts function with this version that bypasses caching
export const fetchProducts = async (
  filter: ProductsFilter = { daysBack: 7, sortBy: "newest", limit: 20 },
  cursor?: string,
) => {
  try {
    console.log(`Fetching products with filter:`, filter, `cursor: ${cursor || "none"}`)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - filter.daysBack)

    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    console.log(`Requested limit: ${filter.limit}`) // Log the requested limit

    // GraphQL query - updated to include thumbnail and website fields
    const query = `
    query GetPosts($postedAfter: DateTime!, $postedBefore: DateTime!, $first: Int!, $after: String) {
      posts(postedAfter: $postedAfter, postedBefore: $postedBefore, first: $first, after: $after) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            votesCount
            website
            thumbnail {
              url
            }
            createdAt
            makers {
              id
              name
              username
              headline
              twitterUsername
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `

    // Variables for the query - ensure limit is passed as a number
    const variables = {
      postedAfter: startDate.toISOString(),
      postedBefore: endDate.toISOString(),
      first: Number.parseInt(String(filter.limit), 10), // Ensure it's a number
      ...(cursor && { after: cursor }),
    }

    console.log(`GraphQL variables:`, variables) // Log the GraphQL variables

    // Check if we have valid API keys
    if (API_KEYS.length === 0) {
      console.error(
        "No valid API keys configured. Please set PH_TOKEN, PH_TOKEN_2, or PH_TOKEN_3 in your environment variables.",
      )
      throw new Error("Product Hunt API token is not configured")
    }

    // Log the available API keys (without exposing the actual keys)
    console.log(`Using ${API_KEYS.length} API key(s) with rotation`)

    // Try to make the API request with key rotation for rate limiting
    const data = await fetchWithKeyRotation("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Product Hunt Scraper",
        Origin: "https://www.producthunt.com",
        Referer: "https://www.producthunt.com/",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store", // Disable caching
    })

    // Check if the response has the expected structure
    if (!data.data || !data.data.posts) {
      console.error("Unexpected API response structure:", data)
      throw new Error("Unexpected API response structure")
    }

    // Process the response to add imageUrl from thumbnail
    if (data.data.posts.edges) {
      data.data.posts.edges = data.data.posts.edges.map((edge) => {
        if (edge.node.thumbnail && edge.node.thumbnail.url) {
          edge.node.imageUrl = edge.node.thumbnail.url
        }
        return edge
      })
    }

    // Log the number of products found
    const edges = data.data.posts.edges || []
    console.log(`Found ${edges.length} products`)

    return data.data as ProductsResponse
  } catch (error) {
    console.error("Error fetching products:", error)

    // Return empty response structure for specific errors
    if (
      error.message &&
      (error.message.includes("429") || error.message.includes("401") || error.message.includes("unauthorized"))
    ) {
      console.log(
        `API error (${error.message.includes("429") ? "Rate limit" : "Unauthorized"}), returning empty response`,
      )
      return {
        posts: {
          edges: [],
          pageInfo: {
            endCursor: "",
            hasNextPage: false,
          },
        },
      } as ProductsResponse
    }

    throw error
  }
}

// Replace the fetchWithKeyRotation function with this improved version that handles 401 errors
async function fetchWithKeyRotation(url: string, options: RequestInit, retries = 5, backoff = 1000) {
  // Try each API key until we get a successful response or exhaust all keys
  const now = Date.now()

  // First, check if any rate-limited keys have reset
  keyRateLimitStatus.forEach((status, index) => {
    if (status.isRateLimited && now > status.resetTime) {
      console.log(`API key ${index + 1} rate limit has reset, marking as available`)
      status.isRateLimited = false
      status.consecutiveFailures = 0
    }
  })

  // Find all available keys (not rate-limited and not unauthorized)
  const availableKeyIndices = keyRateLimitStatus
    .map((status, index) => ({ status, index }))
    .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized)
    .map((item) => item.index)

  console.log(`Available API keys: ${availableKeyIndices.length}/${API_KEYS.length}`)

  // If we have available keys, use the one that was successful most recently
  let availableKeyIndex = -1

  if (availableKeyIndices.length > 0) {
    // Sort by last success time (most recent first)
    availableKeyIndex = availableKeyIndices.sort(
      (a, b) => keyRateLimitStatus[b].lastSuccess - keyRateLimitStatus[a].lastSuccess,
    )[0]
    console.log(`Selected API key ${availableKeyIndex + 1} based on recent success`)
  } else {
    // If all keys are rate limited or unauthorized, check if we have any rate-limited keys that will reset
    const rateLimitedKeys = keyRateLimitStatus
      .map((status, index) => ({ status, index }))
      .filter((item) => item.status.isRateLimited && !item.status.isUnauthorized)

    if (rateLimitedKeys.length > 0) {
      // Find the one that will reset first
      availableKeyIndex = rateLimitedKeys.reduce(
        (minIndex, item) =>
          keyRateLimitStatus[item.index].resetTime < keyRateLimitStatus[minIndex].resetTime ? item.index : minIndex,
        rateLimitedKeys[0].index,
      )

      // If the earliest reset time is in the future, wait for it
      if (keyRateLimitStatus[availableKeyIndex].resetTime > now) {
        const waitTime = keyRateLimitStatus[availableKeyIndex].resetTime - now
        console.log(`All API keys are rate limited. Waiting ${waitTime}ms for reset of key ${availableKeyIndex + 1}...`)

        // Wait for the key to reset
        await new Promise((resolve) => setTimeout(resolve, waitTime + 2000)) // Add 2 second buffer

        // Mark the key as available
        keyRateLimitStatus[availableKeyIndex].isRateLimited = false
        keyRateLimitStatus[availableKeyIndex].consecutiveFailures = 0
        console.log(`Key ${availableKeyIndex + 1} should now be available after waiting`)
      }
    } else {
      // All keys are unauthorized or we have no valid keys
      console.error("All API keys are unauthorized or invalid. Cannot proceed with request.")
      throw new Error("All API keys are unauthorized. Please check your API keys in environment variables.")
    }
  }

  // Set the current key index to the available key
  currentKeyIndex = availableKeyIndex

  // Try the request with the current key
  try {
    console.log(`Trying request with API key ${currentKeyIndex + 1} (${retries} retries left)`)

    // Check if we have a valid API key at this index
    if (!API_KEYS[currentKeyIndex]) {
      console.error(`API key ${currentKeyIndex + 1} is not configured or invalid`)
      throw new Error(`API key ${currentKeyIndex + 1} is not configured or invalid`)
    }

    // Add the Authorization header with the current API key
    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${API_KEYS[currentKeyIndex]}`,
      },
    }

    const response = await fetch(url, {
      ...requestOptions,
      cache: "no-store", // Disable caching
    })

    // Handle 401 Unauthorized errors
    if (response.status === 401) {
      console.error(`API key ${currentKeyIndex + 1} is unauthorized (401)`)

      // Mark this key as unauthorized
      keyRateLimitStatus[currentKeyIndex] = {
        ...keyRateLimitStatus[currentKeyIndex],
        isUnauthorized: true,
        consecutiveFailures: keyRateLimitStatus[currentKeyIndex].consecutiveFailures + 1,
      }

      // Check if we have other non-unauthorized keys
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // We have another key available, retry immediately with that key
        const nextKeyIndex = nextAvailableKeyIndices[0]
        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after 401 Unauthorized`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      } else {
        throw new Error("All API keys are unauthorized. Please check your API keys in environment variables.")
      }
    }

    // If rate limited, mark this key as rate limited and try another key
    if (response.status === 429) {
      console.log(`API key ${currentKeyIndex + 1} hit rate limit`)

      // Get the Retry-After header or default to 60 seconds
      const retryAfter = Number.parseInt(response.headers.get("Retry-After") || "60", 10)
      const resetTime = now + retryAfter * 1000

      // Mark this key as rate limited
      keyRateLimitStatus[currentKeyIndex] = {
        ...keyRateLimitStatus[currentKeyIndex],
        isRateLimited: true,
        resetTime,
        consecutiveFailures: keyRateLimitStatus[currentKeyIndex].consecutiveFailures + 1,
      }

      // Check if we have other non-rate-limited keys
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // We have another key available, retry immediately with that key
        // Choose the key with the fewest consecutive failures
        const nextKeyIndex = nextAvailableKeyIndices.sort(
          (a, b) => keyRateLimitStatus[a].consecutiveFailures - keyRateLimitStatus[b].consecutiveFailures,
        )[0]

        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after rate limit`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      } else if (retries > 0) {
        // All keys are rate limited, wait and retry with exponential backoff
        const adjustedBackoff = Math.min(backoff * 1.5, 30000) // Cap at 30 seconds
        console.log(`All API keys are rate limited. Retrying in ${adjustedBackoff}ms... (${retries} retries left)`)
        await new Promise((resolve) => setTimeout(resolve, adjustedBackoff))
        return fetchWithKeyRotation(url, options, retries - 1, adjustedBackoff)
      } else {
        throw new Error(`API request failed with status 429 (Rate limit exceeded for all API keys)`)
      }
    }

    if (!response.ok) {
      // For other errors, increment consecutive failures but don't mark as rate limited
      keyRateLimitStatus[currentKeyIndex].consecutiveFailures += 1
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Success! Update the status for this key
    keyRateLimitStatus[currentKeyIndex] = {
      ...keyRateLimitStatus[currentKeyIndex],
      lastSuccess: Date.now(),
      consecutiveFailures: 0,
    }

    return await response.json()
  } catch (error) {
    // Handle 401 errors specifically
    if (error.message && error.message.includes("401") && retries > 0) {
      console.error(`API key ${currentKeyIndex + 1} failed with 401 Unauthorized`)

      // Mark this key as unauthorized
      keyRateLimitStatus[currentKeyIndex].isUnauthorized = true

      // Try to switch to another key if available
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        const nextKeyIndex = nextAvailableKeyIndices[0]
        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after 401 error`)
        return fetchWithKeyRotation(url, options, retries - 1, backoff)
      } else {
        throw new Error("All API keys are unauthorized. Please check your API keys in environment variables.")
      }
    }

    // Handle rate limit errors
    if (error.message && error.message.includes("429") && retries > 0) {
      // Try to switch to another key if available
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // Choose the key with the fewest consecutive failures
        const nextKeyIndex = nextAvailableKeyIndices.sort(
          (a, b) => keyRateLimitStatus[a].consecutiveFailures - keyRateLimitStatus[b].consecutiveFailures,
        )[0]

        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after error`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      }

      // Otherwise wait and retry with exponential backoff
      const adjustedBackoff = Math.min(backoff * 1.5, 30000) // Cap at 30 seconds
      console.log(`Rate limited, retrying in ${adjustedBackoff}ms... (${retries} retries left)`)
      await new Promise((resolve) => setTimeout(resolve, adjustedBackoff))
      return fetchWithKeyRotation(url, options, retries - 1, adjustedBackoff)
    }

    // For non-rate-limit errors, try a different key if available
    if (retries > 0) {
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        const nextKeyIndex = nextAvailableKeyIndices[0]
        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after general error`)
        return fetchWithKeyRotation(url, options, retries - 1, backoff)
      }
    }

    throw error
  }
}

// Simple in-memory cache implementation
const dataCache = new Map<string, { data: any; expiry: number }>()

async function getCachedData(key: string) {
  const cached = dataCache.get(key)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }
  return null
}

async function setCachedData(key: string, data: any, ttlSeconds: number) {
  dataCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  })
}

