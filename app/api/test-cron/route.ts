import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // This is just a convenience endpoint for testing the cron job
    // It should only be used in development

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, message: "This endpoint is only available in development" },
        { status: 403 },
      )
    }

    // Get the secret from the query parameters
    const url = new URL(request.url)
    const secret = url.searchParams.get("secret")

    // Verify the secret matches the environment variable
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Call the cron endpoint
    const cronUrl = new URL("/api/cron/auto-scraper", request.url)
    cronUrl.searchParams.set("secret", process.env.CRON_SECRET || "")

    const response = await fetch(cronUrl.toString())
    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: "Cron job triggered manually",
      cronResponse: data,
    })
  } catch (error) {
    console.error("Error in test-cron endpoint:", error)
    return NextResponse.json({ success: false, message: `Server error: ${error.message}` }, { status: 500 })
  }
}

