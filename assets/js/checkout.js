/* SA247 checkout — create order + VietQR (Checkpoint 3). */
(function () {
  const BANK = window.SA247_BANK || {
    name: "VPBank",
    owner: "HO HUU NHAN",
    account: "0877787988",
    bin: "VPB",
  };

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
    return data;
  }

  function renderCheckout(root, order, courseCode) {
    const amount = order.amount;
    const code = order.order_code;
    root.innerHTML = `
      <div class="checkout-panel reveal">
        <div class="price-tag">
          <strong>${fmtVnd(amount)}</strong>
          <span>1 khóa · ${courseCode} · thanh toán 1 lần</span>
        </div>
        <p class="checkout-lead">Chuyển khoản đúng <b>số tiền</b> và <b>nội dung</b> bên dưới. Hệ thống tự mở khóa qua SePay (thường trong vài phút).</p>
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
        <p class="form-note">Không sửa nội dung chuyển khoản. Sau khi CK thành công, vào <a href="../dashboard/">Dashboard</a> hoặc tải lại trang khóa học.</p>
        <p class="form-msg" data-status role="status">Đơn <code>${code}</code> đang chờ thanh toán.</p>
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
  }

  async function mount(selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    const courseCode = root.getAttribute("data-course-code");
    if (!courseCode) return;

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
            msg.textContent = "Bạn đã mở khóa khóa học này rồi. Vào Dashboard hoặc tải lại trang để học bài khóa.";
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
