"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  Download,
  RefreshCw,
  Settings2,
  Clock,
  BarChart,
  Zap,
  Cpu,
  Gauge,
  Layers,
  ListChecks,
  Repeat,
  Shield,
} from "lucide-react"
import { fetchProducts } from "@/actions/fetch-products"
import { extractContactInfo, processBatches } from "@/actions/extract-contacts"
import { checkForNewProducts, loadSeenProductIds, getSeenProductIds } from "@/actions/auto-scraper"
import type { Product } from "@/types/product"

// Storage keys for persistent data
const STORAGE_KEYS = {
  WEBHOOK_URL: "enhancedWebhookUrl",
  AUTO_SCRAPER_ENABLED: "enhancedAutoScraperEnabled",
  SEEN_PRODUCT_IDS: "enhancedSeenProductIds",
  LAST_SYNC_TIME: "enhancedLastSyncTime",
  SCRAPED_PRODUCTS: "enhancedScrapedProducts",
  SCRAPER_SETTINGS: "enhancedScraperSettings",
  LAST_RUN_TIME: "enhancedLastRunTime",
  SCRAPE_STATS: "enhancedScrapeStats",
}

// Default settings for the scraper
const DEFAULT_SETTINGS = {
  checkInterval: 5, // minutes
  maxProductsPerBatch: 20,
  daysToLookBack: 3,
  maxRetries: 3,
  extractEmails: true,
  extractTwitter: true,
  extractLinks: true,
  extractFacebook: true,
  extractLinkedIn: true,
  extractInstagram: true,
  autoExport: false,
  exportFormat: "json",
  notifyOnNewProducts: true,
  intelligentMode: true,
  proxyEnabled: false,
  proxyUrl: "",
  maxConcurrentRequests: 5,
  respectRobotsTxt: true,
  userAgentRotation: true,
  delayBetweenRequests: 1000, // ms
  timeoutPerRequest: 15000, // ms
  maxDepth: 2,
  prioritizeContactPages: true,
}

// Stats tracking
interface ScraperStats {
  totalProductsFound: number
  totalProductsScraped: number
  totalEmailsFound: number
  totalTwitterHandlesFound: number
  totalLinksFound: number
  successRate: number
  lastRunDuration: number
  averageRunDuration: number
  runHistory: Array<{
    timestamp: string
    productsFound: number
    productsScraped: number
    duration: number
    success: boolean
  }>
}

const DEFAULT_STATS: ScraperStats = {
  totalProductsFound: 0,
  totalProductsScraped: 0,
  totalEmailsFound: 0,
  totalTwitterHandlesFound: 0,
  totalLinksFound: 0,
  successRate: 0,
  lastRunDuration: 0,
  averageRunDuration: 0,
  runHistory: [],
}

export function EnhancedAutoScraper() {
  const { toast } = useToast()

  // State for webhook and basic settings
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isEnabled, setIsEnabled] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error" | "warning" | "running">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [initProgress, setInitProgress] = useState(0)

  // State for products and data
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([])
  const [newProductsCount, setNewProductsCount] = useState(0)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // State for export functionality
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "excel">("json")
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "last7days" | "all">("all")
  const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false)

  // State for advanced settings
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // State for stats
  const [stats, setStats] = useState<ScraperStats>(DEFAULT_STATS)
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false)

  // Refs for intervals
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [runProgress, setRunProgress] = useState(0)

  // Load saved settings and data on component mount
  useEffect(() => {
    loadSavedData()
    return () => {
      // Clean up intervals on unmount
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // Start or stop the auto-scraper when isEnabled changes
  useEffect(() => {
    if (isEnabled) {
      startAutoScraper()
    } else {
      stopAutoScraper()
    }
  }, [isEnabled])

  // Load saved data from localStorage
  const loadSavedData = async () => {
    try {
      setIsLoadingSettings(true)

      // Load webhook URL
      const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL)
      if (savedWebhookUrl) setWebhookUrl(savedWebhookUrl)

      // Load auto-scraper enabled state
      const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"
      setIsEnabled(savedIsEnabled)

      // Load scraper settings
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SCRAPER_SETTINGS)
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings)
          setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings })
        } catch (error) {
          console.error("Error parsing saved settings:", error)
        }
      }

      // Load scraped products
      const savedProducts = localStorage.getItem(STORAGE_KEYS.SCRAPED_PRODUCTS)
      if (savedProducts) {
        try {
          const products = JSON.parse(savedProducts) as Product[]
          setScrapedProducts(products)
          updateStats(products)
        } catch (error) {
          console.error("Error parsing saved products:", error)
        }
      }

      // Load stats
      const savedStats = localStorage.getItem(STORAGE_KEYS.SCRAPE_STATS)
      if (savedStats) {
        try {
          const parsedStats = JSON.parse(savedStats) as ScraperStats
          setStats(parsedStats)
        } catch (error) {
          console.error("Error parsing saved stats:", error)
        }
      }

      // Load last sync time
      const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME)
      if (lastSync) setLastSyncTime(lastSync)

      // Load last checked time
      const lastRun = localStorage.getItem(STORAGE_KEYS.LAST_RUN_TIME)
      if (lastRun) setLastChecked(lastRun)

      // Sync product IDs with server
      await syncSeenProductIds()

      // Set appropriate status based on enabled state
      if (savedIsEnabled) {
        setStatus("success")
        setStatusMessage("Auto-scraper is enabled and ready to run.")
      }
    } catch (error) {
      console.error("Error loading saved data:", error)
      toast({
        title: "Error Loading Data",
        description: "There was an error loading your saved data. Some settings may be reset.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSettings(false)
    }
  }

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
      localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, isEnabled.toString())
      localStorage.setItem(STORAGE_KEYS.SCRAPER_SETTINGS, JSON.stringify(settings))

      toast({
        title: "Settings Saved",
        description: "Your scraper settings have been saved successfully.",
      })

      return true
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error Saving Settings",
        description: "There was an error saving your settings.",
        variant: "destructive",
      })
      return false
    }
  }

  // Save stats to localStorage
  const saveStats = (updatedStats: ScraperStats) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SCRAPE_STATS, JSON.stringify(updatedStats))
    } catch (error) {
      console.error("Error saving stats:", error)
    }
  }

  // Update stats based on scraped products
  const updateStats = (products: Product[]) => {
    const emailCount = products.reduce((count, product) => count + (product.emails?.length || 0), 0)
    const twitterCount = products.reduce((count, product) => count + (product.twitterHandles?.length || 0), 0)
    const linkCount = products.reduce((count, product) => {
      return (
        count +
        (product.contactLinks?.length || 0) +
        (product.externalLinks?.length || 0) +
        (product.facebookLinks?.length || 0) +
        (product.instagramLinks?.length || 0) +
        (product.linkedinLinks?.length || 0)
      )
    }, 0)

    const updatedStats: ScraperStats = {
      ...stats,
      totalProductsScraped: products.length,
      totalEmailsFound: emailCount,
      totalTwitterHandlesFound: twitterCount,
      totalLinksFound: linkCount,
    }

    setStats(updatedStats)
    saveStats(updatedStats)
  }

  // Start the auto-scraper
  const startAutoScraper = () => {
    if (!webhookUrl) {
      toast({
        title: "Webhook URL Required",
        description: "Please enter a Discord webhook URL to enable the auto-scraper.",
        variant: "destructive",
      })
      setIsEnabled(false)
      return
    }

    // Save settings
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
    localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "true")

    // Initialize if needed
    if (scrapedProducts.length === 0) {
      initializeAutoScraper()
    } else {
      // Set up the interval to check for new products
      const intervalMinutes = settings.checkInterval
      const intervalMs = intervalMinutes * 60 * 1000

      // Clear any existing interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }

      // Set the new interval
      checkIntervalRef.current = setInterval(() => {
        runAutoScraper()
      }, intervalMs)

      setStatus("success")
      setStatusMessage(`Auto-scraper is running. Checking every ${intervalMinutes} minutes.`)

      toast({
        title: "Auto-Scraper Started",
        description: `The auto-scraper will check for new products every ${intervalMinutes} minutes.`,
      })

      // Run immediately
      runAutoScraper()
    }
  }

  // Stop the auto-scraper
  const stopAutoScraper = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")

    setStatus("idle")
    setStatusMessage("Auto-scraper is disabled.")
    setRunProgress(0)

    toast({
      title: "Auto-Scraper Stopped",
      description: "The auto-scraper has been stopped.",
    })
  }

  // Initialize the auto-scraper
  const initializeAutoScraper = async () => {
    setIsInitializing(true)
    setInitProgress(10)

    // Start progress animation
    const progressInterval = setInterval(() => {
      setInitProgress((prev) => {
        const newProgress = prev + Math.random() * 5
        return newProgress < 90 ? newProgress : prev
      })
    }, 1000)

    try {
      // Fetch initial products
      const daysBack = settings.daysToLookBack

      toast({
        title: "Initializing Auto-Scraper",
        description: `Loading products from the last ${daysBack} days...`,
      })

      // Fetch products
      const products = await fetchProducts({
        daysBack,
        sortBy: "newest",
        limit: 100,
      })

      if (!products || !products.posts || !products.posts.edges) {
        throw new Error("Failed to fetch initial products")
      }

      // Extract products from edges
      const initialProducts = products.posts.edges.map((edge) => edge.node)

      // Update seen product IDs
      const productIds = initialProducts.map((product) => product.id)
      await loadSeenProductIds(productIds)

      // Save product IDs to localStorage
      localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(productIds))

      // Extract contact information
      setInitProgress(60)
      setStatusMessage("Extracting contact information from initial products...")

      const productsWithContacts = await processBatches(initialProducts, settings.maxConcurrentRequests)

      // Save scraped products
      setScrapedProducts(productsWithContacts)
      localStorage.setItem(STORAGE_KEYS.SCRAPED_PRODUCTS, JSON.stringify(productsWithContacts))

      // Update stats
      updateStats(productsWithContacts)

      // Update last sync time
      const now = new Date().toLocaleString()
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
      setLastSyncTime(now)

      // Set up the interval to check for new products
      const intervalMinutes = settings.checkInterval
      const intervalMs = intervalMinutes * 60 * 1000

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }

      checkIntervalRef.current = setInterval(() => {
        runAutoScraper()
      }, intervalMs)

      setInitProgress(100)
      setStatus("success")
      setStatusMessage(
        `Auto-scraper initialized with ${productsWithContacts.length} products. Running every ${intervalMinutes} minutes.`,
      )

      toast({
        title: "Auto-Scraper Initialized",
        description: `Successfully loaded and processed ${productsWithContacts.length} products.`,
      })

      // Run immediately after initialization
      runAutoScraper()
    } catch (error) {
      console.error("Error initializing auto-scraper:", error)

      setStatus("error")
      setStatusMessage(`Error initializing auto-scraper: ${error.message}`)
      setIsEnabled(false)
      localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")

      toast({
        title: "Initialization Failed",
        description: `Failed to initialize auto-scraper: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      clearInterval(progressInterval)
      setIsInitializing(false)
    }
  }

  // Run the auto-scraper
  const runAutoScraper = async () => {
    if (isChecking) return

    setIsChecking(true)
    setStatus("running")
    setStatusMessage("Checking for new products...")
    setRunProgress(10)

    const startTime = Date.now()

    // Start progress animation
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    progressIntervalRef.current = setInterval(() => {
      setRunProgress((prev) => {
        const newProgress = prev + Math.random() * 3
        return newProgress < 95 ? newProgress : prev
      })
    }, 1000)

    try {
      // Step 1: Check for new products
      console.log("Checking for new products...")
      const result = await checkForNewProducts(webhookUrl)

      // Update last checked time
      const now = new Date()
      setLastChecked(now.toLocaleTimeString())
      localStorage.setItem(STORAGE_KEYS.LAST_RUN_TIME, now.toLocaleString())

      // Step 2: Process results
      if (result.success) {
        // Save the updated seen product IDs to localStorage
        if (result.seenIds) {
          localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))
        }

        if (result.newProducts.length > 0) {
          setRunProgress(40)
          setStatusMessage(`Found ${result.newProducts.length} new products. Extracting contact information...`)

          // Step 3: Extract contact information from new products
          console.log(`Extracting contact information from ${result.newProducts.length} new products...`)

          // Use intelligent mode if enabled
          let productsWithContacts: Product[] = []

          if (settings.intelligentMode) {
            // Process in batches with intelligent retry
            productsWithContacts = await processBatches(result.newProducts, settings.maxConcurrentRequests)
          } else {
            // Process sequentially
            productsWithContacts = await extractContactInfo(result.newProducts, result.newProducts.length)
          }

          setRunProgress(70)

          // Step 4: Save the new products
          const updatedProducts = [...scrapedProducts, ...productsWithContacts]
          setScrapedProducts(updatedProducts)
          localStorage.setItem(STORAGE_KEYS.SCRAPED_PRODUCTS, JSON.stringify(updatedProducts))

          // Update stats
          const newStats = {
            ...stats,
            totalProductsFound: stats.totalProductsFound + result.newProducts.length,
            totalProductsScraped: updatedProducts.length,
            totalEmailsFound: updatedProducts.reduce((count, product) => count + (product.emails?.length || 0), 0),
            totalTwitterHandlesFound: updatedProducts.reduce(
              (count, product) => count + (product.twitterHandles?.length || 0),
              0,
            ),
            totalLinksFound: updatedProducts.reduce((count, product) => {
              return count + (product.contactLinks?.length || 0) + (product.externalLinks?.length || 0)
            }, 0),
            lastRunDuration: Date.now() - startTime,
            runHistory: [
              ...stats.runHistory,
              {
                timestamp: now.toISOString(),
                productsFound: result.newProducts.length,
                productsScraped: productsWithContacts.length,
                duration: Date.now() - startTime,
                success: true,
              },
            ],
          }

          // Calculate average run duration
          if (newStats.runHistory.length > 0) {
            newStats.averageRunDuration =
              newStats.runHistory.reduce((sum, run) => sum + run.duration, 0) / newStats.runHistory.length
          }

          // Calculate success rate
          const successfulRuns = newStats.runHistory.filter((run) => run.success).length
          newStats.successRate = (successfulRuns / newStats.runHistory.length) * 100

          // Limit history to last 100 runs
          if (newStats.runHistory.length > 100) {
            newStats.runHistory = newStats.runHistory.slice(-100)
          }

          setStats(newStats)
          saveStats(newStats)

          setNewProductsCount((prev) => prev + result.newProducts.length)

          // Step 5: Auto-export if enabled
          if (settings.autoExport) {
            setRunProgress(85)
            setStatusMessage(`Auto-exporting ${productsWithContacts.length} new products...`)
            await exportProducts(productsWithContacts, settings.exportFormat)
          }

          setRunProgress(100)
          setStatus("success")
          setStatusMessage(`Found and processed ${result.newProducts.length} new products!`)

          toast({
            title: "New Products Found",
            description: `Found and processed ${result.newProducts.length} new products.`,
          })
        } else {
          setRunProgress(100)
          setStatus("success")
          setStatusMessage("No new products found.")

          // Update run history even when no products found
          const newStats = {
            ...stats,
            lastRunDuration: Date.now() - startTime,
            runHistory: [
              ...stats.runHistory,
              {
                timestamp: now.toISOString(),
                productsFound: 0,
                productsScraped: 0,
                duration: Date.now() - startTime,
                success: true,
              },
            ],
          }

          // Calculate average run duration
          if (newStats.runHistory.length > 0) {
            newStats.averageRunDuration =
              newStats.runHistory.reduce((sum, run) => sum + run.duration, 0) / newStats.runHistory.length
          }

          // Calculate success rate
          const successfulRuns = newStats.runHistory.filter((run) => run.success).length
          newStats.successRate = (successfulRuns / newStats.runHistory.length) * 100

          // Limit history to last 100 runs
          if (newStats.runHistory.length > 100) {
            newStats.runHistory = newStats.runHistory.slice(-100)
          }

          setStats(newStats)
          saveStats(newStats)
        }
      } else {
        // Handle error
        setRunProgress(100)
        setStatus("error")
        setStatusMessage(`Error checking for new products: ${result.message}`)

        // Update run history with failure
        const newStats = {
          ...stats,
          lastRunDuration: Date.now() - startTime,
          runHistory: [
            ...stats.runHistory,
            {
              timestamp: now.toISOString(),
              productsFound: 0,
              productsScraped: 0,
              duration: Date.now() - startTime,
              success: false,
            },
          ],
        }

        // Calculate average run duration
        if (newStats.runHistory.length > 0) {
          newStats.averageRunDuration =
            newStats.runHistory.reduce((sum, run) => sum + run.duration, 0) / newStats.runHistory.length
        }

        // Calculate success rate
        const successfulRuns = newStats.runHistory.filter((run) => run.success).length
        newStats.successRate = (successfulRuns / newStats.runHistory.length) * 100

        // Limit history to last 100 runs
        if (newStats.runHistory.length > 100) {
          newStats.runHistory = newStats.runHistory.slice(-100)
        }

        setStats(newStats)
        saveStats(newStats)

        toast({
          title: "Error",
          description: `Failed to check for new products: ${result.message}`,
          variant: "destructive",
        })
      }

      // Step 6: Sync product IDs
      await syncSeenProductIds()
    } catch (error) {
      console.error("Error running auto-scraper:", error)

      setRunProgress(100)
      setStatus("error")
      setStatusMessage(`Error running auto-scraper: ${error.message}`)

      // Update run history with failure
      const newStats = {
        ...stats,
        lastRunDuration: Date.now() - startTime,
        runHistory: [
          ...stats.runHistory,
          {
            timestamp: new Date().toISOString(),
            productsFound: 0,
            productsScraped: 0,
            duration: Date.now() - startTime,
            success: false,
          },
        ],
      }

      // Calculate success rate
      const successfulRuns = newStats.runHistory.filter((run) => run.success).length
      newStats.successRate = (successfulRuns / newStats.runHistory.length) * 100

      setStats(newStats)
      saveStats(newStats)

      toast({
        title: "Error",
        description: `Failed to run auto-scraper: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      setIsChecking(false)
    }
  }

  // Sync seen product IDs between server and localStorage
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
        } catch (error) {
          console.error("Error parsing saved product IDs:", error)
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
      return true
    } catch (error) {
      console.error("Error syncing product IDs:", error)
      return false
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle manual check button click
  const handleManualCheck = async () => {
    if (!webhookUrl || isChecking) return

    // Save webhook URL
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)

    toast({
      title: "Manual Check Started",
      description: "Checking for new products...",
    })

    await runAutoScraper()
  }

  // Handle manual sync button click
  const handleManualSync = async () => {
    if (isSyncing) return

    toast({
      title: "Syncing Product IDs",
      description: "Synchronizing product IDs between server and local storage...",
    })

    const success = await syncSeenProductIds()

    if (success) {
      toast({
        title: "Sync Complete",
        description: "Product IDs have been synchronized successfully.",
      })
    } else {
      toast({
        title: "Sync Failed",
        description: "Failed to synchronize product IDs.",
        variant: "destructive",
      })
    }
  }

  // Handle save settings button click
  const handleSaveSettings = () => {
    const success = saveSettings()
    setIsSettingsDialogOpen(false)

    // Restart auto-scraper if enabled
    if (success && isEnabled) {
      stopAutoScraper()
      startAutoScraper()
    }
  }

  // Export products in the selected format
  const exportProducts = async (products: Product[], format: string = exportFormat) => {
    try {
      setIsExporting(true)

      if (products.length === 0) {
        toast({
          title: "No Products to Export",
          description: "There are no products to export.",
          variant: "warning",
        })
        return false
      }

      // Generate filename with date
      const dateStr = new Date().toISOString().split("T")[0]
      const filename = `product-hunt-data-${products.length}-products-${dateStr}`

      // Export based on selected format
      switch (format) {
        case "json":
          // Convert to JSON
          const jsonData = JSON.stringify(products, null, 2)
          const jsonBlob = new Blob([jsonData], { type: "application/json" })
          downloadBlob(jsonBlob, `${filename}.json`)
          break

        case "excel":
          // For Excel, we'll use CSV with Excel-specific headers
          const csvContent = convertToCSV(products)
          const excelBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
          downloadBlob(excelBlob, `${filename}.xlsx`)
          break

        case "csv":
        default:
          // Convert to CSV
          const csvData = convertToCSV(products)
          const csvBlob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
          downloadBlob(csvBlob, `${filename}.csv`)
          break
      }

      toast({
        title: "Export Complete",
        description: `Successfully exported ${products.length} products in ${format.toUpperCase()} format.`,
      })

      return true
    } catch (error) {
      console.error("Error exporting products:", error)

      toast({
        title: "Export Failed",
        description: `Failed to export products: ${error.message}`,
        variant: "destructive",
      })

      return false
    } finally {
      setIsExporting(false)
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
      "exactWebsiteUrl",
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
      product.exactWebsiteUrl || product.website || "",
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

  // Handle export button click
  const handleExport = async () => {
    if (isExporting) return

    const filteredProducts = getFilteredProducts()
    await exportProducts(filteredProducts, exportFormat)
    setIsExportPopoverOpen(false)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Enhanced Auto-Scraper
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              Intelligent Mode {settings.intelligentMode ? "On" : "Off"}
            </Badge>
            <Badge variant={isEnabled ? "default" : "outline"} className="flex items-center gap-1">
              {isEnabled ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Standby
                </>
              )}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Continuously monitors Product Hunt for new products and automatically extracts contact information with
          intelligent retry mechanisms.
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
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    type="url"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your Discord webhook URL to receive notifications about new products
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
                      <span>Total Products:</span>
                      <span className="font-bold">{stats.totalProductsScraped}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Emails Found:</span>
                      <span className="font-bold">{stats.totalEmailsFound}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Twitter Handles:</span>
                      <span className="font-bold">{stats.totalTwitterHandlesFound}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 h-7 text-xs"
                      onClick={() => setIsStatsDialogOpen(true)}
                    >
                      <BarChart className="h-3 w-3 mr-1" />
                      View Detailed Stats
                    </Button>
                  </div>
                </div>

                <Popover open={isExportPopoverOpen} onOpenChange={setIsExportPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Export Data
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
                        onClick={handleExport}
                        disabled={isExporting || scrapedProducts.length === 0}
                      >
                        {isExporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
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
                  Automatically check for new products every {settings.checkInterval} minutes
                </p>
              </div>
              <Switch
                id="autoScraper"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                disabled={isInitializing || isChecking}
              />
            </div>

            {isInitializing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Initializing auto-scraper...</span>
                  <span className="text-sm font-medium">{initProgress}%</span>
                </div>
                <Progress value={initProgress} className="h-2" />
              </div>
            )}

            {status !== "idle" && (
              <Alert
                variant={
                  status === "error"
                    ? "destructive"
                    : status === "warning"
                      ? "warning"
                      : status === "running"
                        ? "default"
                        : "default"
                }
              >
                {status === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : status === "warning" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <AlertTitle>
                  {status === "error"
                    ? "Error"
                    : status === "warning"
                      ? "Warning"
                      : status === "running"
                        ? "Running"
                        : "Status"}
                </AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>

                {status === "running" && <Progress value={runProgress} className="h-1 mt-2" />}
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

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Gauge className="h-4 w-4 mr-1 text-primary" />
                  <span>Performance</span>
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Check Interval:</span>
                    <span className="font-medium">{settings.checkInterval} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-medium">{stats.successRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Run Time:</span>
                    <span className="font-medium">{(stats.averageRunDuration / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Layers className="h-4 w-4 mr-1 text-primary" />
                  <span>Data Extraction</span>
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Emails:</span>
                    <span className="font-medium">{settings.extractEmails ? "Enabled" : "Disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Twitter:</span>
                    <span className="font-medium">{settings.extractTwitter ? "Enabled" : "Disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contact Links:</span>
                    <span className="font-medium">{settings.extractLinks ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-1 text-primary" />
                  <span>Reliability</span>
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Intelligent Mode:</span>
                    <span className="font-medium">{settings.intelligentMode ? "Enabled" : "Disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Retries:</span>
                    <span className="font-medium">{settings.maxRetries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-Export:</span>
                    <span className="font-medium">{settings.autoExport ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
              </div>
            </div>

            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Advanced Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Advanced Scraper Settings</DialogTitle>
                  <DialogDescription>
                    Configure the behavior of the auto-scraper to optimize performance and data extraction.
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 mb-4">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="extraction">Data Extraction</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="checkInterval">Check Interval (minutes)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="checkInterval"
                          value={[settings.checkInterval]}
                          min={1}
                          max={60}
                          step={1}
                          onValueChange={(value) => setSettings({ ...settings, checkInterval: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-8 text-center">{settings.checkInterval}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        How often the auto-scraper checks for new products (in minutes)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="daysToLookBack">Days to Look Back</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="daysToLookBack"
                          value={[settings.daysToLookBack]}
                          min={1}
                          max={30}
                          step={1}
                          onValueChange={(value) => setSettings({ ...settings, daysToLookBack: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-8 text-center">{settings.daysToLookBack}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        How many days back to look for products during initialization
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxProductsPerBatch">Max Products Per Batch</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="maxProductsPerBatch"
                          value={[settings.maxProductsPerBatch]}
                          min={5}
                          max={50}
                          step={5}
                          onValueChange={(value) => setSettings({ ...settings, maxProductsPerBatch: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-8 text-center">{settings.maxProductsPerBatch}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Maximum number of products to process in a single batch
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="notifyOnNewProducts"
                        checked={settings.notifyOnNewProducts}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, notifyOnNewProducts: checked as boolean })
                        }
                      />
                      <Label htmlFor="notifyOnNewProducts">Send Discord notifications for new products</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="autoExport"
                        checked={settings.autoExport}
                        onCheckedChange={(checked) => setSettings({ ...settings, autoExport: checked as boolean })}
                      />
                      <Label htmlFor="autoExport">Automatically export new products</Label>
                    </div>

                    {settings.autoExport && (
                      <div className="pl-6 space-y-2">
                        <Label htmlFor="exportFormat">Export Format</Label>
                        <Select
                          value={settings.exportFormat}
                          onValueChange={(value) => setSettings({ ...settings, exportFormat: value })}
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
                    )}
                  </TabsContent>

                  <TabsContent value="extraction" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extractEmails"
                          checked={settings.extractEmails}
                          onCheckedChange={(checked) => setSettings({ ...settings, extractEmails: checked as boolean })}
                        />
                        <Label htmlFor="extractEmails">Extract email addresses</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extractTwitter"
                          checked={settings.extractTwitter}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, extractTwitter: checked as boolean })
                          }
                        />
                        <Label htmlFor="extractTwitter">Extract Twitter handles</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extractLinks"
                          checked={settings.extractLinks}
                          onCheckedChange={(checked) => setSettings({ ...settings, extractLinks: checked as boolean })}
                        />
                        <Label htmlFor="extractLinks">Extract contact and external links</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extractFacebook"
                          checked={settings.extractFacebook}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, extractFacebook: checked as boolean })
                          }
                        />
                        <Label htmlFor="extractFacebook">Extract Facebook links</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extractLinkedIn"
                          checked={settings.extractLinkedIn}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, extractLinkedIn: checked as boolean })
                          }
                        />
                        <Label htmlFor="extractLinkedIn">Extract LinkedIn profiles</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extractInstagram"
                          checked={settings.extractInstagram}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, extractInstagram: checked as boolean })
                          }
                        />
                        <Label htmlFor="extractInstagram">Extract Instagram profiles</Label>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="maxDepth">Max Crawl Depth</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            id="maxDepth"
                            value={[settings.maxDepth]}
                            min={1}
                            max={5}
                            step={1}
                            onValueChange={(value) => setSettings({ ...settings, maxDepth: value[0] })}
                            className="flex-1"
                          />
                          <span className="font-medium w-8 text-center">{settings.maxDepth}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          How many pages deep to crawl when extracting contact information
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="prioritizeContactPages"
                          checked={settings.prioritizeContactPages}
                          onCheckedChange={(checked) =>
                            setSettings({ ...settings, prioritizeContactPages: checked as boolean })
                          }
                        />
                        <Label htmlFor="prioritizeContactPages">Prioritize contact and about pages</Label>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="advanced" className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="intelligentMode"
                        checked={settings.intelligentMode}
                        onCheckedChange={(checked) => setSettings({ ...settings, intelligentMode: checked as boolean })}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="intelligentMode">Intelligent Mode</Label>
                        <p className="text-xs text-muted-foreground">
                          Uses advanced techniques to improve scraping success rate
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxRetries">Max Retries</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="maxRetries"
                          value={[settings.maxRetries]}
                          min={1}
                          max={10}
                          step={1}
                          onValueChange={(value) => setSettings({ ...settings, maxRetries: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-8 text-center">{settings.maxRetries}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Maximum number of retry attempts for failed requests
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxConcurrentRequests">Max Concurrent Requests</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="maxConcurrentRequests"
                          value={[settings.maxConcurrentRequests]}
                          min={1}
                          max={10}
                          step={1}
                          onValueChange={(value) => setSettings({ ...settings, maxConcurrentRequests: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-8 text-center">{settings.maxConcurrentRequests}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Maximum number of concurrent requests when processing batches
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delayBetweenRequests">Delay Between Requests (ms)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="delayBetweenRequests"
                          value={[settings.delayBetweenRequests]}
                          min={100}
                          max={5000}
                          step={100}
                          onValueChange={(value) => setSettings({ ...settings, delayBetweenRequests: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-12 text-center">{settings.delayBetweenRequests}ms</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Delay between consecutive requests to avoid rate limiting
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeoutPerRequest">Request Timeout (ms)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="timeoutPerRequest"
                          value={[settings.timeoutPerRequest]}
                          min={5000}
                          max={30000}
                          step={1000}
                          onValueChange={(value) => setSettings({ ...settings, timeoutPerRequest: value[0] })}
                          className="flex-1"
                        />
                        <span className="font-medium w-12 text-center">{settings.timeoutPerRequest}ms</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Maximum time to wait for a response before timing out
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="userAgentRotation"
                        checked={settings.userAgentRotation}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, userAgentRotation: checked as boolean })
                        }
                      />
                      <Label htmlFor="userAgentRotation">Rotate user agents</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="respectRobotsTxt"
                        checked={settings.respectRobotsTxt}
                        onCheckedChange={(checked) =>
                          setSettings({ ...settings, respectRobotsTxt: checked as boolean })
                        }
                      />
                      <Label htmlFor="respectRobotsTxt">Respect robots.txt</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="proxyEnabled"
                        checked={settings.proxyEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, proxyEnabled: checked as boolean })}
                      />
                      <Label htmlFor="proxyEnabled">Use proxy server</Label>
                    </div>

                    {settings.proxyEnabled && (
                      <div className="pl-6 space-y-2">
                        <Label htmlFor="proxyUrl">Proxy URL</Label>
                        <Input
                          id="proxyUrl"
                          placeholder="http://username:password@proxy.example.com:8080"
                          value={settings.proxyUrl}
                          onChange={(e) => setSettings({ ...settings, proxyUrl: e.target.value })}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveSettings}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Scraper Statistics</DialogTitle>
                  <DialogDescription>
                    Detailed statistics about the auto-scraper's performance and data collection.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Performance</h4>
                      <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Success Rate:</span>
                          <span className="font-bold">{stats.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Last Run Duration:</span>
                          <span className="font-bold">{(stats.lastRunDuration / 1000).toFixed(1)}s</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Average Run Duration:</span>
                          <span className="font-bold">{(stats.averageRunDuration / 1000).toFixed(1)}s</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Runs:</span>
                          <span className="font-bold">{stats.runHistory.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Data Collection</h4>
                      <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total Products Found:</span>
                          <span className="font-bold">{stats.totalProductsFound}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Products Scraped:</span>
                          <span className="font-bold">{stats.totalProductsScraped}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Emails Found:</span>
                          <span className="font-bold">{stats.totalEmailsFound}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Twitter Handles:</span>
                          <span className="font-bold">{stats.totalTwitterHandlesFound}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Recent Runs</h4>
                    <div className="bg-muted/30 p-3 rounded-lg max-h-[200px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs">
                          <tr>
                            <th className="text-left p-1">Time</th>
                            <th className="text-right p-1">Products</th>
                            <th className="text-right p-1">Duration</th>
                            <th className="text-right p-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.runHistory
                            .slice()
                            .reverse()
                            .map((run, index) => (
                              <tr key={index} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                                <td className="p-1">{new Date(run.timestamp).toLocaleString()}</td>
                                <td className="text-right p-1">{run.productsFound}</td>
                                <td className="text-right p-1">{(run.duration / 1000).toFixed(1)}s</td>
                                <td className="text-right p-1">
                                  {run.success ? (
                                    <span className="text-green-500 flex items-center justify-end">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Success
                                    </span>
                                  ) : (
                                    <span className="text-red-500 flex items-center justify-end">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Failed
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={() => setIsStatsDialogOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Now
              </>
            )}
          </Button>

          <Button variant="outline" onClick={() => setIsSettingsDialogOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Settings
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Quick Export</h4>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => exportProducts(scrapedProducts, "json")}
                  >
                    Export as JSON
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => exportProducts(scrapedProducts, "csv")}
                  >
                    Export as CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => exportProducts(scrapedProducts, "excel")}
                  >
                    Export as Excel
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button
          variant={isEnabled ? "destructive" : "default"}
          onClick={() => setIsEnabled(!isEnabled)}
          disabled={isInitializing || isChecking}
        >
          {isInitializing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : isEnabled ? (
            <>
              <Repeat className="mr-2 h-4 w-4" />
              Stop Auto-Scraper
            </>
          ) : (
            <>
              <ListChecks className="mr-2 h-4 w-4" />
              Start Auto-Scraper
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

