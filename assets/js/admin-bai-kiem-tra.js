/* Bài kiểm tra (quiz_defs) */
(function () {
  let cache = [];
  let courses = [];
  let questions = [];

  function paint() {
    document.getElementById("rows").innerHTML = cache
      .map((q) => {
        const c = courses.find((x) => x.id === q.course_id);
        return `<tr>
          <td><strong>${q.title}</strong></td>
          <td>${c?.code || "—"}</td>
          <td>${q.pass_percent}%</td>
          <td>${q.max_attempts ?? "—"}</td>
          <td>${(q.question_ids || []).length} câu</td>
          <td>${q.is_published ? '<span class="adm-badge">Xuất bản</span>' : '<span class="adm-badge adm-badge--draft">Ẩn</span>'}</td>
        </tr>`;
      })
      .join("");
    document.getElementById("adm-status").textContent = `${cache.length} bài kiểm tra`;
  }

  function courseOptions() {
    return courses
      .map((c) => `<option value="${c.id}">${c.code} · ${c.title}</option>`)
      .join("");
  }

  function renderQuestionPick(courseId) {
    const box = document.getElementById("q-pick");
    const list = questions.filter((q) => q.course_id === courseId);
    if (!list.length) {
      box.innerHTML = "<p class='adm-msg'>Chưa có câu hỏi cho khóa này.</p>";
      return;
    }
    box.innerHTML = list
      .map(
        (q) =>
          `<label><input type="checkbox" name="qid" value="${q.id}" /> ${(q.stem || "").slice(0, 60)}…</label>`
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Bài kiểm tra");
      if (!ctx) return;
      const { sb } = ctx;

      const [{ data: crs }, { data: qs }, { data: quizzes, error }] = await Promise.all([
        sb.from("courses").select("id,code,title").order("code"),
        sb.from("question_bank").select("id,course_id,stem").order("created_at"),
        sb
          .from("quiz_defs")
          .select("id,course_id,title,pass_percent,max_attempts,question_ids,is_published,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      courses = crs || [];
      questions = qs || [];
      cache = quizzes || [];

      document.getElementById("form-course").innerHTML = courseOptions();
      renderQuestionPick(courses[0]?.id);
      paint();

      document.getElementById("form-course").addEventListener("change", (ev) => {
        renderQuestionPick(ev.target.value);
      });

      document.getElementById("add-form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const ids = [...document.querySelectorAll('#q-pick input[name="qid"]:checked')].map(
          (el) => el.value
        );
        if (!ids.length) {
          document.getElementById("form-msg").innerHTML =
            `<span class="adm-msg--err">Chọn ít nhất một câu hỏi.</span>`;
          return;
        }
        const row = {
          course_id: fd.get("course_id"),
          title: (fd.get("title") || "").toString().trim(),
          pass_percent: Number(fd.get("pass_percent")) || 70,
          max_attempts: Number(fd.get("max_attempts")) || 3,
          question_ids: ids,
        };
        const { data, error: insErr } = await sb.from("quiz_defs").insert(row).select().maybeSingle();
        if (insErr) {
          document.getElementById("form-msg").innerHTML =
            `<span class="adm-msg--err">${insErr.message}</span>`;
          return;
        }
        cache.unshift(data);
        ev.target.reset();
        document.getElementById("form-course").innerHTML = courseOptions();
        renderQuestionPick(courses[0]?.id);
        document.getElementById("form-msg").textContent = "Đã tạo bài kiểm tra.";
        paint();
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
