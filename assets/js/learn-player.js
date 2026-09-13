/* SA247 classroom player — Bxx outline + ~1/5 mở sẵn (max 5) + phần còn lại khóa */
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

  async function markComplete(sb, lessonId) {
    const session = await sa247Auth.getSession();
    if (!session) return { error: { message: "Chưa đăng nhập" } };
    if (String(lessonId).startsWith("static:")) {
      return { error: { message: "Đăng ký khóa để lưu tiến độ trên hệ thống" } };
    }
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
    if (!session || String(lessonId).startsWith("static:")) return;
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
    const { course, modules, flat, progressMap, enrolled, loginHref, freeCount } = ctx;
    const done = flat.filter((l) => progressMap[l.id]?.completed).length;
    const total = flat.length || 1;
    const pct = Math.round((done / total) * 100);
    const resume = pickResume(flat, progressMap);
    const openN = freeCount ?? flat.filter((l) => l.is_free).length;

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
          <p class="lead">Video đang hoàn thiện / đồng bộ YouTube. Mục lục Bxx đã sẵn — quay lại sau khi xuất bản.</p>`;
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
        <p class="meta">${esc(lesson.moduleTitle || "")}${lesson.is_free ? " · Mở sẵn" : ""}${lesson.lesson_code ? " · " + esc(lesson.lesson_code) : ""}</p>
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
          const b = host.querySelector(`[data-lesson="${CSS.escape(lesson.id)}"]`);
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
    let courseRow = { code, title: code, status: boot.status || "dang_mo", duration_label: boot.duration_label || "" };
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
          enrolled = session ? await sa247Auth.hasCourseAccess(data.id) : false;
        }
      } catch (e) {
        console.warn("[learn-player] supabase", e);
      }
    }

    // Prefer static Bxx curriculum (SoT for site catalog until Supabase migrates)
    let modules = [];
    let freeCount = 0;
    try {
      const cur = await loadStaticCurriculum(host, code);
      modules = sanitizeModules(curriculumToModules(cur));
      freeCount = Number(cur?.stats?.hoc_thu);
      if (!Number.isFinite(freeCount) || freeCount < 0) {
        freeCount = applyFreeQuota(modules);
      } else {
        // Trust curriculum access flags; re-assert quota for safety
        applyFreeQuota(modules);
        freeCount = freePreviewCount(flattenLessons(modules).length);
      }
    } catch (staticErr) {
      console.warn("[learn-player] static curriculum", staticErr);
      if (sb) {
        try {
          const { data: outline, error: oErr } = await sb.rpc("get_course_outline", {
            p_course_code: code,
          });
          if (oErr) throw oErr;
          modules = sanitizeModules(outline?.modules || []);
          enrolled = enrolled || !!outline?.enrolled;
          freeCount = applyFreeQuota(modules);
        } catch (e) {
          host.innerHTML = `<p class="lead">Không tải được mục lục lớp học.</p>
            <p class="meta">${esc(e.message || staticErr.message || "")}</p>`;
          return;
        }
      } else {
        host.innerHTML = `<p class="lead">Không tải được mục lục lớp học.</p>
          <p class="meta">${esc(staticErr.message || "")}</p>`;
        return;
      }
    }

    const flat = flattenLessons(modules);
    if (!flat.length) {
      host.innerHTML =
        '<p class="lead">Khóa chưa có video Bxx trên mục lục. Chạy build curriculum rồi build lại landing.</p>';
      return;
    }

    let progressMap = {};
    if (session && enrolled && sb) {
      const ids = flat.map((l) => l.id).filter((id) => !String(id).startsWith("static:"));
      if (ids.length) {
        const { data: prog } = await sb
          .from("lesson_progress")
          .select("lesson_id,completed,progress_percent,last_watched_at")
          .eq("user_id", session.user.id)
          .in("lesson_id", ids);
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

    window.dispatchEvent(
      new CustomEvent("sa247:classroom-ready", {
        detail: {
          courseCode: code,
          enrolled,
          freeCount: freeCount || flat.filter((l) => l.is_free).length,
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
