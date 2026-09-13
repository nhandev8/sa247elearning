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
  let guestAccountExisted = false;

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
    const returning = !!(opts?.returning ?? guestAccountExisted);
    const isGuest = opts?.guest !== false && (opts?.guest || !!guestEmail);
    const needActivate = isGuest && !returning;
    const needLogin = isGuest && returning;
    const code = esc(order.order_code || courseCode);

    const stages = needActivate
      ? ["Đã nhận thanh toán", "Đang tạo tài khoản học tập…", "Đã mở khóa khóa học"]
      : needLogin
        ? ["Đã nhận thanh toán", "Đang thêm khóa vào tài khoản…", "Đã mở khóa khóa học"]
        : ["Đã nhận thanh toán", "Đã mở khóa khóa học"];

    root.innerHTML = `
      <div class="checkout-panel checkout-panel--paid" data-paid-flow>
        <p class="checkout-pay-kicker">Thanh toán chuyển khoản</p>
        <p class="checkout-stage" data-stage role="status">${esc(stages[0])}</p>
        <div class="checkout-paid-body" data-paid-body hidden></div>
      </div>`;

    const stageEl = root.querySelector("[data-stage]");
    const bodyEl = root.querySelector("[data-paid-body]");
    let i = 0;

    function showFinal() {
      if (stageEl) stageEl.textContent = stages[stages.length - 1];
      if (!bodyEl) return;
      bodyEl.hidden = false;
      const login = loginHref(root);
      const next = encodeURIComponent(
        new URL("../dashboard/", location.href).href
      );
      bodyEl.innerHTML = `
        <p class="checkout-lead">
          ${
            needLogin
              ? `Khóa học <b>${esc(courseCode)}</b> đã được thêm vào tài khoản ${email ? `<code>${email}</code>` : "của bạn"}.`
              : `Khóa học <b>${esc(courseCode)}</b> đã được mở${email ? ` cho <code>${email}</code>` : ""}.`
          }
        </p>
        ${
          needActivate
            ? `<p class="checkout-hint">Chúng tôi đã gửi email thiết lập mật khẩu tới địa chỉ trên.</p>
               <div class="contact__cta">
                 <a class="btn btn--amber" href="${esc(activateHref(root))}">Kích hoạt tài khoản &amp; bắt đầu học</a>
                 <a class="btn btn--line" href="../dashboard/">Vào khóa học của tôi</a>
               </div>`
            : needLogin
              ? `<p class="checkout-hint">Để bắt đầu học, vui lòng đăng nhập tài khoản SA247.</p>
                 <div class="contact__cta">
                   <a class="btn btn--amber" href="${esc(login)}?next=${next}">Đăng nhập để học</a>
                   <a class="btn btn--line" href="../dashboard/">Đã đăng nhập · Vào khóa học</a>
                 </div>`
              : `<div class="contact__cta">
                   <a class="btn btn--amber" href="../dashboard/">Bắt đầu học</a>
                   <a class="btn btn--line" href="#hoc-thu">Xem bài học</a>
                 </div>`
        }
        <p class="checkout-order-ref">Đơn <code>${code}</code></p>`;
    }

    function tick() {
      i += 1;
      if (i >= stages.length - 1) {
        showFinal();
        return;
      }
      if (stageEl) stageEl.textContent = stages[i];
      setTimeout(tick, 900);
    }

    setTimeout(tick, 700);
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
            `Đơn <code>${esc(order.order_code)}</code> vẫn đang chờ xác nhận. ` +
            `Nếu bạn đã chuyển khoản, vui lòng giữ trang này hoặc liên hệ hỗ trợ.`;
        }
        return;
      }
      try {
        if (mode === "guest") {
          const st = await pollGuestStatus(order.order_code, guestEmail);
          if (st?.found && st.status === "paid") {
            guestAccountExisted = !!st.buyer_account_existed;
            renderPaid(root, { ...order, status: "paid" }, courseCode, {
              guest: true,
              returning: guestAccountExisted,
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
          el.innerHTML =
            `<strong>Đang chờ xác nhận thanh toán…</strong><br/>` +
            `Đơn <code>${esc(order.order_code)}</code> · hệ thống tự kiểm tra giao dịch.`;
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
    const guestHint = guestAccountExisted
      ? "khóa học sẽ được thêm vào tài khoản gắn với email này."
      : "khóa học sẽ được mở và hệ thống gửi email để bạn thiết lập mật khẩu.";
    const leadExtra =
      mode === "guest"
        ? guestHint
        : "khóa học sẽ được mở tự động cho tài khoản của bạn.";

    root.innerHTML = `
      <div class="checkout-panel checkout-panel--pay">
        <p class="checkout-pay-kicker">Thanh toán chuyển khoản</p>
        <p class="checkout-lead">
          Chuyển khoản <b>đúng số tiền</b> và <b>đúng nội dung</b> bên dưới.
          Sau khi xác nhận, ${leadExtra}
        </p>

        <div class="checkout-pay">
          <div class="checkout-pay-qr">
            <p class="checkout-scan-label">Quét mã để thanh toán</p>
            <img src="${vietQrUrl(amount, code)}" alt="Mã QR thanh toán ${esc(code)}" width="280" height="280" />
            <p class="checkout-pay-amount">${fmtVnd(amount)}</p>
          </div>

          <div class="checkout-pay-details">
            <p class="checkout-memo-label">Nội dung chuyển khoản</p>
            <div class="checkout-memo">
              <code class="checkout-code">${esc(code)}</code>
              <button type="button" class="btn btn--line btn--small" data-copy="${esc(code)}" aria-label="Sao chép nội dung chuyển khoản">Sao chép</button>
            </div>
            <ul class="checkout-bank">
              <li><span>Ngân hàng</span><strong>${esc(BANK.name)}</strong></li>
              <li><span>Chủ tài khoản</span><strong>${esc(BANK.owner)}</strong></li>
              <li><span>Số tài khoản</span><strong>${esc(BANK.account)}</strong></li>
            </ul>
          </div>
        </div>

        <p class="checkout-wait" data-status role="status">
          <strong>Đang chờ xác nhận thanh toán…</strong><br/>
          Đơn <code>${esc(code)}</code> · hệ thống tự kiểm tra giao dịch.
        </p>
      </div>`;

    root.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const v = btn.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(v);
        btn.textContent = "Đã sao chép";
      } catch {
        btn.textContent = "Sao chép thủ công";
      }
    });
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    startPoll(root, order, courseCode, mode);
  }

  async function checkBuyerEmail(email) {
    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb.rpc("check_buyer_email", {
        p_email: email,
      });
      if (error) return false;
      return !!(data && data.exists);
    } catch {
      return false;
    }
  }

  async function renderConfirm(root, courseCode, fields) {
    guestAccountExisted = false;
    root.innerHTML = `
      <div class="checkout-panel">
        <p class="kicker">Vui lòng kiểm tra thông tin nhận tài khoản</p>
        <h3 class="checkout-confirm-title">Xác nhận trước khi thanh toán</h3>
        <dl class="checkout-meta checkout-confirm">
          <div><dt>Họ và tên</dt><dd>${esc(fields.fullName)}</dd></div>
          <div><dt>Email</dt><dd><code>${esc(fields.email)}</code></dd></div>
          <div><dt>Số điện thoại</dt><dd>${esc(fields.phone)}</dd></div>
        </dl>
        <p class="form-note" data-confirm-note>
          Email này sẽ được dùng để tạo tài khoản học tập SA247 và nhận thông tin khóa học.
        </p>
        <div class="checkout-email-note" data-email-note hidden></div>
        <div class="contact__cta">
          <button type="button" class="btn btn--amber" data-confirm-pay>Xác nhận &amp; thanh toán</button>
          <button type="button" class="btn btn--line" data-back-form>Sửa thông tin</button>
        </div>
        <p class="form-msg" data-msg role="status"></p>
      </div>`;

    const noteEl = root.querySelector("[data-email-note]");
    const confirmNote = root.querySelector("[data-confirm-note]");
    const existed = await checkBuyerEmail(fields.email);
    guestAccountExisted = existed;
    if (existed && noteEl) {
      noteEl.hidden = false;
      noteEl.innerHTML =
        `<strong>Email này đã có tài khoản SA247.</strong> ` +
        `Bạn vẫn có thể tiếp tục thanh toán. Sau khi thanh toán thành công, khóa học sẽ được thêm vào tài khoản của bạn.`;
      if (confirmNote) {
        confirmNote.textContent =
          "Email này gắn với tài khoản học tập SA247 hiện có và dùng để nhận thông tin khóa học.";
      }
    }

    root.querySelector("[data-back-form]")?.addEventListener("click", () => {
      renderGuestForm(root, courseCode, fields);
    });

    root.querySelector("[data-confirm-pay]")?.addEventListener("click", async () => {
      const msg = root.querySelector("[data-msg]");
      if (msg) msg.textContent = "Đang tạo mã thanh toán…";
      try {
        guestEmail = fields.email.trim().toLowerCase();
        const order = await createGuestOrder(courseCode, fields);
        if (order.buyer_account_existed != null) {
          guestAccountExisted = !!order.buyer_account_existed;
        }
        renderCheckout(root, order, courseCode, "guest");
      } catch (err) {
        const raw = err.message || "Không tạo được đơn.";
        if (msg) {
          if (/already enrolled/i.test(raw)) {
            const login = loginHref(root);
            msg.innerHTML =
              `Bạn đã mở khóa khóa học này rồi. ` +
              `<a href="${esc(login)}">Đăng nhập</a> để vào học.`;
          } else {
            msg.textContent = friendlyError(raw);
          }
        }
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

  function renderGuestForm(root, courseCode, prefills, priceLabel) {
    const p = prefills || {};
    const price = priceLabel || "99.000đ";
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong data-price-label>Đăng ký khóa học · ${esc(price)}</strong>
          <span>Phí tham gia khóa · ${esc(courseCode)} · tiến độ + kiểm tra</span>
        </div>
        <p class="checkout-lead">
          Chỉ cần họ tên, email và số điện thoại — không cần đăng nhập trước.
          Sau thanh toán, khóa học được gắn vào email bạn nhập.
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
            <input name="terms" type="checkbox" value="1" ${p.terms === false ? "" : "checked"} />
            <span>Tôi đồng ý <a href="../terms.html" target="_blank" rel="noopener">điều khoản</a> &amp; <a href="../privacy.html" target="_blank" rel="noopener">chính sách</a> SA247.</span>
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

  function renderAuthedStart(root, courseCode, priceLabel) {
    const price = priceLabel || "";
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong>Tạo mã thanh toán${price ? ` · ${esc(price)}` : ""}</strong>
          <span>1 khóa · ${esc(courseCode)} · đã đăng nhập</span>
        </div>
        <p class="checkout-lead">Bạn đã đăng nhập. Tạo mã VietQR để mở khóa khóa học này.</p>
        <div class="contact__cta">
          <button type="button" class="btn btn--amber" data-create-order>Tạo mã thanh toán</button>
          <a class="btn btn--line" href="../hoc-tap/">Học tập</a>
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

  async function loadCoursePriceLabel(sb, courseCode) {
    try {
      const { data } = await sb
        .from("courses")
        .select("price")
        .eq("code", courseCode)
        .maybeSingle();
      if (data?.price != null) return fmtVnd(data.price);
    } catch (_) {
      /* keep fallback */
    }
    return "99.000đ";
  }

  async function mount(selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    const courseCode = root.getAttribute("data-course-code");
    if (!courseCode) return;

    let priceLabel = "99.000đ";
    try {
      if (window.sa247Auth?.ready) {
        const sb = await sa247Auth.ensureClient();
        priceLabel = await loadCoursePriceLabel(sb, courseCode);
        const session = await sa247Auth.getSession();
        if (session) {
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
          renderAuthedStart(root, courseCode, priceLabel);
          return;
        }
      }
    } catch (e) {
      console.warn("[checkout hydrate]", e);
    }

    renderGuestForm(root, courseCode, null, priceLabel);
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
