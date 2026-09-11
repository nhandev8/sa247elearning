/* Catalog trực tiếp từ Supabase (hub) */
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
      <p class="meta">${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}</p>
      <span class="go">Xem chương trình →</span>
    </a>`;
  }

  function careerCard(c, prefix) {
    return `<a class="career-card reveal" href="${prefix}${c.slug}/">
      <h3>${c.code} · ${c.title}</h3>
      <p>${(c.short_description || "").slice(0, 120)}</p>
      <span class="career-card__go">Xem chương trình →</span>
    </a>`;
  }

  function renderGrid(courses, prefix, mode) {
    if (!courses.length) return "";
    const cards = courses.map((c) => (mode === "career" ? careerCard(c, prefix) : cardHtml(c, prefix)));
    if (mode === "career") {
      return `<div class="career-grid catalog-live-inject">${cards.join("")}</div>`;
    }
    const n = Math.min(courses.length, 3);
    return `<div class="catalog-group reveal catalog-live-inject">
      <header class="catalog-group__head">
        <h3>Khóa học trực tuyến</h3>
        <p>Danh sách cập nhật từ hệ thống — khóa đang mở hoặc đã xuất bản.</p>
      </header>
      <div class="program-grid program-grid--${n}">${cards.join("")}</div>
    </div>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("catalog-live-root");
    const liveCatalogs = document.querySelectorAll("[data-live-catalog].catalog, #chuong-trinh .catalog");
    const career = document.getElementById("career-map");
    if (!root && !liveCatalogs.length && !career) return;
    if (!window.sa247Auth?.ready) return;

    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb
        .from("courses")
        .select("code,slug,title,short_description,description,thumbnail_url,is_published,status,price")
        .or("is_published.eq.true,status.eq.dang_mo")
        .order("code");
      if (error) return;
      const courses = (data || []).filter((c) => c.is_published || c.status === "dang_mo");
      const prefix = assetPrefix();

      if (root) {
        const n = Math.min(courses.length, 3) || 3;
        root.innerHTML = `<div class="program-grid program-grid--${n}">${courses.map((c) => cardHtml(c, prefix)).join("")}</div>`;
      }

      liveCatalogs.forEach((el) => {
        if (el.querySelector(".catalog-live-inject")) return;
        el.insertAdjacentHTML("beforeend", renderGrid(courses, prefix, "catalog"));
      });

      if (career && !career.querySelector(".catalog-live-inject")) {
        const grid = career.querySelector(".career-grid");
        if (grid) {
          courses.slice(0, 3).forEach((c) => {
            grid.insertAdjacentHTML("beforeend", careerCard(c, prefix));
          });
        }
      }
    } catch {
      /* catalog tĩnh vẫn hiển thị */
    }
  });
})();
