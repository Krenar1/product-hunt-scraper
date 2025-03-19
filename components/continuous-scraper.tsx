import { CardFooter } from "@/components/ui/card"
import { AlertDescription } from "@/components/ui/alert"
import { AlertTitle } from "@/components/ui/alert"
import { Alert } from "@/components/ui/alert"
;('"use client')

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle } from "lucide-react"

export function ContinuousScraper() {
  const { toast } = useToast()
  const [isEnabled, setIsEnabled] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    // Load settings from localStorage
    const savedWebhookUrl = localStorage.getItem("continuousWebhookUrl")
    const savedIsEnabled = localStorage.getItem("continuousIsEnabled") === "true"

    if (savedWebhookUrl) {
      setWebhookUrl(savedWebhookUrl)
    }
    setIsEnabled(savedIsEnabled)
  }, [])

  const handleToggle = () => {
    const newIsEnabled = !isEnabled
    setIsEnabled(newIsEnabled)

    // Save settings to localStorage
    localStorage.setItem("continuousIsEnabled", newIsEnabled.toString())

    if (newIsEnabled) {
      localStorage.setItem("continuousWebhookUrl", webhookUrl)
      toast({
        title: "Continuous Scraper Enabled",
        description: "The scraper will run continuously in the background",
      })
    } else {
      toast({
        title: "Continuous Scraper Disabled",
        description: "The scraper has been stopped",
      })
    }
  }

  const handleWebhookChange = (e) => {
    setWebhookUrl(e.target.value)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Continuous 24/7 Scraper</CardTitle>
        <CardDescription>
          Run the scraper continuously in the background to automatically collect new products
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhookUrl">Discord Webhook URL</Label>
          <Input
            id="webhookUrl"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={handleWebhookChange}
            type="url"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="enableScraper">Enable Continuous Scraper</Label>
          <Switch checked={isEnabled} onCheckedChange={handleToggle} id="enableScraper" />
        </div>
        {isEnabled && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Scraper Enabled</AlertTitle>
            <AlertDescription>
              The scraper is now running continuously. New products will be automatically posted to your Discord
              channel.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleToggle}>{isEnabled ? "Disable Scraper" : "Enable Scraper"}</Button>
      </CardFooter>
    </Card>
  )
}

