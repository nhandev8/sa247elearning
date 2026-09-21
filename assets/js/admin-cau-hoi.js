/* Ngân hàng câu hỏi — scope chương/khóa + import JSON lô */
(function () {
  let cache = [];
  let courses = [];
  let modulesByCourse = {};

  const LEVEL_LABEL = {
    nho_hieu: "Nhớ–hiểu",
    ap_dung: "Áp dụng",
    phan_tich: "Phân tích",
  };
  const LEVEL_TO_DIFF = {
    nho_hieu: "co_ban",
    ap_dung: "trung_binh",
    phan_tich: "nang_cao",
  };

  function stemPreview(s) {
    const t = (s || "").replace(/\s+/g, " ").trim();
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function paint() {
    const cid = document.getElementById("filter-course").value;
    const scope = document.getElementById("filter-scope").value;
    const mod = document.getElementById("filter-module").value;
    const list = cache.filter((q) => {
      if (cid && q.course_id !== cid) return false;
      if (scope && (q.scope || "khoa") !== scope) return false;
      if (mod && (q.module_code || "") !== mod) return false;
      return true;
    });
    document.getElementById("rows").innerHTML = list
      .map((q) => {
        const c = courses.find((x) => x.id === q.course_id);
        return `<tr>
          <td>${esc(c?.code || "—")}</td>
          <td>${esc(q.scope || "khoa")}${q.module_code ? " · " + esc(q.module_code) : ""}</td>
          <td>${esc(LEVEL_LABEL[q.level] || q.level || sa247Admin.difficultyVi(q.difficulty))}</td>
          <td title="${esc(q.external_code || "")}">${esc(stemPreview(q.stem))}</td>
          <td>${(q.choices || []).length} LC · #${(q.correct_index || 0) + 1}</td>
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

  function fillModuleSelect(selectEl, courseId, selected, includeEmpty) {
    const mods = modulesByCourse[courseId] || [];
    const empty = includeEmpty ? `<option value="">—</option>` : "";
    selectEl.innerHTML =
      empty +
      mods
        .map(
          (m) =>
            `<option value="${esc(m.code)}"${m.code === selected ? " selected" : ""}>${esc(
              m.code
            )} · ${esc(m.title || "")}</option>`
        )
        .join("");
  }

  function parseImportPayload(raw) {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return { questions: data, meta: {} };
    }
    if (data && Array.isArray(data.questions)) {
      return {
        questions: data.questions,
        meta: {
          course_code: data.course_code,
          scope: data.scope,
          module_code: data.module_code,
        },
      };
    }
    throw new Error("JSON phải là mảng câu hỏi hoặc object có trường questions[].");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Ngân hàng câu hỏi");
      if (!ctx) return;
      const { sb } = ctx;

      const [{ data: crs, error: cErr }, { data: mods, error: mErr }, { data: qs, error: qErr }] =
        await Promise.all([
          sb.from("courses").select("id,code,title").order("code"),
          sb.from("modules").select("id,course_id,code,title,sort_order").order("sort_order"),
          sb
            .from("question_bank")
            .select(
              "id,course_id,topic,difficulty,stem,choices,correct_index,explanation,scope,module_code,lesson_code,source_ref,level,external_code,is_published,created_at"
            )
            .order("created_at", { ascending: false }),
        ]);
      if (cErr) throw cErr;
      if (mErr) throw mErr;
      if (qErr) throw qErr;
      courses = crs || [];
      cache = qs || [];
      modulesByCourse = {};
      (mods || []).forEach((m) => {
        (modulesByCourse[m.course_id] ||= []).push(m);
      });

      document.getElementById("filter-course").innerHTML =
        `<option value="">Tất cả khóa</option>` + courseOptions("");
      document.getElementById("form-course").innerHTML = courseOptions(courses[0]?.id);
      fillModuleSelect(document.getElementById("form-module"), courses[0]?.id, "", true);
      fillModuleSelect(document.getElementById("filter-module"), "", "", true);
      document.getElementById("filter-module").innerHTML = `<option value="">Tất cả chương</option>`;

      paint();

      document.getElementById("filter-course").addEventListener("change", () => {
        const cid = document.getElementById("filter-course").value;
        fillModuleSelect(document.getElementById("filter-module"), cid, "", true);
        const fm = document.getElementById("filter-module");
        fm.insertAdjacentHTML("afterbegin", `<option value="">Tất cả chương</option>`);
        fm.value = "";
        paint();
      });
      document.getElementById("filter-scope").addEventListener("change", paint);
      document.getElementById("filter-module").addEventListener("change", paint);

      document.getElementById("form-course").addEventListener("change", (ev) => {
        fillModuleSelect(document.getElementById("form-module"), ev.target.value, "", true);
      });
      document.getElementById("form-scope").addEventListener("change", (ev) => {
        document.getElementById("form-module-wrap").hidden = ev.target.value !== "chuong";
      });

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
        const scope = fd.get("scope") || "khoa";
        const level = fd.get("level") || null;
        const moduleCode =
          scope === "chuong" ? (fd.get("module_code") || "").toString().trim().toUpperCase() : null;
        if (scope === "chuong" && !moduleCode) {
          document.getElementById("form-msg").innerHTML =
            `<span class="adm-msg--err">Chọn mã chương khi scope = chuong.</span>`;
          return;
        }
        const row = {
          course_id: fd.get("course_id") || null,
          topic: (fd.get("topic") || "").toString().trim() || null,
          difficulty: LEVEL_TO_DIFF[level] || fd.get("difficulty") || "co_ban",
          stem: (fd.get("stem") || "").toString().trim(),
          choices,
          correct_index: Number(fd.get("correct_index")) || 0,
          explanation: (fd.get("explanation") || "").toString().trim() || null,
          scope,
          module_code: moduleCode,
          source_ref: (fd.get("source_ref") || "").toString().trim() || null,
          level: level || null,
          external_code: (fd.get("external_code") || "").toString().trim() || null,
          is_published: true,
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
        document.getElementById("form-scope").value = "chuong";
        document.getElementById("form-module-wrap").hidden = false;
        fillModuleSelect(document.getElementById("form-module"), courses[0]?.id, "", true);
        document.getElementById("form-msg").textContent = "Đã thêm câu hỏi.";
        paint();
      });

      document.getElementById("import-form")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const msg = document.getElementById("import-msg");
        const raw = document.getElementById("import-json").value.trim();
        if (!raw) {
          msg.innerHTML = `<span class="adm-msg--err">Dán JSON bank (định dạng content/quiz).</span>`;
          return;
        }
        let parsed;
        try {
          parsed = parseImportPayload(raw);
        } catch (e) {
          msg.innerHTML = `<span class="adm-msg--err">${esc(e.message)}</span>`;
          return;
        }
        const courseId =
          document.getElementById("import-course").value ||
          courses.find((c) => c.code === parsed.meta.course_code)?.id;
        if (!courseId) {
          msg.innerHTML = `<span class="adm-msg--err">Chọn khóa hoặc ghi course_code trong JSON.</span>`;
          return;
        }
        const scope = parsed.meta.scope || document.getElementById("import-scope").value || "chuong";
        const moduleCode =
          scope === "chuong"
            ? (parsed.meta.module_code || document.getElementById("import-module").value || "")
                .toString()
                .trim()
                .toUpperCase()
            : null;
        if (scope === "chuong" && !moduleCode) {
          msg.innerHTML = `<span class="adm-msg--err">Thiếu module_code cho import scope chuong.</span>`;
          return;
        }

        const rows = [];
        for (const q of parsed.questions) {
          if (!q.stem || !Array.isArray(q.choices) || q.choices.length !== 4) continue;
          const answer = Number(q.answer ?? q.correct_index);
          if (answer < 0 || answer > 3 || Number.isNaN(answer)) continue;
          rows.push({
            course_id: courseId,
            stem: String(q.stem).trim(),
            choices: q.choices.map((c) => String(c)),
            correct_index: answer,
            explanation: q.explanation ? String(q.explanation).trim() : null,
            scope,
            module_code: moduleCode,
            source_ref: q.source_ref || null,
            level: q.level || null,
            external_code: q.code || q.external_code || null,
            difficulty: LEVEL_TO_DIFF[q.level] || "co_ban",
            topic: moduleCode || scope,
            is_published: true,
          });
        }
        if (!rows.length) {
          msg.innerHTML = `<span class="adm-msg--err">Không có câu hỏi hợp lệ trong JSON.</span>`;
          return;
        }

        const dry = document.getElementById("import-dry").checked;
        if (dry) {
          msg.textContent = `Dry-run: ${rows.length} câu sẽ upsert (chưa ghi DB).`;
          return;
        }

        let ok = 0;
        let fail = 0;
        for (const row of rows) {
          try {
            let data = null;
            let error = null;
            if (row.external_code) {
              const found = await sb
                .from("question_bank")
                .select("id")
                .eq("course_id", row.course_id)
                .eq("external_code", row.external_code)
                .maybeSingle();
              if (found.data?.id) {
                ({ data, error } = await sb
                  .from("question_bank")
                  .update(row)
                  .eq("id", found.data.id)
                  .select()
                  .maybeSingle());
              } else {
                ({ data, error } = await sb.from("question_bank").insert(row).select().maybeSingle());
              }
            } else {
              ({ data, error } = await sb.from("question_bank").insert(row).select().maybeSingle());
            }
            if (error) {
              fail += 1;
              console.error(error);
            } else if (data) {
              ok += 1;
              const ix = cache.findIndex((x) => x.id === data.id);
              if (ix >= 0) cache[ix] = data;
              else cache.unshift(data);
            }
          } catch (e) {
            fail += 1;
            console.error(e);
          }
        }
        msg.textContent = `Import xong: ${ok} câu OK${fail ? `, ${fail} lỗi` : ""}. Gắn vào bài kiểm tra ở trang Bài kiểm tra hoặc chạy seed_quiz_bank.py.`;
        paint();
      });

      document.getElementById("import-course").innerHTML =
        `<option value="">Theo JSON course_code</option>` + courseOptions("");
      document.getElementById("import-course").addEventListener("change", (ev) => {
        fillModuleSelect(document.getElementById("import-module"), ev.target.value, "", true);
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
