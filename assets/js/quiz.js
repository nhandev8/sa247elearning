/* SA247 quiz v2 — cuối chương / cuối khóa; chấm theo choice_key session */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function courseFromQuery() {
    return new URLSearchParams(location.search).get("course")?.trim() || "";
  }

  function moduleFromQuery() {
    const m = new URLSearchParams(location.search).get("module")?.trim() || "";
    return m ? m.toUpperCase() : "";
  }

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function attemptsPhrase(used, left, max) {
    const m = max != null ? Number(max) : 3;
    const u = used != null ? Number(used) : null;
    const l = left != null ? Number(left) : null;
    if (l != null && l <= 0) {
      return u != null
        ? `Bạn đã dùng hết ${u}/${m} lần làm bài.`
        : `Bạn đã hết ${m} lần làm bài cho đề này.`;
    }
    if (l != null && u != null) return `Còn ${l}/${m} lần (đã dùng ${u}).`;
    if (l != null) return `Còn ${l}/${m} lần làm bài.`;
    return `Tối đa ${m} lần làm bài.`;
  }

  function friendlyError(msg) {
    const raw = String(msg || "");
    if (raw.includes("module_quizzes_required")) {
      return "Bạn cần đạt tất cả bài kiểm tra cuối chương trước khi thi cuối khóa.";
    }
    if (raw.includes("progress_required")) {
      const n = raw.split(":").pop();
      return `Cần hoàn thành ít nhất ${n}% nội dung trước khi làm bài.`;
    }
    if (raw.includes("attempts_exhausted")) {
      const parts = raw.split(":");
      // attempts_exhausted | attempts_exhausted:used:max
      if (parts.length >= 3) {
        const used = parts[parts.length - 2];
        const max = parts[parts.length - 1];
        return attemptsPhrase(used, 0, max);
      }
      return attemptsPhrase(null, 0, 3);
    }
    if (raw.includes("cooldown_active")) {
      const n = raw.split(":").pop();
      return `Chờ thêm khoảng ${n} phút trước khi làm lại.`;
    }
    if (raw.includes("quiz_not_configured")) {
      return "Chưa cấu hình đề kiểm tra cho phạm vi này.";
    }
    if (raw.includes("not_enrolled")) {
      return "Bạn chưa mở khóa khóa học này.";
    }
    if (raw.includes("duplicate_submit")) {
      return "Bài vừa được nộp. Không tạo thêm lần làm.";
    }
    if (raw.includes("quiz_empty")) {
      return "Đề kiểm tra chưa có câu hỏi.";
    }
    return raw;
  }

  async function loadCertPriceLabels(sb) {
    const fallback = { pdf: "169.000đ", hard: "199.000đ" };
    try {
      const { data, error } = await sb.rpc("get_product_prices");
      if (error || !data || typeof data !== "object") return fallback;
      const pdf = data.cert_pdf?.amount ?? data.cert_pdf;
      const hard = data.cert_hard?.amount ?? data.cert_hard;
      return {
        pdf: pdf != null ? fmtVnd(pdf) : fallback.pdf,
        hard: hard != null ? fmtVnd(hard) : fallback.hard,
      };
    } catch {
      return fallback;
    }
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

  function collectKeyedAnswers(questions, formData) {
    const answers = {};
    questions.forEach((q) => {
      const key = formData.get(q.id);
      if (key != null && key !== "") {
        answers[q.id] = String(key);
        if (q.code && q.code !== q.id) answers[q.code] = String(key);
      }
    });
    return answers;
  }

  function setCertBlockVisible(visible, certOpts) {
    const block = el("quiz-cert-block");
    const nameInput = el("quiz-full-name");
    const confirm = el("confirm-cert-name");
    const lockNote = el("quiz-cert-lock-note");
    if (block) block.hidden = !visible;
    if (nameInput) {
      nameInput.required = visible;
      if (!visible) nameInput.value = nameInput.value; // keep
      if (visible && certOpts?.locked) {
        nameInput.readOnly = true;
        const pref =
          (certOpts.certName && String(certOpts.certName).trim()) ||
          (certOpts.accountName && String(certOpts.accountName).trim()) ||
          "";
        if (pref) nameInput.value = pref;
      } else if (nameInput) {
        nameInput.readOnly = false;
      }
    }
    if (confirm) confirm.required = visible;
    if (lockNote) lockNote.hidden = !(visible && certOpts?.locked);
  }

  function renderPassedFinal(data, courseCode, pct) {
    const status = data.cert_status || "eligible";
    const courseQ = encodeURIComponent(courseCode);
    if (status === "issued" || status === "valid") {
      const code = encodeURIComponent(data.cert_code || "");
      return `<h2>Đạt ${pct}%</h2>
        <p>Bạn đã có giấy chứng nhận. Mã: <strong>${data.cert_code || "—"}</strong></p>
        <p class="cert-buy-options">
          <a class="btn btn--amber" href="../verify/chung-nhan.html?code=${code}">Xem chứng nhận</a>
          <a class="btn btn--line" href="../chung-nhan/">Chứng nhận của tôi</a>
          <a class="btn btn--line" href="../dashboard/">Về Học tập</a>
        </p>`;
    }
    return null;
  }

  async function runQuiz(sb, courseCode, moduleCode, certOpts) {
    const status = el("quiz-status");
    const form = el("quiz-form");
    const box = el("quiz-questions");
    const result = el("quiz-result");
    const isFinal = !moduleCode;

    form.hidden = true;
    result.hidden = true;
    result.innerHTML = "";
    box.innerHTML = "";
    setCertBlockVisible(isFinal, certOpts);

    const pref =
      (certOpts?.certName && String(certOpts.certName).trim()) ||
      (certOpts?.accountName && String(certOpts.accountName).trim()) ||
      "";
    const nameInput = el("quiz-full-name");
    if (nameInput && isFinal && !nameInput.value && pref) nameInput.value = pref;

    status.textContent = moduleCode
      ? `Đang tải đề ${courseCode} · chương ${moduleCode}…`
      : `Đang tải đề cuối khóa ${courseCode}…`;

    const { data: quiz, error: qErr } = await sb.rpc("start_quiz_attempt", {
      p_course_code: courseCode,
      p_module_code: moduleCode || null,
    });
    if (qErr || !quiz?.questions?.length) {
      status.innerHTML =
        friendlyError(qErr?.message) ||
        `Chưa cấu hình đề kiểm tra cho <strong>${courseCode}</strong>${
          moduleCode ? ` · ${moduleCode}` : ""
        }.`;
      return;
    }

    const passAt = quiz.pass_percent || 70;
    const scopeLabel =
      quiz.scope === "chuong"
        ? `Cuối chương ${quiz.module_code || moduleCode}`
        : "Cuối khóa";
    const attemptInfo = attemptsPhrase(
      quiz.attempts_used,
      quiz.attempts_left,
      quiz.attempts_max ?? 3
    );
    status.textContent = `${courseCode} · ${scopeLabel} · ${quiz.questions.length} câu · đạt từ ${passAt}% · ${attemptInfo}`;
    document.querySelector(".app-top h1").textContent = quiz.title
      ? quiz.title
      : moduleCode
        ? `Kiểm tra chương ${moduleCode}`
        : `Kỳ thi cuối khóa · ${courseCode}`;

    box.innerHTML = quiz.questions
      .map((q, idx) => {
        const choices = (q.choices || [])
          .map((c) => {
            const key = typeof c === "object" ? c.key : String(c);
            const text = typeof c === "object" ? c.text : c;
            return `<label class="quiz-choice">
            <input type="radio" name="${q.id}" value="${key}" required />
            <span>${text}</span>
          </label>`;
          })
          .join("");
        return `<fieldset class="quiz-q">
        <legend>${idx + 1}. ${q.q}</legend>
        ${choices}
      </fieldset>`;
      })
      .join("");

    form.hidden = false;
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      let fullName = null;

      if (isFinal) {
        fullName = String(fd.get("full_name") || "").trim();
        if (!fd.get("confirm_cert_name")) {
          result.hidden = false;
          result.innerHTML =
            '<p class="form-msg is-err">Hãy xác nhận họ tên trên chứng nhận trước khi nộp bài.</p>';
          return;
        }
        if (!fullName) {
          result.hidden = false;
          result.innerHTML = '<p class="form-msg is-err">Nhập họ tên sẽ in trên chứng nhận.</p>';
          return;
        }
        if (!certOpts?.locked) {
          try {
            await sa247Auth.updateProfile({ cert_display_name: fullName });
          } catch (_) {}
        }
      }

      const answers = collectKeyedAnswers(quiz.questions, fd);
      const missing = (quiz.questions || []).filter((q) => answers[q.id] == null || answers[q.id] === "");
      if (missing.length) {
        result.hidden = false;
        result.innerHTML =
          `<p class="form-msg is-err">Còn ${missing.length} câu chưa chọn đáp án.</p>`;
        return;
      }
      if (form.dataset.submitting === "1") return;
      form.dataset.submitting = "1";
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Đang chấm…";

      const { data, error } = await sb.rpc("submit_quiz_attempt", {
        p_session_id: quiz.session_id,
        p_answers: answers,
        p_full_name: fullName,
      });

      result.hidden = false;
      if (error) {
        result.innerHTML = `<p class="form-msg">${friendlyError(error.message)}</p>`;
        form.dataset.submitting = "";
        btn.disabled = false;
        btn.textContent = "Nộp bài";
        return;
      }

      const pct = data?.score_percent ?? 0;
      const backAssess = `../kiem-tra/?course=${encodeURIComponent(courseCode)}`;

      if (data?.passed) {
        if (data.scope === "khoa") {
          const issuedHtml = renderPassedFinal(data, courseCode, pct);
          if (issuedHtml) {
            result.innerHTML = issuedHtml;
          } else {
            const prices = await loadCertPriceLabels(sb);
            result.innerHTML = `<h2>Đạt ${pct}%</h2>
              <p>Bạn đã đủ điều kiện cấp giấy chứng nhận hoàn thành khóa học.</p>
              <p class="meta">Phí khóa học là phí tham gia — GCN là lựa chọn hình thức nhận (không bắt buộc).</p>
              <p><strong>Chọn hình thức nhận:</strong></p>
              <p class="cert-buy-options">
                <a class="btn btn--amber" href="../chung-nhan/mua.html?course=${encodeURIComponent(courseCode)}&amp;type=cert_pdf">PDF điện tử · ${prices.pdf}</a>
                <a class="btn btn--line" href="../chung-nhan/mua.html?course=${encodeURIComponent(courseCode)}&amp;type=cert_hard">Bản cứng · ${prices.hard} + ship</a>
                <a class="btn btn--line" href="../chung-nhan/mua.html?course=${encodeURIComponent(courseCode)}">Xem các lựa chọn</a>
                <a class="btn btn--line" href="../dashboard/">Về Học tập · nhận sau</a>
              </p>`;
          }
        } else {
          result.innerHTML = `<h2>Đạt ${pct}%</h2>
            <p>Bạn đã hoàn thành kiểm tra chương <strong>${data.module_code || moduleCode}</strong>.</p>
            <p class="meta">Đạt hết quiz chương mới được thi cuối khóa.</p>
            <p class="cert-buy-options">
              <a class="btn btn--amber" href="${backAssess}">Xem tiến độ kiểm tra</a>
              <a class="btn btn--line" href="../dashboard/">Về Học tập</a>
            </p>`;
        }
      } else {
        const expiredNote = data?.expired
          ? " (hết thời gian làm bài — lần này không tính đạt)"
          : "";
        const left = data?.attempts_left;
        const used = data?.attempts_used;
        const maxA = data?.attempts_max ?? 3;
        const attemptNote = attemptsPhrase(used, left, maxA);
        const canRetry = left == null || Number(left) > 0;
        const retryBtn = canRetry
          ? `<button type="button" class="btn btn--amber" id="retry">Làm lại · còn ${left ?? "?"} lần</button>`
          : "";
        result.innerHTML = `<h2>Chưa đạt (${pct}%)${expiredNote}</h2>
          <p>Cần ≥ ${data?.pass_percent || passAt}%. ${
            canRetry ? "Ôn lại bài học rồi thử lại." : "Bạn không còn lượt làm cho đề này."
          }</p>
          <p class="meta">${attemptNote}</p>
          <p class="cert-buy-options">
            ${retryBtn}
            <a class="btn btn--line" href="${backAssess}">Kiểm tra &amp; kết quả</a>
            <a class="btn btn--line" href="../dashboard/">Về Học tập</a>
          </p>`;
        el("retry")?.addEventListener("click", () => location.reload());
      }
      btn.disabled = true;
      btn.textContent = "Đã nộp";
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
    const profile = await sa247Auth.getProfile({ session, timeoutMs: 4000 });
    let certLocked = false;
    const isStaff = sa247Auth.isStaffRole(profile?.role);
    try {
      const { data: locked } = await sb.rpc("learner_has_issued_certificate", {
        p_uid: session.user.id,
      });
      certLocked = Boolean(locked) && !isStaff;
    } catch (_) {
      try {
        const { data: mine } = await sb.rpc("list_my_certificates");
        certLocked =
          (mine || []).some((c) => c.status === "issued" || c.status === "valid") &&
          !isStaff;
      } catch (__) {}
    }
    const certOpts = {
      accountName: profile?.full_name || "",
      certName: profile?.cert_display_name || profile?.full_name || "",
      locked: certLocked,
    };

    const courses = await loadEnrolledCourses(sb);
    if (!courses.length) {
      status.innerHTML =
        'Bạn chưa mở khóa khóa nào. <a href="../index.html#chuong-trinh">Xem chương trình</a>';
      return;
    }

    const pick = el("quiz-course");
    const pickMod = el("quiz-module");
    const preset = courseFromQuery();
    const presetMod = moduleFromQuery();
    pick.innerHTML = courses
      .map(
        (c) =>
          `<option value="${c.code}" ${
            c.code === preset || (!preset && c.code === "AL-01") ? "selected" : ""
          }>${c.code} — ${c.title}</option>`
      )
      .join("");
    el("quiz-course-wrap").hidden = false;

    async function fillModules(courseCode) {
      if (!pickMod) return;
      pickMod.innerHTML = `<option value="">Cuối khóa (chứng nhận)</option>`;
      try {
        const { data, error } = await sb.rpc("get_assessment_overview", {
          p_course_code: courseCode,
        });
        if (error) throw error;
        const mods = data?.modules || [];
        mods.forEach((m) => {
          if (!m.quiz_configured) return;
          const mark = m.passed ? " · đã đạt" : m.unlocked ? "" : " · chưa mở";
          const opt = document.createElement("option");
          opt.value = m.module_code;
          opt.textContent = `${m.module_code} — ${m.title || "Chương"}${mark}`;
          if (m.module_code === presetMod) opt.selected = true;
          pickMod.appendChild(opt);
        });
        if (presetMod && ![...pickMod.options].some((o) => o.value === presetMod)) {
          const opt = document.createElement("option");
          opt.value = presetMod;
          opt.textContent = `${presetMod} (đề)`;
          opt.selected = true;
          pickMod.appendChild(opt);
        }
      } catch (_) {
        /* overview optional for picker */
      }
      el("quiz-module-wrap").hidden = false;
    }

    const start = async () => {
      const course = pick.value;
      const mod = (pickMod?.value || "").trim().toUpperCase();
      const u = new URL(location.href);
      u.searchParams.set("course", course);
      if (mod) u.searchParams.set("module", mod);
      else u.searchParams.delete("module");
      history.replaceState({}, "", u);
      await runQuiz(sb, course, mod, certOpts);
    };

    await fillModules(pick.value);
    pick.addEventListener("change", async () => {
      await fillModules(pick.value);
      await start();
    });
    pickMod?.addEventListener("change", () => start());
    await start();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.sa247LearnerBoot) {
      sa247LearnerBoot.bindChrome().catch(() => {});
    } else {
      el("menu-toggle")?.addEventListener("click", () => {
        document.querySelector(".app-shell")?.classList.toggle("is-side-open");
      });
    }
    main().catch((e) => {
      console.error(e);
      el("quiz-status").textContent = friendlyError(e.message) || String(e);
    });
  });
})();
