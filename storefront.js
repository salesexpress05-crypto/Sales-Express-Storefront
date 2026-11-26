const $ = (id) => document.getElementById(id);
const firebaseDatabaseUrl = window.firebaseDatabaseUrl;
let storeId = new URLSearchParams(location.search).get("store") || "";
const safeId = /^[A-Za-z0-9_-]{1,128}$/;
const state = { settings: {}, categories: [], products: [], cart: new Map(), activeCategory: "all", busy: false, framePayload: null };
const ordersStorageKey = () => `sales-express-orders:${storeId}`;
function readOrderHistory() { try { const data = JSON.parse(localStorage.getItem(ordersStorageKey()) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; } }
function saveOrderHistory(items) { try { localStorage.setItem(ordersStorageKey(), JSON.stringify(items.slice(0, 30))); } catch {} }

function dbUrl(path) { return `${firebaseDatabaseUrl.replace(/\/$/, "")}/${path}.json`; }
async function read(path) {
  const response = await fetch(dbUrl(path), { headers: { "Accept": "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Firebase رفض قراءة بيانات المتجر (${response.status}).`);
  return response.json();
}
async function createOrder(payload) {
  const response = await fetch(dbUrl(`storefrontOrders/${storeId}`), {
    method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload), cache: "no-store"
  });
  if (!response.ok) throw new Error("تعذر إرسال الطلب. تحقق من اتصال الموقع وإعداد قواعد Firebase.");
  return response.json();
}
async function cancelOrder(order) {
  const response = await fetch(dbUrl(`storefrontOrders/${storeId}/${encodeURIComponent(order.id)}`), {
    method: "PATCH", headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ status: "Cancelled", updatedAtUtc: new Date().toISOString(), cancelToken: order.cancelToken }), cache: "no-store"
  });
  if (!response.ok) throw new Error("تعذر إلغاء الطلب. قد يكون المتجر بدأ تجهيزه بالفعل.");
  order.status = "Cancelled"; order.updatedAtUtc = new Date().toISOString();
  const history = readOrderHistory(); saveOrderHistory(history); renderOrderHistory();
}
function renderOrderHistory() {
  const host = $("order-history-list"); host.replaceChildren();
  const orders = readOrderHistory(); $("customer-orders").hidden = orders.length === 0;
  for (const order of orders) {
    const card = document.createElement("article"); card.className = "history-card";
    const details = document.createElement("div");
    const heading = document.createElement("strong"); heading.textContent = `طلب ${order.id.slice(-7)}`;
    const meta = document.createElement("p"); meta.textContent = `${new Date(order.createdAtUtc).toLocaleString("ar-EG")} · ${order.itemCount} صنف · ${money(order.total)}`;
    const status = document.createElement("span"); status.className = `history-status ${order.status === "Cancelled" ? "cancelled" : "pending"}`; status.textContent = order.status === "Cancelled" ? "تم الإلغاء" : "قيد المراجعة";
    details.append(heading, meta, status); card.append(details);
    if (order.status === "New") { const cancel = document.createElement("button"); cancel.className = "cancel-order"; cancel.type = "button"; cancel.textContent = "إلغاء الطلب"; cancel.addEventListener("click", async () => { cancel.disabled = true; try { await cancelOrder(order); } catch (error) { cancel.disabled = false; alert(error.message); } }); card.append(cancel); }
    host.append(card);
  }
}
function text(element, value) { element.textContent = value ?? ""; }
function money(value) { return `${Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`; }
function escapeText(value) { return String(value ?? ""); }
function productPrice(product) { return Number(product.discountPrice) > 0 ? Number(product.discountPrice) : Number(product.price || 0); }
function validImage(value) { return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value); }
function validVideo(value) { try { const url = new URL(value); return url.protocol === "https:" && /\.(mp4|webm|ogg)$/i.test(url.pathname); } catch { return false; } }

function setBrand() {
  const name = state.settings.storeName?.trim() || "متجر العملاء";
  const hasLogo = validImage(state.settings.logoBase64);
  document.body.classList.add("store-mode");
  $("app-footer").hidden = true;
  $("header-brand").href = "#products";
  $("header-brand").setAttribute("aria-label", `الانتقال إلى منتجات ${name}`);
  const headerLogo = $("header-logo"); headerLogo.hidden = !hasLogo;
  if (hasLogo) { headerLogo.src = state.settings.logoBase64; headerLogo.alt = `شعار ${name}`; }
  const headerName = $("header-brand-name"); headerName.className = "store-brand-name"; text(headerName, name);
  text($("header-brand-subtitle"), "التسوق الإلكتروني");
  text($("store-hero-kicker"), `أهلًا بك في ${name}`); document.title = `${name} | المتجر الإلكتروني`;
}

function renderCategories() {
  const nav = $("category-nav"); nav.replaceChildren();
  const quickNav = $("quick-category-nav"); quickNav.replaceChildren();
  const query = $("category-search-input").value.trim().toLocaleLowerCase("ar");
  const makeChip = (key, name, allProducts = false, quick = false) => { const chip = document.createElement("button"); chip.className = `${quick ? "quick-category-chip" : "category-chip"} ${state.activeCategory === key ? "active" : ""}`; chip.type = "button"; if (allProducts) chip.innerHTML = '<span class="category-dot"></span><span>كل المنتجات</span>'; else chip.textContent = name; chip.addEventListener("click", () => chooseCategory(key)); return chip; };
  nav.append(makeChip("all", "كل المنتجات", true));
  quickNav.append(makeChip("all", "كل المنتجات", true, true));
  const filtered = state.categories.filter((category) => !query || category.name.toLocaleLowerCase("ar").includes(query));
  for (const category of filtered) {
    nav.append(makeChip(category.key, category.name));
  }
  for (const category of state.categories) quickNav.append(makeChip(category.key, category.name, false, true));
  text($("category-count"), state.categories.length.toLocaleString("ar-EG"));
  if (filtered.length === 0 && query) { const empty = document.createElement("p"); empty.className = "category-empty"; empty.textContent = "لا يوجد قسم بهذا الاسم"; nav.append(empty); }
}
function chooseCategory(key) { state.activeCategory = key; renderCategories(); renderProducts(); $("category-panel").hidden = true; $("categories-open").setAttribute("aria-expanded", "false"); }

function renderProducts() {
  const query = $("search-input").value.trim().toLocaleLowerCase("ar");
  const visibleCategoryIds = new Set(state.categories.map((item) => item.key));
  const products = state.products.filter((product) => product.visible !== false && visibleCategoryIds.has(product.categoryKey))
    .filter((product) => state.activeCategory === "all" || product.categoryKey === state.activeCategory)
    .filter((product) => !query || `${product.name} ${product.description || ""} ${product.code || ""} ${product.categoryName || ""}`.toLocaleLowerCase("ar").includes(query));
  const grid = $("product-grid"); grid.replaceChildren();
  text($("product-count"), `${products.length.toLocaleString("ar-EG")} منتج`);
  text($("section-title"), state.activeCategory === "all" ? "منتجات مختارة لك" : state.categories.find((item) => item.key === state.activeCategory)?.name || "منتجات القسم");
  $("empty-state").hidden = products.length > 0;
  for (const product of products) grid.append(makeProductCard(product));
}

function makeProductCard(product) {
  const card = document.createElement("article"); card.className = "product-card";
  card.addEventListener("click", (event) => { if (!event.target.closest("button")) openProductDetails(product); });
  const image = document.createElement("button"); image.className = "product-image"; image.type = "button"; image.setAttribute("aria-label", `عرض تفاصيل ${product.name}`); image.addEventListener("click", () => openProductDetails(product));
  const firstImage = Array.isArray(product.images) ? product.images.find(validImage) : "";
  if (firstImage) { const img = document.createElement("img"); img.src = firstImage; img.alt = escapeText(product.name); img.loading = "lazy"; image.append(img); }
  else { const empty = document.createElement("span"); empty.className = "image-placeholder"; empty.setAttribute("aria-hidden", "true"); empty.innerHTML = '<svg viewBox="0 0 80 80"><rect x="13" y="18" width="54" height="48" rx="8"/><path d="m18 57 17-18 11 11 8-8 13 16M29 31h.01"/></svg>'; image.append(empty); }
  if (Number(product.discountPrice) > 0 && Number(product.price) > 0) { const discount = Math.max(1, Math.round((1 - Number(product.discountPrice) / Number(product.price)) * 100)); const badge = document.createElement("span"); badge.className = "discount-badge"; badge.textContent = `خصم ${discount}%`; image.append(badge); }
  if (Array.isArray(product.images) && product.images.length > 1) { const count = document.createElement("span"); count.className = "photo-count"; count.textContent = `${product.images.length} صور`; image.append(count); }
  if (validVideo(product.videoUrl)) { const badge = document.createElement("span"); badge.className = "video-badge"; badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6z"></path></svg> فيديو'; image.append(badge); }
  const info = document.createElement("div"); info.className = "product-info";
  const category = document.createElement("span"); category.className = "product-category"; category.textContent = escapeText(product.categoryName);
  const name = document.createElement("button"); name.type = "button"; name.className = "product-name"; name.textContent = escapeText(product.name); name.addEventListener("click", () => openProductDetails(product));
  const description = document.createElement("p"); description.className = "product-description"; description.textContent = escapeText(product.description || "");
  const prices = document.createElement("div"); prices.className = "price-line";
  const current = document.createElement("strong"); current.className = "current-price"; current.textContent = money(productPrice(product)); prices.append(current);
  if (Number(product.discountPrice) > 0) { const old = document.createElement("del"); old.className = "old-price"; old.textContent = money(product.price); prices.append(old); }
  const actions = document.createElement("div"); actions.className = "product-actions";
  const details = document.createElement("button"); details.className = "details-button"; details.type = "button"; details.textContent = "التفاصيل"; details.addEventListener("click", () => openProductDetails(product));
  const add = document.createElement("button"); add.className = "add-cart"; add.type = "button"; add.setAttribute("aria-label", `أضف ${product.name} إلى السلة`); add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 1.9-1.4L21 8H6"></path><path d="M12.5 8v6M9.5 11h6"></path></svg>'; add.addEventListener("click", () => addToCart(product.code));
  actions.append(details, add); info.append(category, name, description, prices, actions); card.append(image, info); return card;
}

function openFrame(payload) {
  state.framePayload = payload; $("frame-overlay").hidden = false; document.body.classList.add("lock-scroll");
  const store = payload.view === "store" ? (payload.store || {}) : { storeName: payload.storeName, logoBase64: payload.logoBase64 || payload.product?.storeLogoBase64 };
  const frameLogo = $("frame-brand-logo"); const hasLogo = validImage(store.logoBase64);
  frameLogo.hidden = !hasLogo; if (hasLogo) { frameLogo.src = store.logoBase64; frameLogo.alt = `شعار ${store.storeName || "المتجر"}`; }
  text($("frame-brand-name"), store.storeName || "تفاصيل المنتج");
  const frame = $("store-frame"); frame.onload = () => frame.contentWindow.postMessage({ type: "sales-express-frame", payload: state.framePayload }, location.origin);
  frame.src = "product-frame.html";
}
function openProductDetails(product) { openFrame({ view: "product", product: { ...product, storeLogoBase64: state.settings.logoBase64 }, storeName: state.settings.storeName, logoBase64: state.settings.logoBase64 }); }
function openStoreDetails() { openFrame({ view: "store", store: state.settings }); }
function closeFrame() { $("frame-overlay").hidden = true; $("store-frame").src = "about:blank"; state.framePayload = null; if (!$("cart-drawer").classList.contains("open") && !$("checkout-modal").classList.contains("open")) document.body.classList.remove("lock-scroll"); }

function addToCart(code) { const current = state.cart.get(code); state.cart.set(code, { product: current?.product || state.products.find((item) => item.code === code), quantity: (current?.quantity || 0) + 1 }); renderCart(); }
function changeQuantity(code, delta) { const entry = state.cart.get(code); if (!entry) return; entry.quantity += delta; if (entry.quantity <= 0) state.cart.delete(code); renderCart(); }
function renderCart() {
  const host = $("cart-items"); host.replaceChildren();
  let count = 0; let total = 0;
  for (const [code, entry] of state.cart) {
    count += entry.quantity; total += productPrice(entry.product) * entry.quantity;
    const row = document.createElement("div"); row.className = "cart-row";
    const image = document.createElement("img"); image.className = "cart-thumb"; image.alt = ""; image.src = entry.product.images?.find(validImage) || "";
    const details = document.createElement("div"); const name = document.createElement("div"); name.className = "cart-row-name"; name.textContent = escapeText(entry.product.name);
    const price = document.createElement("div"); price.className = "cart-row-price"; price.textContent = money(productPrice(entry.product));
    const controls = document.createElement("div"); controls.className = "quantity-control";
    const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", "تقليل الكمية"); minus.addEventListener("click", () => changeQuantity(code, -1));
    const quantity = document.createElement("span"); quantity.textContent = entry.quantity.toLocaleString("ar-EG");
    const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", "زيادة الكمية"); plus.addEventListener("click", () => changeQuantity(code, 1)); controls.append(minus, quantity, plus); details.append(name, price, controls);
    const remove = document.createElement("button"); remove.className = "remove-item"; remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", "إزالة المنتج"); remove.addEventListener("click", () => { state.cart.delete(code); renderCart(); });
    row.append(image, details, remove); host.append(row);
  }
  if (count === 0) { const empty = document.createElement("p"); empty.className = "cart-empty"; empty.textContent = "سلتك فارغة. أضف بعض المنتجات لتبدأ."; host.append(empty); }
  text($("cart-count"), count.toLocaleString("ar-EG")); text($("cart-total"), money(total)); text($("checkout-total"), money(total)); $("checkout-open").disabled = count === 0;
}

function openCart() { $("cart-overlay").hidden = false; $("cart-drawer").classList.add("open"); $("cart-drawer").setAttribute("aria-hidden", "false"); document.body.classList.add("lock-scroll"); }
function closeCart() { $("cart-overlay").hidden = true; $("cart-drawer").classList.remove("open"); $("cart-drawer").setAttribute("aria-hidden", "true"); document.body.classList.remove("lock-scroll"); }
function openCheckout() { closeCart(); $("checkout-overlay").hidden = false; $("checkout-modal").classList.add("open"); $("checkout-modal").setAttribute("aria-hidden", "false"); document.body.classList.add("lock-scroll"); $("checkout-modal").querySelector("input")?.focus(); }
function closeCheckout() { $("checkout-overlay").hidden = true; $("checkout-modal").classList.remove("open"); $("checkout-modal").setAttribute("aria-hidden", "true"); document.body.classList.remove("lock-scroll"); }

async function submitCheckout(event) {
  event.preventDefault(); if (state.busy || state.cart.size === 0) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement); const entries = Array.from(state.cart, ([code, entry]) => ({ code, quantity: entry.quantity }));
  const items = entries.map(({ code, quantity }) => ({ code, quantity }));
  const cancelToken = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replaceAll("-", "");
  const total = entries.reduce((sum, entry) => sum + productPrice(state.cart.get(entry.code).product) * entry.quantity, 0);
  const button = $("submit-order"); const message = $("checkout-message"); state.busy = true; button.disabled = true; button.innerHTML = '<span class="spinner"></span> جارٍ إرسال الطلب'; message.className = "form-message"; text(message, "");
  try {
    const createdAtUtc = new Date().toISOString();
    const result = await createOrder({ customerName: String(form.get("customerName")).trim(), phone: String(form.get("phone")).trim(), address: String(form.get("address")).trim(), notes: String(form.get("notes") || "").trim(), items, status: "New", createdAtUtc, cancelToken });
    const history = readOrderHistory(); history.unshift({ id: result.name, cancelToken, createdAtUtc, itemCount: entries.length, total, status: "New" }); saveOrderHistory(history); renderOrderHistory();
    state.cart.clear(); renderCart(); formElement.reset(); message.className = "form-message success"; text(message, "تم استلام طلبك. يمكنك متابعة الطلب أو إلغاؤه من «طلباتي» ما دام قيد المراجعة.");
    setTimeout(closeCheckout, 2800);
  } catch (error) { message.className = "form-message error"; text(message, error.message || "تعذر إرسال الطلب. حاول مرة أخرى."); }
  finally { state.busy = false; button.disabled = false; button.textContent = "إرسال الطلب"; }
}

async function loadStore() {
  if (!safeId.test(storeId || "")) {
    $("marketing-view").hidden = false; $("storefront-view").hidden = true;
    $("store-search").hidden = true; $("marketing-nav").hidden = false; $("store-actions").hidden = true;
    document.title = "Sales Express | إدارة مبيعاتك بسهولة";
    $("loading").classList.add("done"); setTimeout(() => { $("loading").hidden = true; }, 250);
    return;
  }
  try {
    $("marketing-view").hidden = true; $("storefront-view").hidden = false;
    $("store-search").hidden = false; $("marketing-nav").hidden = true; $("store-actions").hidden = false;
    const root = `storefrontPublic/${storeId}`;
    const [settings, categoryData, productData] = await Promise.all([read(`${root}/settings`), read(`${root}/categories`), read(`${root}/products`)]);
    state.settings = settings || {};
    state.categories = Object.entries(categoryData || {}).map(([key, value]) => ({ key, ...value })).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    state.products = Object.entries(productData || {}).map(([key, value]) => ({ key, ...value })).filter((item) => item.visible !== false);
    setBrand(); renderCategories(); renderProducts(); renderCart();
    if (state.products.length === 0) { $("notice").hidden = false; text($("notice"), "لا توجد منتجات معروضة حاليًا. عد لاحقًا لاكتشاف الجديد."); }
  } catch (error) {
    $("notice").hidden = false; text($("notice"), `${error.message} قد يحتاج مالك المتجر إلى تفعيل قواعد القراءة العامة لكتالوج العرض فقط.`);
  } finally { $("loading").classList.add("done"); setTimeout(() => { $("loading").hidden = true; }, 300); }
}

$("search-input").addEventListener("input", renderProducts);
$("cart-open").addEventListener("click", openCart); $("cart-close").addEventListener("click", closeCart); $("cart-overlay").addEventListener("click", closeCart);
$("checkout-open").addEventListener("click", openCheckout); $("checkout-close").addEventListener("click", closeCheckout); $("checkout-overlay").addEventListener("click", closeCheckout);
$("checkout-form").addEventListener("submit", submitCheckout);
$("orders-open").addEventListener("click", () => { renderOrderHistory(); $("customer-orders").hidden = false; $("customer-orders").scrollIntoView({ behavior: "smooth", block: "center" }); });
$("orders-close").addEventListener("click", () => { $("customer-orders").hidden = true; });
$("categories-open").addEventListener("click", () => { const panel = $("category-panel"); panel.hidden = !panel.hidden; $("categories-open").setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) { $("category-search-input").value = ""; renderCategories(); $("category-search-input").focus(); } });
$("categories-close").addEventListener("click", () => { $("category-panel").hidden = true; $("categories-open").setAttribute("aria-expanded", "false"); });
$("category-search-input").addEventListener("input", renderCategories);
$("store-info-open").addEventListener("click", () => openFrame({ view: "store", store: state.settings }));
$("frame-close").addEventListener("click", closeFrame);
$("frame-overlay").addEventListener("click", (event) => { if (event.target === $("frame-overlay")) closeFrame(); });
window.addEventListener("message", (event) => { if (event.origin !== location.origin || event.source !== $("store-frame").contentWindow || !event.data || event.data.source !== "sales-express-frame") return; if (event.data.action === "add-to-cart") addToCart(event.data.code); if (event.data.action === "close") closeFrame(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeCart(); closeCheckout(); closeFrame(); $("category-panel").hidden = true; } });
loadStore();
renderOrderHistory();
