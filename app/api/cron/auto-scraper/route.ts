import { NextResponse } from "next/server"
import { checkForNewProducts } from "@/actions/auto-scraper"
import fs from "fs"
import path from "path"

// Define the path to our settings file
const settingsFilePath = path.join(process.cwd(), "settings.json")

// Helper function to read settings
function readSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error reading settings file:", error)
  }
  return { webhookUrl: "", autoScraperEnabled: false }
}

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

    // Read settings to get the webhook URL
    const settings = readSettings()
    const webhookUrl = settings.webhookUrl

    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      console.error("No valid webhook URL configured")
      return NextResponse.json(
        { success: false, message: "No valid webhook URL configured in settings" },
        { status: 400 },
      )
    }

    // Check if auto-scraper is enabled
    if (!settings.autoScraperEnabled) {
      console.log("Auto-scraper is disabled in settings")
      return NextResponse.json({ success: false, message: "Auto-scraper is disabled in settings" }, { status: 200 })
    }

    console.log("Running cron job for auto-scraper...")

    // Run the auto-scraper with focus on last 24 hours
    const result = await checkForNewProducts(webhookUrl, true) // Added parameter for 24h focus

    console.log(`Cron job completed: ${result.success ? "Success" : "Failed"}`)
    console.log(`Found ${result.newProducts.length} new products`)

    // If we found new products, log details about them
    if (result.newProducts.length > 0) {
      console.log("New products found:")
      result.newProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} (${product.id})`)
        console.log(`   Website: ${product.website || "N/A"}`)
        console.log(`   Emails: ${(product.emails || []).join(", ") || "None found"}`)
        console.log(`   Twitter: ${(product.twitterHandles || []).join(", ") || "None found"}`)
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

