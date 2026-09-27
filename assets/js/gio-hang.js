/* SA247 — Danh sách học → xác nhận đơn. Giá, ưu đãi, phí vận chuyển do server tính (quote_cart / create_cart_order). */
(function () {
  const Cart = () => window.sa247Cart;
  const fmt = (n) => Cart().fmtVnd(n);
  let catalog = [];
  let prices = {};
  let owned = new Set();
  let session = null;
  let lastQuote = null;
  let busy = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function family(code) {
    return String(code || "").replace(/-?\d+$/, "");
  }

  function skeleton(root) {
    root.innerHTML = `
      <div class="cart-grid">
        <div class="cart-main">
          <section class="cart-card">
            <h2>Khóa học</h2>
            <div id="cart-lines"></div>
            <p class="cart-tier" id="cart-tier" role="status"></p>
          </section>
          <section class="cart-card" id="cart-cert-card" hidden>
            <h2>Đăng ký nhận giấy chứng nhận</h2>
            <p class="meta">Bạn có muốn đăng ký nhận giấy chứng nhận sau khi hoàn thành khóa học? Không bắt buộc.</p>
            <div class="cart-quick">
              <span>Cho tất cả khóa học:</span>
              <button type="button" class="btn btn--line btn--small" data-all-cert="none">Chưa đăng ký</button>
              <button type="button" class="btn btn--line btn--small" data-all-cert="cert_pdf">PDF</button>
              <button type="button" class="btn btn--line btn--small" data-all-cert="cert_hard">Bản cứng</button>
            </div>
            <div id="cart-certs"></div>
            <p class="checkout-cert__note">Chứng nhận chỉ được cấp sau khi bạn hoàn thành khóa học và đạt yêu cầu kiểm tra. Khi đủ điều kiện, hệ thống tự cấp — không cần tạo đơn mới.</p>
          </section>
          <section class="cart-card" id="cart-suggest-card" hidden>
            <h2>Có thể bạn sẽ quan tâm</h2>
            <div id="cart-suggest"></div>
          </section>
        </div>
        <aside class="cart-side">
          <section class="cart-card">
            <h2>Tổng đơn</h2>
            <div id="cart-summary"></div>
          </section>
          <section class="cart-card" id="cart-buyer"></section>
        </aside>
      </div>`;
  }

  function paintLines(items, q) {
    const box = document.getElementById("cart-lines");
    if (!items.length) {
      box.innerHTML = `<p>Danh sách học đang trống. <a href="/#career-map">Xem các khóa học</a></p>`;
      return;
    }
    const byCode = {};
    (q?.items || []).forEach((it) => (byCode[it.code] = it));
    box.innerHTML = `<ul class="cart-lines">${items
      .map((x) => {
        const it = byCode[x.code] || {};
        const title = it.title || catalog.find((c) => c.code === x.code)?.title || "";
        const price =
          it.discount_amount > 0
            ? `<s>${fmt(it.unit_price)}</s> <b>${fmt(it.line_total)}</b>`
            : `<b>${fmt(it.unit_price ?? 0)}</b>`;
        return `<li>
          <div><strong>${esc(x.code)}</strong><span>${esc(title)}</span></div>
          <div class="cart-lines__right">${price}
            <button type="button" class="cart-remove" data-remove="${esc(x.code)}" aria-label="Bỏ ${esc(x.code)}">✕</button>
          </div>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function paintTier(q) {
    const el = document.getElementById("cart-tier");
    if (!q) {
      el.textContent = "";
      return;
    }
    const pct = Number(q.course_discount_percent || 0);
    const parts = [];
    if (pct > 0) parts.push(`🎉 Bạn đang nhận ưu đãi ${pct}% cho ${q.course_count} khóa học.`);
    if (q.next_tier) parts.push(`Thêm ${q.next_tier.need} khóa để nhận ưu đãi ${q.next_tier.percent}%.`);
    el.textContent = parts.join(" ");
  }

  function paintCerts(items, q) {
    const card = document.getElementById("cart-cert-card");
    card.hidden = !items.length;
    const byCode = {};
    (q?.items || []).forEach((it) => (byCode[it.code] = it));
    document.getElementById("cart-certs").innerHTML = items
      .map((x) => {
        const opt = (val, label) => `
          <label class="checkout-cert__opt">
            <input type="radio" name="cert-${esc(x.code)}" value="${val}" data-cert-code="${esc(x.code)}" ${
              x.cert === val ? "checked" : ""
            } />
            <span><b>${label}</b></span>
          </label>`;
        const it = byCode[x.code];
        const fee =
          it && it.cert !== "none"
            ? `<small>Phí cấp: ${it.cert_discount_amount > 0 ? `<s>${fmt(it.cert_unit)}</s> ` : ""}${fmt(it.cert_line_total)}</small>`
            : "";
        return `<fieldset class="cart-cert-row">
          <legend>${esc(x.code)} ${fee}</legend>
          ${opt("none", "Chưa đăng ký")}
          ${opt("cert_pdf", prices.cert_pdf ? `PDF · ${fmt(prices.cert_pdf)}` : "PDF")}
          ${opt("cert_hard", prices.cert_hard ? `Bản cứng · ${fmt(prices.cert_hard)} + phí vận chuyển` : "Bản cứng")}
        </fieldset>`;
      })
      .join("");
  }

  function paintSummary(q, err) {
    const box = document.getElementById("cart-summary");
    if (err) {
      box.innerHTML = `<p class="form-msg">${esc(err)}</p>`;
      return;
    }
    if (!q) {
      box.innerHTML = `<p class="meta">Chưa có khóa học.</p>`;
      return;
    }
    if (q.needs_owner_quote) {
      box.innerHTML = `<p>Từ 11 khóa học, SA247 sẽ gửi báo giá riêng.</p>
        <p>Liên hệ <a href="tel:+84877787988">08 77 78 79 88</a> · <a href="mailto:support@sa247.vn">support@sa247.vn</a></p>`;
      return;
    }
    const row = (l, v, cls = "") => `<li class="${cls}"><span>${l}</span><strong>${v}</strong></li>`;
    const rows = [
      row(`${q.course_count} khóa học`, fmt(q.course_list)),
    ];
    if (q.course_discount > 0) rows.push(row(`Ưu đãi ${q.course_discount_percent}%`, "−" + fmt(q.course_discount), "is-save"));
    if (q.cert_count > 0) {
      rows.push(row(`${q.cert_count} giấy chứng nhận`, fmt(q.cert_list)));
      if (q.cert_discount > 0) rows.push(row(`Ưu đãi ${q.cert_discount_percent}%`, "−" + fmt(q.cert_discount), "is-save"));
    }
    if (q.shipping_fee > 0) rows.push(row("Phí vận chuyển (mỗi đơn)", fmt(q.shipping_fee)));
    box.innerHTML = `<ul class="checkout-bank cart-sum">${rows.join("")}</ul>
      <p class="cart-total"><span>Tổng thanh toán</span><strong>${fmt(q.amount)}</strong></p>
      ${q.discount_amount > 0 ? `<p class="meta">Bạn tiết kiệm ${fmt(q.discount_amount)}.</p>` : ""}
      <p class="meta"><a href="/chinh-sach-gia/">Xem chính sách ưu đãi</a></p>`;
  }

  function paintSuggest(items) {
    const card = document.getElementById("cart-suggest-card");
    const inCart = new Set(items.map((x) => x.code));
    const fams = new Set(items.map((x) => family(x.code)));
    const pool = catalog.filter((c) => !inCart.has(c.code) && !owned.has(c.code));
    const ranked = [
      ...pool.filter((c) => fams.has(family(c.code))),
      ...pool.filter((c) => !fams.has(family(c.code))),
    ].slice(0, 3);
    card.hidden = !ranked.length;
    document.getElementById("cart-suggest").innerHTML = ranked
      .map((c) => {
        const related = items.find((x) => family(x.code) === family(c.code));
        return `<div class="cart-suggest">
          <div><strong>${esc(c.code)}</strong> · ${esc(c.title)}
            ${related ? `<small>Tiếp nối sau ${esc(related.code)}</small>` : ""}</div>
          <button type="button" class="btn btn--line btn--small" data-add="${esc(c.code)}">+ Thêm khóa</button>
        </div>`;
      })
      .join("");
  }

  function paintBuyer() {
    const box = document.getElementById("cart-buyer");
    if (session) {
      box.innerHTML = `
        <h2>Tài khoản nhận khóa học</h2>
        <p class="meta">Đơn gắn với tài khoản <code>${esc(session.user.email || "")}</code>.</p>
        <button type="button" class="btn btn--amber cart-submit" data-submit>Xác nhận &amp; thanh toán</button>
        <p class="form-msg" data-msg role="status"></p>`;
      return;
    }
    const next = encodeURIComponent(location.href);
    box.innerHTML = `
      <h2>Thông tin nhận tài khoản</h2>
      <form class="order-form checkout-buyer-form" data-buyer-form>
        <label>Họ và tên<input name="full_name" required minlength="2" autocomplete="name" /></label>
        <label>Email (dùng để đăng nhập)<input name="email" type="email" required autocomplete="email" /></label>
        <label>Số điện thoại<input name="phone" type="tel" required minlength="8" autocomplete="tel" /></label>
        <label class="checkout-terms">
          <input name="terms" type="checkbox" value="1" />
          <span>Tôi đồng ý <a href="/terms.html" target="_blank" rel="noopener">điều khoản</a> &amp; <a href="/privacy.html" target="_blank" rel="noopener">chính sách</a> SA247.</span>
        </label>
        <button type="submit" class="btn btn--amber cart-submit">Xác nhận &amp; thanh toán</button>
        <p class="form-msg" data-msg role="status"></p>
      </form>
      <p class="meta">Đã có tài khoản? <a href="/auth/login.html?next=${next}">Đăng nhập</a></p>`;
  }

  async function refresh() {
    let items = Cart().read();
    const ownedInCart = items.filter((x) => owned.has(x.code)).map((x) => x.code);
    if (ownedInCart.length) {
      ownedInCart.forEach((c) => Cart().remove(c));
      items = Cart().read();
      document.getElementById("cart-tier").textContent = `Đã bỏ ${ownedInCart.join(", ")} — bạn đã có quyền học.`;
    }
    let err = "";
    lastQuote = null;
    if (items.length) {
      try {
        lastQuote = await Cart().quote(items);
      } catch (e) {
        err = /course_not_found/.test(e.message || "")
          ? "Có khóa học không còn mở đăng ký. Vui lòng bỏ khóa đó khỏi danh sách."
          : e.message || "Không tính được giá.";
      }
    }
    paintLines(items, lastQuote);
    if (!ownedInCart.length) paintTier(lastQuote);
    paintCerts(items, lastQuote);
    paintSummary(lastQuote, err);
    paintSuggest(items);
    document.querySelectorAll(".cart-submit").forEach((b) => {
      b.disabled = !lastQuote || lastQuote.needs_owner_quote;
    });
  }

  function friendly(msg) {
    const m = String(msg || "");
    if (/already_enrolled:(.*)/.test(m)) {
      const codes = m.match(/already_enrolled:\s*([A-Z0-9 ,\-]+)/)?.[1] || "";
      codes.split(",").map((s) => s.trim()).filter(Boolean).forEach((c) => Cart().remove(c));
      return `Email này đã có quyền học ${codes}. Đã bỏ khỏi danh sách — kiểm tra lại tổng tiền.`;
    }
    if (/TERMS_REQUIRED/.test(m)) return "Bạn cần đồng ý điều khoản.";
    if (/EMAIL_INVALID/.test(m)) return "Email không hợp lệ.";
    if (/NAME_REQUIRED/.test(m)) return "Vui lòng nhập họ và tên.";
    if (/PHONE_REQUIRED/.test(m)) return "Vui lòng nhập số điện thoại.";
    if (/quote_required/.test(m)) return "Từ 11 khóa học, vui lòng liên hệ SA247 để nhận báo giá riêng.";
    return m || "Không tạo được đơn.";
  }

  async function submit(buyer) {
    if (busy) return;
    const msg = document.querySelector("#cart-buyer [data-msg]");
    const items = Cart().read();
    if (!items.length) return;
    busy = true;
    if (msg) msg.textContent = "Đang tạo đơn…";
    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb.rpc("create_cart_order", {
        p_items: items,
        p_buyer: buyer || null,
      });
      if (error) throw error;
      Cart().clear();
      location.href = `/don-hang/xem.html?t=${encodeURIComponent(data.view_token)}`;
    } catch (e) {
      if (msg) msg.textContent = friendly(e.message);
      await refresh();
    } finally {
      busy = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("cart-root");
    if (!window.sa247Auth?.ready || !window.sa247Cart) {
      root.innerHTML = `<p class="form-msg">Chưa kết nối được hệ thống. Tải lại trang.</p>`;
      return;
    }
    const url = new URL(location.href);
    const addCode = url.searchParams.get("add");
    if (addCode) {
      Cart().add(addCode);
      url.searchParams.delete("add");
      history.replaceState(null, "", url.pathname + url.search);
    }

    skeleton(root);
    const sb = await sa247Auth.ensureClient();
    session = await sa247Auth.getSession();
    const { data: cs } = await sb.from("courses").select("code,title").eq("is_published", true).order("code");
    catalog = cs || [];
    const { data: pr } = await sb.from("product_prices").select("code,amount");
    (pr || []).forEach((r) => (prices[r.code] = Number(r.amount)));
    if (session) {
      const { data: en } = await sb
        .from("enrollments")
        .select("course:courses(code)")
        .eq("user_id", session.user.id)
        .eq("status", "active");
      owned = new Set((en || []).map((e) => e.course?.code).filter(Boolean));
    }
    paintBuyer();
    await refresh();

    root.addEventListener("click", async (ev) => {
      const rm = ev.target.closest("[data-remove]");
      if (rm) {
        Cart().remove(rm.getAttribute("data-remove"));
        return refresh();
      }
      const ad = ev.target.closest("[data-add]");
      if (ad) {
        Cart().add(ad.getAttribute("data-add"));
        return refresh();
      }
      const all = ev.target.closest("[data-all-cert]");
      if (all) {
        Cart().setAllCert(all.getAttribute("data-all-cert"));
        return refresh();
      }
      if (ev.target.closest("[data-submit]")) submit(null);
    });
    root.addEventListener("change", (ev) => {
      const r = ev.target.closest("[data-cert-code]");
      if (r && r.checked) {
        Cart().setCert(r.getAttribute("data-cert-code"), r.value);
        refresh();
      }
    });
    root.addEventListener("submit", (ev) => {
      const form = ev.target.closest("[data-buyer-form]");
      if (!form) return;
      ev.preventDefault();
      const fd = new FormData(form);
      submit({
        full_name: String(fd.get("full_name") || "").trim(),
        email: String(fd.get("email") || "").trim().toLowerCase(),
        phone: String(fd.get("phone") || "").trim(),
        terms: !!fd.get("terms"),
      });
    });
  });
})();
