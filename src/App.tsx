import { useState, useEffect, useRef } from "react";
import { 
  ShoppingBag, 
  MessageCircle, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Sparkles, 
  Cpu, 
  Layers, 
  Eye, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Sliders, 
  ArrowUpRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ShopifyProduct, ShopifyVariant, CartItem, ChatMessage } from "./types";

export default function App() {
  // State elements
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [filteredCategory, setFilteredCategory] = useState<string>("All");
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Dialog & interface drawers toggles
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveConnection, setIsLiveConnection] = useState(false);

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

  // Load products on mount
  useEffect(() => {
    fetchCuratedCatalog();
    
    // Retrieve stored cart if it exists
    try {
      const savedCart = localStorage.getItem("buyerspotted_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.warn("Could not retrieve saved cart state:", e);
    }
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

  /**
   * Safe fetch routine requesting products through compliant server endpoints
   */
  const fetchCuratedCatalog = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-products" })
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setIsLiveConnection(!!data.live);
      } else {
        throw new Error("Multiplexed product endpoint returned error status");
      }
    } catch (err) {
      console.warn("Primary API routing failed. Swapping to secondary standard REST handler...", err);
      try {
        const restRes = await fetch("/api/products");
        if (restRes.ok) {
          const data = await restRes.json();
          setProducts(data.products || []);
          setIsLiveConnection(!!data.live);
        }
      } catch (backupError) {
        console.error("Both endpoints offline. Operating secure sandboxed catalog.", backupError);
      }
    } finally {
      setIsLoading(false);
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
   * Dynamically constructs the official Shopify single/multi-item permalink redirect
   * Cleans numeric keys from GraphQL gid string if mapped (e.g. gid://shopify/ProductVariant/46294328508655)
   */
  const initiateShopifyCheckout = () => {
    if (cart.length === 0) return;

    // Standard permalink construction: https://{shop}/cart/{variant_id}:{quantity},{variant_id}:{quantity}
    const shopBase = "https://nqwmay-2e.myshopify.com/cart";
    
    const itemsQuery = cart.map((item) => {
      // Clean variant ID to include numeric parameters only (Shopify requirement)
      const cleanVariantId = item.variant.id.replace(/[^\d]/g, "");
      return `${cleanVariantId}:${item.quantity}`;
    }).join(",");

    const checkoutUrl = `${shopBase}/${itemsQuery}`;
    try {
      window.open(checkoutUrl, "_blank");
    } catch (e) {
      window.location.href = checkoutUrl;
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
          history: chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
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

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100 font-sans antialiased selection:bg-neo-gold selection:text-black">
      
      {/* Sleek Geometric Frame Details */}
      <div className="fixed inset-0 pointer-events-none border border-neutral-900 z-50 m-4 opacity-70"></div>
      
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

          {/* Connection Status Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-neutral-950 border border-neutral-900 rounded-full font-mono text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnection ? 'bg-emerald-400 animate-pulse' : 'bg-neo-gold'}`}></span>
            <span className="text-neutral-400 uppercase tracking-wider">
              {isLiveConnection ? "Shopify Synchronized" : "Developer Sandbox Mode"}
            </span>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex items-center gap-3">
            
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

            {/* Shopping Cart trigger */}
            <button 
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="relative p-2.5 bg-neutral-950 border border-neutral-800 hover:border-neo-gold rounded-md transition-all group"
              title="Inspect Isolation Vault"
              id="vault-cart-btn"
            >
              <ShoppingBag className="w-4 h-4 text-neutral-400 group-hover:text-neo-gold transition-colors" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-neo-gold text-[#050505] font-mono font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 md:px-12 md:py-16">
        
        {/* Cinematic Announcement Banner */}
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
              BuyerSpotted curates physical elements engineered for total focus, sensory isolation, and mechanical synchronicity. Connect dynamically through encrypted Shopify relays for frictionless secure checkout.
            </p>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setIsChatOpen(true)}
                className="glow-btn flex items-center gap-2 px-5 py-3 bg-neo-gold hover:bg-yellow-600 text-[#050505] font-mono text-[11px] font-bold tracking-widest uppercase rounded-sm transition-all"
                id="banner-chat-cta"
              >
                Consult Curator <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <a 
                href="#catalog-view" 
                className="flex items-center gap-2 px-5 py-3 bg-transparent hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-mono text-[11px] font-bold tracking-widest uppercase rounded-sm transition-all"
              >
                Inspect Vault
              </a>
            </div>
          </div>
        </section>

        {/* Catalog Control Header */}
        <section id="catalog-view" className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-900 pb-6">
            <div>
              <h3 className="font-display font-semibold text-lg md:text-xl tracking-wider uppercase text-neutral-200">
                Curated Index
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
                  className={`px-4 py-2 font-mono text-[10px] tracking-wider uppercase border rounded-sm transition-all ${
                    filteredCategory === cat 
                      ? "border-neo-gold text-neo-gold bg-[#c3a05c]/5" 
                      : "border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800 bg-neutral-950"
                  }`}
                >
                  {cat === "All" ? "ALL SCHEMAS" : cat}
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
              <p className="font-mono text-xs tracking-wider text-neutral-400 uppercase">Synchronizing with Shopify Registry...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-neutral-900 rounded-lg">
              <Sliders className="w-8 h-8 text-neutral-600 mx-auto mb-4" />
              <p className="font-mono text-xs tracking-wider text-neutral-400 uppercase">No elements matched active filter matrix</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((p) => {
                const primaryImage = p.images[0]?.url || "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600";
                const secondaryImage = p.images[1]?.url || primaryImage;
                
                return (
                  <motion.article 
                    key={p.id}
                    layoutId={`product-card-${p.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35 }}
                    className="group flex flex-col justify-between bg-neutral-950 border border-neutral-900 rounded-lg p-5 hover:border-neutral-800 transition-all cursor-pointer relative"
                    onClick={() => openQuickView(p)}
                  >
                    <div>
                      {/* Image Frame with Double-Exposure Hover effect */}
                      <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-neutral-900 mb-5 border border-neutral-900">
                        <img 
                          src={primaryImage} 
                          alt={p.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover grayscale brightness-90 contrast-105 group-hover:opacity-0 transition-opacity duration-500"
                        />
                        <img 
                          src={secondaryImage} 
                          alt={p.title}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover grayscale brightness-95 contrast-105 opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-102"
                        />
                        
                        {/* Interactive floating indicator */}
                        <div className="absolute bottom-3 right-3 p-1.5 bg-[#050505]/80 backdrop-blur-md border border-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-sm">
                          <Eye className="w-3.5 h-3.5 text-neo-gold" />
                        </div>

                        {p.category && (
                          <div className="absolute top-3 left-3 px-2 py-0.5 bg-[#050505]/80 backdrop-blur-md rounded-sm border border-neutral-800">
                            <span className="font-mono text-[8px] tracking-widest text-[#c3a05c] uppercase">
                              {p.category}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title & Metadata */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h4 className="font-display font-medium text-base text-neutral-100 group-hover:text-neo-gold transition-colors truncate">
                          {p.title}
                        </h4>
                      </div>

                      {/* Brief description excerpt */}
                      <p className="text-xs text-neutral-400 font-light leading-relaxed mb-5 line-clamp-2">
                        {p.description}
                      </p>
                    </div>

                    <div>
                      {/* Technical specifications panel on hover */}
                      {p.specifications && (
                        <div className="hidden group-hover:block mb-4 pt-3 border-t border-neutral-900">
                          <div className="grid grid-cols-2 gap-y-1 gap-x-2 font-mono text-[9px]">
                            {Object.entries(p.specifications).slice(0, 2).map(([k, v]) => (
                              <div key={k} className="truncate">
                                <span className="text-neutral-500">{k}:</span> <span className="text-neutral-300">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bottom row: Price & Cart Addition controller */}
                      <div className="flex items-center justify-between pt-3 border-t border-neutral-900">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] text-neutral-500 tracking-wider uppercase">Unit Cost</span>
                          <span className="font-mono text-sm font-semibold text-neutral-200">
                            ${parseFloat(p.priceMin.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <button
                          id={`add-btn-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.variants[0]) {
                              handleAddToCart(p, p.variants[0], 1);
                            }
                          }}
                          className="px-3.5 py-2 bg-neutral-900 hover:bg-neo-gold hover:text-black border border-neutral-800 transition-colors font-mono text-[9px] tracking-widest uppercase rounded-sm"
                        >
                          Secure Shell
                        </button>
                      </div>
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
              <h5 className="font-display font-medium text-sm text-neutral-100 uppercase tracking-widest mb-2">Direct Shopify Handover</h5>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                Zero visual clutter or third-party gateways. Instant, secure Shopify permalink checkout routing is integrated natively.
              </p>
            </div>
          </div>
        </section>

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
                          className="w-16 h-16 object-cover bg-neutral-900 rounded-sm border border-neutral-900 grayscale"
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
                    onClick={initiateShopifyCheckout}
                    className="glow-btn w-full py-4 bg-neo-gold hover:bg-yellow-600 text-black font-mono text-[11px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-2 transition-all"
                  >
                    PROCEED TO SHOPIFY CHECKOUT <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <p className="font-mono text-[8px] text-center text-neutral-600 uppercase mt-3">
                    Transacting over secure, developmental Shopify endpoints.
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
                  <span className="uppercase">SpottedAI recommendations bypass secondary intermediaries for zero-flicker checkout.</span>
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
                        className="w-full h-full object-cover grayscale brightness-95"
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
                              activeImageIdx === idx ? "border-neo-gold grayscale-0" : "border-neutral-900 hover:border-neutral-700 grayscale"
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
                    <button
                      onClick={() => {
                        if (selectedProduct && modalVariant) {
                          handleAddToCart(selectedProduct, modalVariant, modalQuantity);
                          setSelectedProduct(null); // Close modal
                        }
                      }}
                      className="glow-btn w-full py-3.5 bg-neo-gold hover:bg-yellow-600 text-[#050505] font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-1.5 transition-all"
                    >
                      SECURE COMPILATION TO VAULT <ShoppingBag className="w-3.5 h-3.5" />
                    </button>
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
