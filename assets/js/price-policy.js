/* SA247 — trang chính sách giá: đọc giá + bậc ưu đãi từ Supabase. */
(function () {
  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function tierLabel(t) {
    if (t.max_courses == null) return `Từ ${t.min_courses} khóa`;
    if (t.min_courses === t.max_courses) return `${t.min_courses} khóa`;
    return `${t.min_courses}–${t.max_courses} khóa`;
  }

  function pctFor(tiers, n) {
    const t = tiers
      .filter((x) => n >= x.min_courses && (x.max_courses == null || n <= x.max_courses))
      .sort((a, b) => b.min_courses - a.min_courses)[0];
    return t ? t.discount_percent : null;
  }

  function total(prices, tiers, n, opt) {
    const pct = pctFor(tiers, n);
    if (pct == null) return null;
    const course = Math.round((prices.course_default * n * (100 - pct)) / 100);
    const certUnit = opt === "pdf" ? prices.cert_pdf : opt === "hard" ? prices.cert_hard : 0;
    const cert = Math.round((certUnit * n * (100 - pct)) / 100);
    const ship = opt === "hard" ? prices.shipping_default : 0;
    return { amount: course + cert + ship, list: (prices.course_default + certUnit) * n + ship, pct };
  }

  async function hydrate() {
    if (!window.sa247Auth?.ready) return;
    const sb = await sa247Auth.ensureClient();
    const [pRes, tRes] = await Promise.all([
      sb.from("product_prices").select("code,amount"),
      sb.from("quantity_discount_tiers").select("min_courses,max_courses,discount_percent").order("min_courses"),
    ]);
    if (pRes.error || tRes.error || !pRes.data?.length || !tRes.data?.length) return;

    const prices = { course_default: 99000, cert_pdf: 169000, cert_hard: 199000, shipping_default: 35000 };
    pRes.data.forEach((r) => {
      if (r.amount != null) prices[r.code] = Number(r.amount);
    });
    const tiers = tRes.data;

    document.querySelectorAll("[data-price]").forEach((el) => {
      const v = prices[el.getAttribute("data-price")];
      if (v != null) el.textContent = fmtVnd(v);
    });

    const tb = document.querySelector("[data-tiers]");
    if (tb) {
      tb.innerHTML = tiers
        .map((t) => {
          const v =
            t.discount_percent == null ? "Liên hệ" : t.discount_percent === 0 ? "Giá niêm yết" : `${t.discount_percent}%`;
          return `<tr><td>${tierLabel(t)}</td><td class="num">${v}</td></tr>`;
        })
        .join("");
    }

    const ex = document.querySelector("[data-examples]");
    if (ex) {
      const rows = [
        [1, "none", "1 khóa · chỉ học"],
        [1, "pdf", "1 khóa · đăng ký nhận giấy chứng nhận PDF"],
        [1, "hard", "1 khóa · đăng ký nhận giấy chứng nhận bản cứng"],
        [2, "none", "2 khóa · chỉ học"],
        [3, "pdf", "3 khóa · đăng ký nhận giấy chứng nhận PDF"],
        [8, "hard", "8 khóa · đăng ký nhận giấy chứng nhận bản cứng"],
      ];
      ex.innerHTML = rows
        .map(([n, opt, label]) => {
          const q = total(prices, tiers, n, opt);
          if (!q) return "";
          const saved = q.list - q.amount;
          const note = saved > 0 ? `<br/><small>Tiết kiệm ${fmtVnd(saved)} (ưu đãi ${q.pct}%)</small>` : "";
          return `<tr><td>${label}</td><td class="num">${fmtVnd(q.amount)}${note}</td></tr>`;
        })
        .join("");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    hydrate().catch((e) => console.warn("[price-policy]", e));
  });
})();
