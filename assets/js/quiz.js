/* SA247 Assessment v2 — kiểm tra cuối khóa ở chế độ tập trung.
   Từng câu · bảng câu · lưu nháp (máy + server) · xác nhận nộp · kết quả Đạt / Chưa đạt / Hết lượt.
   Đáp án đúng không bao giờ xuống trình duyệt; điểm do server chấm. */
(function () {
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  const params = new URLSearchParams(location.search);
  const COURSE = (params.get("course") || "").trim().toUpperCase();

  const learnHref = (code) => `../hoc/?course=${encodeURIComponent(code)}`;
  const historyHref = (code) => `../kiem-tra/?course=${encodeURIComponent(code)}`;
  const certHref = (code) => `../chung-nhan/mua.html?course=${encodeURIComponent(code)}`;
  const SUPPORT_HREF = "../phan-hoi/";

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function friendlyError(msg) {
    const raw = String(msg || "");
    if (raw.includes("progress_required")) {
      const p = raw.split("progress_required:")[1]?.split(":") || [];
      return p.length >= 3
        ? `🔒 Hoàn thành ${p[2]}/${p[2]} bài học để mở bài kiểm tra (bạn đã xong ${p[1]}/${p[2]}).`
        : "🔒 Hoàn thành tất cả bài học để mở bài kiểm tra.";
    }
    if (raw.includes("attempts_exhausted")) return "Bạn đã sử dụng hết số lần kiểm tra của khóa này.";
    if (raw.includes("already_passed")) return "Bạn đã đạt bài kiểm tra cuối khóa này.";
    if (raw.includes("cooldown_active")) return `Chờ thêm khoảng ${raw.split(":").pop()} phút trước khi làm lại.`;
    if (raw.includes("quiz_not_configured")) return "Khóa học chưa cấu hình bài kiểm tra cuối khóa.";
    if (raw.includes("not_enrolled")) return "Bạn chưa có quyền học khóa này.";
    if (raw.includes("duplicate_submit")) return "Bài vừa được nộp. Vui lòng đợi vài giây.";
    if (raw.includes("session_submitted")) return "Bài làm này đã được nộp.";
    if (raw.includes("quiz_empty")) return "Đề kiểm tra chưa có câu hỏi.";
    if (raw.includes("module_quiz_deprecated")) return "Kiểm tra cuối chương đã ngừng. SA247 chỉ còn một bài kiểm tra cuối khóa.";
    return "Không tải được bài kiểm tra. Vui lòng thử lại.";
  }

  function setStatus(html) {
    const s = $("qf-status");
    s.hidden = !html;
    s.innerHTML = html || "";
  }

  function show(id) {
    ["qf-intro", "qf-run", "qf-result"].forEach((x) => ($(x).hidden = x !== id));
    if (id) setStatus("");
    window.scrollTo({ top: 0 });
  }

  /* ─── Nháp đáp án ─────────────────────────────────────────── */
  const draftKey = (sid) => `sa247.quizdraft.${sid}`;
  function loadLocalDraft(sid) {
    try {
      return JSON.parse(localStorage.getItem(draftKey(sid)) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveLocalDraft(sid, answers) {
    try {
      localStorage.setItem(draftKey(sid), JSON.stringify(answers));
    } catch (_) {}
  }
  function clearLocalDraft(sid) {
    try {
      localStorage.removeItem(draftKey(sid));
    } catch (_) {}
  }

  /* ─── Trạng thái ──────────────────────────────────────────── */
  const st = {
    sb: null,
    quiz: null,
    idx: 0,
    answers: {},
    certOpts: { locked: false, name: "" },
    serverTimer: null,
    clock: null,
    submitting: false,
  };

  function answeredCount() {
    return st.quiz.questions.filter((q) => st.answers[q.id]).length;
  }

  function scheduleServerDraft() {
    clearTimeout(st.serverTimer);
    st.serverTimer = setTimeout(() => {
      st.sb.rpc("save_quiz_draft", { p_session_id: st.quiz.session_id, p_answers: st.answers }).then(
        () => {},
        () => {}
      );
    }, 1200);
  }

  /* ─── Màn giới thiệu ──────────────────────────────────────── */
  function renderIntro(ov, courseTitle) {
    const f = ov.final || {};
    const box = $("qf-intro");
    const used = f.attempts_used ?? 0;
    const max = f.attempts_max ?? 6;
    const left = f.attempts_left ?? Math.max(max - used, 0);
    const facts = `<ul class="qf-facts">
        <li><strong>${f.n_questions || 20}</strong><span>câu hỏi</span></li>
        <li><strong>${f.pass_percent || 70}%</strong><span>điểm đạt</span></li>
        <li><strong>${used}/${max}</strong><span>lần đã làm</span></li>
        ${f.time_limit_minutes
          ? `<li><strong>${f.time_limit_minutes} phút</strong><span>thời gian làm bài</span></li>`
          : "<li><strong>Không</strong><span>giới hạn thời gian</span></li>"}
      </ul>`;
    const timeRule = f.time_limit_minutes
      ? `<li>Thời gian làm bài <strong>${f.time_limit_minutes} phút</strong>, tính từ lúc bắt đầu. Hết giờ, bài được chấm theo đáp án đã lưu và lần làm được tính.</li>`
      : "<li>Không đếm giờ, không tự nộp. Thoát ra giữa chừng vẫn làm tiếp được — đáp án được lưu tự động.</li>";

    if (!f.quiz_configured) {
      box.innerHTML = `<h1>Kiểm tra cuối khóa</h1><p>Khóa học chưa cấu hình bài kiểm tra cuối khóa.</p>
        <p class="qf-actions"><a class="btn btn--line" href="${learnHref(COURSE)}">Quay lại khóa học</a></p>`;
      return show("qf-intro");
    }

    if (f.passed) {
      box.innerHTML = `<p class="qf-badge qf-badge--ok">✓ Đã đạt</p>
        <h1>Bạn đã đạt bài kiểm tra cuối khóa</h1>
        <p>Điểm cao nhất: <strong>${f.best_score ?? "—"}/100</strong>. Bài kiểm tra không làm lại sau khi đã đạt.</p>
        <p class="qf-actions">
          <a class="btn btn--amber" href="${certHref(COURSE)}">Đăng ký nhận giấy chứng nhận</a>
          <a class="btn btn--line" href="${historyHref(COURSE)}">Xem lịch sử kiểm tra</a>
        </p>
        <p class="meta">Chứng nhận chỉ được cấp sau khi hoàn thành khóa học và đạt yêu cầu kiểm tra.</p>`;
      return show("qf-intro");
    }

    if (!f.unlocked) {
      box.innerHTML = `<p class="qf-badge">🔒 Chưa mở</p>
        <h1>Hoàn thành khóa học để mở bài kiểm tra</h1>
        <p>Bạn đã hoàn thành <strong>${f.lessons_done ?? 0}/${f.lessons_total ?? 0}</strong> bài học. Bài kiểm tra mở khi bạn xem hết tất cả bài học.</p>
        <div class="qf-meter" aria-hidden="true"><i style="width:${Math.min(100, f.progress_percent || 0)}%"></i></div>
        <p class="qf-actions"><a class="btn btn--amber" href="${learnHref(COURSE)}">Tiếp tục học</a></p>`;
      return show("qf-intro");
    }

    if (left <= 0 && !f.has_open_session) {
      box.innerHTML = `<p class="qf-badge qf-badge--warn">Hết lượt</p>
        <h1>Bạn đã sử dụng ${used}/${max} lần kiểm tra</h1>
        <p>Điểm cao nhất: <strong>${f.best_score ?? "—"}/100</strong> (cần ${f.pass_percent || 70}/100).
        Nếu cần hỗ trợ, hãy liên hệ SA247 — bộ phận đào tạo sẽ xem xét từng trường hợp.</p>
        <p class="qf-actions">
          <a class="btn btn--amber" href="${SUPPORT_HREF}">Liên hệ hỗ trợ</a>
          <a class="btn btn--line" href="${historyHref(COURSE)}">Xem lịch sử kiểm tra</a>
        </p>`;
      return show("qf-intro");
    }

    const resume = f.has_open_session;
    box.innerHTML = `<h1>${esc(courseTitle || "Kiểm tra cuối khóa")}</h1>
      ${facts}
      <ul class="qf-rules">
        <li>Làm lần lượt từng câu; đi tới, lui và đổi đáp án tự do trước khi nộp.</li>
        ${timeRule}
        <li>Lần làm được tính khi bạn bấm <strong>Nộp bài</strong>${f.time_limit_minutes ? " hoặc khi hết giờ" : ""}. Mỗi lần làm là một đề khác nhau.</li>
        <li>Kết quả chỉ hiện điểm tổng, không hiện đáp án từng câu.</li>
      </ul>
      <p class="qf-actions">
        <button type="button" class="btn btn--amber" id="qf-start">${
          resume ? "Tiếp tục bài đang làm" : used > 0 ? `Làm lại bài kiểm tra (lần ${used + 1}/${max})` : "Bắt đầu kiểm tra"
        }</button>
        <a class="btn btn--line" href="${learnHref(COURSE)}">Xem lại khóa học</a>
      </p>`;
    show("qf-intro");
    $("qf-start").addEventListener("click", startAttempt);
  }

  /* ─── Làm bài ─────────────────────────────────────────────── */
  async function startAttempt() {
    const btn = $("qf-start");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Đang chuẩn bị đề…";
    }
    const { data, error } = await st.sb.rpc("start_quiz_attempt", { p_course_code: COURSE, p_module_code: null });
    if (error || !data?.questions?.length) {
      setStatus(`<span class="form-msg is-err">${esc(friendlyError(error?.message))}</span>`);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Thử lại";
      }
      return;
    }
    st.quiz = data;
    const valid = new Set();
    data.questions.forEach((q) => (q.choices || []).forEach((c) => valid.add(q.id + "|" + c.key)));
    const merged = Object.assign({}, data.draft || {}, loadLocalDraft(data.session_id));
    st.answers = {};
    Object.entries(merged).forEach(([qid, key]) => {
      if (valid.has(qid + "|" + key)) st.answers[qid] = key;
    });
    const firstOpen = data.questions.findIndex((q) => !st.answers[q.id]);
    st.idx = firstOpen >= 0 ? firstOpen : 0;
    $("qf-meta").textContent = `Lần ${data.attempt_no}/${data.attempts_max}`;
    document.body.classList.add("qf-body--running");
    show("qf-run");
    renderGrid();
    renderQuestion();
    startCountdown(data);
  }

  function startCountdown(data) {
    clearInterval(st.clock);
    if (!data.expires_at) return;
    const skew = data.server_now ? Date.now() - new Date(data.server_now).getTime() : 0;
    const end = new Date(data.expires_at).getTime() + skew;
    const meta = `Lần ${data.attempt_no}/${data.attempts_max}`;
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      const mm = String(Math.floor(left / 60)).padStart(2, "0");
      const ss = String(left % 60).padStart(2, "0");
      $("qf-meta").textContent = `${meta} · ⏱ ${mm}:${ss}`;
      $("qf-meta").classList.toggle("is-low", left <= 60);
      if (left === 0) {
        clearInterval(st.clock);
        autoSubmit();
      }
    };
    tick();
    st.clock = setInterval(tick, 1000);
  }

  async function autoSubmit() {
    if (st.submitting || !st.quiz) return;
    st.submitting = true;
    clearTimeout(st.serverTimer);
    try { $("qf-confirm").close(); } catch (_) {}
    setStatus('<span class="form-msg">Hết giờ — đang chấm bài theo đáp án đã chọn…</span>');
    const { data, error } = await st.sb.rpc("submit_quiz_attempt", {
      p_session_id: st.quiz.session_id,
      p_answers: st.answers,
      p_full_name: st.certOpts.name || null,
    });
    st.submitting = false;
    if (error) {
      setStatus(`<span class="form-msg is-err">${esc(friendlyError(error.message))}</span>`);
      return;
    }
    clearLocalDraft(st.quiz.session_id);
    document.body.classList.remove("qf-body--running");
    await renderResult(data);
  }

  function renderQuestion() {
    const qs = st.quiz.questions;
    const q = qs[st.idx];
    const n = qs.length;
    const letters = "ABCDEFGH";
    $("qf-card").innerHTML = `<p class="qf-card__no">Câu ${st.idx + 1}</p>
      <h2 class="qf-card__q">${esc(q.q)}</h2>
      <div class="qf-choices" role="radiogroup" aria-label="Phương án">
        ${(q.choices || [])
          .map(
            (c, i) => `<label class="qf-choice">
              <input type="radio" name="qf-choice" value="${esc(c.key)}" ${st.answers[q.id] === c.key ? "checked" : ""} />
              <span class="qf-choice__key">${letters[i] || i + 1}</span>
              <span class="qf-choice__text">${esc(c.text)}</span>
            </label>`
          )
          .join("")}
      </div>`;
    $("qf-card")
      .querySelectorAll('input[name="qf-choice"]')
      .forEach((inp) => inp.addEventListener("change", () => pick(inp.value)));
    $("qf-prev").disabled = st.idx === 0;
    $("qf-next").textContent = st.idx === n - 1 ? "Xem lại & nộp →" : "Câu tiếp →";
    updateProgress();
  }

  function pick(key) {
    const q = st.quiz.questions[st.idx];
    st.answers[q.id] = key;
    saveLocalDraft(st.quiz.session_id, st.answers);
    scheduleServerDraft();
    updateProgress();
    renderGrid();
  }

  function updateProgress() {
    const n = st.quiz.questions.length;
    const a = answeredCount();
    $("qf-pos").textContent = `Câu ${st.idx + 1}/${n}`;
    $("qf-answered").textContent = `Đã trả lời ${a}/${n}`;
    $("qf-bar").style.width = `${Math.round((a / n) * 100)}%`;
  }

  function renderGrid() {
    $("qf-grid").innerHTML = st.quiz.questions
      .map((q, i) => {
        const done = Boolean(st.answers[q.id]);
        return `<button type="button" class="qf-grid__cell${done ? " is-done" : ""}${i === st.idx ? " is-current" : ""}"
          data-i="${i}" aria-label="Câu ${i + 1}${done ? " — đã trả lời" : " — chưa trả lời"}"${i === st.idx ? ' aria-current="true"' : ""}>${i + 1}</button>`;
      })
      .join("");
    $("qf-grid")
      .querySelectorAll("[data-i]")
      .forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.i))));
  }

  function go(i) {
    const n = st.quiz.questions.length;
    if (i < 0 || i >= n) return;
    st.idx = i;
    renderQuestion();
    renderGrid();
    $("qf-card").scrollIntoView({ block: "nearest" });
  }

  /* ─── Nộp bài ─────────────────────────────────────────────── */
  function openConfirm() {
    const n = st.quiz.questions.length;
    const a = answeredCount();
    $("qf-confirm-summary").innerHTML =
      a < n
        ? `Đã trả lời <strong>${a}/${n}</strong> · Chưa trả lời <strong>${n - a}/${n}</strong>. Câu bỏ trống được tính là sai.`
        : `Bạn đã trả lời đủ <strong>${n}/${n}</strong> câu. Sau khi nộp, lần làm này được tính.`;
    const name = $("qf-full-name");
    if (!name.value) name.value = st.certOpts.name || "";
    name.readOnly = st.certOpts.locked;
    $("qf-name-ok").checked = st.certOpts.locked;
    $("qf-name-locked").hidden = !st.certOpts.locked;
    $("qf-confirm-err").hidden = true;
    $("qf-confirm").showModal();
  }

  async function submit() {
    if (st.submitting) return;
    const fullName = $("qf-full-name").value.trim();
    const err = $("qf-confirm-err");
    if (!fullName || !$("qf-name-ok").checked) {
      err.textContent = "Nhập và xác nhận họ tên sẽ in trên giấy chứng nhận.";
      err.hidden = false;
      return;
    }
    st.submitting = true;
    const go = $("qf-confirm-go");
    go.disabled = true;
    go.textContent = "Đang chấm…";
    if (!st.certOpts.locked) {
      try {
        await sa247Auth.updateProfile({ cert_display_name: fullName });
      } catch (_) {}
    }
    clearTimeout(st.serverTimer);
    const { data, error } = await st.sb.rpc("submit_quiz_attempt", {
      p_session_id: st.quiz.session_id,
      p_answers: st.answers,
      p_full_name: fullName,
    });
    go.disabled = false;
    go.textContent = "Nộp bài";
    st.submitting = false;
    if (error) {
      err.textContent = friendlyError(error.message);
      err.hidden = false;
      return;
    }
    clearLocalDraft(st.quiz.session_id);
    clearInterval(st.clock);
    $("qf-confirm").close();
    document.body.classList.remove("qf-body--running");
    await renderResult(data);
  }

  async function certPrices() {
    try {
      const { data } = await st.sb.rpc("get_product_prices");
      return {
        pdf: data?.cert_pdf?.amount != null ? fmtVnd(data.cert_pdf.amount) : "",
        hard: data?.cert_hard?.amount != null ? fmtVnd(data.cert_hard.amount) : "",
        ship: data?.shipping_default?.amount != null ? fmtVnd(data.shipping_default.amount) : "",
      };
    } catch {
      return { pdf: "", hard: "", ship: "" };
    }
  }

  async function renderResult(d) {
    const box = $("qf-result");
    const head = `${d.correct}/${d.total} câu đúng · ${d.score_percent}/100 · Lần ${d.attempt_no}/${d.attempts_max}${d.expired ? " · hết giờ" : ""}`;
    clearInterval(st.clock);
    $("qf-meta").textContent = "";
    if (d.passed) {
      const status = d.cert_status || "";
      let cta;
      if (status === "valid" || status === "issued") {
        cta = `<a class="btn btn--amber" href="../chung-nhan/">Xem giấy chứng nhận</a>`;
      } else if (status === "revoked") {
        cta = `<a class="btn btn--amber" href="${SUPPORT_HREF}">Liên hệ hỗ trợ</a>`;
      } else if (status === "eligible") {
        const p = await certPrices();
        cta = `<a class="btn btn--amber" href="${certHref(COURSE)}&amp;type=cert_pdf">Đăng ký nhận giấy chứng nhận PDF${p.pdf ? ` · ${p.pdf}` : ""}</a>
          <a class="btn btn--line" href="${certHref(COURSE)}&amp;type=cert_hard">Đăng ký nhận giấy chứng nhận bản cứng${p.hard ? ` · ${p.hard}` : ""}${p.ship ? ` + ${p.ship} phí vận chuyển` : ""}</a>`;
      } else {
        cta = `<a class="btn btn--amber" href="../chung-nhan/">Xem điều kiện nhận giấy chứng nhận</a>`;
      }
      box.innerHTML = `<p class="qf-badge qf-badge--ok">✓ ĐẠT</p>
        <h1>Chúc mừng! Bạn đã đạt bài kiểm tra cuối khóa</h1>
        <p class="qf-score">${head}</p>
        ${status === "eligible" ? '<p>🎓 Bạn đã đủ điều kiện nhận giấy chứng nhận.</p>' : ""}
        ${status === "revoked" ? "<p>Giấy chứng nhận của khóa này đã bị thu hồi; kết quả mới không tự cấp lại.</p>" : ""}
        <p class="qf-actions">${cta}<a class="btn btn--line" href="${historyHref(COURSE)}">Xem lịch sử kiểm tra</a></p>
        <p class="meta">Bạn học để hoàn thành khóa học. Chứng nhận là lựa chọn sau khi bạn đạt yêu cầu.</p>`;
    } else if (Number(d.attempts_left) > 0) {
      box.innerHTML = `<p class="qf-badge qf-badge--warn">CHƯA ĐẠT</p>
        <h1>Bạn chưa đạt lần này</h1>
        <p class="qf-score">${head}</p>
        <p>Cần ${d.pass_percent}/100 để đạt. Bạn còn <strong>${d.attempts_left}/${d.attempts_max}</strong> lượt — lần sau là một đề khác. Nên xem lại các chương còn chưa chắc trước khi làm lại.</p>
        <p class="qf-actions">
          <a class="btn btn--amber" href="${location.pathname}?course=${encodeURIComponent(COURSE)}">Làm lại bài kiểm tra</a>
          <a class="btn btn--line" href="${learnHref(COURSE)}">Xem lại khóa học</a>
        </p>`;
    } else {
      box.innerHTML = `<p class="qf-badge qf-badge--warn">HẾT LƯỢT</p>
        <h1>Bạn đã sử dụng ${d.attempts_used}/${d.attempts_max} lần kiểm tra</h1>
        <p class="qf-score">${head}</p>
        <p>Bài kiểm tra của khóa này đã hết lượt. Nếu cần hỗ trợ, hãy liên hệ SA247 — bộ phận đào tạo sẽ xem xét từng trường hợp.</p>
        <p class="qf-actions">
          <a class="btn btn--amber" href="${SUPPORT_HREF}">Liên hệ hỗ trợ</a>
          <a class="btn btn--line" href="${historyHref(COURSE)}">Xem lịch sử kiểm tra</a>
        </p>`;
    }
    show("qf-result");
  }

  /* ─── Khởi động ───────────────────────────────────────────── */
  function bindRun() {
    $("qf-prev").addEventListener("click", () => go(st.idx - 1));
    $("qf-next").addEventListener("click", () => {
      if (st.idx === st.quiz.questions.length - 1) openConfirm();
      else go(st.idx + 1);
    });
    $("qf-submit").addEventListener("click", openConfirm);
    $("qf-confirm-back").addEventListener("click", () => {
      $("qf-confirm").close();
      const firstOpen = st.quiz.questions.findIndex((q) => !st.answers[q.id]);
      if (firstOpen >= 0) go(firstOpen);
    });
    $("qf-confirm-go").addEventListener("click", submit);
    document.addEventListener("keydown", (e) => {
      if ($("qf-run").hidden || $("qf-confirm").open) return;
      if (e.target.closest("input[type=text], textarea")) return;
      if (e.key === "ArrowRight") go(st.idx + 1);
      else if (e.key === "ArrowLeft") go(st.idx - 1);
      else {
        const i = "1234abcd".indexOf(e.key.toLowerCase()) % 4;
        const inputs = $("qf-card").querySelectorAll('input[name="qf-choice"]');
        if (i >= 0 && inputs[i]) {
          inputs[i].checked = true;
          pick(inputs[i].value);
        }
      }
    });
    window.addEventListener("beforeunload", () => {
      if (st.quiz && !$("qf-run").hidden) {
        saveLocalDraft(st.quiz.session_id, st.answers);
      }
    });
  }

  async function main() {
    if (!window.sa247Auth?.ready) return setStatus("Thiếu cấu hình hệ thống. Vui lòng tải lại trang.");
    if (!COURSE) {
      location.replace("../kiem-tra/");
      return;
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      location.replace(`../auth/login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    st.sb = await sa247Auth.ensureClient();
    $("qf-course").textContent = COURSE;
    $("qf-back").href = learnHref(COURSE);
    bindRun();

    const [{ data: ov, error }, profile, locked] = await Promise.all([
      st.sb.rpc("get_assessment_overview", { p_course_code: COURSE }),
      sa247Auth.getProfile({ session, timeoutMs: 4000 }).catch(() => null),
      st.sb.rpc("learner_has_issued_certificate", { p_uid: session.user.id }).then(
        (r) => Boolean(r.data),
        () => false
      ),
    ]);
    st.certOpts = {
      locked: locked && !sa247Auth.isStaffRole?.(profile?.role),
      name: profile?.cert_display_name || profile?.full_name || "",
    };
    if (error) return setStatus(esc(friendlyError(error.message)) + ` <a href="../kiem-tra/">Kiểm tra &amp; kết quả</a>`);
    $("qf-course").textContent = `${ov.course_code} · ${ov.course_title || ""}`;
    document.title = `Kiểm tra cuối khóa · ${ov.course_code} · SA247`;
    renderIntro(ov, ov.course_title);
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => {
      console.error(e);
      setStatus("Không tải được bài kiểm tra. Vui lòng thử lại.");
    });
  });
})();
