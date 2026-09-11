/* SA247 certificate verify */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("vi-VN");
    } catch {
      return iso || "";
    }
  }

  async function verify(code) {
    const msg = el("verify-msg");
    const card = el("verify-card");
    msg.textContent = "Đang kiểm tra…";
    card.hidden = true;

    if (!window.sa247Auth?.ready) {
      msg.textContent = "Thiếu cấu hình Supabase.";
      return;
    }
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("verify_certificate", {
      p_cert_code: code,
    });
    if (error) {
      msg.textContent = error.message;
      return;
    }
    if (!data?.valid) {
      msg.textContent = "Không tìm thấy chứng chỉ hợp lệ.";
      return;
    }
    msg.textContent = "Hợp lệ.";
    card.hidden = false;
    card.innerHTML = `<p class="kicker">Đã xác minh</p>
      <h2>${data.full_name}</h2>
      <p><strong>${data.course_code}</strong> · ${data.course_title}</p>
      <p>Điểm: ${data.score_percent}% · Ngày cấp: ${fmtDate(data.issued_at)}</p>
      <p class="meta">Mã: ${data.cert_code}</p>
      <p class="lead">Safety and You 247 Academy xác nhận chứng chỉ hoàn thành khóa học.</p>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    const preset = params.get("code");
    const form = el("verify-form");
    if (preset) {
      form.cert_code.value = preset;
      verify(preset);
    }
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      verify(String(new FormData(form).get("cert_code") || "").trim());
    });
  });
})();
