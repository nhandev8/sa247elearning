/* SA247 certificate verify — Academy completion + legal disclaimer + minimal PII */
(function () {
  const DISCLAIMER =
    "Giấy chứng nhận này không thay thế văn bằng, chứng chỉ, giấy phép hoặc giấy chứng nhận bắt buộc theo quy định pháp luật, nếu có.";

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

  function statusVi(s) {
    return (
      {
        valid: "Hợp lệ",
        issued: "Hợp lệ",
        replaced: "Đã thay thế",
        revoked: "Đã thu hồi",
        eligible: "Đủ điều kiện — chưa cấp công khai",
        reissued: "Đã cấp lại (xem mã mới)",
      }[s] ||
      s ||
      "—"
    );
  }

  function disclaimerHtml(data) {
    const text = data?.legal_disclaimer || DISCLAIMER;
    const kind =
      data?.certificate_kind ||
      "Giấy chứng nhận hoàn thành khóa học của Safety and You 247 Academy";
    return `<p class="verify-kind">${kind}</p>
      <p class="verify-disclaimer">${text}</p>`;
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
      if (data?.reason === "revoked") {
        msg.textContent = "Chứng nhận đã bị thu hồi — không còn hiệu lực.";
        card.hidden = false;
        card.innerHTML = `<p class="kicker">${statusVi("revoked")}</p>
          <p><strong>${data.cert_code || code}</strong></p>
          <p>${data.course_code || ""} · ${data.course_title || ""}</p>
          <p class="lead">Safety and You 247 Academy không xác nhận hiệu lực của mã này.</p>
          ${disclaimerHtml(data)}`;
        return;
      }
      if (data?.reason === "replaced") {
        msg.textContent = "Mã này đã được thay thế bằng bản cấp lại.";
        card.hidden = false;
        card.innerHTML = `<p class="kicker">${statusVi("replaced")}</p>
          <p><strong>${data.cert_code || code}</strong></p>
          <p>${data.course_code || ""} · ${data.course_title || ""}</p>
          <p class="lead">Vui lòng xác minh bằng mã chứng nhận mới (nếu đã được cấp lại).</p>
          ${disclaimerHtml(data)}`;
        return;
      }
      if (data?.reason === "eligible_unpaid") {
        msg.textContent =
          "Đã đủ điều kiện nhưng chưa đăng ký nhận GCN (chưa thanh toán hình thức nhận).";
        card.hidden = false;
        card.innerHTML = `<p class="kicker">${statusVi("eligible")}</p>
          <p><strong>${data.cert_code || code}</strong></p>
          <p>${data.course_code || ""} · ${data.course_title || ""}</p>
          <p class="lead">Học viên cần đăng ký nhận PDF hoặc bản cứng sau khi đạt kiểm tra.</p>
          ${disclaimerHtml(data)}`;
        return;
      }
      msg.textContent = "Không tìm thấy chứng nhận hợp lệ.";
      return;
    }
    msg.textContent = "Hợp lệ.";
    card.hidden = false;
    const enc = encodeURIComponent(data.cert_code);
    const score =
      data.score_percent != null ? `Điểm: ${data.score_percent}% · ` : "";
    card.innerHTML = `<p class="kicker">${statusVi(data.status || "valid")}</p>
      <h2>${data.full_name || "—"}</h2>
      <p><strong>${data.course_code}</strong> · ${data.course_title}</p>
      <p class="meta">Chứng nhận hoàn thành khóa học Academy</p>
      <p>${score}Ngày cấp: ${fmtDate(data.issued_at)}</p>
      <p class="meta">Mã: ${data.cert_code} · Trạng thái: ${statusVi(data.status || "valid")}</p>
      ${disclaimerHtml(data)}
      <p><a class="btn btn--amber" href="./chung-nhan.html?code=${enc}">Xem giấy chứng nhận</a>
      <a class="btn btn--line" href="./chung-nhan.html?code=${enc}" target="_blank" rel="noopener">In / PDF</a></p>`;
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
