"use client"

import { useEffect, useState } from "react"
import { fetchProducts } from "@/actions/fetch-products"
import { ProductListClient } from "@/components/product-list-client"

export default function ProductList() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProducts() {
      try {
        // Get URL parameters
        const params = new URLSearchParams(window.location.search)
        const daysBack = Number.parseInt(params.get("days") || "7")
        const sortBy = (params.get("sort") || "newest") as "newest" | "popular"

        console.log(`Initial load with daysBack=${daysBack}, sortBy=${sortBy}, limit=20`)

        // Fetch products
        const result = await fetchProducts({
          daysBack,
          sortBy,
          limit: 20,
        })

        console.log(`Initial load result:`, result)
        setData(result)
      } catch (err) {
        console.error("Error in ProductList:", err)
        setError("Failed to load products")
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[300px] bg-muted/40 rounded-lg animate-pulse"></div>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Error Loading Products</h3>
        <p className="text-muted-foreground mt-2">There was an error loading products. Please try again later.</p>
      </div>
    )
  }

  // Check if we have any products
  if (!data.posts.edges || data.posts.edges.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">No Products Found</h3>
        <p className="text-muted-foreground mt-2">Try adjusting your filters or try again later.</p>
      </div>
    )
  }

  const products = data.posts.edges.map((edge) => edge.node)
  const hasNextPage = data.posts.pageInfo.hasNextPage
  const endCursor = data.posts.pageInfo.endCursor

  return <ProductListClient products={products} hasNextPage={hasNextPage} endCursor={endCursor} />
}

