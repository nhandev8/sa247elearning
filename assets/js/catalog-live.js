/* Catalog trực tiếp từ Supabase (hub) — không đè Career Map tĩnh, không lộ giá */
(function () {
  function assetPrefix() {
    const path = location.pathname.replace(/\\/g, "/");
    const depth = (path.match(/\//g) || []).length - 1;
    if (path.endsWith("/index.html")) return "../".repeat(Math.max(0, depth - 1));
    if (path.endsWith("/")) return "../".repeat(Math.max(0, depth));
    return "";
  }

  function cardHtml(c, prefix) {
    const img =
      c.thumbnail_url ||
      `${prefix}assets/programs/${c.slug}/card.jpg`;
    const desc = c.short_description || c.description || "";
    return `<a class="program-card reveal" href="${prefix}${c.slug}/">
      <span class="program-card__media">
        <img src="${img}" alt="${c.title || ""}" loading="lazy" width="960" height="540" />
      </span>
      <span class="code">${c.code || ""}</span>
      <h3>${c.title || ""}</h3>
      <p class="meta">${desc.slice(0, 100)}${desc.length > 100 ? "…" : ""}</p>
      <span class="go">Xem chương trình →</span>
    </a>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("catalog-live-root");
    if (!root || !window.sa247Auth?.ready) return;

    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb
        .from("courses")
        .select("code,slug,title,short_description,description,thumbnail_url,is_published,status")
        .or("is_published.eq.true,status.eq.dang_mo")
        .order("code");
      if (error) return;
      const courses = (data || []).filter((c) => c.is_published || c.status === "dang_mo");
      if (!courses.length) return;
      const prefix = assetPrefix();
      const n = Math.min(courses.length, 3) || 3;
      root.innerHTML = `<div class="program-grid program-grid--${n}">${courses
        .map((c) => cardHtml(c, prefix))
        .join("")}</div>`;
      // Không inject thêm vào Career Map / catalog tĩnh (tránh trùng + giữ copy outcome từ build).
    } catch {
      /* catalog tĩnh vẫn hiển thị */
    }
  });
})();
