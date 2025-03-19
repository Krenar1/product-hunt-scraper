import { NextResponse } from "next/server"
import { getScraperState, saveScraperState } from "@/actions/scraper-state"
import { checkForNewProducts, getSeenProductIds } from "@/actions/auto-scraper"

export async function GET(request: Request) {
  try {
    // Get the secret from the query parameters
    const url = new URL(request.url)
    const secret = url.searchParams.get("secret")

    // Verify the secret matches the environment variable
    if (secret !== process.env.CRON_SECRET) {
      console.error("Invalid cron secret provided")
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Get current scraper state
    const state = await getScraperState()

    // Check if scraper is enabled
    if (!state.isEnabled) {
      console.log("Scraper is disabled in settings")
      return NextResponse.json({ success: false, message: "Scraper is disabled in settings" }, { status: 200 })
    }

    // Check if webhook URL is configured
    if (!state.webhookUrl || !state.webhookUrl.includes("discord.com/api/webhooks")) {
      console.error("No valid webhook URL configured")
      return NextResponse.json(
        { success: false, message: "No valid webhook URL configured in settings" },
        { status: 400 },
      )
    }

    console.log("Running cron job for scraper state sync...")

    // Get the current seen product IDs from the auto-scraper
    const currentSeenProductIds = await getSeenProductIds()

    // Update the server state with these IDs
    await saveScraperState({
      seenProductIds: currentSeenProductIds,
      lastChecked: new Date().toISOString(),
    })

    // Run the scraper with the webhook URL
    const result = await checkForNewProducts(state.webhookUrl)

    console.log(`Cron job completed: ${result.success ? "Success" : "Failed"}`)
    console.log(`Found ${result.newProducts.length} new products`)

    // Update the state with the new results
    if (result.success && result.seenIds) {
      await saveScraperState({
        seenProductIds: result.seenIds,
        newProductsCount: state.newProductsCount + result.newProducts.length,
        lastChecked: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      newProductsCount: result.newProducts.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in cron job:", error)
    return NextResponse.json({ success: false, message: `Server error: ${error.message}` }, { status: 500 })
  }
}

