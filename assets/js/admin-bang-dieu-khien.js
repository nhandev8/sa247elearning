/* Trung tâm điều hành — KPI đào tạo trước, kinh doanh là một khối */
(function () {
  const STAFF = new Set([
    "admin",
    "quan_tri_cao_nhat",
    "quan_tri",
    "quan_ly_noi_dung",
    "giang_vien",
    "kinh_doanh",
  ]);

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Trung tâm điều hành");
      if (!ctx) return;
      const { sb } = ctx;

      const [
        profiles,
        courses,
        enrollments,
        orders,
        certificates,
        attempts,
        progress,
      ] = await Promise.all([
        sb.from("profiles").select("id,role,created_at"),
        sb.from("courses").select("id,code,title,is_published"),
        sb.from("enrollments").select("id,status,enrolled_at,user_id,course_id"),
        sb
          .from("orders")
          .select("id,order_code,status,amount,created_at,course:courses(code,title)")
          .order("created_at", { ascending: false })
          .limit(80),
        sb.from("certificates").select("id,status,issued_at").limit(8000),
        sb.from("quiz_attempts").select("id,created_at,passed").limit(5000),
        sb
          .from("lesson_progress")
          .select("id,completed,last_watched_at,user_id")
          .limit(8000),
      ]);

      const err =
        profiles.error ||
        courses.error ||
        enrollments.error ||
        orders.error ||
        certificates.error;
      if (err) {
        document.getElementById("adm-status").innerHTML =
          `<span class="adm-msg--err">${err.message}</span>`;
        return;
      }

      const allProfiles = profiles.data || [];
      const learners = allProfiles.filter((p) => !STAFF.has(p.role));
      const staffN = allProfiles.filter((p) => STAFF.has(p.role)).length;
      const weekAgo = Date.now() - 7 * 864e5;
      const dayAgo = Date.now() - 864e5;
      const newLearners = learners.filter(
        (p) => p.created_at && new Date(p.created_at).getTime() > weekAgo
      ).length;
      const openCourses = (courses.data || []).filter((c) => c.is_published).length;
      const activeEnroll = (enrollments.data || []).filter((e) => e.status === "active");
      const activeUserIds = new Set(activeEnroll.map((e) => e.user_id));
      const certs = certificates.data || [];
      const issued = certs.filter((c) => c.status === "issued" || c.status === "valid");
      const eligible = certs.filter((c) => c.status === "eligible");
      const pendingOrders = (orders.data || []).filter((o) => o.status === "pending");
      const paidOrders = (orders.data || []).filter((o) => o.status === "paid");
      let revenue = paidOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
      let revenueLabel = "Doanh thu (mẫu paid)";
      const { data: commerce, error: commerceErr } = await sb.rpc("admin_commerce_summary");
      if (!commerceErr && commerce && commerce.paid_revenue != null) {
        revenue = Number(commerce.paid_revenue) || 0;
        revenueLabel = "Doanh thu đơn đã thanh toán";
      }

      const prog = progress.data || [];
      const completedLessons = prog.filter((p) => p.completed).length;
      const activeToday = new Set(
        prog
          .filter((p) => p.last_watched_at && new Date(p.last_watched_at).getTime() > dayAgo)
          .map((p) => p.user_id)
      ).size;
      const quizzesToday = (attempts.data || []).filter(
        (a) => a.created_at && new Date(a.created_at).getTime() > dayAgo
      ).length;

      const completedEnrollApprox = issued.length;
      const completionRate =
        activeEnroll.length > 0
          ? Math.round((completedEnrollApprox / Math.max(activeEnroll.length, 1)) * 100)
          : 0;

      document.getElementById("adm-status").textContent =
        "Trung tâm điều hành SA247 — ưu tiên tín hiệu đào tạo";
      document.getElementById("adm-stats").innerHTML = [
        ["Học viên", learners.length],
        ["Đang học (quyền active)", activeUserIds.size],
        ["Khóa đang mở", openCourses],
        ["Tỷ lệ hoàn thành (proxy GCN)", `${Math.min(completionRate, 100)}%`],
        ["Bài hoàn thành (mẫu)", completedLessons],
        ["HV học trong 24h", activeToday],
        ["Quiz trong 24h", quizzesToday],
        ["GCN đủ ĐK / đã cấp", `${eligible.length} / ${issued.length}`],
        ["Đơn chờ CK", pendingOrders.length],
        [revenueLabel, revenue.toLocaleString("vi-VN") + "đ"],
        ["Staff", staffN],
        ["HV mới 7 ngày", newLearners],
      ]
        .map(
          ([label, val]) =>
            `<article class="adm-stat"><strong>${val}</strong><span>${label}</span></article>`
        )
        .join("");

      const draftCourses = (courses.data || []).filter((c) => !c.is_published);
      const todos = [
        { t: "Giao dịch / đơn chờ thanh toán", n: pendingOrders.length, href: "./don-hang/" },
        { t: "Chứng nhận đủ điều kiện chưa cấp hình thức", n: eligible.length, href: "./chung-nhan/" },
        { t: "Khóa chưa xuất bản", n: draftCourses.length, href: "./khoa-hoc/" },
        { t: "Người dùng đang có quyền học active", n: activeEnroll.length, href: "./tai-khoan/" },
      ];
      document.getElementById("adm-todo").innerHTML = todos
        .map(
          (x) =>
            `<li><a href="${x.href}"><strong>${x.n}</strong> — ${x.t}</a></li>`
        )
        .join("");

      const recent = (orders.data || []).slice(0, 8).map((o) => {
        const c = o.course || {};
        return `<li><span class="adm-muted">${sa247Admin.fmtTime(o.created_at)}</span> · Đơn ${o.order_code} · ${c.code || ""} · ${o.status}</li>`;
      });
      document.getElementById("adm-recent").innerHTML =
        recent.join("") || "<li>Chưa có hoạt động gần đây.</li>";
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
