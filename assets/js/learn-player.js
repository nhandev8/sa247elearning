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

  async function markComplete(sb, lessonId, watchedSeconds) {
    const session = await sa247Auth.getSession();
    if (!session) return { error: { message: "Chưa đăng nhập" } };
    if (String(lessonId).startsWith("static:")) {
      return { error: { message: "Đăng ký khóa để lưu tiến độ trên hệ thống" } };
    }
    const now = new Date().toISOString();
    const row = {
      user_id: session.user.id,
      lesson_id: lessonId,
      progress_percent: 100,
      completed: true,
      last_watched_at: now,
      completed_at: now,
    };
    if (watchedSeconds != null && watchedSeconds >= 0) {
      row.watched_seconds = Math.floor(watchedSeconds);
    }
    return sb.from("lesson_progress").upsert(row, { onConflict: "user_id,lesson_id" });
  }

  async function saveWatch(sb, lessonId, opts) {
    const session = await sa247Auth.getSession();
    if (!session || String(lessonId).startsWith("static:")) return;
    const now = new Date().toISOString();
    const row = {
      user_id: session.user.id,
      lesson_id: lessonId,
      last_watched_at: now,
    };
    if (opts?.watchedSeconds != null && opts.watchedSeconds >= 0) {
      row.watched_seconds = Math.floor(opts.watchedSeconds);
    }
    if (opts?.progressPercent != null) {
      row.progress_percent = Math.min(99, Math.max(0, Math.floor(opts.progressPercent)));
    }
    const { error } = await sb
      .from("lesson_progress")
      .upsert(row, { onConflict: "user_id,lesson_id" });
    if (error && /watched_seconds/i.test(error.message || "")) {
      // Migration chưa apply — fallback không ghi giây
      delete row.watched_seconds;
      await sb.from("lesson_progress").upsert(row, { onConflict: "user_id,lesson_id" });
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
    const nFree = freePreviewCount(flat.length);
    flat.forEach((l, i) => {
      const open = i < nFree;
      l.is_free = open;
      if (open) l.access = "hoc_thu";
      else if (l.access === "hoc_thu") l.access = "mo_khoa";
    });
    return nFree;
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
        has_video: !!(l.youtube_video_id || l.local_mp4),
        description: l.description || l.youtube_description || "",
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
    const done = flat.filter((l) => progressMap[l.id]?.completed).length;
    const total = flat.length || 1;
    const pct = Math.round((done / total) * 100);
    const target = queryLessonTarget();
    const resume = pickResume(flat, progressMap, target);
    const openN = freeCount ?? flat.filter((l) => l.is_free).length;

    let ytPlayer = null;
    let watchTimer = null;
    let currentLesson = null;

    function stopWatch() {
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
      if (next) {
        meta.innerHTML = `<div class="lesson-next">
          <p class="kicker">Bài tiếp theo</p>
          <h4>${esc(next.moduleCode || next.moduleTitle || "")}${next.lesson_code ? " · " + esc(next.lesson_code) : ""}</h4>
          <p>${esc(next.title)}</p>
          <div class="lesson-next__actions">
            <button type="button" class="btn btn--amber" data-next-lesson="${esc(next.id)}">Học bài tiếp theo →</button>
            <a class="btn btn--line" href="../dashboard/">Về Học tập</a>
          </div>
        </div>`;
      } else {
        meta.innerHTML = `<div class="lesson-next">
          <p class="lead"><strong>Bạn đã hoàn thành toàn bộ video khóa học.</strong></p>
          <div class="lesson-next__actions">
            <a class="btn btn--amber" href="../quiz/?course=${encodeURIComponent(course.code)}">Làm bài kiểm tra</a>
            <a class="btn btn--line" href="../dashboard/">Về Học tập</a>
          </div>
        </div>`;
      }
      host.querySelector(".classroom__head .progress-bar > span")?.style.setProperty("width", pctN + "%");
      const headMeta = host.querySelector(".classroom__head .meta strong");
      if (headMeta) headMeta.textContent = `${doneN}/${flat.length}`;
    }

    host.innerHTML = `
      <div class="classroom" data-enrolled="${enrolled ? "1" : "0"}">
        <div class="classroom__head">
          <div>
            <h3>Lớp học · ${esc(course.code)}</h3>
            <p class="meta">Tiến độ: <strong>${done}/${flat.length}</strong> video (${pct}%)</p>
            <p class="meta">${
              enrolled
                ? "Bạn đã mở khóa toàn bộ lộ trình."
                : `Mở sẵn <strong>${openN}</strong> video · còn lại khóa đến khi đăng ký.`
            }</p>
            <div class="progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          </div>
          <div class="classroom__actions">
            ${
              enrolled
                ? `<button type="button" class="btn btn--amber btn--small" data-resume>Tiếp tục học</button>
                   <a class="btn btn--line btn--small" href="../dashboard/">Học tập</a>
                   <a class="btn btn--line btn--small" href="../quiz/">Quiz · chứng chỉ</a>`
                : `<a class="btn btn--amber btn--small" href="#dang-ky">Mở khóa khóa học</a>
                   <a class="btn btn--line btn--small" href="${esc(loginHref)}">Đăng nhập</a>`
            }
            <button type="button" class="btn btn--line btn--small classroom__toggle" data-toggle-side>Mục lục</button>
          </div>
        </div>
        <div class="classroom__body">
          <aside class="classroom__side" id="classroom-side">
            <p class="classroom__side-label">Mô-đun &amp; video</p>
            <div class="classroom__mods"></div>
          </aside>
          <div class="classroom__main">
            <div class="classroom__player" id="classroom-player">
              <p class="lead">Chọn một video trong mục lục để xem.</p>
            </div>
            <div class="classroom__meta" id="classroom-meta"></div>
          </div>
        </div>
      </div>`;

    const modsEl = $(".classroom__mods", host);
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
      details.open = mi === 0 || lessons.some((l) => l.id === resume?.id);
      details.innerHTML = `<summary><span>${esc(m.title)}</span><small>${modDone}/${lessons.length}</small></summary>`;
      const ul = document.createElement("ul");
      lessons.forEach((l) => {
        const li = document.createElement("li");
        const locked = !enrolled && !l.is_free;
        const doneL = progressMap[l.id]?.completed;
        const playable = !!(l.youtube_video_id || l.has_video);
        li.innerHTML = `<button type="button" class="classroom__lesson${doneL ? " is-done" : ""}${locked ? " is-locked" : ""}" data-lesson="${esc(l.id)}">
          <span class="classroom__lesson-title">${esc(l.title)}</span>
          ${l.is_free ? '<span class="badge badge--free">Mở sẵn</span>' : ""}
          ${doneL ? '<span class="badge">Đã học</span>' : ""}
          ${locked ? '<span class="badge">Khóa</span>' : ""}
          ${!locked && !playable ? '<span class="badge">Sắp có</span>' : ""}
        </button>`;
        ul.appendChild(li);
      });
      details.appendChild(ul);
      modsEl.appendChild(details);
    });

    const player = $("#classroom-player", host);
    const meta = $("#classroom-meta", host);

    async function playLesson(lesson) {
      if (!lesson) return;
      currentLesson = lesson;
      stopWatch();
      host.querySelectorAll(".classroom__lesson").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-lesson") === lesson.id);
      });
      const title = esc(lesson.title);

      if (!enrolled && !lesson.is_free) {
        player.innerHTML = `<p class="lead"><strong>${title}</strong></p>
          <p class="lead">Video này nằm trong phần khóa — đăng ký để xem toàn bộ lộ trình.</p>
          <p><a class="btn btn--amber" href="#dang-ky">Mở khóa khóa học</a>
          <a class="btn btn--line" href="${esc(loginHref)}">Đăng nhập</a></p>`;
        meta.innerHTML = `<p class="meta">${esc(lesson.moduleTitle || "")}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>`;
        host.querySelector(".classroom")?.classList.remove("is-side-open");
        return;
      }

      if (!lesson.youtube_video_id) {
        player.innerHTML = `<p class="lead"><strong>${title}</strong></p>
          <p class="lead">Video đang hoàn thiện / đồng bộ YouTube.</p>`;
        meta.innerHTML = `<p class="meta">${esc(lesson.moduleTitle || "")}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>`;
        return;
      }

      const startAt = Math.max(
        0,
        Number(progressMap[lesson.id]?.watched_seconds) || 0
      );
      // Chỉ seek nếu đã xem > 15s và chưa hoàn thành
      const seek =
        !progressMap[lesson.id]?.completed && startAt > 15 ? startAt : 0;

      player.innerHTML = `<div class="trial-video__frame classroom__frame">
          <div id="sa247-yt-player"></div>
        </div>`;

      const doneL = progressMap[lesson.id]?.completed;
      const desc = (lesson.description || "").trim();
      const descHtml = desc ? `<div class="classroom__desc">${esc(desc)}</div>` : "";
      const resumeHint =
        seek > 0
          ? `<p class="meta classroom__resume">Tiếp tục từ ${
              window.sa247Continue ? sa247Continue.fmtClock(seek) : seek + "s"
            }</p>`
          : "";

      meta.innerHTML = `
        <h4>${title}</h4>
        <p class="meta">${esc(lesson.moduleTitle || "")}${lesson.is_free ? " · Mở sẵn" : ""}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>
        ${resumeHint}
        ${descHtml}
        ${
          enrolled
            ? `<button type="button" class="btn btn--line btn--small" data-complete>${doneL ? "Đã hoàn thành · đánh dấu lại" : "Đánh dấu hoàn thành"}</button>`
            : `<a class="btn btn--amber btn--small" href="#dang-ky">Mở khóa để lưu tiến độ</a>`
        }`;

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
              if (enrolled && sb) {
                saveWatch(sb, lesson.id, { watchedSeconds: seek || 0 }).catch(() => {});
                watchTimer = setInterval(() => {
                  try {
                    const t = ytPlayer?.getCurrentTime?.();
                    const d = ytPlayer?.getDuration?.();
                    if (typeof t === "number" && t > 0) {
                      const pp =
                        typeof d === "number" && d > 0
                          ? Math.min(99, Math.round((t / d) * 100))
                          : undefined;
                      saveWatch(sb, lesson.id, {
                        watchedSeconds: t,
                        progressPercent: pp,
                      }).catch(() => {});
                    }
                  } catch {
                    /* ignore */
                  }
                }, 8000);
              }
            },
            onStateChange: (ev) => {
              if (ev.data === YT.PlayerState.ENDED && enrolled && sb) {
                // Gợi ý hoàn thành — không auto sang bài
                const btn = $("[data-complete]", meta);
                if (btn && !progressMap[lesson.id]?.completed) {
                  btn.classList.add("btn--amber");
                  btn.textContent = "Đánh dấu hoàn thành · sang bài tiếp theo";
                }
              }
            },
          },
        });
      } else {
        // Fallback iframe
        const startQ = seek > 0 ? `&start=${Math.floor(seek)}` : "";
        player.innerHTML = `<div class="trial-video__frame classroom__frame">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(lesson.youtube_video_id)}?rel=0${startQ}"
            title="${title}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>`;
        if (enrolled && sb) saveWatch(sb, lesson.id, { watchedSeconds: seek }).catch(() => {});
      }

      if (enrolled && sb) {
        $("[data-complete]", meta)?.addEventListener("click", async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          let t = 0;
          try {
            t = ytPlayer?.getCurrentTime?.() || progressMap[lesson.id]?.watched_seconds || 0;
          } catch {
            t = 0;
          }
          const { error } = await markComplete(sb, lesson.id, t);
          if (error) {
            btn.disabled = false;
            btn.textContent = error.message || "Lỗi lưu";
            return;
          }
          progressMap[lesson.id] = {
            ...(progressMap[lesson.id] || {}),
            completed: true,
            watched_seconds: Math.floor(t),
            last_watched_at: new Date().toISOString(),
          };
          const b = host.querySelector(`[data-lesson="${CSS.escape(lesson.id)}"]`);
          b?.classList.add("is-done");
          window.dispatchEvent(
            new CustomEvent("sa247:progress", { detail: { courseCode: course.code } })
          );
          showCompleteScreen(lesson);
        });
      }
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
  }

  async function main() {
    const host = document.getElementById("learner-root");
    if (!host) return;
    const code = host.getAttribute("data-course-code");
    if (!code) return;

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

    if (window.sa247Auth?.ready) {
      try {
        sb = await sa247Auth.ensureClient();
        session = await sa247Auth.getSession();
        const { data } = await sb
          .from("courses")
          .select("id,code,title,status,duration_label")
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
        // Merge descriptions from static curriculum
        try {
          const cur = await loadStaticCurriculum(host, code);
          const byCode = Object.create(null);
          (cur.modules || []).forEach((m) => {
            (m.lessons || []).forEach((l) => {
              if (l.lesson_code) {
                byCode[l.lesson_code] = l.description || l.youtube_description || "";
              }
            });
          });
          modules.forEach((m) => {
            (m.lessons || []).forEach((l) => {
              if (!l.description && byCode[l.lesson_code]) {
                l.description = byCode[l.lesson_code];
              }
            });
          });
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.warn("[learn-player] outline", e);
      }
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
          "lesson_id,completed,progress_percent,last_watched_at,watched_seconds";
        let { data: prog, error } = await sb
          .from("lesson_progress")
          .select(sel)
          .eq("user_id", session.user.id)
          .in("lesson_id", ids);
        if (error && /watched_seconds/i.test(error.message || "")) {
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
