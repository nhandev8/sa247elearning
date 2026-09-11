/* Thống kê tổng hợp */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Thống kê");
      if (!ctx) return;
      const { sb } = ctx;

      const [
        profiles,
        courses,
        ordersPaid,
        enrollActive,
        certificates,
        quizAttempts,
      ] = await Promise.all([
        sb.from("profiles").select("id,role", { count: "exact", head: true }),
        sb.from("courses").select("id", { count: "exact", head: true }),
        sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
        sb.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("certificates").select("id", { count: "exact", head: true }),
        sb.from("quiz_attempts").select("id", { count: "exact", head: true }),
      ]);

      const { data: allProfiles } = await sb.from("profiles").select("role");
      const students = (allProfiles || []).filter(
        (p) => p.role === "hoc_vien" || p.role === "student"
      ).length;

      const stats = [
        ["Học viên", students],
        ["Khóa học", courses.count ?? "—"],
        ["Đơn đã thanh toán", ordersPaid.count ?? "—"],
        ["Quyền học đang hoạt động", enrollActive.count ?? "—"],
        ["Chứng nhận đã cấp", certificates.count ?? "—"],
        [
          "Lượt làm bài kiểm tra",
          quizAttempts.error ? "—" : quizAttempts.count ?? 0,
        ],
      ];

      document.getElementById("adm-stats").innerHTML = stats
        .map(
          ([label, val]) =>
            `<article class="adm-stat"><strong>${val}</strong><span>${label}</span></article>`
        )
        .join("");

      document.getElementById("adm-status").textContent = "Cập nhật: " + new Date().toLocaleString("vi-VN");
      if (quizAttempts.error) {
        document.getElementById("adm-status").innerHTML +=
          ` · <span class="adm-msg">Lượt KT: ${quizAttempts.error.message}</span>`;
      }
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
