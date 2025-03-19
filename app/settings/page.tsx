"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Zap, Infinity } from "lucide-react"
import { AutoScraperSettings } from "@/components/auto-scraper-settings"
import { ContinuousScraper } from "@/components/continuous-scraper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    maxProducts: 100,
    daysToLookBack: 7,
    enableAutoRefresh: false,
    exportFormat: "csv",
    includeContactInfo: true,
    maxContactPages: 3,
    extractEmails: true,
    extractTwitter: true,
    extractLinks: true,
  })
  const [showFormatAlert, setShowFormatAlert] = useState(false)
  const [activeTab, setActiveTab] = useState("continuous")

  // Load saved settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("productHuntScraperSettings")
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (error) {
        console.error("Error loading saved settings:", error)
      }
    }
  }, [])

  const handleSaveSettings = () => {
    // Save settings to localStorage
    localStorage.setItem("productHuntScraperSettings", JSON.stringify(settings))

    // Show success toast
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated and saved",
    })

    // If format was changed, show a message about refreshing
    if (showFormatAlert) {
      toast({
        title: "Format Change Applied",
        description: "Please refresh the page for the format change to take full effect",
        duration: 5000,
      })
    }
  }

  // Handle export format change with immediate feedback
  const handleExportFormatChange = (value) => {
    setSettings({ ...settings, exportFormat: value })
    setShowFormatAlert(true)

    // Update localStorage immediately for this critical setting
    const updatedSettings = { ...settings, exportFormat: value }
    localStorage.setItem("productHuntScraperSettings", JSON.stringify(updatedSettings))

    toast({
      title: "Format Changed",
      description: `Export format set to ${value.toUpperCase()}`,
      duration: 3000,
    })
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Configure your Product Hunt Scraper preferences</p>

      <div className="grid grid-cols-1 gap-6">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="continuous" className="flex items-center gap-1">
              <Infinity className="h-4 w-4" />
              Continuous 24/7 Scraper
            </TabsTrigger>
            <TabsTrigger value="auto" className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              Auto-Scraper
            </TabsTrigger>
            <TabsTrigger value="legacy">Legacy Auto-Scraper</TabsTrigger>
          </TabsList>

          <TabsContent value="continuous">
            <ContinuousScraper />
          </TabsContent>

          <TabsContent value="auto">
            <AutoScraperSettings key={`auto-scraper-settings-${Date.now()}`} />
          </TabsContent>

          <TabsContent value="legacy">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Legacy Auto-Scraper</CardTitle>
                <CardDescription>The original auto-scraper implementation (deprecated)</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Deprecated</AlertTitle>
                  <AlertDescription>
                    This version of the auto-scraper is deprecated. Please use the Continuous 24/7 Scraper for better
                    performance and reliability.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Data Collection</CardTitle>
              <CardDescription>Configure how data is collected from Product Hunt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxProducts">Maximum Products to Fetch</Label>
                  <span className="font-medium">{settings.maxProducts}</span>
                </div>
                <Slider
                  id="maxProducts"
                  aria-labelledby="maxProducts-label"
                  value={[settings.maxProducts]}
                  min={10}
                  max={500}
                  step={10}
                  onValueChange={(value) => setSettings({ ...settings, maxProducts: value[0] })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="daysToLookBack">Days to Look Back</Label>
                  <span className="font-medium">{settings.daysToLookBack} days</span>
                </div>
                <Slider
                  id="daysToLookBack"
                  aria-labelledby="daysToLookBack-label"
                  value={[settings.daysToLookBack]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={(value) => setSettings({ ...settings, daysToLookBack: value[0] })}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="autoRefresh">Auto-refresh Data</Label>
                  <p className="text-xs text-muted-foreground">Automatically refresh data every hour</p>
                </div>
                <Switch
                  id="autoRefresh"
                  checked={settings.enableAutoRefresh}
                  onCheckedChange={(checked) => setSettings({ ...settings, enableAutoRefresh: checked })}
                  aria-labelledby="autoRefresh-label"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings}>Save Data Settings</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Settings</CardTitle>
              <CardDescription>Configure how data is exported from the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg border border-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="exportFormat" className="text-base font-medium">
                        Export Format
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">Choose the file format for downloaded data</p>
                    </div>
                    <div className="bg-primary text-primary-foreground text-xs font-medium py-1 px-2 rounded">
                      {settings.exportFormat.toUpperCase()}
                    </div>
                  </div>
                  <Select
                    value={settings.exportFormat}
                    onValueChange={(value) => {
                      // Immediately update both state and localStorage
                      const updatedSettings = { ...settings, exportFormat: value }
                      setSettings(updatedSettings)
                      localStorage.setItem("productHuntScraperSettings", JSON.stringify(updatedSettings))
                      setShowFormatAlert(true)

                      toast({
                        title: "Format Changed",
                        description: `Export format set to ${value.toUpperCase()}. Changes applied immediately.`,
                        duration: 3000,
                      })
                    }}
                    defaultValue="csv"
                  >
                    <SelectTrigger id="exportFormat" className="w-full mt-2">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Comma Separated Values)</SelectItem>
                      <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                      <SelectItem value="json">JSON (JavaScript Object Notation)</SelectItem>
                    </SelectContent>
                  </Select>

                  {showFormatAlert && (
                    <Alert variant="warning" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Format Changed</AlertTitle>
                      <AlertDescription>
                        <p>The export format has been updated to {settings.exportFormat.toUpperCase()}.</p>
                        <p className="mt-1">This change is already active - no need to save settings.</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="includeContactInfo">Include Contact Information</Label>
                    <Switch
                      id="includeContactInfo"
                      checked={settings.includeContactInfo}
                      onCheckedChange={(checked) => setSettings({ ...settings, includeContactInfo: checked })}
                    />
                  </div>

                  {settings.includeContactInfo && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="maxContactPages">Max Contact Pages to Check</Label>
                        <div className="flex items-center justify-between">
                          <Slider
                            id="maxContactPages"
                            value={[settings.maxContactPages]}
                            min={1}
                            max={5}
                            step={1}
                            onValueChange={(value) => setSettings({ ...settings, maxContactPages: value[0] })}
                            className="w-[70%]"
                          />
                          <span className="font-medium">{settings.maxContactPages}</span>
                        </div>
                      </div>

                      <div className="space-y-2 bg-muted/30 p-4 rounded-lg border border-muted">
                        <Label className="text-base font-medium">Data to Extract</Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Select which types of contact information to extract
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                            <div>
                              <Label htmlFor="extractEmails" className="text-sm font-medium">
                                Emails
                              </Label>
                              <p className="text-xs text-muted-foreground">Extract email addresses from websites</p>
                            </div>
                            <Switch
                              id="extractEmails"
                              checked={settings.extractEmails}
                              onCheckedChange={(checked) => {
                                // Immediately update both state and localStorage
                                const updatedSettings = { ...settings, extractEmails: checked }
                                setSettings(updatedSettings)
                                localStorage.setItem("productHuntScraperSettings", JSON.stringify(updatedSettings))

                                toast({
                                  title: checked ? "Email Extraction Enabled" : "Email Extraction Disabled",
                                  description: "This setting has been applied immediately",
                                  duration: 2000,
                                })
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                            <div>
                              <Label htmlFor="extractTwitter" className="text-sm font-medium">
                                Twitter Handles
                              </Label>
                              <p className="text-xs text-muted-foreground">Extract Twitter usernames from websites</p>
                            </div>
                            <Switch
                              id="extractTwitter"
                              checked={settings.extractTwitter}
                              onCheckedChange={(checked) => {
                                // Immediately update both state and localStorage
                                const updatedSettings = { ...settings, extractTwitter: checked }
                                setSettings(updatedSettings)
                                localStorage.setItem("productHuntScraperSettings", JSON.stringify(updatedSettings))

                                toast({
                                  title: checked ? "Twitter Extraction Enabled" : "Twitter Extraction Disabled",
                                  description: "This setting has been applied immediately",
                                  duration: 2000,
                                })
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                            <div>
                              <Label htmlFor="extractLinks" className="text-sm font-medium">
                                External Links
                              </Label>
                              <p className="text-xs text-muted-foreground">Extract contact and social media links</p>
                            </div>
                            <Switch
                              id="extractLinks"
                              checked={settings.extractLinks}
                              onCheckedChange={(checked) => {
                                // Immediately update both state and localStorage
                                const updatedSettings = { ...settings, extractLinks: checked }
                                setSettings(updatedSettings)
                                localStorage.setItem("productHuntScraperSettings", JSON.stringify(updatedSettings))

                                toast({
                                  title: checked ? "Link Extraction Enabled" : "Link Extraction Disabled",
                                  description: "This setting has been applied immediately",
                                  duration: 2000,
                                })
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-primary font-medium">
                          All extraction settings are applied immediately and will affect your next data export.
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">Product Hunt API Key</Label>
                  <Input id="apiKey" type="password" placeholder="API Key is stored securely" disabled />
                  <p className="text-xs text-muted-foreground">API key is securely stored as an environment variable</p>
                  <div className="mt-1 text-xs text-primary">
                    {process.env.PH_TOKEN_2 && process.env.PH_TOKEN_3
                      ? "Triple API key rotation is enabled for increased reliability"
                      : process.env.PH_TOKEN_2 || process.env.PH_TOKEN_3
                        ? "Dual API key rotation is enabled"
                        : "Single API key mode"}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings} className="w-full">
                Save Export Settings
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  )
}

