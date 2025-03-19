"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchProducts } from "@/actions/fetch-products"
import { format, subDays } from "date-fns"

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("products")
  const [isLoading, setIsLoading] = useState(true)
  const [productData, setProductData] = useState<any[]>([])
  const [voteData, setVoteData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)

        // Fetch data for products chart (30 days)
        const productsResponse = await fetchProducts({ daysBack: 30, sortBy: "newest", limit: 100 })

        if (!productsResponse || !productsResponse.posts || !productsResponse.posts.edges) {
          throw new Error("Failed to load product data")
        }

        // Group products by date
        const productsByDate: Record<string, number> = {}
        productsResponse.posts.edges.forEach((edge) => {
          const date = new Date(edge.node.createdAt).toISOString().split("T")[0]
          productsByDate[date] = (productsByDate[date] || 0) + 1
        })

        // Create chart data for the last 14 days
        const productChartData = Array.from({ length: 14 }).map((_, i) => {
          const date = subDays(new Date(), 13 - i)
          const formattedDate = date.toISOString().split("T")[0]
          return {
            date: format(date, "MMM dd"),
            count: productsByDate[formattedDate] || 0,
          }
        })

        setProductData(productChartData)

        // Fetch data for votes chart (7 days)
        const votesResponse = await fetchProducts({ daysBack: 7, sortBy: "popular", limit: 100 })

        if (!votesResponse || !votesResponse.posts || !votesResponse.posts.edges) {
          throw new Error("Failed to load vote data")
        }

        // Group products by vote ranges
        const voteRanges = [
          { name: "0-10", range: [0, 10], count: 0 },
          { name: "11-50", range: [11, 50], count: 0 },
          { name: "51-100", range: [51, 100], count: 0 },
          { name: "101-500", range: [101, 500], count: 0 },
          { name: "500+", range: [501, Number.POSITIVE_INFINITY], count: 0 },
        ]

        // Count products in each vote range
        votesResponse.posts.edges.forEach((edge) => {
          const votes = edge.node.votesCount
          const range = voteRanges.find((r) => votes >= r.range[0] && votes <= r.range[1])
          if (range) {
            range.count++
          }
        })

        // Filter out ranges with no products
        const voteChartData = voteRanges.filter((range) => range.count > 0)
        setVoteData(voteChartData)

        setIsLoading(false)
      } catch (err) {
        console.error("Error loading analytics data:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">Analytics</h1>
      <p className="text-muted-foreground mb-8">Visualize and analyze Product Hunt data</p>

      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="votes">Votes</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product Launches</CardTitle>
              <CardDescription>Number of products launched over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : error ? (
                <div className="h-[400px] flex items-center justify-center text-destructive">{error}</div>
              ) : (
                <div className="h-[400px] overflow-auto border rounded-md">
                  <div className="min-w-full inline-block align-middle">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="border p-2 text-left">Date</th>
                            <th className="border p-2 text-left">Products Launched</th>
                            <th className="border p-2 text-left">Visual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productData.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                              <td className="border p-2">{item.date}</td>
                              <td className="border p-2">{item.count}</td>
                              <td className="border p-2">
                                <div
                                  className="bg-primary h-5"
                                  style={{ width: `${Math.min(item.count * 5, 100)}%` }}
                                ></div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="votes">
          <Card>
            <CardHeader>
              <CardTitle>Vote Distribution</CardTitle>
              <CardDescription>Distribution of votes across products</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : error ? (
                <div className="h-[400px] flex items-center justify-center text-destructive">{error}</div>
              ) : (
                <div className="h-[400px] overflow-auto border rounded-md">
                  <div className="min-w-full inline-block align-middle">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="border p-2 text-left">Vote Range</th>
                            <th className="border p-2 text-left">Number of Products</th>
                            <th className="border p-2 text-left">Visual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {voteData.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                              <td className="border p-2">{item.name}</td>
                              <td className="border p-2">{item.count}</td>
                              <td className="border p-2">
                                <div
                                  className="bg-primary h-5"
                                  style={{
                                    width: `${Math.min(item.count * 2, 100)}%`,
                                    backgroundColor:
                                      index === 0
                                        ? "#0088FE"
                                        : index === 1
                                          ? "#00C49F"
                                          : index === 2
                                            ? "#FFBB28"
                                            : index === 3
                                              ? "#FF8042"
                                              : "#8884D8",
                                  }}
                                ></div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}

