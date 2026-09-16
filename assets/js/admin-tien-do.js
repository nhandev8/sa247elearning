/* Tiến độ học tập — ưu tiên theo người dùng (?id=) */
(function () {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function userIdFromQuery() {
    const q = new URLSearchParams(location.search);
    return (q.get("id") || q.get("user") || "").trim();
  }

  function setMain(html) {
    const main = document.querySelector(".adm-content");
    if (main) main.innerHTML = html;
  }

  async function loadUserProgress(sb, uid) {
    const [{ data: profile }, { data: email }, { data: enrolls }] = await Promise.all([
      sb
        .from("profiles")
        .select("id,full_name,phone,role")
        .eq("id", uid)
        .maybeSingle(),
      sb.rpc("admin_get_user_email", { p_user_id: uid }).then(
        (r) => r,
        () => ({ data: null })
      ),
      sb
        .from("enrollments")
        .select("id,status,enrolled_at,course_id,course:courses(id,code,title)")
        .eq("user_id", uid)
        .order("enrolled_at", { ascending: false }),
    ]);

    if (!profile) {
      setMain(`<p class="adm-msg adm-msg--err">Không tìm thấy người dùng.</p>
        <p><a href="../tai-khoan/">← Tất cả người dùng</a></p>`);
      return;
    }

    const name = profile.full_name || email?.data || uid;
    document.querySelector(".adm-top h1").textContent = `Tiến độ · ${name}`;

    const active = (enrolls || []).filter((e) => e.status === "active");
    const courseBlocks = [];

    for (const e of active) {
      const course = e.course || {};
      const courseId = e.course_id || course.id;
      if (!courseId) continue;

      const { data: modules } = await sb
        .from("modules")
        .select("id,code,title,sort_order,lessons(id,lesson_code,title,sort_order)")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      const lessons = [];
      (modules || []).forEach((m) => {
        (m.lessons || [])
          .slice()
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .forEach((l) => {
            lessons.push({
              ...l,
              module_code: m.code,
              module_title: m.title,
            });
          });
      });
      const lessonIds = lessons.map((l) => l.id);
      let progRows = [];
      if (lessonIds.length) {
        const { data } = await sb
          .from("lesson_progress")
          .select(
            "lesson_id,completed,progress_percent,watched_seconds,last_watched_at"
          )
          .eq("user_id", uid)
          .in("lesson_id", lessonIds);
        progRows = data || [];
      }
      const byLesson = {};
      progRows.forEach((p) => {
        byLesson[p.lesson_id] = p;
      });
      const done = lessons.filter((l) => byLesson[l.id]?.completed).length;
      const total = lessons.length;
      const pct = total ? Math.round((done / total) * 100) : 0;

      courseBlocks.push(`
        <section class="adm-card">
          <h2>${esc(course.code || "")} · ${esc(course.title || "")}</h2>
          <p><strong>${pct}%</strong> · ${done}/${total} bài hoàn thành
            · quyền: ${esc(sa247Admin.statusEnrollVi(e.status))}
            · từ ${sa247Admin.fmtTime(e.enrolled_at)}</p>
          ${
            total
              ? `<div class="adm-table-wrap"><table class="adm-table">
                  <thead><tr>
                    <th>Mã bài</th><th>Tiêu đề</th><th>Trạng thái</th><th>Xem gần nhất</th>
                  </tr></thead>
                  <tbody>
                  ${lessons
                    .map((l) => {
                      const p = byLesson[l.id];
                      let st = "Chưa học";
                      if (p?.completed) st = "Hoàn thành";
                      else if (p && (p.progress_percent > 0 || p.watched_seconds > 0)) {
                        st = `${p.progress_percent || 0}%`;
                      }
                      return `<tr>
                        <td>${esc(l.lesson_code || "")}</td>
                        <td>${esc(l.title || "")}</td>
                        <td>${esc(st)}</td>
                        <td>${sa247Admin.fmtTime(p?.last_watched_at)}</td>
                      </tr>`;
                    })
                    .join("")}
                  </tbody></table></div>`
              : '<p class="adm-muted">Khóa chưa có bài trên hệ thống.</p>'
          }
        </section>`);
    }

    setMain(`
      <p class="adm-msg">
        <a href="../tai-khoan/ho-so.html?id=${encodeURIComponent(uid)}">← Hồ sơ người dùng</a>
        · <a href="../tai-khoan/">Tất cả người dùng</a>
      </p>
      <section class="adm-card">
        <h2>${esc(name)}</h2>
        <p>Email: <strong>${esc(email?.data || "—")}</strong></p>
        <p class="adm-muted">ID: ${esc(uid)}</p>
        <p>${active.length} khóa đang có quyền học active
          ${(enrolls || []).length !== active.length
            ? ` · ${(enrolls || []).length} enrollment tổng`
            : ""}</p>
      </section>
      ${
        courseBlocks.length
          ? courseBlocks.join("")
          : '<section class="adm-card"><p class="adm-muted">Người dùng chưa có quyền học active. Cấp quyền trong <a href="../tai-khoan/ho-so.html?id=' +
            encodeURIComponent(uid) +
            '#sec-access">hồ sơ</a>.</p></section>'
      }
    `);
  }

  async function loadCourseCohort(sb) {
    const { data: courses } = await sb.from("courses").select("id,code,title").order("code");
    setMain(`
      <p class="adm-lead">Chọn người dùng để xem tiến độ cá nhân, hoặc xem nhanh theo khóa (toàn hệ thống).</p>
      <p class="adm-msg"><a class="adm-btn" href="../tai-khoan/">Chọn người dùng</a></p>
      <div class="adm-toolbar">
        <label>Khóa học
          <select id="course">${(courses || [])
            .map((c) => `<option value="${c.id}">${esc(c.code)} · ${esc(c.title)}</option>`)
            .join("")}</select>
        </label>
        <button type="button" class="adm-btn adm-btn--primary" id="load">Xem theo khóa</button>
      </div>
      <div class="adm-stats" id="summary"></div>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Học viên</th>
              <th>Đã hoàn thành</th>
              <th>Tổng bài</th>
              <th>Tiến độ</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    `);

    const sel = document.getElementById("course");
    async function load() {
      const courseId = sel.value;
      const [{ data: enrolls }, { data: modules }] = await Promise.all([
        sb
          .from("enrollments")
          .select("user_id,status,profile:profiles(full_name)")
          .eq("course_id", courseId)
          .eq("status", "active"),
        sb.from("modules").select("id,lessons(id)").eq("course_id", courseId),
      ]);
      const lessonIds = [];
      (modules || []).forEach((m) =>
        (m.lessons || []).forEach((l) => lessonIds.push(l.id))
      );
      const total = lessonIds.length;
      const userIds = (enrolls || []).map((e) => e.user_id);
      let progress = [];
      if (userIds.length && lessonIds.length) {
        const { data } = await sb
          .from("lesson_progress")
          .select("user_id,lesson_id,completed")
          .in("user_id", userIds)
          .in("lesson_id", lessonIds)
          .eq("completed", true);
        progress = data || [];
      }
      const doneMap = {};
      progress.forEach((p) => {
        doneMap[p.user_id] = (doneMap[p.user_id] || 0) + 1;
      });
      let notStarted = 0;
      let learning = 0;
      let doneAll = 0;
      let sumPct = 0;
      document.getElementById("rows").innerHTML = (enrolls || [])
        .map((e) => {
          const done = doneMap[e.user_id] || 0;
          const pct = total ? Math.round((done / total) * 100) : 0;
          sumPct += pct;
          if (done === 0) notStarted += 1;
          else if (total && done >= total) doneAll += 1;
          else learning += 1;
          const name = e.profile?.full_name || e.user_id;
          return `<tr>
            <td><a href="./?id=${encodeURIComponent(e.user_id)}">${esc(name)}</a>
              <div class="adm-msg"><a href="../tai-khoan/ho-so.html?id=${encodeURIComponent(e.user_id)}">Hồ sơ</a></div>
            </td>
            <td>${done}</td>
            <td>${total}</td>
            <td>${pct}%</td>
          </tr>`;
        })
        .join("");
      const n = (enrolls || []).length || 1;
      document.getElementById("summary").innerHTML = [
        ["Tổng học viên", (enrolls || []).length],
        ["Chưa bắt đầu", notStarted],
        ["Đang học", learning],
        ["Đã hoàn thành", doneAll],
        ["Tỷ lệ TB", Math.round(sumPct / n) + "%"],
      ]
        .map(
          ([a, b]) =>
            `<article class="adm-stat"><strong>${b}</strong><span>${a}</span></article>`
        )
        .join("");
    }

    document.getElementById("load").addEventListener("click", () => {
      load().catch((e) => alert(e.message || e));
    });
    await load();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tiến độ học tập");
      if (!ctx) return;
      const uid = userIdFromQuery();
      if (uid) await loadUserProgress(ctx.sb, uid);
      else await loadCourseCohort(ctx.sb);
    } catch (e) {
      alert(e.message || e);
    }
  });
})();
