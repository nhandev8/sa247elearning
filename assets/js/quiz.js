/* SA247 quiz ATNM-01 */
(function () {
  const COURSE = "ATNM-01";
  const QUIZ_URL = "../data/quiz-atnm-01.json";

  function el(id) {
    return document.getElementById(id);
  }

  function scoreAnswers(questions, formData) {
    let correct = 0;
    const answers = {};
    questions.forEach((q, i) => {
      const raw = formData.get(q.id);
      const chosen = raw == null || raw === "" ? -1 : Number(raw);
      answers[q.id] = chosen;
      if (chosen === q.answer) correct += 1;
    });
    const percent = Math.round((correct / questions.length) * 100);
    return { percent, answers, correct, total: questions.length };
  }

  async function main() {
    const status = el("quiz-status");
    const form = el("quiz-form");
    const box = el("quiz-questions");
    const result = el("quiz-result");

    if (!window.sa247Auth?.ready) {
      status.innerHTML = 'Thiếu cấu hình Supabase. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }

    const session = await sa247Auth.getSession();
    if (!session) {
      status.innerHTML =
        'Cần đăng nhập và đã mở khóa ATNM-01. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    el("user-label").textContent = session.user.email || "Học viên";

    const sb = await sa247Auth.ensureClient();
    const { data: course } = await sb
      .from("courses")
      .select("id,code")
      .eq("code", COURSE)
      .maybeSingle();
    if (!course) {
      status.textContent = "Không tìm thấy khóa ATNM-01.";
      return;
    }
    const ok = await sa247Auth.hasCourseAccess(course.id);
    if (!ok) {
      status.innerHTML =
        'Bạn chưa mở khóa ATNM-01. <a href="../atnm-01/#goi-pro">Mở khóa 199.000đ</a>';
      return;
    }

    let quiz;
    try {
      quiz = await fetch(QUIZ_URL).then((r) => r.json());
    } catch (e) {
      status.textContent = "Không tải được đề quiz.";
      return;
    }

    status.textContent = `${quiz.questions.length} câu · đạt từ ${quiz.pass_percent || 70}% để nhận Certificate ID.`;
    box.innerHTML = quiz.questions
      .map(
        (q, idx) => `<fieldset class="quiz-q">
        <legend>${idx + 1}. ${q.q}</legend>
        ${q.choices
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

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const fullName = String(fd.get("full_name") || "").trim();
      const scored = scoreAnswers(quiz.questions, fd);
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Đang chấm…";

      const { data, error } = await sb.rpc("submit_course_quiz", {
        p_course_code: COURSE,
        p_full_name: fullName,
        p_answers: scored.answers,
        p_score_percent: scored.percent,
      });

      result.hidden = false;
      if (error) {
        result.innerHTML = `<p class="form-msg">${error.message}</p>
          <p class="lead">Nếu chưa chạy migration quiz: áp SQL <code>landing/supabase/migrations/20260911180000_quiz_certificates.sql</code> trên Supabase.</p>`;
        btn.disabled = false;
        btn.textContent = "Nộp bài";
        return;
      }

      if (data?.passed) {
        result.innerHTML = `<h2>Đạt ${scored.percent}%</h2>
          <p>Certificate ID: <strong>${data.cert_code}</strong></p>
          <p><a class="btn btn--amber" href="../verify/?code=${encodeURIComponent(
            data.cert_code
          )}">Xác minh chứng chỉ</a>
          <a class="btn btn--line" href="../dashboard/">Về dashboard</a></p>`;
      } else {
        result.innerHTML = `<h2>Chưa đạt (${scored.percent}%)</h2>
          <p>Cần ≥ ${quiz.pass_percent || 70}%. Ôn lại bài học rồi thử lại.</p>
          <button type="button" class="btn btn--line" id="retry">Làm lại</button>`;
        el("retry")?.addEventListener("click", () => location.reload());
      }
      btn.disabled = false;
      btn.textContent = "Nộp bài";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => {
      console.error(e);
      el("quiz-status").textContent = e.message || String(e);
    });
  });
})();
