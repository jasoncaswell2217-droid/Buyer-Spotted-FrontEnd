import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure GOOGLE_API_KEY is mapped from GEMINI_API_KEY if needed, before handlers load
if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
}

const app = express();
app.use(express.json());

// PORT BINDING: Must listen on Port 10000 or process.env.PORT as per CRITICAL SYSTEM ARCHITECTURE GUARDRAILS
const PORT = Number(process.env.PORT) || 10000;

// Shopify configuration from developmental credentials
const SHOPIFY_SHOP = "nqwmay-2e.myshopify.com";
const SHOPIFY_CLIENT_ID = "311e02f6cfe10698794857fde65f5ece";
const SHOPIFY_CLIENT_SECRET = "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";

// Server-side cache for Shopify Access Token (valid for 24 hours)
let cachedShopifyToken: string | null = null;
let tokenExpiryTimestamp: number = 0;

/**
 * Fetch a valid 24-hour Shopify OAuth Access Token using Client Credentials grant flow
 */
async function fetchShopifyToken(): Promise<string | null> {
  // If SHOPIFY_CLIENT_SECRET is already a Storefront Access Token, return it immediately
  if (SHOPIFY_CLIENT_SECRET && SHOPIFY_CLIENT_SECRET.startsWith("shpss_")) {
    return SHOPIFY_CLIENT_SECRET;
  }

  const now = Date.now();
  // Return cached token if valid (leaving a 10-minute safety window)
  if (cachedShopifyToken && now < (tokenExpiryTimestamp - 600000)) {
    console.log("Using cached Shopify Storefront Access Token");
    return cachedShopifyToken;
  }

  console.log(`Authenticating with Shopify shop: ${SHOPIFY_SHOP} using Client Credentials...`);
  try {
    const response = await fetch(`https://${SHOPIFY_SHOP}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Shopify Access Token request failed (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (data.access_token) {
      cachedShopifyToken = data.access_token;
      // Expiration time (standard is 24 hours / 86400 seconds)
      const expiresInMs = (data.expires_in || 86400) * 1000;
      tokenExpiryTimestamp = now + expiresInMs;
      console.log(`Shopify authenticated successfully. Token caches for ~24 hours.`);
      return cachedShopifyToken;
    }
  } catch (err) {
    console.error("Error fetching Shopify credentials:", err);
  }
  return null;
}

// Sleek, high-concept luxury tech fallback products to guarantee page is beautifully occupied 
const FALLBACK_PRODUCTS = [
  {
    id: "prod_01J0ZXY",
    title: "“AURA II” Biometric Smart Mirror",
    description: "A continuous frame of bead-blasted dark aluminum enclosing high-reflection electrochromic glass. Features an interactive transparent OLED layer that displays ambient real-time biomechanics, biometric analysis, and custom aesthetic widgets. Hand-finished back.",
    handle: "aura-biometric-smart-mirror",
    priceMin: { amount: "1450.00", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&auto=format&fit=crop", altText: "AURA Mirror Active" },
      { url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop", altText: "Aura Interface Macro" }
    ],
    variants: [
      { id: "46294328508655", title: "Carbon Slate Matte (Standard)", price: { amount: "1450.00", currencyCode: "USD" }, availableForSale: true },
      { id: "46294328541423", title: "Obsidian Titanium (Studio)", price: { amount: "1850.00", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Aura Architecture",
    specifications: {
      "Dimensions": "120cm x 60cm x 4cm",
      "Display Cores": "Transparent OLED Micro-Panel",
      "Sensors": "Local Depth LIDAR & Thermopics",
      "Mounting": "Zero-Bezel Magnetic Railing"
    },
    curatedVerdict: "A masterpiece of sensory silence. Eliminates visual screen noise in favor of deep biometric reflection."
  },
  {
    id: "prod_02K1YXZ",
    title: "“SABRE-9” Stealth Headphones",
    description: "Matte black computational audio, engineered with Grade 5 milled titanium sliders and solid carbon-fiber acoustic acoustic chambers. Powered by dual electrostatic drivers for absolute separation and minimal acoustic bounce.",
    handle: "sabre-9-headphones",
    priceMin: { amount: "890.00", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop", altText: "SABRE-9 Core Profile" },
      { url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop", altText: "Sensory Cup Mesh detail" }
    ],
    variants: [
      { id: "46294328574191", title: "Stealth Slate Matte", price: { amount: "890.00", currencyCode: "USD" }, availableForSale: true },
      { id: "46294328606959", title: "Raw Brushed Carbon", price: { amount: "1100.00", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Sensory Enclosures",
    specifications: {
      "Accoustic Core": "50mm Solid Electrostatic Ribbon",
      "Frequency Envelope": "4Hz - 45,000Hz (True High-Res)",
      "ANC Level": "Custom 48dB Spatial Multi-Mic Array",
      "Playtime Link": "42 Hours lossless DAC playback"
    },
    curatedVerdict: "Near-total isolation from office hums and travel roar. Creates a heavy, matte-black bubble of sound."
  },
  {
    id: "prod_03L2ZXW",
    title: "“OBSIDIAN” Titanium Timepiece",
    description: "An open skeleton structural movement, encased in sand-blasted dark titanium with double-domed anti-reflective sapphire crystal. Features a secondary microscopic OLED sub-indicator that relays encrypted ledger status and biometric pulse loops.",
    handle: "obsidian-titanium-timepiece",
    priceMin: { amount: "2800.00", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&auto=format&fit=crop", altText: "OBSIDIAN Mechanical Assembly" },
      { url: "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=800&auto=format&fit=crop", altText: "Titanium casing close" }
    ],
    variants: [
      { id: "46294328639727", title: "Grade 5 DLC Slate Silver", price: { amount: "2800.00", currencyCode: "USD" }, availableForSale: true },
      { id: "46294328672495", title: "Polished Carbon Infused", price: { amount: "3200.00", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Precision Horology",
    specifications: {
      "Crown Material": "Grade 5 Titanium Satin Finish",
      "Movement system": "Automatic Chronograph Caliber SP-3",
      "Waterproofing": "100m Hydrostatic Rating",
      "Smart Relay": "Low-Energy secure physical crypto key anchor"
    },
    curatedVerdict: "A mechanical masterpiece that reminds you why tactile engineering is superior to disposable flat-screen smartwatches."
  },
  {
    id: "prod_04M3WYV",
    title: "“MONOLITH-140” Telemetry Power Core",
    description: "Bead-blasted solid aluminum block housing high-density graphene batteries with 140W fast-charging capabilities. Outfitted with an integrated low-draw e-ink display showing micro-voltage currents, operating temperature, and health indicators.",
    handle: "monolith-140-graphene-core",
    priceMin: { amount: "220.00", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1609592424085-f6745112f45d?w=800&auto=format&fit=crop", altText: "MONOLITH brutalist block layout" }
    ],
    variants: [
      { id: "46294328705263", title: "Satin Solid Billet Silver", price: { amount: "220.00", currencyCode: "USD" }, availableForSale: true },
      { id: "46294328738031", title: "Anodized Slate Black", price: { amount: "240.00", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Power Reservoirs",
    specifications: {
      "Capacity Core": "27,600mAh (99.3Wh FAA Flight Legal)",
      "Output Channels": "2x USB-C (140W max), 1x High-Amp USB-A",
      "Display System": "Realtime Low-Draw E-Ink telemetry UI",
      "Power Core": "Graphene solid state hybrid cooling"
    },
    curatedVerdict: "Pure solid-metal weight in an era of flimsy plastic power banks. An industrial workhorse of extreme elegance."
  },
  {
    id: "prod_05N4VUX",
    title: "“NIGHTWALKER” Cybernetic Modular Shell",
    description: "Ultra-matte waterproof outer barrier constructed from an experimental self-healing liquid-repellent synthetic knit. Engineered with seamless laser fusion joints, self-closing storm gutters, and modular magnetic pockets.",
    handle: "nightwalker-cybernetic-pocket-shell",
    priceMin: { amount: "1150.00", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&auto=format&fit=crop", altText: "NIGHTWALKER Silhouette Wear" },
      { url: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800&auto=format&fit=crop", altText: "Modular utility alignment" }
    ],
    variants: [
      { id: "46294328770799", title: "Size Medium / Midnight Obsidian", price: { amount: "1150.00", currencyCode: "USD" }, availableForSale: true },
      { id: "46294328803567", title: "Size Large / Midnight Obsidian", price: { amount: "1150.00", currencyCode: "USD" }, availableForSale: true },
      { id: "46294328836335", title: "Size X-Large / Midnight Obsidian", price: { amount: "1150.00", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Technical Outwear",
    specifications: {
      "Fabric Core": "3-Layer G-Tec Hydrophobic Membrane",
      "Clasp Arrays": "German Fidlock sliding rare-earth magnets",
      "Aeration": "Underarm concealed zipper ventilation channels",
      "Layout Tech": "Double modular accessory rails, 2 isolated internal security sleeves"
    },
    curatedVerdict: "An architectural shield for urban traversing. Completely repels heavy downpours while keeping a razor-sharp profile drape."
  }
];

/**
 * Helper: Handle query operations for both Shopify Admin and Storefront APIs
 */
async function getProductsResponseData(token: string): Promise<{ products: any[]; live: boolean; error?: boolean; emptyShop?: boolean }> {
  const isStorefrontToken = token.startsWith("shpss_");

  if (!isStorefrontToken) {
    // 1. Try Shopify Admin GraphQL API (Highly recommended for custom Client Credentials tokens)
    const adminQuery = `
      query GetProducts {
        products(first: 20) {
          edges {
            node {
              id
              title
              description
              handle
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const adminUrl = `https://${SHOPIFY_SHOP}/admin/api/2024-04/graphql.json`;
      console.log("Querying Shopify Admin GraphQL API...");
      const adminResponse = await fetch(adminUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query: adminQuery })
      });

      if (adminResponse.ok) {
        const result = await adminResponse.json() as any;
        if (!result.errors && result?.data?.products?.edges) {
          const fetchedEdges = result.data.products.edges;
          console.log(`Successfully fetched ${fetchedEdges.length} products via Admin GraphQL API.`);
          
          if (fetchedEdges.length === 0) {
            return { products: FALLBACK_PRODUCTS, live: true, emptyShop: true };
          }

          const mappedProducts = fetchedEdges.map((edge: any) => {
            const node = edge.node;
            const priceMin = node.priceRangeV2?.minVariantPrice || { amount: "0.00", currencyCode: "USD" };
            const images = (node.images?.edges || []).map((e: any) => ({
              url: e.node.url,
              altText: e.node.altText || node.title
            }));
            const variants = (node.variants?.edges || []).map((e: any) => ({
              id: e.node.id,
              title: e.node.title,
              price: { amount: e.node.price || priceMin.amount, currencyCode: priceMin.currencyCode || "USD" },
              availableForSale: true
            }));

            return {
              id: node.id,
              title: node.title,
              description: node.description || "",
              handle: node.handle,
              priceMin: priceMin,
              images: images.length > 0 ? images : [{ url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=600", altText: "No product image" }],
              variants: variants,
              category: "Shopify Vault",
            };
          });

          return { products: [...mappedProducts, ...FALLBACK_PRODUCTS], live: true };
        } else {
          console.warn("Shopify Admin API returned query errors, attempting storefront fallback:", result.errors);
        }
      } else {
        console.warn(`Shopify Admin API returned error response code: ${adminResponse.status}`);
      }
    } catch (err) {
      console.warn("Exception during Admin GraphQL request, attempting storefront API:", err);
    }
  }

  // 2. Fallback to Storefront GraphQL API
  const storefrontQuery = `
    query GetProducts {
      products(first: 20) {
        edges {
          node {
            id
            title
            description
            handle
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const storefrontUrl = `https://${SHOPIFY_SHOP}/api/2024-04/graphql.json`;
    console.log("Querying Shopify Storefront API as fallback or bypass...");
    const response = await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: storefrontQuery })
    });

    if (response.ok) {
      const result = await response.json() as any;
      if (!result.errors && result?.data?.products?.edges) {
        const fetchedEdges = result.data.products.edges;
        if (fetchedEdges.length === 0) {
          return { products: FALLBACK_PRODUCTS, live: true, emptyShop: true };
        }

        const mappedProducts = fetchedEdges.map((edge: any) => {
          const node = edge.node;
          const priceMin = node.priceRange?.minVariantPrice || { amount: "0.00", currencyCode: "USD" };
          const images = (node.images?.edges || []).map((e: any) => ({
            url: e.node.url,
            altText: e.node.altText || node.title
          }));
          const variants = (node.variants?.edges || []).map((e: any) => ({
            id: e.node.id,
            title: e.node.title,
            price: e.node.price || priceMin,
            availableForSale: e.node.availableForSale !== false
          }));

          return {
            id: node.id,
            title: node.title,
            description: node.description || "",
            handle: node.handle,
            priceMin: priceMin,
            images: images.length > 0 ? images : [{ url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=600", altText: "No product image" }],
            variants: variants,
            category: "Shopify Storefront",
          };
        });

        return { products: [...mappedProducts, ...FALLBACK_PRODUCTS], live: true };
      }
    }
  } catch (err) {
    console.warn("Storefront query failed.", err);
  }

  // 3. Complete fallback
  console.log("Both Admin and Storefront API queries unsuccessful. Reverting to custom cached luxury products.");
  return { products: FALLBACK_PRODUCTS, live: false, error: true };
}

/**
 * API: Get live products using cached Shopify credentials
 */
app.get("/api/products", async (req, res) => {
  const token = await fetchShopifyToken();
  if (!token) {
    console.warn("Using fallback neo-noir curated catalog due to Shopify OAuth omission");
    return res.json({ products: FALLBACK_PRODUCTS, live: false });
  }

  const result = await getProductsResponseData(token);
  return res.json(result);
});

/**
 * Main unified chat & actions router for network compliance
 * All client actions can route through '/api/gemini-chat' to ensure clean monolithic routing in Cloud Run/Render
 */
app.post("/api/gemini-chat", async (req, res) => {
  const { action, message, history, productId } = req.body;

  // 1. Handle special non-chat actions multiplexed to this route for strict routing guardrail compliance
  if (action === "get-products") {
    // Return products 
    const token = await fetchShopifyToken();
    if (!token) {
      return res.json({ products: FALLBACK_PRODUCTS, live: false });
    }
    const result = await getProductsResponseData(token);
    return res.json(result);
  }

  // 2. Main Chat Handler - Handles Gemini AI Luxury Persona response
  if (!message) {
    return res.status(400).json({ error: "Message content or specific action type is required" });
  }

  // Invoke inline initialization strictly per CRITICAL SYSTEM ARCHITECTURE GUARDRAILS
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

  const systemInstruction = `You are "SpottedAI", the elite curating advisor for "BuyerSpotted", an ultra-exclusive neo-noir digital boutique. 
  You speak with quiet sophistication, intellectual sharpness, and supreme confidence. Avoid exclamation marks, sales jargon, bubbly emojis, or repetitive introductory phrases. 
  
  Your primary objective is to evaluate user preferences, offer styling suggestions, and discuss the curated BuyerSpotted collection.
  The BuyerSpotted Catalog consists of:
  1. “AURA II” Biometric Smart Mirror - $1,450.00
  2. “SABRE-9” Stealth Electrostatic Headphones - $890.00
  3. “OBSIDIAN” Titanium Mechanical Timepiece - $2,800.00
  4. “MONOLITH-140” Solid Telemetry Power Core - $220.00
  5. “NIGHTWALKER” Cybernetic Modular Shell - $1,150.00

  Explain products in terms of tactile elegance, material beauty (electrochromic glass, aerospace billet aluminum, carbon fiber, Grade 5 DLC titanium), and functional isolation.
  Always keep answers elegant, highly scannable, under 110 words, and formatted with clean paragraphs. Translate user styles into dark, cinematic luxury concepts.`;

  try {
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const response = await chat.sendMessage({ message });
    return res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini route error details:", error);
    return res.status(500).json({ error: error.message || "Engine experienced a premium signal blockage." });
  }
});

/**
 * Client development static server & Vite live middleware configuration
 */
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Inject Vite dev environment as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static compiled assets in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BuyerSpotted Backend Server] Online & listening on http://localhost:${PORT}`);
  });
}

startServer();
