import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check API keys on the server side
    const apiKeys = [process.env.PH_TOKEN, process.env.PH_TOKEN_2, process.env.PH_TOKEN_3].filter(Boolean)

    const keyCount = apiKeys.length

    let status = "Single API Key"
    if (keyCount === 2) {
      status = "Dual API Key Rotation"
    } else if (keyCount >= 3) {
      status = "Triple API Key Rotation"
    }

    return NextResponse.json({
      status,
      keyCount,
    })
  } catch (error) {
    console.error("Error checking API key status:", error)
    return NextResponse.json(
      {
        status: "API Key Error",
        keyCount: 0,
      },
      { status: 500 },
    )
  }
}

