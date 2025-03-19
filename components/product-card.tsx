import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, ArrowUpCircle, Mail, Twitter, Link, Facebook, Instagram, Linkedin } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Product } from "@/types/product"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const timeAgo = formatDistanceToNow(new Date(product.createdAt), { addSuffix: true })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-md overflow-hidden bg-secondary flex-shrink-0">
            <Image
              src={
                product.imageUrl ||
                `https://source.unsplash.com/random/64x64/?${encodeURIComponent(product.name.split(" ")[0].toLowerCase()) || "/placeholder.svg"},product` ||
                `/placeholder.svg?height=64&width=64&text=${product.name.charAt(0)}`
              }
              alt={product.name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback if the image fails to load
                e.currentTarget.src = `/placeholder.svg?height=64&width=64&text=${product.name.charAt(0)}`
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{product.name}</h3>
            <p className="text-muted-foreground text-sm line-clamp-2">{product.tagline}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <ArrowUpCircle size={14} />
            <span>{product.votesCount}</span>
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        {product.description && <p className="text-sm line-clamp-3 mb-3">{product.description}</p>}

        {product.website && (
          <div className="mb-3 text-sm">
            <span className="font-medium">Website: </span>
            <a
              href={product.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline truncate inline-block max-w-[200px]"
            >
              {product.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          {product.makers &&
            product.makers.slice(0, 3).map((maker, index) => (
              <div key={`maker-${index}-${maker.id}`} className="flex items-center gap-1">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={`/placeholder.svg?height=24&width=24&text=${maker.name.charAt(0)}`} />
                  <AvatarFallback>{maker.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-xs">{maker.name}</span>
              </div>
            ))}
          {product.makers && product.makers.length > 3 && (
            <span className="text-xs text-muted-foreground">+{product.makers.length - 3} more</span>
          )}
        </div>
        {(product.emails?.length ||
          product.twitterHandles?.length ||
          product.facebookLinks?.length ||
          product.instagramLinks?.length ||
          product.linkedinLinks?.length ||
          product.contactLinks?.length) && (
          <div className="mt-3 pt-3 border-t border-border">
            <h4 className="text-xs font-medium mb-2">Contact Information</h4>
            <div className="flex flex-wrap gap-2">
              {product.emails && product.emails.length > 0 && (
                <div className="flex items-center gap-1">
                  <Mail size={12} className="text-muted-foreground" />
                  <span className="text-xs">{product.emails[0]}</span>
                  {product.emails.length > 1 && (
                    <span className="text-xs text-muted-foreground">+{product.emails.length - 1}</span>
                  )}
                </div>
              )}

              {product.twitterHandles && product.twitterHandles.length > 0 && (
                <div className="flex items-center gap-1">
                  <Twitter size={12} className="text-muted-foreground" />
                  <span className="text-xs">{product.twitterHandles[0]}</span>
                  {product.twitterHandles.length > 1 && (
                    <span className="text-xs text-muted-foreground">+{product.twitterHandles.length - 1}</span>
                  )}
                </div>
              )}

              {product.facebookLinks && product.facebookLinks.length > 0 && (
                <div className="flex items-center gap-1">
                  <Facebook size={12} className="text-muted-foreground" />
                  <span className="text-xs">Facebook</span>
                  {product.facebookLinks.length > 1 && (
                    <span className="text-xs text-muted-foreground">+{product.facebookLinks.length - 1}</span>
                  )}
                </div>
              )}

              {product.instagramLinks && product.instagramLinks.length > 0 && (
                <div className="flex items-center gap-1">
                  <Instagram size={12} className="text-muted-foreground" />
                  <span className="text-xs">Instagram</span>
                  {product.instagramLinks.length > 1 && (
                    <span className="text-xs text-muted-foreground">+{product.instagramLinks.length - 1}</span>
                  )}
                </div>
              )}

              {product.linkedinLinks && product.linkedinLinks.length > 0 && (
                <div className="flex items-center gap-1">
                  <Linkedin size={12} className="text-muted-foreground" />
                  <span className="text-xs">LinkedIn</span>
                  {product.linkedinLinks.length > 1 && (
                    <span className="text-xs text-muted-foreground">+{product.linkedinLinks.length - 1}</span>
                  )}
                </div>
              )}

              {product.contactLinks && product.contactLinks.length > 0 && (
                <div className="flex items-center gap-1">
                  <Link size={12} className="text-muted-foreground" />
                  <span className="text-xs">Contact Page</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <a href={product.url} target="_blank" rel="noopener noreferrer">
            View on PH
          </a>
        </Button>
        {product.website && (
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <a href={product.website} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="mr-1" />
              Website
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

