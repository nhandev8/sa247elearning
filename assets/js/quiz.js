/* SA247 quiz — đề từ RPC (không lộ đáp án); chấm trên server */
(function () {
  const COURSE = "ATNM-01";

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
        'Bạn chưa mở khóa ATNM-01. <a href="../atnm-01/#goi-pro">Mở khóa khóa học</a>';
      return;
    }

    const { data: quiz, error: qErr } = await sb.rpc("get_course_quiz", {
      p_course_code: COURSE,
    });
    if (qErr || !quiz?.questions?.length) {
      status.innerHTML =
        "Chưa cấu hình đề kiểm tra trên hệ thống. Liên hệ hỗ trợ hoặc thử lại sau." +
        (qErr ? `<br><small>${qErr.message}</small>` : "");
      return;
    }

    const passAt = quiz.pass_percent || 70;
    status.textContent = `${quiz.questions.length} câu · đạt từ ${passAt}% để nhận chứng nhận.`;
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

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const fullName = String(fd.get("full_name") || "").trim();
      const answers = collectAnswers(quiz.questions, fd);
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Đang chấm…";

      const { data, error } = await sb.rpc("submit_course_quiz", {
        p_course_code: COURSE,
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
        result.innerHTML = `<h2>Đạt ${pct}%</h2>
          <p>Certificate ID: <strong>${data.cert_code}</strong></p>
          <p><a class="btn btn--amber" href="../verify/chung-nhan.html?code=${encodeURIComponent(
            data.cert_code
          )}">Xem giấy chứng nhận</a>
          <a class="btn btn--line" href="../verify/?code=${encodeURIComponent(
            data.cert_code
          )}">Xác minh</a>
          <a class="btn btn--line" href="../dashboard/">Về dashboard</a></p>`;
      } else {
        result.innerHTML = `<h2>Chưa đạt (${pct}%)</h2>
          <p>Cần ≥ ${data?.pass_percent || passAt}%. Ôn lại bài học rồi thử lại.</p>
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
