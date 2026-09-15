/* Kiểm tra & kết quả — learning record */
(function () {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch {
      return iso || "—";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    const session = await Boot.requireSession("../kiem-tra/");
    if (!session) return;
    await Boot.paintUser(session);
    const sb = await sa247Auth.ensureClient();

    const preset = new URLSearchParams(location.search).get("course") || "";
    const { data: enrs, error } = await sb
      .from("enrollments")
      .select("course:courses(id,code,title,slug)")
      .eq("status", "active");
    const list = document.getElementById("quiz-list");
    const status = document.getElementById("quiz-status");
    if (error) {
      status.textContent = error.message;
      return;
    }
    const courses = (enrs || []).map((r) => r.course).filter(Boolean);
    if (!courses.length) {
      status.innerHTML =
        'Bạn chưa mở khóa khóa nào. <a href="../index.html#chuong-trinh">Xem danh mục</a>';
      list.innerHTML = "";
    } else {
      status.textContent = `${courses.length} khóa có thể làm kiểm tra cuối khóa.`;
      list.innerHTML = courses
        .map((c) => {
          const hi = c.code === preset ? " style=\"border-color:var(--amber)\"" : "";
          return `<li${hi}><div><strong>${esc(c.code)}</strong> — ${esc(c.title)}
            <span class="meta">Kiểm tra cuối khóa</span></div>
            <a class="btn btn--amber btn--small" href="../quiz/?course=${encodeURIComponent(c.code)}">Làm bài</a></li>`;
        })
        .join("");
    }

    const attemptHost = document.getElementById("attempt-list");
    try {
      const { data: attempts, error: aErr } = await sb
        .from("quiz_attempts")
        .select(
          "id,score_percent,passed,created_at,course:courses(code,title)"
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (aErr) throw aErr;
      if (!attempts?.length) {
        attemptHost.innerHTML = '<p class="meta">Chưa có lần làm bài nào.</p>';
      } else {
        attemptHost.innerHTML = `<table class="learn-table">
          <thead><tr><th>Khóa</th><th>Điểm</th><th>Kết quả</th><th>Thời điểm</th></tr></thead>
          <tbody>
          ${attempts
            .map((a) => {
              const c = a.course || {};
              const pass = a.passed ? "Đạt" : "Chưa đạt";
              return `<tr>
                <td><strong>${esc(c.code || "")}</strong><div class="meta">${esc(c.title || "")}</div></td>
                <td><strong>${a.score_percent != null ? a.score_percent + "%" : "—"}</strong></td>
                <td>${pass}</td>
                <td class="meta">${esc(fmtTime(a.created_at))}</td>
              </tr>`;
            })
            .join("")}
          </tbody></table>`;
      }
    } catch (e) {
      attemptHost.innerHTML = `<p class="meta">${esc(e.message || "Chưa đọc được lịch sử (RLS).")}</p>`;
    }
  });
})();
