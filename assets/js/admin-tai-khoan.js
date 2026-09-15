/* Quản lý người dùng — link hồ sơ sâu */
(function () {
  let cache = [];
  let enrollCounts = {};

  function roleVi(r) {
    return (
      {
        hoc_vien: "Học viên",
        student: "Học viên",
        quan_tri_cao_nhat: "QT cao nhất",
        quan_tri: "Quản trị",
        quan_ly_noi_dung: "QL nội dung",
        giang_vien: "Giảng viên",
        admin: "Admin (legacy)",
      }[r] ||
      r ||
      "—"
    );
  }

  function paint() {
    const q = (document.getElementById("q").value || "").trim().toLowerCase();
    const f = document.getElementById("filter").value;
    const list = cache.filter((p) => {
      if (f === "learner" && !(p.role === "hoc_vien" || p.role === "student")) return false;
      if (f === "staff" && (p.role === "hoc_vien" || p.role === "student")) return false;
      if (f !== "all" && f !== "learner" && f !== "staff" && p.role !== f) return false;
      if (!q) return true;
      return (
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (p.id || "").includes(q)
      );
    });
    document.getElementById("rows").innerHTML = list
      .map((p) => {
        const n = enrollCounts[p.id] || 0;
        return `<tr>
          <td><strong>${p.full_name || "(chưa đặt tên)"}</strong>
            <div class="adm-msg">${p.id}</div>
            <a class="adm-btn adm-btn--line adm-btn--small" href="./ho-so.html?id=${encodeURIComponent(p.id)}">Hồ sơ người học</a>
          </td>
          <td>${roleVi(p.role)}</td>
          <td>${p.phone || "—"}</td>
          <td>${sa247Admin.fmtTime(p.created_at)}</td>
          <td>${n}</td>
        </tr>`;
      })
      .join("");
    document.getElementById("adm-status").textContent = `${list.length} / ${cache.length} người dùng`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tất cả người dùng");
      if (!ctx) return;
      const { sb } = ctx;
      const { data, error } = await sb
        .from("profiles")
        .select("id,full_name,phone,role,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      cache = data || [];
      const { data: enrolls } = await sb
        .from("enrollments")
        .select("user_id,status")
        .eq("status", "active");
      (enrolls || []).forEach((e) => {
        enrollCounts[e.user_id] = (enrollCounts[e.user_id] || 0) + 1;
      });
      paint();
      document.getElementById("q").addEventListener("input", paint);
      document.getElementById("filter").addEventListener("change", paint);
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
