/* Kiểm tra & kết quả — mỗi khóa một bài kiểm tra cuối khóa + lịch sử từng lần */
(function () {
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso || "—";
    }
  }

  const quizHref = (code) => `../quiz/?course=${encodeURIComponent(code)}`;
  const learnHref = (code) => `../hoc/?course=${encodeURIComponent(code)}`;
  const certHref = (code) => `../chung-nhan/mua.html?course=${encodeURIComponent(code)}`;

  function stateOf(f) {
    if (!f.quiz_configured) return { key: "none", badge: "Chưa có bài kiểm tra", cls: "" };
    if (f.passed) return { key: "passed", badge: `✓ Đạt${f.best_score != null ? " · " + f.best_score + "/100" : ""}`, cls: "is-ok" };
    if (!f.unlocked) return { key: "locked", badge: "🔒 Chưa mở", cls: "" };
    if (f.attempts_left <= 0 && !f.has_open_session) return { key: "exhausted", badge: "Hết lượt", cls: "is-warn" };
    if (f.has_open_session) return { key: "open", badge: "Đang làm dở", cls: "is-info" };
    if (f.attempts_used > 0) return { key: "failed", badge: "Chưa đạt", cls: "is-warn" };
    return { key: "ready", badge: "Sẵn sàng", cls: "is-info" };
  }

  function cta(code, f, s) {
    switch (s.key) {
      case "passed":
        return `<a class="btn btn--amber btn--small" href="${certHref(code)}">Đăng ký nhận giấy chứng nhận</a>`;
      case "locked":
        return `<a class="btn btn--line btn--small" href="${learnHref(code)}">Tiếp tục học</a>`;
      case "exhausted":
        return `<a class="btn btn--line btn--small" href="../phan-hoi/">Liên hệ hỗ trợ</a>`;
      case "open":
        return `<a class="btn btn--amber btn--small" href="${quizHref(code)}">Tiếp tục bài kiểm tra</a>`;
      case "failed":
        return `<a class="btn btn--amber btn--small" href="${quizHref(code)}">Làm lại (còn ${f.attempts_left}/${f.attempts_max})</a>`;
      case "ready":
        return `<a class="btn btn--amber btn--small" href="${quizHref(code)}">Bắt đầu kiểm tra</a>`;
      default:
        return "";
    }
  }

  function card(code, title, f) {
    const s = stateOf(f);
    const hist = (f.history || [])
      .map(
        (h) => `<tr>
          <td data-label="Lần">Lần ${h.attempt_no}</td>
          <td data-label="Điểm"><strong>${h.score_percent}/100</strong></td>
          <td data-label="Kết quả">${h.passed ? "Đạt" : "Chưa đạt"}</td>
          <td data-label="Thời điểm" class="meta">${esc(fmtTime(h.created_at))}</td>
        </tr>`
      )
      .join("");
    const lessons = f.lessons_total
      ? `${f.lessons_done}/${f.lessons_total} bài học`
      : "Chưa có bài học phát hành";
    return `<article class="assess-card" id="assess-${esc(code)}">
      <header class="assess-card__head">
        <div>
          <p class="assess-card__code">${esc(code)}</p>
          <h3>${esc(title || code)}</h3>
        </div>
        <span class="assess-badge ${s.cls}">${esc(s.badge)}</span>
      </header>
      <ul class="assess-card__facts">
        <li>${esc(lessons)}</li>
        ${f.quiz_configured ? `<li>${f.n_questions} câu · đạt từ ${f.pass_percent}/100</li>
        <li>Đã làm ${f.attempts_used}/${f.attempts_max} lần</li>
        ${f.best_score != null ? `<li>Điểm cao nhất ${f.best_score}/100</li>` : ""}` : ""}
      </ul>
      ${s.key === "locked" ? `<div class="qf-meter" aria-hidden="true"><i style="width:${Math.min(100, f.progress_percent || 0)}%"></i></div>` : ""}
      <div class="assess-card__foot">${cta(code, f, s)}</div>
      ${hist ? `<details class="assess-card__hist"><summary>Lịch sử kiểm tra (${(f.history || []).length})</summary>
        <table class="learn-table"><thead><tr><th>Lần</th><th>Điểm</th><th>Kết quả</th><th>Thời điểm</th></tr></thead>
        <tbody>${hist}</tbody></table></details>` : ""}
    </article>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    const session = await Boot.requireSession("../kiem-tra/");
    if (!session) return;
    await Boot.paintUser(session);
    const sb = await sa247Auth.ensureClient();
    const status = document.getElementById("quiz-status");
    const host = document.getElementById("assess-list");
    const preset = (new URLSearchParams(location.search).get("course") || "").toUpperCase();

    const { data: enrs, error } = await sb
      .from("enrollments")
      .select("course:courses(id,code,title,slug)")
      .eq("status", "active");
    if (error) {
      status.textContent = "Không tải được danh sách khóa học. Vui lòng thử lại.";
      return;
    }
    const courses = (enrs || [])
      .map((r) => r.course)
      .filter(Boolean)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    if (!courses.length) {
      status.innerHTML = 'Bạn chưa có khóa học nào. <a href="../khoa-hoc/">Xem danh mục khóa học</a>';
      return;
    }
    if (preset) courses.sort((a, b) => (a.code === preset ? -1 : b.code === preset ? 1 : 0));

    const results = await Promise.all(
      courses.map((c) =>
        sb.rpc("get_assessment_overview", { p_course_code: c.code }).then(
          (r) => ({ c, data: r.data, error: r.error }),
          (e) => ({ c, error: e })
        )
      )
    );
    host.innerHTML = results
      .map(({ c, data }) => (data ? card(c.code, c.title, data.final || {}) : ""))
      .join("");
    status.textContent = "";
    status.hidden = true;
    if (preset) document.getElementById(`assess-${preset}`)?.classList.add("is-focus");
  });
})();
