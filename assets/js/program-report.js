/* SA247 · Báo cáo kết quả học tập dùng chung (admin Campus, Phân tích học tập, Cổng đối tác) */
(function () {
  const CSS = `
  .rp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.7rem;margin:.9rem 0}
  .rp-card{border:1px solid #e2e8f0;border-radius:12px;padding:.8rem .9rem;background:#fff}
  .rp-card strong{display:block;font-size:1.45rem;line-height:1.1;color:#0b1f3a}
  .rp-card span{font-size:.82rem;color:#475569}
  .rp-card--good strong{color:#047857}.rp-card--warn strong{color:#b45309}
  .rp-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;background:#fff;margin:.6rem 0 1rem}
  .rp-table{width:100%;border-collapse:collapse;font-size:.9rem}
  .rp-table th,.rp-table td{padding:.5rem .65rem;border-bottom:1px solid #eef2f6;text-align:left;vertical-align:top}
  .rp-table th{background:#f8fafc;font-weight:700;color:#334155;white-space:nowrap}
  .rp-table td.num,.rp-table th.num{text-align:right;white-space:nowrap}
  .rp-table tr.rp-rate td{background:#f0fdfa;font-weight:700}
  .rp-table tr.rp-group td{background:#f8fafc;font-weight:700;color:#0f766e;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
  .rp-tools{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.4rem 0}
  .rp-tools input,.rp-tools select{font:inherit;font-size:.9rem;padding:.4rem .6rem;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
  .rp-tools .rp-count{color:#64748b;font-size:.88rem;margin-left:auto}
  .rp-btn{font:inherit;font-size:.9rem;font-weight:700;padding:.45rem .9rem;border-radius:8px;border:1px solid #0b1f3a;background:#0b1f3a;color:#fff;cursor:pointer}
  .rp-btn--line{background:#fff;color:#0b1f3a}
  .rp-pill{display:inline-block;padding:.1rem .5rem;border-radius:999px;font-size:.78rem;font-weight:700;white-space:nowrap}
  .rp-pill--ok{background:#dcfce7;color:#166534}.rp-pill--warn{background:#fef3c7;color:#92400e}
  .rp-pill--bad{background:#fee2e2;color:#991b1b}.rp-pill--mute{background:#f1f5f9;color:#475569}
  .rp-pill--info{background:#e0f2fe;color:#075985}
  .rp-bar{height:.4rem;border-radius:999px;background:#e2e8f0;overflow:hidden;min-width:4rem;margin-top:.25rem}
  .rp-bar i{display:block;height:100%;background:#0f766e}
  .rp-note{color:#64748b;font-size:.85rem;margin:.3rem 0}
  .rp-link{background:none;border:0;padding:0;font:inherit;color:#0f766e;text-decoration:underline;cursor:pointer;text-align:left}
  `;
  function injectCss() {
    if (document.getElementById("rp-css")) return;
    const s = document.createElement("style");
    s.id = "rp-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "");
  const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("vi-VN") : "");
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const isoDateTime = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return `${isoDate(v)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fmtNum = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("vi-VN"));
  const fmtPct = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("vi-VN") + "%");

  function learnState(r) {
    if (!r.user_id) return { key: "chua_kich_hoat", label: "Chưa kích hoạt", tone: "mute" };
    if (r.completed_at) return { key: "hoan_thanh", label: "Hoàn thành", tone: "ok" };
    if ((r.started_lessons || 0) > 0) return { key: "dang_hoc", label: "Đang học", tone: "info" };
    return { key: "chua_bat_dau", label: "Chưa bắt đầu", tone: "warn" };
  }
  function resultState(r) {
    if (!(r.attempts > 0)) return { key: "chua_kiem_tra", label: "Chưa kiểm tra", tone: "mute" };
    if (r.passed) return { key: "dat", label: "Đạt", tone: "ok" };
    return { key: "chua_dat", label: "Chưa đạt", tone: "bad" };
  }
  function certState(r) {
    if (r.cert_code) return { key: "da_cap", label: "Đã cấp", tone: "ok" };
    if (r.passed) return { key: "du_dieu_kien", label: "Đạt, chưa cấp", tone: "warn" };
    return { key: "chua_du", label: "Chưa đủ điều kiện", tone: "mute" };
  }
  const pill = (s) => `<span class="rp-pill rp-pill--${s.tone}">${esc(s.label)}</span>`;

  const FUNNEL = [
    { group: "Tham gia" },
    { key: "assigned", label: "Tổng số được phân / đăng ký" },
    { key: "activated", label: "Đã kích hoạt tài khoản", programOnly: true },
    { key: "logged_in", label: "Đã đăng nhập" },
    { group: "Học tập" },
    { key: "not_started", label: "Chưa bắt đầu học" },
    { key: "started", label: "Đã bắt đầu học" },
    { key: "in_progress", label: "Đang học" },
    { key: "completed", label: "Hoàn thành khóa học" },
    { group: "Kiểm tra" },
    { key: "tested", label: "Đã làm bài kiểm tra" },
    { key: "passed", label: "Đạt" },
    { key: "failed", label: "Chưa đạt" },
    { key: "avg_score", label: "Điểm cao nhất trung bình", suffix: "%" },
    { group: "Chứng nhận" },
    { key: "certified", label: "Đã cấp chứng nhận" },
    { key: "eligible_no_cert", label: "Đạt nhưng chưa cấp chứng nhận" },
    { key: "not_eligible", label: "Chưa đủ điều kiện cấp chứng nhận" },
    { group: "Tỷ lệ" },
    { key: "completion_rate", label: "Tỷ lệ hoàn thành (trên tổng)", rate: true },
    { key: "pass_rate", label: "Tỷ lệ đạt (trên số đã kiểm tra)", rate: true },
    { key: "cert_rate", label: "Tỷ lệ cấp chứng nhận (trên số đạt)", rate: true },
  ];

  function funnelTable(columns, opts) {
    const o = opts || {};
    const head = `<tr><th>Chỉ tiêu</th>${columns.map((c) => `<th class="num">${esc(c.label)}</th>`).join("")}</tr>`;
    const body = FUNNEL.filter((m) => !(m.programOnly && !o.program))
      .map((m) => {
        if (m.group) return `<tr class="rp-group"><td colspan="${columns.length + 1}">${esc(m.group)}</td></tr>`;
        const cells = columns
          .map((c) => {
            const v = c.data ? c.data[m.key] : null;
            const txt = m.rate ? fmtPct(v) : m.suffix ? (v == null ? "—" : fmtNum(v) + m.suffix) : fmtNum(v);
            return `<td class="num">${txt}</td>`;
          })
          .join("");
        return `<tr class="${m.rate ? "rp-rate" : ""}"><td>${esc(m.label)}</td>${cells}</tr>`;
      })
      .join("");
    return `<div class="rp-wrap"><table class="rp-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function cards(items) {
    return `<div class="rp-cards">${items
      .map(([label, val, tone]) => `<div class="rp-card${tone ? " rp-card--" + tone : ""}"><strong>${val}</strong><span>${esc(label)}</span></div>`)
      .join("")}</div>`;
  }

  // ---- Cột xuất file ----
  const COLS_PROGRAM = [
    ["Mã SV", (r) => (/^0\d+$/.test(r.external_code || "") ? `="${r.external_code}"` : r.external_code)],
    ["Họ tên", (r) => r.full_name],
    ["Email", (r) => r.email],
    ["Khoa", (r) => r.faculty],
    ["Ngành", (r) => r.major],
    ["Khóa (năm)", (r) => r.cohort],
    ["Đợt", (r, ctx) => ctx.programName],
    ["Khóa học", (r) => r.course_code + " · " + (r.course_title || "")],
    ["Trạng thái học", (r) => learnState(r).label],
    ["% hoàn thành", (r) => r.progress_percent ?? 0],
    ["Bài đã xong", (r) => (r.done_lessons || 0) + " trên " + (r.total_lessons || 0)],
    ["Số lần kiểm tra", (r) => r.attempts || 0],
    ["Điểm cao nhất", (r) => (r.attempts > 0 ? r.best_score : "")],
    ["Kết quả", (r) => resultState(r).label],
    ["Ngày đạt", (r) => isoDate(r.passed_at)],
    ["Ngày hoàn thành", (r) => isoDate(r.completed_at)],
    ["Chứng nhận", (r) => certState(r).label],
    ["Mã chứng nhận", (r) => r.cert_code],
    ["Ngày cấp", (r) => isoDate(r.cert_issued_at)],
    ["Đăng nhập gần nhất", (r) => isoDateTime(r.last_sign_in_at)],
  ];
  const SOURCE_VI = { paid: "Tự mua", admin_grant: "Admin cấp", partner_program: "Chương trình đối tác" };
  const COLS_ENROLLMENT = [
    ["Họ tên", (r) => r.full_name],
    ["Email", (r) => r.email],
    ["Khóa học", (r) => r.course_code + " · " + (r.course_title || "")],
    ["Nguồn quyền học", (r) => SOURCE_VI[r.source] || r.source],
    ["Chương trình", (r) => r.program_name],
    ["Ngày đăng ký", (r) => isoDate(r.enrolled_at)],
    ["Trạng thái học", (r) => learnState(r).label],
    ["% hoàn thành", (r) => r.progress_percent ?? 0],
    ["Bài đã xong", (r) => (r.done_lessons || 0) + " trên " + (r.total_lessons || 0)],
    ["Số lần kiểm tra", (r) => r.attempts || 0],
    ["Điểm cao nhất", (r) => (r.attempts > 0 ? r.best_score : "")],
    ["Kết quả", (r) => resultState(r).label],
    ["Ngày đạt", (r) => isoDate(r.passed_at)],
    ["Ngày hoàn thành", (r) => isoDate(r.completed_at)],
    ["Chứng nhận", (r) => certState(r).label],
    ["Mã chứng nhận", (r) => r.cert_code],
    ["Ngày cấp", (r) => isoDate(r.cert_issued_at)],
    ["Đăng nhập gần nhất", (r) => isoDateTime(r.last_sign_in_at)],
  ];

  function toCsv(cols, rows, ctx) {
    const q = (v) => {
      const s = String(v ?? "");
      return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.map((c) => q(c[0])).join(",")];
    rows.forEach((r) => lines.push(cols.map((c) => q(c[1](r, ctx || {}))).join(",")));
    return "\uFEFF" + lines.join("\r\n");
  }
  function slug(s) {
    return String(s || "bao-cao")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }
  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function printDoc(title, innerHtml) {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        @page{size:A4 landscape;margin:12mm}
        body{font-family:"Be Vietnam Pro",Arial,sans-serif;color:#0f172a;font-size:10.5pt}
        h1{font-size:16pt;margin:0 0 4pt}h2{font-size:12pt;margin:14pt 0 6pt}
        .meta{color:#475569;margin:0 0 2pt}
        .brand{font-weight:800;color:#0b1f3a;margin-bottom:8pt}.brand em{color:#b45309;font-style:normal}
        table{width:100%;border-collapse:collapse;margin-top:4pt}
        th,td{border:1px solid #cbd5e1;padding:3pt 5pt;text-align:left;vertical-align:top}
        th{background:#f1f5f9}td.num,th.num{text-align:right}
        tr.rp-group td{background:#f8fafc;font-weight:700}
        tr.rp-rate td{font-weight:700}
        .rp-pill{font-weight:600}
        .rp-wrap{overflow:visible}
        .foot{margin-top:12pt;color:#64748b;font-size:9pt}
      </style></head><body>${innerHtml}</body></html>`);
    doc.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 2000);
    }, 300);
  }

  // ---- Bảng danh sách có lọc ----
  function studentTable(el, rows, opts) {
    const o = opts || {};
    const courses = [...new Set(rows.map((r) => r.course_code))].sort();
    el.innerHTML = `
      <div class="rp-tools">
        <input type="search" data-f="q" placeholder="Tìm tên, email, mã SV…" />
        ${courses.length > 1 ? `<select data-f="course"><option value="">Mọi khóa</option>${courses.map((c) => `<option>${esc(c)}</option>`).join("")}</select>` : ""}
        <select data-f="learn">
          <option value="">Mọi trạng thái học</option>
          <option value="chua_kich_hoat">Chưa kích hoạt</option>
          <option value="chua_bat_dau">Chưa bắt đầu</option>
          <option value="dang_hoc">Đang học</option>
          <option value="hoan_thanh">Hoàn thành</option>
        </select>
        <select data-f="result">
          <option value="">Mọi kết quả</option>
          <option value="chua_kiem_tra">Chưa kiểm tra</option>
          <option value="dat">Đạt</option>
          <option value="chua_dat">Chưa đạt</option>
        </select>
        <select data-f="cert">
          <option value="">Mọi trạng thái GCN</option>
          <option value="da_cap">Đã cấp</option>
          <option value="du_dieu_kien">Đạt, chưa cấp</option>
          <option value="chua_du">Chưa đủ điều kiện</option>
        </select>
        <span class="rp-count" data-count></span>
      </div>
      <div class="rp-wrap"><table class="rp-table">
        <thead><tr>
          ${o.program ? "<th>Mã SV</th>" : ""}
          <th>Họ tên</th>
          ${o.program ? "<th>Khoa / ngành</th>" : "<th>Nguồn</th>"}
          <th>Khóa học</th><th>Trạng thái học</th><th class="num">Tiến độ</th>
          <th class="num">Điểm</th><th>Kết quả</th><th>Chứng nhận</th><th>Hoàn thành</th>
        </tr></thead>
        <tbody data-body></tbody>
      </table></div>`;
    const f = (k) => el.querySelector(`[data-f="${k}"]`);
    function filtered() {
      const q = (f("q").value || "").trim().toLowerCase();
      const course = f("course")?.value || "";
      const learn = f("learn").value;
      const result = f("result").value;
      const cert = f("cert").value;
      return rows.filter((r) => {
        if (course && r.course_code !== course) return false;
        if (learn && learnState(r).key !== learn) return false;
        if (result && resultState(r).key !== result) return false;
        if (cert && certState(r).key !== cert) return false;
        if (q) {
          const hay = [r.full_name, r.email, r.external_code, r.faculty, r.major, r.program_name].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }
    function draw() {
      const list = filtered();
      el.querySelector("[data-count]").textContent = `${list.length}/${rows.length} dòng`;
      el.querySelector("[data-body]").innerHTML = list.length
        ? list
            .map((r, i) => {
              const name = esc(r.full_name || r.email || "—");
              const nameCell = o.onStudent && r.user_id
                ? `<button type="button" class="rp-link" data-i="${i}">${name}</button>`
                : name;
              return `<tr>
                ${o.program ? `<td><code>${esc(r.external_code)}</code></td>` : ""}
                <td>${nameCell}<div class="rp-note">${esc(r.email || "")}</div></td>
                ${o.program
                  ? `<td>${esc([r.faculty, r.major].filter(Boolean).join(" · ") || "—")}</td>`
                  : `<td>${esc(SOURCE_VI[r.source] || r.source || "")}${r.program_name ? `<div class="rp-note">${esc(r.program_name)}</div>` : ""}</td>`}
                <td>${esc(r.course_code)}</td>
                <td>${pill(learnState(r))}</td>
                <td class="num">${r.progress_percent ?? 0}%<div class="rp-bar"><i style="width:${Math.min(100, r.progress_percent || 0)}%"></i></div></td>
                <td class="num">${r.attempts > 0 ? esc(r.best_score) + "%" : "—"}</td>
                <td>${pill(resultState(r))}</td>
                <td>${pill(certState(r))}${r.cert_code ? `<div class="rp-note"><code>${esc(r.cert_code)}</code></div>` : ""}</td>
                <td>${esc(fmtDate(r.completed_at)) || "—"}</td>
              </tr>`;
            })
            .join("")
        : `<tr><td colspan="10">Không có dòng phù hợp.</td></tr>`;
      if (o.onStudent) {
        el.querySelectorAll("[data-i]").forEach((b) =>
          b.addEventListener("click", () => o.onStudent(list[Number(b.dataset.i)]))
        );
      }
    }
    el.querySelectorAll("[data-f]").forEach((x) => x.addEventListener("input", draw));
    draw();
    return { filtered };
  }

  // ---- Báo cáo đợt hoàn chỉnh ----
  function renderProgram(el, report, rows, opts) {
    injectCss();
    const o = opts || {};
    const t = report.total || {};
    const courseCols = (report.courses || []).map((c) => ({ label: c.course_code, data: c }));
    const cols = courseCols.length > 1 ? [...courseCols, { label: "Tổng (lượt khóa)", data: t }] : courseCols.length ? courseCols : [{ label: "Tổng", data: t }];
    const period = [fmtDate(report.starts_at), fmtDate(report.ends_at)].filter(Boolean).join(" – ");
    const header = `
      <p class="rp-note">${esc(report.partner_name || "")} · Mã đợt <code>${esc(report.program)}</code>${period ? " · " + esc(period) : ""} · Cập nhật ${esc(fmtDateTime(report.generated_at))}</p>`;
    const cardHtml = cards([
      ["Sinh viên trong đợt", fmtNum(report.members)],
      ["Đã kích hoạt tài khoản", fmtNum(report.linked)],
      ["Hoàn thành", fmtNum(t.completed)],
      ["Đạt kiểm tra", fmtNum(t.passed), "good"],
      ["Đã cấp chứng nhận", fmtNum(t.certified), "good"],
      ["Tỷ lệ hoàn thành", fmtPct(t.completion_rate)],
      ["Tỷ lệ đạt", fmtPct(t.pass_rate)],
    ]);
    el.innerHTML = `
      ${header}
      ${cardHtml}
      <div class="rp-tools">
        <button type="button" class="rp-btn" data-act="csv">Xuất Excel (CSV)</button>
        <button type="button" class="rp-btn rp-btn--line" data-act="print">In / Lưu PDF</button>
        <span class="rp-note">File CSV mở trực tiếp bằng Excel, giữ nguyên tiếng Việt.</span>
      </div>
      <h3 style="margin:1rem 0 .3rem">Kết quả theo khóa học</h3>
      ${funnelTable(cols, { program: true })}
      <h3 style="margin:1rem 0 .3rem">Danh sách chi tiết</h3>
      <div data-students></div>`;
    const st = studentTable(el.querySelector("[data-students]"), rows, { program: true, onStudent: o.onStudent });
    const ctx = { programName: report.name };
    const base = slug(report.program + "-" + (report.name || ""));
    el.querySelector('[data-act="csv"]').addEventListener("click", () => {
      download(`${base}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(COLS_PROGRAM, st.filtered(), ctx));
      o.onExport?.("csv");
    });
    el.querySelector('[data-act="print"]').addEventListener("click", () => {
      const list = st.filtered();
      const rowsHtml = list
        .map(
          (r) => `<tr><td>${esc(r.external_code)}</td><td>${esc(r.full_name || "")}</td><td>${esc(r.email || "")}</td>
          <td>${esc(r.course_code)}</td><td class="num">${r.progress_percent ?? 0}%</td>
          <td class="num">${r.attempts > 0 ? esc(r.best_score) + "%" : "—"}</td><td>${esc(resultState(r).label)}</td>
          <td>${esc(fmtDate(r.completed_at))}</td><td>${esc(certState(r).label)}</td><td>${esc(r.cert_code || "")}</td></tr>`
        )
        .join("");
      printDoc(
        "Báo cáo " + report.program,
        `<div class="brand">SA247 <em>Campus</em></div>
        <h1>Báo cáo đợt đào tạo: ${esc(report.name)}</h1>
        <p class="meta">Đối tác: ${esc(report.partner_name || "")} · Mã đợt: ${esc(report.program)}${period ? " · Thời gian: " + esc(period) : ""}</p>
        <p class="meta">Lập lúc: ${esc(fmtDateTime(report.generated_at))} · Sinh viên trong đợt: ${fmtNum(report.members)}</p>
        <h2>Kết quả theo khóa học</h2>
        ${funnelTable(cols, { program: true })}
        <h2>Danh sách chi tiết (${list.length} dòng)</h2>
        <table><thead><tr><th>Mã SV</th><th>Họ tên</th><th>Email</th><th>Khóa học</th><th class="num">% hoàn thành</th>
        <th class="num">Điểm</th><th>Kết quả</th><th>Ngày hoàn thành</th><th>Chứng nhận</th><th>Mã chứng nhận</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
        <p class="foot">Số liệu tính từ hệ thống học tập SA247 tại thời điểm lập báo cáo. Chứng nhận tra cứu công khai tại sa247.vn/verify/.</p>`
      );
      o.onExport?.("pdf");
    });
  }

  window.SA247Report = {
    injectCss,
    esc,
    fmtDate,
    fmtDateTime,
    fmtNum,
    fmtPct,
    learnState,
    resultState,
    certState,
    pill,
    cards,
    funnelTable,
    studentTable,
    renderProgram,
    toCsv,
    download,
    printDoc,
    slug,
    COLS_PROGRAM,
    COLS_ENROLLMENT,
    SOURCE_VI,
  };
})();
