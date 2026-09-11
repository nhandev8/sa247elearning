/* Bảng điều khiển quản trị */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Bảng điều khiển");
      if (!ctx) return;
      const { sb } = ctx;

      const [
        profiles,
        courses,
        enrollments,
        orders,
        certificates,
      ] = await Promise.all([
        sb.from("profiles").select("id,role,created_at"),
        sb.from("courses").select("id,code,title,is_published,created_at"),
        sb.from("enrollments").select("id,status,enrolled_at,course_id,user_id"),
        sb.from("orders").select("id,order_code,status,amount,created_at,user_id,course:courses(code,title)").order("created_at", { ascending: false }).limit(50),
        sb.from("certificates").select("id").limit(5000),
      ]);

      const err =
        profiles.error ||
        courses.error ||
        enrollments.error ||
        orders.error ||
        certificates.error;
      if (err) {
        document.getElementById("adm-status").innerHTML =
          `<span class="adm-msg--err">${err.message}</span> — nếu thiếu quyền, chạy migration <code>20260911220000_admin_rls.sql</code>.`;
        return;
      }

      const students = (profiles.data || []).filter((p) => p.role !== "admin");
      const weekAgo = Date.now() - 7 * 864e5;
      const newStudents = students.filter(
        (p) => p.created_at && new Date(p.created_at).getTime() > weekAgo
      ).length;
      const openCourses = (courses.data || []).filter((c) => c.is_published).length;
      const activeEnroll = (enrollments.data || []).filter((e) => e.status === "active").length;
      const pendingOrders = (orders.data || []).filter((o) => o.status === "pending");
      const paidOrders = (orders.data || []).filter((o) => o.status === "paid");

      document.getElementById("adm-status").textContent = "Tổng quan hôm nay";
      document.getElementById("adm-stats").innerHTML = [
        ["Tổng học viên", students.length],
        ["Học viên mới (7 ngày)", newStudents],
        ["Khóa học / đang mở", `${(courses.data || []).length} / ${openCourses}`],
        ["Quyền học đang hoạt động", activeEnroll],
        ["Đơn chờ thanh toán", pendingOrders.length],
        ["Đơn đã thanh toán (mẫu)", paidOrders.length],
        ["Chứng nhận đã cấp", (certificates.data || []).length],
        ["Tài khoản quản trị", (profiles.data || []).filter((p) => p.role === "admin").length],
      ]
        .map(
          ([label, val]) =>
            `<article class="adm-stat"><strong>${val}</strong><span>${label}</span></article>`
        )
        .join("");

      const draftCourses = (courses.data || []).filter((c) => !c.is_published);
      const todos = [
        {
          t: "Đơn hàng chờ thanh toán",
          n: pendingOrders.length,
          href: "./don-hang/",
        },
        {
          t: "Khóa học bản nháp / chưa xuất bản",
          n: draftCourses.length,
          href: "./khoa-hoc/",
        },
        {
          t: "Quyền học đang hoạt động",
          n: activeEnroll,
          href: "./quyen-hoc/",
        },
      ];
      document.getElementById("adm-todo").innerHTML = todos
        .map(
          (x) =>
            `<li><span>${x.t}</span><b><a href="${x.href}">${x.n}</a></b></li>`
        )
        .join("");

      document.getElementById("adm-recent").innerHTML = (orders.data || [])
        .slice(0, 8)
        .map((o) => {
          const c = o.course || {};
          return `<li><span>${sa247Admin.fmtTime(o.created_at)} · ${c.code || ""} · ${o.order_code}</span><b>${sa247Admin.statusOrderVi(o.status)}</b></li>`;
        })
        .join("") || "<li>Chưa có đơn hàng.</li>";
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
