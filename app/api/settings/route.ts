import { NextResponse } from "next/server"
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

// Helper function to write settings
function writeSettings(settings: any) {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), "utf8")
    return true
  } catch (error) {
    console.error("Error writing settings file:", error)
    return false
  }
}

// GET endpoint to retrieve settings
export async function GET() {
  const settings = readSettings()
  return NextResponse.json(settings)
}

// POST endpoint to save settings
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate the data
    if (typeof data.webhookUrl !== "string") {
      return NextResponse.json({ success: false, message: "Invalid webhook URL" }, { status: 400 })
    }

    // Get existing settings and update them
    const currentSettings = readSettings()
    const newSettings = {
      ...currentSettings,
      ...data,
    }

    const success = writeSettings(newSettings)

    if (success) {
      return NextResponse.json({ success: true, settings: newSettings })
    } else {
      return NextResponse.json({ success: false, message: "Failed to save settings" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error saving settings:", error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

