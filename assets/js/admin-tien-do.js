/* Tiến độ học tập theo khóa */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tiến độ học tập");
      if (!ctx) return;
      const { sb } = ctx;
      const { data: courses } = await sb.from("courses").select("id,code,title").order("code");
      const sel = document.getElementById("course");
      sel.innerHTML = (courses || [])
        .map((c) => `<option value="${c.id}">${c.code} · ${c.title}</option>`)
        .join("");

      async function load() {
        const courseId = sel.value;
        const [{ data: enrolls }, { data: modules }] = await Promise.all([
          sb
            .from("enrollments")
            .select("user_id,status,profile:profiles(full_name)")
            .eq("course_id", courseId)
            .eq("status", "active"),
          sb
            .from("modules")
            .select("id,lessons(id)")
            .eq("course_id", courseId),
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
              <td>${name}</td>
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
    } catch (e) {
      alert(e.message || e);
    }
  });
})();
