"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { scrapeWebsite } from "@/actions/extract-contacts"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export default function ContactExtractionPage() {
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [urls, setUrls] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleSingleExtraction = async () => {
    if (!url) {
      toast({
        title: "URL Required",
        description: "Please enter a valid URL to extract contact information",
        variant: "destructive",
      })
      return
    }

    // Check if it's a Product Hunt URL
    if (url.includes("producthunt.com") || url.includes("ph.co")) {
      toast({
        title: "Invalid URL",
        description: "Product Hunt URLs cannot be scraped directly. Please use the actual website URL.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const contactInfo = await scrapeWebsite(url)

      // Initialize empty arrays for any missing properties to prevent "undefined.length" errors
      const safeResults = {
        url,
        emails: contactInfo.emails || [],
        twitterHandles: contactInfo.socialMedia?.twitter || [],
        facebookLinks: contactInfo.socialMedia?.facebook || [],
        instagramLinks: contactInfo.socialMedia?.instagram || [],
        linkedinLinks: contactInfo.socialMedia?.linkedin || [],
        contactLinks: contactInfo.contactUrl ? [contactInfo.contactUrl] : [],
        externalLinks: contactInfo.externalLinks || [],
        aboutLinks: contactInfo.aboutUrl ? [contactInfo.aboutUrl] : [],
      }

      setResults(safeResults)

      toast({
        title: "Extraction Complete",
        description: `Found ${safeResults.emails.length} emails and ${safeResults.twitterHandles.length} Twitter handles`,
      })
    } catch (error) {
      console.error("Extraction error:", error)
      toast({
        title: "Extraction Failed",
        description: "There was an error extracting contact information",
        variant: "destructive",
      })
      // Set empty results to prevent errors when rendering
      setResults({
        url,
        emails: [],
        twitterHandles: [],
        facebookLinks: [],
        instagramLinks: [],
        linkedinLinks: [],
        contactLinks: [],
        externalLinks: [],
        aboutLinks: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkExtraction = async () => {
    if (!urls) {
      toast({
        title: "URLs Required",
        description: "Please enter at least one valid URL to extract contact information",
        variant: "destructive",
      })
      return
    }

    const urlList = urls
      .split("\n")
      .filter((u) => u.trim())
      .filter((u) => !u.includes("producthunt.com") && !u.includes("ph.co"))

    if (urlList.length === 0) {
      toast({
        title: "No Valid URLs",
        description: "Please enter at least one valid URL (Product Hunt URLs are not supported)",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Bulk Extraction Started",
      description: `Processing ${urlList.length} URLs. This may take some time.`,
    })

    // In a real app, this would be handled by a background job
    // For this demo, we'll just show a message
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast({
        title: "Bulk Extraction Complete",
        description: "The results would be available for download as a CSV file",
      })
    }, 3000)
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">Contact Extraction</h1>
      <p className="text-muted-foreground mb-8">Extract contact information from product websites</p>

      <Tabs defaultValue="single">
        <TabsList className="mb-4">
          <TabsTrigger value="single">Single URL</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Extraction</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Extract Contact Information</CardTitle>
              <CardDescription>Enter a website URL to extract emails, Twitter handles, and more</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <Button onClick={handleSingleExtraction} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      "Extract"
                    )}
                  </Button>
                </div>
              </div>

              {results && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-medium">Results for {results.url}</h3>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Emails</h4>
                      {results.emails && results.emails.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {results.emails.map((email: string, i: number) => (
                            <li key={i} className="text-sm">
                              {email}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No emails found</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Twitter Handles</h4>
                      {results.twitterHandles && results.twitterHandles.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {results.twitterHandles.map((handle: string, i: number) => (
                            <li key={i} className="text-sm">
                              {handle}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No Twitter handles found</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Contact Links</h4>
                      {results.contactLinks && results.contactLinks.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {results.contactLinks.map((link: string, i: number) => (
                            <li key={i} className="text-sm">
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No contact links found</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">External Links</h4>
                      {results.externalLinks && results.externalLinks.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {results.externalLinks.map((link: string, i: number) => (
                            <li key={i} className="text-sm">
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No external links found</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Contact Extraction</CardTitle>
              <CardDescription>
                Enter multiple URLs (one per line) to extract contact information in bulk
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="urls">Website URLs (one per line)</Label>
                <Textarea
                  id="urls"
                  placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
                  rows={6}
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                />
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h4 className="text-sm font-medium mb-2">Extraction Settings</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Extract emails from website pages</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Extract Twitter handles from links</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Find contact page links</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Extract external links (up to 10 per site)</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>Rate limited to respect website servers</span>
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleBulkExtraction} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Bulk Extraction"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}

