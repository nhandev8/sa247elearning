/* SA247 — khối đăng ký trên trang khóa học: thêm vào danh sách học (giỏ) → /gio-hang/ → đơn hàng. */
(function () {
  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function offerNoteHtml(root) {
    const href = root.getAttribute("data-policy-href") || "/chinh-sach-gia/";
    return `<p class="checkout-offer">🎁 <b>Ưu đãi khi học nhiều khóa</b> · Tối đa 20% khi đăng ký 8–10 khóa.
      <a href="${esc(href)}">Xem chính sách ưu đãi</a></p>`;
  }

  function renderOwned(root, courseCode) {
    root.innerHTML = `
      <div class="checkout-panel checkout-panel--paid">
        <p class="checkout-pay-kicker">Khóa học của bạn</p>
        <p class="checkout-lead">Bạn đã có quyền học <b>${esc(courseCode)}</b>.</p>
        <div class="contact__cta">
          <a class="btn btn--amber" href="/dashboard/">Vào học</a>
          <a class="btn btn--line" href="/khoa-cua-toi/">Khóa của tôi</a>
        </div>
      </div>`;
  }

  function renderCartStart(root, courseCode, priceLabel, pending) {
    const inCart = window.sa247Cart?.has(courseCode);
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong>Đăng ký khóa học · ${esc(priceLabel)}</strong>
          <span>Phí tham gia khóa · ${esc(courseCode)} · tiến độ + kiểm tra</span>
        </div>
        ${offerNoteHtml(root)}
        <p class="checkout-lead">
          Chọn một hoặc nhiều khóa vào danh sách học, rồi thanh toán một lần.
          Đăng ký nhận giấy chứng nhận (không bắt buộc) chọn ở bước xác nhận đơn.
        </p>
        ${
          pending
            ? `<p class="checkout-email-note">Bạn có đơn <code>${esc(pending.order_code)}</code> đang chờ thanh toán.
               <a href="/don-hang/xem.html?t=${esc(pending.view_token)}">Xem đơn &amp; thanh toán</a></p>`
            : ""
        }
        <div class="contact__cta">
          <button type="button" class="btn btn--amber" data-cart-add="${esc(courseCode)}" data-cart-go>Đăng ký ngay</button>
          <button type="button" class="btn btn--line" data-cart-add="${esc(courseCode)}">${
            inCart ? "✓ Đã có trong danh sách học" : "+ Thêm vào danh sách học"
          }</button>
        </div>
      </div>`;
  }

  async function mount(selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    const courseCode = root.getAttribute("data-course-code");
    if (!courseCode) return;

    let priceLabel = "99.000đ";
    let pending = null;
    try {
      if (window.sa247Auth?.ready) {
        const sb = await sa247Auth.ensureClient();
        const { data: c } = await sb.from("courses").select("price").eq("code", courseCode).maybeSingle();
        if (c?.price) priceLabel = fmtVnd(c.price);
        const session = await sa247Auth.getSession();
        if (session) {
          if (await sa247Auth.hasCourseAccess(null, { courseCode })) {
            renderOwned(root, courseCode);
            return;
          }
          const { data: open } = await sb
            .from("orders")
            .select("order_code,view_token,status,items:order_items!inner(course:courses!inner(code))")
            .in("status", ["pending", "draft"])
            .not("view_token", "is", null)
            .eq("items.course.code", courseCode)
            .order("created_at", { ascending: false })
            .limit(1);
          pending = open?.[0] || null;
        }
      }
    } catch (e) {
      console.warn("[checkout]", e);
    }
    renderCartStart(root, courseCode, priceLabel, pending);
  }

  window.sa247Checkout = { mount };
  document.addEventListener("DOMContentLoaded", () => {
    mount("#checkout-root");
  });
})();
