/* Bài kiểm tra cuối khóa — cấu hình số câu, điểm đạt, số lượt, phân bổ (blueprint) */
(function () {
  let sb = null;
  let courses = [];
  let finals = {};
  let bankCount = {};
  let cur = null;
  let checkTimer = null;
  let lastCheck = null;

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  const LEVELS = [
    ["nho_hieu", "f-l1"],
    ["ap_dung", "f-l2"],
    ["phan_tich", "f-l3"],
  ];

  function groupLabel(g) {
    if (g === "integrative") return "Tình huống tổng hợp";
    const m = (cur?.modules || []).find((x) => x.code === g);
    return m ? `${m.code} · ${m.title || ""}` : g;
  }

  function errVi(code) {
    const [k, a, b] = String(code).split(":");
    return (
      {
        question_count_range: "Số câu mỗi đề phải từ 1 đến 20.",
        blueprint_missing: "Chưa có phân bổ câu hỏi.",
        blueprint_invalid: "Phân bổ không hợp lệ.",
        modules_invalid: "Phân bổ chương không hợp lệ.",
        quota_invalid: `Số câu của nhóm ${groupLabel(a)} phải là số nguyên ≥ 0.`,
        module_unknown: `Chương ${a} không tồn tại hoặc chưa xuất bản.`,
        insufficient: `Ngân hàng nhóm ${groupLabel(a)} không đủ câu cho số câu rút.`,
        sum_mismatch: `Tổng phân bổ (${a}) khác số câu mỗi đề (${b}).`,
        levels_sum: `Tổng tỷ lệ mức độ phải bằng 100% (hiện ${a}%).`,
        low_variety: `Nhóm ${groupLabel(a)} có ít câu — các lượt làm lại dễ trùng đề.`,
        max_attempts_range: "Số lượt làm phải từ 1 đến 6.",
        pass_percent_range: "Điểm đạt phải từ 50% đến 100%.",
        not_authorized: "Tài khoản chưa có quyền quản lý nội dung (cần xác thực 2 lớp).",
        course_not_found: "Không tìm thấy khóa học.",
      }[k] || code
    );
  }

  function paintList() {
    $("rows").innerHTML = courses
      .map((c) => {
        const q = finals[c.id];
        const n = bankCount[c.id] || 0;
        const st = !q
          ? '<span class="adm-badge adm-badge--draft">Chưa cấu hình</span>'
          : q.is_published
            ? '<span class="adm-badge adm-badge--ok">Đang mở</span>'
            : '<span class="adm-badge adm-badge--draft">Ẩn</span>';
        return `<tr data-code="${esc(c.code)}"${cur?.course_code === c.code ? ' class="is-on"' : ""}>
          <td><strong>${esc(c.code)}</strong><div class="adm-muted">${esc(c.title || "")}</div></td>
          <td>${q ? esc(q.question_count ?? 20) : "—"}</td>
          <td>${q ? esc(q.pass_percent) + "%" : "—"}</td>
          <td>${q ? esc(q.max_attempts) : "—"}</td>
          <td>${n} câu</td>
          <td>${st}</td>
          <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-open="${esc(c.code)}">Cấu hình</button></td>
        </tr>`;
      })
      .join("");
    $("adm-status").textContent = `${courses.length} khóa học`;
  }

  function bankFor(group) {
    const out = { nho_hieu: 0, ap_dung: 0, phan_tich: 0, other: 0, total: 0 };
    (cur?.bank || []).forEach((b) => {
      if (b.group !== group) return;
      const k = out[b.level] !== undefined && b.level !== "other" ? b.level : "other";
      out[k] += Number(b.n) || 0;
      out.total += Number(b.n) || 0;
    });
    return out;
  }

  function paintBlueprint(bp) {
    const groups = (cur.modules || []).map((m) => m.code).concat("integrative");
    const mods = bp?.modules || {};
    $("bp-rows").innerHTML = groups
      .map((g) => {
        const b = bankFor(g);
        const need = g === "integrative" ? Number(bp?.integrative) || 0 : Number(mods[g]) || 0;
        return `<tr data-group="${esc(g)}">
          <td>${esc(groupLabel(g))}</td>
          <td><strong>${b.total}</strong> <small>(${b.nho_hieu} / ${b.ap_dung} / ${b.phan_tich}${
            b.other ? ` · ${b.other} chưa gắn mức` : ""
          })</small></td>
          <td><input type="number" min="0" max="20" value="${need}" data-need="${esc(g)}" aria-label="Số câu rút ${esc(g)}" /></td>
          <td data-eval="${esc(g)}">—</td>
        </tr>`;
      })
      .join("");
    const lv = bp?.levels || {};
    LEVELS.forEach(([k, id]) => {
      $(id).value = lv[k] ?? "";
    });
  }

  function readBlueprint() {
    const modules = {};
    let integrative = 0;
    document.querySelectorAll("[data-need]").forEach((inp) => {
      const v = Math.max(0, Math.floor(Number(inp.value) || 0));
      if (inp.dataset.need === "integrative") integrative = v;
      else modules[inp.dataset.need] = v;
    });
    const bp = { modules, integrative };
    const lv = {};
    let any = false;
    LEVELS.forEach(([k, id]) => {
      const raw = $(id).value;
      if (raw !== "") any = true;
      lv[k] = Math.max(0, Math.floor(Number(raw) || 0));
    });
    if (any) bp.levels = lv;
    return bp;
  }

  function paintSum() {
    const bp = readBlueprint();
    const sum = Object.values(bp.modules).reduce((a, b) => a + b, 0) + bp.integrative;
    const count = Number($("f-count").value) || 0;
    $("bp-sum").textContent = String(sum);
    $("bp-sum-note").innerHTML =
      sum === count ? '<span class="adm-badge adm-badge--ok">Khớp</span>' : `<span class="adm-badge adm-badge--warn">Cần ${count}</span>`;
    if (bp.levels) {
      const t = bp.levels.nho_hieu + bp.levels.ap_dung + bp.levels.phan_tich;
      $("lvl-note").textContent = t === 100 ? "Tổng 100%." : `Tổng hiện ${t}% — cần đúng 100%.`;
    } else {
      $("lvl-note").textContent = "Để trống: rút ngẫu nhiên không theo mức độ.";
    }
  }

  function paintCheck(chk) {
    lastCheck = chk;
    const box = $("chk-box");
    document.querySelectorAll("[data-eval]").forEach((td) => {
      const g = td.dataset.eval;
      const cell = (chk?.cells || []).find((c) => c.group === g);
      if (!cell) {
        td.textContent = "—";
        return;
      }
      if (cell.need === 0) td.innerHTML = '<span class="adm-muted">Không rút</span>';
      else if (cell.available < cell.need) td.innerHTML = '<span class="adm-badge adm-badge--danger">Thiếu câu</span>';
      else if (cell.available < 3 * cell.need) td.innerHTML = '<span class="adm-badge adm-badge--warn">Ít đa dạng</span>';
      else td.innerHTML = '<span class="adm-badge adm-badge--ok">Đủ</span>';
    });
    const errs = chk?.errors || [];
    const warns = chk?.warnings || [];
    box.className = "bq-check " + (chk?.ok ? "is-ok" : "is-err");
    box.innerHTML = chk?.ok
      ? `<strong>Phân bổ khả thi.</strong>${
          warns.length ? `<ul>${warns.map((w) => `<li>${esc(errVi(w))}</li>`).join("")}</ul>` : ""
        }`
      : `<strong>Chưa thể lưu:</strong><ul>${errs.map((e) => `<li>${esc(errVi(e))}</li>`).join("")}</ul>${
          warns.length ? `<p class="adm-muted" style="margin:.5rem 0 0">Lưu ý:</p><ul>${warns.map((w) => `<li>${esc(errVi(w))}</li>`).join("")}</ul>` : ""
        }`;
    $("btn-save").disabled = !chk?.ok;
  }

  async function runCheck() {
    if (!cur) return;
    paintSum();
    const { data, error } = await sb.rpc("admin_check_blueprint", {
      p_course_code: cur.course_code,
      p_question_count: Number($("f-count").value) || 0,
      p_blueprint: readBlueprint(),
    });
    if (error) {
      paintCheck({ ok: false, errors: [error.message], warnings: [], cells: [] });
      return;
    }
    paintCheck(data);
  }

  function scheduleCheck() {
    paintSum();
    clearTimeout(checkTimer);
    checkTimer = setTimeout(runCheck, 350);
  }

  async function openCourse(code) {
    $("form-msg").textContent = "";
    const { data, error } = await sb.rpc("admin_final_quiz_config", { p_course_code: code });
    if (error) {
      $("form-msg").innerHTML = `<span class="adm-msg--err">${esc(errVi(error.message))}</span>`;
      return;
    }
    cur = data;
    const q = data.quiz;
    $("cfg-card").hidden = false;
    $("cfg-title").textContent = `Cấu hình · ${data.course_code} · ${data.course_title || ""}`;
    $("f-title").value = q?.title || `Kiểm tra cuối khóa ${data.course_code}`;
    $("f-count").value = q?.question_count ?? 20;
    $("f-pass").value = q?.pass_percent ?? 70;
    $("f-attempts").value = q?.max_attempts ?? 6;
    $("f-published").checked = q ? !!q.is_published : true;
    paintBlueprint(q?.blueprint || data.default_blueprint);
    paintList();
    await runCheck();
    $("cfg-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function useDefault() {
    if (!cur) return;
    const { data, error } = await sb.rpc("admin_check_blueprint", {
      p_course_code: cur.course_code,
      p_question_count: Number($("f-count").value) || 20,
      p_blueprint: null,
    });
    if (error) {
      $("form-msg").innerHTML = `<span class="adm-msg--err">${esc(errVi(error.message))}</span>`;
      return;
    }
    paintBlueprint(data.default_blueprint);
    await runCheck();
  }

  async function save(ev) {
    ev.preventDefault();
    if (!cur) return;
    await runCheck();
    if (!lastCheck?.ok) return;
    $("btn-save").disabled = true;
    $("form-msg").textContent = "Đang lưu…";
    const { error } = await sb.rpc("admin_save_final_quiz_config", {
      p_course_code: cur.course_code,
      p_title: $("f-title").value.trim(),
      p_question_count: Number($("f-count").value),
      p_pass_percent: Number($("f-pass").value),
      p_max_attempts: Number($("f-attempts").value),
      p_blueprint: readBlueprint(),
      p_is_published: $("f-published").checked,
    });
    $("btn-save").disabled = false;
    if (error) {
      const m = String(error.message || "");
      const list = m.startsWith("blueprint_invalid:") ? JSON.parse(m.slice(18) || "[]") : [m];
      $("form-msg").innerHTML = `<span class="adm-msg--err">${list.map((e) => esc(errVi(e))).join("<br />")}</span>`;
      return;
    }
    $("form-msg").innerHTML = '<span class="adm-msg--ok">Đã lưu. Lượt làm mới sẽ dùng cấu hình này; lượt đang làm dở giữ nguyên đề.</span>';
    await loadList();
    await openCourse(cur.course_code);
  }

  async function loadList() {
    const [{ data: crs, error: e1 }, { data: qd, error: e2 }, { data: qb, error: e3 }] = await Promise.all([
      sb.from("courses").select("id,code,title").order("code"),
      sb
        .from("quiz_defs")
        .select("id,course_id,title,pass_percent,max_attempts,question_count,is_published,created_at")
        .eq("scope", "khoa")
        .order("is_published", { ascending: false })
        .order("created_at", { ascending: false }),
      sb.from("question_bank").select("course_id").eq("is_published", true).eq("purpose", "chinh_thuc"),
    ]);
    const err = e1 || e2 || e3;
    if (err) throw err;
    courses = crs || [];
    finals = {};
    (qd || []).forEach((q) => {
      if (!finals[q.course_id]) finals[q.course_id] = q;
    });
    bankCount = {};
    (qb || []).forEach((q) => {
      bankCount[q.course_id] = (bankCount[q.course_id] || 0) + 1;
    });
    paintList();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Bài kiểm tra");
      if (!ctx) return;
      sb = ctx.sb;
      await loadList();

      $("rows").addEventListener("click", (e) => {
        const b = e.target.closest("[data-open]");
        if (b) openCourse(b.dataset.open);
      });
      $("cfg-form").addEventListener("input", (e) => {
        if (e.target.matches("[data-need], #f-count, #f-l1, #f-l2, #f-l3")) scheduleCheck();
      });
      $("btn-default").addEventListener("click", useDefault);
      $("cfg-form").addEventListener("submit", save);

      const pre = new URLSearchParams(location.search).get("course");
      if (pre) openCourse(pre.toUpperCase());
    } catch (e) {
      $("adm-status").innerHTML = `<span class="adm-msg--err">${esc(e.message || e)}</span>`;
    }
  });
})();
