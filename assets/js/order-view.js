/* SA247 — xem / xác nhận / thanh toán đơn qua link bí mật (?t=token). Một trang cho mọi nguồn tạo đơn. */
(function () {
  let BANK = null;
  let pollTimer = null;

  function fmt(n) {
    return Number(n || 0).toLocaleString("vi-VN") + "đ";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function vietQrUrl(amount, info) {
    const base = `https://img.vietqr.io/image/${encodeURIComponent(BANK.bin)}-${encodeURIComponent(BANK.account)}-compact2.png`;
    const q = new URLSearchParams({ amount: String(amount), addInfo: String(info), accountName: BANK.owner });
    return `${base}?${q.toString()}`;
  }

  const STATUS = {
    draft: "Chờ bạn xác nhận",
    pending: "Chờ thanh toán",
    paid: "Đã thanh toán",
    expired: "Hết hạn",
    cancelled: "Đã hủy",
    failed: "Thanh toán không thành công",
  };

  function linesHtml(o) {
    const items = o.items || [];
    const group = (codes) => items.filter((i) => codes.includes(i.product_code));
    const row = (i, label) => `<tr>
        <td>${label}</td>
        <td class="num">${
          i.discount_amount > 0
            ? `<s>${fmt(i.unit_price)}</s><br/><small>−${Number(i.discount_percent)}%</small>`
            : fmt(i.unit_price)
        }</td>
        <td class="num"><b>${fmt(i.line_total)}</b></td>
      </tr>`;
    const courses = group(["course"]);
    const certs = group(["cert_pdf", "cert_hard"]);
    const ship = group(["shipping"]);
    const sum = (arr) => arr.reduce((s, i) => s + Number(i.line_total || 0), 0);
    let html = `<table class="order-lines"><thead><tr><th>Khóa học</th><th class="num">Giá</th><th class="num">Thành tiền</th></tr></thead><tbody>
      ${courses.map((i) => row(i, `<b>${esc(i.course_code)}</b> · ${esc(i.course_title || "")}`)).join("")}
      <tr class="order-lines__sub"><td colspan="2">Cộng khóa học</td><td class="num">${fmt(sum(courses))}</td></tr>`;
    if (certs.length) {
      html += `<tr class="order-lines__head"><th colspan="3">Đăng ký nhận giấy chứng nhận</th></tr>
        ${certs
          .map((i) =>
            row(i, `${esc(i.course_code)} · ${i.product_code === "cert_hard" ? "Bản cứng" : "PDF"} <small>· chờ đủ điều kiện</small>`)
          )
          .join("")}
        <tr class="order-lines__sub"><td colspan="2">Cộng phí cấp giấy chứng nhận</td><td class="num">${fmt(sum(certs))}</td></tr>`;
    }
    if (ship.length) {
      html += ship.map((i) => `<tr><td colspan="2">Phí vận chuyển (mỗi đơn)</td><td class="num">${fmt(i.line_total)}</td></tr>`).join("");
    }
    if (o.override) {
      const policy = sum(items);
      if (policy !== Number(o.amount)) {
        html += `<tr><td colspan="2">Điều chỉnh theo thỏa thuận với SA247</td><td class="num">${fmt(Number(o.amount) - policy)}</td></tr>`;
      }
    }
    html += `</tbody></table>
      <p class="cart-total"><span>Tổng thanh toán</span><strong>${fmt(o.amount)}</strong></p>
      ${o.discount_amount > 0 ? `<p class="meta">Giá gốc ${fmt(o.list_amount)} · bạn tiết kiệm ${fmt(o.discount_amount)}.</p>` : ""}`;
    if (certs.length) {
      html += `<p class="checkout-cert__note">Giấy chứng nhận được cấp tự động khi bạn hoàn thành khóa học và đạt yêu cầu kiểm tra — không cần tạo đơn mới.</p>`;
    }
    return html;
  }

  function payHtml(o) {
    return `<div class="checkout-pay">
        <div class="checkout-pay-qr">
          <p class="checkout-scan-label">Quét mã để thanh toán</p>
          <img src="${vietQrUrl(o.amount, o.payment_code)}" alt="Mã QR thanh toán ${esc(o.payment_code)}" width="280" height="280" />
          <p class="checkout-pay-amount">${fmt(o.amount)}</p>
        </div>
        <div class="checkout-pay-details">
          <p class="checkout-memo-label">Nội dung chuyển khoản</p>
          <div class="checkout-memo">
            <code class="checkout-code">${esc(o.payment_code)}</code>
            <button type="button" class="btn btn--line btn--small" data-copy="${esc(o.payment_code)}">Sao chép</button>
          </div>
          <ul class="checkout-bank">
            <li><span>Ngân hàng</span><strong>${esc(BANK.name)}</strong></li>
            <li><span>Chủ tài khoản</span><strong>${esc(BANK.owner)}</strong></li>
            <li><span>Số tài khoản</span><strong>${esc(BANK.account)}</strong></li>
            <li><span>Số tiền</span><strong>${fmt(o.amount)}</strong></li>
          </ul>
        </div>
      </div>
      <p class="checkout-wait" data-status role="status"><strong>Đang chờ xác nhận thanh toán…</strong><br/>Hệ thống tự kiểm tra giao dịch — giữ trang này mở.</p>`;
  }

  function paidHtml(o) {
    return `<div class="checkout-panel checkout-panel--paid">
        <p class="checkout-pay-kicker">Đã nhận thanh toán</p>
        <p class="checkout-lead">Các khóa học trong đơn đã được mở cho <code>${esc(o.buyer_email_masked)}</code>.</p>
        <p class="checkout-hint">${
          o.has_account
            ? "Đăng nhập tài khoản SA247 để bắt đầu học."
            : "Kiểm tra email để thiết lập mật khẩu và kích hoạt tài khoản học tập."
        }</p>
        <div class="contact__cta">
          <a class="btn btn--amber" href="/auth/login.html?next=${encodeURIComponent(location.origin + "/dashboard/")}">Đăng nhập để học</a>
          <a class="btn btn--line" href="/dashboard/">Vào Học tập</a>
        </div>
      </div>`;
  }

  function render(root, o, token) {
    const sent = o.order_source === "SALE_TAO" || o.order_source === "ADMIN_TAO";
    let action = "";
    if (o.status === "draft") {
      action = `<div class="checkout-panel">
          <p class="checkout-lead">Vui lòng kiểm tra các khóa học, lựa chọn giấy chứng nhận và tổng tiền. Nếu cần đổi, trả lời SA247 qua kênh đang trao đổi.</p>
          <button type="button" class="btn btn--amber" data-confirm>Xác nhận đơn hàng &amp; thanh toán</button>
          <p class="form-msg" data-msg role="status"></p>
        </div>`;
    } else if (o.status === "pending") {
      action = o.payment_flag === "amount_mismatch"
        ? `<p class="form-msg">Hệ thống thấy chuyển khoản không đúng số tiền. Khóa học chưa được mở — liên hệ hỗ trợ kèm mã đơn.</p>`
        : `<div class="checkout-panel checkout-panel--pay"><p class="checkout-pay-kicker">Thanh toán chuyển khoản</p>
           <p class="checkout-lead">Chuyển khoản <b>đúng số tiền</b> và <b>đúng nội dung</b>. Sau khi xác nhận, hệ thống tự mở các khóa học trong đơn.</p>
           ${payHtml(o)}</div>`;
    } else if (o.status === "paid") {
      action = paidHtml(o);
    } else {
      action = `<div class="checkout-panel"><p class="form-msg">${
        o.status === "expired" ? "Đơn đã hết hạn chờ thanh toán (quá 48 giờ)." : "Đơn không còn hiệu lực."
      } Khóa học chưa được mở.</p>
        <a class="btn btn--amber" href="/gio-hang/">Tạo đơn mới</a></div>`;
    }

    root.innerHTML = `
      <p class="kicker">${sent ? "SA247 gửi bạn đơn hàng" : "Đơn hàng của bạn"}</p>
      <h1 class="title">Đơn ${esc(o.order_code)}</h1>
      <p class="order-status order-status--${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</p>
      ${o.buyer_name ? `<p class="meta">Người học: <b>${esc(o.buyer_name)}</b> · ${esc(o.buyer_email_masked)}</p>` : ""}
      <div class="cart-grid">
        <section class="cart-card cart-main">${linesHtml(o)}</section>
        <aside class="cart-side">${action}</aside>
      </div>`;

    root.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(e.currentTarget.getAttribute("data-copy"));
        e.currentTarget.textContent = "Đã sao chép";
      } catch {
        e.currentTarget.textContent = "Sao chép thủ công";
      }
    });

    root.querySelector("[data-confirm]")?.addEventListener("click", async () => {
      const msg = root.querySelector("[data-msg]");
      if (msg) msg.textContent = "Đang xác nhận…";
      const sb = await sa247Auth.ensureClient();
      const { error } = await sb.rpc("confirm_order_by_token", { p_token: token });
      if (error) {
        if (msg) msg.textContent = error.message;
        return;
      }
      load(root, token);
    });

    if (o.status === "pending" && !pollTimer) {
      let ticks = 0;
      pollTimer = setInterval(async () => {
        ticks += 1;
        if (ticks > 180) {
          clearInterval(pollTimer);
          return;
        }
        try {
          const sb = await sa247Auth.ensureClient();
          const { data } = await sb.rpc("get_order_by_token", { p_token: token });
          if (data?.found && data.status !== "pending") {
            clearInterval(pollTimer);
            pollTimer = null;
            render(root, data, token);
          }
        } catch (_) {}
      }, 5000);
    }
  }

  async function load(root, token) {
    if (!window.sa247Auth?.ready) {
      root.innerHTML = `<p class="form-msg">Chưa kết nối được hệ thống. Tải lại trang.</p>`;
      return;
    }
    const sb = await sa247Auth.ensureClient();
    const [{ data, error }, bank] = await Promise.all([
      sb.rpc("get_order_by_token", { p_token: token }),
      window.sa247PublicConfig?.bank() ?? null,
    ]);
    BANK = bank;
    if (!error && data?.status === "pending" && !BANK) {
      root.innerHTML = `<p class="form-msg">Chưa tải được thông tin tài khoản nhận thanh toán. Tải lại trang hoặc liên hệ support@sa247.vn kèm mã đơn.</p>`;
      return;
    }
    if (error || !data?.found) {
      root.innerHTML = `<h1 class="title">Không tìm thấy đơn hàng</h1>
        <p>Link đơn hàng không đúng hoặc đã bị thay đổi. Liên hệ SA247 để được gửi lại link.</p>`;
      return;
    }
    render(root, data, token);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("order-root");
    const token = new URL(location.href).searchParams.get("t") || "";
    load(root, token);
  });
})();
