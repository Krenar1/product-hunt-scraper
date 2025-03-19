"use client"

import { useState } from "react"
import type { Product } from "@/types/product"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { extractContactInfo, processBatches } from "@/actions/extract-contacts"
import { fetchProducts } from "@/actions/fetch-products"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertTriangle, Database, Download } from "lucide-react"
import { Slider } from "@/components/ui/slider"

interface ProductListClientProps {
  products: Product[]
  hasNextPage: boolean
  endCursor?: string
}

export function ProductListClient({
  products: initialProducts,
  hasNextPage,
  endCursor: initialCursor,
}: ProductListClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [isExtracting, setIsExtracting] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [endCursor, setEndCursor] = useState<string | undefined>(initialCursor)
  const [hasMorePages, setHasMorePages] = useState(hasNextPage)
  const [csvData, setCsvData] = useState<string | null>(null)
  const [maxProducts, setMaxProducts] = useState<number>(10)
  const [loadCount, setLoadCount] = useState<number>(20)
  const { toast } = useToast()

  // Generate CSV content
  const generateCsvContent = (productsWithContacts: Product[]) => {
    console.log("Generating CSV content...")

    // Create CSV headers
    const headers = [
      "id",
      "name",
      "tagline",
      "description",
      "url",
      "website_url",
      "votes_count",
      "launched_at",
      "emails",
      "twitter",
      "contact_links",
      "external_links",
    ]

    // Create CSV rows
    const rows = productsWithContacts.map((product) => [
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
      (product.contactLinks || []).join(", "),
      (product.externalLinks || []).join(", "),
    ])

    // Combine headers and rows
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  // Handle manual CSV download
  const handleDownloadCsv = () => {
    if (!csvData) {
      toast({
        title: "No Data Available",
        description: "Please extract contact information first",
        variant: "warning",
      })
      return
    }

    try {
      // Get the current export format from settings
      let format = "csv"
      try {
        const savedSettings = localStorage.getItem("productHuntScraperSettings")
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          format = settings.exportFormat || "csv"
          console.log(`Using export format from settings: ${format}`)
        }
      } catch (error) {
        console.error("Error getting export format:", error)
      }

      // Generate filename with count of products
      const lines = csvData.split("\n")
      const productCount = Math.max(0, lines.length - 1) // Subtract 1 for header row
      const filename = `product-hunt-contacts-${productCount}-products-${new Date().toISOString().split("T")[0]}`

      // Handle different formats
      if (format === "json") {
        try {
          // Parse CSV to JSON
          const headers = lines[0].split(",")
          const jsonData = []

          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue
            const obj = {}
            const currentLine = lines[i].split(",")

            for (let j = 0; j < headers.length; j++) {
              obj[headers[j]] = currentLine[j]
            }
            jsonData.push(obj)
          }

          // Create JSON blob and download
          const jsonContent = JSON.stringify(jsonData, null, 2)
          const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" })
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `${filename}.json`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          toast({
            title: "Download Complete",
            description: `${productCount} products have been downloaded as a JSON file`,
          })
          return
        } catch (jsonError) {
          console.error("JSON conversion error:", jsonError)
          toast({
            title: "JSON Export Failed",
            description: "There was an error converting to JSON. Falling back to CSV.",
            variant: "warning",
          })
          // Fall back to CSV
          format = "csv"
        }
      }

      // Handle CSV and Excel formats
      const extension = format === "excel" ? ".xlsx" : ".csv"
      const mimeType = "text/csv;charset=utf-8;"

      // Create a Blob with the CSV data
      const blob = new Blob([csvData], { type: mimeType })

      // Create a download URL
      const url = URL.createObjectURL(blob)

      // Create a link element
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}${extension}`

      // Append to body, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the URL
      URL.revokeObjectURL(url)

      toast({
        title: "Download Complete",
        description: `${productCount} products have been downloaded as a ${format === "excel" ? "Excel" : "CSV"} file`,
      })
    } catch (error) {
      console.error("Download error:", error)

      toast({
        title: "Download Failed",
        description: "Failed to download file. Try again or check console for details.",
        variant: "destructive",
      })
    }
  }

  // Extract contact information
  const handleExtractContactInfo = async () => {
    try {
      // Prevent multiple extractions
      if (isExtracting) {
        toast({
          title: "Extraction in Progress",
          description: "Please wait for the current extraction to complete",
        })
        return
      }

      setIsExtracting(true)
      setRateLimited(false)
      setCsvData(null)

      toast({
        title: "Contact Extraction Started",
        description: `Processing up to ${maxProducts} products. This may take a moment...`,
      })

      // Process products - FIXED: Make sure we're only processing the number of products specified by maxProducts
      const productsToProcess = products.slice(0, Math.min(products.length, maxProducts))
      console.log(`Will process ${productsToProcess.length} products`)

      // Set a timeout for the entire extraction process
      const extractionPromise =
        maxProducts > 10
          ? processBatches(productsToProcess, 5) // Process in batches of 5 for large requests
          : extractContactInfo(productsToProcess, maxProducts)

      const timeoutPromise = new Promise<Product[]>((_, reject) => {
        // Set timeout based on number of products (8 seconds per product + 15 seconds base)
        const timeout = Math.min(15000 + maxProducts * 8000, 120000) // Max 120 seconds (2 minutes)
        setTimeout(() => reject(new Error("Extraction timed out")), timeout)
      })

      const updatedProducts = await Promise.race([extractionPromise, timeoutPromise]).catch((error) => {
        console.error("Extraction error or timeout:", error)
        toast({
          title: "Extraction Partially Completed",
          description: "Some products may not have been fully processed due to timeout or errors",
          variant: "warning",
        })
        // Return what we have so far
        return productsToProcess
      })

      console.log(`Received ${updatedProducts.length} updated products`)

      // Update the products state
      setProducts((prevProducts) => {
        return prevProducts.map((product) => {
          const updatedProduct = updatedProducts.find((p) => p.id === product.id)
          return updatedProduct || product
        })
      })

      // Count products with contact info
      const productsWithContactInfo = updatedProducts.filter(
        (p) =>
          (p.emails && p.emails.length > 0) ||
          (p.twitterHandles && p.twitterHandles.length > 0) ||
          (p.contactLinks && p.contactLinks.length > 0),
      )

      // FIXED: Generate CSV data only for the processed products
      const csvContent = generateCsvContent(updatedProducts)
      setCsvData(csvContent)

      // Trigger automatic download
      try {
        // Get the current export format from settings
        let format = "csv"
        try {
          const savedSettings = localStorage.getItem("productHuntScraperSettings")
          if (savedSettings) {
            const settings = JSON.parse(savedSettings)
            format = settings.exportFormat || "csv"
            console.log(`Using export format for auto-download: ${format}`)
          }
        } catch (error) {
          console.error("Error getting export format:", error)
        }

        // Generate filename
        const filename = `product-hunt-contacts-${new Date().toISOString().split("T")[0]}`

        // Handle different formats
        if (format === "json") {
          try {
            // Parse CSV to JSON
            const lines = csvContent.split("\n")
            const headers = lines[0].split(",")
            const jsonData = []

            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue
              const obj = {}
              const currentLine = lines[i].split(",")

              for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentLine[j]
              }
              jsonData.push(obj)
            }

            // Create JSON blob and download
            const jsonContent = JSON.stringify(jsonData, null, 2)
            const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `${filename}.json`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          } catch (jsonError) {
            console.error("JSON conversion error:", jsonError)
            // Fall back to CSV
            format = "csv"
          }
        }

        // Handle CSV and Excel formats
        if (format === "csv" || format === "excel") {
          const extension = format === "excel" ? ".xlsx" : ".csv"
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `${filename}${extension}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      } catch (downloadError) {
        console.error("Error auto-downloading file:", downloadError)
        // We'll still have the manual download button as fallback
      }

      // Update the toast message to reflect the format
      toast({
        title: "Contact Extraction Complete",
        description: `Found contact info for ${productsWithContactInfo.length} out of ${updatedProducts.length} products. Data has been downloaded.`,
      })
    } catch (error) {
      console.error("Contact extraction error:", error)

      if (error.message && error.message.includes("429")) {
        setRateLimited(true)
        toast({
          title: "Rate Limit Exceeded",
          description: "The API rate limit has been reached. Please try again later.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Extraction Partially Completed",
          description: "There was an error during extraction. Some data may have been collected.",
          variant: "warning",
        })
      }
    } finally {
      setIsExtracting(false)
    }
  }

  // FIXED: Load products in multiple batches if needed with deduplication
  const handleLoadMore = async () => {
    try {
      setIsLoadingMore(true)

      // Get current filter values from URL or use defaults
      const urlParams = new URL(window.location.href).searchParams
      const daysBack = Number.parseInt(urlParams.get("days") || "7")
      const sortBy = (urlParams.get("sort") || "newest") as "newest" | "popular"

      // Get the current load count value
      const targetLoadCount = loadCount
      console.log(`Target: Load ${targetLoadCount} more products...`)

      // Keep track of existing product IDs to avoid duplicates
      const existingProductIds = new Set(products.map((p) => p.id))
      console.log(`Currently have ${existingProductIds.size} unique products`)

      // The Product Hunt API seems to have a limit of 20 products per request
      // So we'll make multiple requests if needed
      const MAX_PER_REQUEST = 20
      let currentCursor = endCursor
      let totalLoaded = 0
      let allNewProducts: Product[] = []
      let hasMore = true
      let duplicatesFound = 0

      // Make multiple requests if needed to reach the target load count
      while (totalLoaded < targetLoadCount && hasMore) {
        // Calculate how many to load in this batch
        const batchSize = Math.min(MAX_PER_REQUEST, targetLoadCount - totalLoaded)
        console.log(`Loading batch of ${batchSize} products with cursor: ${currentCursor || "initial"}`)

        try {
          // Fetch a batch of products
          const result = await fetchProducts(
            {
              daysBack,
              sortBy,
              limit: batchSize,
            },
            currentCursor,
          )

          if (!result || !result.posts || !result.posts.edges) {
            console.error("Invalid response from fetchProducts:", result)
            break
          }

          // Process the results
          const batchProducts = result.posts.edges.map((edge) => edge.node)
          console.log(`Received ${batchProducts.length} products in this batch`)

          // Filter out duplicates
          const uniqueNewProducts = batchProducts.filter((product) => {
            // Check if this product is already in our existing products
            if (existingProductIds.has(product.id)) {
              duplicatesFound++
              return false
            }

            // Check if this product is already in our new products
            if (allNewProducts.some((p) => p.id === product.id)) {
              duplicatesFound++
              return false
            }

            // Add to our set of existing IDs to avoid future duplicates
            existingProductIds.add(product.id)
            return true
          })

          console.log(
            `Found ${uniqueNewProducts.length} unique new products (filtered out ${batchProducts.length - uniqueNewProducts.length} duplicates)`,
          )

          // Add to our collection
          allNewProducts = [...allNewProducts, ...uniqueNewProducts]
          totalLoaded += uniqueNewProducts.length

          // Update cursor for next request
          currentCursor = result.posts.pageInfo.endCursor
          hasMore = result.posts.pageInfo.hasNextPage

          // If we didn't get any unique products in this batch, we might be in a loop
          if (uniqueNewProducts.length === 0) {
            console.log(`No unique products in this batch, stopping to avoid infinite loop`)
            break
          }

          // If we didn't get a full batch, we're done
          if (batchProducts.length < batchSize) {
            console.log(`Received fewer products than requested (${batchProducts.length} < ${batchSize}), stopping`)
            hasMore = false
            break
          }

          // If we've loaded enough unique products, we're done
          if (totalLoaded >= targetLoadCount) {
            console.log(`Reached target load count of ${targetLoadCount} unique products`)
            break
          }

          // Small delay between requests to avoid rate limiting
          if (hasMore && totalLoaded < targetLoadCount) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        } catch (batchError) {
          console.error("Error loading batch:", batchError)
          break
        }
      }

      // Update the UI with all the new products
      if (allNewProducts.length > 0) {
        console.log(
          `Successfully loaded ${allNewProducts.length} new unique products (filtered out ${duplicatesFound} duplicates)`,
        )

        setProducts((prevProducts) => [...prevProducts, ...allNewProducts])
        setEndCursor(currentCursor)
        setHasMorePages(hasMore)

        // Automatically increase maxProducts when loading more
        const newTotal = products.length + allNewProducts.length
        setMaxProducts(Math.max(maxProducts, Math.ceil(newTotal / 2)))

        toast({
          title: "Products Loaded",
          description: `Loaded ${allNewProducts.length} more unique products. Total: ${products.length + allNewProducts.length}`,
        })
      } else {
        toast({
          title: "No New Products",
          description:
            duplicatesFound > 0
              ? `Found ${duplicatesFound} products but all were duplicates. Try adjusting your filters.`
              : "There are no more products to load",
          variant: "warning",
        })
      }
    } catch (error) {
      console.error("Error loading more products:", error)
      toast({
        title: "Failed to Load More",
        description: "There was an error loading more products",
        variant: "destructive",
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
        <div className="w-full md:w-1/2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Products to Process: {maxProducts}</label>
              <span className="text-xs text-muted-foreground">
                {maxProducts === 1 ? "1 product" : `${maxProducts} of ${products.length} available products`}
              </span>
            </div>
            <Slider
              value={[maxProducts]}
              min={1}
              max={products.length}
              step={5}
              onValueChange={(value) => setMaxProducts(value[0])}
              className="w-full"
              disabled={isExtracting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Note: Processing more than 10 products will use batch processing to avoid timeouts. The slider will
              automatically adjust when loading more products.
            </p>
          </div>
        </div>

        <div className="flex flex-col w-full md:w-1/2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Products to Load: {loadCount}</label>
              <span className="text-xs text-muted-foreground">{loadCount} products per page</span>
            </div>
            <Slider
              value={[loadCount]}
              min={5}
              max={50}
              step={5}
              onValueChange={(value) => {
                console.log(`Setting loadCount to ${value[0]}`)
                setLoadCount(value[0])
              }}
              className="w-full"
              disabled={isLoadingMore}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Adjust how many products to load at once when clicking "Load More"
            </p>
          </div>

          <div className="flex items-center gap-2 w-full">
            <Button
              variant="default"
              disabled={isExtracting || rateLimited}
              onClick={handleExtractContactInfo}
              className="w-full md:w-auto"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Contacts...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Extract {maxProducts} Contacts
                </>
              )}
            </Button>

            <Button variant="outline" disabled={!csvData} onClick={handleDownloadCsv} className="w-full md:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Download Data
            </Button>
          </div>
        </div>
      </div>

      {rateLimited && (
        <div className="flex items-center text-amber-500 gap-2 text-sm mb-4 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md">
          <AlertTriangle size={16} />
          <span>Rate limit reached. Please try again later.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={`product-${product.id}`} product={product} />
        ))}
      </div>

      {hasMorePages && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Load ${loadCount} More`
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

