import { useState, useEffect, useRef, FormEvent, ReactNode } from "react";
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
  Users,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ShopifyProduct, ShopifyVariant, CartItem, ChatMessage, BlogPost } from "./types";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, setDoc, where } from "firebase/firestore";
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
    category: docData.category || "ClickBank Curated",
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

const determineCategory = (title: string): string => {
  const t = (title || "").toLowerCase();
  if (t.includes("sleep") || t.includes("rest") || t.includes("dream")) {
    return "Sleep & Restoration";
  }
  if (t.includes("astrology") || t.includes("moon") || t.includes("reading") || t.includes("manifest")) {
    return "Astrology & Spirituality";
  }
  if (t.includes("woodworking") || t.includes("plan") || t.includes("diy") || t.includes("craft")) {
    return "Crafts & DIY";
  }
  if (t.includes("sugar") || t.includes("defend") || t.includes("metabol") || t.includes("tea") || t.includes("coffee") || t.includes("belly") || t.includes("weight") || t.includes("diet") || t.includes("smoothie") || t.includes("liver") || t.includes("fat") || t.includes("joint") || t.includes("prostate") || t.includes("hear") || t.includes("ear") || t.includes("tinnitus") || t.includes("skin") || t.includes("gastro") || t.includes("radiance")) {
    return "Health & Wellness";
  }
  return "ClickBank Curated";
};

const getCategoryDetails = (catName: string) => {
  const norm = (catName || "").trim().toLowerCase();
  
  let accent = "#c3a05c"; // default elegant gold
  let desc = `Curated specialized choices and analytical profiles focusing on advanced results in the ${catName} domain.`;
  let image = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600";
  
  if (norm.includes("clickbank") || norm.includes("curated")) {
    accent = "#c3a05c"; // gold
    desc = "Expertly selected and curated marketplace products prioritized for high performance and campaign success.";
    image = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600";
  } else if (norm.includes("sleep") || norm.includes("rest") || norm.includes("night") || norm.includes("cognitive") || norm.includes("dream")) {
    accent = "#5c8dc3"; // blue
    desc = "Expertly curated programs, formulas, and resources focusing on restoring nocturnal cycles and mental focus.";
    image = "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=600";
  } else if (norm.includes("bio") || norm.includes("organic") || norm.includes("formulation") || norm.includes("health") || norm.includes("wellness") || norm.includes("metabolic") || norm.includes("fat") || norm.includes("weight")) {
    accent = "#68c35c"; // green
    desc = "Verified organic formulas, advanced health supplements, and physical wellness protocols.";
    image = "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=600";
  } else if (norm.includes("craft") || norm.includes("diy") || norm.includes("wood") || norm.includes("woodworking")) {
    accent = "#c3835c"; // bronze / orange
    desc = "Step-by-step instructional guides, digital templates, and blueprints for physical arts and crafts.";
    image = "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600";
  } else if (norm.includes("neural") || norm.includes("mind") || norm.includes("manifest") || norm.includes("astrology") || norm.includes("spirituality") || norm.includes("moon")) {
    accent = "#9b5cc3"; // purple
    desc = "Cognitive development guides, astrology readings, mindset methodologies, and mental balance tools.";
    image = "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600";
  } else {
    // Generate a quick deterministic accent color based on catName string hash to keep them unique and styled!
    let hash = 0;
    for (let i = 0; i < catName.length; i++) {
        hash = catName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ["#c3a05c", "#5c8dc3", "#c3655c", "#9b5cc3", "#68c35c", "#c3835c", "#5cc3b9"];
    accent = colors[Math.abs(hash) % colors.length];
  }

  return {
    title: catName,
    desc,
    accent,
    image
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

const getProductAestheticDescription = (p: ShopifyProduct): string => {
  const titleLower = p.title.toLowerCase();
  if (titleLower.includes("java burn")) {
    return "A flavorless daily morning coffee additive engineered to systematically ignite resting metabolic rates.";
  }
  if (titleLower.includes("brain wave") || titleLower.includes("billionaire brain")) {
    return "An acoustic neural-frequency directive designed to target and realign cognitive abundance factors.";
  }
  if (titleLower.includes("sugar defender")) {
    return "A premium glycemic balancing catalyst curated to support daily cellular energy equilibrium and clear brain fog.";
  }
  if (titleLower.includes("puravive")) {
    return "An exotic metabolic activation key targeting brown adipose tissues to support systematic body optimization.";
  }
  if (titleLower.includes("joint genesis")) {
    return "An advanced joint matrix targeting synovial fluid health to support raw mobility and tissue preservation.";
  }
  if (titleLower.includes("sleep") || titleLower.includes("yu sleep")) {
    return "A specialized nocturnal recovery blend synthesized to initiate deep restful REM cycles and cellular restoration.";
  }
  if (titleLower.includes("woodworking") || titleLower.includes("tedswoodworking")) {
    return "A premium manual matrix containing 16,000 highly precise blueprint schematics for professional and home design.";
  }
  if (titleLower.includes("moon reading") || titleLower.includes("astrology") || titleLower.includes("wealth secret")) {
    return "A personalized mental tuning blueprint and auditory alignment sequence tailored for cognitive abundance.";
  }
  
  return (p.description || "An elite, scientifically structural formulation tailored for comprehensive biological performance.")
    .replace(/ClickBank|VSL|hoplink|affiliate|Gravity|funnel|VSL strategy|Campaign/gi, "Vetted")
    .trim();
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

// SEO-optimized safe URL slug generator
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric characters
    .replace(/\s+/g, "-")         // replace spaces with hyphens
    .replace(/-+/g, "-")          // collapse multiple consecutive hyphens
    .replace(/^-+|-+$/g, "");     // trim hyphens from the start and end
};

// Safe, high-performance inline markdown parsing helper
const parseInlineMarkdown = (text: string): ReactNode => {
  if (!text) return "";
  
  // Safe HTML escape to prevent XSS while allowing designated formatting
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Re-allow underline tags specifically
  escaped = escaped.replace(/&lt;u&gt;/g, "<u>").replace(/&lt;\/u&gt;/g, "</u>");

  // Replace Markdown syntaxes with safe semantic HTML tags
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-neutral-100'>$1</strong>");
  escaped = escaped.replace(/\*(.*?)\*/g, "<em class='italic font-medium'>$1</em>");
  escaped = escaped.replace(/~~(.*?)~~/g, "<del class='line-through text-neutral-500'>$1</del>");
  escaped = escaped.replace(/`(.*?)`/g, '<code class="font-mono bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded text-[10px] text-neo-gold font-semibold">$1</code>');
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-neo-gold hover:text-yellow-405 hover:underline font-semibold transition-colors" target="_blank" rel="noopener noreferrer">$1</a>');

  return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
};

// Complete, semantic markdown element renderer for blog articles (re-used for preview & final pages)
const renderArticleLine = (
  line: string, 
  bIdx: number, 
  products: ShopifyProduct[], 
  featuredProductId?: string, 
  blogFormCtaText?: string, 
  blogFormCtaLink?: string
): ReactNode => {
  const trimmed = line.trim();
  
  if (trimmed === "[Affiliate CTA Callout Block]") {
    // Look up featured product
    const tiedProd = products.find(p => p.id === featuredProductId);
    if (!tiedProd) {
      return (
        <div key={bIdx} className="my-6 p-4 border border-dashed border-neutral-800 text-center text-[10px] text-[#c3a05c] font-mono uppercase bg-[#070707] rounded-lg">
          [Affiliate Callout: Product reference slot has not been link-bounded in the metadata panel]
        </div>
      );
    }
    const prodPrice = tiedProd.priceMin ? parseFloat(tiedProd.priceMin.amount) : 0;
    const tiedProdImg = tiedProd.images && tiedProd.images[0] ? tiedProd.images[0].url : "";
    return (
      <div key={bIdx} className="my-8 bg-[#090909]/80 border border-[#c3a05c]/30 rounded-lg p-5 md:p-6 relative overflow-hidden group shadow-xl transition-all duration-300 hover:border-[#c3a05c]/60">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neo-gold/5 blur-3xl rounded-full"></div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {tiedProdImg && (
            <img 
              src={tiedProdImg} 
              alt={tiedProd.title} 
              className="w-16 h-16 object-cover rounded-md border border-neutral-800 bg-black shadow-inner"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="flex-1 min-w-0">
            <span className="block font-mono text-[8px] text-neo-gold uppercase tracking-widest font-bold">EXPERT VAULT RECOMMENDED SOLUTION</span>
            <h4 className="font-display font-bold text-sm text-neutral-100 uppercase mt-0.5 tracking-tight group-hover:text-neo-gold transition-colors">{tiedProd.title}</h4>
            <p className="font-sans text-[10px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
              {tiedProd.seoHeadline || tiedProd.description}
            </p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="block font-sans font-bold text-[#c3a05c] text-xs uppercase">{tiedProd.conversionLabel || `$${prodPrice.toFixed(2)} Target Program Value`}</span>
            <span className="block font-mono text-[7px] text-neutral-500 uppercase mt-0.5">PURCHASE PLATFORM GUARANTEED • 100% SECURE SHIPMENT</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const link = blogFormCtaLink || tiedProd.amazonUrl || tiedProd.clickbankUrl;
              if (link) window.open(link, "_blank", "noopener,noreferrer");
            }}
            className="px-5 py-2.5 bg-neo-gold text-black font-semibold uppercase font-mono text-[9px] tracking-widest rounded-sm hover:bg-yellow-500 transition-all cursor-pointer flex items-center justify-center gap-1 text-center shadow-lg hover:shadow-neo-gold/10"
          >
            {blogFormCtaText || "Access Offer Details"} →
          </button>
        </div>
      </div>
    );
  }

  if (trimmed.startsWith("# ")) {
    return <h2 key={bIdx} className="font-display font-semibold text-lg md:text-xl text-neutral-100 uppercase tracking-widest mt-8 mb-4 border-l-2 border-neo-gold pl-3">{parseInlineMarkdown(trimmed.slice(2))}</h2>;
  }
  if (trimmed.startsWith("## ")) {
    return <h3 key={bIdx} className="font-sans font-semibold text-sm text-neo-gold uppercase tracking-wider mt-6 mb-2">{parseInlineMarkdown(trimmed.slice(3))}</h3>;
  }
  if (trimmed.startsWith("### ")) {
    return <h4 key={bIdx} className="font-sans font-semibold text-xs text-neutral-200 uppercase tracking-wide mt-4 mb-2">{parseInlineMarkdown(trimmed.slice(4))}</h4>;
  }
  if (trimmed.startsWith("> ")) {
    return <blockquote key={bIdx} className="border-l-2 border-neo-gold pl-4 py-2.5 my-6 text-neutral-400 italic bg-[#0d0d0d] rounded-r text-[13px]">{parseInlineMarkdown(trimmed.slice(2))}</blockquote>;
  }
  if (trimmed.startsWith("- ")) {
    return <li key={bIdx} className="list-disc ml-6 text-neutral-300 font-light mb-1.5">{parseInlineMarkdown(trimmed.slice(2))}</li>;
  }
  if (/^\d+\.\s/.test(trimmed)) {
    const listText = trimmed.replace(/^\d+\.\s/, "");
    return <li key={bIdx} className="list-decimal ml-6 text-neutral-300 font-light mb-1.5">{parseInlineMarkdown(listText)}</li>;
  }
  if (trimmed === "---") {
    return <hr key={bIdx} className="border-neutral-900 my-8" />;
  }
  if (trimmed.startsWith("![") && trimmed.includes("](") && trimmed.endsWith(")")) {
    const alt = trimmed.substring(2, trimmed.indexOf("]Custom("));
    // Safe parse URLs
    const urlStart = trimmed.indexOf("](") + 2;
    const urlEnd = trimmed.length - 1;
    const src = trimmed.substring(urlStart, urlEnd);
    return (
      <div key={bIdx} className="my-5 text-center">
        <img src={src} alt={alt} className="max-h-[350px] mx-auto rounded border border-neutral-900 shadow-lg object-cover" referrerPolicy="no-referrer" />
        {alt && <span className="block text-[9px] font-mono text-neutral-500 uppercase mt-1">{alt}</span>}
      </div>
    );
  }

  return <p key={bIdx} className="mb-4 leading-relaxed font-light text-neutral-305 text-sm md:text-base">{parseInlineMarkdown(line)}</p>;
};

export default function App() {
  // State elements
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [activeBlogCategoryFilter, setActiveBlogCategoryFilter] = useState("All");

  // Blog categories state loaded from Firestore
  const [blogCategories, setBlogCategories] = useState<string[]>([
    "Health & Wellness",
    "DIY & Home",
    "Product Reviews",
    "Affiliate Marketing"
  ]);
  const [newBlogCategory, setNewBlogCategory] = useState("");
  const [isAddingNewBlogCategory, setIsAddingNewBlogCategory] = useState(false);
  const [blogCatError, setBlogCatError] = useState("");
  
  // Blog editor administration states
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isBlogFormOpen, setIsBlogFormOpen] = useState(false);
  const [blogFormTitle, setBlogFormTitle] = useState("");
  const [blogFormSlug, setBlogFormSlug] = useState("");
  const [blogFormContent, setBlogFormContent] = useState("");
  const [blogFormCategory, setBlogFormCategory] = useState("Health & Wellness");
  const [blogFormStatus, setBlogFormStatus] = useState<'draft' | 'published'>("published");
  const [blogFormVisibility, setBlogFormVisibility] = useState<'public' | 'admins' | 'members'>("public");
  const [blogFormSeoKeywords, setBlogFormSeoKeywords] = useState("");
  const [blogFormCtaText, setBlogFormCtaText] = useState("Check Discount Price");
  const [blogFormCtaLink, setBlogFormCtaLink] = useState("");
  const [blogFormImageUrl, setBlogFormImageUrl] = useState("");
  const [blogFormAuthorName, setBlogFormAuthorName] = useState("BuyerSpotted");
  const [blogFormFeaturedProduct, setBlogFormFeaturedProduct] = useState("");
  const [isBlogSaving, setIsBlogSaving] = useState(false);
  const [blogIncludeProduct, setBlogIncludeProduct] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<"edit" | "preview" | "split">("edit");

  const insertMarkdownTag = (type: string) => {
    const textarea = document.getElementById("blog-content-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    let replacement = "";
    switch(type) {
      case "h1":
        replacement = `\n# ${selectedText || "Heading 1"}\n`;
        break;
      case "h2":
        replacement = `\n## ${selectedText || "Heading 2"}\n`;
        break;
      case "h3":
        replacement = `\n### ${selectedText || "Heading 3"}\n`;
        break;
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        break;
      case "underline":
        replacement = `<u>${selectedText || "underlined text"}</u>`;
        break;
      case "strikethrough":
        replacement = `~~${selectedText || "strikethrough text"}~~`;
        break;
      case "blockquote":
        replacement = `\n> ${selectedText || "Quote Block"}\n`;
        break;
      case "bullet":
        replacement = `\n- ${selectedText || "Bulleted list item"}\n`;
        break;
      case "numbered":
        replacement = `\n1. ${selectedText || "Numbered list item"}\n`;
        break;
      case "divider":
        replacement = `\n---\n`;
        break;
      case "link":
        replacement = `[${selectedText || "Link text"}](https://example.com)`;
        break;
      case "image":
        replacement = `![${selectedText || "Image Alt"}](https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=605)`;
        break;
      case "affiliate-box":
        replacement = `\n[Affiliate CTA Callout Block]\n`;
        break;
      default:
        // Handle direct emoji insertion or arbitrary text
        replacement = type;
    }
    const newValue = text.substring(0, start) + replacement + text.substring(end);
    setBlogFormContent(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + replacement.length;
      textarea.selectionEnd = start + replacement.length;
    }, 10);
  };

  const [filteredCategory, setFilteredCategory] = useState<string>("All");
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Helper: Convert title into a lowercase, hyphenated slug
  const getProductSlug = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // remove special characters except spaces and hyphens
      .replace(/[\s_]+/g, "-")   // replace spaces and underscores with hyphens
      .replace(/-+/g, "-");      // collapse multiple consecutive hyphens
  };

  // Custom SPA Router state for dynamic /:productSlug and /category/:category routing
  const [activeCategoryPage, setActiveCategoryPage] = useState<string | null>(() => {
    const matchCategory = window.location.pathname.match(/^\/category\/([^/]+)/);
    if (matchCategory) return decodeURIComponent(matchCategory[1]);
    return null;
  });

  const [pathProductSlug, setPathProductSlug] = useState<string | null>(() => {
    const matchProduct = window.location.pathname.match(/^\/product\/([^/]+)/);
    if (matchProduct) return matchProduct[1];

    const rootMatch = window.location.pathname.match(/^\/([^/]+)/);
    if (rootMatch && rootMatch[1] !== "admin" && rootMatch[1] !== "api" && rootMatch[1] !== "category" && rootMatch[1] !== "blog") {
      return rootMatch[1];
    }
    return null;
  });

  const [isBlogPageActive, setIsBlogPageActive] = useState<boolean>(() => {
    return window.location.pathname === "/blog" || window.location.pathname.startsWith("/blog/");
  });

  const [blogPostSlug, setBlogPostSlug] = useState<string | null>(() => {
    const matchBlog = window.location.pathname.match(/^\/blog\/([^/]+)/);
    if (matchBlog) return matchBlog[1];
    return null;
  });

  useEffect(() => {
    const handlePopState = () => {
      const matchProduct = window.location.pathname.match(/^\/product\/([^/]+)/);
      const matchCategory = window.location.pathname.match(/^\/category\/([^/]+)/);
      const matchBlog = window.location.pathname.match(/^\/blog\/([^/]+)/);
      const isBlog = window.location.pathname === "/blog" || window.location.pathname.startsWith("/blog/");

      setIsBlogPageActive(isBlog);
      setBlogPostSlug(matchBlog ? matchBlog[1] : null);

      if (isBlog) {
        setPathProductSlug(null);
        setActiveCategoryPage(null);
        return;
      }

      if (matchProduct) {
        setPathProductSlug(matchProduct[1]);
        setActiveCategoryPage(null);
        return;
      }
      if (matchCategory) {
        setPathProductSlug(null);
        setActiveCategoryPage(decodeURIComponent(matchCategory[1]));
        return;
      }
      const rootMatch = window.location.pathname.match(/^\/([^/]+)/);
      if (rootMatch && rootMatch[1] !== "admin" && rootMatch[1] !== "api" && rootMatch[1] !== "category" && rootMatch[1] !== "blog") {
        setPathProductSlug(rootMatch[1]);
        setActiveCategoryPage(null);
        return;
      }
      setPathProductSlug(null);
      setActiveCategoryPage(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToProduct = (title: string) => {
    const slug = getProductSlug(title);
    window.history.pushState({}, "", `/${slug}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToCategory = (catName: string) => {
    window.history.pushState({}, "", `/category/${encodeURIComponent(catName)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToBlog = () => {
    window.history.pushState({}, "", "/blog");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToBlogPost = (slug: string) => {
    window.history.pushState({}, "", `/blog/${slug}`);
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

  const isCurrentUserAdmin = userProfile?.role === UserRole.ADMIN || currentUser?.email === ADMIN_EMAIL;

  // Administration View and ClickBank Form State
  const [isAdminViewActive, setIsAdminViewActive] = useState(false);
  const [adminTab, setAdminTab] = useState<"vault" | "warehouse" | "settings" | "analytics" | "blog">("vault");
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
  const [formCategory, setFormCategory] = useState("ClickBank Curated");

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

  // Dynamic real-time blog database feed (supports guest published filtering vs. admin raw view)
  useEffect(() => {
    let unsubscribeBlog: (() => void) | null = null;
    const isUserAdmin = userProfile?.role === UserRole.ADMIN || currentUser?.email === ADMIN_EMAIL;

    let blogQ;
    if (isUserAdmin) {
      blogQ = query(collection(db, "blogPosts"));
    } else {
      blogQ = query(collection(db, "blogPosts"), where("status", "==", "published"));
    }

    unsubscribeBlog = onSnapshot(blogQ, (snapshot) => {
      const fbBlogPosts = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: d.title || "",
          slug: d.slug || "",
          content: d.content || "",
          category: d.category || "Health & Wellness",
          status: d.status || "draft",
          visibility: d.visibility || "public",
          seoKeywords: d.seoKeywords || "",
          readingTime: typeof d.readingTime === 'number' ? d.readingTime : 5,
          ctaText: d.ctaText || "Check Discount Price",
          ctaLink: d.ctaLink || "",
          imageUrl: d.imageUrl || "",
          authorName: d.authorName || "BuyerSpotted Editor",
          viewCount: typeof d.viewCount === 'number' ? d.viewCount : 0,
          featuredProductId: d.featuredProductId || "",
          createdAt: d.createdAt ? (d.createdAt.seconds ? new Date(d.createdAt.seconds * 1000).toISOString() : String(d.createdAt)) : new Date().toISOString(),
          updatedAt: d.updatedAt ? (d.updatedAt.seconds ? new Date(d.updatedAt.seconds * 1000).toISOString() : String(d.updatedAt)) : new Date().toISOString(),
        } as BlogPost;
      });

      // Sort client-side to prevent missing Firestore index errors
      fbBlogPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setBlogPosts(fbBlogPosts);
    }, (err) => {
      console.error("Firestore loading blog posts error:", err);
      try {
        handleFirestoreError(err, OperationType.LIST, "blogPosts");
      } catch (logErr) {
        // Suppress to prevent unhandled promise rejection warnings in UI loggers, but error is already reported
      }
      setBlogPosts([]);
    });

    return () => {
      if (unsubscribeBlog) unsubscribeBlog();
    };
  }, [userProfile, currentUser]);

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

  // Load blog categories from database
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "blogCategories"), (snapshot) => {
      const dbCats = snapshot.docs.map(doc => doc.data().name as string).filter(Boolean);
      const defaultCats = [
        "Health & Wellness",
        "DIY & Home",
        "Product Reviews",
        "Affiliate Marketing"
      ];
      const merged = Array.from(new Set([
        ...defaultCats,
        ...dbCats
      ]));
      setBlogCategories(merged);
    }, (err) => {
      console.error("Firestore loading blog categories error:", err);
    });
    return () => unsub();
  }, []);
  
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

      // Auto-seeding when the products collection is empty
      if (snapshot.empty && localStorage.getItem("buyerspotted_seeded_v3") !== "true") {
        localStorage.setItem("buyerspotted_seeded_v3", "true");
        (async () => {
          try {
            console.log("Empty Firestore database. Seeding 20 high-performance products...");
            const res = await fetch("/data/products.json");
            if (!res.ok) {
              throw new Error("HTTP fetching products.json returned " + res.status);
            }
            const dataList = await res.json();
            if (Array.isArray(dataList)) {
              for (const p of dataList) {
                const rawPrice = p.avg_per_conversion ? String(p.avg_per_conversion).replace(/[^0-9.]/g, "") : "49.00";
                const priceVal = parseFloat(rawPrice) || 49.00;
                
                const cbVendorValue = (p.title || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "vendor";
                const forcedAffiliate = "wolfjay26";
                const rawAffiliateUrl = `https://${forcedAffiliate}.${cbVendorValue}.hop.clickbank.net`;

                const determinedCat = determineCategory(p.title);
                
                await addDoc(collection(db, "products"), {
                  title: p.title || "",
                  description: `Expert ClickBank campaign leveraging a high-converting ${p.funnel_angle || "direct response"} marketing strategy.`,
                  price: priceVal,
                  cbVendor: cbVendorValue,
                  cbAffiliate: forcedAffiliate,
                  gravity: parseFloat(p.gravity_score) || 0,
                  conversionLabel: p.avg_per_conversion ? `${p.avg_per_conversion} Average $/Conversion` : `$${priceVal.toFixed(2)} Expected Payout`,
                  imageUrl: getProductPlaceholderImage(p.title),
                  affiliateUrl: p.affiliate_tools_url || rawAffiliateUrl,
                  seoHeadline: p.seo_headline || "",
                  whoItIsFor: p.who_it_is_for || "",
                  whyItWorks: p.why_it_works || "",
                  seoKeywords: p.seo_keywords || [],
                  category: determinedCat,
                  is_subscription: p.is_subscription === true,
                  refund_window: p.refund_window || "60-Day",
                  included_features: p.included_features || [],
                  createdAt: serverTimestamp()
                });
              }
              console.log("Products seeding successfully deployed to Firestore.");
            }
          } catch (seedErr) {
            console.error("Auto-seeding exception:", seedErr);
            localStorage.removeItem("buyerspotted_seeded_v3");
          }
        })();
      }
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

  // Dynamic SEO Title, Description, and Structured JSON-LD Schema injector
  useEffect(() => {
    let title = "BuyerSpotted | Curated Luxury Tech Vault - High-Gravity Deals";
    let description = "Discover and secure under-the-radar luxury products, dermal essences, sport equipment, and wellness systems reviewed by experts.";
    let keywords = "clickbank gravity, premium reviews, wellness biohacks, laser red light therapy, dermal micro-spicules";
    let schemaData: any = null;

    if (isAdminViewActive) {
      title = "Administration Control Dashboard | BuyerSpotted Vault";
      description = "Administrative override pane to secure transit records, sync clickbank campaigns, and manage products.";
    } else if (isBlogPageActive) {
      if (blogPostSlug) {
        const foundPost = blogPosts.find(p => p.slug === blogPostSlug);
        if (foundPost) {
          title = `${foundPost.title} | BuyerSpotted Curation Desk`;
          description = foundPost.seoKeywords || foundPost.content.replace(/[#\*`_>\[\]\-\n]/g, " ").substring(0, 155).trim() + "...";
          keywords = foundPost.seoKeywords || keywords;
          
          // Check if there is an affiliate product tied to this post to generate nested Product schema
          const linkedId = foundPost.featuredProductId;
          const associatedProd = products.find(p => p.id === linkedId);
          let nestedProductObj: any = undefined;
          
          if (associatedProd) {
            nestedProductObj = {
              "@type": "Product",
              "name": associatedProd.title,
              "image": associatedProd.images?.[0]?.url || "https://i.ibb.co/CpY1r3Dg/logo.jpg",
              "description": associatedProd.description,
              "offers": {
                "@type": "Offer",
                "price": associatedProd.priceMin ? parseFloat(associatedProd.priceMin.amount) : 0,
                "priceCurrency": associatedProd.priceMin?.currencyCode || "USD",
                "availability": "https://schema.org/InStock",
                "url": associatedProd.clickbankUrl || associatedProd.amazonUrl || window.location.href
              }
            };
          }

          schemaData = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": foundPost.title,
            "image": foundPost.imageUrl || "https://i.ibb.co/CpY1r3Dg/logo.jpg",
            "author": {
              "@type": "Person",
              "name": foundPost.authorName || "BuyerSpotted Desk"
            },
            "publisher": {
              "@type": "Organization",
              "name": "BuyerSpotted",
              "logo": {
                "@type": "ImageObject",
                "url": "https://i.ibb.co/CpY1r3Dg/logo.jpg"
              }
            },
            "description": description,
            "articleSection": foundPost.category || "Affiliate Marketing",
            "about": nestedProductObj
          };
        } else {
          title = "Expert Affiliate Article | BuyerSpotted";
        }
      } else {
        title = "ClickBank Curation & Expert Guides Feed | BuyerSpotted Blog";
        description = "Expert analytical guides and deep buyer reviews tracking the absolute best high-conversion products on the market.";
        
        schemaData = {
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "BuyerSpotted Curation Feed",
          "description": description,
          "publisher": {
            "@type": "Organization",
            "name": "BuyerSpotted"
          }
        };
      }
    } else if (pathProductSlug) {
      const foundProduct = products.find(p => getProductSlug(p.title) === pathProductSlug);
      if (foundProduct) {
        title = `${foundProduct.title} - Expert Review & VIP Deals | BuyerSpotted`;
        description = foundProduct.description.substring(0, 155).trim() + "...";
        const priceVal = foundProduct.priceMin ? parseFloat(foundProduct.priceMin.amount) : 0;
        
        schemaData = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": foundProduct.title,
          "image": foundProduct.images?.[0]?.url || "https://i.ibb.co/CpY1r3Dg/logo.jpg",
          "description": foundProduct.description,
          "offers": {
            "@type": "Offer",
            "price": priceVal,
            "priceCurrency": foundProduct.priceMin?.currencyCode || "USD",
            "availability": "https://schema.org/InStock",
            "url": foundProduct.amazonUrl || foundProduct.clickbankUrl || window.location.href
          }
        };
      }
    } else if (activeCategoryPage) {
      title = `${activeCategoryPage} Premium Gear | BuyerSpotted Curated Collection`;
      description = `Secure high-performance ${activeCategoryPage} deals vetted for structural elegance and material durability.`;
    }

    // Apply document title
    document.title = title;

    // Apply Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Apply Meta Keywords
    let metaKeys = document.querySelector('meta[name="keywords"]');
    if (!metaKeys) {
      metaKeys = document.createElement('meta');
      metaKeys.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeys);
    }
    metaKeys.setAttribute('content', keywords);

    // Apply Schema JSON-LD Script
    let schemaScript = document.getElementById("seo-schema") as HTMLScriptElement;
    if (schemaScript) {
      schemaScript.textContent = schemaData ? JSON.stringify(schemaData) : "";
    } else if (schemaData) {
      schemaScript = document.createElement('script');
      schemaScript.id = 'seo-schema';
      schemaScript.type = 'application/ld+json';
      schemaScript.textContent = JSON.stringify(schemaData);
      document.head.appendChild(schemaScript);
    }
  }, [isAdminViewActive, isBlogPageActive, blogPostSlug, pathProductSlug, activeCategoryPage, blogPosts, products]);

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
    setFormCategory(p.category || "ClickBank Curated");
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
    setFormCategory("ClickBank Curated");
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
          included_features: parsedIncludedFeatures,
          category: formCategory.trim() || "ClickBank Curated"
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
          category: formCategory.trim() || "ClickBank Curated",
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
      setFormCategory("ClickBank Curated");
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

  // Blog success and error notifications
  const [blogSuccessMessage, setBlogSuccessMessage] = useState("");
  const [blogErrorMessage, setBlogErrorMessage] = useState("");
  const [blogConfirmDeleteId, setBlogConfirmDeleteId] = useState<string | null>(null);

  // Blog Post Save and Update Handler
  const handleSaveBlogPost = async (e: FormEvent) => {
    e.preventDefault();
    setBlogSuccessMessage("");
    setBlogErrorMessage("");

    if (!blogFormTitle.trim() || !blogFormContent.trim()) {
      setBlogErrorMessage("Title and content are required.");
      return;
    }

    setIsBlogSaving(true);
    let targetSlug = blogFormSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (!targetSlug) {
      targetSlug = blogFormTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }

    // Auto calculate reading time: roughly 200 words per minute
    const wordCount = blogFormContent.trim().split(/\s+/).length;
    const computedReadingTime = Math.max(1, Math.ceil(wordCount / 200));

    const postPayload = {
      title: blogFormTitle.trim(),
      slug: targetSlug,
      content: blogFormContent,
      category: blogFormCategory,
      status: blogFormStatus,
      visibility: blogFormVisibility,
      seoKeywords: blogFormSeoKeywords.trim(),
      readingTime: computedReadingTime,
      ctaText: blogIncludeProduct ? (blogFormCtaText.trim() || "Check Discount Price") : "",
      ctaLink: blogIncludeProduct ? blogFormCtaLink.trim() : "",
      imageUrl: blogFormImageUrl.trim() || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600",
      authorName: blogFormAuthorName.trim() || "BuyerSpotted Expert",
      viewCount: editingPost ? editingPost.viewCount : 0,
      featuredProductId: blogIncludeProduct ? blogFormFeaturedProduct : "",
      updatedAt: serverTimestamp()
    };

    try {
      if (editingPost) {
        await updateDoc(doc(db, "blogPosts", editingPost.id), postPayload);
        setBlogSuccessMessage("Affiliate review article successfully updated!");
        setEditingPost(null);
      } else {
        await addDoc(collection(db, "blogPosts"), {
          ...postPayload,
          createdAt: serverTimestamp()
        });
        setBlogSuccessMessage("New epic review article added to pipeline!");
      }
      
      setIsBlogFormOpen(false);
      resetBlogForm();
    } catch (err: any) {
      console.error("Save blog post exception:", err);
      try {
        handleFirestoreError(err, editingPost ? OperationType.UPDATE : OperationType.CREATE, "blogPosts");
      } catch (mappedErr: any) {
        setBlogErrorMessage(`Security Lock: ${mappedErr.message}`);
      }
    } finally {
      setIsBlogSaving(false);
    }
  };

  const resetBlogForm = () => {
    setBlogFormTitle("");
    setBlogFormSlug("");
    setBlogFormContent("");
    setBlogFormCategory("Health & Wellness");
    setBlogFormStatus("published");
    setBlogFormVisibility("public");
    setBlogFormSeoKeywords("");
    setBlogFormCtaText("Check Discount Price");
    setBlogFormCtaLink("");
    setBlogFormImageUrl("");
    setBlogFormAuthorName("BuyerSpotted");
    setBlogFormFeaturedProduct("");
    setBlogIncludeProduct(false);
    setEditorViewMode("edit");
  };

  const handleEditBlogPost = (post: BlogPost) => {
    setEditingPost(post);
    setBlogFormTitle(post.title);
    setBlogFormSlug(post.slug);
    setBlogFormContent(post.content);
    setBlogFormCategory(post.category);
    setBlogFormStatus(post.status);
    setBlogFormVisibility(post.visibility);
    setBlogFormSeoKeywords(post.seoKeywords || "");
    setBlogFormCtaText(post.ctaText || "Check Discount Price");
    setBlogFormCtaLink(post.ctaLink || "");
    setBlogFormImageUrl(post.imageUrl || "");
    setBlogFormAuthorName(post.authorName || "BuyerSpotted");
    setBlogFormFeaturedProduct(post.featuredProductId || "");
    setBlogIncludeProduct(!!post.featuredProductId);
    setEditorViewMode("edit");
    setIsBlogFormOpen(true);
    setBlogSuccessMessage("");
    setBlogErrorMessage("");
  };

  const handleCreateBlogCategory = async (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    
    // Check duplicate
    if (blogCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setBlogCatError("Category already exists.");
      return;
    }
    
    try {
      setBlogCatError("");
      const docId = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await setDoc(doc(db, "blogCategories", docId), {
        name: trimmed,
        createdAt: serverTimestamp()
      });
      setBlogFormCategory(trimmed);
      setNewBlogCategory("");
      setIsAddingNewBlogCategory(false);
    } catch (err: any) {
      console.error("Create blog category error:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, `blogCategories/${trimmed}`);
      } catch (mappedErr: any) {
        setBlogCatError(`Security Lock: ${mappedErr.message}`);
      }
    }
  };

  const handleDeleteBlogPost = async (postId: string) => {
    setBlogSuccessMessage("");
    setBlogErrorMessage("");
    try {
      await deleteDoc(doc(db, "blogPosts", postId));
      setBlogSuccessMessage("Affiliate article successfully purged from database.");
      setBlogConfirmDeleteId(null);
    } catch (err: any) {
      console.error("Delete blog post exception:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `blogPosts/${postId}`);
      } catch (mappedErr: any) {
        setBlogErrorMessage(`Purge Lock: ${mappedErr.message}`);
      }
    }
  };

  const handleIncrementBlogPostViewCount = async (post: BlogPost) => {
    try {
      await updateDoc(doc(db, "blogPosts", post.id), {
        viewCount: (post.viewCount || 0) + 1
      });
    } catch (err: any) {
      console.warn("Could not increment view metrics on direct access:", err);
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
  const filteredProducts = (() => {
    let list = filteredCategory === "All" 
      ? products 
      : products.filter((p) => p.category === filteredCategory);

    if (selectedGoal) {
      const g = selectedGoal.toLowerCase();
      let keywords: string[] = [];
      if (g === "brain" || g === "cognitive" || g === "cognitive longevity") {
        keywords = ["brain", "cognitive", "nootropic", "focus", "memory", "mind", "neuro", "cosmic", "natal", "seeker", "manifest", "wealth", "secret", "cell", "vitality", "longevity", "anti-aging", "life"];
      } else if (g === "sleep") {
        keywords = ["sleep", "rest", "pillow", "foam", "derila", "bed"];
      } else if (g === "energy" || g === "metabolic" || g === "metabolic efficiency") {
        keywords = ["energy", "weight", "fit", "healthy", "flora", "digest", "metabolic", "metabol", "stamina", "alpilean", "vision", "burn", "java", "fat", "sugar", "diet", "puravive"];
      } else if (g === "longevity") {
        keywords = ["longevity", "cell", "vitality", "anti-aging", "vision", "health", "life"];
      } else if (g === "neurological" || g === "neurological tuning") {
        keywords = ["acoustic", "neural", "frequency", "sound", "wave", "audio", "hearing", "ear", "binaural", "tuning", "music", "woodworking", "astrology", "billionaire", "reading"];
      }

      list = list.filter(p => {
        const text = `${p.title} ${p.description} ${p.category} ${p.seoKeywords ? p.seoKeywords.join(" ") : ""} ${p.whoItIsFor || ""}`.toLowerCase();
        return keywords.some(k => text.includes(k));
      });
    }
    return list;
  })();

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

  if (isBlogPageActive) {
    const isUserAdmin = userProfile?.role === UserRole.ADMIN || currentUser?.email === ADMIN_EMAIL;
    
    // Filter out posts based on draft/visibility
    const visibleBlogPosts = blogPosts.filter(p => {
      if (p.status === "draft" && !isUserAdmin) return false;
      if (p.visibility === "admins" && !isUserAdmin) return false;
      if (p.visibility === "members" && !currentUser) return false;
      return true;
    });

    // Dynamic Categories selector for the blog index
    const blogCategoriesSet = new Set<string>();
    visibleBlogPosts.forEach(p => {
      if (p.category) blogCategoriesSet.add(p.category);
    });
    const uniqueBlogCategories = ["All", ...Array.from(blogCategoriesSet)];

    // Target post selection
    const matchedPost = blogPostSlug ? blogPosts.find(p => p.slug === blogPostSlug) : null;

    return (
      <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black flex flex-col justify-between relative overflow-x-hidden">
        {/* Aesthetic pairing backgrounds */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25" />
          <div className="absolute top-0 right-[20%] w-[500px] h-[500px] bg-[#c3a05c]/5 blur-[120px] rounded-full animate-pulse duration-[8000ms]" />
          <div className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] bg-[#c3a05c]/3 blur-[140px] rounded-full" />
        </div>

        {/* Global Nav Header */}
        <header className="sticky top-0 z-30 bg-[#050505]/95 backdrop-blur-md border-b border-neutral-900 px-6 py-4 md:px-12">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6 md:gap-8">
              <div className="flex flex-col cursor-pointer" onClick={navigateToHome}>
                <h1 className="font-display font-bold text-lg md:text-xl tracking-[0.25em] text-neutral-100 uppercase">
                  BuyerSpotted<span className="text-neo-gold">.</span>
                </h1>
                <span className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase mt-0.5">
                  Curated Luxury Tech Vault
                </span>
              </div>
              
              <nav className="flex items-center gap-4 border-l border-neutral-900 pl-6 md:pl-8">
                <button 
                  onClick={navigateToHome}
                  className="font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors bg-transparent border-none outline-none cursor-pointer text-neutral-400 hover:text-white"
                >
                  Catalog
                </button>
                <button 
                  onClick={navigateToBlog}
                  className="font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors bg-transparent border-none outline-none cursor-pointer text-neo-gold font-semibold"
                >
                  Blog
                </button>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {userProfile ? (
                <div className="flex items-center gap-2 bg-[#090909] border border-neutral-900 rounded-md p-1.5 pl-3">
                  <div className="flex flex-col text-right hidden lg:flex">
                    <span className="font-mono text-[9px] text-neutral-400 font-semibold truncate max-w-[125px]">
                      {userProfile.email}
                    </span>
                    <span className="font-mono text-[8px] text-[#c3a566] tracking-widest mt-0.5 uppercase font-bold">
                      {userProfile.role === UserRole.ADMIN ? "ADMIN" : "GUEST"}
                    </span>
                  </div>
                  
                  {userProfile.role === UserRole.ADMIN && (
                    <button
                      onClick={() => {
                        setIsAdminViewActive(true);
                        navigateToHome();
                      }}
                      className="ml-1.5 py-1.5 px-3 rounded text-[9px] font-mono tracking-widest uppercase bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neo-gold hover:text-neo-gold cursor-pointer"
                    >
                      Workspace
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      await logOutUser();
                      setIsAdminViewActive(false);
                      navigateToHome();
                    }}
                    className="p-1 px-2 text-neutral-500 hover:text-rose-450 transition-all font-mono text-[9px] tracking-wider uppercase ml-1 cursor-pointer"
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
                      console.error("Login exception:", e);
                    } finally {
                      setIsLoggingIn(false);
                    }
                  }}
                  className="px-4 py-2 border border-neutral-800 bg-neutral-950 text-neutral-300 hover:text-white hover:border-[#c3a05c] hover:shadow-[0_0_12px_rgba(195,160,92,0.1)] font-mono text-[9px] uppercase tracking-widest transition-all rounded-xs cursor-pointer flex items-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-neo-gold" /> AUTHENTICATING...
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-neo-gold" /> VIP ACCESS LOGIN
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Outer container */}
        <main className="max-w-4xl mx-auto px-6 py-12 md:py-16 relative z-10 flex-1 w-full">
          {matchedPost ? (
            
            // -------------------------------------------------------------
            // SINGLE DYNAMIC ARTICLE READ VIEW
            // -------------------------------------------------------------
            (() => {
              const accessRestricted = matchedPost.visibility === "admins" && !isUserAdmin;
              const memberRestricted = matchedPost.visibility === "members" && !currentUser;

              if (accessRestricted) {
                return (
                  <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-10 text-center space-y-4 max-w-lg mx-auto my-16">
                    <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
                    <h3 className="font-display font-semibold text-neutral-200 uppercase tracking-widest">ACCESS DENIED</h3>
                    <p className="font-mono text-[9px] text-neutral-500 leading-relaxed uppercase">
                      THIS SUMMARY PIECE REQUIRES ELEVATED OPERATIONAL PROTOCOLS ACCESS OR REGISTERED CREDENTIALS.
                    </p>
                    <button 
                      onClick={navigateToBlog}
                      className="px-6 py-2.5 border border-neutral-808 text-neutral-400 hover:text-white hover:border-neutral-700 bg-neutral-900 font-mono text-[9px] uppercase tracking-widest block mx-auto rounded cursor-pointer"
                    >
                      Return to Feed
                    </button>
                  </div>
                );
              }

              if (memberRestricted) {
                return (
                  <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-10 text-center space-y-6 max-w-md mx-auto my-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-neo-gold/5 blur-3xl rounded-full"></div>
                    <Lock className="w-10 h-10 text-neo-gold mx-auto animate-bounce" />
                    <div className="space-y-1.5">
                      <h3 className="font-display font-semibold text-neutral-100 uppercase tracking-widest text-[#c3a05c]">RESERVED MEMBERS ARCHIVE</h3>
                      <p className="font-mono text-[9px] text-neutral-450 uppercase leading-relaxed max-w-sm mx-auto">
                        This curated review article is restricted to premium members of the BuyerSpotted catalog community. Signing in with Google issues instant VIP credentials for secure access.
                      </p>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          setIsLoggingIn(true);
                          await signInWithGoogle();
                        } catch (e) {
                          console.error("Login action failure:", e);
                        } finally {
                          setIsLoggingIn(false);
                        }
                      }}
                      className="w-full py-3 bg-[#c3a05c] hover:bg-yellow-650 text-black font-semibold font-mono text-[9px] tracking-widest uppercase rounded-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" /> INSTANT SIGN IN WITH GOOGLE
                    </button>
                    <button 
                      onClick={navigateToBlog}
                      className="text-neutral-500 hover:text-neutral-300 font-mono text-[8px] uppercase tracking-widest mt-2 block mx-auto text-center"
                    >
                      Return to Feed
                    </button>
                  </div>
                );
              }

              return (
                <article className="space-y-8 animate-in fade-in duration-500">
                  
                  {/* Article Banner & Dynamic Labels */}
                  <div className="space-y-4">
                    <button 
                      onClick={navigateToBlog}
                      className="font-mono text-[9px] uppercase text-neutral-450 hover:text-neo-gold tracking-widest flex items-center gap-1 bg-transparent border-none outline-none cursor-pointer"
                    >
                      ← Return to Curation Feed
                    </button>

                    {matchedPost.imageUrl && (
                      <img 
                        src={matchedPost.imageUrl} 
                        alt="Banner" 
                        className="w-full h-64 md:h-[350px] object-cover rounded-lg border border-neutral-900 shadow-2xl bg-black"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    <div className="space-y-2 border-b border-neutral-900 pb-5">
                      <span className="font-mono text-[9px] text-neo-gold uppercase tracking-widest font-bold">
                        {matchedPost.category}
                      </span>
                      <h1 className="font-display font-bold text-2xl md:text-3xl text-neutral-100 uppercase tracking-normal leading-tight">
                        {matchedPost.title}
                      </h1>
                      
                      {/* Meta information tags */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[8px] text-neutral-550 uppercase tracking-wider mt-2.5">
                        <span>BY {matchedPost.authorName}</span>
                        <span>•</span>
                        <span>{matchedPost.readingTime || 5} MIN READ</span>
                        <span>•</span>
                        <span className="text-neo-gold font-bold">{matchedPost.viewCount || 0} RESEARCH VIEWS</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content with Parser */}
                  <div className="space-y-4 font-light text-neutral-300 leading-relaxed text-sm md:text-base border-b border-neutral-900 pb-10">
                    <article className="prose prose-invert max-w-none text-neutral-300">
                      {(() => {
                        const lines = matchedPost.content.split("\n");
                        return lines.map((line, bIdx) => {
                          return renderArticleLine(
                            line, 
                            bIdx, 
                            products, 
                            matchedPost.featuredProductId, 
                            matchedPost.ctaText, 
                            matchedPost.ctaLink
                          );
                        });
                      })()}
                    </article>
                  </div>

                  {/* Core Outbound CTA Box (Secondary layout coverage) */}
                  {matchedPost.ctaLink && (
                    <div className="p-6 bg-neutral-950 border border-neutral-900 rounded-lg text-center space-y-4">
                      <span className="font-mono text-[8px] text-neo-gold tracking-widest uppercase font-bold block">PLATFORM ACCESS CONTRACT PROTOCOL</span>
                      <h3 className="font-display font-semibold text-neutral-100 uppercase tracking-wide text-sm">UNLOCK PRIORITY ENERGETIC TREATMENT ACCESS</h3>
                      <p className="font-mono text-[9px] text-neutral-450 uppercase max-w-md mx-auto leading-relaxed">
                        Access discounted direct manufacturer shipments through our authenticated VIP channels. Perfect baseline refund options.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          window.open(matchedPost.ctaLink, "_blank", "noopener,noreferrer");
                        }}
                        className="px-8 py-3.5 bg-[#c3a05c] hover:bg-yellow-600 text-black font-semibold font-mono text-[9px] tracking-widest uppercase rounded-sm block mx-auto transition-all cursor-pointer shadow-lg"
                      >
                        {matchedPost.ctaText || "Claim Exclusive Pricing Benefits"} →
                      </button>
                    </div>
                  )}

                  {/* Related Article Footnotes */}
                  <div className="space-y-4 pt-6">
                    <h4 className="font-mono text-[9px] text-[#c3a05c] uppercase tracking-widest font-bold">SUGGESTED RELATED INSIGHTS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visibleBlogPosts.filter(p => p.id !== matchedPost.id).slice(0, 2).map((rel) => (
                        <div 
                          key={rel.id} 
                          onClick={() => navigateToBlogPost(rel.slug)}
                          className="bg-neutral-950/40 border border-neutral-900 p-4 rounded hover:border-neo-gold/40 cursor-pointer transition-all space-y-2 group"
                        >
                          <span className="font-mono text-[7px] text-[#c3a566] tracking-widest uppercase font-semibold">{rel.category}</span>
                          <h5 className="font-display font-bold text-xs text-neutral-300 group-hover:text-white transition-colors uppercase truncate">{rel.title}</h5>
                          <span className="font-mono text-[8px] text-neutral-550 uppercase block">{rel.readingTime || 5} MIN READ</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </article>
              );
            })()
          ) : (
            
            // -------------------------------------------------------------
            // MULTI ARTICLE BLOG LIST FEED
            // -------------------------------------------------------------
            <div className="space-y-10 animate-in fade-in duration-500">
              
              {/* Header Titles */}
              <div className="text-center space-y-3 pb-8 border-b border-neutral-900">
                <span className="font-mono text-[9px] text-neo-gold uppercase tracking-widest block font-bold">SYSTEMATIC INTELLECT RESEARCH HUB</span>
                <h1 className="font-display font-medium text-2xl md:text-3xl tracking-tight text-neutral-100 uppercase">
                  BuyerSpotted Curation Desk
                </h1>
                <p className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                  Deciphering high-gravity biological systems, energetic acoustic architectures, and cognitive performance reviews.
                </p>
              </div>

              {/* Dynamic Categories selector bar */}
              {uniqueBlogCategories.length > 2 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 py-1">
                  {uniqueBlogCategories.map((catName) => (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setActiveBlogCategoryFilter(catName)}
                      className={`px-3 py-1.5 rounded-sm font-mono text-[8px] tracking-widest uppercase transition-all cursor-pointer ${
                        activeBlogCategoryFilter === catName 
                          ? "bg-neo-gold text-black font-semibold border-none" 
                          : "bg-neutral-950 text-neutral-400 border border-neutral-900 hover:text-white"
                      }`}
                    >
                      {catName}
                    </button>
                  ))}
                </div>
              )}

              {/* Filtering items lists */}
              {(() => {
                const finalFilteredPosts = activeBlogCategoryFilter === "All" 
                  ? visibleBlogPosts
                  : visibleBlogPosts.filter(p => p.category === activeBlogCategoryFilter);

                if (finalFilteredPosts.length === 0) {
                  return (
                    <div className="text-center py-24 border border-dashed border-neutral-900 rounded">
                      <Lock className="w-8 h-8 text-neutral-800 mx-auto mb-3 animate-pulse" />
                      <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider block">Awaiting Research Submissions</span>
                      <p className="font-mono text-[9px] text-neutral-600 uppercase max-w-sm mx-auto mt-1 leading-normal">
                        No articles reside in this specific telemetry pool index. Please return to standard selections.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    {finalFilteredPosts.map((post) => (
                      <article 
                        key={post.id}
                        onClick={() => navigateToBlogPost(post.slug)}
                        className="bg-neutral-950 border border-neutral-900 rounded-lg overflow-hidden flex flex-col justify-between hover:border-neo-gold/40 hover:shadow-[0_0_15px_rgba(195,160,92,0.06)] transition-all group cursor-pointer duration-300"
                      >
                        <div>
                          {post.imageUrl && (
                            <div className="relative overflow-hidden h-44 bg-black border-b border-neutral-900">
                              <img 
                                src={post.imageUrl} 
                                alt={post.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-xs bg-[#050505]/95 backdrop-blur-md border border-neutral-800 text-[6px] font-mono font-bold uppercase tracking-wider text-[#c3a05c]">
                                {post.category || "Curation"}
                              </span>
                            </div>
                          )}

                          <div className="p-5 space-y-3">
                            <div className="flex items-center gap-3 font-mono text-[7px] text-neutral-550 uppercase">
                              <span>BY {post.authorName}</span>
                              <span>•</span>
                              <span>{post.readingTime || 5} MIN READ</span>
                            </div>

                            <h3 className="font-display font-semibold text-sm text-neutral-100 group-hover:text-neo-gold uppercase tracking-wider transition-colors line-clamp-2">
                              {post.title}
                            </h3>

                            {/* Extract clean paragraph preview */}
                            <p className="font-light text-neutral-400 text-[11px] leading-relaxed line-clamp-3">
                              {post.content.replace(/\[Affiliate CTA Callout Block\]/g, "").replace(/[#*>_\-]/g, "").trim().slice(0, 160) || "Read the complete strategic summary on our Curation Desk."}...
                            </p>
                          </div>
                        </div>

                        <div className="p-5 pt-0 border-t border-neutral-900 mt-4 flex items-center justify-between">
                          <span className="font-mono text-[8px] text-[#c3a05c] uppercase font-bold tracking-widest group-hover:underline">
                            READ CURATED ARTICLE →
                          </span>
                          <span className="font-mono text-[7px] text-neutral-500 uppercase">
                            {post.viewCount || 0} RESEARCH VIEWS
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                );
              })()}

            </div>
          )}
        </main>

        <footer className="border-t border-neutral-900 bg-neutral-950 py-8 px-6 text-center text-xs text-neutral-500 font-mono tracking-widest uppercase mt-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px]">
              © 2026 BuyerSpotted. ALL RIGHTS RESERVED.
            </p>
            <button onClick={navigateToHome} className="text-[10px] text-neo-gold hover:underline bg-transparent border-none outline-none cursor-pointer">
              RETURN TO MAIN NETWORK CATALOG
            </button>
          </div>
        </footer>
      </div>
    );
  }

  if (activeCategoryPage) {
    const categoryProducts = products.filter(p => (p.category || "ClickBank Curated") === activeCategoryPage);
    const details = getCategoryDetails(activeCategoryPage);

    return (
      <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black flex flex-col justify-between relative overflow-x-hidden">
        {/* Web Designer Stylish Background Cue Overlay (Fixed positions, soft ambient lights + geometric mesh) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
          {/* Futuristic subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25" />
          {/* Dynamic organic warm gold-sky dual light glows */}
          <div className="absolute -top-[10%] left-[5%] w-[400px] h-[400px] bg-[#c3a05c]/[0.05] rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[8000ms]" />
          <div className="absolute top-[35%] -right-[15%] w-[500px] h-[500px] bg-sky-500/[0.03] rounded-full blur-[140px] mix-blend-screen" />
          <div className="absolute -bottom-[10%] left-[20%] w-[450px] h-[440px] bg-[#c3a05c]/[0.04] rounded-full blur-[130px] mix-blend-screen animate-pulse duration-[10000ms]" />
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#c3a05c]/20 to-transparent" />
        </div>

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

        {/* Hero banner for Category */}
        <section className="relative overflow-hidden border-b border-neutral-900 py-20 px-6 md:px-12 bg-neutral-950/40">
          <div className="absolute inset-x-0 top-0 h-96 opacity-10 pointer-events-none">
            <img src={details.image} className="w-full h-full object-cover blur-md" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
          </div>

          <div className="max-w-4xl mx-auto relative z-10 text-center">
            {/* Breadcrumbs */}
            <div className="flex justify-center items-center gap-2 mb-4">
              <button onClick={navigateToHome} className="font-mono text-[8px] tracking-widest text-neutral-500 uppercase hover:text-neo-gold transition-colors">BUYERSPOTTED</button>
              <span className="font-mono text-[8px] text-neutral-700">/</span>
              <span className="font-mono text-[8px] tracking-widest text-neutral-400 uppercase">CATEGORIES</span>
              <span className="font-mono text-[8px] text-neutral-700">/</span>
              <span className="font-mono text-[8px] tracking-widest text-neo-gold uppercase">{details.title.toUpperCase()}</span>
            </div>

            <h2 className="font-display text-2xl md:text-4xl font-extrabold tracking-wider text-neutral-100 uppercase mb-4">
              {details.title}
            </h2>
            <p className="text-xs md:text-sm text-neutral-400 font-light leading-relaxed max-w-2xl mx-auto">
              {details.desc}
            </p>
          </div>
        </section>

        {/* Content list: clean, easy to read & not technical */}
        <main className="max-w-5xl mx-auto px-6 py-12 md:px-12 flex-1 w-full relative z-10">
          <div className="mb-8 border-b border-neutral-900 pb-4 flex justify-between items-center text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
            <span>Showing {categoryProducts.length} expert curations in this pipeline</span>
            <span>Direct Vendor Authorization</span>
          </div>

          {categoryProducts.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-neutral-900 rounded-lg">
              <Sliders className="w-8 h-8 text-neutral-700 mx-auto mb-4 animate-bounce" />
              <p className="font-mono text-[10px] tracking-widest text-neo-gold uppercase">No active elements in this pipeline</p>
              <button 
                onClick={navigateToHome} 
                className="mt-4 px-4 py-2 bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neo-gold hover:border-neo-gold font-mono text-[9px] tracking-wider uppercase rounded-sm transition-all cursor-pointer"
              >
                Return to home catalog
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {categoryProducts.map((p) => {
                const primaryImage = p.images[0]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600";
                const isLast3Added = products.slice(0, 3).some(latest => latest.id === p.id);

                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => navigateToProduct(p.title)}
                    className="group bg-neutral-950 border border-neutral-900 hover:border-neutral-800 p-6 rounded-lg cursor-pointer flex flex-col md:flex-row gap-6 transition-all"
                  >
                    {/* Compact Image */}
                    <div className="w-full md:w-32 h-32 shrink-0 rounded overflow-hidden bg-[#070707] border border-neutral-900 flex items-center justify-center p-2">
                      <img 
                        src={primaryImage} 
                        alt={p.title} 
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain brightness-95 group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>

                    {/* Non-technical clean details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        {/* Title & Badge */}
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <h3 className="font-display font-semibold text-sm tracking-wide text-neutral-100 group-hover:text-neo-gold transition-colors uppercase">
                            {p.title}
                          </h3>
                          {p.is_subscription && (
                            <span className="font-mono text-[8px] bg-[#c3a05c]/10 text-[#c3a05c] px-2 py-0.5 rounded-sm tracking-widest uppercase font-semibold">
                              Continuous Support Activated
                            </span>
                          )}
                        </div>

                        {/* Beautiful layperson summary */}
                        <p className="text-[11px] text-neutral-400 font-light leading-relaxed mb-4">
                          {p.seoHeadline || p.description || "Specifically compiled with wellness and systemic balance in mind for optimized daily performance."}
                        </p>

                        {/* Bullet point details in simple language */}
                        <div className="space-y-1.5 border-t border-neutral-900/60 pt-3">
                          <div className="flex items-start gap-1.5 text-[10px] text-neutral-400 font-light">
                            <span className="text-[#c3a05c]">•</span>
                            <span><strong>Target Focus:</strong> {p.whoItIsFor || "General daily usage and progressive bodily alignment."}</span>
                          </div>
                          {(p.whyItWorks || p.why_it_works) && (
                            <div className="flex items-start gap-1.5 text-[10px] text-neutral-400 font-light">
                              <span className="text-[#c3a05c]">•</span>
                              <span><strong>Clinical Reason:</strong> {p.whyItWorks || p.why_it_works}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-4 border-t border-neutral-900/60 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToProduct(p.title);
                          }}
                          className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 text-neutral-300 group-hover:border-neo-gold group-hover:bg-neo-gold group-hover:text-black transition-all font-mono text-[9px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>{isLast3Added ? "READ REVIEW" : "DEPLOY FULL LAB ANALYSIS →"}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-900 bg-neutral-950 py-8 px-6 text-center text-xs text-neutral-500 font-mono tracking-widest uppercase mt-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px]">
              © 2026 BuyerSpotted. ALL RIGHTS RESERVED.
            </p>
            <button onClick={navigateToHome} className="text-[10px] text-neo-gold hover:underline bg-transparent border-none outline-none cursor-pointer">
              RETURN TO MAIN NETWORK CATALOG
            </button>
          </div>
        </footer>
      </div>
    );
  }

  if (pathProductSlug) {
    const matchedProduct = products.find((p) => getProductSlug(p.title) === pathProductSlug);
    const isUserAdmin = userProfile?.role === UserRole.ADMIN || currentUser?.email === ADMIN_EMAIL;

    return (
      <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black flex flex-col justify-between relative overflow-x-hidden">
        {/* Web Designer Stylish Background Cue Overlay (Fixed positions, soft ambient lights + geometric mesh) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
          {/* Futuristic subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25" />
          {/* Dynamic organic warm gold-sky dual light glows */}
          <div className="absolute -top-[10%] left-[5%] w-[400px] h-[400px] bg-[#c3a05c]/[0.05] rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[8000ms]" />
          <div className="absolute top-[35%] -right-[15%] w-[500px] h-[500px] bg-sky-500/[0.03] rounded-full blur-[140px] mix-blend-screen" />
          <div className="absolute -bottom-[10%] left-[20%] w-[450px] h-[440px] bg-[#c3a05c]/[0.04] rounded-full blur-[130px] mix-blend-screen animate-pulse duration-[10000ms]" />
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#c3a05c]/20 to-transparent" />
        </div>

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
                    <span className="font-mono text-[10px] text-neutral-550 uppercase tracking-widest block">SECURE OFFER ANCHOR</span>
                    <h3 className="font-display font-medium text-lg text-neutral-100">Claim Direct Promotion</h3>
                  </div>

                  {/* Pricing Frame with Value-Based Price Anchoring */}
                  <div className="bg-[#090909] border border-neutral-900 rounded-lg p-4 space-y-3.5 font-mono">
                    <div className="flex items-center justify-between border-b border-neutral-900/60 pb-2.5">
                      <span className="text-[8px] text-neutral-550 uppercase tracking-widest block">Pricing Model</span>
                      <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-900/55 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-widest">Verified Pricing Stream</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between text-[10px]">
                        <span className="text-neutral-500 uppercase tracking-wider">Savings Tier:</span>
                        <span className="text-neo-gold font-bold uppercase text-right">Maximum Tier Discount Activated</span>
                      </div>
                      <div className="flex items-start justify-between text-[10px]">
                        <span className="text-neutral-500 uppercase tracking-wider">Manufacturer Rate:</span>
                        <span className="text-neutral-300 font-medium uppercase text-right">Package Savings Available</span>
                      </div>
                      <div className="flex items-start justify-between text-[10px]">
                        <span className="text-neutral-500 uppercase tracking-wider">Inventory Status:</span>
                        <span className="text-emerald-400 font-semibold uppercase text-right">Lowest Authorized Batch Active</span>
                      </div>
                    </div>

                    <div className="border-t border-neutral-900/60 pt-2.5 flex items-center justify-center gap-2 bg-neutral-900/20 py-1.5 rounded">
                      <ShieldCheck className="w-3.5 h-3.5 text-neo-gold shrink-0" />
                      <span className="text-[8px] text-neutral-400 uppercase tracking-widest font-bold">Direct Vendor Authorization: Active</span>
                    </div>
                  </div>

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
                              <span className="text-neo-gold font-bold uppercase text-[8px] tracking-wider">
                                View Deal
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ironclad Refund Guarantee Box */}
                  <div className="bg-[#090909] border border-neutral-900 border-dashed rounded-lg p-4 flex gap-3.5 items-start">
                    <ShieldCheck className="w-5 h-5 text-neo-gold shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-neo-gold font-bold block">Ironclad Guarantee</span>
                      <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-400 leading-relaxed">
                        Backed by the manufacturer's official <strong className="text-neo-gold font-bold">{matchedProduct.refund_window || "60-Day"} Money-Back Guarantee</strong>. Completely risk-free investment.
                      </p>
                    </div>
                  </div>

                  {/* Conversion Optimized CTA Button Area */}
                  <div className="space-y-3 pt-1">
                    <a
                      href={matchedProduct.clickbankUrl || matchedProduct.amazonUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4.5 px-4 bg-gradient-to-r from-neo-gold via-yellow-500 to-yellow-600 hover:brightness-110 active:scale-[0.99] text-black font-semibold rounded shadow-[0_4px_30px_rgba(195,160,92,0.25)] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-center group"
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[10px] md:text-[11px] font-black tracking-widest uppercase text-black">
                        <span>👉 Check Live Package Discounts & Official Availability Here</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-black" />
                      </div>
                    </a>
                    
                    <div className="text-center space-y-1">
                      <p className="font-mono text-[8px] tracking-wide text-neutral-400 uppercase leading-normal">
                        🛡️ 100% Risk-Free Guarantee Backed Directly by the Manufacturer.
                      </p>
                      <p className="font-mono text-[7.5px] tracking-wide text-neutral-550 uppercase leading-normal max-w-xs mx-auto">
                        Safely routes to the verified manufacturer secure server for real-time promotional rates and inventory status.
                      </p>
                    </div>
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
                      <span className="flex items-center gap-1">🔒 SECURE SSL SIGNALS</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">🛡️ ENCRYPTED SERVER CONNECTION</span>
                    </div>
                  </div>
                </div>

                {/* Conditional Admin Only View (For the user) */}
                {isUserAdmin && (
                  <div className="bg-[#0b0c0f] border border-blue-900/30 rounded-xl p-5 space-y-3.5 font-mono text-[10px]">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Sliders className="w-3.5 h-3.5 animate-pulse" />
                      <span className="font-bold uppercase tracking-wider text-[9px]">ADMIN OPERATIONAL METRICS</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-black/35 p-2.5 rounded border border-neutral-900">
                        <span className="text-neutral-500 text-[8px] block uppercase mb-0.5">ClickBank Vendor</span>
                        <span className="text-neutral-300 font-semibold">{matchedProduct.cbVendor || "N/A"}</span>
                      </div>
                      <div className="bg-black/35 p-2.5 rounded border border-neutral-900">
                        <span className="text-neutral-500 text-[8px] block uppercase mb-0.5">Affiliate ID</span>
                        <span className="text-neutral-300 font-semibold">{matchedProduct.cbAffiliate || "N/A"}</span>
                      </div>
                      <div className="bg-black/35 p-2.5 rounded border border-neutral-900">
                        <span className="text-neutral-500 text-[8px] block uppercase mb-0.5">Gravity Score</span>
                        <span className="text-neo-gold font-semibold">{matchedProduct.gravity ? matchedProduct.gravity.toFixed(1) : "N/A"}</span>
                      </div>
                      <div className="bg-black/35 p-2.5 rounded border border-neutral-900">
                        <span className="text-neutral-500 text-[8px] block uppercase mb-0.5">Average Conversion</span>
                        <span className="text-emerald-400 font-semibold">{matchedProduct.conversionLabel || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                )}

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
            <span>Ref: {pathProductSlug ? pathProductSlug.toUpperCase() : ""}</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black relative overflow-x-hidden">
      {/* Web Designer Stylish Background Cue Overlay (Fixed positions, soft ambient lights + geometric mesh) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
        {/* Futuristic subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25" />
        {/* Dynamic organic warm gold-sky dual light glows */}
        <div className="absolute -top-[10%] left-[5%] w-[400px] h-[400px] bg-[#c3a05c]/[0.05] rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[8000ms]" />
        <div className="absolute top-[35%] -right-[15%] w-[500px] h-[500px] bg-sky-500/[0.03] rounded-full blur-[140px] mix-blend-screen" />
        <div className="absolute -bottom-[10%] left-[20%] w-[450px] h-[440px] bg-[#c3a05c]/[0.04] rounded-full blur-[130px] mix-blend-screen animate-pulse duration-[10000ms]" />
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#c3a05c]/20 to-transparent" />
      </div>

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
          
          {/* Logo & Public Links Nav */}
          <div className="flex items-center gap-6 md:gap-8">
            <div className="flex flex-col cursor-pointer" onClick={navigateToHome}>
              <h1 className="font-display font-bold text-lg md:text-xl tracking-[0.25em] text-neutral-100 uppercase">
                BuyerSpotted<span className="text-neo-gold">.</span>
              </h1>
              <span className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase mt-0.5">
                Curated Luxury Tech Vault
              </span>
            </div>
            
            <nav className="flex items-center gap-4 border-l border-neutral-900 pl-6 md:pl-8">
              <button 
                onClick={navigateToHome}
                className={`font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors bg-transparent border-none outline-none cursor-pointer ${(!isBlogPageActive && !isAdminViewActive) ? "text-neo-gold font-semibold" : "text-neutral-400 hover:text-white"}`}
              >
                Catalog
              </button>
              <button 
                onClick={navigateToBlog}
                className={`font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors bg-transparent border-none outline-none cursor-pointer ${isBlogPageActive ? "text-neo-gold font-semibold" : "text-neutral-400 hover:text-white"}`}
                id="header-blog-link"
              >
                Blog
              </button>
            </nav>
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
            {isCurrentUserAdmin && (
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
            )}
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
                    <button
                      onClick={() => setAdminTab("blog")}
                      className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        adminTab === "blog"
                          ? "bg-neo-gold text-black font-semibold"
                          : "text-neutral-550 hover:text-neutral-300"
                      }`}
                      id="tab-blog-publishing"
                    >
                      <Edit className="w-3 h-3 text-current" /> Blog Publishing
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
            ) : adminTab === "blog" ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Notification overlays inside container */}
                {blogSuccessMessage && (
                  <div className="bg-emerald-950/40 border border-emerald-900 rounded p-4 text-emerald-400 font-mono text-[9px] uppercase tracking-widest flex items-center justify-between">
                    <span>{blogSuccessMessage}</span>
                    <button type="button" onClick={() => setBlogSuccessMessage("")} className="text-emerald-500 hover:text-white font-bold cursor-pointer">×</button>
                  </div>
                )}
                {blogErrorMessage && (
                  <div className="bg-rose-950/40 border border-rose-900 rounded p-4 text-rose-400 font-mono text-[9px] uppercase tracking-widest flex items-center justify-between">
                    <span>{blogErrorMessage}</span>
                    <button type="button" onClick={() => setBlogErrorMessage("")} className="text-rose-500 hover:text-white font-bold cursor-pointer">×</button>
                  </div>
                )}

                {/* Confirm Delete State Node overlay */}
                {blogConfirmDeleteId && (
                  <div className="bg-rose-950/80 border border-rose-800 rounded p-5 text-center space-y-3">
                    <h5 className="font-mono text-[10px] text-rose-300 uppercase tracking-widest font-bold">WARNING: IRREVERSIBLE PURGE CONTRACT</h5>
                    <p className="font-mono text-[9px] text-neutral-400 uppercase">Are you absolutely certain you want to purge this article from database?</p>
                    <div className="flex justify-center gap-3">
                      <button 
                        type="button"
                        onClick={() => handleDeleteBlogPost(blogConfirmDeleteId)}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-mono text-[9px] uppercase tracking-wider rounded-sm cursor-pointer"
                      >
                        CONFIRM PURGE
                      </button>
                      <button 
                        type="button"
                        onClick={() => setBlogConfirmDeleteId(null)}
                        className="px-4 py-1.5 bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800 font-mono text-[9px] uppercase tracking-wider rounded-sm cursor-pointer"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                   {isBlogFormOpen ? (
                  <form onSubmit={handleSaveBlogPost} className="space-y-6">
                    {/* Top title and exit row */}
                    <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold">
                          {editingPost ? "MODIFY AFFILIATE MASTERPIECE" : "DRAFT NEW AFFILIATE CORE ARTICLE"}
                        </h4>
                        <p className="font-mono text-[9px] text-neutral-500 uppercase mt-1">
                          Refine or publish high-converting curation articles linked to premium clickbank solutions.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsBlogFormOpen(false);
                            setEditingPost(null);
                            resetBlogForm();
                          }}
                          className="px-4 py-2 border border-neutral-850 text-neutral-400 hover:text-neutral-200 bg-neutral-900 font-mono text-[9px] uppercase tracking-wider rounded-sm cursor-pointer transition-colors"
                        >
                          CANCEL EDITOR
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* LEFT COLUMN (70% Focus Layout - Massive WYSIWYG Editor Workspace) */}
                      <div className="lg:col-span-8 space-y-4">
                        
                        {/* Editor Canvas Container */}
                        <div className="bg-neutral-950 border border-neutral-900 rounded-lg overflow-hidden shadow-2xl">
                          
                          {/* WYSIWYG Workspace Switcher Head */}
                          <div className="flex border-b border-neutral-900 bg-[#050505] p-3 items-center justify-between">
                            <div className="flex items-center gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => setEditorViewMode("edit")}
                                className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all rounded-sm cursor-pointer ${editorViewMode === "edit" ? "bg-neutral-900 border border-neutral-800 text-neo-gold font-bold" : "text-neutral-400 hover:text-white bg-transparent"}`}
                              >
                                ✍️ Edit Mode
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditorViewMode("preview")}
                                className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all rounded-sm cursor-pointer ${editorViewMode === "preview" ? "bg-neutral-900 border border-neutral-800 text-neo-gold font-bold" : "text-neutral-400 hover:text-white bg-transparent"}`}
                              >
                                👁️ WYSIWYG Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditorViewMode("split")}
                                className={`hidden md:inline-flex px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all rounded-sm cursor-pointer ${editorViewMode === "split" ? "bg-neutral-900 border border-neutral-800 text-neo-gold font-bold" : "text-neutral-400 hover:text-white bg-transparent"}`}
                              >
                                🌗 Split Screen
                              </button>
                            </div>
                            <div className="font-mono text-[8px] text-[#c3a05c] uppercase pr-2 tracking-widest hidden sm:block">
                              {editorViewMode === "split" ? "SPLIT WORKSPACE ACTIVE" : editorViewMode === "preview" ? "WYSIWYG SIMULATION ACTIVE" : "MARKUP COMPOSING"}
                            </div>
                          </div>

                          {/* POWERFUL WYSIWYG TOOLBAR FEATURES */}
                          {(editorViewMode === "edit" || editorViewMode === "split") && (
                            <div className="bg-[#090909] border-b border-neutral-900 p-3 flex flex-wrap gap-2 items-center">
                              {/* Headings dropdown or distinct buttons */}
                              <div className="flex items-center gap-1 border-r border-neutral-805 pr-2">
                                <button type="button" onClick={() => insertMarkdownTag("h1")} className="px-2 py-1 text-[8px] font-mono font-bold uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Heading 1 H1">H1</button>
                                <button type="button" onClick={() => insertMarkdownTag("h2")} className="px-2 py-1 text-[8px] font-mono font-bold uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Heading 2 H2">H2</button>
                                <button type="button" onClick={() => insertMarkdownTag("h3")} className="px-2 py-1 text-[8px] font-mono font-bold uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Heading 3 H3">H3</button>
                              </div>

                              {/* Stylings */}
                              <div className="flex items-center gap-1 border-r border-neutral-805 pr-2">
                                <button type="button" onClick={() => insertMarkdownTag("bold")} className="px-2.5 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-white rounded-xs font-bold cursor-pointer hover:border-neo-gold" title="Bold **">B</button>
                                <button type="button" onClick={() => insertMarkdownTag("italic")} className="px-2.5 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-white rounded-xs italic cursor-pointer hover:border-neo-gold" title="Italic *">I</button>
                                <button type="button" onClick={() => insertMarkdownTag("underline")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-white rounded-xs underline cursor-pointer hover:border-neo-gold" title="Underline <u>">U</button>
                                <button type="button" onClick={() => insertMarkdownTag("strikethrough")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-white rounded-xs line-through cursor-pointer hover:border-neo-gold" title="Strikethrough ~~">S</button>
                              </div>

                              {/* Structural Elements */}
                              <div className="flex items-center gap-1 border-r border-neutral-805 pr-2">
                                <button type="button" onClick={() => insertMarkdownTag("divider")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-805 text-neutral-305 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Horizontal Divider ---">HR</button>
                                <button type="button" onClick={() => insertMarkdownTag("blockquote")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-805 text-neutral-305 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Blockquote >">Quote</button>
                                <button type="button" onClick={() => insertMarkdownTag("bullet")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-805 text-neutral-305 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Bulleted List -">Bullet</button>
                                <button type="button" onClick={() => insertMarkdownTag("numbered")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-805 text-neutral-305 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Numbered List 1.">Num</button>
                              </div>

                              {/* Media & Links */}
                              <div className="flex items-center gap-1 border-r border-[#151515] pr-2">
                                <button type="button" onClick={() => insertMarkdownTag("link")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Insert Anchor Link">Link</button>
                                <button type="button" onClick={() => insertMarkdownTag("image")} className="px-2 py-1 text-[8px] font-mono uppercase bg-black hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded-xs cursor-pointer hover:border-neo-gold" title="Embed Image Target">Image</button>
                              </div>

                              {/* Emoji Picker Fast Hotbar */}
                              <div className="flex items-center gap-1 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-900">
                                <span className="font-mono text-[7px] text-neutral-500 uppercase tracking-widest mr-1">EMOJIS:</span>
                                {["🔥", "💎", "✨", "🔌", "✅", "🛡️", "🚀", "💡", "🚨", "⭐️"].map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => insertMarkdownTag(em)}
                                    className="hover:scale-130 transition-transform text-[11px] cursor-pointer"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>

                              {/* Embed Product Callout Quick button */}
                              {blogIncludeProduct && blogFormFeaturedProduct && (
                                <button 
                                  type="button" 
                                  onClick={() => insertMarkdownTag("affiliate-box")} 
                                  className="px-3 py-1.5 text-[8px] font-mono uppercase bg-neo-gold text-black rounded-xs font-bold hover:bg-yellow-500 cursor-pointer ml-auto transition-colors flex items-center gap-1"
                                >
                                  🔌 INJECT AFFILIATE CALLBOX
                                </button>
                              )}
                            </div>
                          )}

                          {/* Split Editor / Textareas */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 bg-[#020202]">
                            
                            {/* Editor Panel */}
                            {(editorViewMode === "edit" || editorViewMode === "split") && (
                              <div className={`flex flex-col ${editorViewMode === "split" ? "md:col-span-6 border-r border-neutral-905" : "md:col-span-12"}`}>
                                <textarea 
                                  id="blog-content-textarea"
                                  value={blogFormContent}
                                  onChange={(e) => setBlogFormContent(e.target.value)}
                                  rows={22}
                                  placeholder={`Welcome to BuyerSpotted Curation platform. Add your detailed affiliate review content here.\n\nYou can use the editor toolbar to add structured Markdown style formatting, or paste normal text paragraphs.\n\nType '[Affiliate CTA Callout Block]' on a fresh line to render high-conversion call-to-actions linking your selected program product directly at that spot!`}
                                  className="w-full bg-black/40 p-5 text-xs font-mono text-neutral-200 focus:outline-none focus:bg-black leading-relaxed resize-y min-h-[480px] border-none"
                                />
                              </div>
                            )}

                            {/* Simulated rendering panel */}
                            {(editorViewMode === "preview" || editorViewMode === "split") && (
                              <div className={`p-6 bg-neutral-950/25 flex flex-col overflow-y-auto max-h-[620px] ${editorViewMode === "split" ? "md:col-span-6" : "md:col-span-12"}`}>
                                <div className="border-b border-neutral-900 pb-4 mb-5 text-left">
                                  <span className="font-mono text-[7px] text-neo-gold uppercase tracking-widest font-bold block mb-1">LIVE DOCUMENT SIMULATION</span>
                                  <h2 className="font-display font-medium text-sm md:text-base text-neutral-150 uppercase tracking-tight leading-snug">{blogFormTitle || "Draft Article Title Placeholder"}</h2>
                                  <div className="flex gap-4 items-center font-mono text-[7px] text-neutral-550 uppercase mt-1">
                                    <span>BY {blogFormAuthorName || "BuyerSpotted Desk"}</span>
                                    <span>•</span>
                                    <span>{blogFormCategory || "Health & Wellness"}</span>
                                  </div>
                                </div>

                                <div className="space-y-4 text-left prose prose-invert max-w-none text-neutral-300">
                                  {blogFormImageUrl && (
                                    <div className="mb-4">
                                      <img src={blogFormImageUrl} alt="Banner Preview" className="w-full h-32 md:h-44 object-cover rounded border border-neutral-900" referrerPolicy="no-referrer" />
                                    </div>
                                  )}
                                  {(() => {
                                    if (!blogFormContent.trim()) {
                                      return (
                                        <div className="text-center py-16 text-neutral-500 font-mono text-[9px] uppercase tracking-wider">
                                          [ Compose words in the left panel to witness immediate live formatting ]
                                        </div>
                                      );
                                    }

                                    const lines = blogFormContent.split("\n");
                                    return lines.map((line, bIdx) => {
                                      return renderArticleLine(
                                        line, 
                                        bIdx, 
                                        products, 
                                        blogFormFeaturedProduct, 
                                        blogFormCtaText, 
                                        blogFormCtaLink
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}

                          </div>

                        </div>

                        {/* Words count help bar */}
                        <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-4 font-mono text-[9px] text-neutral-500 uppercase tracking-wide leading-relaxed flex items-center justify-between">
                          <span>💡 TIP: Type <strong className="text-neo-gold">[Affiliate CTA Callout Block]</strong> on any empty line to render the premium affiliate banner.</span>
                          <span>{blogFormContent.trim().split(/\s+/).filter(Boolean).length} WORDS FOUND</span>
                        </div>

                      </div>

                      {/* RIGHT COLUMN (30% Options Sidebar Component - Sticky) */}
                      <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-5">
                        
                        <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-5 space-y-4">
                          
                          <div className="border-b border-neutral-900 pb-3">
                            <span className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold">⚙️ SETTINGS CONSOLE</span>
                            <span className="block font-mono text-[8px] text-neutral-500 uppercase mt-0.5">META PARAMETERS &amp; AFFILIATE GATEWAY</span>
                          </div>

                          {/* Title */}
                          <div className="space-y-1">
                            <label className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block">Article Title *</label>
                            <input 
                              type="text"
                              required
                              value={blogFormTitle}
                              onChange={(e) => {
                                setBlogFormTitle(e.target.value);
                                setBlogFormSlug(slugify(e.target.value));
                              }}
                              placeholder="e.g. Brain Optimization Guide"
                              className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-2 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold"
                            />
                          </div>

                          {/* Slug (Pristine Hyphenated read/write) */}
                          <div className="space-y-1">
                            <label className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block">URL Slug (Automatic)</label>
                            <input 
                              type="text"
                              value={blogFormSlug}
                              onChange={(e) => setBlogFormSlug(slugify(e.target.value))}
                              placeholder="e.g. brain-optimization-guide"
                              className="w-full bg-[#090909]/65 border border-neutral-900 font-mono text-[#c3a05c] rounded-sm p-2 text-xs focus:outline-none focus:border-neo-gold"
                            />
                          </div>

                          {/* Category (Pristine Select & Create Dynamic UI) */}
                          <div className="space-y-2 border border-neutral-900 bg-neutral-950/40 p-3 rounded-sm">
                            <div className="flex items-center justify-between">
                              <label className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block">Blog Category *</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingNewBlogCategory(!isAddingNewBlogCategory);
                                  setBlogCatError("");
                                }}
                                className="font-mono text-[8px] text-neo-gold hover:text-yellow-500 uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all"
                              >
                                {isAddingNewBlogCategory ? "✕ Close Creator" : "✚ Create Category"}
                              </button>
                            </div>

                            {!isAddingNewBlogCategory ? (
                              <div className="relative">
                                <select
                                  required
                                  value={blogFormCategory}
                                  onChange={(e) => setBlogFormCategory(e.target.value)}
                                  className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold appearance-none cursor-pointer"
                                >
                                  {blogCategories.map((cat) => (
                                    <option key={cat} value={cat} className="bg-black text-neutral-200">
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-3 top-3 pointer-events-none text-neutral-500 text-[10px]">▼</div>
                              </div>
                            ) : (
                              <div className="space-y-2 pt-1 transition-all">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newBlogCategory}
                                    onChange={(e) => setNewBlogCategory(e.target.value)}
                                    placeholder="Enter new category name..."
                                    className="flex-1 bg-[#090909] border border-neutral-900 rounded-sm p-2 text-xs text-white focus:outline-none focus:border-neo-gold"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateBlogCategory(newBlogCategory);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleCreateBlogCategory(newBlogCategory)}
                                    className="px-3.5 bg-neo-gold text-black hover:bg-yellow-500 font-mono text-[9px] uppercase tracking-wider rounded-sm font-bold cursor-pointer transition-colors"
                                  >
                                    Add
                                  </button>
                                </div>
                                {blogCatError && (
                                  <p className="font-mono text-[8px] text-red-500 uppercase tracking-wider mt-1">{blogCatError}</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Author Name */}
                          <div className="space-y-1">
                            <label className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block">Author Name</label>
                            <input 
                              type="text"
                              value={blogFormAuthorName}
                              onChange={(e) => setBlogFormAuthorName(e.target.value)}
                              className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-2 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold"
                            />
                          </div>

                          {/* Banner Image URL */}
                          <div className="space-y-1">
                            <label className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block">Banner Image URL</label>
                            <input 
                              type="text"
                              value={blogFormImageUrl}
                              onChange={(e) => setBlogFormImageUrl(e.target.value)}
                              placeholder="https://images.unsplash.com/promo..."
                              className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-2 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold"
                            />
                          </div>

                          {/* SEO Keywords */}
                          <div className="space-y-1">
                            <label className="font-mono text-[9px] text-neutral-405 uppercase tracking-widest block">SEO Keywords (Comma Separated)</label>
                            <input 
                              type="text"
                              value={blogFormSeoKeywords}
                              onChange={(e) => setBlogFormSeoKeywords(e.target.value)}
                              placeholder="e.g. clickbank, supplementation, biohacking"
                              className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-2 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold"
                            />
                          </div>

                          {/* Audience Access Select Dropdown */}
                          <div className="space-y-1">
                            <label className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block font-bold">Audience Access Rights</label>
                            <select
                              value={blogFormVisibility}
                              onChange={(e) => setBlogFormVisibility(e.target.value as any)}
                              className="w-full bg-neutral-950 border border-neutral-900 rounded-sm p-2 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold cursor-pointer"
                            >
                              <option value="public">PUBLIC (All web researchers)</option>
                              <option value="members">MEMBERS (Only authenticated logins)</option>
                              <option value="admins">ADMINS (Only platform configurations team)</option>
                            </select>
                          </div>

                          {/* Publication Status */}
                          <div className="space-y-1 bg-[#050505] border border-neutral-900 p-3 rounded">
                            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest block mb-1">Publication Status</span>
                            <div className="flex flex-col gap-2 pt-1 font-sans">
                              <label className="flex items-center gap-2 font-mono text-[9px] text-neutral-300 uppercase cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="blogStatus" 
                                  checked={blogFormStatus === "published"} 
                                  onChange={() => setBlogFormStatus("published")} 
                                  className="accent-neo-gold h-3 w-3"
                                />
                                PUBLISHED (Live Curation Feed)
                              </label>
                              <label className="flex items-center gap-2 font-mono text-[9px] text-neutral-350 uppercase cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="blogStatus" 
                                  checked={blogFormStatus === "draft"} 
                                  onChange={() => setBlogFormStatus("draft")} 
                                  className="accent-[#c3a05c] h-3 w-3"
                                />
                                SAVE AS WORKSPACE DRAFT
                              </label>
                            </div>
                          </div>

                          {/* Toggle Switch Include Product */}
                          <div className="p-3 bg-[#090909] border border-neutral-900 rounded flex items-center justify-between">
                            <div className="space-y-0.5">
                              <span className="font-mono text-[9px] text-neo-gold uppercase tracking-widest font-bold block">🔌 LINK PRODUCT OFFER</span>
                              <span className="font-mono text-[7px] text-neutral-500 uppercase">Include ClickBank affiliate CTA</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={blogIncludeProduct}
                                onChange={(e) => {
                                  setBlogIncludeProduct(e.target.checked);
                                  if (!e.target.checked) {
                                    setBlogFormFeaturedProduct("");
                                  }
                                }}
                              />
                              <div className="w-8 h-4.5 bg-neutral-900 border border-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-600 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-neo-gold peer-checked:after:bg-black"></div>
                            </label>
                          </div>

                          {/* Affiliate linkage settings box inside Right column */}
                          {blogIncludeProduct && (
                            <div className="p-3.5 bg-neutral-950 border border-neutral-900 rounded space-y-2.5 animate-in slide-in-from-top-2 duration-200 text-left">
                              <div className="flex items-center justify-between border-b border-neutral-900 pb-1.5 font-sans">
                                <span className="font-mono text-[8px] text-neo-gold uppercase tracking-widest font-bold">💎 VAULT MONETIZER</span>
                              </div>
                              
                              <div className="space-y-1 font-sans">
                                <label className="font-mono text-[7px] text-neutral-550 uppercase tracking-widest block">CURATED GATEWAY PRODUCT</label>
                                <select
                                  value={blogFormFeaturedProduct}
                                  onChange={(e) => {
                                    setBlogFormFeaturedProduct(e.target.value);
                                    const matchingProd = products.find(p => p.id === e.target.value);
                                    if (matchingProd) {
                                      setBlogFormCtaLink(matchingProd.amazonUrl || matchingProd.clickbankUrl || "");
                                      setBlogFormCtaText(`Access ${matchingProd.title} VIP Offer`);
                                    }
                                  }}
                                  className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold cursor-pointer"
                                >
                                  <option value="">-- select high gravity clickbank item --</option>
                                  {products.map((p) => {
                                    return (
                                      <option key={p.id} value={p.id}>
                                        {p.title}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="font-mono text-[7px] text-neutral-550 uppercase tracking-widest block font-sans">VIP BUTTON CTA TEXT</label>
                                <input 
                                  type="text"
                                  value={blogFormCtaText}
                                  onChange={(e) => setBlogFormCtaText(e.target.value)}
                                  placeholder="Check Discount Offer"
                                  className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neo-gold"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-mono text-[7px] text-neutral-550 uppercase tracking-widest block font-sans">REDIRECT ROUTE HOPLINK</label>
                                <input 
                                  type="text"
                                  value={blogFormCtaLink}
                                  onChange={(e) => setBlogFormCtaLink(e.target.value)}
                                  placeholder="https://hop.clickbank.net/..."
                                  className="w-full bg-[#090909] border border-neutral-900 rounded-sm p-1.5 text-xs text-neutral-300 focus:outline-none focus:border-neo-gold"
                                />
                              </div>
                            </div>
                          )}

                          {/* Submit Actions Block inside Sidebar */}
                          <div className="pt-2 border-t border-neutral-900 space-y-2">
                            <button
                              type="submit"
                              disabled={isBlogSaving}
                              className="w-full py-3 bg-[#c3a05c] hover:bg-yellow-600 disabled:bg-neutral-900 disabled:text-neutral-600 text-black font-semibold font-mono text-[9px] tracking-widest uppercase rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-neo-gold/5"
                            >
                              {isBlogSaving ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> RECORDING TRANSACTION...
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" /> DEPLOY TO DATABASE
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsBlogFormOpen(false);
                                setEditingPost(null);
                                resetBlogForm();
                              }}
                              className="w-full py-2 border border-neutral-900 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 font-mono text-[9px] uppercase tracking-wider rounded-sm cursor-pointer transition-all"
                            >
                              CANCEL WORKSPACE
                            </button>
                          </div>

                        </div>

                      </div>

                    </div>
                  </form>
                ) : (
                  
                  // Blog List Workspace Panel (Table View)
                  <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-4">
                      <div>
                        <h4 className="font-mono text-xs text-neo-gold uppercase tracking-widest font-bold">
                          ACTIVE AFFILIATE REVIEWS DATABASE
                        </h4>
                        <p className="font-mono text-[9px] text-neutral-500 uppercase mt-1">
                          Manage and polish articles directly tied to high performance click bank pipelines.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          resetBlogForm();
                          setEditingPost(null);
                          setIsBlogFormOpen(true);
                        }}
                        className="px-4 py-2.5 bg-neo-gold hover:bg-yellow-600 text-black font-semibold font-mono text-[9px] tracking-widest uppercase rounded-sm flex items-center gap-1.5 transition-all cursor-pointer"
                        id="btn-admin-new-blog"
                      >
                        <Edit className="w-3.5 h-3.5" /> WRITE COVETED SUMMARY PIECE
                      </button>
                    </div>

                    {blogPosts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 border border-dashed border-neutral-900 rounded">
                        <Edit className="w-10 h-10 text-neutral-800 mb-3 animate-pulse" />
                        <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider">No Curation articles online</span>
                        <p className="font-mono text-[9px] text-neutral-600 uppercase max-w-sm text-center mt-1">
                          You haven't published any reviews yet. Write high-conversions summaries showing off targeted biological solutions.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-mono text-[10px]">
                          <thead>
                            <tr className="border-b border-neutral-900 bg-[#090909] uppercase text-[8px] text-neutral-500 font-bold">
                              <th className="p-3">Status / Access</th>
                              <th className="p-3">Title & Summary</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Author</th>
                              <th className="p-3 text-right">Raw Clicks/Views</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-900/60">
                            {blogPosts.map((post) => (
                              <tr key={post.id} className="hover:bg-[#090909] transition-colors text-neutral-300">
                                <td className="p-3 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    {post.status === "published" ? (
                                      <span className="px-1.5 py-0.5 rounded-xs bg-emerald-950 border border-emerald-900 text-emerald-450 text-[7px] font-bold uppercase tracking-widest">
                                        LIVE
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded-xs bg-amber-950 border border-amber-900 text-amber-450 text-[7px] font-bold uppercase tracking-widest">
                                        DRAFT
                                      </span>
                                    )}
                                    {post.visibility === "members" ? (
                                      <span className="px-1.5 py-0.5 rounded-xs bg-indigo-950 border border-indigo-900 text-indigo-400 text-[7px] uppercase tracking-widest">
                                        MEMBERS
                                      </span>
                                    ) : post.visibility === "admins" ? (
                                      <span className="px-1.5 py-0.5 rounded-xs bg-rose-950 border border-rose-900 text-rose-450 text-[7px] uppercase tracking-widest">
                                        ADMINS
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded-xs bg-[#111] border border-neutral-900 text-neutral-505 text-[7px] uppercase tracking-widest">
                                        PUBLIC
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 max-w-xs font-semibold">
                                  <span className="truncate block text-neutral-200" title={post.title}>
                                    {post.title}
                                  </span>
                                  <span className="block text-[8px] text-neutral-500 lowercase mt-0.5 italic">
                                    /blog/{post.slug}
                                  </span>
                                </td>
                                <td className="p-3 text-neutral-400 uppercase tracking-widest text-[9px]">
                                  {post.category}
                                </td>
                                <td className="p-3 text-neutral-500">
                                  {post.authorName}
                                </td>
                                <td className="p-3 text-right text-neo-gold font-bold">
                                  {post.viewCount || 0}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditBlogPost(post)}
                                      className="py-1 px-2 border border-neutral-808 hover:border-[#c3a05c] hover:text-neo-gold bg-[#090909] text-neutral-400 rounded-sm font-semibold transition-all cursor-pointer"
                                      title="Edit review post"
                                    >
                                      EDIT
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setBlogConfirmDeleteId(post.id)}
                                      className="py-1 px-2 border border-neutral-808 hover:border-rose-950 hover:text-rose-450 bg-[#090909] text-neutral-500 rounded-sm transition-all cursor-pointer"
                                      title="Delete review post"
                                    >
                                      PURGE
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

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
                        <span className="text-[8px] text-neo-gold lowercase italic font-light">optional but recommended</span>
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
                        <span>Category *</span>
                        <span className="text-[8px] text-neo-gold lowercase italic">target classification</span>
                      </label>
                      <input 
                        type="text"
                        required
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="e.g., ClickBank Curated, Verified Bio-Formulations, Metabolic Mastery..."
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
            <section className="mb-12 md:mb-16 overflow-hidden relative border border-neutral-900 rounded-xl bg-gradient-to-br from-[#0a0a0a] via-neutral-950 to-[#0e0e0e] p-8 md:p-14 shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-neo-gold/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
              <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-neutral-900/40 rounded-full blur-3xl -z-10"></div>
              
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full font-mono text-[9px] tracking-widest text-[#c3a05c] uppercase mb-5">
                  <ShieldCheck className="w-3 h-3 text-neo-gold" /> Verified Curation Network
                </div>
                
                <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extralight tracking-tight text-neutral-100 leading-tight mb-5">
                  The Blueprint Archive: <br />
                  <span className="font-semibold bg-gradient-to-r from-[#c3a05c] via-yellow-500 to-amber-200 bg-clip-text text-transparent">Definitively Vetted Formulations for Peak Human Optimization.</span>
                </h2>
                
                <div className="bg-[#090909]/65 border border-neutral-900/85 rounded-lg p-5 flex items-start gap-4 my-6 max-w-2xl">
                  <ShieldCheck className="w-5 h-5 text-neo-gold shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-xs md:text-sm text-neutral-400 leading-relaxed font-light">
                    Navigating here from <strong>TikTok or YouTube</strong>? Every link on our platform routes exclusively through encrypted, direct-to-manufacturer secure gateways to protect you from lookalike domain scams.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <a 
                    href="#catalog-view" 
                    className="glow-btn flex items-center gap-2 px-6 py-3.5 bg-neo-gold hover:bg-yellow-650 text-black font-mono text-[11px] font-bold tracking-widest uppercase rounded shadow-lg transition-all"
                  >
                    Browse Recommendations <ArrowUpRight className="w-4 h-4" />
                  </a>
                  {isCurrentUserAdmin && (
                    <button 
                      onClick={() => setIsChatOpen(true)}
                      className="flex items-center gap-2 px-6 py-3.5 border border-neutral-800 hover:border-neo-gold text-neutral-300 hover:text-neo-gold font-mono text-[11px] font-bold tracking-widest uppercase rounded transition-all cursor-pointer"
                    >
                      Consult AI Guide <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Interactive Goal-Finder Matrix (High Conversion Booster) */}
            <section className="mb-14 bg-neutral-950 border border-neutral-900 rounded-xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neutral-900 via-[#c3a05c]/30 to-neutral-900" />
              <div className="mb-6">
                <span className="font-mono text-[9px] text-[#c3a05c] tracking-widest uppercase block mb-1">INTERACTIVE DISCOVERY INTEGRATION</span>
                <h3 className="font-display text-xl font-medium text-neutral-200">What are you optimizing today?</h3>
                <p className="text-xs text-neutral-500 font-light mt-1">Select a core milestone objective. Our curation engine will isolate the highest performing reviews for your path.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Option 1: Metabolic Efficiency */}
                <button
                  type="button"
                  onClick={() => {
                    const goal = selectedGoal === "metabolic" ? null : "metabolic";
                    setSelectedGoal(goal);
                    if (goal) {
                      setTimeout(() => {
                        document.getElementById("catalog-view")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }
                  }}
                  className={`p-5 rounded-lg border text-left transition-all relative overflow-hidden flex flex-col justify-between h-36 cursor-pointer ${
                    selectedGoal === "metabolic"
                      ? "border-neo-gold bg-[#c3a05c]/5 text-neo-gold ring-1 ring-neo-gold"
                      : "border-neutral-900 hover:border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <div>
                    <span className="text-lg mb-2 block font-normal">🔥</span>
                    <h4 className="font-display font-medium text-sm text-neutral-200 mb-1">Metabolic Efficiency</h4>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-light leading-snug">Caloric acceleration, resting metabolic rate support, and systematic cellular energy production.</p>
                </button>

                {/* Option 2: Cognitive Longevity */}
                <button
                  type="button"
                  onClick={() => {
                    const goal = selectedGoal === "cognitive" ? null : "cognitive";
                    setSelectedGoal(goal);
                    if (goal) {
                      setTimeout(() => {
                        document.getElementById("catalog-view")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }
                  }}
                  className={`p-5 rounded-lg border text-left transition-all relative overflow-hidden flex flex-col justify-between h-36 cursor-pointer ${
                    selectedGoal === "cognitive"
                      ? "border-neo-gold bg-[#c3a05c]/5 text-neo-gold ring-1 ring-neo-gold"
                      : "border-neutral-900 hover:border-neutral-800 bg-[#050505] text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <div>
                    <span className="text-lg mb-2 block font-normal">🧠</span>
                    <h4 className="font-display font-medium text-sm text-neutral-200 mb-1">Cognitive Longevity</h4>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-light leading-snug">Nootropic optimization, active memory recall, and deep-focus mental state preservation.</p>
                </button>

                {/* Option 3: Neurological Tuning */}
                <button
                  type="button"
                  onClick={() => {
                    const goal = selectedGoal === "neurological" ? null : "neurological";
                    setSelectedGoal(goal);
                    if (goal) {
                      setTimeout(() => {
                        document.getElementById("catalog-view")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }
                  }}
                  className={`p-5 rounded-lg border text-left transition-all relative overflow-hidden flex flex-col justify-between h-36 cursor-pointer ${
                    selectedGoal === "neurological"
                      ? "border-neo-gold bg-[#c3a05c]/5 text-neo-gold ring-1 ring-neo-gold"
                      : "border-neutral-900 hover:border-neutral-800 bg-[#050505]/50 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <div>
                    <span className="text-lg mb-2 block font-normal">🎧</span>
                    <h4 className="font-display font-medium text-sm text-neutral-200 mb-1">Neurological Tuning</h4>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-light leading-snug">Acoustic neural-frequency directives, mental abundance calibration, and cognitive brainwave alignment.</p>
                </button>
              </div>

              {selectedGoal && (
                <div className="mt-4 flex items-center justify-between border-t border-neutral-900 pt-4 animate-in fade-in slide-in-from-top-1">
                  <span className="font-mono text-[10px] text-neo-gold uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                    <Check className="w-3.5 h-3.5 shrink-0" /> Target focus set to: {selectedGoal === "cognitive" ? "Cognitive Longevity" : selectedGoal === "metabolic" ? "Metabolic Efficiency" : selectedGoal === "neurological" ? "Neurological Tuning" : selectedGoal}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedGoal(null)}
                    className="font-mono text-[9px] text-neutral-550 uppercase tracking-widest hover:text-neutral-200 underline underline-offset-4 cursor-pointer"
                  >
                    Reset Optimization Target (Show All)
                  </button>
                </div>
              )}
            </section>

            {/* Catalog Control Header */}
            <section id="catalog-view" className="mb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-900 pb-6">
                <div>
                  <h3 className="font-display font-semibold text-lg md:text-xl tracking-wider uppercase text-neutral-200">
                    The Curations Catalog
                  </h3>
                  <p className="font-mono text-xs text-neutral-500 mt-1">
                    Displaying {filteredProducts.length} elite recommended elements
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
                        ? "ALL BLUEPRINTS" 
                        : cat === "ClickBank Curated" 
                          ? "ELITE BIOLOGICAL FORMULATIONS" 
                          : cat.toUpperCase()}
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
                  <Sliders className="w-8 h-8 text-neutral-600 mx-auto mb-4 animate-pulse" />
                  <p className="font-mono text-[10px] tracking-widest text-[#c3a05c] uppercase">No curations matched</p>
                  <p className="font-mono text-[9px] text-neutral-550 mt-2 uppercase">Try resetting your optimization goal filter above to browse other dynamic pieces.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((p, idx) => {
                    const primaryImage = p.images[0]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600";
                    
                    return (
                      <motion.article
                        key={p.id}
                        layoutId={`product-card-${p.id}`}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35 }}
                        className="group flex flex-col justify-between bg-neutral-950 border border-neutral-900 rounded-lg p-5 hover:border-neutral-800 transition-all cursor-pointer relative"
                        onClick={() => navigateToProduct(p.title)}
                      >
                        <div>
                          {/* Image Frame */}
                          <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-neutral-900 mb-4 border border-neutral-900">
                            <img 
                               src={primaryImage} 
                               alt={p.title}
                               referrerPolicy="no-referrer"
                               className="w-full h-full object-contain brightness-95 hover:scale-105 transition-transform duration-500"
                            />
                          </div>

                          {/* Category Badge */}
                          <span className="font-mono text-[8px] uppercase tracking-wider text-neo-gold font-bold block mb-1">
                            {p.category === "ClickBank Curated" ? "VERIFIED BIO-FORMULATION" : p.category.toUpperCase()}
                          </span>

                          {/* Title */}
                          <h4 className="font-display font-medium text-base text-neutral-100 group-hover:text-neo-gold transition-colors truncate mb-2">
                            {p.title}
                          </h4>

                          {/* Scientific Reason "Why It Works" */}
                          {(() => {
                            const rawWhyItWorks = p.whyItWorks || p.why_it_works || "";
                            const hasWhyItWorks = rawWhyItWorks.trim().length > 0;
                            const textToUse = hasWhyItWorks 
                              ? rawWhyItWorks 
                              : getProductAestheticDescription(p);
                            
                            const maxChars = 140;
                            const isLong = textToUse.length > maxChars;
                            const isExpanded = expandedCards[p.id] || false;
                            
                            const displayText = isLong && !isExpanded 
                              ? textToUse.slice(0, maxChars - 10) + "..." 
                              : textToUse;

                            return (
                              <div className="mb-4 min-h-[4.5rem] flex flex-col justify-between">
                                <p className="text-[11px] text-neutral-400 font-light leading-relaxed">
                                  {displayText}
                                </p>
                                {isLong && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCards(prev => ({
                                        ...prev,
                                        [p.id]: !isExpanded
                                      }));
                                    }}
                                    className="self-start text-[#c3a05c] hover:text-[#e4be75] font-mono text-[9px] mt-1.5 uppercase tracking-wider font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <span>{isExpanded ? "Show Less [-]" : "Read More [+]"}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* DEPLOY FULL LAB ANALYSIS Button */}
                        <div className="pt-3 border-t border-neutral-900 w-full">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToProduct(p.title);
                            }}
                            className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 text-neutral-300 group-hover:border-neo-gold group-hover:text-black group-hover:bg-neo-gold transition-all font-mono text-[9px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>
                              {(() => {
                                const isLast3Added = products.slice(0, 3).some(latest => latest.id === p.id);
                                return isLast3Added ? "READ REVIEW" : "DEPLOY FULL LAB ANALYSIS →";
                              })()}
                            </span>
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Curated Target Architecture Pipelines / Category Cards */}
            <section className="mb-24 border-t border-neutral-900 pt-16">
              <div className="mb-10 text-center md:text-left">
                <h3 className="font-display font-semibold text-lg md:text-xl tracking-wider uppercase text-neutral-200">
                  Explore Categories
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(Array.from(new Set(products.map((p) => p.category || "ClickBank Curated").filter(Boolean))) as string[]).map((catName) => {
                  const details = getCategoryDetails(catName);
                  const count = products.filter((p) => (p.category || "ClickBank Curated") === catName).length;

                  return (
                    <motion.div
                      key={catName}
                      whileHover={{ y: -5 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => navigateToCategory(catName)}
                      className="group bg-neutral-950/80 border border-neutral-900 hover:border-neo-gold/30 rounded-lg overflow-hidden cursor-pointer flex flex-col justify-between h-80 relative transition-all"
                    >
                      {/* Styled Dynamic Tech Frame (No images, premium click-product design with responsive accent glow) */}
                      <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-neutral-950 via-neutral-900 to-[#0e0e0e] border-b border-neutral-900/60 flex items-center justify-center p-6 bg-size-custom">
                        {/* Radial Glow corresponding to the category accent */}
                        <div 
                          className="absolute inset-0 opacity-10 blur-2xl rounded-full scale-90 select-none pointer-events-none transition-opacity duration-300 group-hover:opacity-25"
                          style={{ 
                            background: `radial-gradient(circle, ${details.accent} 0%, transparent 70%)` 
                          }}
                        />
                        {/* Blueprint grid overlay */}
                        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:10px_10px]" />
                        
                        {/* Stylized tactile schematic design with custom icon and colors */}
                        <div className="relative z-10 flex flex-col items-center justify-center text-center">
                          <div 
                            className="w-12 h-12 rounded-full border flex items-center justify-center mb-2.5 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-[#141414]"
                            style={{ 
                              borderColor: `${details.accent}40`,
                              background: `linear-gradient(135deg, ${details.accent}12, ${details.accent}03)`,
                              color: details.accent
                            }}
                          >
                            {/* Visual iconic identifier */}
                            {(() => {
                              const titleLower = catName.toLowerCase();
                              if (titleLower.includes("sleep") || titleLower.includes("rest") || titleLower.includes("night")) {
                                return <Clock className="w-5 h-5" />;
                              } else if (titleLower.includes("neural") || titleLower.includes("brain") || titleLower.includes("astrology") || titleLower.includes("mind") || titleLower.includes("focus")) {
                                return <Cpu className="w-5 h-5 animate-pulse" />;
                              } else if (titleLower.includes("metabolic") || titleLower.includes("fat") || titleLower.includes("weight") || titleLower.includes("slim") || titleLower.includes("diet") || titleLower.includes("sugar")) {
                                return <Zap className="w-5 h-5" />;
                              } else if (titleLower.includes("craft") || titleLower.includes("diy") || titleLower.includes("woodworking") || titleLower.includes("plan")) {
                                return <Sliders className="w-5 h-5" />;
                              } else {
                                return <Layers className="w-5 h-5" />;
                              }
                            })()}
                          </div>
                          <span 
                            className="font-mono text-[9px] tracking-widest uppercase font-semibold transition-colors mt-0.5 text-center px-2"
                            style={{ color: details.accent }}
                          >
                            {catName}
                          </span>
                        </div>

                        {/* Top corner category count tag */}
                        <span 
                          className="absolute top-4 right-4 px-2.5 py-0.5 font-mono text-[8px] tracking-wider text-black rounded-sm font-semibold uppercase"
                          style={{ backgroundColor: details.accent }}
                        >
                          {count} {count === 1 ? "Element" : "Elements"}
                        </span>
                      </div>

                      {/* Info details */}
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-display font-semibold text-sm text-neutral-200 group-hover:text-neo-gold transition-colors block mb-2 uppercase tracking-wide">
                            {details.title || catName}
                          </h4>
                          <p className="text-[11px] text-neutral-400 font-light leading-relaxed line-clamp-3">
                            {details.desc}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-neutral-900/40 mt-3 text-[9px]">
                          <span className="font-mono uppercase tracking-widest text-[#c3a05c] group-hover:text-neo-gold font-semibold transition-colors">
                            View Products
                          </span>
                          <span className="text-neutral-500 group-hover:text-neo-gold transition-colors font-mono">
                            →
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* Why BuyerSpotted section (Humanized & Professional Trust Stack) */}
            <section className="mb-20 border-t border-neutral-900 pt-16 grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="flex gap-4">
                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg text-neo-gold h-fit animate-pulse">
                  <Cpu className="w-5 h-5 text-neo-gold" />
                </div>
                <div>
                  <h5 className="font-display font-semibold text-sm text-neutral-100 uppercase tracking-wider mb-2">Empathetic Neutrality</h5>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    We do not accept corporate sponsorships, backdoor bribes, or advertising placements. Every review is independent, analytical, and honest.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg text-neo-gold h-fit">
                  <Layers className="w-5 h-5 text-neo-gold" />
                </div>
                <div>
                  <h5 className="font-display font-semibold text-sm text-neutral-100 uppercase tracking-wider mb-2">Definitive Verifications</h5>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Our team evaluates material ingredients, consumer feedback structures, and real satisfaction ratios over weeks before filing a final grade.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg text-neo-gold h-fit">
                  <X className="w-5 h-5 rotate-45 text-neo-gold" />
                </div>
                <div>
                  <h5 className="font-display font-semibold text-sm text-neutral-100 uppercase tracking-wider mb-2">Direct Secure Gateways</h5>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed">
                    Avoid clone domains, fake sites, and online copycats. We provide encrypted links that connect you securely to the official product warehouses.
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
            {isCurrentUserAdmin && (
              <>
                <span>&bull;</span>
                <span className="hover:text-neutral-300 cursor-pointer text-neo-gold" onClick={() => setIsChatOpen(true)}>CONSULT SPOTTEDAI</span>
              </>
            )}
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
        {isCurrentUserAdmin && isChatOpen && (
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
                            navigateToProduct(selectedProduct.title);
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
