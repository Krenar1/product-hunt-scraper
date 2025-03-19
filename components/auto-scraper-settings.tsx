"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import {
  checkForNewProducts,
  loadSeenProductIds,
  getSeenProductIds,
  initializeWithTodayOnly,
} from "@/actions/auto-scraper"
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  BellRing,
  KeyRound,
  Save,
  Database,
  Download,
  Calendar,
  CalendarDays,
  Cloud,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Product } from "@/types/product"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { initializeWithTimeRange } from "@/actions/auto-scraper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Update the import at the top of the file to use the correct path
import { fetchProducts } from "@/actions/fetch-products"

// Storage keys
const STORAGE_KEYS = {
  WEBHOOK_URL: "discordWebhookUrl",
  AUTO_SCRAPER_ENABLED: "autoScraperEnabled",
  SEEN_PRODUCT_IDS: "seenProductIds",
  LAST_SYNC_TIME: "lastSyncTime",
  SCRAPED_PRODUCTS: "scrapedProducts",
  INIT_MODE: "autoScraperInitMode",
}

export function AutoScraperSettings() {
  const { toast } = useToast()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isEnabled, setIsEnabled] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [newProductsCount, setNewProductsCount] = useState(0)
  const [status, setStatus] = useState<"idle" | "success" | "error" | "warning">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [initProgress, setInitProgress] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "last7days" | "all">("all")
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "excel">("csv")
  const [totalScrapedCount, setTotalScrapedCount] = useState(0)
  const [todayScrapedCount, setTodayScrapedCount] = useState(0)
  const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isTimeRangeDialogOpen, setIsTimeRangeDialogOpen] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<"7" | "30" | "365">("7")
  const [isInitializingTimeRange, setIsInitializingTimeRange] = useState(false)
  const [timeRangeProgress, setTimeRangeProgress] = useState(0)
  const [initMode, setInitMode] = useState<"today" | "week">("week")
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [apiKeyStatus, setApiKeyStatus] = useState("API Key Rotation")

  // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoadingSettings(true)

        // First try to load from server
        console.log("Attempting to load settings from server...")
        const response = await fetch("/api/settings")

        if (response.ok) {
          const serverSettings = await response.json()
          console.log("Loaded settings from server:", serverSettings)

          if (serverSettings.webhookUrl) {
            setWebhookUrl(serverSettings.webhookUrl)
          }

          if (typeof serverSettings.autoScraperEnabled === "boolean") {
            setIsEnabled(serverSettings.autoScraperEnabled)
          }

          // Load initialization mode
          if (serverSettings.initMode) {
            setInitMode(serverSettings.initMode as "today" | "week")
          } else {
            // Fall back to localStorage
            const savedInitMode = localStorage.getItem(STORAGE_KEYS.INIT_MODE) as "today" | "week" | null
            if (savedInitMode) {
              setInitMode(savedInitMode)
            }
          }

          // Also save to localStorage as fallback
          localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, serverSettings.webhookUrl || "")
          localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, serverSettings.autoScraperEnabled ? "true" : "false")
          localStorage.setItem(STORAGE_KEYS.INIT_MODE, serverSettings.initMode || initMode)

          console.log("Server settings loaded and saved to localStorage")
        } else {
          console.log("Failed to load settings from server, falling back to localStorage")

          // Fall back to localStorage
          const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || ""
          const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"

          setWebhookUrl(savedWebhookUrl)
          setIsEnabled(savedIsEnabled)

          // Save localStorage settings to server for future use
          saveSettingsToServer(savedWebhookUrl, savedIsEnabled)
        }

        // Load seen product IDs from localStorage
        const savedProductIds = localStorage.getItem(STORAGE_KEYS.SEEN_PRODUCT_IDS)
        let productIds: string[] = []

        if (savedProductIds) {
          try {
            productIds = JSON.parse(savedProductIds)
            console.log(`Loaded ${productIds.length} product IDs from localStorage`)

            // Update the server-side set with the IDs from localStorage
            await loadSeenProductIds(productIds)

            // Set last sync time
            const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME)
            if (lastSync) {
              setLastSyncTime(lastSync)
            }
          } catch (parseError) {
            console.error("Error parsing saved product IDs:", parseError)
          }
        }

        // Load scraped products from localStorage
        const savedProducts = localStorage.getItem(STORAGE_KEYS.SCRAPED_PRODUCTS)
        if (savedProducts) {
          try {
            const products = JSON.parse(savedProducts) as Product[]
            setScrapedProducts(products)
            updateProductCounters(products)
            console.log(`Loaded ${products.length} scraped products from localStorage`)
          } catch (parseError) {
            console.error("Error parsing saved products:", parseError)
          }
        }

        // No need to start client-side intervals for cron-based approach
        // Just load the settings
        const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || ""
        const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"

        // If enabled, show the appropriate status
        if (savedIsEnabled) {
          setStatus("success")
          setStatusMessage("Auto-scraper is enabled. Cron job will run every 10 minutes to check for new products.")
        }
      } catch (error) {
        console.error("Error loading settings:", error)

        // Fall back to localStorage as a last resort
        const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || ""
        const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"

        setWebhookUrl(savedWebhookUrl)
        setIsEnabled(savedIsEnabled)

        if (savedIsEnabled && savedWebhookUrl) {
          //startAutoScraper(savedWebhookUrl)
        }
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadSettings()

    return () => {
      // Clean up intervals on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  // Fetch API key status from the server
  useEffect(() => {
    const fetchApiKeyStatus = async () => {
      try {
        const response = await fetch("/api/key-status")
        if (response.ok) {
          const data = await response.json()
          setApiKeyStatus(data.status)
        }
      } catch (error) {
        console.error("Error fetching API key status:", error)
      }
    }

    fetchApiKeyStatus()
  }, [])

  // Function to save settings to the server
  const saveSettingsToServer = async (url: string, enabled: boolean, mode: "today" | "week" = initMode) => {
    try {
      setIsSavingSettings(true)
      console.log("Saving settings to server:", { webhookUrl: url, autoScraperEnabled: enabled, initMode: mode })

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl: url,
          autoScraperEnabled: enabled,
          initMode: mode,
        }),
      })

      if (response.ok) {
        console.log("Settings saved to server successfully")
        return true
      } else {
        console.error("Failed to save settings to server:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error saving settings to server:", error)
      return false
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Update product counters
  const updateProductCounters = (products: Product[]) => {
    setTotalScrapedCount(products.length)

    // Count products from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayProducts = products.filter((product) => {
      const productDate = new Date(product.createdAt)
      return productDate >= today
    })

    setTodayScrapedCount(todayProducts.length)
  }

  // Function to sync seen product IDs between server and localStorage
  const syncSeenProductIds = async () => {
    try {
      setIsSyncing(true)

      // Get the current list of seen product IDs from the server
      const serverIds = await getSeenProductIds()

      // Get the saved IDs from localStorage
      const savedIdsString = localStorage.getItem(STORAGE_KEYS.SEEN_PRODUCT_IDS)
      let savedIds: string[] = []

      if (savedIdsString) {
        try {
          savedIds = JSON.parse(savedIdsString)
        } catch (parseError) {
          console.error("Error parsing saved product IDs:", parseError)
        }
      }

      // Merge the two sets of IDs
      const mergedIds = Array.from(new Set([...serverIds, ...savedIds]))

      // Save the merged list back to localStorage
      localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(mergedIds))

      // Update the server-side set with the merged IDs
      await loadSeenProductIds(mergedIds)

      // Update last sync time
      const now = new Date().toLocaleString()
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
      setLastSyncTime(now)

      console.log(`Synced ${mergedIds.length} product IDs between server and localStorage`)
    } catch (error) {
      console.error("Error syncing product IDs:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  const stopAutoScraper = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setStatus("idle")
    setStatusMessage("Auto-scraper is disabled")

    toast({
      title: "Auto-Scraper Disabled",
      description: "The scraper has been stopped",
    })
  }

  // Update the checkForProducts function to add more logging
  const checkForProducts = async (url: string) => {
    if (isChecking) return

    setIsChecking(true)

    try {
      console.log("Starting checkForProducts function...")

      // First, get the current list of products before checking for new ones
      console.log("Fetching current products...")
      const currentProducts = await fetchProducts({
        daysBack: 1,
        sortBy: "newest",
        limit: 50,
      })

      // Extract the actual product objects from the edges
      const productsToScrape = currentProducts?.posts?.edges?.map((edge) => edge.node) || []
      console.log(`Found ${productsToScrape.length} products to scrape`)

      // Set status to indicate scraping is in progress
      if (productsToScrape.length > 0) {
        setStatus("warning")
        setStatusMessage(`Found ${productsToScrape.length} products. Starting contact information extraction...`)

        toast({
          title: "Scraping Started",
          description: `Extracting contact information from ${productsToScrape.length} products...`,
        })

        // Extract contact information for all products, regardless if they're new or not
        try {
          console.log("Importing extract-contacts module...")
          // Import the extraction function
          const extractContactsModule = await import("@/actions/extract-contacts")
          console.log("Extract contacts module imported successfully")

          console.log("Starting contact extraction for all products...")
          // Extract contact information
          const productsWithContacts = await extractContactsModule.extractContactInfo(
            productsToScrape,
            productsToScrape.length,
          )
          console.log(`Successfully extracted contact info for ${productsWithContacts.length} products`)

          // Update the products with contact information
          const updatedProducts = [...scrapedProducts]

          // Add or update products with contact information
          productsWithContacts.forEach((product) => {
            const existingIndex = updatedProducts.findIndex((p) => p.id === product.id)
            if (existingIndex >= 0) {
              updatedProducts[existingIndex] = product
            } else {
              updatedProducts.push(product)
            }
          })

          // Update state and localStorage
          setScrapedProducts(updatedProducts)
          updateProductCounters(updatedProducts)
          localStorage.setItem(STORAGE_KEYS.SCRAPED_PRODUCTS, JSON.stringify(updatedProducts))

          setStatus("success")
          setStatusMessage(`Successfully extracted contact information from ${productsWithContacts.length} products!`)

          toast({
            title: "Scraping Complete",
            description: `Successfully extracted contact information from ${productsWithContacts.length} products!`,
          })
        } catch (extractError) {
          console.error("Error extracting contact information:", extractError)
          setStatus("error")
          setStatusMessage(`Error extracting contact information: ${extractError.message}`)

          toast({
            title: "Extraction Error",
            description: `Failed to extract contact information: ${extractError.message}`,
            variant: "destructive",
          })
        }
      } else {
        console.log("No products found to scrape")
      }

      // Now check for new products as before
      console.log("Checking for new products...")
      const result = await checkForNewProducts(url)

      setLastChecked(new Date().toLocaleTimeString())

      if (result.success) {
        // Save the updated seen product IDs to localStorage
        if (result.seenIds) {
          localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))

          // Update last sync time
          const now = new Date().toLocaleString()
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
          setLastSyncTime(now)

          console.log(`Updated ${result.seenIds.length} product IDs in localStorage`)
        }

        if (result.newProducts.length > 0) {
          // Save the new products to localStorage
          const updatedProducts = [...scrapedProducts, ...result.newProducts]
          setScrapedProducts(updatedProducts)
          updateProductCounters(updatedProducts)

          localStorage.setItem(STORAGE_KEYS.SCRAPED_PRODUCTS, JSON.stringify(updatedProducts))

          setNewProductsCount((prev) => prev + result.newProducts.length)
          setStatus("success")
          setStatusMessage(
            `Found and immediately scraped ${result.newProducts.length} new products! Contact information extracted and sent to Discord.`,
          )

          toast({
            title: "New Products Found & Scraped!",
            description: `Found and immediately scraped ${result.newProducts.length} new products. Contact information extracted and sent to Discord in real-time.`,
          })
        } else {
          // Only update status if we didn't already set it during the scraping process
          if (productsToScrape.length === 0) {
            setStatus("success")
            setStatusMessage("No products found to scrape")
          }
        }
      } else {
        // Check if it's a rate limit message
        if (result.message.includes("rate limit")) {
          setStatus("warning")
          setStatusMessage(`Rate limit reached. The system will automatically switch to the next available API key.`)

          toast({
            title: "Rate Limit Reached",
            description: "Switching to next available API key automatically",
            variant: "warning",
          })
        } else {
          setStatus("error")
          setStatusMessage(result.message)

          toast({
            title: "Check Failed",
            description: result.message,
            variant: "destructive",
          })
        }
      }

      // Automatically sync after checking/scraping
      await syncSeenProductIds()
      console.log("Auto-synced product IDs after checking/scraping")
    } catch (error) {
      console.error("Error in checkForProducts:", error)
      setStatus("error")
      setStatusMessage(`Error: ${error.message}`)

      toast({
        title: "Error",
        description: `Failed to check for new products: ${error.message}`,
        variant: "destructive",
      })

      // Even if there's an error, we'll try again on the next interval
    } finally {
      setIsChecking(false)
    }
  }

  const handleManualCheck = async () => {
    if (!webhookUrl || isChecking) return

    // Save webhook URL to both localStorage and server
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
    await saveSettingsToServer(webhookUrl, isEnabled)

    toast({
      title: "Manual Check Started",
      description: "Checking for new products and scraping contact information...",
    })

    await checkForProducts(webhookUrl)
    // No need to call syncSeenProductIds here as it's now automatic
  }

  const handleManualSync = async () => {
    if (isSyncing) return

    toast({
      title: "Syncing Product IDs",
      description: "Synchronizing product IDs between server and local storage...",
    })

    await syncSeenProductIds()

    toast({
      title: "Sync Complete",
      description: "Product IDs have been synchronized successfully",
    })
  }

  // Function to filter products based on date selection
  const getFilteredProducts = (): Product[] => {
    if (!scrapedProducts.length) return []

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const last7Days = new Date(today)
    last7Days.setDate(last7Days.getDate() - 7)

    switch (dateFilter) {
      case "today":
        return scrapedProducts.filter((product) => {
          const productDate = new Date(product.createdAt)
          return productDate >= today
        })
      case "yesterday":
        return scrapedProducts.filter((product) => {
          const productDate = new Date(product.createdAt)
          return productDate >= yesterday && productDate < today
        })
      case "last7days":
        return scrapedProducts.filter((product) => {
          const productDate = new Date(product.createdAt)
          return productDate >= last7Days
        })
      case "all":
      default:
        return scrapedProducts
    }
  }

  // Function to download products in the selected format
  const handleDownloadProducts = () => {
    if (isDownloading) return

    setIsDownloading(true)

    try {
      const filteredProducts = getFilteredProducts()

      if (!filteredProducts.length) {
        toast({
          title: "No Products to Download",
          description: "There are no products matching your filter criteria",
          variant: "warning",
        })
        setIsDownloading(false)
        return
      }

      // Generate filename with date and filter info
      const dateStr = new Date().toISOString().split("T")[0]
      let filterStr = ""

      switch (dateFilter) {
        case "today":
          filterStr = "today"
          break
        case "yesterday":
          filterStr = "yesterday"
          break
        case "last7days":
          filterStr = "last-7-days"
          break
        case "all":
          filterStr = "all-time"
          break
      }

      const filename = `product-hunt-scraped-${filterStr}-${dateStr}`

      // Export based on selected format
      switch (exportFormat) {
        case "json":
          // Convert to JSON
          const jsonData = JSON.stringify(filteredProducts, null, 2)
          const jsonBlob = new Blob([jsonData], { type: "application/json" })
          downloadBlob(jsonBlob, `${filename}.json`)
          break

        case "excel":
          // For Excel, we'll use CSV with Excel-specific headers
          const csvContent = convertToCSV(filteredProducts)
          const excelBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
          downloadBlob(excelBlob, `${filename}.xlsx`)
          break

        case "csv":
        default:
          // Convert to CSV
          const csvData = convertToCSV(filteredProducts)
          const csvBlob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
          downloadBlob(csvBlob, `${filename}.csv`)
          break
      }

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${filteredProducts.length} products in ${exportFormat.toUpperCase()} format`,
      })

      // Close the popover after download
      setIsExportPopoverOpen(false)
    } catch (error) {
      console.error("Error downloading products:", error)
      toast({
        title: "Download Failed",
        description: "There was an error downloading the products",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  // Helper function to convert products to CSV
  const convertToCSV = (products: Product[]): string => {
    // Define CSV headers
    const headers = [
      "id",
      "name",
      "tagline",
      "description",
      "url",
      "website",
      "votesCount",
      "createdAt",
      "emails",
      "twitterHandles",
      "facebookLinks",
      "instagramLinks",
      "linkedinLinks",
      "contactLinks",
      "externalLinks",
    ]

    // Create CSV rows
    const rows = products.map((product) => [
      product.id || "",
      `"${(product.name || "").replace(/"/g, '""')}"`,
      `"${(product.tagline || "").replace(/"/g, '""')}"`,
      `"${(product.description || "").replace(/"/g, '""')}"`,
      product.url || "",
      product.website || "",
      product.votesCount || 0,
      product.createdAt || "",
      (product.emails || []).join(", "),
      (product.twitterHandles || []).join(", "),
      (product.facebookLinks || []).join(", "),
      (product.instagramLinks || []).join(", "),
      (product.linkedinLinks || []).join(", "),
      (product.contactLinks || []).join(", "),
      (product.externalLinks || []).join(", "),
    ])

    // Combine headers and rows
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  // Helper function to download a blob
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleInitializeWithTimeRange = async () => {
    if (!webhookUrl) {
      toast({
        title: "Webhook URL Required",
        description: "Please enter a valid Discord webhook URL first",
        variant: "destructive",
      })
      return
    }

    setIsInitializingTimeRange(true)
    setTimeRangeProgress(10)

    // Start progress animation
    const progressInterval = setInterval(() => {
      setTimeRangeProgress((prev) => {
        const newProgress = prev + Math.random() * 5
        return newProgress < 90 ? newProgress : prev
      })
    }, 1000)

    try {
      const daysBack = Number.parseInt(selectedTimeRange)
      const result = await initializeWithTimeRange(webhookUrl, daysBack)

      clearInterval(progressInterval)
      setTimeRangeProgress(100)

      if (result.success) {
        // Save the seen product IDs to localStorage
        if (result.seenIds) {
          localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))

          // Update last sync time
          const now = new Date().toLocaleString()
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
          setLastSyncTime(now)
        }

        toast({
          title: "Time Range Initialization Complete",
          description: `Successfully loaded ${result.productsCount || 0} products from the last ${daysBack} days.`,
        })

        // Close the dialog
        setIsTimeRangeDialogOpen(false)

        // If auto-scraper is enabled, restart it
        if (isEnabled) {
          //await startAutoScraper(webhookUrl)
        }
      } else {
        toast({
          title: "Initialization Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error initializing with time range:", error)
      toast({
        title: "Initialization Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      clearInterval(progressInterval)
      setIsInitializingTimeRange(false)
    }
  }

  // Handle saving all settings
  const handleSaveAllSettings = async () => {
    try {
      setIsSavingSettings(true)

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
      localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, isEnabled.toString())

      // Save to server
      const success = await saveSettingsToServer(webhookUrl, isEnabled, initMode)

      if (success) {
        toast({
          title: "Settings Saved",
          description: "Your settings have been saved to the server and will be available on all devices",
        })
      } else {
        toast({
          title: "Warning",
          description:
            "Settings saved locally but failed to save to server. They may not be available on other devices.",
          variant: "warning",
        })
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleToggleAutoScraper = async (enabled: boolean) => {
    setIsEnabled(enabled)

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, enabled.toString())

    // Save to server
    await saveSettingsToServer(webhookUrl, enabled, initMode)

    if (enabled) {
      if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
        toast({
          title: "Invalid Webhook URL",
          description: "Please enter a valid Discord webhook URL",
          variant: "destructive",
        })
        setIsEnabled(false)

        // Update both localStorage and server
        localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")
        await saveSettingsToServer(webhookUrl, false)

        return
      }

      // Save webhook URL to both localStorage and server
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
      await saveSettingsToServer(webhookUrl, true)

      // Initialize the seen product IDs but don't start client-side interval
      setIsInitializing(true)
      setStatus("idle")
      setStatusMessage("Initializing auto-scraper with today's products only...")
      setInitProgress(10)

      try {
        // Simulate progress updates during initialization
        const progressInterval = setInterval(() => {
          setInitProgress((prev) => {
            const newProgress = prev + 5
            return newProgress < 90 ? newProgress : prev
          })
        }, 1000)

        // Initialize with today's products only for cron job approach
        const result = await initializeWithTodayOnly(webhookUrl)

        clearInterval(progressInterval)
        setInitProgress(100)

        if (result.success) {
          setStatus("success")
          // Update the status message to indicate scraping is happening
          setStatusMessage(
            "Auto-scraper enabled and actively scraping products. Cron job will run every 10 minutes to check for new products.",
          )

          // Save the seen product IDs to localStorage
          if (result.seenIds) {
            localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))

            // Update last sync time
            const now = new Date().toLocaleString()
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
            setLastSyncTime(now)
          }

          // Immediately trigger a scrape after initialization
          if (result.seenIds && result.seenIds.length > 0) {
            toast({
              title: "Starting Initial Scrape",
              description: `Scraping ${result.seenIds.length} products found during initialization...`,
            })

            // Call checkForProducts to perform the actual scraping
            await checkForProducts(webhookUrl)
          }

          toast({
            title: "Auto-Scraper Enabled",
            description: "The server cron job will check for new products every 10 minutes",
          })
        } else {
          setStatus("error")
          setStatusMessage(result.message)
          setIsEnabled(false)

          // Save disabled state to both localStorage and server
          localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")
          await saveSettingsToServer(webhookUrl, false)

          toast({
            title: "Failed to Enable Auto-Scraper",
            description: result.message,
            variant: "destructive",
          })
        }
      } catch (error) {
        setStatus("error")
        setStatusMessage(`Error: ${error.message}`)
        setIsEnabled(false)

        // Save disabled state to both localStorage and server
        localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")
        await saveSettingsToServer(webhookUrl, false)

        toast({
          title: "Error",
          description: `Failed to initialize auto-scraper: ${error.message}`,
          variant: "destructive",
        })
      } finally {
        setIsInitializing(false)
      }
    } else {
      setStatus("idle")
      setStatusMessage("Auto-scraper is disabled")

      toast({
        title: "Auto-Scraper Disabled",
        description: "The cron job will no longer check for new products",
      })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Auto-Scraper Settings
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              {apiKeyStatus}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Cloud className="h-3 w-3" />
              Server-Synced Settings
            </Badge>
          </div>
        </div>
        <CardDescription>
          Automatically check for new products via cron job, extract contact information, and send notifications to
          Discord
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoadingSettings ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading settings...</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-2">
              <div className="flex-1">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Discord Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl}
                    onChange={(e) => {
                      const newUrl = e.target.value
                      setWebhookUrl(newUrl)
                    }}
                    type="url"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a webhook in your Discord server settings and paste the URL here
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-end space-y-2 min-w-[200px]">
                <div className="bg-muted/40 p-3 rounded-lg border border-border">
                  <h4 className="text-sm font-medium mb-2 flex items-center justify-between">
                    <span>Scraping Stats</span>
                    <Badge variant="secondary" className="ml-2">
                      Real-time
                    </Badge>
                  </h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Total Scraped:</span>
                      <span className="font-bold">{totalScrapedCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Today:</span>
                      <span className="font-bold">{todayScrapedCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>New This Session:</span>
                      <span className="font-bold">{newProductsCount}</span>
                    </div>
                  </div>
                </div>

                <Popover open={isExportPopoverOpen} onOpenChange={setIsExportPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Export Scraped Data
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <h4 className="font-medium">Export Scraped Products</h4>

                      <div className="space-y-2">
                        <Label htmlFor="dateFilter">Date Range</Label>
                        <Select
                          value={dateFilter}
                          onValueChange={(value: "today" | "yesterday" | "last7days" | "all") => setDateFilter(value)}
                        >
                          <SelectTrigger id="dateFilter">
                            <SelectValue placeholder="Select date range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                            <SelectItem value="last7days">Last 7 Days</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="exportFormat">Export Format</Label>
                        <Select
                          value={exportFormat}
                          onValueChange={(value: "csv" | "json" | "excel") => setExportFormat(value)}
                        >
                          <SelectTrigger id="exportFormat">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleDownloadProducts}
                        disabled={isDownloading || scrapedProducts.length === 0}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download {getFilteredProducts().length} Products
                          </>
                        )}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="autoScraper">Enable Auto-Scraper</Label>
                <p className="text-xs text-muted-foreground">
                  Check for new products via cron job and extract contact information
                </p>
              </div>
              <Switch
                id="autoScraper"
                checked={isEnabled}
                onCheckedChange={handleToggleAutoScraper}
                disabled={isInitializing}
              />
            </div>

            <div className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">Initialization Mode</h3>
                <Badge variant="outline" className="text-xs">
                  Synced
                </Badge>
              </div>
              <Tabs
                defaultValue="week"
                value={initMode}
                onValueChange={(value) => {
                  const newMode = value as "today" | "week"
                  setInitMode(newMode)
                  // Save to localStorage
                  localStorage.setItem(STORAGE_KEYS.INIT_MODE, newMode)
                  // Save to server
                  saveSettingsToServer(webhookUrl, isEnabled, newMode)
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="today" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Today Only</span>
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>Last 7 Days</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    Only track products from today. This mode will only initialize with today's products and then check
                    for new ones.
                  </p>
                </TabsContent>
                <TabsContent value="week" className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    Track products from the last 7 days. This mode will initialize with a week's worth of products to
                    avoid duplicates.
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {isInitializing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {initMode === "today"
                      ? "Initializing with today's products only..."
                      : "Initializing with 7 days of products..."}
                  </span>
                  <span className="text-sm font-medium">{initProgress}%</span>
                </div>
                <Progress value={initProgress} className="h-2" />
              </div>
            )}

            {status !== "idle" && (
              <Alert variant={status === "error" ? "destructive" : status === "warning" ? "warning" : "default"}>
                {status === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : status === "warning" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <AlertTitle>{status === "error" ? "Error" : status === "warning" ? "Warning" : "Status"}</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col space-y-2 text-sm">
              {lastChecked && (
                <div>
                  <span className="font-medium">Last checked:</span> {lastChecked}
                  {newProductsCount > 0 && (
                    <span className="ml-2 text-primary font-medium">Found {newProductsCount} new products so far</span>
                  )}
                </div>
              )}

              {lastSyncTime && (
                <div>
                  <span className="font-medium">Last storage sync:</span> {lastSyncTime}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-6 px-2"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    <span className="ml-1 text-xs">Force Sync</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">What This Does:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Checks for new products via server cron job (every 10 minutes)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Extracts real website links, emails, and Twitter handles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Sends detailed notifications to Discord in real-time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Uses triple API key rotation to handle rate limits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Saves settings to server for access on all devices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Allows exporting scraped data in multiple formats with date filtering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Automatically syncs product data after every search and scrape</span>
                </li>
              </ul>
            </div>
            <Dialog open={isTimeRangeDialogOpen} onOpenChange={setIsTimeRangeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Initialize with Time Range</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Initialize with Time Range</DialogTitle>
                  <DialogDescription>
                    Select the time range to load products from. This will load all products from the selected time
                    range to avoid duplicates.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="time-range">Time Range</Label>
                    <RadioGroup value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="7" id="r1" />
                        <Label htmlFor="r1">Last 7 Days</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="30" id="r2" />
                        <Label htmlFor="r2">Last 30 Days</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="365" id="r3" />
                        <Label htmlFor="r3">Last 365 Days</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
                {isInitializingTimeRange && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Initializing with selected time range...</span>
                      <span className="text-sm font-medium">{timeRangeProgress}%</span>
                    </div>
                    <Progress value={timeRangeProgress} className="h-2" />
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setIsTimeRangeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleInitializeWithTimeRange} disabled={isInitializingTimeRange}>
                    {isInitializingTimeRange ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      "Initialize"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add scraping status indicator */}
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
              <h4 className="text-sm font-medium mb-2">Scraping Status</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {isChecking ? (
                    <span className="flex items-center text-amber-500">
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Actively scraping products...
                    </span>
                  ) : status === "success" ? (
                    <span className="flex items-center text-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready to scrape new products
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Waiting for initialization</span>
                  )}
                </span>
                <Badge variant={isChecking ? "warning" : status === "success" ? "default" : "outline"}>
                  {isChecking ? "Scraping" : status === "success" ? "Ready" : "Idle"}
                </Badge>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleManualCheck} disabled={isChecking || !webhookUrl}>
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              "Check Now"
            )}
          </Button>

          <Button variant="outline" onClick={handleSaveAllSettings} disabled={isSavingSettings}>
            {isSavingSettings ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Cloud className="mr-2 h-4 w-4" />
                Save to Server
              </>
            )}
          </Button>

          <Dialog open={isTimeRangeDialogOpen} onOpenChange={setIsTimeRangeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Database className="mr-2 h-4 w-4" />
                Historical Scrape
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Historical Product Scraping</DialogTitle>
                <DialogDescription>
                  Choose a time range to scrape products from the past. This will initialize the auto-scraper with all
                  products from that period.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <RadioGroup
                  value={selectedTimeRange}
                  onValueChange={(value: "7" | "30" | "365") => setSelectedTimeRange(value)}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="7" id="r1" />
                    <Label htmlFor="r1">Last 7 days</Label>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="30" id="r2" />
                    <Label htmlFor="r2">Last 30 days (1 month)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="365" id="r3" />
                    <Label htmlFor="r3">Last 365 days (1 year)</Label>
                  </div>
                </RadioGroup>

                {isInitializingTimeRange && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Loading products...</span>
                      <span className="text-sm font-medium">{Math.round(timeRangeProgress)}%</span>
                    </div>
                    <Progress value={timeRangeProgress} className="h-2" />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTimeRangeDialogOpen(false)}
                  disabled={isInitializingTimeRange}
                >
                  Cancel
                </Button>
                <Button onClick={handleInitializeWithTimeRange} disabled={isInitializingTimeRange}>
                  {isInitializingTimeRange ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    "Start Historical Scrape"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Button
          variant={isEnabled ? "destructive" : "default"}
          onClick={() => handleToggleAutoScraper(!isEnabled)}
          disabled={isInitializing}
        >
          {isInitializing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : isEnabled ? (
            "Disable Cron Auto-Scraper"
          ) : (
            "Enable Cron Auto-Scraper"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

