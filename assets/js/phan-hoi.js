/* Học viên · Trung tâm Phản hồi & Hỗ trợ */
(function () {
  const el = (id) => document.getElementById(id);

  const STATUS_VI = {
    MOI_TAO: ["Mới tạo", "open"],
    DA_TIEP_NHAN: ["Đã tiếp nhận", "prog"],
    DANG_XU_LY: ["Đang xử lý", "prog"],
    CHO_XAC_MINH: ["Chờ xác minh", "prog"],
    CHO_THONG_TIN: ["Chờ bạn bổ sung", "open"],
    DA_KHAC_PHUC: ["Đã khắc phục", "done"],
    DA_DONG: ["Đã đóng", "done"],
    KHONG_PHAI_LOI: ["Không phải lỗi", "done"],
    TRUNG_LAP: ["Trùng lặp", "done"],
    KHONG_THE_TAI_HIEN: ["Không tái hiện", "done"],
  };
  const CAT_VI = {
    content: "Nội dung", bug_technical: "Lỗi kỹ thuật",
    experience: "Trải nghiệm", question: "Câu hỏi", other: "Khác",
  };

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function fmt(iso) { try { return new Date(iso).toLocaleString("vi-VN"); } catch { return iso || "—"; } }

  function paint(list) {
    const box = el("fb-list");
    const status = el("fb-status");
    if (!list?.length) {
      status.textContent = "Bạn chưa gửi phản hồi nào.";
      box.innerHTML = "";
      return;
    }
    status.textContent = `${list.length} phản hồi trong hồ sơ của bạn.`;
    box.innerHTML = list.map((f) => {
      const st = STATUS_VI[f.status] || [f.status, "open"];
      return `<article class="fb-card">
        <h3>${esc(f.title || CAT_VI[f.category] || "Phản hồi")}</h3>
        <p class="fb-meta">
          <span class="fb-badge fb-badge--${st[1]}">${esc(st[0])}</span>
          <code>${esc(f.ticket_code)}</code> · ${esc(CAT_VI[f.category] || f.category)}${f.course_code ? " · " + esc(f.course_code) : ""} · ${fmt(f.created_at)}
        </p>
        <p>${esc(f.body)}</p>
        ${f.resolution_note ? `<div class="fb-resolution"><strong>SA247 phản hồi:</strong> ${esc(f.resolution_note)}</div>` : ""}
      </article>`;
    }).join("");
  }

  async function load() {
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("list_my_feedback");
    if (error) { el("fb-status").textContent = error.message; return; }
    paint(Array.isArray(data) ? data : []);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (window.sa247LearnerBoot) {
      await sa247LearnerBoot.bindChrome();
    } else {
      el("menu-toggle")?.addEventListener("click", () =>
        document.querySelector(".app-shell")?.classList.toggle("is-side-open"));
      el("logout")?.addEventListener("click", async () => {
        try { await sa247Auth.signOut(); } catch (_) {}
        location.href = "../index.html";
      });
    }
    if (!window.sa247Auth?.ready) {
      el("fb-status").innerHTML = 'Thiếu cấu hình. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      el("fb-status").innerHTML =
        'Cần đăng nhập. <a href="../auth/login.html?next=' + encodeURIComponent(location.href) + '">Đăng nhập</a>';
      return;
    }
    if (window.sa247LearnerBoot) await sa247LearnerBoot.paintUser(session);
    else el("user-label").textContent = session.user.email || "Học viên";

    el("new-feedback")?.addEventListener("click", () => window.sa247Feedback?.open({ source: "WEBSITE" }));
    document.addEventListener("sa247:feedback-sent", () => setTimeout(load, 400));
    await load();
  });
})();
