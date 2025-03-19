// Import the modified contact extraction logic
const cheerio = require("cheerio")
const fetch = require("node-fetch")
const { logger } = require("../utils/logger")

// Migrate the contact extraction logic from your existing actions/extract-contacts.ts

// User agent strings to rotate through
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0   x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
]

// List of domains to bypass
const BYPASS_DOMAINS = [
  "facebook.com",
  "fb.com",
  "apple.com",
  "google.com",
  "microsoft.com",
  "amazon.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "github.com",
  "netflix.com",
  "spotify.com",
  "adobe.com",
  "salesforce.com",
  "oracle.com",
  "ibm.com",
  "intel.com",
  "cisco.com",
  "samsung.com",
  "meta.com",
  "alphabet.com",
  "openai.com",
  "anthropic.com",
  "gemini.com",
  "bard.google.com",
]

// Get a random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Check if a domain should be bypassed
function shouldBypassDomain(url) {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.toLowerCase()
    return BYPASS_DOMAINS.some((bypassDomain) => domain === bypassDomain || domain.endsWith(`.${bypassDomain}`))
  } catch (error) {
    logger.error(`Error parsing URL ${url}: ${error.message}`)
    return false
  }
}

// Check if a URL is a Product Hunt redirect URL
function isProductHuntRedirectUrl(url) {
  return url.includes("producthunt.com/r/") || url.includes("ph.co/")
}

// Enhanced URL validation
function isValidUrl(urlString) {
  if (!urlString || typeof urlString !== "string" || urlString.trim() === "") {
    return false
  }

  try {
    const url = new URL(urlString)
    // Check for valid protocol
    return url.protocol === "http:" || url.protocol === "https:"
  } catch (error) {
    return false
  }
}

// Normalize URL to ensure consistency
function normalizeUrl(url) {
  if (!url) return ""

  try {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    // Parse the URL
    const urlObj = new URL(url)

    // Remove trailing slash
    let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, "")

    // Keep query parameters for certain URLs where they're important
    if (urlObj.search && (url.includes("product") || url.includes("item") || url.includes("page"))) {
      normalized += urlObj.search
    }

    return normalized
  } catch (e) {
    return url
  }
}

// Add a timeout function to prevent hanging requests
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController()
  const { signal } = controller

  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      controller.abort()
      reject(new Error(`Request timed out after ${timeout}ms`))
    }, timeout)
  })

  return Promise.race([fetch(url, { ...options, signal }), timeoutPromise])
}

// Extract real URL from Product Hunt redirect URL
async function extractUrlFromProductHuntPage(url) {
  try {
    logger.info(`Fetching Product Hunt page to extract website URL: ${url}`)

    // Fetch the Product Hunt page
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html",
      },
      timeout: 8000, // 8 second timeout
    })

    if (!response.ok) {
      logger.warn(`Failed to fetch Product Hunt page: ${url}`)
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Look for the website URL in meta tags
    let websiteUrl = null

    // First, try to find the canonical URL
    const canonicalLink = $('link[rel="canonical"]').attr("href")
    if (canonicalLink && !canonicalLink.includes("producthunt.com")) {
      websiteUrl = canonicalLink
    }

    // If not found, try meta tags
    if (!websiteUrl) {
      $("meta").each((_, element) => {
        const property = $(element).attr("property") || $(element).attr("name")
        if (property === "og:url" || property === "twitter:url") {
          const content = $(element).attr("content")
          if (content && !content.includes("producthunt.com")) {
            websiteUrl = content
          }
        }
      })
    }

    // If not found in meta tags, look for links with rel="nofollow" that point outside Product Hunt
    if (!websiteUrl) {
      $('a[rel="nofollow"]').each((_, element) => {
        const href = $(element).attr("href")
        if (href && !href.includes("producthunt.com") && href.startsWith("http")) {
          websiteUrl = href
          return false // break the loop
        }
      })
    }

    // Look specifically for the "Visit" or "Website" button
    if (!websiteUrl) {
      $("a").each((_, element) => {
        const text = $(element).text().toLowerCase()
        const href = $(element).attr("href")

        if (
          href &&
          !href.includes("producthunt.com") &&
          href.startsWith("http") &&
          (text.includes("visit") || text.includes("website") || text.includes("home"))
        ) {
          websiteUrl = href
          return false // break the loop
        }
      })
    }

    // If we found a website URL, return it
    if (websiteUrl) {
      logger.info(`Found website URL from Product Hunt page: ${websiteUrl}`)
      return normalizeUrl(websiteUrl)
    }

    logger.warn(`Could not find website URL in Product Hunt page: ${url}`)
    return null
  } catch (error) {
    logger.error(`Error extracting website URL from Product Hunt page: ${url}`, error)
    return null
  }
}

// Enhance the resolveProductHuntRedirect function to better handle redirects
async function resolveProductHuntRedirect(url) {
  if (!isValidUrl(url)) {
    logger.error(`Cannot resolve redirect: Invalid URL: ${url}`)
    return null
  }

  try {
    logger.info(`Resolving Product Hunt redirect: ${url}`)

    // First, try to extract from the URL itself
    try {
      const urlObj = new URL(url)
      // Check for 'url' parameter in the query string
      const urlParam = urlObj.searchParams.get("url")
      if (urlParam && isValidUrl(urlParam)) {
        logger.info(`Found URL in query parameter: ${urlParam}`)
        return normalizeUrl(urlParam)
      }
    } catch (error) {
      logger.error(`Error parsing URL: ${url}`, error)
    }

    // If that fails, try to follow the redirect manually
    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            "User-Agent": getRandomUserAgent(),
            Accept: "text/html",
          },
          redirect: "manual", // Don't automatically follow redirects
        },
        5000, // 5 second timeout
      )

      // Check if we got a redirect
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("location")
        if (redirectUrl) {
          logger.info(`Found redirect to: ${redirectUrl}`)
          return normalizeUrl(redirectUrl)
        }
      }
    } catch (error) {
      logger.error(`Error following redirect for ${url}: ${error.message}`)
    }

    // If that fails, try to extract from the Product Hunt page
    const extractedUrl = await extractUrlFromProductHuntPage(url)
    return extractedUrl ? normalizeUrl(extractedUrl) : null
  } catch (error) {
    logger.error(`Error resolving Product Hunt redirect: ${url}`, error)
    return null
  }
}

// Find the canonical URL
async function findCanonicalUrl(url) {
  try {
    logger.info(`Finding canonical URL for: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html",
        },
        redirect: "follow", // Follow redirects
      },
      8000,
    ).catch((error) => {
      logger.error(`Error fetching ${url} for canonical URL: ${error.message}`)
      return null
    })

    if (!response || !response.ok) {
      logger.warn(`Failed to fetch ${url} for canonical URL check`)
      return url // Return original URL if we can't fetch
    }

    // Get the final URL after redirects - this is the real URL
    const finalUrl = response.url

    // Get the HTML to check for canonical link
    const html = await response.text().catch((error) => {
      logger.error(`Error getting text from ${url}: ${error.message}`)
      return ""
    })

    if (!html) {
      return finalUrl // Return the final URL after redirects
    }

    // Parse the HTML to look for canonical link
    const $ = cheerio.load(html)
    const canonicalLink = $('link[rel="canonical"]').attr("href")

    if (canonicalLink && isValidUrl(canonicalLink)) {
      logger.info(`Found canonical URL: ${canonicalLink}`)
      return normalizeUrl(canonicalLink)
    }

    // If no canonical link, return the final URL after redirects
    return normalizeUrl(finalUrl)
  } catch (error) {
    logger.error(`Error finding canonical URL for ${url}: ${error.message}`)
    return url // Return original URL on error
  }
}

// Extract emails from text
function extractEmails(text) {
  // More aggressive email regex that catches more patterns while still being RFC compliant
  const emailPattern =
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi

  // Also try a simpler pattern to catch more emails that might be missed
  const simpleEmailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

  // Extract all potential emails using both patterns
  const strictEmails = text.match(emailPattern) || []
  const simpleEmails = text.match(simpleEmailPattern) || []

  // Combine and deduplicate
  const allEmails = [...new Set([...strictEmails, ...simpleEmails])]

  // Filter out common false positives and add more patterns to exclude
  return allEmails.filter((email) => {
    // Convert to lowercase for comparison
    const lowerEmail = email.toLowerCase()

    // Check domain part
    const domainPart = lowerEmail.split("@")[1]

    // Minimum requirements for a valid email
    if (!domainPart || domainPart.length < 4 || !domainPart.includes(".")) {
      return false
    }

    // Filter out common placeholder and example emails
    const invalidDomains = [
      "example.com",
      "domain.com",
      "yourdomain.com",
      "email.com",
      "yourcompany.com",
      "company.com",
      "acme.com",
      "test.com",
      "sample.com",
      "website.com",
      "mail.com",
      "gmail.example",
      "example.org",
      "example.net",
      "localhost",
      "test.local",
      "demo.com",
      "placeholder.com",
      "yoursite.com",
      "site.com",
      "user.com",
      "username.com",
      "mydomain.com",
      "mysite.com",
      "mycompany.com",
      "myemail.com",
      "emailaddress.com",
      "mailaddress.com",
      "mailbox.com",
      "mailme.com",
      "emailme.com",
      "contactme.com",
      "contactus.com",
    ]

    // Check if the domain is in our blacklist
    if (invalidDomains.some((domain) => domainPart.includes(domain))) {
      return false
    }

    // Filter out common placeholder usernames
    const userPart = lowerEmail.split("@")[0]
    const invalidUsernames = [
      "name",
      "user",
      "username",
      "email",
      "your",
      "info@example",
      "john.doe",
      "jane.doe",
      "admin",
      "test",
      "example",
      "hello",
      "contact@example",
      "support@example",
      "noreply",
      "no-reply",
      "donotreply",
      "do-not-reply",
      "webmaster",
      "postmaster",
      "hostmaster",
      "sales",
      "marketing",
      "billing",
      "help",
      "service",
      "feedback",
      "enquiry",
      "inquiry",
      "info",
      "support",
      "contact",
      "admin",
    ]

    // Check if the username is in our blacklist
    if (invalidUsernames.some((name) => userPart === name)) {
      return false
    }

    return true
  })
}

// Extract social media information
function extractSocialMedia($) {
  const socialMedia = {
    twitter: [],
    facebook: [],
    instagram: [],
    linkedin: [],
  }

  try {
    // First, look specifically for Twitter handles in text content
    $("body")
      .find("*")
      .each((_, element) => {
        try {
          const text = $(element).text()

          // Look for Twitter handles in text (starting with @ followed by alphanumeric chars)
          const twitterHandleRegex = /(?:^|\s)(@[A-Za-z0-9_]{1,15})(?:\s|$)/g
          let match
          while ((match = twitterHandleRegex.exec(text)) !== null) {
            if (match[1] && match[1].length > 1) {
              socialMedia.twitter.push(match[1])
            }
          }
        } catch (error) {
          // Skip this element and continue
        }
      })

    // Look for social media links
    $(
      "a[href*='twitter.com'], a[href*='x.com'], a[href*='t.co'], a[href*='facebook.com'], a[href*='fb.com'], a[href*='instagram.com'], a[href*='linkedin.com']",
    ).each((_, element) => {
      try {
        const href = $(element).attr("href") || ""

        // Only process if we have a valid href
        if (!href || href === "#" || href === "/" || href.startsWith("javascript:")) {
          return
        }

        // Check for Twitter
        if (href.includes("twitter.com/") || href.includes("x.com/") || href.includes("t.co/")) {
          // Extract handle from URL
          try {
            const url = new URL(href.startsWith("http") ? href : `https:${href}`)
            const pathParts = url.pathname.split("/").filter(Boolean)

            // Validate the path has a username component
            if (pathParts.length > 0) {
              const handle = pathParts[0]

              // Skip known non-username paths
              if (
                ["share", "intent", "home", "hashtag", "compose", "search", "explore"].includes(handle.toLowerCase())
              ) {
                return
              }

              // Add @ if it's missing
              const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`

              if (formattedHandle.length > 1 && formattedHandle.length <= 16) {
                // Twitter handles are max 15 chars + @
                socialMedia.twitter.push(formattedHandle)
              }
            }
          } catch (e) {
            // If URL parsing fails, try regex extraction
            const twitterHandleRegex = /twitter\.com\/([A-Za-z0-9_]+)/i
            const match = href.match(twitterHandleRegex)
            if (match && match[1]) {
              const handle = `@${match[1]}`
              if (handle.length <= 16) {
                // Twitter handles are max 15 chars + @
                socialMedia.twitter.push(handle)
              }
            }
          }
        }

        // Check for Facebook
        if (href.includes("facebook.com/") || href.includes("fb.com/")) {
          socialMedia.facebook.push(href)
        }

        // Check for Instagram
        if (href.includes("instagram.com/")) {
          socialMedia.instagram.push(href)
        }

        // Check for LinkedIn
        if (href.includes("linkedin.com/")) {
          socialMedia.linkedin.push(href)
        }
      } catch (error) {
        // Skip this element and continue
      }
    })
  } catch (error) {
    logger.error(`Error extracting social media: ${error.message}`)
  }

  // Remove duplicates
  return {
    twitter: [...new Set(socialMedia.twitter)],
    facebook: [...new Set(socialMedia.facebook)],
    instagram: [...new Set(socialMedia.instagram)],
    linkedin: [...new Set(socialMedia.linkedin)],
  }
}

// Scrape a website for contact information
async function scrapeWebsite(url) {
  // Default empty response
  const emptyResult = {
    emails: [],
    socialMedia: {
      twitter: [],
      facebook: [],
      instagram: [],
      linkedin: [],
    },
    contactUrl: null,
    aboutUrl: null,
    exactWebsiteUrl: url,
    externalLinks: [],
  }

  // Validate URL before proceeding
  if (!url || typeof url !== "string" || url.trim() === "") {
    logger.error(`Invalid URL provided: "${url}"`)
    return emptyResult
  }

  // Make sure URL has a protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }

  // Validate URL format
  if (!isValidUrl(url)) {
    logger.error(`Invalid URL format: ${url}`)
    return emptyResult
  }

  // Check if this is a Product Hunt redirect URL and resolve it
  if (isProductHuntRedirectUrl(url)) {
    logger.info(`Detected Product Hunt redirect URL: ${url}`)
    const resolvedUrl = await resolveProductHuntRedirect(url)
    if (resolvedUrl) {
      logger.info(`Resolved to actual URL: ${resolvedUrl}`)
      url = resolvedUrl
    } else {
      logger.warn(`Could not resolve Product Hunt redirect URL: ${url}`)
    }
  }

  // Check if this is a major tech company domain we should bypass
  if (shouldBypassDomain(url)) {
    logger.info(`Bypassing scraping for major tech domain: ${url}`)
    return emptyResult
  }

  try {
    // First, try to get the canonical URL - this is the exact website URL
    const exactWebsiteUrl = await findCanonicalUrl(url)
    logger.info(`Canonical/Exact URL: ${exactWebsiteUrl}`)

    logger.info(`Checking main page: ${url}`)

    // Use a longer timeout for the main page fetch
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html",
        },
      },
      15000, // 15 second timeout for main page
    ).catch((error) => {
      logger.error(`Fetch error for ${url}: ${error.message}`)
      return null // Return null instead of throwing
    })

    if (!response || !response.ok) {
      logger.warn(`Failed to fetch ${url}: ${response ? `Status ${response.status}` : "Request failed"}`)
      return { ...emptyResult, exactWebsiteUrl }
    }

    // Use text() with a timeout to prevent hanging on large responses
    const html = await response.text().catch((error) => {
      logger.error(`Error extracting text from ${url}: ${error.message}`)
      return "" // Return empty string on error
    })

    if (!html) {
      return { ...emptyResult, exactWebsiteUrl }
    }

    logger.info(`Successfully fetched ${url}, HTML length: ${html.length}`)

    // Parse the HTML
    const $ = cheerio.load(html)

    // Extract emails from HTML
    const emails = extractEmails(html)

    // Extract social media links
    const socialMedia = extractSocialMedia($)

    // Extract contact and about page URLs
    const contactLinks = []
    const aboutLinks = []

    $("a").each((_, element) => {
      try {
        const href = $(element).attr("href") || ""
        const text = $(element).text().toLowerCase()

        if (!href || href === "#" || href.startsWith("javascript:")) {
          return
        }

        // Normalize href to absolute URL
        let fullHref = href
        if (!href.startsWith("http")) {
          if (href.startsWith("/")) {
            try {
              const baseUrl = new URL(url)
              fullHref = `${baseUrl.protocol}//${baseUrl.host}${href}`
            } catch (e) {
              return // Skip if we can't parse
            }
          } else {
            const baseUrl = url.endsWith("/") ? url : `${url}/`
            fullHref = `${baseUrl}${href}`
          }
        }

        // Check for contact pages
        if (
          text.includes("contact") ||
          href.includes("contact") ||
          text.includes("get in touch") ||
          text.includes("reach out")
        ) {
          contactLinks.push(fullHref)
        }

        // Check for about pages
        if (text.includes("about") || href.includes("about") || text.includes("team") || href.includes("team")) {
          aboutLinks.push(fullHref)
        }
      } catch (error) {
        // Skip this element and continue
      }
    })

    // Extract all external links
    const externalLinks = []
    try {
      const baseUrl = new URL(url).hostname

      $("a[href^='http']").each((_, element) => {
        const href = $(element).attr("href")
        if (href && !href.includes(baseUrl)) {
          externalLinks.push(href)
        }
      })
    } catch (error) {
      logger.error(`Error extracting external links: ${error.message}`)
    }

    const result = {
      emails,
      socialMedia,
      contactUrl: contactLinks.length > 0 ? contactLinks[0] : null,
      aboutUrl: aboutLinks.length > 0 ? aboutLinks[0] : null,
      exactWebsiteUrl,
      externalLinks: [...new Set(externalLinks.slice(0, 10))], // Limit to 10 unique external links
    }

    return result
  } catch (error) {
    logger.error(`Error scraping ${url}: ${error.message}`)
    return emptyResult
  }
}

// Process products in batches
async function processBatches(products, concurrentLimit = 3, delayBetween = 1000) {
  if (!Array.isArray(products)) {
    logger.error("processBatches: Input is not an array")
    return []
  }

  logger.info(`Processing ${products.length} products in batches with concurrency limit ${concurrentLimit}`)

  const results = []
  const queue = [...products]

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrentLimit)
    logger.info(`Processing batch of ${batch.length} products`)

    const batchPromises = batch.map((product) => {
      return new Promise(async (resolve) => {
        try {
          if (!product.website) {
            logger.warn(`Skipping product ${product.id} due to missing website URL`)
            resolve({ ...product, contactInfo: { emails: [], socialMedia: {} } })
            return
          }

          const contactInfo = await scrapeWebsite(product.website)

          // Add the contact info to the product
          const enhancedProduct = {
            ...product,
            emails: contactInfo.emails || [],
            twitterHandles: contactInfo.socialMedia?.twitter || [],
            facebookLinks: contactInfo.socialMedia?.facebook || [],
            instagramLinks: contactInfo.socialMedia?.instagram || [],
            linkedinLinks: contactInfo.socialMedia?.linkedin || [],
            contactLinks: contactInfo.contactUrl ? [contactInfo.contactUrl] : [],
            aboutLinks: contactInfo.aboutUrl ? [contactInfo.aboutUrl] : [],
            externalLinks: contactInfo.externalLinks || [],
            exactWebsiteUrl: contactInfo.exactWebsiteUrl,
          }

          resolve(enhancedProduct)
        } catch (error) {
          logger.error(`Error processing product ${product.id}: ${error.message}`)
          resolve(product) // Return original product on error
        }
      })
    })

    // Wait for all promises in batch to resolve
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Delay between batches if more to process
    if (queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBetween))
    }
  }

  logger.info(`Completed processing ${results.length} products`)
  return results
}

// Extract contact information
async function extractContactInfo(products, maxToProcess = 10) {
  if (!Array.isArray(products)) {
    logger.error("extractContactInfo: Input is not an array")
    return []
  }

  logger.info(`Extracting contact info for ${maxToProcess} products out of ${products.length}`)

  const results = []
  let processedCount = 0

  for (const product of products) {
    if (processedCount >= maxToProcess) {
      logger.info(`Reached maximum products to process (${maxToProcess}), stopping.`)
      break
    }

    try {
      if (!product.website) {
        logger.warn(`Skipping product ${product.id} due to missing website URL`)
        results.push({ ...product, contactInfo: { emails: [], socialMedia: {} } })
        continue
      }

      const contactInfo = await scrapeWebsite(product.website)

      // Add the contact info to the product
      const enhancedProduct = {
        ...product,
        emails: contactInfo.emails || [],
        twitterHandles: contactInfo.socialMedia?.twitter || [],
        facebookLinks: contactInfo.socialMedia?.facebook || [],
        instagramLinks: contactInfo.socialMedia?.instagram || [],
        linkedinLinks: contactInfo.socialMedia?.linkedin || [],
        contactLinks: contactInfo.contactUrl ? [contactInfo.contactUrl] : [],
        aboutLinks: contactInfo.aboutUrl ? [contactInfo.aboutUrl] : [],
        externalLinks: contactInfo.externalLinks || [],
        exactWebsiteUrl: contactInfo.exactWebsiteUrl,
      }

      results.push(enhancedProduct)
    } catch (error) {
      logger.error(`Error processing product ${product.id}: ${error.message}`)
      results.push(product) // Return original product on error
    }

    processedCount++
  }

  logger.info(`Completed contact extraction for ${results.length} products`)
  return results
}

module.exports = {
  scrapeWebsite,
  processBatches,
  extractContactInfo,
}

