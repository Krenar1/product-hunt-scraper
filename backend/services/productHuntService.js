const fetch = require("node-fetch")
const { logger } = require("../utils/logger")

// Handle API key rotation
const API_KEYS = [process.env.PH_TOKEN, process.env.PH_TOKEN_2, process.env.PH_TOKEN_3].filter(Boolean)

// Track rate limiting
const keyStatus = API_KEYS.map(() => ({
  isRateLimited: false,
  isUnauthorized: false,
  resetTime: 0,
  consecutiveFailures: 0,
  lastSuccess: Date.now(),
}))

// Current key index
let currentKeyIndex = 0

/**
 * Fetch products from Product Hunt GraphQL API
 */
exports.fetchProducts = async (filter = { daysBack: 7, sortBy: "newest", limit: 20 }, cursor) => {
  try {
    logger.info(`Fetching products with filter: ${JSON.stringify(filter)}, cursor: ${cursor || "none"}`)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - filter.daysBack)

    logger.info(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // GraphQL query
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

    // Variables for the query
    const variables = {
      postedAfter: startDate.toISOString(),
      postedBefore: endDate.toISOString(),
      first: Number.parseInt(String(filter.limit), 10),
      ...(cursor && { after: cursor }),
    }

    // Check if we have valid API keys
    if (API_KEYS.length === 0) {
      throw new Error(
        "No valid API keys configured. Please set PH_TOKEN, PH_TOKEN_2, or PH_TOKEN_3 in your environment variables.",
      )
    }

    // Make API request with key rotation for rate limiting
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
    })

    // Check if the response has the expected structure
    if (!data.data || !data.data.posts) {
      logger.error("Unexpected API response structure:", data)
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
    logger.info(`Found ${edges.length} products`)

    return data.data
  } catch (error) {
    logger.error(`Error fetching products: ${error.message}`)

    // Return empty response structure for specific errors
    if (
      error.message &&
      (error.message.includes("429") || error.message.includes("401") || error.message.includes("unauthorized"))
    ) {
      logger.warn(
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
      }
    }

    throw error
  }
}

/**
 * Fetch with API key rotation to handle rate limiting
 */
async function fetchWithKeyRotation(url, options, retries = 5, backoff = 1000) {
  // Try each API key until we get a successful response or exhaust all keys
  const now = Date.now()

  // First, check if any rate-limited keys have reset
  keyStatus.forEach((status, index) => {
    if (status.isRateLimited && now > status.resetTime) {
      logger.info(`API key ${index + 1} rate limit has reset, marking as available`)
      status.isRateLimited = false
      status.consecutiveFailures = 0
    }
  })

  // Find all available keys (not rate-limited and not unauthorized)
  const availableKeyIndices = keyStatus
    .map((status, index) => ({ status, index }))
    .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized)
    .map((item) => item.index)

  logger.info(`Available API keys: ${availableKeyIndices.length}/${API_KEYS.length}`)

  // If we have available keys, use the one that was successful most recently
  let availableKeyIndex = -1

  if (availableKeyIndices.length > 0) {
    // Sort by last success time (most recent first)
    availableKeyIndex = availableKeyIndices.sort((a, b) => keyStatus[b].lastSuccess - keyStatus[a].lastSuccess)[0]
    logger.info(`Selected API key ${availableKeyIndex + 1} based on recent success`)
  } else {
    // If all keys are rate limited or unauthorized, check if we have any rate-limited keys that will reset
    const rateLimitedKeys = keyStatus
      .map((status, index) => ({ status, index }))
      .filter((item) => item.status.isRateLimited && !item.status.isUnauthorized)

    if (rateLimitedKeys.length > 0) {
      // Find the one that will reset first
      availableKeyIndex = rateLimitedKeys.reduce(
        (minIndex, item) => (keyStatus[item.index].resetTime < keyStatus[minIndex].resetTime ? item.index : minIndex),
        rateLimitedKeys[0].index,
      )

      // If the earliest reset time is in the future, wait for it
      if (keyStatus[availableKeyIndex].resetTime > now) {
        const waitTime = keyStatus[availableKeyIndex].resetTime - now
        logger.info(`All API keys are rate limited. Waiting ${waitTime}ms for reset of key ${availableKeyIndex + 1}...`)

        // Wait for the key to reset
        await new Promise((resolve) => setTimeout(resolve, waitTime + 2000)) // Add 2 second buffer

        // Mark the key as available
        keyStatus[availableKeyIndex].isRateLimited = false
        keyStatus[availableKeyIndex].consecutiveFailures = 0
        logger.info(`Key ${availableKeyIndex + 1} should now be available after waiting`)
      }
    } else {
      // All keys are unauthorized or we have no valid keys
      logger.error("All API keys are unauthorized or invalid. Cannot proceed with request.")
      throw new Error("All API keys are unauthorized. Please check your API keys in environment variables.")
    }
  }

  // Set the current key index to the available key
  currentKeyIndex = availableKeyIndex

  // Try the request with the current key
  try {
    logger.info(`Trying request with API key ${currentKeyIndex + 1} (${retries} retries left)`)

    // Check if we have a valid API key at this index
    if (!API_KEYS[currentKeyIndex]) {
      logger.error(`API key ${currentKeyIndex + 1} is not configured or invalid`)
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

    const response = await fetch(url, requestOptions)

    // Handle 401 Unauthorized errors
    if (response.status === 401) {
      logger.error(`API key ${currentKeyIndex + 1} is unauthorized (401)`)

      // Mark this key as unauthorized
      keyStatus[currentKeyIndex] = {
        ...keyStatus[currentKeyIndex],
        isUnauthorized: true,
        consecutiveFailures: keyStatus[currentKeyIndex].consecutiveFailures + 1,
      }

      // Check if we have other non-unauthorized keys
      const nextAvailableKeyIndices = keyStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // We have another key available, retry immediately with that key
        const nextKeyIndex = nextAvailableKeyIndices[0]
        currentKeyIndex = nextKeyIndex
        logger.info(`Switching to API key ${currentKeyIndex + 1} after 401 Unauthorized`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      } else {
        throw new Error("All API keys are unauthorized. Please check your API keys in environment variables.")
      }
    }

    // If rate limited, mark this key as rate limited and try another key
    if (response.status === 429) {
      logger.warn(`API key ${currentKeyIndex + 1} hit rate limit`)

      // Get the Retry-After header or default to 60 seconds
      const retryAfter = Number.parseInt(response.headers.get("Retry-After") || "60", 10)
      const resetTime = now + retryAfter * 1000

      // Mark this key as rate limited
      keyStatus[currentKeyIndex] = {
        ...keyStatus[currentKeyIndex],
        isRateLimited: true,
        resetTime,
        consecutiveFailures: keyStatus[currentKeyIndex].consecutiveFailures + 1,
      }

      // Check if we have other non-rate-limited keys
      const nextAvailableKeyIndices = keyStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // We have another key available, retry immediately with that key
        // Choose the key with the fewest consecutive failures
        const nextKeyIndex = nextAvailableKeyIndices.sort(
          (a, b) => keyStatus[a].consecutiveFailures - keyStatus[b].consecutiveFailures,
        )[0]

        currentKeyIndex = nextKeyIndex
        logger.info(`Switching to API key ${currentKeyIndex + 1} after rate limit`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      } else if (retries > 0) {
        // All keys are rate limited, wait and retry with exponential backoff
        const adjustedBackoff = Math.min(backoff * 1.5, 30000) // Cap at 30 seconds
        logger.info(`All API keys are rate limited. Retrying in ${adjustedBackoff}ms... (${retries} retries left)`)
        await new Promise((resolve) => setTimeout(resolve, adjustedBackoff))
        return fetchWithKeyRotation(url, options, retries - 1, adjustedBackoff)
      } else {
        throw new Error(`API request failed with status 429 (Rate limit exceeded for all API keys)`)
      }
    }

    if (!response.ok) {
      // For other errors, increment consecutive failures but don't mark as rate limited
      keyStatus[currentKeyIndex].consecutiveFailures += 1
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Success! Update the status for this key
    keyStatus[currentKeyIndex] = {
      ...keyStatus[currentKeyIndex],
      lastSuccess: Date.now(),
      consecutiveFailures: 0,
    }

    return await response.json()
  } catch (error) {
    logger.error(`Error during API request: ${error.message}`)

    // Handle other errors
    if (retries > 0) {
      // Try to switch to another key if available
      const nextAvailableKeyIndices = keyStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && !item.status.isUnauthorized && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        const nextKeyIndex = nextAvailableKeyIndices[0]
        currentKeyIndex = nextKeyIndex
        logger.info(`Switching to API key ${currentKeyIndex + 1} after error`)
        return fetchWithKeyRotation(url, options, retries - 1, backoff)
      } else {
        // All keys have issues, use exponential backoff
        const adjustedBackoff = Math.min(backoff * 1.5, 30000)
        logger.info(`All API keys have issues. Retrying in ${adjustedBackoff}ms... (${retries} retries left)`)
        await new Promise((resolve) => setTimeout(resolve, adjustedBackoff))
        return fetchWithKeyRotation(url, options, retries - 1, adjustedBackoff)
      }
    }

    throw error
  }
}

