/* SA247 quiz — chọn khóa đã mở khóa; chấm + cấp chứng nhận trên server */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function collectAnswers(questions, formData) {
    const answers = {};
    questions.forEach((q) => {
      const raw = formData.get(q.id);
      const chosen = raw == null || raw === "" ? -1 : Number(raw);
      answers[q.id] = chosen;
      if (q.code && q.code !== q.id) answers[q.code] = chosen;
    });
    return answers;
  }

  function courseFromQuery() {
    return new URLSearchParams(location.search).get("course")?.trim() || "";
  }

  async function loadEnrolledCourses(sb) {
    const { data, error } = await sb
      .from("enrollments")
      .select("course:courses(id,code,title,slug)")
      .eq("status", "active");
    if (error) throw error;
    return (data || [])
      .map((r) => r.course)
      .filter(Boolean)
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  async function runQuiz(sb, courseCode) {
    const status = el("quiz-status");
    const form = el("quiz-form");
    const box = el("quiz-questions");
    const result = el("quiz-result");
    form.hidden = true;
    result.hidden = true;
    result.innerHTML = "";
    box.innerHTML = "";

    status.textContent = `Đang tải đề ${courseCode}…`;
    const { data: quiz, error: qErr } = await sb.rpc("get_course_quiz", {
      p_course_code: courseCode,
    });
    if (qErr || !quiz?.questions?.length) {
      status.innerHTML =
        `Chưa cấu hình đề kiểm tra cho <strong>${courseCode}</strong>.` +
        (qErr ? `<br><small>${qErr.message}</small>` : "");
      return;
    }

    const passAt = quiz.pass_percent || 70;
    status.textContent = `${courseCode} · ${quiz.questions.length} câu · đạt từ ${passAt}% để nhận chứng nhận.`;
    document.querySelector(".app-top h1").textContent = `Kỳ thi · ${courseCode}`;
    box.innerHTML = quiz.questions
      .map(
        (q, idx) => `<fieldset class="quiz-q">
        <legend>${idx + 1}. ${q.q}</legend>
        ${(q.choices || [])
          .map(
            (c, ci) => `<label class="quiz-choice">
            <input type="radio" name="${q.id}" value="${ci}" required />
            <span>${c}</span>
          </label>`
          )
          .join("")}
      </fieldset>`
      )
      .join("");
    form.hidden = false;
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const fullName = String(fd.get("full_name") || "").trim();
      const answers = collectAnswers(quiz.questions, fd);
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Đang chấm…";

      const { data, error } = await sb.rpc("submit_course_quiz", {
        p_course_code: courseCode,
        p_full_name: fullName,
        p_answers: answers,
      });

      result.hidden = false;
      if (error) {
        result.innerHTML = `<p class="form-msg">${error.message}</p>`;
        btn.disabled = false;
        btn.textContent = "Nộp bài";
        return;
      }

      const pct = data?.score_percent ?? 0;
      if (data?.passed) {
        const code = encodeURIComponent(data.cert_code);
        result.innerHTML = `<h2>Đạt ${pct}%</h2>
          <p>Hệ thống đã cấp chứng nhận. Mã: <strong>${data.cert_code}</strong></p>
          <p><a class="btn btn--amber" href="../verify/chung-nhan.html?code=${code}">Xem chứng nhận</a>
          <a class="btn btn--line" href="../chung-nhan/">Chứng nhận của tôi</a>
          <a class="btn btn--line" href="../verify/?code=${code}">Xác minh</a></p>`;
      } else {
        result.innerHTML = `<h2>Chưa đạt (${pct}%)</h2>
          <p>Cần ≥ ${data?.pass_percent || passAt}%. Ôn lại bài học rồi thử lại.</p>
          <button type="button" class="btn btn--line" id="retry">Làm lại</button>`;
        el("retry")?.addEventListener("click", () => location.reload());
      }
      btn.disabled = false;
      btn.textContent = "Nộp bài";
    };
  }

  async function main() {
    const status = el("quiz-status");
    if (!window.sa247Auth?.ready) {
      status.innerHTML = 'Thiếu cấu hình Supabase. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      status.innerHTML =
        'Cần đăng nhập và đã mở khóa khóa học. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    el("user-label").textContent = session.user.email || "Học viên";
    const sb = await sa247Auth.ensureClient();
    const courses = await loadEnrolledCourses(sb);
    if (!courses.length) {
      status.innerHTML =
        'Bạn chưa mở khóa khóa nào. <a href="../index.html#chuong-trinh">Xem chương trình</a>';
      return;
    }

    const pick = el("quiz-course");
    const preset = courseFromQuery();
    pick.innerHTML = courses
      .map(
        (c) =>
          `<option value="${c.code}" ${c.code === preset || (!preset && c.code === "ATNM-01") ? "selected" : ""}>${c.code} — ${c.title}</option>`
      )
      .join("");
    el("quiz-course-wrap").hidden = false;

    const start = () => runQuiz(sb, pick.value);
    pick.addEventListener("change", () => {
      const u = new URL(location.href);
      u.searchParams.set("course", pick.value);
      history.replaceState({}, "", u);
      start();
    });
    await start();
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => {
      console.error(e);
      el("quiz-status").textContent = e.message || String(e);
    });
  });
})();
