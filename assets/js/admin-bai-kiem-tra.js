/* Bài kiểm tra (quiz_defs) — scope chương / khóa */
(function () {
  let cache = [];
  let courses = [];
  let questions = [];
  let modulesByCourse = {};

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function paint() {
    document.getElementById("rows").innerHTML = cache
      .map((q) => {
        const c = courses.find((x) => x.id === q.course_id);
        const scope =
          q.scope === "chuong"
            ? `Chương ${esc(q.module_code || "—")}`
            : "Cuối khóa";
        return `<tr>
          <td><strong>${esc(q.title)}</strong>
            <div class="meta">${scope}</div></td>
          <td>${esc(c?.code || "—")}</td>
          <td>${q.pass_percent}%</td>
          <td>${q.max_attempts ?? "—"} · CD ${q.cooldown_minutes ?? 0}p</td>
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

  function fillModules(courseId) {
    const sel = document.getElementById("form-module");
    const mods = modulesByCourse[courseId] || [];
    sel.innerHTML = mods
      .map((m) => `<option value="${esc(m.code)}">${esc(m.code)} · ${esc(m.title || "")}</option>`)
      .join("");
  }

  function renderQuestionPick(courseId, scope, moduleCode) {
    const box = document.getElementById("q-pick");
    const list = questions.filter((q) => {
      if (q.course_id !== courseId) return false;
      if (scope && (q.scope || "khoa") !== scope) return false;
      if (scope === "chuong" && moduleCode && (q.module_code || "") !== moduleCode) {
        return false;
      }
      return true;
    });
    if (!list.length) {
      box.innerHTML =
        "<p class='adm-msg'>Chưa có câu hỏi khớp khóa / scope / chương. Import từ trang Ngân hàng câu hỏi.</p>";
      return;
    }
    box.innerHTML = list
      .map(
        (q) =>
          `<label><input type="checkbox" name="qid" value="${q.id}" checked /> ${esc(
            (q.external_code ? q.external_code + " · " : "") + (q.stem || "").slice(0, 70)
          )}…</label>`
      )
      .join("");
  }

  function refreshPick() {
    const courseId = document.getElementById("form-course").value;
    const scope = document.getElementById("form-scope").value;
    const moduleCode = document.getElementById("form-module").value;
    document.getElementById("form-module-wrap").hidden = scope !== "chuong";
    document.getElementById("form-cooldown").value = scope === "chuong" ? 10 : 30;
    renderQuestionPick(courseId, scope, scope === "chuong" ? moduleCode : null);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Bài kiểm tra");
      if (!ctx) return;
      const { sb } = ctx;

      const [{ data: crs }, { data: mods }, { data: qs }, { data: quizzes, error }] =
        await Promise.all([
          sb.from("courses").select("id,code,title").order("code"),
          sb.from("modules").select("id,course_id,code,title,sort_order").order("sort_order"),
          sb
            .from("question_bank")
            .select("id,course_id,stem,scope,module_code,external_code")
            .order("created_at"),
          sb
            .from("quiz_defs")
            .select(
              "id,course_id,title,pass_percent,max_attempts,question_ids,is_published,scope,module_code,module_id,cooldown_minutes,min_progress_percent,created_at"
            )
            .order("created_at", { ascending: false }),
        ]);
      if (error) throw error;
      courses = crs || [];
      questions = qs || [];
      cache = quizzes || [];
      modulesByCourse = {};
      (mods || []).forEach((m) => {
        (modulesByCourse[m.course_id] ||= []).push(m);
      });

      document.getElementById("form-course").innerHTML = courseOptions();
      fillModules(courses[0]?.id);
      refreshPick();
      paint();

      document.getElementById("form-course").addEventListener("change", (ev) => {
        fillModules(ev.target.value);
        refreshPick();
      });
      document.getElementById("form-scope").addEventListener("change", refreshPick);
      document.getElementById("form-module").addEventListener("change", refreshPick);

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
        const scope = fd.get("scope") || "khoa";
        const courseId = fd.get("course_id");
        const moduleCode =
          scope === "chuong" ? (fd.get("module_code") || "").toString().trim().toUpperCase() : null;
        if (scope === "chuong" && !moduleCode) {
          document.getElementById("form-msg").innerHTML =
            `<span class="adm-msg--err">Chọn chương cho bài kiểm tra cuối chương.</span>`;
          return;
        }
        const modRow = (modulesByCourse[courseId] || []).find((m) => m.code === moduleCode);
        const row = {
          course_id: courseId,
          title: (fd.get("title") || "").toString().trim(),
          pass_percent: Number(fd.get("pass_percent")) || 70,
          max_attempts: Number(fd.get("max_attempts")) || 3,
          question_ids: ids,
          scope,
          module_code: moduleCode,
          module_id: scope === "chuong" ? modRow?.id || null : null,
          cooldown_minutes: Number(fd.get("cooldown_minutes")) || (scope === "chuong" ? 10 : 30),
          min_progress_percent: Number(fd.get("min_progress_percent")) || 0,
          is_published: document.getElementById("form-published").checked,
          shuffle_questions: true,
          shuffle_choices: true,
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
        fillModules(courses[0]?.id);
        document.getElementById("form-published").checked = true;
        refreshPick();
        document.getElementById("form-msg").textContent = "Đã tạo bài kiểm tra.";
        paint();
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
