import { NextResponse } from "next/server"
import { checkForNewProducts } from "@/actions/auto-scraper"

export async function GET(request: Request) {
  try {
    // Get the webhook URL from the query parameters
    const url = new URL(request.url)
    const webhookUrl = url.searchParams.get("webhookUrl")
    const skipNotifications = url.searchParams.get("skipNotifications") === "true"

    if (!webhookUrl) {
      return NextResponse.json({ success: false, message: "Missing webhookUrl parameter" }, { status: 400 })
    }

    console.log("Running test auto-scraper...")
    console.log(`Webhook URL: ${webhookUrl}`)
    console.log(`Skip notifications: ${skipNotifications}`)

    // Run the auto-scraper with focus on last 24 hours
    const result = await checkForNewProducts(skipNotifications ? "skip" : webhookUrl, true)

    // If we found new products, include detailed information about them
    let productDetails = []
    if (result.newProducts.length > 0) {
      productDetails = result.newProducts.map((product) => ({
        id: product.id,
        name: product.name,
        website: product.website || "N/A",
        exactWebsiteUrl: product.exactWebsiteUrl || product.website || "N/A",
        emails: product.emails || [],
        twitterHandles: product.twitterHandles || [],
        contactLinks: product.contactLinks || [],
        createdAt: product.createdAt,
      }))
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      newProductsCount: result.newProducts.length,
      productDetails: productDetails,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in test auto-scraper:", error)
    return NextResponse.json({ success: false, message: `Server error: ${error.message}` }, { status: 500 })
  }
}

