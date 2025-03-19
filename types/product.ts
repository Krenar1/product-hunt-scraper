export interface Maker {
  id: string
  name: string
  username: string
  headline?: string
  twitterUsername?: string
}

export interface Product {
  id: string
  name: string
  tagline: string
  description?: string
  url: string
  website?: string
  imageUrl?: string
  votesCount: number
  createdAt: string
  makers: Maker[]
  emails?: string[]
  twitterHandles?: string[]
  facebookLinks?: string[]
  instagramLinks?: string[]
  linkedinLinks?: string[]
  contactLinks?: string[]
  aboutLinks?: string[]
  externalLinks?: string[]
  exactWebsiteUrl?: string // Added to store the exact website URL
}

export interface ProductsResponse {
  posts: {
    edges: {
      node: Product
    }[]
    pageInfo: {
      endCursor: string
      hasNextPage: boolean
    }
  }
}

export interface ProductsFilter {
  daysBack: number
  sortBy: "newest" | "popular"
  limit: number
}

