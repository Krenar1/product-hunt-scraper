import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchProducts } from "@/actions/fetch-products"
import { BarChart, Download, TrendingUp, Users } from "lucide-react"

export async function DashboardStats() {
  // Fetch data for stats with better error handling
  const data = await fetchProducts({ daysBack: 7, sortBy: "newest", limit: 100 }).catch((error) => {
    console.error("Error in DashboardStats:", error)
    return null
  })

  // Calculate stats
  const totalProducts = data?.posts.edges.length || 0
  const totalVotes = data?.posts.edges.reduce((sum, edge) => sum + edge.node.votesCount, 0) || 0

  // Fix the unique key issue by using a Set with proper key generation
  const uniqueMakerIds = new Set<string>()
  data?.posts.edges.forEach((edge) => {
    edge.node.makers.forEach((maker) => {
      uniqueMakerIds.add(maker.id)
    })
  })
  const totalMakers = uniqueMakerIds.size

  // Calculate average votes per product
  const avgVotes = totalProducts > 0 ? Math.round(totalVotes / totalProducts) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalVotes.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Across all products</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Average Votes</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgVotes}</div>
          <p className="text-xs text-muted-foreground">Per product</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Unique Makers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalMakers}</div>
          <p className="text-xs text-muted-foreground">Contributing to products</p>
        </CardContent>
      </Card>
    </div>
  )
}

