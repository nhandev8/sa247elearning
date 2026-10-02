/* SA247 · Form "Đặt lịch khảo sát 30 phút" (/hop-tac/) → RPC submit_partner_lead. */
(function () {
  const ERR = {
    org_required: "Nhập tên đơn vị (ít nhất 3 ký tự).",
    name_required: "Nhập họ tên người liên hệ.",
    email_invalid: "Email chưa đúng định dạng.",
    phone_required: "Nhập số điện thoại / Zalo (ít nhất 8 chữ số).",
    too_many_requests: "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau hoặc liên hệ support@sa247.vn.",
  };

  function errText(e) {
    const raw = String(e?.message || e || "");
    const key = Object.keys(ERR).find((k) => raw.includes(k));
    return key ? ERR[key] : "Không gửi được yêu cầu. Vui lòng thử lại hoặc liên hệ support@sa247.vn.";
  }

  function init() {
    const f = document.getElementById("lead-form");
    const msg = document.getElementById("lead-msg");
    if (!f || !msg) return;
    const say = (text, kind) => {
      msg.hidden = !text;
      msg.textContent = text || "";
      msg.className = "form-msg" + (kind ? " is-" + kind : "");
    };
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const val = (n) => String(f.elements[n].value || "").trim();
      if (val("org_name").length < 3) return say(ERR.org_required, "err");
      if (val("full_name").length < 2) return say(ERR.name_required, "err");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("email"))) return say(ERR.email_invalid, "err");
      if (val("phone").replace(/\D/g, "").length < 8) return say(ERR.phone_required, "err");
      const n = parseInt(val("expected_learners"), 10);
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      say("Đang gửi…");
      try {
        if (!window.sa247Auth?.ready) throw new Error("not_ready");
        const sb = await sa247Auth.ensureClient();
        const { error } = await sb.rpc("submit_partner_lead", {
          p_lead_type: val("lead_type"),
          p_org_name: val("org_name"),
          p_full_name: val("full_name"),
          p_email: val("email"),
          p_phone: val("phone"),
          p_position: val("position") || null,
          p_interest_model: val("interest_model") || null,
          p_expected_learners: Number.isFinite(n) ? n : null,
          p_preferred_time: val("preferred_time") || null,
          p_note: val("note") || null,
        });
        if (error) throw error;
        f.reset();
        say("Cảm ơn bạn! SA247 đã nhận yêu cầu và sẽ liên hệ để hẹn buổi khảo sát 30 phút.", "ok");
        if (typeof window.sa247Track === "function") window.sa247Track("partner_lead_submit");
      } catch (e) {
        say(errText(e), "err");
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
