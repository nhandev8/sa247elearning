/* SA247 — đăng ký nhận thông báo khi khóa mở: ghi vào Supabase qua RPC submit_course_waitlist.
 *   <form id="waitlist-form" data-course-code="XNN-01" data-course-title="…">
 */
(function () {
  const selfSrc = document.currentScript?.src || "";
  const ERRORS = {
    email_invalid: "Email chưa đúng định dạng.",
    name_required: "Vui lòng nhập họ và tên.",
    too_many_requests: "Bạn đã gửi nhiều lần trong hôm nay. Vui lòng thử lại sau.",
  };

  function supabaseConfig() {
    if (window.SA247_SUPABASE?.url) return Promise.resolve(window.SA247_SUPABASE);
    if (!selfSrc) return Promise.resolve(null);
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = new URL("../supabase-config.js", selfSrc).href;
      s.onload = () => resolve(window.SA247_SUPABASE || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  function val(form, name) {
    return String(form.elements[name]?.value || "").trim();
  }

  function bind() {
    const form = document.getElementById("waitlist-form");
    if (!form) return;
    let msg = form.querySelector(".waitlist-msg");
    if (!msg) {
      msg = document.createElement("p");
      msg.className = "waitlist-msg hint";
      msg.setAttribute("role", "status");
      form.appendChild(msg);
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      msg.textContent = "Đang gửi…";
      try {
        const cfg = await supabaseConfig();
        if (!cfg?.url || !cfg?.anonKey) throw new Error("config");
        const res = await fetch(`${cfg.url}/rest/v1/rpc/submit_course_waitlist`, {
          method: "POST",
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_course_code: form.dataset.courseCode || val(form, "ma"),
            p_course_title: form.dataset.courseTitle || null,
            p_full_name: val(form, "name"),
            p_email: val(form, "email"),
            p_phone: val(form, "phone") || null,
            p_role: val(form, "role") || "khac",
            p_note: val(form, "note") || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const key = Object.keys(ERRORS).find((k) => String(data?.message || "").includes(k));
          throw new Error(key ? ERRORS[key] : "send");
        }
        form.reset();
        msg.textContent = data?.duplicate
          ? "Email này đã đăng ký nhận thông báo cho khóa này. SA247 sẽ báo khi khóa mở."
          : "Đã ghi nhận. SA247 sẽ gửi thông báo khi khóa chính thức mở.";
      } catch (err) {
        msg.textContent =
          err?.message && !["config", "send"].includes(err.message)
            ? err.message
            : "Chưa gửi được. Vui lòng thử lại hoặc email support@sa247.vn.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
