const $ = (id) => document.getElementById(id);
const firebaseDatabaseUrl = window.firebaseDatabaseUrl;
let storeId = new URLSearchParams(location.search).get("store") || "";
const safeId = /^[A-Za-z0-9_-]{1,128}$/;
const state = { settings: {}, categories: [], products: [], cart: new Map(), activeCategory: "all", busy: false };

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
function text(element, value) { element.textContent = value ?? ""; }
function money(value) { return `${Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`; }
function escapeText(value) { return String(value ?? ""); }
function productPrice(product) { return Number(product.discountPrice) > 0 ? Number(product.discountPrice) : Number(product.price || 0); }
function validImage(value) { return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value); }

function setBrand() {
  const name = state.settings.storeName?.trim() || "متجر العملاء";
  text($("store-name"), name); text($("footer-store-name"), name); document.title = `${name} | المتجر الإلكتروني`;
  const logo = $("store-logo");
  if (validImage(state.settings.logoBase64)) { logo.src = state.settings.logoBase64; logo.hidden = false; $("logo-fallback").hidden = true; }
  else { logo.hidden = true; $("logo-fallback").hidden = false; text($("logo-fallback"), [...name][0] || "س"); }
}

function renderCategories() {
  const nav = $("category-nav"); nav.replaceChildren();
  const all = document.createElement("button"); all.className = `category-chip ${state.activeCategory === "all" ? "active" : ""}`; all.type = "button"; all.textContent = "كل المنتجات"; all.addEventListener("click", () => chooseCategory("all")); nav.append(all);
  for (const category of state.categories) {
    const button = document.createElement("button"); button.className = `category-chip ${state.activeCategory === category.key ? "active" : ""}`; button.type = "button"; button.textContent = category.name;
    button.addEventListener("click", () => chooseCategory(category.key)); nav.append(button);
  }
}
function chooseCategory(key) { state.activeCategory = key; renderCategories(); renderProducts(); }

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
  const image = document.createElement("div"); image.className = "product-image";
  const firstImage = Array.isArray(product.images) ? product.images.find(validImage) : "";
  if (firstImage) { const img = document.createElement("img"); img.src = firstImage; img.alt = escapeText(product.name); img.loading = "lazy"; image.append(img); }
  else { const empty = document.createElement("div"); empty.className = "image-placeholder"; empty.textContent = "◇"; image.append(empty); }
  if (Number(product.discountPrice) > 0 && Number(product.price) > 0) { const discount = Math.max(1, Math.round((1 - Number(product.discountPrice) / Number(product.price)) * 100)); const badge = document.createElement("span"); badge.className = "discount-badge"; badge.textContent = `خصم ${discount}%`; image.append(badge); }
  if (Array.isArray(product.images) && product.images.length > 1) { const count = document.createElement("span"); count.className = "photo-count"; count.textContent = `${product.images.length} صور`; image.append(count); }
  const info = document.createElement("div"); info.className = "product-info";
  const category = document.createElement("span"); category.className = "product-category"; category.textContent = escapeText(product.categoryName);
  const name = document.createElement("h3"); name.className = "product-name"; name.textContent = escapeText(product.name);
  const description = document.createElement("p"); description.className = "product-description"; description.textContent = escapeText(product.description || "");
  const prices = document.createElement("div"); prices.className = "price-line";
  const current = document.createElement("strong"); current.className = "current-price"; current.textContent = money(productPrice(product)); prices.append(current);
  if (Number(product.discountPrice) > 0) { const old = document.createElement("del"); old.className = "old-price"; old.textContent = money(product.price); prices.append(old); }
  const add = document.createElement("button"); add.className = "add-cart"; add.type = "button"; add.textContent = "أضف إلى السلة"; add.addEventListener("click", () => addToCart(product.code));
  info.append(category, name, description, prices, add); card.append(image, info); return card;
}

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
  const form = new FormData(event.currentTarget); const items = Array.from(state.cart, ([code, entry]) => ({ code, quantity: entry.quantity }));
  const button = $("submit-order"); const message = $("checkout-message"); state.busy = true; button.disabled = true; button.innerHTML = '<span class="spinner"></span> جارٍ إرسال الطلب'; message.className = "form-message"; text(message, "");
  try {
    await createOrder({ customerName: String(form.get("customerName")).trim(), phone: String(form.get("phone")).trim(), address: String(form.get("address")).trim(), notes: String(form.get("notes") || "").trim(), items, status: "New", createdAtUtc: new Date().toISOString() });
    state.cart.clear(); renderCart(); event.currentTarget.reset(); message.className = "form-message success"; text(message, "تم استلام طلبك. سيتواصل معك المتجر لتأكيد السعر والتوصيل.");
    setTimeout(closeCheckout, 2800);
  } catch (error) { message.className = "form-message error"; text(message, error.message || "تعذر إرسال الطلب. حاول مرة أخرى."); }
  finally { state.busy = false; button.disabled = false; button.textContent = "إرسال الطلب"; }
}

async function loadStore() {
  try {
    if (!safeId.test(storeId || "")) throw new Error("رابط المتجر غير مكتمل. افتح الرابط الخاص الذي أرسله لك المتجر.");
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
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeCart(); closeCheckout(); } });
loadStore();
