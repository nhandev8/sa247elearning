/* SA247 classroom — Tiếp tục học P0: resume bài/giây, màn hoàn thành, bài tiếp theo */
(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bootJson() {
    const el = document.getElementById("sa247-course-boot");
    if (!el) return {};
    try {
      return JSON.parse(el.textContent || "{}");
    } catch {
      return {};
    }
  }

  function freePreviewCount(total) {
    if (!total || total <= 0) return 0;
    return Math.min(5, Math.round(total / 5));
  }

  function queryLessonTarget() {
    try {
      const q = new URLSearchParams(location.search);
      return {
        lessonCode: (q.get("lesson") || "").trim(),
        lessonId: (q.get("lesson_id") || "").trim(),
      };
    } catch {
      return { lessonCode: "", lessonId: "" };
    }
  }

  let ytApiReady = null;
  function loadYtApi() {
    if (ytApiReady) return ytApiReady;
    ytApiReady = new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === "function") prev();
        resolve();
      };
      if (!document.querySelector("script[data-sa247-yt]")) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.dataset.sa247Yt = "1";
        document.head.appendChild(s);
      }
      // Fallback if API already mid-load
      let n = 0;
      const t = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(t);
          resolve();
        } else if (++n > 100) {
          clearInterval(t);
          resolve();
        }
      }, 100);
    });
    return ytApiReady;
  }

  /* Hoàn thành bài do server quyết định (record_watch): chỉ tính đoạn phát thật ở tốc độ 1×. */
  async function recordWatch(sb, lessonId, segments, position, duration) {
    if (String(lessonId).startsWith("static:")) return null;
    const { data, error } = await sb.rpc("record_watch", {
      p_lesson_id: lessonId,
      p_segments: segments,
      p_position: Math.max(0, Math.floor(Number(position) || 0)),
      p_client_duration: duration > 0 ? Math.round(duration) : null,
    });
    if (error) throw error;
    return data;
  }

  function mergeSegs(list) {
    const s = (list || [])
      .filter((x) => Array.isArray(x) && Number(x[1]) > Number(x[0]))
      .map((x) => [Number(x[0]), Number(x[1])])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out = [];
    s.forEach(([a, b]) => {
      const last = out[out.length - 1];
      if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
      else out.push([a, b]);
    });
    return out.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
  }

  function segSeconds(list) {
    return (list || []).reduce((n, x) => n + (x[1] - x[0]), 0);
  }

  function localSegs(lessonId) {
    try {
      return JSON.parse(localStorage.getItem("sa247_watch_" + lessonId) || "[]");
    } catch {
      return [];
    }
  }

  function storeLocalSegs(lessonId, segs) {
    try {
      if (segs) localStorage.setItem("sa247_watch_" + lessonId, JSON.stringify(segs));
      else localStorage.removeItem("sa247_watch_" + lessonId);
    } catch {
      /* ignore */
    }
  }

  function isCanonicalLesson(l) {
    if (!String(l?.lesson_code || "").trim()) return false;
    if (l.publish_status === "replaced") return false;
    return true;
  }

  function sanitizeModules(modules) {
    return (modules || []).map((m) => ({
      ...m,
      lessons: (m.lessons || [])
        .filter(isCanonicalLesson)
        .slice()
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }));
  }

  function applyFreeQuota(modules) {
    const flat = [];
    (modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => flat.push(l));
    });
    const quota = freePreviewCount(flat.length);
    // Học thử = đúng các bài được đánh dấu (tối đa quota 1/5, ≤ 5). Không tự mở bài khác.
    const marked = flat.filter((l) => l.access === "hoc_thu" || l.is_free === true).slice(0, quota);
    const openSet = new Set(marked);
    flat.forEach((l) => {
      const open = openSet.has(l);
      l.is_free = open;
      l.access = open ? "hoc_thu" : l.access === "hoc_thu" ? "mo_khoa" : l.access || "mo_khoa";
    });
    return marked.length;
  }

  function curriculumToModules(cur) {
    return (cur.modules || []).map((m) => ({
      id: m.module_id,
      title: m.name || m.module_id,
      code: m.module_id,
      lessons: (m.lessons || []).map((l) => ({
        id: "static:" + (l.lesson_code || l.bxx_code),
        lesson_code: l.lesson_code,
        title: l.display_title || l.title || l.lesson_code,
        display_title: l.display_title,
        youtube_video_id: l.youtube_video_id || "",
        access: l.access || "mo_khoa",
        is_free: l.access === "hoc_thu",
        sort_order: l.sort_order || 0,
        publish_status: l.publish_status || "draft",
        has_video: !!(l.youtube_video_id || l.has_video),
        description: l.description || l.youtube_description || "",
        description_short: l.description_short || "",
      })),
    }));
  }

  async function loadStaticCurriculum(host, code) {
    const url =
      host.getAttribute("data-curriculum-url") ||
      `../data/curriculum/${encodeURIComponent(code)}.v1.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Không tải được curriculum Bxx");
    return res.json();
  }

  function flattenLessons(modules) {
    const list = [];
    sanitizeModules(modules).forEach((m) => {
      const lessons = (m.lessons || []).map((l) => ({
        ...l,
        is_free: l.is_free === true || l.access === "hoc_thu",
        title: l.title || l.display_title || l.lesson_code || "Bài học",
      }));
      lessons.forEach((l) => {
        list.push({
          ...l,
          moduleTitle: m.title,
          moduleId: m.id,
          moduleCode: m.code || "",
        });
      });
    });
    return list;
  }

  function pickResume(flat, progressMap, target) {
    if (target?.lessonId) {
      const byId = flat.find((l) => l.id === target.lessonId);
      if (byId) return byId;
    }
    if (target?.lessonCode) {
      const byCode = flat.find((l) => l.lesson_code === target.lessonCode);
      if (byCode) return byCode;
    }
    if (window.sa247Continue) {
      const rows = Object.keys(progressMap).map((id) => ({
        lesson_id: id,
        ...progressMap[id],
      }));
      return sa247Continue.resolveCourseContinue(flat, rows).lesson;
    }
    let best = null;
    let bestAt = "";
    flat.forEach((l) => {
      const p = progressMap[l.id];
      if (!p?.last_watched_at) return;
      if (!p.completed && p.last_watched_at > bestAt) {
        bestAt = p.last_watched_at;
        best = l;
      }
    });
    if (best) return best;
    return flat.find((l) => !progressMap[l.id]?.completed) || flat[0] || null;
  }

  function renderClassroom(host, ctx) {
    const { course, modules, flat, progressMap, enrolled, loginHref, freeCount, sb } = ctx;
    const learnMode = ctx.mode === "learn";
    const done = flat.filter((l) => progressMap[l.id]?.completed).length;
    const total = flat.length || 1;
    const pct = Math.round((done / total) * 100);
    const target = queryLessonTarget();
    const resume = pickResume(flat, progressMap, target);
    const openN = freeCount ?? flat.filter((l) => l.is_free).length;
    const quizHref = `../quiz/?course=${encodeURIComponent(course.code)}`;
    let assess = ctx.assess || null;

    let ytPlayer = null;
    let watchTimer = null;
    let currentLesson = null;

    function finalRowHtml() {
      if (!enrolled) return "";
      const doneN = flat.filter((l) => progressMap[l.id]?.completed).length;
      const a = assess?.assessment || null;
      let status;
      let action = "";
      if (a && a.passed) {
        status = `✓ Đạt ${a.best_score ?? ""}/100`;
        action = `<a class="btn btn--amber btn--small" href="../chung-nhan/">Giấy chứng nhận</a>`;
      } else if (doneN < flat.length) {
        status = `🔒 Hoàn thành ${doneN}/${flat.length} bài để mở`;
      } else if (a && a.attempts_used >= a.attempts_max && !a.has_open_session) {
        status = `Đã dùng ${a.attempts_used}/${a.attempts_max} lần`;
        action = `<a class="btn btn--line btn--small" href="../phan-hoi/">Liên hệ hỗ trợ</a>`;
      } else {
        status = a && a.attempts_used > 0 ? `Chưa đạt · còn ${a.attempts_left}/${a.attempts_max} lần` : "✓ Sẵn sàng";
        action = `<a class="btn btn--amber btn--small" href="${quizHref}">${
          a?.has_open_session ? "Tiếp tục kiểm tra" : a?.attempts_used > 0 ? "Làm lại" : "Bắt đầu kiểm tra"
        }</a>`;
      }
      return `<div class="classroom__final">
        <p class="classroom__final-title">Kiểm tra cuối khóa</p>
        <p class="meta">${esc(status)}</p>
        ${action}
      </div>`;
    }

    function paintFinalRow() {
      const box = host.querySelector("[data-final-row]");
      if (box) box.innerHTML = finalRowHtml();
    }

    async function refreshAssess() {
      if (!enrolled || !sb) return;
      try {
        const { data } = await sb.rpc("get_my_course_state", { p_course_code: course.code });
        if (data) {
          assess = data;
          window.dispatchEvent(new CustomEvent("sa247:course-state", { detail: data }));
        }
      } catch (_) {}
      paintFinalRow();
    }

    function pagerHtml(lesson) {
      const i = flat.findIndex((l) => l.id === lesson.id);
      const prev = i > 0 ? flat[i - 1] : null;
      const next = i >= 0 ? flat[i + 1] : null;
      const nextLocked = next && !progressMap[lesson.id]?.completed;
      const allDone = flat.every((l) => progressMap[l.id]?.completed);
      const nextBtn = next
        ? `<button type="button" class="btn btn--amber btn--small" data-next-lesson="${esc(next.id)}"${
            nextLocked ? ' disabled title="Xem hết bài này để mở bài tiếp theo"' : ""
          }>Bài tiếp theo →</button>`
        : allDone
          ? `<a class="btn btn--amber btn--small" href="${quizHref}">Kiểm tra cuối khóa →</a>`
          : "";
      return `${prev ? `<button type="button" class="btn btn--line btn--small" data-next-lesson="${esc(prev.id)}">← Bài trước</button>` : "<span></span>"}
        <span class="classroom__pos">Bài ${i + 1}/${flat.length}</span>
        ${nextBtn || "<span></span>"}`;
    }

    function paintPager(lesson) {
      const bar = host.querySelector("[data-pager]");
      if (bar && lesson && enrolled) {
        bar.innerHTML = pagerHtml(lesson);
        bar.hidden = false;
      }
    }

    let flushOnLeave = null;
    window.addEventListener("pagehide", () => flushOnLeave && flushOnLeave());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && flushOnLeave) flushOnLeave();
    });

    function stopWatch() {
      if (flushOnLeave) {
        const f = flushOnLeave;
        flushOnLeave = null;
        f();
      }
      if (watchTimer) {
        clearInterval(watchTimer);
        watchTimer = null;
      }
      try {
        ytPlayer?.destroy?.();
      } catch {
        /* ignore */
      }
      ytPlayer = null;
    }

    function showCompleteScreen(lesson) {
      stopWatch();
      const next =
        (window.sa247Continue && sa247Continue.nextLessonAfter(flat, lesson.id)) ||
        flat[flat.findIndex((l) => l.id === lesson.id) + 1] ||
        null;
      const doneN = flat.filter((l) => progressMap[l.id]?.completed).length;
      const pctN = Math.round((doneN / (flat.length || 1)) * 100);
      const player = $("#classroom-player", host);
      const meta = $("#classroom-meta", host);
      player.innerHTML = `<div class="lesson-done">
        <p class="lesson-done__check" aria-hidden="true">✓</p>
        <h3>Bạn đã hoàn thành bài học</h3>
        <p class="lead"><strong>${esc(lesson.moduleCode || lesson.moduleTitle || "")}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</strong><br />${esc(lesson.title)}</p>
        <p class="meta">Tiến độ khóa: <strong>${pctN}%</strong> · ${doneN}/${flat.length} bài</p>
        ${sa247Continue ? sa247Continue.progressBarHtml(pctN) : ""}
      </div>`;
      const pending = flat.find((l) => !progressMap[l.id]?.completed && l.id !== lesson.id);
      if (next) {
        const newChapter = String(next.moduleCode || "") !== String(lesson.moduleCode || "");
        meta.innerHTML = `<div class="lesson-next">
          <p class="kicker">${newChapter ? "Chương tiếp theo" : "Bài tiếp theo"}</p>
          <h4>${esc(next.moduleTitle || next.moduleCode || "")}</h4>
          <p>${esc(next.title)}</p>
          <div class="lesson-next__actions">
            <button type="button" class="btn btn--amber" data-next-lesson="${esc(next.id)}">Học bài tiếp theo →</button>
          </div>
        </div>`;
      } else if (pending) {
        meta.innerHTML = `<div class="lesson-next">
          <p class="lead"><strong>Còn ${flat.length - doneN} bài chưa hoàn thành.</strong></p>
          <p class="meta">Hoàn thành tất cả bài học để mở bài kiểm tra cuối khóa.</p>
          <div class="lesson-next__actions">
            <button type="button" class="btn btn--amber" data-next-lesson="${esc(pending.id)}">Học bài còn thiếu →</button>
          </div>
        </div>`;
      } else {
        meta.innerHTML = `<div class="lesson-next">
          <p class="lead"><strong>🎉 Bạn đã hoàn thành tất cả bài học của khóa.</strong></p>
          <p class="meta">Bước tiếp theo: bài kiểm tra cuối khóa — không giới hạn thời gian, tối đa 6 lần.</p>
          <div class="lesson-next__actions">
            <a class="btn btn--amber" href="${quizHref}">Bắt đầu kiểm tra cuối khóa</a>
          </div>
        </div>`;
      }
      refreshAssess();
      host.querySelector(".classroom__head .progress-bar > span")?.style.setProperty("width", pctN + "%");
      const headMeta = host.querySelector(".classroom__head .meta strong");
      if (headMeta) headMeta.textContent = `${doneN}/${flat.length}`;
    }

    host.innerHTML = `
      <div class="classroom${learnMode ? " classroom--learn" : ""}" data-enrolled="${enrolled ? "1" : "0"}">
        ${
          learnMode
            ? ""
            : `<div class="classroom__head">
          <div>
            <h3>Lớp học · ${esc(course.code)}</h3>
            <p class="meta">Tiến độ: <strong>${done}/${flat.length}</strong> bài (${pct}%)</p>
            <p class="meta">${
              enrolled
                ? "Xem hết từng video (tốc độ 1×) để mở bài tiếp theo."
                : `Mở sẵn <strong>${openN}</strong> video · còn lại khóa đến khi đăng ký.`
            }</p>
            <div class="progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          </div>
          <div class="classroom__actions">
            ${
              enrolled
                ? `<a class="btn btn--amber btn--small" href="../hoc/?course=${encodeURIComponent(course.code)}">Vào trang học</a>`
                : `<a class="btn btn--amber btn--small" href="#dang-ky">Mở khóa khóa học</a>
                   <a class="btn btn--line btn--small" href="${esc(loginHref)}">Đăng nhập</a>`
            }
            <button type="button" class="btn btn--line btn--small classroom__toggle" data-toggle-side>Mục lục</button>
          </div>
        </div>`
        }
        <div class="classroom__body">
          <aside class="classroom__side" id="classroom-side" aria-label="Mục lục khóa học">
            <div class="classroom__side-top">
              <p class="classroom__side-label">Mục lục · ${done}/${flat.length} bài</p>
              <button type="button" class="classroom__side-close" data-toggle-side aria-label="Đóng mục lục">×</button>
            </div>
            <div class="classroom__mods"></div>
            <div data-final-row></div>
          </aside>
          <div class="classroom__main">
            <div class="classroom__player" id="classroom-player">
              <p class="lead">Chọn một video trong mục lục để xem.</p>
            </div>
            <div class="classroom__pager" data-pager hidden></div>
            <div class="classroom__meta" id="classroom-meta"></div>
          </div>
        </div>
        <div class="classroom__scrim" data-toggle-side></div>
      </div>`;

    const modsEl = $(".classroom__mods", host);
    const isSeqLocked = (l) => enrolled && l.locked === true;

    function renderSide() {
    const openIds = new Set(
      [...modsEl.querySelectorAll("details[open]")].map((d) => d.getAttribute("data-mod"))
    );
    modsEl.innerHTML = "";
    (modules || []).forEach((m, mi) => {
      const lessons = (m.lessons || [])
        .slice()
        .map((l) => ({
          ...l,
          is_free: l.is_free === true || l.access === "hoc_thu",
          title: l.title || l.display_title || l.lesson_code || "Bài học",
        }))
        .filter((l) => l.publish_status !== "replaced")
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      if (!lessons.length) return;
      const modDone = lessons.filter((l) => progressMap[l.id]?.completed).length;
      const details = document.createElement("details");
      details.className = "classroom__mod";
      details.setAttribute("data-mod", String(m.id || mi));
      const activeId = currentLesson?.id || resume?.id;
      details.open =
        openIds.has(String(m.id || mi)) || (!openIds.size && mi === 0) || lessons.some((l) => l.id === activeId);
      details.innerHTML = `<summary><span>${esc(m.title)}</span><small>${modDone}/${lessons.length}</small></summary>`;
      const ul = document.createElement("ul");
      lessons.forEach((l) => {
        const li = document.createElement("li");
        const seqLocked = isSeqLocked(l);
        const locked = (!enrolled && !l.is_free) || seqLocked;
        const doneL = progressMap[l.id]?.completed;
        const pctL = Number(progressMap[l.id]?.progress_percent) || 0;
        const playable = !!(l.youtube_video_id || l.has_video || seqLocked);
        li.innerHTML = `<button type="button" class="classroom__lesson${doneL ? " is-done" : ""}${locked ? " is-locked" : ""}${l.id === activeId ? " is-active" : ""}" data-lesson="${esc(l.id)}">
          <span class="classroom__lesson-title">${esc(l.title)}</span>
          ${l.is_free && !enrolled ? '<span class="badge badge--free">Mở sẵn</span>' : ""}
          ${doneL ? '<span class="badge">Đã học</span>' : ""}
          ${enrolled && !doneL && !locked && pctL > 0 ? `<span class="badge">${pctL}%</span>` : ""}
          ${seqLocked ? '<span class="badge">🔒</span>' : locked ? '<span class="badge">Khóa</span>' : ""}
          ${!locked && !playable ? '<span class="badge">Sắp có</span>' : ""}
        </button>`;
        ul.appendChild(li);
      });
      details.appendChild(ul);
      modsEl.appendChild(details);
    });
    paintFinalRow();
    }
    renderSide();

    function updateHead() {
      const doneN = flat.filter((l) => progressMap[l.id]?.completed).length;
      const pctN = Math.round((doneN / (flat.length || 1)) * 100);
      host.querySelector(".classroom__head .progress-bar > span")?.style.setProperty("width", pctN + "%");
      const headMeta = host.querySelector(".classroom__head .meta strong");
      if (headMeta) headMeta.textContent = `${doneN}/${flat.length}`;
      const sideLabel = host.querySelector(".classroom__side-label");
      if (sideLabel) sideLabel.textContent = `Mục lục · ${doneN}/${flat.length} bài`;
      window.dispatchEvent(
        new CustomEvent("sa247:course-progress", { detail: { done: doneN, total: flat.length, percent: pctN } })
      );
    }

    async function refreshLocks() {
      if (!enrolled || !sb) return;
      try {
        const { data } = await sb.rpc("get_course_outline", { p_course_code: course.code });
        const byId = Object.create(null);
        (data?.modules || []).forEach((m) => (m.lessons || []).forEach((l) => (byId[l.id] = l)));
        const apply = (l) => {
          const s = byId[l.id];
          if (!s) return;
          l.locked = s.locked === true;
          if (s.youtube_video_id) l.youtube_video_id = s.youtube_video_id;
          l.has_video = !!s.youtube_video_id;
        };
        flat.forEach(apply);
        (modules || []).forEach((m) => (m.lessons || []).forEach(apply));
        renderSide();
      } catch (e) {
        console.warn("[learn-player] refresh locks", e);
      }
    }

    function firstOpenLesson() {
      return (
        flat.find((l) => !progressMap[l.id]?.completed && !isSeqLocked(l) && l.youtube_video_id) ||
        flat.find((l) => !isSeqLocked(l)) ||
        null
      );
    }

    const player = $("#classroom-player", host);
    const meta = $("#classroom-meta", host);

    /* Chế độ tập trung: khi video đang phát, làm mờ mục lục và thu gọn thanh trên */
    let focusTimer = null;
    function setFocus(on) {
      clearTimeout(focusTimer);
      const apply = () => {
        host.querySelector(".classroom")?.classList.toggle("is-focus", on);
        document.body.classList.toggle("lx-focus", on);
      };
      if (on) focusTimer = setTimeout(apply, 1500);
      else apply();
    }

    const RES_KIND = { tai_lieu: "Tài liệu", bieu_mau: "Biểu mẫu", checklist: "Checklist", lien_ket: "Liên kết" };

    async function paintResources(lesson, box) {
      if (!box || !enrolled) return;
      try {
        const { data, error } = await sb.rpc("get_lesson_resources", { p_lesson_id: lesson.id });
        if (error || !data?.allowed || !data.items?.length || currentLesson?.id !== lesson.id) return;
        box.className = "lesson-res";
        box.innerHTML = `<h5>Tài liệu bài học</h5><ul>${data.items
          .map(
            (r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
              <span class="lesson-res__kind">${esc(RES_KIND[r.kind] || "Tài liệu")}</span>${esc(r.title)}</a>${
              r.note ? `<small>${esc(r.note)}</small>` : ""
            }</li>`
          )
          .join("")}</ul>`;
        box.hidden = false;
      } catch (e) {
        console.warn("[learn-player] resources", e);
      }
    }

    async function paintSelfCheck(lesson, box) {
      if (!box) return;
      let qs = [];
      try {
        const { data, error } = await sb.rpc("get_lesson_self_check", { p_lesson_id: lesson.id });
        if (error || !data?.allowed) return;
        qs = data.questions || [];
      } catch {
        return;
      }
      if (!qs.length || currentLesson?.id !== lesson.id) return;
      box.className = "self-check";
      box.innerHTML = `<details>
          <summary>Tự kiểm tra nhanh · ${qs.length} câu <small>không tính điểm</small></summary>
          <form data-sc-form>
            ${qs
              .map(
                (q, i) => `<fieldset class="self-check__q" data-qid="${esc(q.id)}">
                  <legend>${i + 1}. ${esc(q.stem)}</legend>
                  ${(q.choices || [])
                    .map(
                      (c) => `<label><input type="radio" name="sc-${esc(q.id)}" value="${esc(c.key)}" /> <span>${esc(c.text)}</span></label>`
                    )
                    .join("")}
                  <p class="self-check__why" hidden></p>
                </fieldset>`
              )
              .join("")}
            <div class="self-check__actions">
              <button type="submit" class="btn btn--amber btn--small">Xem đáp án</button>
              <span class="meta" data-sc-score></span>
            </div>
            <p class="meta">Phần này giúp bạn tự ôn — không ảnh hưởng tiến độ hay bài kiểm tra cuối khóa.</p>
          </form>
        </details>`;
      box.hidden = false;
      const form = $("[data-sc-form]", box);
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const answers = {};
        form.querySelectorAll("fieldset[data-qid]").forEach((fs) => {
          const v = fs.querySelector("input:checked")?.value;
          if (v != null) answers[fs.dataset.qid] = v;
        });
        const score = $("[data-sc-score]", form);
        if (!Object.keys(answers).length) {
          score.textContent = "Chọn ít nhất một đáp án.";
          return;
        }
        const { data, error } = await sb.rpc("check_lesson_self_check", { p_lesson_id: lesson.id, p_answers: answers });
        if (error) {
          score.textContent = "Chưa kiểm tra được — thử lại sau.";
          return;
        }
        (data.items || []).forEach((it) => {
          const fs = form.querySelector(`fieldset[data-qid="${it.id}"]`);
          if (!fs) return;
          fs.classList.toggle("is-right", it.correct);
          fs.classList.toggle("is-wrong", !it.correct);
          fs.querySelectorAll("label").forEach((lb) => {
            lb.classList.toggle("is-key", lb.querySelector("input")?.value === it.correct_key);
          });
          const why = $(".self-check__why", fs);
          why.textContent = (it.correct ? "Đúng. " : "Chưa đúng. ") + (it.explanation || "");
          why.hidden = false;
        });
        score.textContent = `Đúng ${data.correct}/${data.total} câu.`;
      });
    }

    async function playLesson(lesson) {
      if (!lesson) return;
      currentLesson = lesson;
      stopWatch();
      setFocus(false);
      paintPager(lesson);
      if (learnMode && lesson.lesson_code) {
        const u = new URL(location.href);
        u.searchParams.set("lesson", lesson.lesson_code);
        history.replaceState({}, "", u);
      }
      host.querySelectorAll(".classroom__lesson").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-lesson") === lesson.id);
      });
      const title = esc(lesson.title);
      const where = `${esc(lesson.moduleTitle || "")}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}`;

      if (!enrolled && !lesson.is_free) {
        player.innerHTML = `<p class="lead"><strong>${title}</strong></p>
          <p class="lead">Video này nằm trong phần khóa — đăng ký để xem toàn bộ lộ trình.</p>
          <p><a class="btn btn--amber" href="#dang-ky">Mở khóa khóa học</a>
          <a class="btn btn--line" href="${esc(loginHref)}">Đăng nhập</a></p>`;
        meta.innerHTML = `<p class="meta">${where}</p>`;
        host.querySelector(".classroom")?.classList.remove("is-side-open");
        return;
      }

      if (isSeqLocked(lesson)) {
        const open = firstOpenLesson();
        player.innerHTML = `<div class="lesson-locked">
          <p class="lesson-locked__icon" aria-hidden="true">🔒</p>
          <h3>${title}</h3>
          <p class="lead">Bài này mở khi bạn xem hết các bài trước.</p>
          ${open ? `<p><button type="button" class="btn btn--amber" data-next-lesson="${esc(open.id)}">Học bài đang dở →</button></p>` : ""}
        </div>`;
        meta.innerHTML = `<p class="meta">${where}</p>`;
        host.querySelector(".classroom")?.classList.remove("is-side-open");
        return;
      }

      if (!lesson.youtube_video_id) {
        player.innerHTML = `<p class="lead"><strong>${title}</strong></p>
          <p class="lead">Video đang hoàn thiện / đồng bộ YouTube.</p>`;
        meta.innerHTML = `<p class="meta">${where}</p>`;
        return;
      }

      const prog = progressMap[lesson.id] || {};
      const wasDone = !!prog.completed;
      const startAt = Math.max(0, Number(prog.watched_seconds) || 0);
      const seek = !wasDone && startAt > 15 ? startAt : 0;
      const track = enrolled && sb && !String(lesson.id).startsWith("static:");

      player.innerHTML = `<div class="trial-video__frame classroom__frame">
          <div id="sa247-yt-player"></div>
        </div>`;

      const full = (lesson.description || "").trim();
      const short = (lesson.description_short || "").trim() || full;
      let descHtml = "";
      if (short) {
        const needFold = full && full !== short && full.length > short.length + 40;
        descHtml = needFold
          ? `<div class="classroom__desc desc-fold">
            <div class="desc-fold__short">${esc(short)}</div>
            <details class="desc-fold__more">
              <summary>Xem đầy đủ</summary>
              <div class="desc-fold__full">${esc(full)}</div>
            </details>
          </div>`
          : `<div class="classroom__desc">${esc(short)}</div>`;
      }
      const resumeHint =
        seek > 0
          ? `<p class="meta classroom__resume">Tiếp tục từ ${
              window.sa247Continue ? sa247Continue.fmtClock(seek) : seek + "s"
            }</p>`
          : "";

      meta.innerHTML = `
        <h4>${title}</h4>
        <p class="meta">${esc(lesson.moduleTitle || "")}${lesson.is_free && !enrolled ? " · Mở sẵn" : ""}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>
        ${resumeHint}
        ${
          track
            ? `<div class="watch-status" data-watch-status data-label="">
                <div class="watch-status__row">
                  <strong data-watch-pct></strong>
                  <span data-watch-note></span>
                </div>
                <div class="progress-bar" aria-hidden="true"><span data-watch-bar style="width:0%"></span></div>
                <div class="watch-status__next" data-watch-next hidden></div>
              </div>`
            : enrolled
              ? ""
              : `<a class="btn btn--amber btn--small" href="#dang-ky">Mở khóa để lưu tiến độ</a>`
        }
        ${descHtml}
        <div data-lesson-res hidden></div>
        <div data-self-check hidden></div>
        <p class="classroom__fb">
          <button type="button" class="btn btn--line btn--small" data-lesson-fb>💬 Có vấn đề với bài học này?</button>
        </p>
        <p class="meta">Kiến thức HSE phải chính xác. Nếu bạn phát hiện nội dung cần kiểm tra, hãy phản hồi để SA247 cùng bạn cải thiện bài học.</p>`;

      window.dispatchEvent(
        new CustomEvent("sa247:progress", {
          detail: { courseCode: course.code, lessonCode: lesson.lesson_code || "", started: true },
        })
      );

      /* ---- Theo dõi đoạn đã xem (chỉ phát thật, 1×) ---- */
      let segs = mergeSegs([...(Array.isArray(prog.watched_segments) ? prog.watched_segments : []), ...localSegs(lesson.id)]);
      let duration = Number(lesson.duration_seconds) || 0;
      let serverPct = wasDone ? 100 : Number(prog.progress_percent) || 0;
      let done = wasDone;
      let lastT = null;
      let lastWall = 0;
      let dirty = segs.length > 0 && !wasDone;
      let inflight = false;
      let lastFlush = 0;
      let lastPos = seek;
      let rateNote = "";
      let showDoneOnEnd = false;
      const needPct = Number(lesson.complete_percent) >= 50 ? Number(lesson.complete_percent) : 100;
      const statusEl = $("[data-watch-status]", meta);
      if (sb && !String(lesson.id).startsWith("static:")) {
        paintResources(lesson, $("[data-lesson-res]", meta));
        paintSelfCheck(lesson, $("[data-self-check]", meta));
      }

      function paintStatus() {
        if (!statusEl) return;
        const localPct = duration > 0 ? Math.min(99, Math.floor((100 * segSeconds(segs)) / duration)) : 0;
        const pctNow = done ? 100 : Math.max(serverPct, localPct);
        const label = done ? "✓ Đã hoàn thành" : `Đã xem ${pctNow}%`;
        $("[data-watch-pct]", statusEl).textContent = label;
        $("[data-watch-note]", statusEl).textContent = done
          ? "Bài học đã được ghi nhận hoàn thành."
          : rateNote ||
            (needPct < 100
              ? `Xem ít nhất ${needPct}% video (tốc độ 1×) để hoàn thành bài — tua qua không được tính.`
              : "Xem hết video (tốc độ 1×) để hoàn thành bài — tua qua không được tính.");
        $("[data-watch-bar]", statusEl).style.width = pctNow + "%";
        statusEl.classList.toggle("is-done", done);
        if (statusEl.getAttribute("data-label") !== label) {
          statusEl.setAttribute("data-label", label);
          window.dispatchEvent(new CustomEvent("sa247:watch", { detail: { lessonId: lesson.id, done, pct: pctNow } }));
        }
      }

      function addSeg(a, b) {
        if (!(b > a)) return;
        segs = mergeSegs([...segs, [a, b]]);
        dirty = true;
        storeLocalSegs(lesson.id, segs);
      }

      function closeSegment(tEnd) {
        if (lastT == null) return;
        const wall = (performance.now() - lastWall) / 1000;
        const dt = tEnd - lastT;
        if (dt > 0 && dt <= wall + 0.75) addSeg(lastT, tEnd);
        lastT = null;
      }

      function nextAfter() {
        return (
          (window.sa247Continue && sa247Continue.nextLessonAfter(flat, lesson.id)) ||
          flat[flat.findIndex((l) => l.id === lesson.id) + 1] ||
          null
        );
      }

      async function onCompleted() {
        progressMap[lesson.id] = {
          ...(progressMap[lesson.id] || {}),
          completed: true,
          progress_percent: 100,
          watched_segments: segs,
          last_watched_at: new Date().toISOString(),
        };
        storeLocalSegs(lesson.id, null);
        window.dispatchEvent(
          new CustomEvent("sa247:progress", {
            detail: { courseCode: course.code, lessonCode: lesson.lesson_code || "", completed: true },
          })
        );
        await refreshLocks();
        updateHead();
        const nextEl = $("[data-watch-next]", meta);
        const next = nextAfter();
        const allDone = flat.every((l) => progressMap[l.id]?.completed);
        if (nextEl && (next || allDone)) {
          nextEl.innerHTML = next
            ? `<button type="button" class="btn btn--amber btn--small" data-next-lesson="${esc(next.id)}">Bài tiếp theo →</button>`
            : `<a class="btn btn--amber btn--small" href="${quizHref}">Bắt đầu kiểm tra cuối khóa</a>`;
          nextEl.hidden = false;
        }
        paintPager(lesson);
        refreshAssess();
        paintStatus();
        const st = ytPlayer?.getPlayerState?.();
        if (window.YT && st === YT.PlayerState.ENDED) showCompleteScreen(lesson);
        else showDoneOnEnd = true;
      }

      async function flush(force) {
        if (!track || inflight || done) return;
        if (!dirty && !force) return;
        inflight = true;
        const sent = segs;
        try {
          const res = await recordWatch(sb, lesson.id, sent, lastPos, duration);
          lastFlush = Date.now();
          if (res) {
            if (Number(res.duration_seconds) > 0) duration = Number(res.duration_seconds);
            serverPct = Number(res.progress_percent) || serverPct;
            const server = Array.isArray(res.segments) ? res.segments : [];
            segs = mergeSegs([...segs, ...server]);
            dirty = segSeconds(segs) > segSeconds(server) + 0.5;
            progressMap[lesson.id] = {
              ...(progressMap[lesson.id] || {}),
              progress_percent: serverPct,
              watched_segments: server,
              watched_seconds: Math.floor(lastPos),
              last_watched_at: new Date().toISOString(),
            };
            if (res.completed && !done) {
              done = true;
              await onCompleted();
            }
          }
        } catch (e) {
          const msg = String(e?.message || "");
          if (/lesson_locked/.test(msg)) rateNote = "Bài này đang khóa — hãy xem hết bài trước.";
          console.warn("[learn-player] record_watch", e);
        } finally {
          inflight = false;
          paintStatus();
        }
      }

      paintStatus();

      await loadYtApi();
      if (window.YT && window.YT.Player) {
        ytPlayer = new YT.Player("sa247-yt-player", {
          videoId: lesson.youtube_video_id,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            start: seek > 0 ? seek : undefined,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (!track) return;
              const d = ytPlayer?.getDuration?.();
              if (!duration && d > 0) duration = d;
              flush(true);
              watchTimer = setInterval(() => {
                try {
                  const t = ytPlayer?.getCurrentTime?.();
                  const d2 = ytPlayer?.getDuration?.();
                  if (!duration && d2 > 0) duration = d2;
                  const state = ytPlayer?.getPlayerState?.();
                  const rate = ytPlayer?.getPlaybackRate?.() || 1;
                  if (typeof t === "number") {
                    lastPos = t;
                    if (window.SA247_FEEDBACK_CONTEXT) window.SA247_FEEDBACK_CONTEXT.video_position_seconds = Math.floor(t);
                  }
                  if (state === YT.PlayerState.PLAYING && rate <= 1.01 && typeof t === "number") {
                    const now = performance.now();
                    if (lastT != null) {
                      const dt = t - lastT;
                      const wall = (now - lastWall) / 1000;
                      if (dt > 0 && dt <= wall + 0.75) addSeg(lastT, t);
                    }
                    lastT = t;
                    lastWall = now;
                  } else {
                    lastT = null;
                  }
                  paintStatus();
                  if (dirty && Date.now() - lastFlush > 10000) flush();
                } catch {
                  /* ignore */
                }
              }, 1000);
            },
            onPlaybackRateChange: (ev) => {
              if (ev.data > 1.01) {
                closeSegment(ytPlayer?.getCurrentTime?.() || 0);
                try {
                  ytPlayer.setPlaybackRate(1);
                } catch {
                  /* ignore */
                }
                rateNote = "SA247 tính hoàn thành ở tốc độ 1× — đã đặt lại tốc độ bình thường.";
                paintStatus();
              }
            },
            onStateChange: (ev) => {
              if (learnMode) setFocus(ev.data === YT.PlayerState.PLAYING);
              if (!track) return;
              const t = ytPlayer?.getCurrentTime?.() || 0;
              if (ev.data === YT.PlayerState.PAUSED) {
                closeSegment(t);
                lastPos = t;
                flush(true);
              } else if (ev.data === YT.PlayerState.ENDED) {
                closeSegment(duration > 0 ? Math.max(t, duration) : t);
                lastPos = 0;
                flush(true).then(() => {
                  if (done && showDoneOnEnd) showCompleteScreen(lesson);
                });
              } else if (ev.data === YT.PlayerState.BUFFERING) {
                closeSegment(t);
              }
            },
          },
        });
      } else {
        const startQ = seek > 0 ? `&start=${Math.floor(seek)}` : "";
        player.innerHTML = `<div class="trial-video__frame classroom__frame">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(lesson.youtube_video_id)}?rel=0${startQ}"
            title="${title}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>`;
        if (statusEl) {
          rateNote = "Không kết nối được trình theo dõi YouTube — tải lại trang để tiến độ được ghi nhận.";
          paintStatus();
        }
      }

      flushOnLeave = () => {
        if (!track || done) return;
        try {
          const t = ytPlayer?.getCurrentTime?.();
          if (typeof t === "number") {
            closeSegment(t);
            lastPos = t;
          }
        } catch {
          /* ignore */
        }
        flush(true);
      };

      window.SA247_FEEDBACK_CONTEXT = {
        source: "VIDEO",
        course_code: course.code || "",
        lesson_id: lesson.id || "",
        video_position_seconds: seek || 0,
      };
      if (!window.sa247Feedback) {
        const existing = document.querySelector("script[data-sa247-fb]");
        if (!existing) {
          const s = document.createElement("script");
          s.src = "../assets/js/sa247-feedback.js?v=20260927campus2";
          s.defer = true;
          s.dataset.sa247Fb = "1";
          document.body.appendChild(s);
        }
      }
      $("[data-lesson-fb]", meta)?.addEventListener("click", () => {
        try {
          const t = ytPlayer?.getCurrentTime?.();
          if (typeof t === "number") {
            window.SA247_FEEDBACK_CONTEXT = Object.assign({}, window.SA247_FEEDBACK_CONTEXT, {
              source: "BAI_HOC",
              video_position_seconds: Math.floor(t),
            });
          }
        } catch (_) {}
        if (window.sa247Feedback) window.sa247Feedback.open({ source: "BAI_HOC", category: "content" });
        else alert("Đang tải hộp phản hồi… thử lại sau vài giây.");
      });

      host.querySelector(".classroom")?.classList.remove("is-side-open");
    }

    host.addEventListener("click", (e) => {
      const nextBtn = e.target.closest("[data-next-lesson]");
      if (nextBtn) {
        const id = nextBtn.getAttribute("data-next-lesson");
        const lesson = flat.find((l) => l.id === id);
        playLesson(lesson);
        return;
      }
      const btn = e.target.closest("[data-lesson]");
      if (btn && !btn.disabled) {
        const id = btn.getAttribute("data-lesson");
        playLesson(flat.find((l) => l.id === id));
      }
      if (e.target.closest("[data-resume]")) {
        playLesson(pickResume(flat, progressMap, {}));
      }
      if (e.target.closest("[data-toggle-side]")) {
        host.querySelector(".classroom")?.classList.toggle("is-side-open");
      }
    });

    playLesson(resume || flat.find((l) => l.is_free) || flat[0]);
    if (enrolled && !assess) refreshAssess();
  }

  async function main() {
    const host = document.getElementById("learner-root");
    if (!host) return;
    const learnMode = host.getAttribute("data-mode") === "learn";
    const code = learnMode
      ? (new URLSearchParams(location.search).get("course") || "").trim().toUpperCase()
      : host.getAttribute("data-course-code");
    if (!code) {
      if (learnMode) location.replace("../khoa-cua-toi/");
      return;
    }

    const loginHref =
      host.getAttribute("data-login-href") ||
      document.querySelector("#checkout-root")?.getAttribute("data-login-href") ||
      "../auth/login.html";

    host.innerHTML = '<p class="lead">Đang tải lớp học…</p>';

    const boot = bootJson();
    let sb = null;
    let session = null;
    let courseRow = {
      code,
      title: code,
      status: boot.status || "dang_mo",
      duration_label: boot.duration_label || "",
    };
    let enrolled = false;

    // supabase-client.js is deferred after this script — wait for it before deciding access.
    for (let i = 0; i < 100 && !window.sa247Auth?.ready; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }

    if (window.sa247Auth?.ready) {
      try {
        sb = await sa247Auth.ensureClient();
        session = await sa247Auth.getSession();
        if (learnMode && !session) {
          location.replace(`../auth/login.html?next=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        const { data } = await sb
          .from("courses")
          .select("id,code,title,slug,status")
          .eq("code", code)
          .maybeSingle();
        if (data) {
          courseRow = data;
          enrolled = session
            ? await sa247Auth.hasCourseAccess(data.id, { courseCode: code })
            : false;
        } else if (session) {
          // Course row không đọc được nhưng vẫn có thể đã enrolled theo mã
          enrolled = await sa247Auth.hasCourseAccess(null, { courseCode: code });
        }
        if (enrolled) {
          document.getElementById("dang-ky")?.setAttribute("hidden", "");
          document.getElementById("goi-pro")?.setAttribute("hidden", "");
          document.documentElement.classList.add("sa247-enrolled");
        }
      } catch (e) {
        console.warn("[learn-player] supabase", e);
      }
    }

    if (learnMode) {
      window.dispatchEvent(new CustomEvent("sa247:course", { detail: courseRow }));
      if (!enrolled) {
        const slug = courseRow.slug || code.toLowerCase();
        host.innerHTML = `<div class="learn-gate">
          <p class="lead">Bạn chưa có quyền học khóa <strong>${esc(code)}</strong>.</p>
          <p><a class="btn btn--amber" href="../${esc(slug)}/">Xem thông tin khóa học</a>
          <a class="btn btn--line" href="../khoa-cua-toi/">Khóa học của tôi</a></p>
        </div>`;
        return;
      }
    }

    let modules = [];
    let freeCount = 0;

    // Enrolled + session → outline Supabase (UUID) để lưu tiến độ
    if (enrolled && sb) {
      try {
        const { data: outline, error: oErr } = await sb.rpc("get_course_outline", {
          p_course_code: code,
        });
        if (oErr) throw oErr;
        modules = sanitizeModules(outline?.modules || []);
        freeCount = applyFreeQuota(modules);
      } catch (e) {
        console.warn("[learn-player] outline", e);
      }
    }

    if (!modules.length && learnMode) {
      host.innerHTML = `<p class="lead">Không tải được mục lục khóa học. Vui lòng tải lại trang.</p>`;
      return;
    }

    if (!modules.length) {
      try {
        const cur = await loadStaticCurriculum(host, code);
        modules = sanitizeModules(curriculumToModules(cur));
        freeCount = Number(cur?.stats?.hoc_thu);
        if (!Number.isFinite(freeCount) || freeCount < 0) {
          freeCount = applyFreeQuota(modules);
        } else {
          applyFreeQuota(modules);
          freeCount = freePreviewCount(flattenLessons(modules).length);
        }
      } catch (staticErr) {
        host.innerHTML = `<p class="lead">Không tải được mục lục lớp học.</p>
          <p class="meta">${esc(staticErr.message || "")}</p>`;
        return;
      }
    }

    const flat = flattenLessons(modules);
    if (!flat.length) {
      host.innerHTML =
        '<p class="lead">Khóa chưa có video Bxx trên mục lục.</p>';
      return;
    }

    let progressMap = {};
    if (session && enrolled && sb) {
      const ids = flat.map((l) => l.id).filter((id) => !String(id).startsWith("static:"));
      if (ids.length) {
        let sel =
          "lesson_id,completed,progress_percent,last_watched_at,watched_seconds,watched_segments,covered_seconds";
        let { data: prog, error } = await sb
          .from("lesson_progress")
          .select(sel)
          .eq("user_id", session.user.id)
          .in("lesson_id", ids);
        if (error && /watched_segments|covered_seconds|watched_seconds/i.test(error.message || "")) {
          ({ data: prog } = await sb
            .from("lesson_progress")
            .select("lesson_id,completed,progress_percent,last_watched_at")
            .eq("user_id", session.user.id)
            .in("lesson_id", ids));
        }
        (prog || []).forEach((p) => {
          progressMap[p.lesson_id] = p;
        });
      }
    }

    renderClassroom(host, {
      mode: learnMode ? "learn" : "course",
      sb,
      course: courseRow,
      modules,
      flat,
      progressMap,
      enrolled,
      loginHref,
      freeCount: freeCount || flat.filter((l) => l.is_free).length,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      main().catch((e) => console.warn("[learn-player]", e));
    });
  } else {
    main().catch((e) => console.warn("[learn-player]", e));
  }
})();
