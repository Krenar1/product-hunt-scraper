"use client"

import { useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportProductsToCSV } from "@/actions/export-products"
import { useToast } from "@/hooks/use-toast"

export function ProductsHeader() {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleExport = async () => {
    try {
      setIsExporting(true)

      // Get the current filter values from URL params
      const params = new URLSearchParams(window.location.search)
      const daysBack = Number.parseInt(params.get("days") || "7", 10)

      // Use a much higher limit to get all available products
      const limit = 1000 // Set a very high limit to get all products

      toast({
        title: "Starting Export",
        description: `Exporting all available products from the last ${daysBack} days. This may take a moment...`,
      })

      console.log(`Attempting to export with limit=${limit} and daysBack=${daysBack}`)
      const csvContent = await exportProductsToCSV(daysBack, limit)

      if (!csvContent || csvContent.trim() === "") {
        throw new Error("No data returned from export")
      }

      // Check if we only got headers (no data)
      const lines = csvContent.trim().split("\n")
      if (lines.length <= 1) {
        toast({
          title: "No Products Found",
          description: `No products found in the last ${daysBack} days. Try increasing the time range.`,
          variant: "warning",
        })
        setIsExporting(false)
        return
      }

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

      // Generate filename with product count
      const productCount = lines.length - 1 // Subtract 1 for header row
      const filename = `product-hunt-data-${productCount}-products-${new Date().toISOString().split("T")[0]}`

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
          link.setAttribute("download", `${filename}.json`)
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          toast({
            title: "Export Successful",
            description: `Exported ${productCount} products to JSON format`,
          })
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
      if (format === "csv" || format === "excel") {
        const extension = format === "excel" ? ".xlsx" : ".csv"
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `${filename}${extension}`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast({
          title: "Export Successful",
          description: `Exported ${productCount} products to ${format === "excel" ? "Excel" : "CSV"} format`,
        })
      }
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data. Try adjusting your filters.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    window.location.reload()
    setTimeout(() => setIsRefreshing(false), 1000)

    toast({
      title: "Data Refreshed",
      description: "The product list has been updated",
    })
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-bold">Latest Products</h2>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw size={16} className={`mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          <Download size={16} className="mr-1" />
          <span>{isExporting ? "Exporting..." : "Export (API Limited - Use Extract Contacts Instead)"}</span>
        </Button>
      </div>
    </div>
  )
}

