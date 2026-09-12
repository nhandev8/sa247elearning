/* SA247 classroom player — 1 video + sidebar chương/bài + tiến độ + tiếp tục học */
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

  async function markComplete(sb, lessonId) {
    const session = await sa247Auth.getSession();
    if (!session) return { error: { message: "Chưa đăng nhập" } };
    const now = new Date().toISOString();
    return sb.from("lesson_progress").upsert(
      {
        user_id: session.user.id,
        lesson_id: lessonId,
        progress_percent: 100,
        completed: true,
        last_watched_at: now,
        completed_at: now,
      },
      { onConflict: "user_id,lesson_id" }
    );
  }

  async function touchWatch(sb, lessonId) {
    const session = await sa247Auth.getSession();
    if (!session) return;
    const now = new Date().toISOString();
    await sb.from("lesson_progress").upsert(
      {
        user_id: session.user.id,
        lesson_id: lessonId,
        last_watched_at: now,
      },
      { onConflict: "user_id,lesson_id" }
    );
  }

  function isCanonicalLesson(l) {
    // Progress & outline gắn lesson_code (TL09) — bỏ orphan YouTube không mã
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

  function pickResume(flat, progressMap) {
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
    const next = flat.find((l) => !progressMap[l.id]?.completed);
    return next || flat[0] || null;
  }

  function renderClassroom(host, ctx) {
    const { course, modules, flat, progressMap, enrolled, loginHref } = ctx;
    const done = flat.filter((l) => progressMap[l.id]?.completed).length;
    const total = flat.length || 1;
    const pct = Math.round((done / total) * 100);
    const resume = pickResume(flat, progressMap);

    host.innerHTML = `
      <div class="classroom" data-enrolled="${enrolled ? "1" : "0"}">
        <div class="classroom__head">
          <div>
            <h3>Lớp học · ${esc(course.code)}</h3>
            <p class="meta">Tiến độ: <strong>${done}/${flat.length}</strong> bài (${pct}%)</p>
            <div class="progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          </div>
          <div class="classroom__actions">
            ${
              enrolled
                ? `<button type="button" class="btn btn--amber btn--small" data-resume>Tiếp tục học</button>
                   <a class="btn btn--line btn--small" href="../quiz/">Quiz · chứng chỉ</a>
                   <a class="btn btn--line btn--small" href="../verify/">Xác minh chứng chỉ</a>`
                : `<a class="btn btn--amber btn--small" href="#dang-ky">Mở khóa khóa học</a>
                   <a class="btn btn--line btn--small" href="${esc(loginHref)}">Đăng nhập</a>`
            }
            <button type="button" class="btn btn--line btn--small classroom__toggle" data-toggle-side>Mục lục</button>
          </div>
        </div>
        <div class="classroom__body">
          <aside class="classroom__side" id="classroom-side">
            <p class="classroom__side-label">Chương &amp; bài</p>
            <div class="classroom__mods"></div>
          </aside>
          <div class="classroom__main">
            <div class="classroom__player" id="classroom-player">
              <p class="lead">Chọn một bài trong mục lục để xem.</p>
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
        li.innerHTML = `<button type="button" class="classroom__lesson${doneL ? " is-done" : ""}${locked ? " is-locked" : ""}" data-lesson="${l.id}">
          <span class="classroom__lesson-title">${esc(l.title)}</span>
          ${l.is_free ? '<span class="badge badge--free">Học thử</span>' : ""}
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
    let activeId = null;

    async function playLesson(lesson) {
      if (!lesson) return;
      activeId = lesson.id;
      host.querySelectorAll(".classroom__lesson").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-lesson") === lesson.id);
      });
      const title = esc(lesson.title);

      if (!enrolled && !lesson.is_free) {
        player.innerHTML = `<p class="lead"><strong>${title}</strong></p>
          <p class="lead">Bài này nằm trong lộ trình khóa học — mở khóa để xem video.</p>
          <p><a class="btn btn--amber" href="#dang-ky">Mở khóa khóa học</a>
          <a class="btn btn--line" href="${esc(loginHref)}">Đăng nhập</a></p>`;
        meta.innerHTML = `<p class="meta">${esc(lesson.moduleTitle || "")}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>`;
        host.querySelector(".classroom")?.classList.remove("is-side-open");
        return;
      }

      if (!lesson.youtube_video_id) {
        player.innerHTML = `<p class="lead"><strong>${title}</strong></p>
          <p class="lead">Video đang được hoàn thiện / đồng bộ. Mục lục đã sẵn — quay lại sau khi xuất bản.</p>`;
        meta.innerHTML = `<p class="meta">${esc(lesson.moduleTitle || "")}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>`;
        host.querySelector(".classroom")?.classList.remove("is-side-open");
        return;
      }

      player.innerHTML = `<div class="trial-video__frame classroom__frame">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(lesson.youtube_video_id)}?rel=0"
            title="${title}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>`;
      const doneL = progressMap[lesson.id]?.completed;
      meta.innerHTML = `
        <h4>${title}</h4>
        <p class="meta">${esc(lesson.moduleTitle || "")}${lesson.is_free ? " · Học thử" : ""}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>
        ${
          enrolled
            ? `<button type="button" class="btn btn--line btn--small" data-complete>${doneL ? "Đã hoàn thành · đánh dấu lại" : "Đánh dấu hoàn thành"}</button>`
            : `<a class="btn btn--amber btn--small" href="#dang-ky">Mở khóa để lưu tiến độ</a>`
        }`;
      if (enrolled && ctx.sb) {
        touchWatch(ctx.sb, lesson.id).catch(() => {});
        $("[data-complete]", meta)?.addEventListener("click", async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          const { error } = await markComplete(ctx.sb, lesson.id);
          if (error) {
            btn.disabled = false;
            btn.textContent = error.message || "Lỗi lưu";
            return;
          }
          progressMap[lesson.id] = { completed: true };
          btn.textContent = "Đã lưu";
          const b = host.querySelector(`[data-lesson="${lesson.id}"]`);
          b?.classList.add("is-done");
          window.dispatchEvent(new CustomEvent("sa247:progress", { detail: { courseCode: course.code } }));
        });
      }
      host.querySelector(".classroom")?.classList.remove("is-side-open");
    }

    host.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lesson]");
      if (btn && !btn.disabled) {
        const id = btn.getAttribute("data-lesson");
        const lesson = flat.find((l) => l.id === id);
        playLesson(lesson);
      }
      if (e.target.closest("[data-resume]")) playLesson(resume);
      if (e.target.closest("[data-toggle-side]")) {
        host.querySelector(".classroom")?.classList.toggle("is-side-open");
      }
    });

    playLesson(resume || flat.find((l) => l.is_free) || flat[0]);
  }

  async function main() {
    const host = document.getElementById("learner-root");
    if (!host || !window.sa247Auth?.ready) return;
    const code = host.getAttribute("data-course-code");
    if (!code) return;

    const loginHref =
      host.getAttribute("data-login-href") ||
      document.querySelector("#checkout-root")?.getAttribute("data-login-href") ||
      "../auth/login.html";

    host.innerHTML = '<p class="lead">Đang tải lớp học…</p>';

    const sb = await sa247Auth.ensureClient();
    const session = await sa247Auth.getSession();
    const { data: courseRow, error: cErr } = await sb
      .from("courses")
      .select("id,code,title,status,duration_label")
      .eq("code", code)
      .maybeSingle();

    if (cErr || !courseRow) {
      host.innerHTML = '<p class="lead">Chưa tìm thấy khóa trên hệ thống. Thử lại sau.</p>';
      return;
    }

    const enrolled = session ? await sa247Auth.hasCourseAccess(courseRow.id) : false;

    const { data: outline, error: oErr } = await sb.rpc("get_course_outline", {
      p_course_code: code,
    });
    if (oErr) {
      host.innerHTML = `<p class="lead">Không tải được mục lục: ${esc(oErr.message)}</p>
        <p class="meta">Nếu thiếu RPC: chạy migration <code>20260912040000_course_outline_rpc.sql</code>.</p>`;
      return;
    }

    const modules = sanitizeModules(outline?.modules || []);
    const enrolledRpc = !!outline?.enrolled;
    const enrolledFinal = enrolled || enrolledRpc;

    const flat = flattenLessons(modules);
    if (!flat.length) {
      host.innerHTML =
        '<p class="lead">Khóa chưa có bài trên hệ thống. Admin hãy đồng bộ catalog hoặc seed lessons.</p>';
      return;
    }

    let progressMap = {};
    if (session && enrolledFinal) {
      const ids = flat.map((l) => l.id);
      const { data: prog } = await sb
        .from("lesson_progress")
        .select("lesson_id,completed,progress_percent,last_watched_at")
        .eq("user_id", session.user.id)
        .in("lesson_id", ids);
      (prog || []).forEach((p) => {
        progressMap[p.lesson_id] = p;
      });
    }

    renderClassroom(host, {
      sb,
      course: courseRow,
      modules,
      flat,
      progressMap,
      enrolled: enrolledFinal,
      loginHref,
    });

    window.dispatchEvent(
      new CustomEvent("sa247:classroom-ready", {
        detail: {
          courseCode: code,
          enrolled: enrolledFinal,
          freeCount: flat.filter((l) => l.is_free).length,
          lessonCount: flat.length,
          moduleCount: modules.length,
          status: courseRow.status,
          duration_label: courseRow.duration_label,
        },
      })
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => console.warn("[learn-player]", e));
  });
})();
