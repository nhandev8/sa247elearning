/* Kiểm tra & kết quả — quiz chương + cuối khóa */
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

  function statusBadge(row) {
    if (!row.quiz_configured) {
      return '<span class="meta">Chưa có đề</span>';
    }
    if (row.passed) {
      return `<span class="badge">Đạt${
        row.best_score != null ? " · " + row.best_score + "%" : ""
      }</span>`;
    }
    if (!row.unlocked) {
      return '<span class="badge">Chưa mở</span>';
    }
    if (row.attempts_used > 0) {
      return `<span class="badge">Chưa đạt${
        row.best_score != null ? " · " + row.best_score + "%" : ""
      }</span>`;
    }
    return '<span class="meta">Chưa làm</span>';
  }

  function actionBtn(courseCode, moduleCode, row, kind) {
    if (!row.quiz_configured) {
      return '<span class="meta">—</span>';
    }
    const q = new URLSearchParams({ course: courseCode });
    if (moduleCode) q.set("module", moduleCode);
    const href = `../quiz/?${q.toString()}`;
    if (!row.unlocked) {
      const why =
        kind === "final" && row.module_quizzes_passed === false
          ? "Cần đạt hết quiz chương"
          : `Cần ≥ ${row.min_progress_percent || 0}% tiến độ`;
      return `<span class="meta" title="${esc(why)}">Chưa mở</span>`;
    }
    const label = row.passed ? "Làm lại" : "Làm bài";
    const cls = row.passed ? "btn btn--line btn--small" : "btn btn--amber btn--small";
    return `<a class="${cls}" href="${href}">${label}</a>`;
  }

  function paintOverview(host, courseCode, data) {
    const mods = data?.modules || [];
    const fin = data?.final || {};
    const rows = [];

    mods.forEach((m) => {
      rows.push(`<li>
        <div>
          <strong>${esc(m.module_code)}</strong> — ${esc(m.title || "Chương")}
          <span class="meta">Kiểm tra cuối chương · ${m.n_questions || 0} câu · đạt từ ${
            m.pass_percent || 70
          }%</span>
          <div class="meta">Tiến độ chương: ${m.progress_percent ?? 0}% · lần làm: ${
            m.attempts_used || 0
          }${m.attempts_left != null ? " / còn " + m.attempts_left : ""}</div>
        </div>
        <div class="todo-learn__right">
          ${statusBadge(m)}
          ${actionBtn(courseCode, m.module_code, m, "chuong")}
        </div>
      </li>`);
    });

    rows.push(`<li>
      <div>
        <strong>Cuối khóa</strong> — ${esc(data.course_title || courseCode)}
        <span class="meta">Bài kiểm tra cấp chứng nhận · ${fin.n_questions || 0} câu · đạt từ ${
          fin.pass_percent || 70
        }%</span>
        <div class="meta">${
          fin.module_quizzes_passed
            ? "Đã đạt hết quiz chương"
            : "Chưa đạt hết quiz chương"
        } · lần làm: ${fin.attempts_used || 0}${
          fin.attempts_left != null ? " / còn " + fin.attempts_left : ""
        }</div>
      </div>
      <div class="todo-learn__right">
        ${statusBadge(fin)}
        ${actionBtn(courseCode, "", fin, "final")}
      </div>
    </li>`);

    host.innerHTML = rows.join("");
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
    const coursePick = document.getElementById("assess-course");

    if (error) {
      status.textContent = error.message;
      return;
    }
    const courses = (enrs || []).map((r) => r.course).filter(Boolean);
    if (!courses.length) {
      status.innerHTML =
        'Bạn chưa mở khóa khóa nào. <a href="../index.html#chuong-trinh">Xem danh mục</a>';
      list.innerHTML = "";
      return;
    }

    if (coursePick) {
      coursePick.innerHTML = courses
        .map(
          (c) =>
            `<option value="${esc(c.code)}"${
              c.code === preset || (!preset && c.code === courses[0].code) ? " selected" : ""
            }>${esc(c.code)} — ${esc(c.title)}</option>`
        )
        .join("");
      document.getElementById("assess-course-wrap").hidden = false;
    }

    async function loadCourse(code) {
      status.textContent = `Đang tải đánh giá ${code}…`;
      list.innerHTML = "";
      try {
        const { data, error: oErr } = await sb.rpc("get_assessment_overview", {
          p_course_code: code,
        });
        if (oErr) throw oErr;
        const nMod = (data.modules || []).filter((m) => m.quiz_configured).length;
        const hasFinal = !!data.final?.quiz_configured;
        status.textContent = `${code}: ${nMod} đề cuối chương${hasFinal ? " + 1 đề cuối khóa" : ""}.`;
        paintOverview(list, code, data);
        const u = new URL(location.href);
        u.searchParams.set("course", code);
        history.replaceState({}, "", u);
      } catch (e) {
        status.textContent = e.message || String(e);
        list.innerHTML = "";
      }
    }

    coursePick?.addEventListener("change", () => loadCourse(coursePick.value));
    await loadCourse(coursePick?.value || courses[0].code);

    const attemptHost = document.getElementById("attempt-list");
    try {
      const { data: attempts, error: aErr } = await sb
        .from("quiz_attempts")
        .select(
          "id,score_percent,passed,created_at,module_code,course:courses(code,title)"
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (aErr) throw aErr;
      if (!attempts?.length) {
        attemptHost.innerHTML = '<p class="meta">Chưa có lần làm bài nào.</p>';
      } else {
        attemptHost.innerHTML = `<table class="learn-table">
          <thead><tr><th>Khóa / phạm vi</th><th>Điểm</th><th>Kết quả</th><th>Thời điểm</th></tr></thead>
          <tbody>
          ${attempts
            .map((a) => {
              const c = a.course || {};
              const scope = a.module_code
                ? `Chương ${esc(a.module_code)}`
                : "Cuối khóa";
              const pass = a.passed ? "Đạt" : "Chưa đạt";
              return `<tr>
                <td><strong>${esc(c.code || "")}</strong> · ${scope}
                  <div class="meta">${esc(c.title || "")}</div></td>
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
