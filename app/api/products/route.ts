import { type NextRequest, NextResponse } from "next/server"
import { fetchProducts } from "@/actions/fetch-products"

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const daysBack = Number.parseInt(searchParams.get("days") || "7")
    const sortBy = searchParams.get("sort") || "newest"
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const cursor = searchParams.get("cursor") || undefined

    // Validate parameters
    if (isNaN(daysBack) || daysBack < 1 || daysBack > 30) {
      return NextResponse.json({ error: "Invalid days parameter. Must be between 1 and 30." }, { status: 400 })
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter. Must be between 1 and 100." }, { status: 400 })
    }

    if (sortBy !== "newest" && sortBy !== "popular") {
      return NextResponse.json({ error: 'Invalid sort parameter. Must be "newest" or "popular".' }, { status: 400 })
    }

    // Fetch products
    const data = await fetchProducts({ daysBack, sortBy: sortBy as "newest" | "popular", limit }, cursor)

    // Return the data
    return NextResponse.json(data)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

