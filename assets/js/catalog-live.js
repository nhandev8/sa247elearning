/* Catalog hub: hydrate card meta (chương/bài) + giá từ Supabase.
 * Không thay layout nhóm tĩnh từ build — chỉ cập nhật [data-live-meta] / [data-live-price].
 */
(function () {
  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v.toLocaleString("vi-VN") + "đ";
  }

  async function client() {
    if (window.__sa247Sb) return window.__sa247Sb;
    if (typeof window.sa247Auth?.readyClient === "function") {
      return window.sa247Auth.readyClient();
    }
    // wait briefly for supabase-client.js
    for (let i = 0; i < 40; i++) {
      if (window.__sa247Sb) return window.__sa247Sb;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }

  async function hydrate() {
    const cards = document.querySelectorAll("[data-course-code]");
    if (!cards.length) return;

    const sb = await client();
    if (!sb) {
      cards.forEach((card) => {
        const meta = card.querySelector("[data-live-meta]");
        const price = card.querySelector("[data-live-price]");
        if (meta && !meta.dataset.filled) {
          meta.textContent =
            meta.getAttribute("data-fallback-meta") || "Lộ trình trên hệ thống";
        }
        if (price && !price.dataset.filled) price.textContent = "99.000đ";
      });
      return;
    }

    const { data: courses, error } = await sb
      .from("courses")
      .select("id,code,price,slug,title,is_published")
      .eq("is_published", true);
    if (error || !courses) {
      console.warn("[SA247] catalog hydrate courses:", error);
      return;
    }

    const byCode = Object.create(null);
    const ids = [];
    courses.forEach((c) => {
      byCode[String(c.code || "").toUpperCase()] = c;
      ids.push(c.id);
    });

    const modCount = Object.create(null);
    const lessonCount = Object.create(null);
    ids.forEach((id) => {
      modCount[id] = 0;
      lessonCount[id] = 0;
    });

    const { data: modules } = await sb
      .from("modules")
      .select("id,course_id")
      .in("course_id", ids);
    const moduleToCourse = Object.create(null);
    (modules || []).forEach((m) => {
      modCount[m.course_id] = (modCount[m.course_id] || 0) + 1;
      moduleToCourse[m.id] = m.course_id;
    });

    const moduleIds = Object.keys(moduleToCourse);
    if (moduleIds.length) {
      // Chỉ đếm bài có lesson_code ổn định (bỏ orphan YouTube không mã → tránh 340 thay vì 90)
      const { data: lessons } = await sb
        .from("lessons")
        .select("id,module_id,lesson_code")
        .in("module_id", moduleIds)
        .not("lesson_code", "is", null);
      (lessons || []).forEach((L) => {
        if (!String(L.lesson_code || "").trim()) return;
        const cid = moduleToCourse[L.module_id];
        if (cid) lessonCount[cid] = (lessonCount[cid] || 0) + 1;
      });
    }

    cards.forEach((card) => {
      const code = String(card.getAttribute("data-course-code") || "").toUpperCase();
      const row = byCode[code];
      const meta = card.querySelector("[data-live-meta]");
      const priceEl = card.querySelector("[data-live-price]");
      if (!row) {
        if (meta) meta.textContent = "Đang cập nhật lộ trình";
        return;
      }
      const mc = modCount[row.id] || 0;
      const lc = lessonCount[row.id] || 0;
      if (meta) {
        meta.textContent =
          mc || lc
            ? `${mc} chương · ${lc} bài học`
            : "Lộ trình trên hệ thống";
        meta.dataset.filled = "1";
      }
      if (priceEl) {
        priceEl.textContent = money(row.price) || "99.000đ";
        priceEl.dataset.filled = "1";
      }
    });

    // Hero / CTA price banner if present
    const banner = document.querySelector("[data-live-course-from-price]");
    if (banner && courses.length) {
      const min = Math.min(...courses.map((c) => Number(c.price) || 99000));
      banner.textContent = "KHÓA HỌC CHÍNH THỨC TỪ " + money(min);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      hydrate().catch((e) => console.warn("[SA247] catalog hydrate", e));
    });
  } else {
    hydrate().catch((e) => console.warn("[SA247] catalog hydrate", e));
  }
})();
