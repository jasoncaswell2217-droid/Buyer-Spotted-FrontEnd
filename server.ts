import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
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
    id: "prod_amazon_red_light",
    title: "“SOLIS” Cordless Red Light Therapy Belt",
    description: "Unchain your recovery with Solis. Features custom clinical-strength 660nm red light and 850nm near-infrared emitters. Ergonomically tailored with an elastic velvet wrap and an ultra-lightweight rechargeable 5000mAh battery pack. Offers three adjustable phototherapy modes and specialized thermal pulse loops.",
    handle: "solis-cordless-red-light-belt",
    priceMin: { amount: "39.99", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&auto=format&fit=crop", altText: "Solis Active Light Wellness" }
    ],
    variants: [
      { id: "var_red_light_01", title: "Midnight Slate Soft", price: { amount: "39.99", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Wellness Devices",
    specifications: {
      "Emitters": "105 Clinical-Grade SMD LEDs",
      "Wavelengths": "660nm Red & 850nm Near-Infrared",
      "Power Cell": "5000mAh USB-C Rechargeable Lith-Ion",
      "Wrap Band": "Adjustable Compression Velvet Strap"
    },
    curatedVerdict: "Ditch the restrictive cords of yesterday. Solis delivers clinical-strength near-infrared light with complete mobile freedom.",
    amazonUrl: "https://www.amazon.com/Cordless-Infrared-Adjustable-Portable-Relaxation/dp/B0GK7GWBPY"
  },
  {
    id: "prod_amazon_reedle_shot",
    title: "“REEDLE 100” Dermal Micro-Spicule Essence",
    description: "A groundbreaking skin stimulator by VT Cosmetics. Formulated with microscopic ocean-derived Silica Reedles that micro-penetrate the skin barrier to create structural pathways, driving active Hyaluronic acid and botanical Cica deep into the dermis. Enhances elasticity, smooths rough texture, and minimizes visible pores.",
    handle: "reedle-100-dermal-essence",
    priceMin: { amount: "32.00", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&auto=format&fit=crop", altText: "Reedle 100 Essence Bottle" }
    ],
    variants: [
      { id: "var_reedle_01", title: "Standard 50ml Dispenser", price: { amount: "32.00", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Dermal Essence",
    specifications: {
      "Active Core": "95,000 Micro-Physical Reedle Spicules",
      "Soothing Complex": "Cica Extract & Triple Hyaluronic Acid",
      "Texture": "Lightweight Absorbent Essence",
      "Target Indicator": "Uneven Tone, Open Pores, Sluggish Cell Cycles"
    },
    curatedVerdict: "Not a standard facial serum. It tingles upon touch as thousands of micro-needles dynamically reset your texture and pore density.",
    amazonUrl: "https://www.amazon.com/VT-COSMETICS-Hydrated-Poreless-Hyaluronic/dp/B0C2TQ24VY"
  },
  {
    id: "prod_amazon_joola_paddle",
    title: "“HYPERION CFS” Carbon Pickleball Paddle",
    description: "Take supreme control of the court with the official weapon of world champion Ben Johns. Structured with a premium Carbon Friction Surface (CFS) for raw slice and spin, reinforced with a high-density Hyperfoam Edge Wall to maximize sweet-spot stability, and a fully reactive honeycomb polypropylene core.",
    handle: "joola-hyperion-cfs-paddle",
    priceMin: { amount: "219.95", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop", altText: "Hyperion Core Paddle Profile" }
    ],
    variants: [
      { id: "var_joola_01", title: "Carbon 16mm (Ben Johns Signature)", price: { amount: "219.95", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Aero Sport",
    specifications: {
      "Surface Technology": "Carbon-Friction Thermoformed Wrap (CFS)",
      "Core Material": "Reactive Honeycomb Polypropylene (16mm)",
      "Handle Length": "5.5 inches Aero-Flow Traction",
      "Weight Profile": "8.4 oz Balanced Sweetspot"
    },
    curatedVerdict: "The ultimate synthesis of power, control, and brutalist spin of the ball. An absolute requirement for advanced court mechanics.",
    amazonUrl: "https://www.amazon.com/JOOLA-Johns-Hyperion-Pickleball-Paddle/dp/B0BFT2YGN7"
  },
  {
    id: "prod_amazon_govee_lights",
    title: "“AURA GLOW” Permanent Smart Outdoor Lights",
    description: "Settle your architectural illumination permanently with Govee eaves lights. This fully waterproof system features brilliant, individually addressable RGBIC lights that can display up to 16 million colors simultaneously. Program stunning ambient flows, schedule lighting routines via Bluetooth, and integrate with smart assistants seamlessly.",
    handle: "govee-permanent-outdoor-lights",
    priceMin: { amount: "199.99", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1565538810643-b5abd3cb82ee?w=800&auto=format&fit=crop", altText: "Aura Glow Architectural Illumination" }
    ],
    variants: [
      { id: "var_govee_01", title: "50-Foot 30-Light Set", price: { amount: "199.99", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Architectural Light",
    specifications: {
      "Weatherproofing": "IP67 Waterproof Strip, IP65 Adapter Support",
      "Color Spectrum": "RGBIC individually addressable, 16M Colors",
      "Smart Controller": "Govee Home App (WiFi + Bluetooth) & Voice Commands",
      "Working Life": "50,000 Hours Durability Rating"
    },
    curatedVerdict: "Never struggle with tangled seasonal lights again. These mount flush with your eaves to outline your home in pure, programmable light waves.",
    amazonUrl: "https://www.amazon.com/Govee-Dimmable-Backyard-Waterproof-Assistant/dp/B0CT4ZR4Y9"
  },
  {
    id: "prod_amazon_sony_neckband",
    title: "“SRS-NS7” Personal Cinema Neckband Speaker",
    description: "Envelop yourself in theatrical 3D sound waves without disturbing others. Sony's premium comfortable wireless wearable speaker creates an individual acoustic space around you. Equipped with upward-firing full-range speakers, passive bass radiators, and 360 Spatial Sound Personalizer technology for ultra-clear Dolby Atmos experiences.",
    handle: "sony-srs-ns7-neckband-speaker",
    priceMin: { amount: "299.99", currencyCode: "USD" },
    images: [
      { url: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop", altText: "SRS-NS7 Personal Space Sound" }
    ],
    variants: [
      { id: "var_sony_01", title: "Midnight Charcoal Tech", price: { amount: "299.99", currencyCode: "USD" }, availableForSale: true }
    ],
    category: "Sensory Audio",
    specifications: {
      "Accoustic Drivers": "X-Balanced Speaker Units w/ Dual Passive Radiators",
      "Spatial Protocol": "360 Spatial Sound Personalizer Engine (Dolby Atmos)",
      "Weather Resistance": "IPX4 Ergonomic Splash-Resistant Frame",
      "Wireless Link": "Bluetooth 5.0 Low-Latency Transmitter included"
    },
    curatedVerdict: "Creates a tight, high-fidelity sound bubble. It mimics a full 5.1.2 home theater configuration right around your collarbones.",
    amazonUrl: "https://www.amazon.com/Sony-Comfortable-Lightweight-Technology-Splash-Resistant/dp/B098TW4J7Y"
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

  // 1b. Handle specialized ClickBank marketplace research actions
  if (action === "fetch-clickbank-products") {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    try {
      console.log("[Digital Warehouse] Querying Gemini for ClickBank high-converting trending offers (strict schema verification)...");
      const systemInstruction = `You are an elite, advanced ClickBank affiliate marketing AI product researcher with 100+ years of domain experience.
      You possess granular knowledge of the highest-converting, top-selling, and trending digital & physical marketplace campaigns across fitness, health, and wealth.
      Your goal is to suggest exactly 4 live, top-performing health, fitness, or wealth product options configured for database injection.
      
      To prevent inaccurate metric generation for 'Gravity Score' and 'Avg $/Conversion', you must strictly parse and adhere to ClickBank's official structural data attributes:
      1. 'Gravity Score' (Grav): Must be extracted as the literal rolling 12-week momentum value. Strictly return a decimal/number between 50.0 and 200.0. Do not calculate, estimate, or round this number arbitrarily.
      2. 'Avg $/Conversion': This must reflect the full Average Payout Value (APV) including initial sales, upsell pathways, and rebill totals. Map this directly as a decimal value to expected_payout.
      3. 'ClickBank HopLink URL': Format this programmatically as: https://wolfjay26.[vendor_id].hop.clickbank.net where [vendor_id] matches the official vendor tag representing their marketplace handle (e.g. alpilean, puravive, javaburn, sugardef).
      
      For each of the 4 offers, you must output:
      - title: "Literal Vendor Listing Name"
      - description: "Professional direct-response copy summary of the funnel/angle"
      - expected_payout: Float (represent full Average Payout Value)
      - gravity_score: Float (must be correct and up to date as it shows on the ClickBank marketplace, strictly between 50.0 and 200.0)
      - conversion_label: "String matching '$XX.XX Average $/Conversion' representing average payout value"
      - image_url: "High-quality placeholder image match using Unsplash (e.g. healthcare, supplements, weights, fitness, wealth)"
      - clickbank_hoplink_url: "https://wolfjay26.[vendor_id].hop.clickbank.net"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Scan the ClickBank marketplace right now for the top 4 health, fitness, or wealth offers meeting our 50-200 gravity criteria. Map them strictly to the specified JSON format and return a JSON list of exactly 4 items containing title, description, expected_payout, gravity_score, conversion_label, image_url, and clickbank_hoplink_url.",
        config: {
          systemInstruction,
          temperature: 0.82,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                expected_payout: { type: Type.NUMBER },
                gravity_score: { type: Type.NUMBER },
                conversion_label: { type: Type.STRING },
                image_url: { type: Type.STRING },
                clickbank_hoplink_url: { type: Type.STRING }
              },
              required: ["title", "description", "expected_payout", "gravity_score", "conversion_label", "image_url", "clickbank_hoplink_url"]
            }
          }
        }
      });

      const dataText = response.text || "[]";
      const parsedData = JSON.parse(dataText.trim());
      return res.json({ products: parsedData });
    } catch (error: any) {
      console.error("[Digital Warehouse] Error executing ClickBank research query:", error);
      return res.status(500).json({ error: error.message || "Engine blocked on ClickBank market analysis." });
    }
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
  1. “SOLIS” Cordless Red Light Therapy Belt - $39.99
  2. “REEDLE 100” Dermal Micro-Spicule Essence - $32.00
  3. “HYPERION CFS” Carbon Pickleball Paddle - $219.95
  4. “AURA GLOW” Permanent Smart Outdoor Lights - $199.99
  5. “SRS-NS7” Personal Cinema Neckband Speaker - $299.99

  Explain products in terms of tactile elegance, material beauty (micro-spicule silica, reactive polypropylene honeycomb, custom carbon-friction, lightweight 3D neckband spatial audio, cordless phototherapy), and functional isolation.
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
 * SEO XML Sitemap Router
 */
app.get("/sitemap.xml", (req, res) => {
  res.header("Content-Type", "application/xml");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Routes -->
  <url>
    <loc>https://buyerspotted.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://buyerspotted.com/blog</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- Curated High-Gravity Tech Vault Offers -->
  <url>
    <loc>https://buyerspotted.com/products/solis-cordless-red-light-belt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://buyerspotted.com/products/reedle-100-dermal-essence</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://buyerspotted.com/products/joola-hyperion-cfs-paddle</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://buyerspotted.com/products/govee-permanent-outdoor-lights</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://buyerspotted.com/products/sony-srs-ns7-neckband-speaker</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;
  res.send(sitemap);
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
