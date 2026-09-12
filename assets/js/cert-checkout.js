/* SA247 — mua GCN PDF / bản cứng sau khi đạt (logged-in)
 * Giá từ get_product_prices(); hard bắt buộc địa chỉ + cộng shipping_default.
 */
(function () {
  const BANK = window.SA247_BANK || {
    name: "VPBank",
    owner: "HO HUU NHAN",
    account: "0877787988",
    bin: "VPB",
  };

  const LABELS = {
    cert_pdf: "Giấy chứng nhận điện tử PDF",
    cert_hard: "Giấy chứng nhận bản cứng",
  };

  let pollTimer = null;
  let prices = {
    cert_pdf: 169000,
    cert_hard: 199000,
    shipping_default: 35000,
  };

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function params() {
    const u = new URLSearchParams(location.search);
    return {
      course: (u.get("course") || "").trim(),
      type: (u.get("type") || "").trim(),
    };
  }

  function vietQrUrl(amount, addInfo) {
    const base = `https://img.vietqr.io/image/${encodeURIComponent(BANK.bin)}-${encodeURIComponent(BANK.account)}-compact2.png`;
    const q = new URLSearchParams({
      amount: String(amount),
      addInfo: String(addInfo),
      accountName: BANK.owner,
    });
    return `${base}?${q.toString()}`;
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function loadPrices() {
    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb.rpc("get_product_prices");
      if (error) throw error;
      const map = {};
      if (data && typeof data === "object" && !Array.isArray(data)) {
        Object.keys(data).forEach((k) => {
          const v = data[k];
          if (v && typeof v === "object" && v.amount != null) map[k] = Number(v.amount);
          else if (typeof v === "number") map[k] = v;
        });
      } else if (Array.isArray(data)) {
        data.forEach((r) => {
          if (r && r.code != null) map[r.code] = Number(r.amount);
        });
      }
      prices = { ...prices, ...map };
    } catch (e) {
      console.warn("[cert-checkout] prices fallback", e);
    }
  }

  function renderChooser(root, course) {
    const ship = prices.shipping_default || 35000;
    root.innerHTML = `
      <div class="checkout-panel">
        <p class="kicker">${esc(course)}</p>
        <h2>Bạn đã đủ điều kiện cấp giấy chứng nhận</h2>
        <p class="checkout-lead">Chọn hình thức nhận (không bắt buộc). Phí khóa học là phí tham gia — GCN là lựa chọn sau khi đạt.</p>
        <div class="cert-buy-options">
          <button type="button" class="btn btn--amber" data-type="cert_pdf">
            PDF điện tử · ${fmtVnd(prices.cert_pdf)}
          </button>
          <button type="button" class="btn btn--line" data-type="cert_hard">
            Bản cứng · ${fmtVnd(prices.cert_hard)} + ship ${fmtVnd(ship)}
          </button>
          <a class="btn btn--line" href="./">Không nhận · Về danh sách</a>
        </div>
      </div>`;
    root.querySelectorAll("[data-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-type");
        const u = new URL(location.href);
        u.searchParams.set("course", course);
        u.searchParams.set("type", type);
        history.replaceState({}, "", u);
        if (type === "cert_hard") renderHardForm(root, course);
        else startBuy(course, type, null);
      });
    });
  }

  function renderHardForm(root, course) {
    const ship = prices.shipping_default || 35000;
    const product = prices.cert_hard || 199000;
    const total = product + ship;
    root.innerHTML = `
      <div class="checkout-panel">
        <p class="kicker">${esc(course)} · Bản cứng</p>
        <h2>Địa chỉ nhận giấy chứng nhận</h2>
        <p class="checkout-lead">
          Sản phẩm ${fmtVnd(product)} + vận chuyển ${fmtVnd(ship)} =
          <strong>${fmtVnd(total)}</strong>. Có kèm bản PDF điện tử.
        </p>
        <form class="checkout-form" data-hard-form>
          <label>Họ tên người nhận<input name="full_name" required autocomplete="name" /></label>
          <label>Số điện thoại<input name="phone" required autocomplete="tel" /></label>
          <label>Địa chỉ<input name="address" required autocomplete="street-address" /></label>
          <label>Tỉnh / Thành phố<input name="province" required /></label>
          <label>Ghi chú (tuỳ chọn)<input name="note" /></label>
          <button type="submit" class="btn btn--amber">Thanh toán ${fmtVnd(total)}</button>
          <button type="button" class="btn btn--line" data-back>Quay lại</button>
        </form>
        <p class="form-msg" data-form-msg role="status"></p>
      </div>`;
    root.querySelector("[data-back]")?.addEventListener("click", () => {
      const u = new URL(location.href);
      u.searchParams.delete("type");
      history.replaceState({}, "", u);
      renderChooser(root, course);
    });
    root.querySelector("[data-hard-form]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const shipPayload = {
        full_name: String(fd.get("full_name") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        address: String(fd.get("address") || "").trim(),
        province: String(fd.get("province") || "").trim(),
        note: String(fd.get("note") || "").trim(),
      };
      const msg = root.querySelector("[data-form-msg]");
      try {
        await startBuy(course, "cert_hard", shipPayload);
      } catch (err) {
        if (msg) msg.textContent = err.message || String(err);
      }
    });
  }

  function renderPay(root, order, course, type) {
    const amount = order.amount;
    const code = order.order_code;
    const shipLine =
      type === "cert_hard" && order.shipping_fee
        ? `<p class="meta">Sản phẩm ${fmtVnd(order.product_amount || prices.cert_hard)} + ship ${fmtVnd(order.shipping_fee)}</p>`
        : "";
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong>${esc(LABELS[type] || type)}</strong>
          <span>${esc(course)} · ${fmtVnd(amount)}</span>
        </div>
        ${shipLine}
        <p class="checkout-lead">Chuyển khoản đúng số tiền và nội dung <code>${esc(code)}</code>. Hệ thống tự xác nhận qua SePay.</p>
        <figure class="qr">
          <img src="${vietQrUrl(amount, code)}" width="280" height="280" alt="VietQR thanh toán GCN" />
        </figure>
        <p class="meta">Nội dung: <code>${esc(code)}</code> · ${esc(BANK.owner)} · ${esc(BANK.account)} (${esc(BANK.name)})</p>
        <p class="form-msg" data-status role="status">Đang chờ thanh toán…</p>
        <p><a class="btn btn--line" href="./">Quay lại chứng nhận của tôi</a></p>
      </div>`;

    stopPoll();
    pollTimer = setInterval(async () => {
      try {
        const sb = await sa247Auth.ensureClient();
        const { data } = await sb
          .from("orders")
          .select("order_code,status,amount,paid_at,product_type")
          .eq("order_code", code)
          .maybeSingle();
        if (data?.status === "paid") {
          stopPoll();
          const mine = await sb.rpc("list_my_certificates");
          const hit = (mine.data || []).find(
            (c) => c.course_code === course && c.status === "issued"
          );
          const viewHref = hit?.cert_code
            ? `../verify/chung-nhan.html?code=${encodeURIComponent(hit.cert_code)}`
            : "./";
          root.innerHTML = `
            <div class="checkout-panel checkout-panel--paid">
              <h2>Đã nhận thanh toán GCN</h2>
              <p class="checkout-lead">Giấy chứng nhận đã được cấp. Bạn có thể xem, in / lưu PDF và xác minh công khai.</p>
              <div class="contact__cta">
                <a class="btn btn--amber" href="${viewHref}">Xem giấy chứng nhận</a>
                <a class="btn btn--line" href="./">Chứng nhận của tôi</a>
              </div>
            </div>`;
        }
      } catch (e) {
        const st = root.querySelector("[data-status]");
        if (st) st.textContent = e.message || String(e);
      }
    }, 4000);
  }

  async function startBuy(course, type, ship) {
    const root = el("cert-buy-root");
    const status = el("cert-buy-status");
    if (status) status.textContent = "Đang tạo đơn đăng ký GCN…";
    try {
      const sb = await sa247Auth.ensureClient();
      const args = {
        p_course_code: course,
        p_product_type: type,
      };
      if (type === "cert_hard") {
        if (!ship) {
          renderHardForm(root, course);
          return;
        }
        args.p_ship = ship;
      }
      const { data, error } = await sb.rpc("create_cert_order", args);
      if (error) throw error;
      const order = Array.isArray(data) ? data[0] : data;
      if (status) status.textContent = LABELS[type] || "Thanh toán GCN";
      renderPay(root, order, course, type);
    } catch (e) {
      const msg = e.message || String(e);
      if (/NOT_ELIGIBLE|SHIP_ADDRESS|ship|địa chỉ/i.test(msg) && type === "cert_hard") {
        if (status) status.textContent = msg;
        renderHardForm(root, course);
        return;
      }
      if (status) {
        if (/NOT_ELIGIBLE/i.test(msg)) {
          status.innerHTML =
            'Bạn chưa đạt kỳ thi cuối khóa. <a href="../quiz/?course=' +
            encodeURIComponent(course) +
            '">Làm kỳ thi</a>';
        } else if (/CERT_ALREADY_ISSUED/i.test(msg)) {
          status.innerHTML =
            'Bạn đã có GCN. <a href="./">Xem chứng nhận của tôi</a>';
        } else if (/not_enrolled|NOT_ENROLLED/i.test(msg)) {
          status.innerHTML =
            'Bạn chưa đăng ký khóa học. <a href="../dashboard/">Vào Học tập</a>';
        } else {
          status.textContent = msg;
        }
      }
      if (type !== "cert_hard") root.innerHTML = "";
      throw e;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const status = el("cert-buy-status");
    const root = el("cert-buy-root");
    if (!window.sa247Auth?.ready) {
      status.innerHTML = '<a href="../auth/login.html">Đăng nhập</a> để đăng ký GCN.';
      return;
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      status.innerHTML =
        'Cần đăng nhập. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    el("user-label").textContent = session.user.email || "Học viên";
    await loadPrices();

    const { course, type } = params();
    if (!course) {
      status.textContent = "Chọn khóa từ trang Chứng nhận của tôi hoặc sau khi đạt kỳ thi.";
      root.innerHTML = `<p><a class="btn btn--amber" href="./">Chứng nhận của tôi</a> <a class="btn btn--line" href="../quiz/">Kỳ thi</a></p>`;
      return;
    }

    if (type === "cert_hard") {
      status.textContent = course;
      renderHardForm(root, course);
    } else if (type === "cert_pdf") {
      status.textContent = course;
      await startBuy(course, type, null);
    } else {
      status.textContent = course;
      renderChooser(root, course);
    }
  });
})();
