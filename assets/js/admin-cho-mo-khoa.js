/* Admin · Kinh doanh › Đăng ký chờ mở khóa (course_waitlist) */
(function () {
  const ST_VI = { moi: "Mới", da_bao: "Đã báo", da_dang_ky: "Đã đăng ký khóa", huy: "Hủy" };
  const ROLE_VI = { hse: "Nhân viên / chuyên viên HSE", gs: "Giám sát / tổ trưởng", ql: "Quản lý", khac: "Khác" };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const status = document.getElementById("adm-status");
    try {
      const ctx = await sa247AdminShell.boot("Chờ mở khóa", { requireCommerce: true });
      if (!ctx) return;
      const { sb } = ctx;
      const rows = document.getElementById("rows");
      const fCourse = document.getElementById("f-course");
      const fStatus = document.getElementById("f-status");
      let all = [];

      function filtered() {
        return all.filter(
          (w) => (!fCourse.value || w.course_code === fCourse.value) && (!fStatus.value || w.status === fStatus.value)
        );
      }

      function render() {
        const list = filtered();
        const opts = (cur) =>
          Object.entries(ST_VI)
            .map(([v, t]) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`)
            .join("");
        rows.innerHTML = list.length
          ? list
              .map(
                (w) => `<tr data-id="${esc(w.id)}">
            <td>${esc(new Date(w.created_at).toLocaleString("vi-VN"))}</td>
            <td><strong>${esc(w.course_code)}</strong>${w.course_title ? "<br /><span class=\"meta\">" + esc(w.course_title) + "</span>" : ""}</td>
            <td>${esc(w.full_name)}</td>
            <td><a href="mailto:${esc(w.email)}">${esc(w.email)}</a>${w.phone ? "<br />" + esc(w.phone) : ""}</td>
            <td>${esc(ROLE_VI[w.role] || w.role)}</td>
            <td>${esc(w.note || "")}</td>
            <td><select data-status>${opts(w.status)}</select></td>
          </tr>`
              )
              .join("")
          : `<tr><td colspan="7">Chưa có đăng ký.</td></tr>`;
        const byCourse = {};
        all.forEach((w) => (byCourse[w.course_code] = (byCourse[w.course_code] || 0) + 1));
        status.textContent =
          `${list.length}/${all.length} đăng ký` +
          (Object.keys(byCourse).length
            ? " · " + Object.entries(byCourse).map(([c, n]) => `${c}: ${n}`).join(" · ")
            : "");
      }

      async function reload() {
        const { data, error } = await sb.rpc("admin_list_course_waitlist", { p_course_code: null });
        if (error) throw error;
        all = Array.isArray(data) ? data : [];
        const cur = fCourse.value;
        const codes = [...new Set(all.map((w) => w.course_code))].sort();
        fCourse.innerHTML =
          `<option value="">Tất cả</option>` +
          codes.map((c) => `<option value="${esc(c)}"${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
        render();
      }

      fCourse.addEventListener("change", render);
      fStatus.addEventListener("change", render);

      rows.addEventListener("change", async (ev) => {
        const sel = ev.target.closest("[data-status]");
        if (!sel) return;
        const id = sel.closest("tr").getAttribute("data-id");
        const { error } = await sb.from("course_waitlist").update({ status: sel.value }).eq("id", id);
        if (error) {
          status.textContent = error.message;
          return;
        }
        const row = all.find((w) => w.id === id);
        if (row) row.status = sel.value;
        render();
      });

      document.getElementById("btn-csv").addEventListener("click", () => {
        const list = filtered();
        const head = ["Ngày", "Mã khóa", "Tên khóa", "Họ tên", "Email", "SĐT", "Vai trò", "Ghi chú", "Trạng thái"];
        const lines = [head, ...list.map((w) => [
          new Date(w.created_at).toLocaleString("vi-VN"), w.course_code, w.course_title, w.full_name,
          w.email, w.phone, ROLE_VI[w.role] || w.role, w.note, ST_VI[w.status] || w.status,
        ])].map((r) => r.map(csvCell).join(","));
        const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cho-mo-khoa${fCourse.value ? "-" + fCourse.value : ""}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });

      document.getElementById("btn-mark").addEventListener("click", async () => {
        const ids = filtered().filter((w) => w.status === "moi").map((w) => w.id);
        if (!ids.length) {
          status.textContent = "Không có đăng ký “Mới” trong bộ lọc hiện tại.";
          return;
        }
        if (!confirm(`Đánh dấu ${ids.length} đăng ký là “Đã báo”?`)) return;
        const { error } = await sb.from("course_waitlist").update({ status: "da_bao" }).in("id", ids);
        if (error) {
          status.textContent = error.message;
          return;
        }
        await reload();
      });

      await reload();
    } catch (e) {
      status.textContent = e.message || String(e);
    }
  });
})();
