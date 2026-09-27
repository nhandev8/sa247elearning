/* SA247 — Danh sách học (giỏ): chỉ lưu mã khóa + lựa chọn GCN; giá luôn lấy từ server (quote_cart). */
(function () {
  const KEY = "sa247-cart-v1";
  const listeners = [];

  function fmtVnd(n) {
    return Number(n || 0).toLocaleString("vi-VN") + "đ";
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(raw)
        ? raw.filter((x) => x && x.code).map((x) => ({ code: String(x.code).toUpperCase(), cert: x.cert || "none" }))
        : [];
    } catch (_) {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (_) {}
    listeners.forEach((fn) => {
      try {
        fn(items);
      } catch (_) {}
    });
    paintBadge();
  }

  function has(code) {
    return read().some((x) => x.code === String(code).toUpperCase());
  }

  function add(code) {
    const c = String(code || "").toUpperCase();
    if (!c) return read();
    const items = read();
    if (!items.some((x) => x.code === c)) items.push({ code: c, cert: "none" });
    write(items);
    return items;
  }

  function remove(code) {
    const c = String(code || "").toUpperCase();
    const items = read().filter((x) => x.code !== c);
    write(items);
    return items;
  }

  function setCert(code, cert) {
    const items = read().map((x) => (x.code === String(code).toUpperCase() ? { ...x, cert } : x));
    write(items);
    return items;
  }

  function setAllCert(cert) {
    const items = read().map((x) => ({ ...x, cert }));
    write(items);
    return items;
  }

  function clear() {
    write([]);
  }

  async function quote(items) {
    const list = items || read();
    if (!list.length || !window.sa247Auth?.ready) return null;
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("quote_cart", { p_items: list });
    if (error) throw error;
    return data;
  }

  function tierMessage(q, prevPct) {
    if (!q) return "";
    const pct = Number(q.course_discount_percent || 0);
    if (pct > Number(prevPct || 0)) {
      return `🎉 Bạn đã nhận ưu đãi ${pct}% cho ${q.course_count} khóa học.`;
    }
    if (q.next_tier) {
      return `Thêm ${q.next_tier.need} khóa để nhận ưu đãi ${q.next_tier.percent}%.`;
    }
    return "";
  }

  let badgeQuote = null;

  async function paintBadge() {
    if (document.body?.hasAttribute("data-no-cart-badge")) return;
    const items = read();
    let el = document.getElementById("sa247-cart-badge");
    if (!items.length) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement("a");
      el.id = "sa247-cart-badge";
      el.className = "cart-badge";
      el.href = "/gio-hang/";
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.innerHTML = `🛒 <b>${items.length} khóa học</b><span data-cart-total></span>`;
    try {
      badgeQuote = await quote(items);
      const t = el.querySelector("[data-cart-total]");
      if (t && badgeQuote?.course_pay != null) t.textContent = fmtVnd(badgeQuote.course_pay);
    } catch (_) {}
  }

  function toast(html) {
    let el = document.getElementById("sa247-cart-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sa247-cart-toast";
      el.className = "cart-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-on"), 4200);
  }

  async function addWithFeedback(code) {
    const prevPct = badgeQuote?.course_discount_percent || 0;
    const items = add(code);
    let msg = "";
    try {
      const q = await quote(items);
      badgeQuote = q;
      msg = tierMessage(q, prevPct);
    } catch (_) {}
    toast(
      `✓ Đã thêm <b>${String(code).toUpperCase()}</b> vào danh sách học.` +
        (msg ? `<br/>${msg}` : "") +
        ` <a href="/gio-hang/">Xem danh sách học</a>`
    );
    return items;
  }

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-cart-add]");
    if (!btn) return;
    ev.preventDefault();
    const code = btn.getAttribute("data-cart-add");
    const go = btn.hasAttribute("data-cart-go");
    if (go) {
      add(code);
      location.href = "/gio-hang/";
      return;
    }
    addWithFeedback(code).then(() => {
      document.querySelectorAll(`[data-cart-add="${code}"]:not([data-cart-go])`).forEach((b) => {
        b.textContent = "✓ Đã có trong danh sách học";
      });
    });
  });

  window.sa247Cart = {
    read,
    has,
    add,
    addWithFeedback,
    remove,
    setCert,
    setAllCert,
    clear,
    quote,
    tierMessage,
    fmtVnd,
    onChange: (fn) => listeners.push(fn),
    paintBadge,
  };

  document.addEventListener("DOMContentLoaded", () => paintBadge());
})();
