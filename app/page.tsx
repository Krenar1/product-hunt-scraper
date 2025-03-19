import { Suspense } from "react"
import { DashboardStats } from "@/components/dashboard-stats"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { ErrorBoundary } from "@/components/error-boundary"
import { HomeClientComponents } from "@/components/home-client-components"

// Disable static generation for this page
export const dynamicParams = true
export const revalidate = 0

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">Product Hunt Scraper</h1>
      <p className="text-muted-foreground mb-8">Discover and analyze the latest products from Product Hunt</p>

      <ErrorBoundary
        fallback={
          <Alert variant="destructive" className="mb-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load dashboard stats. This could be due to API rate limiting. Please try again later.
            </AlertDescription>
          </Alert>
        }
      >
        <Suspense fallback={<div className="h-[180px] bg-muted/40 rounded-lg animate-pulse mb-8"></div>}>
          <DashboardStats />
        </Suspense>
      </ErrorBoundary>

      <div className="my-8">
        <HomeClientComponents />
      </div>
    </main>
  )
}

