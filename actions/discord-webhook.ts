"use server"

import type { Product } from "@/types/product"

export async function sendDiscordNotification(product: Product, webhookUrl: string): Promise<boolean> {
  try {
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      console.error("Invalid Discord webhook URL")
      return false
    }

    // Format contact information for the embed
    const emails = product.emails && product.emails.length > 0 ? product.emails.join(", ") : "None found"

    const twitterHandles =
      product.twitterHandles && product.twitterHandles.length > 0 ? product.twitterHandles.join(", ") : "None found"

    const website = product.website || "No website"

    // Create a Discord embed for the product with contact information
    const embed = {
      title: product.name,
      description: product.tagline,
      url: product.url,
      color: 0xda552f, // Product Hunt orange
      timestamp: new Date(product.createdAt).toISOString(),
      thumbnail: {
        url: product.imageUrl || "https://ph-static.imgix.net/ph-logo-1.png",
      },
      fields: [
        {
          name: "Votes",
          value: product.votesCount.toString(),
          inline: true,
        },
        {
          name: "Website",
          value: website.startsWith("http") ? `[Visit Website](${website})` : website,
          inline: true,
        },
        {
          name: "Emails",
          value: emails,
          inline: false,
        },
        {
          name: "Twitter",
          value: twitterHandles,
          inline: false,
        },
        {
          name: "Makers",
          value:
            product.makers && product.makers.length > 0
              ? product.makers.map((maker) => maker.name).join(", ")
              : "Unknown",
          inline: false,
        },
      ],
      footer: {
        text: "Product Hunt Scraper",
        icon_url: "https://ph-static.imgix.net/ph-logo-1.png",
      },
    }

    // Add additional contact links if available
    if (product.contactLinks && product.contactLinks.length > 0) {
      embed.fields.push({
        name: "Contact Links",
        value: product.contactLinks.map((link) => `[Contact](${link})`).join(", "),
        inline: false,
      })
    }

    // Create the webhook payload
    const payload = {
      content: `🚀 **New Product Alert!** ${product.name}`,
      embeds: [embed],
      username: "Product Hunt Scraper",
      avatar_url: "https://ph-static.imgix.net/ph-logo-1.png",
    }

    // Send the webhook request
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    if (!response.ok) {
      console.error(`Discord webhook error: ${response.status} ${response.statusText}`)
      return false
    }

    console.log(`Successfully sent Discord notification for ${product.name}`)
    return true
  } catch (error) {
    console.error("Error sending Discord notification:", error)
    return false
  }
}

