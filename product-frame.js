const content = document.getElementById("frame-content");
const loading = document.getElementById("frame-loading");
const money = (amount) => `${Number(amount || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ج.م`;
const validImage = (value) => typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value);
function safeVideoUrl(value) { try { const url = new URL(value); return url.protocol === "https:" && /\.(mp4|webm|ogg)$/i.test(url.pathname) ? url.href : ""; } catch { return ""; } }
function send(action, code) { parent.postMessage({ source: "sales-express-frame", action, code }, location.origin); }
function element(tag, className, value) { const node = document.createElement(tag); if (className) node.className = className; if (value !== undefined) node.textContent = value; return node; }
function renderStore(store) {
  content.replaceChildren(); content.className = "frame-content store-info-content";
  const hero = element("section", "store-info-hero");
  const mark = element("div", "store-info-mark");
  if (validImage(store.logoBase64)) { const logo = document.createElement("img"); logo.src = store.logoBase64; logo.alt = "شعار المتجر"; mark.append(logo); }
  else mark.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 25h40l-4 29H16zM22 26a10 10 0 0 1 20 0M24 38h16"/></svg>';
  const kicker = element("span", "frame-eyebrow", "معلومات المتجر");
  const title = element("h1", "store-info-title", store.storeName || "متجر العملاء");
  const intro = element("p", "store-info-description", "تواصل مع المتجر للاستفسار عن المنتجات أو تأكيد تفاصيل الطلب والتوصيل.");
  const card = element("div", "store-contact-card");
  const icon = element("span", "contact-icon"); icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 3h10v18H7zM10 6h4M11 18h2"></path></svg>';
  const data = element("div", "contact-copy"); data.append(element("small", "", "هاتف المتجر"));
  const phone = String(store.phoneNumber || "").trim();
  if (phone) { const anchor = element("a", "", phone); anchor.href = `tel:${phone.replace(/[^+\d]/g, "")}`; data.append(anchor); }
  else data.append(element("strong", "", "يرجى التواصل عبر بيانات الطلب"));
  card.append(icon, data); hero.append(mark, kicker, title, intro); content.append(hero, card);
  const address = String(store.address || store.storeAddress || store.branchAddress || "").trim();
  if (address) {
    const addressCard = element("div", "store-contact-card store-address-card");
    const addressIcon = element("span", "contact-icon"); addressIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"></path><circle cx="12" cy="9" r="2.3"></circle></svg>';
    const addressCopy = element("div", "contact-copy"); addressCopy.append(element("small", "", "عنوان المتجر"), element("strong", "address-text", address));
    addressCard.append(addressIcon, addressCopy); content.append(addressCard);
    const maps = element("div", "store-map-links"); const query = encodeURIComponent(address);
    const google = element("a", "", "فتح في Google Maps"); google.href = `https://www.google.com/maps/search/?api=1&query=${query}`; google.target = "_blank"; google.rel = "noopener";
    const apple = element("a", "", "فتح في Apple Maps"); apple.href = `https://maps.apple.com/?q=${query}`; apple.target = "_blank"; apple.rel = "noopener";
    maps.append(google, apple); content.append(maps);
  }
  const foot = element("div", "store-info-note", "الطلبات تُرسل مباشرة إلى المتجر. السعر المعروض لا يشمل التوصيل."); content.append(foot);
}
function renderProduct(product, storeName) {
  content.replaceChildren(); content.className = "frame-content product-detail-content";
  const images = Array.isArray(product.images) ? product.images.filter(validImage) : [];
  const gallery = element("section", "detail-gallery");
  const stage = element("div", "gallery-stage");
  const hero = document.createElement("img"); hero.className = "gallery-main-image"; hero.alt = product.name || "صورة المنتج";
  if (images.length) hero.src = images[0]; else { hero.hidden = true; stage.innerHTML = '<div class="frame-image-placeholder"><svg viewBox="0 0 80 80"><rect x="13" y="18" width="54" height="48" rx="8"/><path d="m18 57 17-18 11 11 8-8 13 16M29 31h.01"/></svg></div>'; }
  stage.append(hero);
  const count = element("span", "gallery-count", `${images.length.toLocaleString("ar-EG")} صورة`); stage.append(count); gallery.append(stage);
  if (images.length > 1) { const thumbs = element("div", "gallery-thumbnails"); images.forEach((src, index) => { const button = document.createElement("button"); button.type = "button"; button.className = index === 0 ? "gallery-thumb active" : "gallery-thumb"; const img = document.createElement("img"); img.src = src; img.alt = `صورة ${index + 1}`; button.append(img); button.addEventListener("click", () => { hero.src = src; thumbs.querySelectorAll(".gallery-thumb").forEach((item) => item.classList.remove("active")); button.classList.add("active"); }); thumbs.append(button); }); gallery.append(thumbs); }
  const info = element("section", "detail-info");
  const category = element("span", "detail-category", product.categoryName || "منتجات المتجر");
  const title = element("h1", "detail-title", product.name || "منتج");
  const code = element("p", "detail-code", `كود المنتج: ${product.code || "—"}`);
  const priceLine = element("div", "detail-price-line"); const price = Number(product.discountPrice) > 0 ? Number(product.discountPrice) : Number(product.price || 0); priceLine.append(element("strong", "detail-price", money(price))); if (Number(product.discountPrice) > 0) priceLine.append(element("del", "detail-old-price", money(product.price)));
  const fullDescription = [product.description, product.notes, product.details, product.specifications].filter((value, index, all) => typeof value === "string" && value.trim() && all.indexOf(value) === index).join("\n\n");
  const description = element("p", "detail-description", fullDescription || "لا يوجد وصف إضافي لهذا المنتج.");
  const rule = element("div", "detail-divider");
  const store = element("div", "detail-store-line");
  if (validImage(product.storeLogoBase64)) { const mark = document.createElement("img"); mark.className = "detail-store-logo"; mark.alt = `شعار ${storeName || "المتجر"}`; mark.src = product.storeLogoBase64; store.append(mark); }
  else { const mark = element("span", "detail-store-fallback", "م"); mark.setAttribute("aria-hidden", "true"); store.append(mark); }
  store.append(element("span", "", `يباع لدى ${storeName || "المتجر"}`));
  const add = element("button", "detail-add-button", "أضف إلى السلة"); add.type = "button"; add.addEventListener("click", () => send("add-to-cart", product.code));
  info.append(category, title, code, priceLine, description, rule, store);
  const videoUrl = safeVideoUrl(product.videoUrl);
  if (videoUrl) { const videoBlock = element("section", "detail-video-block"); videoBlock.append(element("h2", "", "فيديو المنتج")); const video = document.createElement("video"); video.controls = true; video.playsInline = true; video.preload = "metadata"; video.src = videoUrl; videoBlock.append(video); info.append(videoBlock); }
  info.append(add); content.append(gallery, info);
}
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.source !== parent || !event.data || event.data.type !== "sales-express-frame") return;
  const payload = event.data.payload || {};
  if (payload.view === "store") renderStore(payload.store || {});
  else if (payload.view === "product") renderProduct(payload.product || {}, payload.storeName);
  content.hidden = false; loading.hidden = true;
});
send("ready");
