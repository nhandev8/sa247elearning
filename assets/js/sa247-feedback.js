/* SA247 · Widget Phản hồi & Hỗ trợ (toàn cục)
 * Chèn nút nổi + modal gửi phản hồi. Tự lấy ngữ cảnh từ:
 *   window.SA247_FEEDBACK_CONTEXT = { source, course_code, lesson_id, video_position_seconds }
 * hoặc suy ra từ URL. Gọi RPC submit_feedback (SECURITY DEFINER).
 * Dùng: thêm <script src=".../sa247-feedback.js" defer></script> vào trang app.
 * Ẩn nút: thêm data-no-feedback vào <body>, hoặc gọi sa247Feedback.open() thủ công.
 */
(function () {
  if (window.__sa247FeedbackInit) return;
  window.__sa247FeedbackInit = true;

  const CATEGORIES = [
    { v: "content", label: "Nội dung chưa chính xác / khó hiểu" },
    { v: "bug_technical", label: "Lỗi kỹ thuật (video, quiz, đăng nhập…)" },
    { v: "experience", label: "Góp ý trải nghiệm / giao diện" },
    { v: "question", label: "Câu hỏi học tập" },
    { v: "other", label: "Khác" },
  ];
  const SOURCES = [
    ["BAI_HOC", "Bài học"], ["VIDEO", "Video"], ["QUIZ", "Kiểm tra"],
    ["THANH_TOAN", "Thanh toán"], ["CHUNG_NHAN", "Chứng nhận"],
    ["TAI_KHOAN", "Tài khoản"], ["WEBSITE", "Website"], ["MOBILE", "Điện thoại"],
    ["NOI_DUNG", "Nội dung"], ["KHAC", "Khác"],
  ];

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function guessSource() {
    const p = location.pathname.toLowerCase();
    if (p.includes("/hoc-tap") || p.includes("/khoa-hoc") || p.includes("/atnm") || p.includes("/atxd")) return "BAI_HOC";
    if (p.includes("/quiz") || p.includes("/kiem-tra")) return "QUIZ";
    if (p.includes("/chung-nhan") || p.includes("/xac-minh") || p.includes("/verify")) return "CHUNG_NHAN";
    if (p.includes("/don-hang")) return "THANH_TOAN";
    if (p.includes("/ho-so") || p.includes("/cai-dat")) return "TAI_KHOAN";
    if (/android|iphone|ipad|mobile/i.test(navigator.userAgent)) return "MOBILE";
    return "WEBSITE";
  }

  function ctx() {
    const c = window.SA247_FEEDBACK_CONTEXT || {};
    return {
      source: c.source || guessSource(),
      course_code: c.course_code || "",
      lesson_id: c.lesson_id || "",
      video_position_seconds: c.video_position_seconds ?? null,
      url: location.href,
      browser: navigator.userAgent.slice(0, 120),
      device: /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? "mobile" : "desktop",
      user_agent: navigator.userAgent.slice(0, 240),
    };
  }

  function injectStyle() {
    if (document.getElementById("sa247-fb-style")) return;
    const s = document.createElement("style");
    s.id = "sa247-fb-style";
    s.textContent = `
    .sa247-fb-fab{position:fixed;right:18px;bottom:18px;z-index:9998;background:#0b1f3a;color:#fff;border:none;border-radius:999px;padding:.7rem 1.1rem;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(11,31,58,.35)}
    .sa247-fb-fab:hover{background:#123a5c}
    .sa247-fb-overlay{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:1rem}
    .sa247-fb-overlay.is-open{display:flex}
    .sa247-fb-modal{background:#fff;border-radius:16px;max-width:32rem;width:100%;max-height:90vh;overflow:auto;padding:1.5rem;font-family:inherit}
    .sa247-fb-modal h2{margin:0 0 .3rem;font-size:1.2rem;color:#0f172a}
    .sa247-fb-modal .sub{color:#64748b;font-size:.9rem;margin:0 0 1rem}
    .sa247-fb-modal label{display:block;font-weight:700;margin:.85rem 0 .35rem;color:#0f172a;font-size:.95rem}
    .sa247-fb-modal select,.sa247-fb-modal textarea,.sa247-fb-modal input{width:100%;font:inherit;padding:.6rem .75rem;border:1px solid #cbd5e1;border-radius:10px;box-sizing:border-box}
    .sa247-fb-modal textarea{min-height:5.5rem;resize:vertical}
    .sa247-fb-ctx{background:#f1f5f9;border-radius:10px;padding:.6rem .8rem;font-size:.85rem;color:#475569;margin:.5rem 0 0}
    .sa247-fb-actions{display:flex;gap:.6rem;margin-top:1.1rem;flex-wrap:wrap}
    .sa247-fb-btn{font:inherit;font-weight:700;padding:.6rem 1.1rem;border-radius:10px;cursor:pointer;border:1px solid transparent}
    .sa247-fb-btn--primary{background:#c45c26;color:#fff}
    .sa247-fb-btn--line{background:#fff;border-color:#cbd5e1;color:#0f172a}
    .sa247-fb-msg{margin:.75rem 0 0;font-size:.92rem;min-height:1.1rem}
    .sa247-fb-msg--ok{color:#047857;font-weight:600}
    .sa247-fb-msg--err{color:#b91c1c;font-weight:600}
    .sa247-fb-note{font-size:.82rem;color:#94a3b8;margin:.75rem 0 0;line-height:1.4}
    `;
    document.head.appendChild(s);
  }

  let overlay = null;

  function buildModal() {
    if (overlay) return overlay;
    injectStyle();
    overlay = document.createElement("div");
    overlay.className = "sa247-fb-overlay";
    overlay.innerHTML = `
      <div class="sa247-fb-modal" role="dialog" aria-modal="true" aria-label="Gửi phản hồi">
        <h2>Phản hồi & Hỗ trợ</h2>
        <p class="sub">Kiến thức HSE phải chính xác. Nếu bạn phát hiện điều gì chưa đúng, hãy phản hồi để SA247 cùng bạn cải thiện.</p>
        <div id="sa247-fb-body">
          <label>Bạn muốn phản hồi điều gì?</label>
          <select id="sa247-fb-cat">${CATEGORIES.map((c) => `<option value="${c.v}">${c.label}</option>`).join("")}</select>
          <label>Khu vực liên quan</label>
          <select id="sa247-fb-src">${SOURCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
          <label>Tiêu đề (tùy chọn)</label>
          <input id="sa247-fb-title" maxlength="140" placeholder="Tóm tắt ngắn" />
          <label>Mô tả chi tiết</label>
          <textarea id="sa247-fb-desc" placeholder="VD: Ví dụ ở phút 05:20 chưa đúng với nội dung…"></textarea>
          <label>Ảnh minh chứng (tùy chọn)</label>
          <input type="file" id="sa247-fb-file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          <div class="sa247-fb-ctx" id="sa247-fb-ctx"></div>
          <div class="sa247-fb-actions">
            <button type="button" class="sa247-fb-btn sa247-fb-btn--primary" id="sa247-fb-send">Gửi phản hồi</button>
            <button type="button" class="sa247-fb-btn sa247-fb-btn--line" id="sa247-fb-cancel">Đóng</button>
          </div>
          <p class="sa247-fb-msg" id="sa247-fb-msg" aria-live="polite"></p>
          <p class="sa247-fb-note">SA247 dùng thông tin này để xử lý và cải thiện nội dung/hệ thống.</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("#sa247-fb-cancel").addEventListener("click", close);
    overlay.querySelector("#sa247-fb-send").addEventListener("click", send);
    return overlay;
  }

  async function open(opts) {
    buildModal();
    const c = ctx();
    if (opts?.source) c.source = opts.source;
    if (opts?.category) overlay.querySelector("#sa247-fb-cat").value = opts.category;
    const srcSel = overlay.querySelector("#sa247-fb-src");
    if ([...srcSel.options].some((o) => o.value === c.source)) srcSel.value = c.source;
    const bits = [];
    if (c.course_code) bits.push("Khóa " + esc(c.course_code));
    if (c.video_position_seconds != null) {
      const s = Math.floor(c.video_position_seconds);
      bits.push("Phút " + String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"));
    }
    bits.push(esc((location.pathname || "/").slice(0, 60)));
    overlay.querySelector("#sa247-fb-ctx").textContent = "Ngữ cảnh tự ghi: " + bits.join(" · ");
    overlay.querySelector("#sa247-fb-msg").textContent = "";
    overlay.classList.add("is-open");

    // Chặn nếu chưa đăng nhập
    let session = null;
    try { session = window.sa247Auth?.ready ? await sa247Auth.getSession() : null; } catch (_) {}
    const body = overlay.querySelector("#sa247-fb-body");
    if (!session?.user?.id) {
      const next = encodeURIComponent(location.href);
      body.querySelector("#sa247-fb-send").disabled = true;
      overlay.querySelector("#sa247-fb-msg").className = "sa247-fb-msg sa247-fb-msg--err";
      const loginHref = new URL("auth/login.html", location.origin + location.pathname.replace(/[^/]*$/, "")).pathname;
      overlay.querySelector("#sa247-fb-msg").innerHTML =
        `Bạn cần đăng nhập để gửi phản hồi. <a href="${loginHref}?next=${next}">Đăng nhập</a>`;
    } else {
      body.querySelector("#sa247-fb-send").disabled = false;
    }
  }

  function close() { overlay?.classList.remove("is-open"); }

  async function send() {
    const btn = overlay.querySelector("#sa247-fb-send");
    const msg = overlay.querySelector("#sa247-fb-msg");
    const desc = overlay.querySelector("#sa247-fb-desc").value.trim();
    if (!desc) { msg.className = "sa247-fb-msg sa247-fb-msg--err"; msg.textContent = "Vui lòng mô tả chi tiết."; return; }
    btn.disabled = true;
    msg.className = "sa247-fb-msg"; msg.textContent = "Đang gửi…";
    try {
      const sb = await sa247Auth.ensureClient();
      const c = ctx();
      c.source = overlay.querySelector("#sa247-fb-src").value;
      const { data, error } = await sb.rpc("submit_feedback", {
        p_category: overlay.querySelector("#sa247-fb-cat").value,
        p_source: c.source,
        p_title: overlay.querySelector("#sa247-fb-title").value.trim() || null,
        p_body: desc,
        p_context: {
          url: c.url, course_code: c.course_code, lesson_id: c.lesson_id || null,
          video_position_seconds: c.video_position_seconds,
          browser: c.browser, device: c.device, user_agent: c.user_agent,
        },
      });
      if (error) throw error;
      const file = overlay.querySelector("#sa247-fb-file")?.files?.[0];
      if (file && data?.feedback_id) {
        const session = await sa247Auth.getSession();
        const uid = session?.user?.id;
        const path = `${uid}/${data.feedback_id}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
        await sb.storage.from("feedback").upload(path, file, { upsert: true });
        await sb.from("feedback_attachments").insert({
          feedback_id: data.feedback_id,
          storage_path: path,
          file_type: file.type,
        });
      }
      msg.className = "sa247-fb-msg sa247-fb-msg--ok";
      msg.innerHTML = `Đã gửi. Mã phản hồi: <strong>${esc(data?.ticket_code || "")}</strong>. Cảm ơn bạn!`;
      overlay.querySelector("#sa247-fb-desc").value = "";
      overlay.querySelector("#sa247-fb-title").value = "";
      document.dispatchEvent(new CustomEvent("sa247:feedback-sent", { detail: data }));
    } catch (e) {
      msg.className = "sa247-fb-msg sa247-fb-msg--err";
      msg.textContent = "Không gửi được: " + (e?.message || e);
      btn.disabled = false;
    }
  }

  function mountFab() {
    if (document.body?.hasAttribute("data-no-feedback")) return;
    if (document.getElementById("sa247-fb-fab")) return;
    const b = document.createElement("button");
    b.id = "sa247-fb-fab";
    b.type = "button";
    b.className = "sa247-fb-fab";
    b.textContent = "💬 Phản hồi";
    b.addEventListener("click", () => open());
    injectStyle();
    document.body.appendChild(b);
  }

  window.sa247Feedback = { open, close };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountFab);
  } else {
    mountFab();
  }
})();
