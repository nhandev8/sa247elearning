/* SA247 checkout — guest form → confirm → VietQR; login path for returning. */
(function () {
  const BANK = window.SA247_BANK || {
    name: "VPBank",
    owner: "HO HUU NHAN",
    account: "0877787988",
    bin: "VPB",
  };

  let pollTimer = null;
  let guestEmail = "";

  function vietQrUrl(amount, addInfo) {
    const base = `https://img.vietqr.io/image/${encodeURIComponent(BANK.bin)}-${encodeURIComponent(BANK.account)}-compact2.png`;
    const q = new URLSearchParams({
      amount: String(amount),
      addInfo: String(addInfo),
      accountName: BANK.owner,
    });
    return `${base}?${q.toString()}`;
  }

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeOrder(data) {
    const order = Array.isArray(data) ? data[0] : data;
    if (!order || !order.order_code || order.amount == null) {
      throw new Error("Không nhận được mã đơn từ server. Thử lại hoặc tải lại trang.");
    }
    return order;
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function loginHref(root) {
    return root.getAttribute("data-login-href") || "../auth/login.html";
  }

  function activateHref(root) {
    const base = root.getAttribute("data-activate-href") || "../auth/doi-mat-khau.html";
    return `${base}?recovery=1&activate=1`;
  }

  async function createGuestOrder(courseCode, fields) {
    if (!window.sa247Auth?.ready) {
      throw new Error("Chưa cấu hình Supabase.");
    }
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("create_guest_order", {
      p_course_code: courseCode,
      p_full_name: fields.fullName,
      p_email: fields.email,
      p_phone: fields.phone,
      p_terms_accepted: fields.terms,
    });
    if (error) throw new Error(error.message);
    return normalizeOrder(data);
  }

  async function createAuthedOrder(courseCode) {
    if (!window.sa247Auth?.ready) {
      throw new Error("Chưa cấu hình Supabase.");
    }
    const session = await sa247Auth.getSession();
    if (!session) throw new Error("LOGIN_REQUIRED");
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("create_course_order", {
      p_course_code: courseCode,
    });
    if (error) throw new Error(error.message);
    return normalizeOrder(data);
  }

  function renderPaid(root, order, courseCode, opts) {
    stopPoll();
    const email = esc(opts?.email || guestEmail || "");
    const needActivate = !!opts?.guest;
    root.innerHTML = `
      <div class="checkout-panel checkout-panel--paid">
        <div class="price-tag">
          <strong>Thanh toán thành công</strong>
          <span>${esc(courseCode)} · đơn ${esc(order.order_code || "")}</span>
        </div>
        <p class="checkout-lead">
          Khóa học <b>${esc(courseCode)}</b> đã được mở cho tài khoản học tập SA247.
          ${email ? `<br/>Email: <code>${email}</code>` : ""}
        </p>
        ${
          needActivate
            ? `<p class="form-note">Chúng tôi đã gửi email thiết lập mật khẩu tới địa chỉ trên. Không có mật khẩu mặc định.</p>
               <div class="contact__cta">
                 <a class="btn btn--amber" href="${esc(activateHref(root))}">Kích hoạt tài khoản &amp; bắt đầu học</a>
                 <a class="btn btn--line" href="../dashboard/">Vào Dashboard</a>
               </div>`
            : `<div class="contact__cta">
                 <a class="btn btn--amber" href="../dashboard/">Bắt đầu học</a>
                 <a class="btn btn--line" href="#hoc-thu">Xem bài học</a>
               </div>`
        }
      </div>`;
  }

  async function pollGuestStatus(orderCode, email) {
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("get_order_public_status", {
      p_order_code: orderCode,
      p_email: email,
    });
    if (error) throw error;
    return data;
  }

  function startPoll(root, order, courseCode, mode) {
    stopPoll();
    const statusEl = () => root.querySelector("[data-status]");
    let ticks = 0;
    pollTimer = setInterval(async () => {
      ticks += 1;
      if (ticks > 120) {
        stopPoll();
        const el = statusEl();
        if (el) {
          el.innerHTML =
            `Vẫn chờ xác nhận CK cho <code>${esc(order.order_code)}</code>. ` +
            `Nếu đã CK, kiểm tra email kích hoạt hoặc liên hệ hỗ trợ.`;
        }
        return;
      }
      try {
        if (mode === "guest") {
          const st = await pollGuestStatus(order.order_code, guestEmail);
          if (st?.found && st.status === "paid") {
            renderPaid(root, { ...order, status: "paid" }, courseCode, {
              guest: true,
              email: guestEmail,
            });
            return;
          }
        } else {
          const sb = await sa247Auth.ensureClient();
          const { data } = await sb
            .from("orders")
            .select("order_code,status,amount,paid_at")
            .eq("order_code", order.order_code)
            .maybeSingle();
          if (data?.status === "paid") {
            renderPaid(root, data, courseCode, { guest: false });
            return;
          }
        }
        const el = statusEl();
        if (el) {
          el.textContent = `Đơn ${order.order_code} đang chờ thanh toán… (tự kiểm tra)`;
        }
      } catch (e) {
        console.warn("[checkout poll]", e);
      }
    }, 5000);
  }

  function renderCheckout(root, order, courseCode, mode) {
    if (order.status === "paid") {
      renderPaid(root, order, courseCode, { guest: mode === "guest", email: guestEmail });
      return;
    }
    const amount = order.amount;
    const code = order.order_code;
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong>${fmtVnd(amount)}</strong>
          <span>1 khóa · ${esc(courseCode)} · thanh toán 1 lần</span>
        </div>
        <p class="checkout-lead">Chuyển khoản đúng <b>số tiền</b> và <b>nội dung</b> bên dưới. Sau khi SePay xác nhận, hệ thống mở khóa và ${
          mode === "guest"
            ? "gửi email thiết lập mật khẩu (không có mật khẩu mặc định)."
            : "cấp quyền học cho tài khoản của bạn."
        }</p>
        <div class="checkout-grid">
          <div class="checkout-qr">
            <img src="${vietQrUrl(amount, code)}" alt="VietQR ${esc(code)}" width="280" height="280" />
          </div>
          <dl class="checkout-meta">
            <div><dt>Ngân hàng</dt><dd>${esc(BANK.name)}</dd></div>
            <div><dt>Chủ tài khoản</dt><dd>${esc(BANK.owner)}</dd></div>
            <div><dt>Số tài khoản</dt><dd><code>${esc(BANK.account)}</code></dd></div>
            <div><dt>Số tiền</dt><dd><code>${fmtVnd(amount)}</code></dd></div>
            <div><dt>Nội dung CK</dt><dd><code class="checkout-code">${esc(code)}</code>
              <button type="button" class="btn btn--line btn--small" data-copy="${esc(code)}">Copy</button>
            </dd></div>
          </dl>
        </div>
        <p class="form-msg" data-status role="status">Đơn <code>${esc(code)}</code> đang chờ thanh toán…</p>
      </div>`;
    root.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
      const v = e.currentTarget.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(v);
        e.currentTarget.textContent = "Đã copy";
      } catch {
        e.currentTarget.textContent = "Copy thủ công";
      }
    });
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    startPoll(root, order, courseCode, mode);
  }

  function renderConfirm(root, courseCode, fields) {
    root.innerHTML = `
      <div class="checkout-panel">
        <p class="kicker">Vui lòng kiểm tra thông tin nhận tài khoản</p>
        <h3 class="checkout-confirm-title">Xác nhận trước khi thanh toán</h3>
        <dl class="checkout-meta checkout-confirm">
          <div><dt>Họ và tên</dt><dd>${esc(fields.fullName)}</dd></div>
          <div><dt>Email</dt><dd><code>${esc(fields.email)}</code></dd></div>
          <div><dt>Số điện thoại</dt><dd>${esc(fields.phone)}</dd></div>
        </dl>
        <p class="form-note">
          Email này sẽ được dùng để <b>tạo tài khoản học tập SA247</b> và nhận thông tin khóa học.
          Không có mật khẩu mặc định — sau thanh toán bạn sẽ nhận link thiết lập mật khẩu.
        </p>
        <div class="contact__cta">
          <button type="button" class="btn btn--amber" data-confirm-pay>Xác nhận &amp; thanh toán</button>
          <button type="button" class="btn btn--line" data-back-form>Sửa thông tin</button>
        </div>
        <p class="form-msg" data-msg role="status"></p>
      </div>`;

    root.querySelector("[data-back-form]")?.addEventListener("click", () => {
      renderGuestForm(root, courseCode, fields);
    });

    root.querySelector("[data-confirm-pay]")?.addEventListener("click", async () => {
      const msg = root.querySelector("[data-msg]");
      if (msg) msg.textContent = "Đang tạo mã thanh toán…";
      try {
        guestEmail = fields.email.trim().toLowerCase();
        const order = await createGuestOrder(courseCode, fields);
        renderCheckout(root, order, courseCode, "guest");
      } catch (err) {
        const raw = err.message || "Không tạo được đơn.";
        if (/EMAIL_EXISTS_LOGIN/i.test(raw)) {
          const login = loginHref(root);
          const next = encodeURIComponent(location.href);
          if (msg) {
            msg.innerHTML =
              `Email này đã có tài khoản. ` +
              `<a href="${esc(login)}?next=${next}">Đăng nhập</a> rồi tạo mã thanh toán.`;
          }
          return;
        }
        if (msg) msg.textContent = friendlyError(raw);
      }
    });
  }

  function friendlyError(raw) {
    if (/TERMS_REQUIRED/i.test(raw)) return "Bạn cần đồng ý điều khoản.";
    if (/EMAIL_INVALID/i.test(raw)) return "Email không hợp lệ.";
    if (/NAME_REQUIRED/i.test(raw)) return "Vui lòng nhập họ và tên.";
    if (/PHONE_REQUIRED/i.test(raw)) return "Vui lòng nhập số điện thoại.";
    if (/already enrolled/i.test(raw)) return "Bạn đã mở khóa khóa học này rồi.";
    return raw;
  }

  function renderGuestForm(root, courseCode, prefills) {
    const p = prefills || {};
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong data-price-label>Mở khóa khóa học</strong>
          <span>1 khóa · ${esc(courseCode)} · thanh toán 1 lần</span>
        </div>
        <p class="checkout-lead">
          Chỉ cần họ tên, email và SĐT. Hệ thống tạo tài khoản sau khi thanh toán thành công —
          <b>không dùng mật khẩu mặc định</b>.
        </p>
        <form class="order-form checkout-buyer-form" data-buyer-form>
          <label>Họ và tên
            <input name="fullName" type="text" required minlength="2" autocomplete="name" value="${esc(p.fullName || "")}" />
          </label>
          <label>Email (dùng để đăng nhập)
            <input name="email" type="email" required autocomplete="email" value="${esc(p.email || "")}" />
          </label>
          <label>Số điện thoại
            <input name="phone" type="tel" required minlength="8" autocomplete="tel" value="${esc(p.phone || "")}" />
          </label>
          <label class="checkout-terms">
            <input name="terms" type="checkbox" ${p.terms ? "checked" : ""} required />
            <span>Tôi đồng ý <a href="../privacy/" target="_blank" rel="noopener">điều khoản &amp; chính sách</a> SA247.</span>
          </label>
          <div class="contact__cta">
            <button type="submit" class="btn btn--amber">Tiếp tục thanh toán</button>
            <a class="btn btn--line" href="${esc(loginHref(root))}">Đã có tài khoản · Đăng nhập</a>
          </div>
          <p class="form-msg" data-msg role="status"></p>
        </form>
      </div>`;

    root.querySelector("[data-buyer-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fields = {
        fullName: String(fd.get("fullName") || "").trim(),
        email: String(fd.get("email") || "").trim().toLowerCase(),
        phone: String(fd.get("phone") || "").trim(),
        terms: !!fd.get("terms"),
      };
      const msg = root.querySelector("[data-msg]");
      if (!fields.terms) {
        if (msg) msg.textContent = "Bạn cần đồng ý điều khoản.";
        return;
      }
      renderConfirm(root, courseCode, fields);
    });
  }

  function renderAuthedStart(root, courseCode) {
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong>Tạo mã thanh toán</strong>
          <span>1 khóa · ${esc(courseCode)} · đã đăng nhập</span>
        </div>
        <p class="checkout-lead">Bạn đã đăng nhập. Tạo mã VietQR để mở khóa khóa học này.</p>
        <div class="contact__cta">
          <button type="button" class="btn btn--amber" data-create-order>Tạo mã thanh toán</button>
          <a class="btn btn--line" href="../dashboard/">Dashboard</a>
        </div>
        <p class="form-msg" data-msg role="status"></p>
      </div>`;
    root.querySelector("[data-create-order]")?.addEventListener("click", async () => {
      const msg = root.querySelector("[data-msg]");
      if (msg) msg.textContent = "Đang tạo mã thanh toán…";
      try {
        const order = await createAuthedOrder(courseCode);
        renderCheckout(root, order, courseCode, "authed");
      } catch (err) {
        if (msg) msg.textContent = friendlyError(err.message || "Không tạo được đơn.");
      }
    });
  }

  async function mount(selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    const courseCode = root.getAttribute("data-course-code");
    if (!courseCode) return;

    try {
      if (window.sa247Auth?.ready) {
        const session = await sa247Auth.getSession();
        if (session) {
          const sb = await sa247Auth.ensureClient();
          const { data: enrolled } = await sb
            .from("enrollments")
            .select("id, course:courses!inner(code)")
            .eq("status", "active")
            .eq("courses.code", courseCode)
            .maybeSingle();
          if (enrolled) {
            renderPaid(root, { order_code: courseCode, status: "paid" }, courseCode, {
              guest: false,
            });
            return;
          }
          const { data: openOrders } = await sb
            .from("orders")
            .select("order_code,status,amount,paid_at,course:courses!inner(code)")
            .eq("status", "pending")
            .eq("courses.code", courseCode)
            .order("created_at", { ascending: false })
            .limit(1);
          if (openOrders?.[0]) {
            renderCheckout(root, openOrders[0], courseCode, "authed");
            return;
          }
          renderAuthedStart(root, courseCode);
          return;
        }
      }
    } catch (e) {
      console.warn("[checkout hydrate]", e);
    }

    renderGuestForm(root, courseCode);
  }

  window.sa247Checkout = {
    createGuestOrder,
    createAuthedOrder,
    mount,
    vietQrUrl,
  };
  document.addEventListener("DOMContentLoaded", () => {
    mount("#checkout-root");
  });
})();
