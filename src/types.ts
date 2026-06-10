export interface ShopifyProductImage {
  url: string;
  altText: string | null;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  priceMin: {
    amount: string;
    currencyCode: string;
  };
  priceMax?: {
    amount: string;
    currencyCode: string;
  };
  images: ShopifyProductImage[];
  variants: ShopifyVariant[];
  category?: string;
  specifications?: Record<string, string>;
  curatedVerdict?: string;
  amazonUrl?: string;
  cbVendor?: string;
  cbAffiliate?: string;
  gravity?: number;
  clickbankUrl?: string;
  conversionLabel?: string;
  seoHeadline?: string;
  whoItIsFor?: string;
  whyItWorks?: string;
  seoKeywords?: string;
  is_subscription?: boolean;
  refund_window?: string;
  included_features?: string[];
}

export interface CartItem {
  product: ShopifyProduct;
  variant: ShopifyVariant;
  quantity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  status: 'draft' | 'published';
  visibility: 'public' | 'admins' | 'members';
  seoKeywords?: string;
  readingTime?: number;
  ctaText?: string;
  ctaLink?: string;
  imageUrl?: string;
  authorName?: string;
  viewCount: number;
  featuredProductId?: string; // tie to specific product
  createdAt: any;
  updatedAt: any;
}
