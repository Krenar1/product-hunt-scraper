"use server"
import { fetchProducts } from "./fetch-products"

export async function exportProductsToCSV(daysBack = 7, limit = 100) {
  try {
    console.log(`Exporting products with daysBack=${daysBack}, limit=${limit}`)

    // Fetch products
    const data = await fetchProducts({
      daysBack,
      sortBy: "newest",
      limit: limit, // Ensure we're using the passed limit parameter
    })

    // Add debug logging
    console.log("Fetch products response:", JSON.stringify(data, null, 2).substring(0, 200) + "...")
    // After fetching data
    console.log(`Fetched ${data?.posts?.edges?.length || 0} products for export`)

    // Check if data exists and has the expected structure
    if (!data) {
      console.error("No data returned from fetchProducts")
      throw new Error("Failed to fetch products data")
    }

    if (!data.posts) {
      console.error("No posts property in data:", data)
      throw new Error("Invalid data structure: missing posts property")
    }

    if (!data.posts.edges || !Array.isArray(data.posts.edges)) {
      console.error("No edges array in data.posts:", data.posts)
      throw new Error("Invalid data structure: missing edges array")
    }

    if (data.posts.edges.length === 0) {
      console.log("No products found in the specified time range")
      // Instead of throwing an error, return an empty CSV with headers
      const headers = [
        "id",
        "name",
        "tagline",
        "description",
        "url",
        "website",
        "votesCount",
        "createdAt",
        "makers",
        "emails",
        "twitter_handles",
        "contact_links",
        "external_links",
      ]

      return headers.join(",") + "\n"
    }

    // Extract products from the response
    const products = data.posts.edges.map((edge) => edge.node)
    console.log(`Found ${products.length} products to export`)

    // Update the CSV headers to match the desired format
    const headers = [
      "id",
      "name",
      "tagline",
      "description",
      "url",
      "website_url",
      "votes_count",
      "launched_at",
      "emails",
      "twitter",
      "contact_links",
      "external_links",
    ]

    // Update the CSV rows to match the desired format
    const rows = products.map((product) => [
      product.id,
      `"${product.name.replace(/"/g, '""')}"`,
      `"${product.tagline.replace(/"/g, '""')}"`,
      `"${(product.description || "").replace(/"/g, '""')}"`,
      product.url,
      product.website || "",
      product.votesCount,
      product.createdAt,
      (product.emails || []).join(", "),
      (product.twitterHandles || []).join(", "),
      (product.contactLinks || []).join(", "),
      (product.externalLinks || []).join(", "),
    ])

    // Combine header and rows
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
    console.log(`Generated CSV with ${rows.length} rows`)

    return csvContent
  } catch (error) {
    console.error("Error exporting products to CSV:", error)
    throw error
  }
}

