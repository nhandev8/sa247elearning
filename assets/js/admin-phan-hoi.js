/* SA247 · Admin Feedback Center */
(function () {
  let sb;
  let current = "";

  const ST = {
    MOI_TAO: "Mới tạo",
    DA_TIEP_NHAN: "Đã tiếp nhận",
    DANG_XU_LY: "Đang xử lý",
    CHO_XAC_MINH: "Chờ xác minh",
    CHO_THONG_TIN: "Chờ thông tin",
    DA_KHAC_PHUC: "Đã khắc phục",
    DA_DONG: "Đã đóng",
    KHONG_PHAI_LOI: "Không phải lỗi",
    TRUNG_LAP: "Trùng lặp",
    KHONG_THE_TAI_HIEN: "Không tái hiện",
  };
  const SRC = {
    BAI_HOC: "Bài học", VIDEO: "Video", QUIZ: "Kiểm tra",
    THANH_TOAN: "Thanh toán", CHUNG_NHAN: "Chứng nhận",
    TAI_KHOAN: "Tài khoản", WEBSITE: "Website", MOBILE: "Điện thoại",
    NOI_DUNG: "Nội dung", KHAC: "Khác",
  };

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  async function load() {
    const { data: stats } = await sb.rpc("admin_feedback_source_stats", { p_days: 180 });
    const box = document.getElementById("stats-box");
    if (stats) {
      const parts = (stats.by_source || [])
        .map((s) => `${SRC[s.source] || s.source}: ${s.percent}% (${s.count})`)
        .join(" · ");
      box.innerHTML = `<h2>Nguồn phản hồi (180 ngày)</h2><p>${stats.total || 0} phản hồi. ${esc(parts || "Chưa có dữ liệu.")}</p>`;
    }
    const { data, error } = await sb.rpc("admin_list_feedback", {
      p_status: document.getElementById("f-status").value || null,
      p_source: document.getElementById("f-source").value || null,
      p_severity: document.getElementById("f-severity").value || null,
      p_limit: 300,
    });
    if (error) {
      document.getElementById("adm-status").textContent = error.message;
      return;
    }
    const list = Array.isArray(data) ? data : [];
    document.getElementById("adm-status").textContent = list.length + " phản hồi.";
    document.getElementById("rows").innerHTML = list
      .map((f) => {
        const ctx = [f.course_code, f.lesson_id ? "bài" : "", f.video_position_seconds != null
          ? ("phút " + String(Math.floor(f.video_position_seconds / 60)).padStart(2, "0") + ":" + String(f.video_position_seconds % 60).padStart(2, "0"))
          : ""].filter(Boolean).join(" · ");
        return `<tr>
          <td><code>${esc(f.ticket_code)}</code></td>
          <td><strong>${esc(f.severity)}</strong></td>
          <td>${esc(SRC[f.source] || f.source)}</td>
          <td>${esc(ST[f.status] || f.status)}</td>
          <td>${esc(f.title || "—")}</td>
          <td>${esc(ctx || "—")}</td>
          <td>${esc(f.defect_ref || "—")}</td>
          <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-open="${esc(f.ticket_code)}" data-sev="${esc(f.severity)}" data-st="${esc(f.status)}" data-def="${esc(f.defect_ref || "")}">Xử lý</button></td>
        </tr>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const ctx = await sa247AdminShell.boot("Phản hồi & Hỗ trợ");
    if (!ctx) return;
    sb = ctx.sb;
    await load();
    document.getElementById("btn-reload").addEventListener("click", load);
    document.getElementById("rows").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-open]");
      if (!btn) return;
      current = btn.getAttribute("data-open");
      document.getElementById("detail").hidden = false;
      document.getElementById("d-title").textContent = "Xử lý " + current;
      document.getElementById("d-status").value = btn.getAttribute("data-st") || "DA_TIEP_NHAN";
      document.getElementById("d-severity").value = btn.getAttribute("data-sev") || "P3";
      document.getElementById("d-defect").value = btn.getAttribute("data-def") || "";
      document.getElementById("detail").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("d-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!current) return;
      const fd = new FormData(ev.target);
      const { error } = await sb.rpc("admin_update_feedback", {
        p_ticket_code: current,
        p_status: fd.get("status"),
        p_severity: fd.get("severity"),
        p_defect_ref: fd.get("defect_ref") || null,
        p_resolution_note: fd.get("resolution_note") || null,
        p_internal_note: fd.get("internal_note") || null,
      });
      if (error) {
        document.getElementById("adm-status").textContent = error.message;
        return;
      }
      document.getElementById("adm-status").textContent = "Đã cập nhật " + current;
      await load();
    });
  });
})();
