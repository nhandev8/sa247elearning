/* SA247 checkout — create order + VietQR (Checkpoint 3). */
(function () {
  const BANK = window.SA247_BANK || {
    name: "VPBank",
    owner: "HO HUU NHAN",
    account: "0877787988",
    bin: "VPB",
  };

  let pollTimer = null;

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

  function normalizeOrder(data) {
    const order = Array.isArray(data) ? data[0] : data;
    if (!order || !order.order_code || order.amount == null) {
      throw new Error("Không nhận được mã đơn từ server. Thử lại hoặc tải lại trang.");
    }
    return order;
  }

  async function createOrder(courseCode) {
    if (!window.sa247Auth?.ready) {
      throw new Error("Chưa cấu hình Supabase.");
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      throw new Error("LOGIN_REQUIRED");
    }
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("create_course_order", {
      p_course_code: courseCode,
    });
    if (error) throw new Error(error.message);
    return normalizeOrder(data);
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function renderPaid(root, order, courseCode) {
    stopPoll();
    root.innerHTML = `
      <div class="checkout-panel checkout-panel--paid">
        <div class="price-tag">
          <strong>Đã mở khóa</strong>
          <span>${courseCode} · đơn ${order.order_code}</span>
        </div>
        <p class="checkout-lead">Thanh toán thành công. Bạn có thể vào học toàn bộ khóa hoặc xem trong Dashboard.</p>
        <div class="contact__cta">
          <a class="btn btn--amber" href="../dashboard/">Vào khóa học của tôi</a>
          <a class="btn btn--line" href="#hoc-thu">Xem bài học</a>
        </div>
      </div>`;
  }

  function startPoll(root, order, courseCode) {
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
            `Vẫn chờ xác nhận CK cho <code>${order.order_code}</code>. ` +
            `Nếu đã CK, vào <a href="../dashboard/">Dashboard</a> hoặc liên hệ hỗ trợ.`;
        }
        return;
      }
      try {
        const sb = await sa247Auth.ensureClient();
        const { data } = await sb
          .from("orders")
          .select("order_code,status,amount,paid_at")
          .eq("order_code", order.order_code)
          .maybeSingle();
        if (data?.status === "paid") {
          renderPaid(root, data, courseCode);
          return;
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

  function renderCheckout(root, order, courseCode) {
    if (order.status === "paid") {
      renderPaid(root, order, courseCode);
      return;
    }
    const amount = order.amount;
    const code = order.order_code;
    root.innerHTML = `
      <div class="checkout-panel">
        <div class="price-tag">
          <strong>${fmtVnd(amount)}</strong>
          <span>1 khóa · ${courseCode} · thanh toán 1 lần</span>
        </div>
        <p class="checkout-lead">Chuyển khoản đúng <b>số tiền</b> và <b>nội dung</b> bên dưới. Sau khi có tiền, trang sẽ tự chuyển sang <b>Đã mở khóa</b> (cần SePay webhook).</p>
        <div class="checkout-grid">
          <div class="checkout-qr">
            <img src="${vietQrUrl(amount, code)}" alt="VietQR ${code}" width="280" height="280" />
          </div>
          <dl class="checkout-meta">
            <div><dt>Ngân hàng</dt><dd>${BANK.name}</dd></div>
            <div><dt>Chủ tài khoản</dt><dd>${BANK.owner}</dd></div>
            <div><dt>Số tài khoản</dt><dd><code>${BANK.account}</code></dd></div>
            <div><dt>Số tiền</dt><dd><code>${fmtVnd(amount)}</code></dd></div>
            <div><dt>Nội dung CK</dt><dd><code class="checkout-code">${code}</code>
              <button type="button" class="btn btn--line btn--small" data-copy="${code}">Copy</button>
            </dd></div>
          </dl>
        </div>
        <p class="form-note">Không sửa nội dung CK. Theo dõi đơn tại <a href="../dashboard/#don-hang">Dashboard</a>.</p>
        <p class="form-msg" data-status role="status">Đơn <code>${code}</code> đang chờ thanh toán…</p>
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
    startPoll(root, order, courseCode);
  }

  async function mount(selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    const courseCode = root.getAttribute("data-course-code");
    if (!courseCode) return;

    // If already signed in with pending/paid order, restore panel
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
            renderPaid(root, { order_code: courseCode, status: "paid" }, courseCode);
            return;
          }
          const { data: pending } = await sb
            .from("orders")
            .select("order_code,status,amount,paid_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1);
          // filter by course via join would be better
          const { data: openOrders } = await sb
            .from("orders")
            .select("order_code,status,amount,paid_at,course:courses!inner(code)")
            .eq("status", "pending")
            .eq("courses.code", courseCode)
            .order("created_at", { ascending: false })
            .limit(1);
          if (openOrders?.[0]) {
            renderCheckout(root, openOrders[0], courseCode);
            return;
          }
        }
      }
    } catch (e) {
      console.warn("[checkout hydrate]", e);
    }

    const btn = root.querySelector("[data-create-order]");
    const msg = root.querySelector("[data-msg]");
    btn?.addEventListener("click", async () => {
      if (msg) msg.textContent = "Đang tạo mã thanh toán…";
      try {
        const order = await createOrder(courseCode);
        renderCheckout(root, order, courseCode);
      } catch (err) {
        if (String(err.message) === "LOGIN_REQUIRED") {
          const next = encodeURIComponent(location.href);
          const login = root.getAttribute("data-login-href") || "../auth/login.html";
          location.href = `${login}?next=${next}`;
          return;
        }
        if (msg) {
          const raw = err.message || "Không tạo được đơn.";
          if (/already enrolled/i.test(raw)) {
            msg.innerHTML =
              'Bạn đã mở khóa khóa học này rồi. <a href="../dashboard/">Vào Dashboard</a>.';
          } else if (/not authenticated/i.test(raw)) {
            msg.textContent = "Phiên đăng nhập hết hạn. Hãy đăng nhập lại.";
          } else {
            msg.textContent = raw;
          }
        }
      }
    });
  }

  window.sa247Checkout = { createOrder, mount, vietQrUrl };
  document.addEventListener("DOMContentLoaded", () => {
    mount("#checkout-root");
  });
})();
