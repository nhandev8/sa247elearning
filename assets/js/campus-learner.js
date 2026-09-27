/* Học viên · Chương trình đối tác (Campus) trên trang Học tập */
(function () {
  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  const AUDIENCE_VI = {
    SINH_VIEN: "Sinh viên", HOC_VIEN: "Học viên",
    NHAN_VIEN_DOANH_NGHIEP: "Nhân viên doanh nghiệp",
    GIANG_VIEN: "Giảng viên", KHACH_MOI: "Khách mời", DOI_TAC: "Đối tác",
  };

  function render(host, programs) {
    const hasP = Array.isArray(programs) && programs.length > 0;
    const cards = hasP
      ? programs.map((p) => `<article class="campus-mine-card">
          <p class="kicker">${esc(p.partner_name || "Đối tác")}</p>
          <h3>${esc(p.program_name || p.program_code)}</h3>
          <p class="meta">${esc(AUDIENCE_VI[p.audience_type] || p.audience_type || "")}${p.external_code ? " · Mã: " + esc(p.external_code) : ""}</p>
          <p><a class="btn btn--line btn--small" href="../khoa-cua-toi/">Khóa được cấp →</a></p>
        </article>`).join("")
      : `<p class="meta">Bạn chưa tham gia chương trình đối tác nào. Nếu có <strong>mã chương trình</strong> từ trường/đối tác, nhập bên dưới để kích hoạt quyền học miễn phí.</p>`;

    host.innerHTML = `
      <div class="learn-section__head"><h2>Chương trình đối tác của tôi</h2></div>
      <div class="campus-mine-grid">${cards}</div>
      <div class="campus-mine-redeem">
        <label for="dash-rc">Có mã chương trình? Kích hoạt tại đây</label>
        <div class="campus-mine-redeem__row">
          <input id="dash-rc" placeholder="VD: ABC-HSE-2026" autocomplete="off" />
          <input id="dash-rext" placeholder="Mã SV (nếu có)" autocomplete="off" />
          <button type="button" class="btn btn--amber btn--small" id="dash-redeem">Kích hoạt</button>
        </div>
        <p class="campus-mine-msg" id="dash-redeem-msg" aria-live="polite"></p>
        <p class="meta"><a href="../campus/">Tìm hiểu SA247 Campus →</a></p>
      </div>`;

    host.querySelector("#dash-redeem")?.addEventListener("click", async () => {
      const code = (host.querySelector("#dash-rc").value || "").trim();
      const ext = (host.querySelector("#dash-rext").value || "").trim();
      const msg = host.querySelector("#dash-redeem-msg");
      if (!code) { msg.className = "campus-mine-msg err"; msg.textContent = "Nhập mã chương trình."; return; }
      msg.className = "campus-mine-msg"; msg.textContent = "Đang kích hoạt…";
      try {
        const sb = await sa247Auth.ensureClient();
        const { data, error } = await sb.rpc("redeem_program_code", {
          p_enroll_code: code, p_external_code: ext || null,
        });
        if (error) throw error;
        msg.className = "campus-mine-msg ok";
        msg.innerHTML = `Đã kích hoạt <strong>${esc(data?.program_name || data?.program || code)}</strong> · mở ${data?.enrolled_courses || 0} khóa.`;
        setTimeout(() => load(host), 800);
      } catch (e) {
        const map = { invalid_code: "Mã không đúng.", program_not_active: "Chương trình chưa mở.",
          program_ended: "Chương trình đã kết thúc.", code_exhausted: "Mã đã hết lượt." };
        msg.className = "campus-mine-msg err";
        msg.textContent = map[String(e?.message || "").trim()] || ("Lỗi: " + (e?.message || e));
      }
    });
  }

  async function load(host) {
    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb.rpc("list_my_programs");
      if (error) throw error;
      render(host, Array.isArray(data) ? data : []);
    } catch (e) {
      render(host, []);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const host = document.getElementById("campus-programs");
    if (!host || !window.sa247Auth?.ready) return;
    const session = await sa247Auth.getSession();
    if (!session) { host.hidden = true; return; }
    host.hidden = false;
    await load(host);
  });
})();
