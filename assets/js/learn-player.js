/* SA247 enrolled lesson list + progress on course pages */
(function () {
  function root() {
    return document.getElementById("learner-root");
  }

  async function markComplete(sb, lessonId) {
    const session = await sa247Auth.getSession();
    if (!session) return;
    const now = new Date().toISOString();
    const { error } = await sb.from("lesson_progress").upsert(
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
    if (error) console.warn(error);
  }

  async function main() {
    const host = root();
    if (!host || !window.sa247Auth?.ready) return;
    const code = host.getAttribute("data-course-code");
    if (!code) return;

    const session = await sa247Auth.getSession();
    if (!session) {
      host.innerHTML =
        '<p class="lead">Đăng nhập để xem bài đã mở khóa và lưu tiến độ. <a href="../auth/login.html">Đăng nhập</a></p>';
      return;
    }

    const sb = await sa247Auth.ensureClient();
    const { data: course } = await sb
      .from("courses")
      .select("id,code,title")
      .eq("code", code)
      .maybeSingle();
    if (!course) return;

    const enrolled = await sa247Auth.hasCourseAccess(course.id);
    if (!enrolled) {
      host.innerHTML =
        '<p class="lead">Bạn chưa mở khóa khóa này. Học thử phía trên hoặc <a href="#goi-pro">thanh toán 199.000đ</a>.</p>';
      return;
    }

    const { data: modules } = await sb
      .from("modules")
      .select("id,title,sort_order,lessons(id,title,youtube_video_id,is_free,sort_order)")
      .eq("course_id", course.id)
      .eq("is_published", true)
      .order("sort_order");

    const lessonIds = [];
    (modules || []).forEach((m) =>
      (m.lessons || []).forEach((l) => lessonIds.push(l.id))
    );

    let progressMap = {};
    if (lessonIds.length) {
      const { data: prog } = await sb
        .from("lesson_progress")
        .select("lesson_id,completed,progress_percent")
        .eq("user_id", session.user.id)
        .in("lesson_id", lessonIds);
      (prog || []).forEach((p) => {
        progressMap[p.lesson_id] = p;
      });
    }

    const done = Object.values(progressMap).filter((p) => p.completed).length;
    const total = lessonIds.length || 1;
    const pct = Math.round((done / total) * 100);

    host.innerHTML = `<div class="learner-head">
        <h3>Lộ trình học viên · ${course.code}</h3>
        <p class="meta">Tiến độ: <strong>${done}/${lessonIds.length}</strong> bài (${pct}%)</p>
        <div class="progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <p><a class="btn btn--line btn--small" href="../quiz/">Làm quiz lấy chứng chỉ</a></p>
      </div>
      <div class="learner-mods"></div>`;

    const modsEl = host.querySelector(".learner-mods");
    (modules || []).forEach((m) => {
      const lessons = (m.lessons || []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const block = document.createElement("section");
      block.className = "learner-mod";
      block.innerHTML = `<h4>${m.title}</h4>`;
      lessons.forEach((l) => {
        const doneL = progressMap[l.id]?.completed;
        const art = document.createElement("article");
        art.className = "learner-lesson" + (doneL ? " is-done" : "");
        const vid = l.youtube_video_id
          ? `<div class="trial-video__frame"><iframe src="https://www.youtube-nocookie.com/embed/${l.youtube_video_id}" title="${l.title.replace(/"/g, "")}" loading="lazy" allowfullscreen></iframe></div>`
          : `<p class="meta">Chưa có video Unlisted — chạy set-privacy / upload.</p>`;
        art.innerHTML = `<header><strong>${l.title}</strong>
          ${l.is_free ? '<span class="badge badge--free">Free</span>' : ""}
          ${doneL ? '<span class="badge">Đã học</span>' : ""}</header>
          ${vid}
          <button type="button" class="btn btn--line btn--small" data-complete="${l.id}">${doneL ? "Học lại · đánh dấu" : "Đánh dấu hoàn thành"}</button>`;
        art.querySelector("[data-complete]")?.addEventListener("click", async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          await markComplete(sb, l.id);
          btn.textContent = "Đã lưu";
          art.classList.add("is-done");
        });
        block.appendChild(art);
      });
      modsEl.appendChild(block);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => console.warn(e));
  });
})();
