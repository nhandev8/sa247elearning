/* SA247 — cấu hình công khai từ Supabase (get_public_config): bảng giá, tài khoản nhận thanh toán, số khóa.
 * Chữ tĩnh trong HTML chỉ là fallback SEO; giá hiển thị được thay bằng số liệu server.
 *   <span data-sa247-price="course_default">99.000đ</span>
 *   <span data-sa247-course-count>9</span>
 */
(function () {
  if (window.sa247PublicConfig) return;
  const CACHE_KEY = "sa247.publicConfig.v1";
  const TTL_MS = 10 * 60 * 1000;
  const selfSrc = document.currentScript?.src || "";
  let pending = null;

  function money(n) {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? v.toLocaleString("vi-VN") + "đ" : "";
  }

  function supabaseConfig() {
    if (window.SA247_SUPABASE?.url) return Promise.resolve(window.SA247_SUPABASE);
    if (!selfSrc) return Promise.resolve(null);
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = new URL("../supabase-config.js", selfSrc).href;
      s.onload = () => resolve(window.SA247_SUPABASE || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  async function fetchConfig() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
    } catch (_) {}
    const cfg = await supabaseConfig();
    if (!cfg?.url || !cfg?.anonKey) return null;
    const res = await fetch(`${cfg.url}/rest/v1/rpc/get_public_config`, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return null;
    const data = await res.json();
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
    } catch (_) {}
    return data;
  }

  function load() {
    if (!pending) pending = fetchConfig().catch(() => null);
    return pending;
  }

  let pendingCourses = null;

  async function fetchCourses() {
    const key = "sa247.publicCourses.v1";
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
    } catch (_) {}
    const cfg = await supabaseConfig();
    if (!cfg?.url || !cfg?.anonKey) return [];
    const res = await fetch(
      `${cfg.url}/rest/v1/courses?is_published=eq.true&select=code,slug,title,category&order=code.asc`,
      { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    } catch (_) {}
    return Array.isArray(data) ? data : [];
  }

  function courses() {
    if (!pendingCourses) pendingCourses = fetchCourses().catch(() => []);
    return pendingCourses;
  }

  function price(cfg, key) {
    return Number(cfg?.prices?.[key]?.amount) || 0;
  }

  async function hydrate(root) {
    const scope = root || document;
    const priceEls = scope.querySelectorAll("[data-sa247-price]");
    const countEls = scope.querySelectorAll("[data-sa247-course-count]");
    if (!priceEls.length && !countEls.length) return;
    const cfg = await load();
    if (!cfg) return;
    priceEls.forEach((el) => {
      const text = money(price(cfg, el.getAttribute("data-sa247-price")));
      if (text) el.textContent = text;
    });
    countEls.forEach((el) => {
      if (cfg.course_count) el.textContent = String(cfg.course_count);
    });
  }

  window.sa247PublicConfig = {
    load,
    money,
    price: async (key) => price(await load(), key),
    bank: async () => (await load())?.bank || null,
    courses,
    hydrate,
  };
  document.dispatchEvent(new CustomEvent("sa247:public-config-ready"));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => hydrate());
  } else {
    hydrate();
  }
})();
