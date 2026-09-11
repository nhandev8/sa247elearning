/* Ngân hàng câu hỏi */
(function () {
  let cache = [];
  let courses = [];

  function stemPreview(s) {
    const t = (s || "").replace(/\s+/g, " ").trim();
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  }

  function paint() {
    const cid = document.getElementById("filter-course").value;
    const list = cache.filter((q) => !cid || q.course_id === cid);
    document.getElementById("rows").innerHTML = list
      .map((q) => {
        const c = courses.find((x) => x.id === q.course_id);
        return `<tr>
          <td>${c?.code || "—"}</td>
          <td>${q.topic || "—"}</td>
          <td>${sa247Admin.difficultyVi(q.difficulty)}</td>
          <td>${stemPreview(q.stem)}</td>
          <td>${(q.choices || []).length} lựa chọn · đáp án #${(q.correct_index || 0) + 1}</td>
          <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-del="${q.id}">Xóa</button></td>
        </tr>`;
      })
      .join("");
    document.getElementById("adm-status").textContent = `${list.length} / ${cache.length} câu hỏi`;
  }

  function courseOptions(selected) {
    return courses
      .map(
        (c) =>
          `<option value="${c.id}"${c.id === selected ? " selected" : ""}>${c.code} · ${c.title}</option>`
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Ngân hàng câu hỏi");
      if (!ctx) return;
      const { sb } = ctx;

      const [{ data: crs, error: cErr }, { data: qs, error: qErr }] = await Promise.all([
        sb.from("courses").select("id,code,title").order("code"),
        sb
          .from("question_bank")
          .select("id,course_id,topic,difficulty,stem,choices,correct_index,explanation,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (cErr) throw cErr;
      if (qErr) throw qErr;
      courses = crs || [];
      cache = qs || [];

      document.getElementById("filter-course").innerHTML =
        `<option value="">Tất cả khóa</option>` + courseOptions("");
      document.getElementById("form-course").innerHTML = courseOptions(courses[0]?.id);

      paint();
      document.getElementById("filter-course").addEventListener("change", paint);

      document.getElementById("add-form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const choices = [0, 1, 2, 3].map((i) =>
          (fd.get("choice_" + i) || "").toString().trim()
        );
        if (choices.some((c) => !c)) {
          document.getElementById("form-msg").innerHTML =
            `<span class="adm-msg--err">Nhập đủ 4 lựa chọn.</span>`;
          return;
        }
        const row = {
          course_id: fd.get("course_id") || null,
          topic: (fd.get("topic") || "").toString().trim() || null,
          difficulty: fd.get("difficulty") || "co_ban",
          stem: (fd.get("stem") || "").toString().trim(),
          choices,
          correct_index: Number(fd.get("correct_index")) || 0,
          explanation: (fd.get("explanation") || "").toString().trim() || null,
        };
        const { data, error } = await sb.from("question_bank").insert(row).select().maybeSingle();
        if (error) {
          document.getElementById("form-msg").innerHTML =
            `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        cache.unshift(data);
        ev.target.reset();
        document.getElementById("form-course").innerHTML = courseOptions(courses[0]?.id);
        document.getElementById("form-msg").textContent = "Đã thêm câu hỏi.";
        paint();
      });

      document.getElementById("rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-del]");
        if (!btn || !confirm("Xóa câu hỏi này?")) return;
        const id = btn.getAttribute("data-del");
        const { error } = await sb.from("question_bank").delete().eq("id", id);
        if (error) return alert(error.message);
        cache = cache.filter((q) => q.id !== id);
        paint();
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
