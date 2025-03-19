import { NextResponse } from "next/server"
import { checkForNewProducts } from "@/actions/auto-scraper"

// This endpoint can be called by a cron job or external service
export async function GET(request: Request) {
  try {
    // Get the webhook URL from the query parameters
    const url = new URL(request.url)
    const webhookUrl = url.searchParams.get("webhookUrl")

    if (!webhookUrl) {
      return NextResponse.json({ success: false, message: "Missing webhookUrl parameter" }, { status: 400 })
    }

    // Check for new products and send notifications
    const result = await checkForNewProducts(webhookUrl)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in auto-scraper API route:", error)
    return NextResponse.json({ success: false, message: `Server error: ${error.message}` }, { status: 500 })
  }
}

