import { useState, useEffect, useRef, FormEvent } from "react";
import { 
  ShoppingBag, 
  MessageCircle, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Edit, 
  Sparkles, 
  Cpu, 
  Layers, 
  Eye, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Sliders, 
  ArrowUpRight,
  Info,
  Lock,
  ShieldAlert,
  LogOut,
  ShieldCheck,
  ChevronDown,
  BarChart3,
  Clock,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ShopifyProduct, ShopifyVariant, CartItem, ChatMessage } from "./types";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, signInWithGoogle, logOutUser, syncUserProfile, UserRole, UserProfile, handleFirestoreError, OperationType } from "./firebase";

const mapFirestoreProductToShopify = (id: string, docData: any): ShopifyProduct => {
  const priceStr = Number(docData.price || 0).toFixed(2);
  const cbVendor = docData.cbVendor || "";
  const cbAffiliate = docData.cbAffiliate || "";
  const gravityValue = Number(docData.gravity || 0);
  const hoplink = docData.affiliateUrl || `https://${cbAffiliate}.${cbVendor}.hop.clickbank.net`;

  return {
    id: id,
    title: docData.title || "",
    description: docData.description || "",
    handle: (docData.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    priceMin: {
      amount: priceStr,
      currencyCode: "USD"
    },
    images: [{
      url: docData.imageUrl || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600",
      altText: docData.title || null
    }],
    variants: [{
      id: "var_" + (cbVendor || id),
      title: "Standard",
      price: {
        amount: priceStr,
        currencyCode: "USD"
      },
      availableForSale: true
    }],
    category: "ClickBank Curated",
    specifications: {
      "ClickBank Vendor": cbVendor || "N/A",
      "Affiliate ID": cbAffiliate || "N/A",
      "Gravity: Score": gravityValue > 0 ? String(gravityValue.toFixed(1)) : "N/A",
      "Conversion Label": docData.conversionLabel || `$${priceStr} / sale`,
      "Redirection": "ClickBank Network",
      "Registry ID": id.slice(0, 8).toUpperCase()
    },
    curatedVerdict: "Top tier ClickBank digital or physical curation. Streamlined mechanically for peak affiliate conversions.",
    amazonUrl: hoplink,
    clickbankUrl: hoplink,
    cbVendor,
    cbAffiliate,
    gravity: gravityValue,
    conversionLabel: docData.conversionLabel || `$${priceStr} expected payout`,
    seoHeadline: docData.seoHeadline || "",
    whoItIsFor: docData.whoItIsFor || "",
    whyItWorks: docData.whyItWorks || "",
    seoKeywords: docData.seoKeywords || "",
    is_subscription: docData.is_subscription === true,
    refund_window: docData.refund_window || "60-Day",
    included_features: Array.isArray(docData.included_features) ? docData.included_features : []
  };
};

const getProductPlaceholderImage = (title: string): string => {
  const t = (title || "").toLowerCase();
  if (t.includes("astrology") || t.includes("moon")) {
    return "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600";
  }
  if (t.includes("brain") || t.includes("billionaire") || t.includes("wealth") || t.includes("dubai")) {
    return "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600";
  }
  if (t.includes("flora") || t.includes("health") || t.includes("vision")) {
    return "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600";
  }
  if (t.includes("neuro") || t.includes("nootropic") || t.includes("serge")) {
    return "https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=600";
  }
  if (t.includes("pillow") || t.includes("derila") || t.includes("foam")) {
    return "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600";
  }
  return "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600";
};

const getClickBankHoplinkUrl = (p: any): string => {
  let inferredVendor = "vendor";
  if (p.affiliate_tools_url) {
    try {
      const urlObj = new URL(p.affiliate_tools_url);
      const hostParts = urlObj.hostname.toLowerCase().split(".");
      if (hostParts.length >= 2) {
        inferredVendor = hostParts[hostParts.length - 2];
        if (inferredVendor === "www" && hostParts.length >= 3) {
          inferredVendor = hostParts[hostParts.length - 3];
        }
      }
    } catch (e) {
      // ignore
    }
  }
  if (inferredVendor === "vendor" || inferredVendor === "com" || inferredVendor === "net" || !inferredVendor) {
    inferredVendor = (p.title || "offer").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8);
  }
  return `https://wolfjay26.${inferredVendor}.hop.clickbank.net`;
};

const ADMIN_EMAIL = "jasoncaswell2217@gmail.com";

const formatVisitorArrivalTime = (isoString: string): string => {
  if (!isoString) return "Just now";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) {
      return `Today, ${timeString}`;
    } else if (isYesterday) {
      return `Yesterday, ${timeString}`;
    } else {
      const dateString = date.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${dateString}, ${timeString}`;
    }
  } catch (e) {
    return "Recently";
  }
};

export default function App() {
  // State elements
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [filteredCategory, setFilteredCategory] = useState<string>("All");
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Custom SPA Router state for dynamic /product/:id routing
  const [pathProductId, setPathProductId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/product\/([^/]+)/);
    return match ? match[1] : null;
  });

  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/product\/([^/]+)/);
      setPathProductId(match ? match[1] : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToProduct = (id: string) => {
    window.history.pushState({}, "", `/product/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToHome = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // FAQ state variables
  const [faqOpen1, setFaqOpen1] = useState(false);
  const [faqOpen2, setFaqOpen2] = useState(false);

  
  // Dialog & interface drawers toggles
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveConnection, setIsLiveConnection] = useState(false);

  // Firebase Auth and Custom Profile state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Administration View and ClickBank Form State
  const [isAdminViewActive, setIsAdminViewActive] = useState(false);
  const [adminTab, setAdminTab] = useState<"vault" | "warehouse" | "settings" | "analytics">("vault");
  const [siteSettings, setSiteSettings] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [scannedProducts, setScannedProducts] = useState<any[]>([]);
  const [isFetchingCB, setIsFetchingCB] = useState(false);
  const [fetchErrorCB, setFetchErrorCB] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCbVendor, setFormCbVendor] = useState("");
  const [formCbAffiliate, setFormCbAffiliate] = useState("wolfjay26");
  const [formGravity, setFormGravity] = useState("");
  const [formConversionLabel, setFormConversionLabel] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formAffiliateUrl, setFormAffiliateUrl] = useState("");
  const [formSeoHeadline, setFormSeoHeadline] = useState("");
  const [formWhoItIsFor, setFormWhoItIsFor] = useState("");
  const [formWhyItWorks, setFormWhyItWorks] = useState("");
  const [formSeoKeywords, setFormSeoKeywords] = useState("");
  const [formIsSubscription, setFormIsSubscription] = useState(false);
  const [formRefundWindow, setFormRefundWindow] = useState("60-Day");
  const [formIncludedFeatures, setFormIncludedFeatures] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Analytics Tracking & Admin Dashboard states
  const [sessions, setSessions] = useState<any[]>([]);
  const [visitedPages, setVisitedPages] = useState<string[]>(["Home Catalog"]);

  // Track page navigation of visitors (e.g. Home, viewing a specific product)
  useEffect(() => {
    if (selectedProduct) {
      const pageName = `Product: ${selectedProduct.title}`;
      setVisitedPages(prev => {
        if (prev[prev.length - 1] !== pageName) {
          return [...prev, pageName];
        }
        return prev;
      });
    } else {
      setVisitedPages(prev => {
        if (prev[prev.length - 1] !== "Home Catalog" && prev.length > 1) {
          return [...prev, "Home Catalog"];
        }
        return prev;
      });
    }
  }, [selectedProduct]);

  // Visitor Session Tracking Process (Bypasses Administrators)
  useEffect(() => {
    if (isAuthChecking) return;

    // Do not include Administrator as a visitor
    const isAdmin = userProfile?.role === UserRole.ADMIN || currentUser?.email === ADMIN_EMAIL;
    if (isAdmin) return;

    let sessionId = sessionStorage.getItem("buyerspotted_session_id");
    let startTime = sessionStorage.getItem("buyerspotted_session_start");
    const userAgent = navigator.userAgent || "Unknown Device";

    let browserName = "Firefox";
    if (userAgent.includes("Chrome")) browserName = "Chrome";
    else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browserName = "Safari";
    else if (userAgent.includes("Edge")) browserName = "Edge";

    let deviceType = "Desktop";
    if (/\b(Mobi|Android|iPhone)\b/i.test(userAgent)) {
      deviceType = "Mobile";
    } else if (/\b(iPad|Tablet)\b/i.test(userAgent)) {
      deviceType = "Tablet";
    }

    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
      sessionStorage.setItem("buyerspotted_session_id", sessionId);
      sessionStorage.setItem("buyerspotted_session_start", String(Date.now()));
      startTime = String(Date.now());
    }

    const sessionStartMs = Number(startTime);
    const docRef = doc(db, "sessions", sessionId);

    const syncSession = async () => {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartMs) / 1000);
      try {
        await setDoc(docRef, {
          startTime: new Date(sessionStartMs).toISOString(),
          lastActiveTime: new Date().toISOString(),
          duration: Math.max(0, elapsedSeconds),
          pagesVisited: visitedPages,
          userAgent: `${browserName} (${deviceType})`
        });
      } catch (err) {
        // Silently capture since write permissions are checked
      }
    };

    // Immediate sync
    syncSession();

    // Constant ping loop
    const intervalId = setInterval(syncSession, 12000);

    return () => clearInterval(intervalId);
  }, [userProfile, currentUser, isAuthChecking, visitedPages]);

  // Admin exclusive real-time sessions database feed
  useEffect(() => {
    let unsubscribeSessions: (() => void) | null = null;
    if (userProfile?.role === UserRole.ADMIN) {
      const q = query(collection(db, "sessions"), orderBy("startTime", "desc"));
      unsubscribeSessions = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setSessions(list);
      }, (err) => {
        console.error("Firestore sessions loading error:", err);
      });
    } else {
      setSessions([]);
    }
    return () => {
      if (unsubscribeSessions) unsubscribeSessions();
    };
  }, [userProfile]);

  // Deletion tracking state
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);

  // Chat conversation state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: "Welcome to BuyerSpotted. I am SpottedAI, your private luxury concierge. Tell me your aesthetic inclinations, or ask which of our computational pieces offer acoustic or biometric isolation today.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isAskingAI, setIsAskingAI] = useState(false);
  
  // Active product modal state
  const [modalVariant, setModalVariant] = useState<ShopifyVariant | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to chat bottom on update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatOpen]);

  // Synchronized Firestore Products and Auth States
  useEffect(() => {
    setIsLoading(true);
    
    // Subscribe to products real-time snapshot
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const fbProducts = snapshot.docs.map(docSnap => {
        return mapFirestoreProductToShopify(docSnap.id, docSnap.data());
      });
      setProducts(fbProducts);
      setIsLoading(false);
      setIsLiveConnection(true);
    }, (err) => {
      console.error("Firestore loading error:", err);
      setProducts([]);
      setIsLoading(false);
    });

    // Subscribe to site settings real-time snapshot
    const unsubscribeSettings = onSnapshot(doc(db, "settings", "site"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSiteSettings({
          isOpen: data.isOpen === true
        });
      } else {
        // Default to Closed if document does not exist yet (to keep under construction page intact)
        setSiteSettings({ isOpen: false });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "settings/site");
      setSiteSettings({ isOpen: false });
    });

    // Retrieve stored cart if it exists
    try {
      const savedCart = localStorage.getItem("buyerspotted_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.warn("Could not retrieve saved cart state:", e);
    }

    // Subscribe to Authentication session state changes
    let activeProfileUnsubscribe: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      // Clean up previous active profile listener if one exists
      if (activeProfileUnsubscribe) {
        activeProfileUnsubscribe();
        activeProfileUnsubscribe = null;
      }

      setCurrentUser(u);
      if (u) {
        activeProfileUnsubscribe = syncUserProfile(u.uid, (profile) => {
          if (profile) {
            setUserProfile(profile);
          } else {
            // Profile fallback
            const isEmailAdmin = u.email === "jasoncaswell2217@gmail.com";
            setUserProfile({
              uid: u.uid,
              email: u.email || "",
              role: isEmailAdmin ? UserRole.ADMIN : UserRole.GUEST,
              createdAt: new Date()
            });
          }
          setIsAuthChecking(false);
        });
      } else {
        setUserProfile(null);
        setIsAdminViewActive(false);
        setIsAuthChecking(false);
      }
    });

    return () => {
      unsubscribeProducts();
      unsubscribeSettings();
      unsubscribeAuth();
      if (activeProfileUnsubscribe) {
        activeProfileUnsubscribe();
      }
    };
  }, []);

  // Sync cart with local storage
  const saveCartToStorage = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    try {
      localStorage.setItem("buyerspotted_cart", JSON.stringify(updatedCart));
    } catch (e) {
      console.warn("Could not synchronize cart to storage:", e);
    }
  };

  // Fetch products from ClickBank research agent
  const handleFetchClickBankProducts = async () => {
    // Force clear the table before displaying new results to prevent appending/stacking data
    setScannedProducts([]);
    setFetchErrorCB("");
    setIsFetchingCB(true);

    try {
      const response = await fetch("https://raw.githubusercontent.com/jasoncaswell2217-droid/Buyer-Spotted-FrontEnd/main/public/data/products.json");

      if (!response.ok) {
        throw new Error("Signal interrupted during ClickBank registry retrieval: status " + response.status);
      }

      const list = await response.json();
      if (Array.isArray(list)) {
        setScannedProducts(list);
      } else {
        throw new Error("Invalid response format received from GitHub repository list");
      }
    } catch (err: any) {
      console.error("[Digital Warehouse] Fetch error:", err);
      setFetchErrorCB(err.message || "Temporary error pulling ClickBank live manifest.");
    } finally {
      setIsFetchingCB(false);
    }
  };

  // Import fetched product into active entry form
  const handleImportProduct = (p: any) => {
    const rawPrice = p.avg_per_conversion ? String(p.avg_per_conversion).replace(/[^0-9.]/g, "") : "";
    const generatedHoplink = getClickBankHoplinkUrl(p);

    setFormTitle(p.title || "");
    setFormDescription(`Expert ClickBank campaign leveraging a high-converting ${p.funnel_angle || "direct response"} marketing strategy.`);
    setFormPrice(rawPrice);
    setFormGravity(p.gravity_score ? String(p.gravity_score) : "");
    setFormConversionLabel(p.avg_per_conversion ? `${p.avg_per_conversion} Average $/Conversion` : "$0.00 Average $/Conversion");
    setFormImageUrl(getProductPlaceholderImage(p.title));
    setFormAffiliateUrl(generatedHoplink);
    setFormSeoHeadline(p.seo_headline || `Promote ${p.title || "Offer"} - High Converting ${p.funnel_angle || "Direct Response"} Campaign`);
    setFormWhoItIsFor(p.who_it_is_for || `Perfect for demographic audiences interested in ${p.title || "niche"} wellness and lifestyle optimization solutions.`);
    setFormWhyItWorks(p.why_it_works || "Leverages an engaging high-performance funnel with highly optimized payout EPC metrics, custom affiliate tools, and trusted sales copy.");
    
    // Parse seo_keywords dynamically if it's an array to format as clear, comma-separated string
    const formattedKeywords = p.seo_keywords && Array.isArray(p.seo_keywords)
      ? p.seo_keywords.join(', ')
      : (p.seo_keywords || `${(p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, ", ")}, clickbank offer, promotion, conversion`);
    setFormSeoKeywords(formattedKeywords);
    
    setFormSuccess(`Imported ClickBank offer: "${p.title}" details successfully mapped to fields below.`);
    setFormError("");
    setAdminTab("vault"); // Return to vault tab so they can review and click Deploy
  };

  // Populate form with product data for editing
  const handleEditProduct = (p: ShopifyProduct) => {
    setEditingProductId(p.id);
    setFormTitle(p.title);
    setFormDescription(p.description);
    setFormPrice(p.priceMin.amount);
    setFormGravity(p.gravity ? String(p.gravity) : "");
    setFormConversionLabel(p.conversionLabel || "");
    setFormImageUrl(p.images[0]?.url || "");
    setFormAffiliateUrl(p.clickbankUrl || "");
    setFormSeoHeadline(p.seoHeadline || "");
    setFormWhoItIsFor(p.whoItIsFor || "");
    setFormWhyItWorks(p.whyItWorks || "");
    setFormSeoKeywords(p.seoKeywords || "");
    setFormIsSubscription(p.is_subscription === true);
    setFormRefundWindow(p.refund_window || "60-Day");
    setFormIncludedFeatures(p.included_features ? p.included_features.join("\n") : "");
    setFormError("");
    setFormSuccess("");

    // Scroll form into view
    const formElement = document.getElementById("admin-compilation-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Generate highly premium brand-aligned placeholder images via unsplash key-matching
  const generateThemedImagePlaceholder = () => {
    const rawKeywords = formSeoKeywords.trim();
    const rawTitle = formTitle.trim();
    
    // Parse terms
    const queryTerms: string[] = [];
    
    if (rawTitle) {
      // split title by space and take cleaned key nouns/adjectives
      rawTitle.split(/\s+/).forEach(word => {
        const cleaned = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
        if (cleaned.length > 3 && !["with", "this", "from", "your", "that", "there", "their", "them", "then", "into", "onto", "over", "each", "both", "some", "most", "such", "than"].includes(cleaned)) {
          queryTerms.push(cleaned);
        }
      });
    }

    if (rawKeywords) {
      rawKeywords.split(",").forEach(kw => {
        const cleaned = kw.trim().toLowerCase();
        if (cleaned) {
          queryTerms.push(cleaned);
        }
      });
    }

    // Embed rich brand identity aesthetics for Neo-Noir & Clinical Cyber-Wellness dark gradient theme
    const aestheticCore = [
      "clinical",
      "cyber-wellness",
      "abstract-tech",
      "minimalistic-luxury",
      "neo-noir-aesthetic",
      "dark-gradient",
      "dark-mode-high-contrast"
    ];

    // Combine user inputs with branding to form premium Unsplash query tags (limiting keywords for crisp relevance)
    const allTags = Array.from(new Set([...queryTerms, ...aestheticCore])).slice(0, 8);
    const queryParameter = encodeURIComponent(allTags.join(","));
    
    // Generate a secure, unique, and high-quality placeholder signature to force reload/refresh
    const seed = Math.floor(Math.random() * 99999);
    const resolvedUrl = `https://images.unsplash.com/featured/800x600/?${queryParameter}&sig=${seed}`;
    
    setFormImageUrl(resolvedUrl);
    setFormSuccess("✨ Generated highly relevant, premium neo-noir themed image placeholder!");
  };

  // Option to reset/clear form fields safely
  const handleClearFormFields = () => {
    setFormTitle("");
    setFormDescription("");
    setFormPrice("");
    setFormGravity("");
    setFormConversionLabel("");
    setFormImageUrl("");
    setFormAffiliateUrl("");
    setFormSeoHeadline("");
    setFormWhoItIsFor("");
    setFormWhyItWorks("");
    setFormSeoKeywords("");
    setFormIsSubscription(false);
    setFormRefundWindow("60-Day");
    setFormIncludedFeatures("");
    setFormError("");
    setFormSuccess("");
    setEditingProductId(null);
  };

  // Submit product creation form
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const rawAffiliateUrl = formAffiliateUrl.trim();
    if (!formTitle.trim() || !formDescription.trim() || !formPrice.trim() || !formGravity.trim() || !formImageUrl.trim() || !rawAffiliateUrl) {
      setFormError("Mandatory ClickBank details missing. Title, Description, Expected Payout, Gravity Score, Image URL, and ClickBank Hoplink URL are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setFormSuccess("");

    // Set affiliate to wolfjay26
    const forcedAffiliate = "wolfjay26";
    let cbVendorValue = "curated";

    // Extract ClickBank Vendor ID from Hoplink
    try {
      const parsedUrl = new URL(rawAffiliateUrl);
      const hostname = parsedUrl.hostname.toLowerCase();
      if (hostname.includes("hop.clickbank.net")) {
        const parts = hostname.split(".");
        if (parts.length >= 4) {
          cbVendorValue = parts[1];
        } else if (parts.length === 3) {
          cbVendorValue = parts[0];
        }
      } else {
        const hostParts = hostname.split(".");
        if (hostParts.length > 2 && hostParts[0] !== "www") {
          cbVendorValue = hostParts[0];
        }
      }
    } catch (e) {
      const match = rawAffiliateUrl.match(/(?:[^.]+)\.([^.]+)\.hop\.clickbank\.net/i);
      if (match && match[1]) {
        cbVendorValue = match[1];
      }
    }
    cbVendorValue = cbVendorValue.toLowerCase().trim();

    // Construct Hoplink with forced Affiliate ID wolfjay26
    const finalHoplink = `https://${forcedAffiliate}.${cbVendorValue}.hop.clickbank.net`;

    const parsedIncludedFeatures = formIncludedFeatures
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    try {
      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), {
          title: formTitle.trim(),
          description: formDescription.trim(),
          price: parseFloat(formPrice),
          cbVendor: cbVendorValue,
          cbAffiliate: forcedAffiliate,
          gravity: parseFloat(formGravity) || 0,
          conversionLabel: formConversionLabel.trim() || `$${parseFloat(formPrice).toFixed(2)} expected payout`,
          imageUrl: formImageUrl.trim(),
          affiliateUrl: rawAffiliateUrl,
          seoHeadline: formSeoHeadline.trim(),
          whoItIsFor: formWhoItIsFor.trim(),
          whyItWorks: formWhyItWorks.trim(),
          seoKeywords: formSeoKeywords.trim(),
          is_subscription: formIsSubscription,
          refund_window: formRefundWindow.trim() || "60-Day",
          included_features: parsedIncludedFeatures
        });
        setFormSuccess("ClickBank affiliate piece successfully updated!");
        setEditingProductId(null);
      } else {
        await addDoc(collection(db, "products"), {
          title: formTitle.trim(),
          description: formDescription.trim(),
          price: parseFloat(formPrice),
          cbVendor: cbVendorValue,
          cbAffiliate: forcedAffiliate,
          gravity: parseFloat(formGravity) || 0,
          conversionLabel: formConversionLabel.trim() || `$${parseFloat(formPrice).toFixed(2)} expected payout`,
          imageUrl: formImageUrl.trim(),
          affiliateUrl: rawAffiliateUrl,
          seoHeadline: formSeoHeadline.trim(),
          whoItIsFor: formWhoItIsFor.trim(),
          whyItWorks: formWhyItWorks.trim(),
          seoKeywords: formSeoKeywords.trim(),
          is_subscription: formIsSubscription,
          refund_window: formRefundWindow.trim() || "60-Day",
          included_features: parsedIncludedFeatures,
          createdAt: serverTimestamp()
        });
        setFormSuccess("ClickBank affiliate piece successfully added to high-performance pipeline!");
      }

      setFormTitle("");
      setFormDescription("");
      setFormPrice("");
      setFormCbVendor("");
      setFormGravity("");
      setFormConversionLabel("");
      setFormImageUrl("");
      setFormAffiliateUrl("");
      setFormSeoHeadline("");
      setFormWhoItIsFor("");
      setFormWhyItWorks("");
      setFormSeoKeywords("");
      setFormIsSubscription(false);
      setFormRefundWindow("60-Day");
      setFormIncludedFeatures("");
    } catch (err: any) {
      console.error("Save catalog element exception:", err);
      try {
        handleFirestoreError(err, editingProductId ? OperationType.UPDATE : OperationType.CREATE, "products");
      } catch (mappedErr: any) {
        setFormError(`Secure Write Lock: ${mappedErr.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Deletion routine
  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, "products", productId));
      setActiveDeleteId(null);
    } catch (err: any) {
      console.error("Delete catalog element exception:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      } catch (mappedErr: any) {
        setFormError(`Secure Deletion Lock: ${mappedErr.message}`);
      }
    }
  };

  // Add product to shopping cart
  const handleAddToCart = (product: ShopifyProduct, variant: ShopifyVariant, quantity: number) => {
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.variant.id === variant.id
    );

    let updatedCart = [...cart];
    if (existingIndex > -1) {
      updatedCart[existingIndex].quantity += quantity;
    } else {
      updatedCart.push({ product, variant, quantity });
    }

    saveCartToStorage(updatedCart);
    setIsCartOpen(true);
    
    // User feedback indicators
    const buttonFeedback = document.getElementById(`add-btn-${product.id}`);
    if (buttonFeedback) {
      const originalText = buttonFeedback.innerHTML;
      buttonFeedback.innerHTML = `<span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> SECURED</span>`;
      setTimeout(() => {
        buttonFeedback.innerHTML = originalText;
      }, 1500);
    }
  };

  const updateCartQuantity = (index: number, change: number) => {
    let updatedCart = [...cart];
    const newQty = updatedCart[index].quantity + change;
    if (newQty <= 0) {
      updatedCart.splice(index, 1);
    } else {
      updatedCart[index].quantity = newQty;
    }
    saveCartToStorage(updatedCart);
  };

  const removeCartItem = (index: number) => {
    let updatedCart = [...cart];
    updatedCart.splice(index, 1);
    saveCartToStorage(updatedCart);
  };

  // Get categories from products
  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]];

  // Filtered list
  const filteredProducts = filteredCategory === "All" 
    ? products 
    : products.filter((p) => p.category === filteredCategory);

  /**
   * Navigates to the designated ClickBank Hoplink redirect, or ClickBank homepage as fallback
   */
  const initiateClickBankView = () => {
    if (cart.length === 0) return;

    const firstItem = cart[0];
    const destinationUrl = firstItem.product.clickbankUrl || firstItem.product.amazonUrl || "https://www.clickbank.com";
    try {
      window.open(destinationUrl, "_blank");
    } catch (e) {
      window.location.href = destinationUrl;
    }
  };

  /**
   * AI Conversational query flow calling server-side Gemini 3.5
   */
  const handleSendChatMessage = async () => {
    if (!userInput.trim() || isAskingAI) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setUserInput("");
    setIsAskingAI(true);

    try {
      const response = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg.text,
          history: chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          activeCatalog: products.map(p => ({
            title: p.title,
            description: p.description,
            price: p.priceMin.amount
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages((prev) => [...prev, {
          id: `ai-${Date.now()}`,
          role: "model",
          text: data.text || "I was unable to synchronize with my analytical nodes. Please query again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || "Signal interruption");
      }
    } catch (err: any) {
      console.error("AI Assistant Error:", err);
      setChatMessages((prev) => [...prev, {
        id: `ai-err-${Date.now()}`,
        role: "model",
        text: `Curatorial node experiencing high load: ${err.message || "temporary service disconnect"}. Secure catalog links remain fully operational below.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsAskingAI(false);
    }
  };

  // Open Quick View Modal
  const openQuickView = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setModalVariant(product.variants[0] || null);
    setModalQuantity(1);
    setActiveImageIdx(0);
  };

  // Cart pricing sum
  const cartSubtotal = cart.reduce((acc, item) => {
    return acc + (parseFloat(item.variant.price.amount) * item.quantity);
  }, 0);

  if (pathProductId) {
    const matchedProduct = products.find((p) => p.id === pathProductId);
    const isUserAdmin = userProfile?.role === UserRole.ADMIN || currentUser?.email === ADMIN_EMAIL;

    return (
      <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black flex flex-col justify-between relative overflow-x-hidden">
        {/* Sleek Geometric Frame Details */}
        <div className="fixed inset-0 pointer-events-none border border-neutral-900 z-50 m-4 opacity-70"></div>

        {/* Brand Header */}
        <header className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-md border-b border-neutral-900 px-6 py-4 md:px-12">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Logo */}
            <div className="flex flex-col cursor-pointer" onClick={navigateToHome}>
              <h1 className="font-display font-bold text-lg md:text-xl tracking-[0.25em] text-neutral-100 uppercase">
                BuyerSpotted<span className="text-neo-gold">.</span>
              </h1>
              <span className="font-mono text-[9px] tracking-widest text-[#c3a05c] uppercase mt-0.5">
                Dynamic Research Curation
              </span>
            </div>

            <button
              onClick={navigateToHome}
              className="flex items-center gap-1.5 px-4 py-2 border border-neutral-800 text-neutral-400 hover:text-neo-gold hover:border-neo-gold bg-neutral-950 font-mono text-[9px] uppercase tracking-wider rounded-sm transition-all cursor-pointer"
            >
              ← Back to Catalog
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-10 h-10 text-neo-gold animate-spin" />
            <span className="font-mono text-[10px] tracking-widest text-neutral-400 uppercase animate-pulse">
              Locating high-performance bridge node...
            </span>
          </div>
        ) : !matchedProduct ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto py-32">
            <div className="relative w-16 h-16 flex items-center justify-center mb-6">
              <span className="absolute w-12 h-12 rounded-full border border-rose-500/30 animate-pulse"></span>
              <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
            </div>
            <h2 className="font-display font-semibold text-lg text-neutral-100 uppercase tracking-widest mb-2">
              Unpublished or Deleted Product
            </h2>
            <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mb-8 leading-relaxed">
              This promotional piece has not been deployed to the active master database yet, or the configuration is temporarily unavailable.
            </p>
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={navigateToHome}
                className="px-6 py-2.5 bg-neo-gold hover:bg-yellow-600 text-black font-semibold font-mono text-[10px] tracking-widest uppercase rounded transition-all cursor-pointer"
              >
                Return Home
              </button>
              {userProfile?.role === UserRole.ADMIN && (
                <button
                  onClick={() => {
                    setIsAdminViewActive(true);
                    setAdminTab("warehouse");
                    navigateToHome();
                  }}
                  className="px-6 py-2.5 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-mono text-[10px] tracking-widest uppercase rounded bg-neutral-950 transition-all cursor-pointer"
                >
                  Configure in Warehouse
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full animate-in fade-in duration-350">
            {/* Urgent Promotional Header Alert bar */}
            <div className="bg-neo-gold/10 border-b border-neo-gold/25 text-center py-2.5 px-4 font-mono text-[9px] md:text-[10px] uppercase tracking-wider text-neo-gold flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
              <span><span className="font-bold">⚡ READER SAVINGS STATUS:</span> ACTIVE SPECIAL PROMOTIONAL CHANNELS DETECTED — SPECIAL SAVINGS LOCKED</span>
            </div>

            {/* Pre-sell Advertorial Headline Area (Centered Editorial Layout) */}
            <div className="max-w-4xl mx-auto text-center space-y-4 px-6 pt-10 md:pt-16 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-950 border border-neutral-900 rounded-full font-mono text-[8px] md:text-[9px] tracking-widest text-[#c3a05c] uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-neo-gold" /> INDEPENDENT RESEARCH DIRECTIVE &bull; LAB GRADE DEEP DIVE
              </div>
              <h1 className="font-display text-3xl md:text-5xl font-light tracking-tight text-neutral-100 leading-tight">
                The Truth About <span className="font-medium text-neo-gold">{matchedProduct.title}</span>: Is It Actually Worth It?
              </h1>
              {matchedProduct.seoHeadline ? (
                <p className="font-serif italic text-base md:text-lg text-neutral-400 max-w-2xl mx-auto font-light leading-relaxed">
                  "{matchedProduct.seoHeadline}"
                </p>
              ) : (
                <p className="font-serif italic text-base md:text-lg text-neutral-400 max-w-2xl mx-auto font-light leading-relaxed">
                  "An analytical, unbiased pre-sell evaluation of this program's structural performance, consumer feedback, and pricing matrix."
                </p>
              )}
              <div className="flex items-center justify-center gap-3 text-[9px] text-neutral-500 font-mono uppercase tracking-widest pt-2">
                <span>REPORTS DIRECTIVE</span>
                <span className="text-neutral-800 font-bold">&bull;</span>
                <span>RESEARCH ACTIVE</span>
                <span className="text-neutral-800 font-bold">&bull;</span>
                <span>UPDATED TODAY</span>
              </div>
            </div>

            {/* Main two-column landing page container */}
            <main className="max-w-7xl mx-auto px-6 py-4 md:py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-start">
              
              {/* Left Column: Authoritative Editorial Article & Deep Review (7/12 width) */}
              <div className="lg:col-span-7 space-y-10">
                
                {/* 1. Main Visual Frame with Journalist-Style Caption */}
                <div className="space-y-3.5">
                  <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-neutral-950 border border-neutral-900 rounded-xl overflow-hidden shadow-2xl p-6 flex items-center justify-center">
                    <img
                      src={matchedProduct.images[0]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600"}
                      alt={matchedProduct.title}
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain brightness-95"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/20 via-transparent to-transparent pointer-events-none"></div>
                  </div>
                  <p className="font-mono text-[9px] text-neutral-500 leading-normal text-center uppercase tracking-wider">
                    Fig 1.1: Official authenticated {matchedProduct.title} package layout as vetted at BuyerSpotted digital network under tight material-physical isolation standards.
                  </p>
                </div>

                {/* 2. Analytical Diagnostic Scorecard Matrix (High Trust Factor) */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-4">
                  <h3 className="font-mono text-[10px] text-neo-gold uppercase tracking-wider font-bold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-neo-gold animate-pulse" /> Laboratory Evaluation scorecard
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono text-[10px]">
                    <div className="bg-[#090909] p-3 rounded border border-neutral-900/60">
                      <span className="text-neutral-500 text-[8px] uppercase block mb-1">REFUND PERMIT</span>
                      <span className="font-semibold text-neutral-200">{matchedProduct.refund_window || "60-Day"} Window</span>
                    </div>
                    <div className="bg-[#090909] p-3 rounded border border-neutral-900/60">
                      <span className="text-neutral-500 text-[8px] uppercase block mb-1">ORIGINAL STATUS</span>
                      <span className="font-semibold text-emerald-400">OFFICIALLY VERIFIED</span>
                    </div>
                  </div>
                </div>

                {/* 3. The Core Dilemma & Editorial Review */}
                <div className="space-y-4 text-neutral-300 text-sm font-light leading-relaxed border-t border-neutral-900 pt-8">
                  <h3 className="font-display font-medium text-lg text-neutral-100 uppercase tracking-wide">
                    Executive Review Summary
                  </h3>
                  <p>
                    Modern life demands cognitive excellence, wellness precision, and sustained mental performance. Sadly, the digital landscape is flooded with superficial, generic protocols that lack authentic foundations. In this independent research critique, <strong className="text-neutral-200">BuyerSpotted</strong> evaluates if <strong className="text-neo-gold">{matchedProduct.title}</strong> is an exceptional system or a standard placeholder.
                  </p>
                  <p>
                    Sourced directly from verified registries, we look under the hood of this program to check its real utility, who it serves best, and if it qualifies for high-performance endorsement. Our editorial review maps the complete architecture below.
                  </p>
                </div>

                {/* 4. Target Trajectory: Who This Is For */}
                {matchedProduct.whoItIsFor && (
                  <div className="space-y-3.5 border-t border-neutral-900 pt-8">
                    <h3 className="font-mono text-[10px] text-neo-gold uppercase tracking-wider font-bold flex items-center gap-2">
                      <Users className="w-4 h-4 text-neo-gold" /> Targeted Trajectory (Who This Is For)
                    </h3>
                    <p className="text-neutral-300 text-sm font-light leading-relaxed">
                      {matchedProduct.whoItIsFor}
                    </p>
                  </div>
                )}

                {/* 5. Decoupling the Science: How It Works */}
                {matchedProduct.whyItWorks && (
                  <div className="space-y-4 border-t border-neutral-900 pt-8">
                    <h3 className="font-mono text-[10px] text-neo-gold uppercase tracking-wider font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-neo-gold animate-pulse" /> Decoupling The Science (How It Works)
                    </h3>
                    <p className="text-neutral-300 text-sm font-light leading-relaxed">
                      {matchedProduct.whyItWorks}
                    </p>
                    
                    <div className="p-4 bg-[#090909] border border-neutral-900 rounded-lg relative overflow-hidden mt-2">
                      <p className="font-mono text-[9px] text-[#c3a05c] uppercase tracking-widest block mb-2">AUTHENTICITY SECURITY DIRECTIVE</p>
                      <p className="text-neutral-400 text-xs font-light leading-relaxed">
                        Imitation nodes are frequently positioned on lookalike domain schemas to intercept standard visitor traffic. Always verify that you are purchasing from the official network server by using our encrypted links provided in this report, which route directly through the provider's verified secure checkout.
                      </p>
                    </div>
                  </div>
                )}

                {/* 6. Included Key Features List */}
                {matchedProduct.included_features && matchedProduct.included_features.length > 0 && (
                  <div className="space-y-4 border-t border-neutral-900 pt-8">
                    <h3 className="font-mono text-[10px] text-neo-gold uppercase tracking-wider font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-neo-gold" /> Included Core Components & Highlights
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {matchedProduct.included_features.map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5 p-3.5 bg-neutral-950 border border-neutral-900/40 rounded-lg text-neutral-300 text-xs">
                          <Check className="w-4 h-4 text-neo-gold shrink-0 mt-0.5" />
                          <span className="font-light leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                   {/* 7. Product Specifications Table */}
                {isUserAdmin && matchedProduct.specifications && Object.keys(matchedProduct.specifications).length > 0 && (
                  <div className="space-y-3.5 border-t border-neutral-900 pt-8">
                    <h3 className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-neutral-500" /> Operational Matrix Specs
                    </h3>
                    <div className="bg-neutral-950 border border-neutral-900 rounded-xl overflow-hidden divide-y divide-neutral-900 font-mono text-[10px]">
                      {Object.entries(matchedProduct.specifications).map(([key, value]) => (
                        <div key={key} className="flex px-4 py-3 hover:bg-neutral-900/10 transition-colors">
                          <span className="w-1/3 text-neutral-500 uppercase tracking-wider">{key}</span>
                          <span className="w-2/3 text-neutral-300 font-light truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: High-converting Sticky Funnel & Multi-tier Trust Stack (5/12 width) */}
              <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
                
                {/* Promo/Order Module */}
                <div className="bg-neutral-950 border-2 border-[#c3a05c]/35 rounded-xl p-6 pt-5 shadow-[0_4px_30px_rgba(195,160,92,0.06)] relative overflow-hidden space-y-6">
                  <div className="absolute top-0 right-0 bg-[#c3a05c]/10 text-[#c3a05c] font-mono text-[8px] tracking-widest uppercase py-1 px-3 rounded-bl border-l border-b border-[#c3a05c]/25 font-bold">
                    VERIFIED ENCODING
                  </div>

                  <div className="space-y-1 mt-2">
                    <span className="font-mono text-[10px] text-neutral-550 uppercase tracking-widest block">SECURE PRICING SELECTION</span>
                    <h3 className="font-display font-medium text-lg text-neutral-100">Claim Promotion & Guarantee</h3>
                  </div>

                  {/* Pricing Frame with Discount Illusion */}
                  {(() => {
                    const activeVariant = modalVariant && matchedProduct.variants.some(v => v.id === modalVariant.id) 
                      ? modalVariant 
                      : (matchedProduct.variants[0] || null);
                    const originalPrice = activeVariant ? parseFloat(activeVariant.price.amount) : 49;
                    const simulatedRetail = (originalPrice * 3).toFixed(2);
                    
                    return (
                      <div className="bg-[#090909] border border-neutral-900 rounded-lg p-4 flex items-center justify-between font-mono">
                        <div className="space-y-1">
                          <span className="text-[8px] text-neutral-550 uppercase tracking-widest block">ESTIMATED RETAIL</span>
                          <span className="text-xs text-neutral-500 line-through">
                            ${simulatedRetail} USD
                          </span>
                        </div>
                        <div className="text-right space-y-1">
                          <span className="text-[8px] text-neo-gold uppercase tracking-widest block font-bold">SPECIAL SAVINGS PRICE</span>
                          <span className="text-lg font-bold text-neo-gold">
                            ${originalPrice.toFixed(2)} USD
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dynamic Variant Selector (if options exist) */}
                  {matchedProduct.variants.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="font-mono text-[8px] text-neutral-550 tracking-wider uppercase block">
                        Select Compilation Schema
                      </span>
                      <div className="space-y-2">
                        {matchedProduct.variants.map((v) => {
                          const isSelected = modalVariant?.id === v.id || (!modalVariant && matchedProduct.variants[0]?.id === v.id);
                          return (
                            <button
                              key={v.id}
                              onClick={() => setModalVariant(v)}
                              className={`w-full flex items-center justify-between p-3 rounded border font-mono text-[9px] tracking-wide transition-all ${
                                isSelected 
                                  ? "bg-[#c3a05c]/5 border-neo-gold text-neo-gold font-semibold" 
                                  : "bg-[#090909] border-neutral-900 text-neutral-500 hover:text-neutral-200 hover:border-neutral-800"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-neo-gold' : 'bg-neutral-800'}`}></span>
                                {v.title}
                              </span>
                              <span className="text-neutral-100">
                                ${parseFloat(v.price.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                       {/* Guaranteed Satisfaction Indicator Box */}
                  <div className="bg-[#090909] border border-neutral-900 border-dashed rounded-lg p-3.5 flex gap-3 items-start">
                    <ShieldCheck className="w-5 h-5 text-neo-gold shrink-0 mt-0.5" />
                    <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-400 leading-relaxed">
                      Backed by the provider's ironclad <strong className="text-neo-gold font-bold">{matchedProduct.refund_window || "60-Day"} Risk-Free Satisfaction Guarantee</strong>. Completely risk-free investment.
                    </p>
                  </div>

                  {/* High-Converting Catchy CTA Button */}
                  <div className="pt-2">
                    <a
                      href={matchedProduct.clickbankUrl || matchedProduct.amazonUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4.5 px-3 bg-gradient-to-r from-neo-gold via-yellow-500 to-yellow-600 hover:brightness-110 active:scale-[0.99] text-black font-semibold rounded shadow-[0_4px_30px_rgba(195,160,92,0.25)] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-center group"
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[10px] md:text-xs font-black tracking-widest uppercase text-black">
                        <span>👉 GET EXCLUSIVE SECURE REGISTRY ACCESS NOW 👈</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-black" />
                      </div>
                      <span className="font-mono text-[8px] tracking-wider text-black/75 font-normal uppercase">
                        ACTIVATE EXTRA {matchedProduct.refund_window?.toUpperCase() || "60-DAY"} REFUND PROTECTION & SPECIAL PROMO DISCOUNT
                      </span>
                    </a>
                  </div>

                  {/* Trust Badge Indicators */}
                  <div className="space-y-3 pt-2 border-t border-neutral-900">
                    <div className="flex items-center justify-center gap-4 opacity-50">
                      <span className="font-mono text-[8px] text-neutral-550 uppercase tracking-widest">VISA</span>
                      <span className="font-mono text-[8px] text-neutral-550 uppercase tracking-widest">MASTERCARD</span>
                      <span className="font-mono text-[8px] text-neutral-550 uppercase tracking-widest">AMEX</span>
                      <span className="font-mono text-[8px] text-neutral-550 uppercase tracking-widest">DISCOVER</span>
                    </div>
                    
                    <div className="flex justify-center items-center gap-3.5 text-center font-mono text-[8px] uppercase tracking-wider text-neutral-600">
                      <span className="flex items-center gap-1">🔒 SECURE SSL</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">🛡️ OFFICIALLY SECURED</span>
                    </div>
                  </div>
                </div>

                {/* FAQ Details accordion */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-4">
                  <h4 className="font-mono text-[9px] text-[#c3a05c] uppercase tracking-widest flex items-center gap-2 font-bold">
                    <Info className="w-4 h-4 text-neo-gold" /> Frequently Asked Inquiries
                  </h4>
                  
                  <div className="space-y-2">
                    {/* FAQ 1 */}
                    <div className="border border-neutral-900 rounded bg-[#090909] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFaqOpen1(!faqOpen1)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-left font-mono text-[9px] tracking-wider text-neutral-400 hover:text-white uppercase transition-colors"
                      >
                        <span>How do I gain program access?</span>
                        <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${faqOpen1 ? "rotate-180" : ""}`} />
                      </button>
                      {faqOpen1 && (
                        <div className="px-4 pb-3 text-[11px] text-neutral-400 leading-relaxed font-light border-t border-neutral-950 pt-2 bg-neutral-950">
                          Access is issued instantaneously after payment execution. Everything is delivered through encrypted digital links format.
                        </div>
                      )}
                    </div>

                    {/* FAQ 2 */}
                    <div className="border border-neutral-900 rounded bg-[#090909] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFaqOpen2(!faqOpen2)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-left font-mono text-[9px] tracking-wider text-neutral-400 hover:text-white uppercase transition-colors"
                      >
                        <span>Are there active recurring fees?</span>
                        <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${faqOpen2 ? "rotate-180" : ""}`} />
                      </button>
                      {faqOpen2 && (
                        <div className="px-4 pb-3 text-[11px] text-neutral-400 leading-relaxed font-light border-t border-neutral-950 pt-2 bg-neutral-950">
                          {matchedProduct.is_subscription ? (
                            "No, unless subscription options are selected. The premium checkout system lets you specify standard or repeat delivery schemas."
                          ) : (
                            "No. This transaction represents a single material one-time payment structure with zero dynamic baseline monthly dues."
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </main>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-neutral-900 py-6 px-6 md:px-12 bg-neutral-950/40 text-center font-mono text-[9px] text-neutral-550 uppercase tracking-wider mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <span>© 2026 BuyerSpotted Digital Curation Network. All rights reserved.</span>
            <span>Ref: {pathProductId ? pathProductId.slice(0, 8).toUpperCase() : ""}</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black">
      
      {/* Sleek Geometric Frame Details */}
      <div className="fixed inset-0 pointer-events-none border border-neutral-900 z-50 m-4 opacity-70"></div>
      
      {/* Decryption Gate / Under Construction Overlay */}
      <AnimatePresence>
        {isAuthChecking && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#050505] z-[9999] flex flex-col items-center justify-center font-mono p-4"
          >
            <div className="relative w-16 h-16 flex items-center justify-center mb-6">
              <span className="absolute w-12 h-12 rounded-full border border-neo-gold/30 animate-ping"></span>
              <span className="absolute w-8 h-8 rounded-full border border-neo-gold/40 animate-pulse"></span>
              <RefreshCw className="w-6 h-6 text-neo-gold animate-spin" />
            </div>
            <span className="text-[10px] tracking-widest text-[#c3a05c] uppercase animate-pulse">Verifying secure access...</span>
          </motion.div>
        )}

        {!isAuthChecking && !siteSettings.isOpen && userProfile?.role !== UserRole.ADMIN && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#050505] z-[9990] flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto select-none"
          >
            {/* Subtle glowing lines in background */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[80%] max-w-[600px] h-[1px] bg-gradient-to-r from-transparent via-neo-gold/10 to-transparent"></div>
            
            <div className="max-w-md w-full bg-[#0a0a0a] border border-neutral-900 rounded-lg p-8 relative shadow-2xl">
              {/* Absolute accent nodes */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#c3a05c]"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#c3a05c]"></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#c3a05c]"></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#c3a05c]"></div>

              <div className="text-center mb-8">
                <span className="font-mono text-[9px] text-[#c3a05c] uppercase tracking-widest block mb-4 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#c3a05c] animate-pulse" /> UNDER CONSTRUCTION
                </span>
                
                <h1 className="font-display font-bold text-2xl tracking-[0.25em] text-neutral-100 uppercase">
                  BuyerSpotted<span className="text-neo-gold">.</span>
                </h1>
                
                <p className="font-mono text-[9px] text-neutral-550 uppercase tracking-widest mt-1">
                  Exclusive Digital Products
                </p>
              </div>

              <div className="space-y-4 border-t border-b border-neutral-900 py-6 my-6 font-mono text-[11px] leading-relaxed text-neutral-400">
                <div className="flex items-center gap-2 mb-2 text-neo-gold text-[10px] tracking-wider uppercase font-semibold">
                  <Sliders className="w-3.5 h-3.5 animate-spin" /> Coming Very Soon
                </div>
                <p>
                  We are currently preparing an exclusive selection of high-converting digital products. Our website is under construction as we polish our marketplace catalog, but we will be online and available soon.
                </p>
                <p className="text-neutral-500 text-[10px] leading-snug">
                  Please stay tuned for updates. Authorized administration users can log in below to continue site configuration.
                </p>
              </div>

              {currentUser ? (
                <div className="space-y-4 bg-neutral-950/80 border border-neutral-900 rounded p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 font-mono text-[9px] text-rose-400 uppercase tracking-widest">
                    <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                    Access Denied
                  </div>
                  <p className="font-mono text-[10px] text-neutral-400 break-all leading-normal uppercase">
                    Authorized Administrator credentials not found rules for:<br />
                    <span className="text-neo-gold block mt-1 font-semibold">{currentUser.email}</span>
                  </p>
                  
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={async () => {
                        try {
                          setIsLoggingIn(true);
                          await logOutUser();
                          await signInWithGoogle();
                        } catch (e) {
                          console.error("Change handle exception:", e);
                        } finally {
                          setIsLoggingIn(false);
                        }
                      }}
                      className="w-full py-2 bg-[#c3a05c] hover:bg-yellow-600 text-black font-semibold font-mono text-[9px] tracking-widest uppercase rounded-sm transition-all cursor-pointer"
                    >
                      Use Administrator Account
                    </button>
                    <button
                      onClick={async () => {
                        await logOutUser();
                      }}
                      className="w-full py-2 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 font-mono text-[9px] tracking-widest uppercase rounded-sm transition-all cursor-pointer"
                    >
                      Logout Session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={async () => {
                      try {
                        setIsLoggingIn(true);
                        await signInWithGoogle();
                      } catch (e) {
                        console.error("Gated signin option:", e);
                      } finally {
                        setIsLoggingIn(false);
                      }
                    }}
                    disabled={isLoggingIn}
                    className="w-full py-3 bg-neo-gold hover:bg-yellow-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-[#050505] font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping"></span>
                    {isLoggingIn ? "AUTHENTICATING..." : "ADMINISTRATOR LOG IN"}
                  </button>
                  <div className="text-center">
                    <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest">SECURE ADMIN GATEWAY</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Development Mode Warning Banner */}
      <div className="relative z-40 bg-gradient-to-r from-neutral-950 via-[#0a0a09] to-neutral-950 border-b border-neo-gold/20 px-4 py-3 text-center text-xs font-mono tracking-wider text-neo-gold flex items-center justify-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-neo-gold animate-pulse shrink-0"></span>
        <span className="uppercase text-[10px] sm:text-xs">
          • CURRENT SELECTIONS FOR JUNE 2026 • INDEPENDENT PERFORMANCE REVIEWS & DIRECT LINKS TO OFFICIAL WEBSITES
        </span>
      </div>

      {/* Brand Header */}
      <header className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-md border-b border-neutral-900 px-6 py-4 md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex flex-col">
            <h1 className="font-display font-bold text-lg md:text-xl tracking-[0.25em] text-neutral-100 uppercase">
              BuyerSpotted<span className="text-neo-gold">.</span>
            </h1>
            <span className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase mt-0.5">
              Curated Luxury Tech Vault
            </span>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex items-center gap-3">
            
            {/* User Session Controller */}
            {userProfile ? (
              <div className="flex items-center gap-2 bg-[#090909] border border-neutral-900 rounded-md p-1.5 pl-3">
                <div className="flex flex-col text-right hidden lg:flex">
                  <span className="font-mono text-[9px] text-neutral-400 font-semibold truncate max-w-[125px]" title={userProfile.email}>
                    {userProfile.email}
                  </span>
                  <span className="font-mono text-[8px] text-neo-[#c3a05c] tracking-widest mt-0.5">
                    {userProfile.role === UserRole.ADMIN ? "ADMIN" : "GUEST"}
                  </span>
                </div>
                
                {/* Admin Link on navigation bar for Administrators only */}
                {userProfile.role === UserRole.ADMIN && (
                  <button
                    onClick={() => {
                      setIsAdminViewActive(!isAdminViewActive);
                    }}
                    className={`ml-1.5 py-1.5 px-3 rounded text-[9px] font-mono tracking-widest uppercase transition-all cursor-pointer ${
                      isAdminViewActive 
                        ? "bg-[#c3a05c] text-black font-semibold border border-[#c3a05c]" 
                        : "bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neo-gold hover:text-neo-gold"
                    }`}
                    id="admin-nav-link"
                    title="Manage Curated Catalog"
                  >
                    ADMIN
                  </button>
                )}

                <button
                  onClick={async () => {
                    await logOutUser();
                    setIsAdminViewActive(false);
                  }}
                  className="p-1 px-2 text-neutral-500 hover:text-rose-400 transition-all font-mono text-[9px] tracking-wider uppercase ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  EXIT
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    setIsLoggingIn(true);
                    await signInWithGoogle();
                  } catch (e) {
                    console.error("Login failure:", e);
                  } finally {
                    setIsLoggingIn(false);
                  }
                }}
                disabled={isLoggingIn}
                className="flex items-center gap-1.5 py-2 px-3 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neo-gold font-mono text-[10px] font-medium tracking-wider uppercase rounded-md transition-all cursor-pointer mr-1"
                id="google-login-btn"
                title="Authenticate with Google"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-neo-gold animate-pulse"></div>
                {isLoggingIn ? "CONNECTING..." : "SIGN IN"}
              </button>
            )}

            {/* SpottedAI Advisor trigger */}
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="relative p-2.5 bg-neutral-950 border border-neutral-800 hover:border-neo-gold rounded-md transition-all group"
              title="Query SpottedAI Concierge"
              id="ai-trigger-btn"
            >
              <MessageCircle className="w-4 h-4 text-neutral-400 group-hover:text-neo-gold transition-colors" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-neo-gold animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-neo-gold"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 md:px-12 md:py-16">
        
        {/* Cinematic Announcement Banner */}
        {isAdminViewActive && userProfile?.role === UserRole.ADMIN ? (
          <section className="mb-20 min-h-[50vh]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-900 pb-5 mb-8 gap-4">
              <div>
                <span className="font-mono text-[9px] text-[#c3a05c] uppercase tracking-widest block mb-1">SECURE CONSOLE ENTRY</span>
                <div className="flex flex-col md:flex-row md:items-center gap-4 mt-1">
                  <h3 className="font-display font-semibold text-lg md:text-xl tracking-wider text-neutral-100 uppercase">
                    Admin Workspace
                  </h3>
                  
                  {/* Premium Admin Tabs */}
                  <div className="flex items-center bg-neutral-950 border border-neutral-900 p-0.5 rounded-sm">
                    <button
                      onClick={() => setAdminTab("vault")}
                      className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase rounded-xs transition-all cursor-pointer ${
                        adminTab === "vault"
                          ? "bg-neo-gold text-black font-semibold"
                          : "text-neutral-550 hover:text-neutral-300"
                      }`}
                    >
                      Products Vault
                    </button>
                    <button
                      onClick={() => setAdminTab("warehouse")}
                      className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        adminTab === "warehouse"
                          ? "bg-neo-gold text-black font-semibold"
                          : "text-neutral-550 hover:text-neutral-300"
                      }`}
                      id="tab-digital-warehouse"
                    >
                      <Sparkles className="w-3 h-3 text-current animate-pulse" /> Digital Warehouse
                    </button>
                    <button
                      onClick={() => setAdminTab("settings")}
                      className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        adminTab === "settings"
                          ? "bg-neo-gold text-black font-semibold"
                          : "text-neutral-550 hover:text-neutral-300"
                      }`}
                    >
                      <Sliders className="w-3 h-3 text-current" /> Site Settings
                    </button>
                    <button
                      onClick={() => setAdminTab("analytics")}
                      className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        adminTab === "analytics"
                          ? "bg-neo-gold text-black font-semibold"
                          : "text-neutral-550 hover:text-neutral-300"
                      }`}
                    >
                      <BarChart3 className="w-3 h-3 text-current" /> Live Analytics
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsAdminViewActive(false)}
                className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 bg-neutral-950 font-mono text-[9px] uppercase tracking-wider rounded-sm transition-all cursor-pointer"
              >
                RETURN TO HOME CATALOG
              </button>
            </div>

            {adminTab === "warehouse" ? (
              <div className="bg-neutral-950 border border-neutral-900 p-6 rounded-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-900 pb-5 mb-6 gap-4">
                  <div>
                    <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-neo-gold animate-spin" /> ClickBank Digital Warehouse Intelligence
                    </h4>
                    <p className="font-mono text-[10px] text-neutral-500 uppercase mt-1">
                      Query high-performance affiliate products and populate your Isolation Vault instantly
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {scannedProducts.length > 0 && (
                      <button
                        onClick={() => setScannedProducts([])}
                        className="px-4 py-2.5 border border-neutral-800 hover:border-rose-950 bg-neutral-900 text-neutral-500 hover:text-rose-450 font-mono text-[9px] uppercase tracking-wider rounded-sm transition-all cursor-pointer"
                      >
                        Clear Results
                      </button>
                    )}
                    <button
                      onClick={handleFetchClickBankProducts}
                      disabled={isFetchingCB}
                      className="glow-btn px-5 py-2.5 bg-neo-gold hover:bg-yellow-650 disabled:bg-neutral-900 disabled:text-neutral-600 text-black font-mono text-[9px] font-bold tracking-widest uppercase rounded-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      {isFetchingCB ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> ANALYZING MARKETPLACE...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" /> FETCH PRODUCTS
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {fetchErrorCB && (
                  <div className="mb-6 p-4 bg-rose-950/20 border border-rose-900 text-rose-400 font-mono text-[10px] uppercase rounded">
                    Error scanning marketplace database: {fetchErrorCB}
                  </div>
                )}

                {isFetchingCB ? (
                  <div className="flex flex-col items-center justify-center py-28 border border-dashed border-neutral-905 rounded bg-[#030303]/40">
                    <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                      <span className="absolute w-12 h-12 rounded-full border border-neo-gold/30 animate-ping"></span>
                      <span className="absolute w-8 h-8 rounded-full border border-neo-gold/40 animate-pulse"></span>
                      <Sparkles className="w-6 h-6 text-neo-gold animate-spin" />
                    </div>
                    <span className="font-mono text-xs text-neutral-300 font-semibold tracking-wider uppercase mb-1.5 animate-bounce">Scanning ClickBank Marketplace</span>
                    <span className="font-mono text-[10px] text-neutral-500 uppercase max-w-sm text-center leading-relaxed">
                      Assessing Gravity metrics, sales-letter conversion structures, and support tools pages for elite campaigns...
                    </span>
                  </div>
                ) : scannedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-900 rounded bg-[#030303]/20">
                    <Sparkles className="w-8 h-8 text-neutral-800 mb-4 animate-pulse" />
                    <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">Database Idle</span>
                    <p className="font-mono text-[9px] text-neutral-600 uppercase max-w-xs text-center leading-relaxed">
                      Click the "Fetch Products" button above to initiate ClickBank market query.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-neutral-900 rounded bg-[#030303]/40">
                    <table className="w-full text-left border-collapse font-mono text-[11px]">
                      <thead>
                        <tr className="border-b border-neutral-900 bg-neutral-950/80 uppercase text-[9px] text-neutral-400 font-semibold">
                          <th className="p-4 w-12">Preview</th>
                          <th className="p-4 max-w-[200px]">Product details</th>
                          <th className="p-4 max-w-[300px]">Angle / Campaign Funnel Copy</th>
                          <th className="p-4 text-center">Gravity Score (Grav)</th>
                          <th className="p-4 text-right">Avg $/Conversion (APV)</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-neutral-300">
                        {scannedProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-neutral-900/30 transition-colors">
                            <td className="p-4">
                              <img
                                src={getProductPlaceholderImage(p.title)}
                                alt={p.title}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 object-cover rounded border border-neutral-800 transition-all shrink-0 bg-neutral-950"
                              />
                            </td>
                            <td className="p-4 max-w-[200px]">
                              <div className="flex flex-col">
                                <span className="font-display font-medium text-xs text-neutral-200 tracking-wide">{p.title}</span>
                                <a
                                  href={getClickBankHoplinkUrl(p)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-[#c3a05c] hover:text-[#d3b06c] hover:underline flex items-center gap-1.5 mt-2 max-w-fit"
                                >
                                  HopLink <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                                <span className="text-[8px] text-neutral-500 font-mono tracking-tighter mt-1.5 break-all select-all">
                                  {p.affiliate_tools_url}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-neutral-400 font-light max-w-[300px] leading-relaxed">
                              <p className="text-[10px] text-neutral-300 uppercase leading-snug">
                                {p.funnel_angle}
                              </p>
                              <span className="px-1.5 py-0.5 bg-neutral-900/50 border border-neutral-850 rounded font-bold text-[8px] text-neo-gold uppercase tracking-wider inline-block mt-2">
                                Curated Angle
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-neutral-200 text-xs text-neo-gold font-mono">
                              {parseFloat(p.gravity_score || 0).toFixed(1)}
                            </td>
                            <td className="p-4 text-right font-semibold text-emerald-450 text-xs font-mono">
                              {p.avg_per_conversion}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleImportProduct(p)}
                                className="px-3.5 py-2 bg-neo-gold hover:bg-yellow-600 text-black font-mono text-[9px] font-bold tracking-widest uppercase rounded-sm transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                {formTitle === p.title ? (
                                  <>
                                    <Check className="w-3 h-3 text-black shrink-0" /> Imported
                                  </>
                                ) : (
                                  <>
                                    Import <Plus className="w-3 h-3 text-black shrink-0" />
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : adminTab === "settings" ? (
              <div className="bg-neutral-950 border border-neutral-900 p-6 rounded-lg max-w-2xl mx-auto relative animate-in fade-in duration-300">
                {/* Accent Nodes */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#c3a05c]"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#c3a05c]"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#c3a05c]"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#c3a05c]"></div>

                <div className="border-b border-neutral-900 pb-5 mb-6">
                  <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-neo-gold" /> Critical Site Controls
                  </h4>
                  <p className="font-mono text-[10px] text-neutral-550 uppercase mt-1">
                    Manage real-time catalog visibility and public access parameters
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Status Showcase Card */}
                  <div className="p-6 bg-[#070707] border border-neutral-900 rounded-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-sm">
                      <span className="font-mono text-[9px] text-[#c3a05c] tracking-widest uppercase block font-semibold">
                        Current Status
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${siteSettings.isOpen ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                        <h5 className="font-display font-bold text-xl tracking-wider text-neutral-100 uppercase">
                          {siteSettings.isOpen ? "WEBSITE IS OPEN" : "WEBSITE IS CLOSED"}
                        </h5>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-light leading-relaxed">
                        {siteSettings.isOpen 
                          ? "The marketplace catalog, product pre-sells, and secure chat are fully visible to all casual site visitors."
                          : "Any public visitors will be blocked by the Under Construction overlay. Only authenticated Administrators can bypass the overlay and log in."
                        }
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full md:w-auto shrink-0 md:pt-0 pt-2">
                      <button
                        onClick={async () => {
                          try {
                            setIsSettingsSaving(true);
                            await setDoc(doc(db, "settings", "site"), { isOpen: !siteSettings.isOpen });
                          } catch (err) {
                            handleFirestoreError(err, OperationType.WRITE, "settings/site");
                          } finally {
                            setIsSettingsSaving(false);
                          }
                        }}
                        disabled={isSettingsSaving}
                        className={`px-5 py-3 rounded-sm font-mono text-[10px] font-bold tracking-widest uppercase transition-all duration-300 w-full md:w-48 flex items-center justify-center gap-2 cursor-pointer ${
                          siteSettings.isOpen 
                            ? "border border-amber-800 bg-amber-950/20 text-amber-400 hover:bg-amber-900/15" 
                            : "bg-neo-gold text-black hover:bg-yellow-600 shadow-[0_0_15px_rgba(195,160,92,0.2)]"
                        }`}
                      >
                        {isSettingsSaving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-black shrink-0" /> WRITING ATOMICALLY...
                          </>
                        ) : siteSettings.isOpen ? (
                          <>CLOSE WEBSITE</>
                        ) : (
                          <>OPEN WEBSITE</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Security/Operation Guidelines */}
                  <div className="p-5 bg-neutral-950 border border-neutral-900/60 rounded-md space-y-3.5">
                    <h5 className="font-mono text-[10px] text-neutral-200 uppercase tracking-wider font-bold flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-neo-gold" /> Operational Protocols
                    </h5>
                    <ul className="space-y-2 text-neutral-400 font-mono text-[10px] uppercase tracking-wide leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="text-neo-gold mt-0.5">•</span>
                        <span>All settings mutations are recorded atomically in Google Firestore via TLS.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neo-gold mt-0.5">•</span>
                        <span>When set to CLOSED, the system instantly engages the secure decryption gate overlay.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-neo-gold mt-0.5">•</span>
                        <span>Administrators can log in to bypass the gate using verified security credentials (jasoncaswell2217@gmail.com).</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : adminTab === "analytics" ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Analytics Key Metrics Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Metric 1: Live Visitors */}
                  <div className="bg-neutral-950 border border-neutral-900 p-5 rounded-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-neo-gold/5 blur-3xl rounded-full"></div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest block">Active Right Now</span>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-sans font-bold text-3xl text-neutral-100 tracking-tight">
                        {sessions.filter(s => (Date.now() - new Date(s.lastActiveTime).getTime()) < 60000).length}
                      </span>
                      <span className="font-mono text-[9px] text-emerald-450 uppercase tracking-wider font-semibold">Active Visitors</span>
                    </div>
                  </div>

                  {/* Metric 2: Total Sessions */}
                  <div className="bg-neutral-950 border border-neutral-900 p-5 rounded-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest block">Total Visits</span>
                      <Users className="w-4 h-4 text-neutral-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-sans font-bold text-3xl text-neutral-100 tracking-tight">
                        {sessions.length}
                      </span>
                      <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-wider">Unique Journeys</span>
                    </div>
                  </div>

                  {/* Metric 3: Average Visit Length */}
                  <div className="bg-neutral-950 border border-neutral-900 p-5 rounded-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest block">Average Stay Length</span>
                      <Clock className="w-4 h-4 text-neutral-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-sans font-bold text-3xl text-neutral-100 tracking-tight">
                        {(() => {
                          if (sessions.length === 0) return "0s";
                          const totalSecs = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
                          const avgSecs = Math.round(totalSecs / sessions.length);
                          if (avgSecs < 60) return `${avgSecs}s`;
                          const mins = Math.floor(avgSecs / 60);
                          const remSecs = avgSecs % 60;
                          return `${mins}m ${remSecs}s`;
                        })()}
                      </span>
                      <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-wider">Per Visitor</span>
                    </div>
                  </div>

                  {/* Metric 4: Top product section */}
                  <div className="bg-neutral-950 border border-neutral-900 p-5 rounded-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest block">Peak Interest Hub</span>
                      <Sliders className="w-4 h-4 text-neutral-600" />
                    </div>
                    <div className="truncate pr-4">
                      <span className="font-display font-medium text-sm text-neo-gold block uppercase truncate">
                        {(() => {
                          const pageCounts: Record<string, number> = {};
                          sessions.forEach(s => {
                            if (Array.isArray(s.pagesVisited)) {
                              s.pagesVisited.forEach(p => {
                                pageCounts[p] = (pageCounts[p] || 0) + 1;
                              });
                            }
                          });
                          let topPage = "No views yet";
                          let topCount = 0;
                          Object.entries(pageCounts).forEach(([p, count]) => {
                            if (count > topCount) {
                              topCount = count;
                              topPage = p.replace("Product: ", "");
                            }
                          });
                          return topPage;
                        })()}
                      </span>
                      <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider block mt-1">Most Clicked Segment</span>
                    </div>
                  </div>
                </div>

                {/* Graphical Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Real-time Arrival Timeline Chart */}
                  <div className="bg-neutral-950 border border-neutral-900 p-6 rounded-lg">
                    <div className="border-b border-neutral-900 pb-4 mb-6">
                      <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-neo-gold" /> Arrival Clock (When they came)
                      </h4>
                      <p className="font-mono text-[9px] text-neutral-500 uppercase mt-1">
                        Peak visual frequency representation of visitors throughout the day
                      </p>
                    </div>

                    <div className="w-full h-64 flex flex-col justify-between pt-4">
                      {/* Interactive Responsive SVG Bar Chart */}
                      {(() => {
                        const hCount = Array(24).fill(0);
                        sessions.forEach(s => {
                          if (s.startTime) {
                            const date = new Date(s.startTime);
                            const h = date.getHours();
                            if (h >= 0 && h < 24) hCount[h]++;
                          }
                        });
                        const doubleHourLabels = [
                          "12a", "2a", "4a", "6a", "8a", "10a",
                          "12p", "2p", "4p", "6p", "8p", "10p"
                        ];
                        const blockData = Array(12).fill(0);
                        hCount.forEach((v, h) => {
                          const blockIndex = Math.floor(h / 2) % 12;
                          blockData[blockIndex] += v;
                        });
                        const maxBlockVal = Math.max(...blockData, 1);

                        return (
                          <div className="flex-1 flex flex-col justify-end w-full">
                            {/* Graphic columns */}
                            <div className="flex items-end justify-between h-44 px-2 border-b border-neutral-905">
                              {blockData.map((val, idx) => {
                                const pct = (val / maxBlockVal) * 100;
                                return (
                                  <div key={idx} className="flex-1 flex flex-col items-center group relative mx-1">
                                    {/* Column tooltip bubble on hover */}
                                    <div className="absolute bottom-full mb-1 bg-neutral-900 border border-neutral-800 text-neutral-200 font-mono text-[9px] uppercase py-1 px-2 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center shadow-lg min-w-[70px]">
                                      <span className="block font-bold text-neo-gold">{val} visitor{val !== 1 ? 's' : ''}</span>
                                      <span className="text-[8px] text-neutral-400">At {doubleHourLabels[idx]}</span>
                                    </div>

                                    {/* Actual graphic golden bar */}
                                    <div 
                                      style={{ height: `${Math.max(pct, 4)}%` }}
                                      className={`w-full rounded-t-xs transition-all duration-500 ${
                                        val > 0 
                                          ? "bg-neo-gold hover:bg-yellow-500 shadow-[0_0_12px_rgba(195,160,92,0.15)]" 
                                          : "bg-neutral-900"
                                      }`}
                                    ></div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Axis Label scale */}
                            <div className="flex justify-between mt-3 px-2">
                              {doubleHourLabels.map((lbl, idx) => (
                                <span key={idx} className="flex-1 text-center font-mono text-[8px] text-neutral-500 uppercase tracking-widest">
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Visit Length Distribution Horizontal Chart */}
                  <div className="bg-neutral-950 border border-neutral-900 p-6 rounded-lg">
                    <div className="border-b border-neutral-900 pb-4 mb-6">
                      <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-neo-gold" /> Stay Length Distribution (How long they stayed)
                      </h4>
                      <p className="font-mono text-[9px] text-neutral-500 uppercase mt-1">
                        Grouping visitor stays from quick bounces to highly engaged researchers
                      </p>
                    </div>

                    {/* Stay duration ranges mapping */}
                    <div className="space-y-5 pt-2">
                      {(() => {
                        let bounce = 0;
                        let brief = 0;
                        let engaged = 0;
                        let deep = 0;

                        sessions.forEach(s => {
                          const d = s.duration || 0;
                          if (d < 15) bounce++;
                          else if (d < 60) brief++;
                          else if (d < 300) engaged++;
                          else deep++;
                        });

                        const categories = [
                          { label: "Bounced Instantly (Under 15 seconds)", value: bounce, color: "bg-red-500/80" },
                          { label: "Quick Browser (15 to 60 seconds)", value: brief, color: "bg-amber-500/80" },
                          { label: "Engaged Reader (1 to 5 minutes)", value: engaged, color: "bg-neo-gold" },
                          { label: "Deep Researcher (Over 5 minutes)", value: deep, color: "bg-emerald-500/80" }
                        ];

                        const maxVisitsVal = Math.max(...categories.map(c => c.value), 1);

                        return categories.map((cat, idx) => {
                          const pct = (cat.value / maxVisitsVal) * 100;
                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                                <span>{cat.label}</span>
                                <span className="font-bold text-neutral-200">{cat.value} explorer{cat.value !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="h-2.5 bg-neutral-900 border border-neutral-900 rounded-xs overflow-hidden">
                                <div 
                                  style={{ width: `${pct}%` }}
                                  className={`h-full transition-all duration-700 rounded-r-xs ${cat.color}`}
                                ></div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Real-time Visitor Live Feed Feed */}
                <div className="bg-neutral-950 border border-neutral-900 p-6 rounded-lg">
                  <div className="border-b border-neutral-900 pb-4 mb-6">
                    <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c3a05c] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-neo-gold"></span>
                      </span>
                      Autonomous Visitor Live Interaction Feed
                    </h4>
                    <p className="font-mono text-[9px] text-neutral-500 uppercase mt-1">
                      Direct raw real-time stream of visitor events, pages viewed, and timeline stay intervals
                    </p>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-neutral-900 rounded">
                      <Users className="w-8 h-8 text-neutral-800 mb-3 animate-pulse" />
                      <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider">No visits recorded</span>
                      <p className="font-mono text-[9px] text-neutral-600 uppercase max-w-xs text-center mt-1">
                        Awaiting the initial guest visitor to enter the store encryption perimeter.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-[10px]">
                        <thead>
                          <tr className="border-b border-neutral-900 bg-neutral-950/70 uppercase text-[8px] text-neutral-500 font-bold">
                            <th className="p-3 w-8">Status</th>
                            <th className="p-3 w-32">Temporal Arrival</th>
                            <th className="p-3 w-24 text-right">Stay Length</th>
                            <th className="p-3 w-40">Device Signature</th>
                            <th className="p-3">Navigation / Click Path Traversed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900/60 text-neutral-300">
                          {sessions.map((sess, idx) => {
                            const isLive = (Date.now() - new Date(sess.lastActiveTime).getTime()) < 60000;
                            return (
                              <tr key={idx} className="hover:bg-neutral-900/20 transition-colors">
                                <td className="p-3">
                                  <div className="flex justify-center">
                                    {isLive ? (
                                      <span className="relative flex h-2.5 w-2.5" title="Actively Viewing Right Now">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                      </span>
                                    ) : (
                                      <span className="h-2 w-2 rounded-full bg-neutral-800" title="Offline / Departed"></span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-semibold text-neutral-300">
                                  {formatVisitorArrivalTime(sess.startTime)}
                                </td>
                                <td className="p-3 text-right font-medium text-neutral-400">
                                  {(() => {
                                    const dur = sess.duration || 0;
                                    if (dur < 60) return `${dur}s`;
                                    const m = Math.floor(dur / 60);
                                    const s = dur % 60;
                                    return `${m}m ${s}s`;
                                  })()}
                                </td>
                                <td className="p-3 text-neutral-500 uppercase tracking-wide">
                                  {sess.userAgent || "Unknown Device"}
                                </td>
                                <td className="p-3">
                                  {/* Beautiful flow visual representation for the clicked paths */}
                                  <div className="flex flex-wrap items-center gap-1.5 py-1">
                                    {Array.isArray(sess.pagesVisited) && sess.pagesVisited.map((p, pIdx) => (
                                      <div key={pIdx} className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-xs border text-[8px] uppercase tracking-wider font-semibold ${
                                          p.startsWith("Product:") 
                                            ? "bg-neutral-950 border-[#c3a05c]/30 text-neo-gold" 
                                            : "bg-neutral-950/60 border-neutral-900 text-neutral-400"
                                        }`}>
                                          {p}
                                        </span>
                                        {pIdx < sess.pagesVisited.length - 1 && (
                                          <span className="text-neutral-700 text-[10px] font-bold">→</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Add Product Form */}
                <div id="admin-compilation-form" className="lg:col-span-12 xl:col-span-5 bg-neutral-950 border border-neutral-900 p-6 rounded-lg h-fit">
                  <h4 className="font-mono text-[9px] text-neo-gold uppercase tracking-widest mb-6 pb-2 border-b border-neutral-900 flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      {editingProductId ? (
                        <>
                          <Edit className="w-4 h-4 text-neo-gold" /> EDIT HOUSE ELEMENT
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-neo-gold" /> REGISTER NEW COMPILATION
                        </>
                      )}
                    </span>
                    {(formTitle || formDescription || formPrice || formImageUrl || formAffiliateUrl || editingProductId) && (
                      <button 
                        type="button" 
                        onClick={handleClearFormFields}
                        className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-950 font-mono text-[8px] uppercase tracking-widest rounded-sm transition-colors cursor-pointer"
                      >
                        {editingProductId ? "Cancel Edit" : "Clear Fields"}
                      </button>
                    )}
                  </h4>

                  {formError && (
                    <div className="mb-4 p-3 bg-rose-950/40 border border-rose-900 text-rose-400 font-mono text-[10px] uppercase rounded">
                      {formError}
                    </div>
                  )}
                  {formSuccess && (
                    <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-mono text-[10px] uppercase rounded">
                      {formSuccess}
                    </div>
                  )}

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5">
                        Title *
                      </label>
                      <input 
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder='e.g., Alpilean Weight Loss System'
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5">
                        Description *
                      </label>
                      <textarea 
                        required
                        rows={3}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Tailor product facets (materials, tactile properties, conversion parameters)..."
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5">
                          Expected Payout (USD) *
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formPrice}
                          onChange={(e) => setFormPrice(e.target.value)}
                          placeholder="e.g., 139.00"
                          className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5">
                          Gravity Score *
                        </label>
                        <input 
                          type="number"
                          step="0.1"
                          min="0"
                          required
                          value={formGravity}
                          onChange={(e) => setFormGravity(e.target.value)}
                          placeholder="e.g., 120.4"
                          className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>Conversion Label (Expected Payout) *</span>
                        <span className="text-[8px] text-neo-gold lowercase italic">display reward structure</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={formConversionLabel}
                        onChange={(e) => setFormConversionLabel(e.target.value)}
                        placeholder="e.g., $139.00 average payout per conversion"
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5 gap-2 flex-wrap">
                        <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
                          Image URL *
                        </label>
                        <button
                          type="button"
                          onClick={generateThemedImagePlaceholder}
                          className="px-2.5 py-1 border border-neo-gold/30 hover:border-neo-gold text-neo-gold hover:bg-neo-gold/10 text-[8px] font-mono tracking-wider uppercase transition-all rounded-sm cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                          title="Generate a high-contrast dark clinical aesthetic placeholder using title + keywords"
                        >
                          ✨ Generate Themed Placeholder
                        </button>
                      </div>
                      <input 
                        type="url"
                        required
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>ClickBank Hoplink URL *</span>
                        <span className="text-[8px] text-neo-gold lowercase italic">required</span>
                      </label>
                      <input 
                        type="url"
                        required
                        value={formAffiliateUrl}
                        onChange={(e) => setFormAffiliateUrl(e.target.value)}
                        placeholder="https://wolfjay26.vendor.hop.clickbank.net"
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                      <div className="mt-2.5 p-3 bg-[#050505] border border-neutral-900 rounded font-mono text-[8px] text-neutral-500 uppercase leading-relaxed space-y-1">
                        <div>
                          Affiliate Nickname: <span className="text-neo-gold font-semibold">wolfjay26</span> (locked)
                        </div>
                        <div className="break-all">
                          Extracted Vendor: <span className="text-neutral-300 font-semibold lowercase">
                            {(() => {
                              let extracted = "vendor";
                              if (formAffiliateUrl.trim()) {
                                try {
                                  const u = new URL(formAffiliateUrl.trim());
                                  const host = u.hostname.toLowerCase();
                                  if (host.includes("hop.clickbank.net")) {
                                    const parts = host.split(".");
                                    extracted = parts.length >= 4 ? parts[1] : (parts.length === 3 ? parts[0] : "vendor");
                                  } else {
                                    extracted = host.split(".")[0];
                                  }
                                } catch(e) {
                                  const match = formAffiliateUrl.trim().match(/(?:[^.]+)\.([^.]+)\.hop\.clickbank\.net/i);
                                  if (match && match[1]) extracted = match[1];
                                }
                              }
                              return extracted;
                            })()}
                          </span>
                        </div>
                        <div className="break-all border-t border-neutral-900 pt-1 mt-1">
                          Resulting Hoplink: <span className="text-neo-gold font-semibold lowercase">
                            {(() => {
                              let extracted = "vendor";
                              if (formAffiliateUrl.trim()) {
                                try {
                                  const u = new URL(formAffiliateUrl.trim());
                                  const host = u.hostname.toLowerCase();
                                  if (host.includes("hop.clickbank.net")) {
                                    const parts = host.split(".");
                                    extracted = parts.length >= 4 ? parts[1] : (parts.length === 3 ? parts[0] : "vendor");
                                  } else {
                                    extracted = host.split(".")[0];
                                  }
                                } catch(e) {
                                  const match = formAffiliateUrl.trim().match(/(?:[^.]+)\.([^.]+)\.hop\.clickbank\.net/i);
                                  if (match && match[1]) extracted = match[1];
                                }
                              }
                              return `https://wolfjay26.${extracted.toLowerCase().trim()}.hop.clickbank.net`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>SEO Headline</span>
                        <span className="text-[8px] text-neo-gold lowercase italic">optional but recommended</span>
                      </label>
                      <input 
                        type="text"
                        value={formSeoHeadline}
                        onChange={(e) => setFormSeoHeadline(e.target.value)}
                        placeholder="e.g., Discover Your True Path with a Personalized Moon Reading"
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>Who This Is For</span>
                        <span className="text-[8px] text-neo-gold lowercase italic font-light">textarea</span>
                      </label>
                      <textarea 
                        rows={2}
                        value={formWhoItIsFor}
                        onChange={(e) => setFormWhoItIsFor(e.target.value)}
                        placeholder="Describe target demographics, aspirations, or pain points..."
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>Why It Works</span>
                        <span className="text-[8px] text-neo-gold lowercase italic font-light">textarea</span>
                      </label>
                      <textarea 
                        rows={2}
                        value={formWhyItWorks}
                        onChange={(e) => setFormWhyItWorks(e.target.value)}
                        placeholder="Highlight conversion factors, psychology hooks, or rewards..."
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>SEO Keywords</span>
                        <span className="text-[8px] text-neo-gold lowercase italic">comma-separated list</span>
                      </label>
                      <input 
                        type="text"
                        value={formSeoKeywords}
                        onChange={(e) => setFormSeoKeywords(e.target.value)}
                        placeholder="e.g., astrology, moon reading, horoscope, zodiac"
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-[#070707] border border-neutral-900 rounded">
                      <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
                        Is Subscription Billing Structure?
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormIsSubscription(!formIsSubscription)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          formIsSubscription ? 'bg-neo-gold' : 'bg-neutral-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                            formIsSubscription ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>Refund Guarantee Window</span>
                        <span className="text-[8px] text-neutral-500 lowercase">default: 60-Day</span>
                      </label>
                      <input 
                        type="text"
                        value={formRefundWindow}
                        onChange={(e) => setFormRefundWindow(e.target.value)}
                        placeholder="e.g., 60-Day, 30-Day, Lifetime"
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>Included Features / Modules</span>
                        <span className="text-[8px] text-neo-gold lowercase italic font-light">one item per line</span>
                      </label>
                      <textarea 
                        rows={3}
                        value={formIncludedFeatures}
                        onChange={(e) => setFormIncludedFeatures(e.target.value)}
                        placeholder="e.g.&#10;Immediate Digital Access&#10;All Modules & Practical Exercising Tools&#10;24/7 Concierge Support Help"
                        className="w-full bg-[#070707] border border-neutral-900 focus:border-neo-gold rounded p-2.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-700 outline-none transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="glow-btn w-full py-3 bg-neo-gold hover:bg-yellow-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-black font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isSubmitting ? (
                        editingProductId ? "SAVING COMPILATION..." : "REPRODUCING RECORD..."
                      ) : (
                        editingProductId ? "SAVE CHANGES" : "DEPLOY CLICKBANK PRODUCT"
                      )}
                    </button>
                  </form>
                </div>

                {/* Active Catalog Manage List with Confirmed Delete Block */}
                <div className="lg:col-span-12 xl:col-span-7 bg-neutral-950 border border-neutral-900 p-6 rounded-lg h-fit">
                  <h4 className="font-mono text-[9px] text-[#c3a05c] uppercase tracking-widest mb-6 pb-2 border-b border-neutral-900 font-bold">
                    ACTIVE HOUSE ELEMENTS ({products.length})
                  </h4>

                  {products.length === 0 ? (
                    <div className="text-center py-24 border border-dashed border-neutral-900 rounded font-mono text-xs text-neutral-500 uppercase tracking-widest">
                      no custom elements in database
                    </div>
                  ) : (
                    <div className="space-y-4 divide-y divide-neutral-900">
                      {products.map((p, idx) => (
                        <div key={p.id} className={`flex items-start justify-between gap-4 pt-4 ${idx === 0 ? 'pt-0' : ''}`}>
                          <div className="flex gap-4">
                            <img 
                              src={p.images[0]?.url} 
                              alt={p.title} 
                              referrerPolicy="no-referrer"
                              className="w-14 h-14 rounded object-cover border border-neutral-900 bg-neutral-900 shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-display font-medium text-sm text-neutral-200 truncate">{p.title}</span>
                              <span className="font-mono text-[9px] text-neutral-500 mt-1 uppercase truncate">Vendor: {p.cbVendor || "N/A"}</span>
                              <span className="font-mono text-[10px] text-neo-gold mt-1">${parseFloat(p.priceMin.amount).toFixed(2)} USD</span>
                            </div>
                          </div>

                          {/* Confirmation Deletion UI block */}
                          <div className="shrink-0 pt-1 flex items-center gap-2">
                            {activeDeleteId === p.id ? (
                              <div className="flex flex-col items-end gap-2 p-2.5 bg-[#0e0404] border border-rose-900/40 rounded-md">
                                <span className="text-[8px] text-rose-500 uppercase font-mono tracking-widest">CONFIRM REMOVE PIECE?</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleDeleteProduct(p.id)} 
                                    className="px-3 py-1.5 bg-rose-950 text-rose-200 text-[8px] font-mono tracking-widest hover:bg-rose-900 transition-colors rounded-sm border border-rose-800 cursor-pointer"
                                  >
                                    YES
                                  </button>
                                  <button 
                                    onClick={() => setActiveDeleteId(null)} 
                                    className="px-3 py-1.5 bg-neutral-900 text-neutral-400 text-[8px] font-mono tracking-widest hover:text-neutral-200 transition-colors rounded-sm border border-neutral-800 cursor-pointer"
                                  >
                                    NO
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleEditProduct(p)}
                                  className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 text-neutral-400 hover:border-neo-gold hover:text-neo-gold bg-neutral-950 hover:bg-neutral-900 transition-all font-mono text-[8px] tracking-widest uppercase rounded-sm cursor-pointer"
                                  title="Edit item details"
                                >
                                  <Edit className="w-3.5 h-3.5" /> EDIT
                                </button>
                                <button 
                                  onClick={() => setActiveDeleteId(p.id)}
                                  className="flex items-center gap-1.5 px-3 py-2 border border-rose-950/30 text-rose-500 bg-rose-950/5 hover:bg-rose-100 hover:text-black transition-all font-mono text-[8px] tracking-widest uppercase rounded-sm cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> REMOVE
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="mb-12 md:mb-20 overflow-hidden relative border border-neutral-900 rounded-xl bg-gradient-to-br from-neutral-950 to-[#0c0c0c] p-8 md:p-14">
              <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-900/20 rounded-full blur-3xl -z-10"></div>
              <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-stone-900/10 rounded-full blur-3xl -z-10"></div>
              
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-full font-mono text-[9px] tracking-widest text-[#c3a05c] uppercase mb-5">
                  <Sparkles className="w-3 h-3 text-neo-gold" /> Isolated Performance Standards
                </div>
                
                <h2 className="font-display text-3xl md:text-5xl font-light tracking-tight text-neutral-100 leading-tight mb-4">
                  Tactile Precision.<br className="hidden md:inline" /> 
                  <span className="font-medium text-neo-gold">Zero Distraction.</span>
                </h2>
                
                <p className="text-sm md:text-base text-neutral-400 font-light leading-relaxed mb-8">
                  BuyerSpotted deploys agentic research pipelines to isolate, verify, and index high-performance digital systems and wellness technologies. Unbiased analysis. Zero distraction.
                </p>

                <div className="flex flex-wrap gap-4">
                  <a 
                    href="#catalog-view" 
                    className="glow-btn flex items-center gap-2 px-5 py-3 bg-neo-gold hover:bg-yellow-600 text-[#050505] font-mono text-[11px] font-bold tracking-widest uppercase rounded-sm transition-all text-center"
                  >
                    EXPLORE ACTIVE VAULT <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </section>

            {/* Catalog Control Header */}
            <section id="catalog-view" className="mb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-900 pb-6">
                <div>
                  <h3 className="font-display font-semibold text-lg md:text-xl tracking-wider uppercase text-neutral-200">
                    Verified Utility Vault
                  </h3>
                  <p className="font-mono text-xs text-neutral-500 mt-1">
                    Displaying {filteredProducts.length} elite material elements
                  </p>
                </div>

                {/* Category Filter Pills (Mono Aesthetic) */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilteredCategory(cat)}
                      className={`px-4 py-2 font-mono text-[10px] tracking-wider uppercase border rounded-sm transition-all cursor-pointer ${
                        filteredCategory === cat 
                          ? "border-neo-gold text-neo-gold bg-[#c3a05c]/5" 
                          : "border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      {cat === "All" 
                        ? "ALL SCHEMAS" 
                        : cat === "ClickBank Curated" 
                          ? "BRAIN & MENTAL PERFORMANCE" 
                          : cat}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Product Grid Area */}
            <section className="mb-20">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <RefreshCw className="w-10 h-10 text-neo-gold animate-spin" />
                  <p className="font-mono text-xs tracking-wider text-neutral-400 uppercase">Synchronizing with registry...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-24 border border-dashed border-neutral-900 rounded-lg">
                  <Sliders className="w-8 h-8 text-neutral-600 mx-auto mb-4" />
                  <p className="font-mono text-[10px] tracking-widest text-[#c3a05c] uppercase">Curated vault empty</p>
                  <p className="font-mono text-[9px] text-neutral-500 mt-2 uppercase">Custom dynamic pieces will reside here upon Administrator deposit.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((p, idx) => {
                    const primaryImage = p.images[0]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600";
                    const secondaryImage = idx === 0
                      ? "/src/assets/images/futuristic_phone_brain_1780703733009.png"
                      : (p.images[1]?.url || primaryImage);
                    
                    return (
                      <motion.article
                        key={p.id}
                        layoutId={`product-card-${p.id}`}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35 }}
                        className="group flex flex-col justify-between bg-neutral-950 border border-neutral-900 rounded-lg p-5 hover:border-neutral-800 transition-all cursor-pointer relative"
                        onClick={() => navigateToProduct(p.id)}
                      >
                        <div>
                          {/* Image Frame */}
                          <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-neutral-900 mb-4 border border-neutral-900">
                            <img 
                               src={primaryImage} 
                               alt={p.title}
                               referrerPolicy="no-referrer"
                               className="w-full h-full object-contain brightness-95 contrast-105"
                            />
                          </div>

                          {/* Title */}
                          <h4 className="font-display font-medium text-base text-neutral-100 group-hover:text-neo-gold transition-colors truncate mb-4">
                            {p.title}
                          </h4>
                        </div>

                        {/* READ REVIEW Button */}
                        <div className="pt-3 border-t border-neutral-900 flex justify-end">
                          <button
                            className="w-full px-3 py-2 border border-neutral-800 text-neutral-400 group-hover:border-neo-gold group-hover:text-[#050505] group-hover:bg-neo-gold transition-all font-mono text-[9px] tracking-widest uppercase rounded-sm flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>Read Review</span>
                            <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Why BuyerSpotted section */}
            <section className="mb-20 border-t border-neutral-900 pt-16 grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="flex gap-4">
                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg text-neo-gold h-fit">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-display font-medium text-sm text-neutral-100 uppercase tracking-widest mb-2">Computational Sourcing</h5>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Every listed element must satisfy physical-material isolation criteria before deployment to our shop registry.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg text-neo-gold h-fit">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-display font-medium text-sm text-neutral-100 uppercase tracking-widest mb-2">Hand-Checked Verification</h5>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Direct cryptographic keys securely paired over local silicon layouts. We never permit batch-produced consumer slop.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg text-neo-gold h-fit">
                  <X className="w-5 h-5 rotate-45" />
                </div>
                <div>
                  <h5 className="font-display font-medium text-sm text-neutral-100 uppercase tracking-widest mb-2">Direct Channel Access</h5>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Seamless integration with premium search registries. Instantly view component availability and place queries securely.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/40 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 font-mono text-[10px] text-neutral-500">
          <div>
            &copy; 2026 BUYERSPOTTED INC. DEPLOYED Monolithic Relays.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-neutral-300 cursor-pointer">ISOLATION CHARTERS</span>
            <span>&bull;</span>
            <span className="hover:text-neutral-300 cursor-pointer text-neo-gold" onClick={() => setIsChatOpen(true)}>CONSULT SPOTTEDAI</span>
          </div>
        </div>
      </footer>


      {/* ---------------- DRAWERS & DIALOGS ---------------- */}

      {/* 1. SHOPPING CART SIDEBAR DRAWER */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 z-40"
            />
            
            {/* Cart Panel */}
            <motion.aside 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#070707] border-l border-neutral-900 p-6 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-neutral-900 pb-5 mb-6">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-neo-gold" />
                    <h4 className="font-display text-sm font-semibold tracking-widest text-neutral-100 uppercase">ISOLATION VAULT</h4>
                  </div>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-1.5 bg-neutral-950 border border-neutral-900 hover:border-neutral-800 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4 text-neutral-400 hover:text-neutral-100" />
                  </button>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-24 text-neutral-500">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-4 opacity-30" />
                    <p className="font-mono text-xs uppercase tracking-wide">Vault remains empty</p>
                    <p className="text-[11px] font-light mt-1">Select computational components from our curated schemas.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {cart.map((item, index) => (
                      <div key={`${item.product.id}-${item.variant.id}`} className="flex gap-4 p-3 bg-neutral-950 border border-neutral-900 rounded-md hover:border-neutral-800 transition-colors">
                        <img 
                          src={item.product.images[0]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600"} 
                          alt={item.product.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 object-cover bg-neutral-900 rounded-sm border border-neutral-900"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h5 className="font-display font-medium text-xs text-neutral-200 truncate">
                              {item.product.title}
                            </h5>
                            <p className="font-mono text-[9px] text-[#c3a05c] mt-0.5 truncate uppercase">
                              {item.variant.title}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            {/* Quantity controls */}
                            <div className="flex items-center border border-neutral-900 bg-neutral-950 rounded-sm">
                              <button 
                                onClick={() => updateCartQuantity(index, -1)}
                                className="px-2 py-1 text-neutral-500 hover:text-neutral-200 transition-colors"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="font-mono text-[10px] px-2 text-neutral-300">{item.quantity}</span>
                              <button 
                                onClick={() => updateCartQuantity(index, 1)}
                                className="px-2 py-1 text-neutral-500 hover:text-neutral-200 transition-colors"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            
                            {/* Price */}
                            <span className="font-mono text-xs text-neutral-300">
                              ${(parseFloat(item.variant.price.amount) * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeCartItem(index)}
                          className="p-1.5 self-start text-neutral-600 hover:text-neutral-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checkout Actions Block */}
              {cart.length > 0 && (
                <div className="border-t border-neutral-900 pt-5 mt-6">
                  <div className="flex justify-between items-center font-mono text-xs mb-5">
                    <span className="text-neutral-500">AGGREGATE VALUE</span>
                    <span className="text-sm font-semibold text-neutral-100">
                      ${cartSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>

                  <button
                    onClick={initiateClickBankView}
                    className="glow-btn w-full py-4 bg-neo-gold hover:bg-yellow-600 text-black font-mono text-[11px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-2 transition-all"
                  >
                    PROCEED TO CLICKBANK <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <p className="font-mono text-[8px] text-center text-neutral-600 uppercase mt-3">
                    Redirecting to matching secure ClickBank Hoplink.
                  </p>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>


      {/* 2. SPOTTEDAI CONCIERGE DRAWER (GEMINI-POWERED) */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/80 z-40"
            />

            {/* Chat Drawer */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#070707] border-l border-neutral-900 p-6 shadow-2xl z-50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-neutral-900 pb-5 mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neo-gold" />
                    <div>
                      <h4 className="font-display text-sm font-semibold tracking-wider text-neutral-100 uppercase">SPOTTEDAI ADVISOR</h4>
                      <span className="font-mono text-[8px] text-neo-gold uppercase tracking-widest block mt-0.5">Gemini 3.5 Active</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1.5 bg-neutral-950 border border-neutral-900 hover:border-neutral-800 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4 text-neutral-400 hover:text-neutral-100" />
                  </button>
                </div>

                {/* Message display thread */}
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 mb-4 flex flex-col">
                  {chatMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`max-w-[85%] flex flex-col p-3 rounded-md ${
                        msg.role === "user" 
                          ? "bg-neutral-900 border border-neutral-800 self-end text-neutral-200" 
                          : "bg-neutral-950 border border-neutral-900 self-start text-neutral-300"
                      }`}
                    >
                      <p className="text-xs font-light leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </p>
                      
                      {/* Message metadata */}
                      <span className="font-mono text-[8px] text-neutral-600 uppercase mt-1.5 self-end tracking-wider">
                        {msg.role === "model" ? "SPOTTEDAI" : "BUYER"} &bull; {msg.timestamp}
                      </span>
                    </div>
                  ))}
                  
                  {isAskingAI && (
                    <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-md self-start max-w-[85%]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-neo-gold animate-bounce"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-neo-gold animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-neo-gold animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-neutral-900 pt-4">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                    placeholder="Inquire about sensory isolation specs..."
                    className="w-full bg-neutral-950 border border-neutral-900 focus:border-neo-gold text-neutral-200 rounded-sm py-3 pl-4 pr-12 font-mono text-[10px] tracking-wider placeholder-neutral-600 focus:outline-none transition-colors"
                  />
                  <button 
                    onClick={handleSendChatMessage}
                    disabled={!userInput.trim() || isAskingAI}
                    className="absolute right-2 p-1.5 text-neutral-500 hover:text-neo-gold hover:scale-105 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3 p-2 bg-neutral-950 border border-neutral-900 rounded font-mono text-[8px] text-neutral-500">
                  <Info className="w-3.5 h-3.5 text-neo-gold shrink-0" />
                  <span className="uppercase">SpottedAI recommendations locate original premium products dynamically.</span>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>


      {/* 3. PRODUCT QUICK VIEW MODAL */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/90 z-40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              layoutId={`product-card-${selectedProduct.id}`}
              className="fixed inset-x-4 top-10 md:top-24 max-w-4xl mx-auto bg-[#070707] border border-neutral-900 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                
                {/* Image Section */}
                <div className="p-6 md:p-8 bg-neutral-950 flex flex-col justify-between border-r border-neutral-900">
                  <div>
                    {/* Active Screen Frame */}
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-neutral-900 border border-neutral-900 mb-4 relative">
                      <img 
                        src={selectedProduct.images[activeImageIdx]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600"} 
                        alt={selectedProduct.images[activeImageIdx]?.altText || selectedProduct.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain brightness-95"
                      />
                    </div>

                    {/* Thumbnail gallery */}
                    {selectedProduct.images.length > 1 && (
                      <div className="flex gap-2">
                        {selectedProduct.images.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveImageIdx(idx)}
                            className={`w-14 h-14 rounded-md overflow-hidden bg-neutral-900 border transition-all ${
                              activeImageIdx === idx ? "border-neo-gold" : "border-neutral-900 hover:border-neutral-700"
                            }`}
                          >
                            <img src={img.url} alt="thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Verdict Block */}
                  {selectedProduct.curatedVerdict && (
                    <div className="mt-8 p-4 bg-neutral-950 border border-neutral-900 rounded-lg">
                      <span className="font-mono text-[9px] text-neo-gold uppercase tracking-wider block mb-1">CURATED VERDICT</span>
                      <p className="font-serif italic text-xs text-neutral-400 leading-relaxed font-light">
                        "{selectedProduct.curatedVerdict}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Information Section */}
                <div className="p-6 md:p-8 flex flex-col justify-between h-full">
                  <div>
                    
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[10px] tracking-widest text-neo-gold uppercase">
                        {selectedProduct.category || "CURATED PIECE"}
                      </span>
                      <button 
                        onClick={() => setSelectedProduct(null)}
                        className="p-1 text-neutral-500 hover:text-neutral-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <h4 className="font-display font-medium text-xl md:text-2xl text-neutral-100 tracking-wide mb-3">
                      {selectedProduct.title}
                    </h4>

                    <p className="text-xs text-neutral-300 font-light leading-relaxed mb-6">
                      {selectedProduct.description}
                    </p>
                    
                    {/* SEO / Curated Multi-Channel Copy Section */}
                    {(selectedProduct.seoHeadline || selectedProduct.whoItIsFor || selectedProduct.whyItWorks || selectedProduct.seoKeywords) && (
                      <div className="mb-6 p-4 bg-[#090909] border border-neutral-900 rounded-lg space-y-4 font-mono text-[10px]">
                        {selectedProduct.seoHeadline && (
                          <div>
                            <span className="text-[8px] text-neo-gold uppercase tracking-widest block mb-1">SEO Headline</span>
                            <p className="text-neutral-100 font-display font-medium text-xs tracking-normal leading-normal">{selectedProduct.seoHeadline}</p>
                          </div>
                        )}
                        {selectedProduct.whoItIsFor && (
                          <div>
                            <span className="text-[8px] text-[#c3a05c] uppercase tracking-widest block mb-0.5">Who This Is For</span>
                            <p className="text-neutral-400 font-light leading-relaxed">{selectedProduct.whoItIsFor}</p>
                          </div>
                        )}
                        {selectedProduct.whyItWorks && (
                          <div>
                            <span className="text-[8px] text-[#c3a05c] uppercase tracking-widest block mb-0.5">Why It Works</span>
                            <p className="text-neutral-400 font-light leading-relaxed">{selectedProduct.whyItWorks}</p>
                          </div>
                        )}
                        {selectedProduct.seoKeywords && (
                          <div>
                            <span className="text-[8px] text-neutral-500 uppercase tracking-widest block mb-1.5">Target Search Keywords</span>
                            <div className="flex flex-wrap gap-1">
                              {selectedProduct.seoKeywords.split(",").map((kw, i) => kw.trim() && (
                                <span key={i} className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-900 rounded text-[8px] text-neutral-400 uppercase font-light">
                                  {kw.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Variant Selectors (Radio buttons style) */}
                    {selectedProduct.variants.length > 0 && (
                      <div className="mb-6">
                        <span className="font-mono text-[9px] text-neutral-500 tracking-wider uppercase block mb-2.5">
                          SELECT COMPILATION SCHEMA
                        </span>
                        <div className="space-y-2">
                          {selectedProduct.variants.map((v) => {
                            const isSelected = modalVariant?.id === v.id;
                            
                            return (
                              <button
                                key={v.id}
                                onClick={() => setModalVariant(v)}
                                className={`w-full flex items-center justify-between p-3 rounded-md border font-mono text-[10px] tracking-wide transition-all ${
                                  isSelected 
                                    ? "bg-neutral-950 border-neo-gold text-neo-gold" 
                                    : "bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-neo-gold' : 'bg-neutral-700'}`}></span>
                                  {v.title}
                                </span>
                                <span className="font-semibold text-neutral-100">
                                  ${parseFloat(v.price.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Specifications Monospace Matrix */}
                    {selectedProduct.specifications && (
                      <div className="mb-8 border-t border-neutral-900 pt-5">
                        <span className="font-mono text-[9px] text-neutral-500 tracking-wider uppercase block mb-3">
                          METALLURGY & INTERACTIVE PROPERTIES
                        </span>
                        <div className="bg-neutral-950 border border-neutral-900 rounded-md overflow-hidden divide-y divide-neutral-900 font-mono text-[9px]">
                          {Object.entries(selectedProduct.specifications).map(([key, value]) => (
                            <div key={key} className="flex px-3 py-2">
                              <span className="w-1/3 text-neutral-500">{key}</span>
                              <span className="w-2/3 text-neutral-300 font-light truncate">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions & Price */}
                  <div>
                    <div className="flex items-center justify-between border-t border-neutral-900 pt-5 mb-5">
                      <div className="flex flex-col">
                        <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-wider">AGGREGATE DUES</span>
                        <span className="font-mono text-base font-semibold text-neutral-200">
                          ${((modalVariant ? parseFloat(modalVariant.price.amount) : 0) * modalQuantity).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                        </span>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center border border-neutral-900 bg-neutral-950 rounded-sm">
                        <button 
                          onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                          className="px-2.5 py-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs px-3 text-neutral-200">{modalQuantity}</span>
                        <button 
                          onClick={() => setModalQuantity(modalQuantity + 1)}
                          className="px-2.5 py-1.5 text-neutral-500 hover:text-neutral-200 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Add Button */}
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          if (selectedProduct && modalVariant) {
                            handleAddToCart(selectedProduct, modalVariant, modalQuantity);
                            setSelectedProduct(null); // Close modal
                          }
                        }}
                        className="glow-btn w-full py-3.5 bg-neo-gold hover:bg-yellow-600 text-[#050505] font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        SECURE COMPILATION TO VAULT <ShoppingBag className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (selectedProduct) {
                            navigateToProduct(selectedProduct.id);
                            setSelectedProduct(null); // Close modal
                          }
                        }}
                        className="w-full py-2.5 border border-neutral-900 hover:border-[#c3a05c] bg-neutral-950 text-neutral-400 hover:text-[#c3a05c] font-mono text-[9px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        VIEW PRE-SELL BRIDGE PAGE <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
