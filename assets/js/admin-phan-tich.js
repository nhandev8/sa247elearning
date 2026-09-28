/* SA247 · Phân tích học tập: Tổng quan → Khóa học → Sinh viên → kết quả → chứng nhận */
(function () {
  let sb;
  const R = () => window.SA247Report;
  const $ = (id) => document.getElementById(id);

  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }

  function crumbs(items) {
    $("crumbs").innerHTML = items
      .map(([label, href]) => (href ? `<a href="${href}">${R().esc(label)}</a>` : `<strong>${R().esc(label)}</strong>`))
      .join(" › ");
  }

  async function overview() {
    crumbs([["Tổng quan"]]);
    const d = await rpc("admin_analytics_overview");
    const { esc, fmtNum, fmtPct, cards, funnelTable, SOURCE_VI } = R();
    const t = d.total || {};
    const src = Object.entries(d.by_source || {})
      .map(([k, n]) => `${esc(SOURCE_VI[k] || k)}: <strong>${fmtNum(n)}</strong>`)
      .join(" · ");
    const courseRows = (d.courses || [])
      .map(
        (c) => `<tr>
        <td><strong>${esc(c.course_code)}</strong><div class="rp-note">${esc(c.course_title)}</div></td>
        <td class="num">${fmtNum(c.assigned)}</td>
        <td class="num">${fmtNum(c.started)}</td>
        <td class="num">${fmtNum(c.completed)}</td>
        <td class="num">${fmtPct(c.completion_rate)}</td>
        <td class="num">${fmtNum(c.tested)}</td>
        <td class="num">${fmtNum(c.passed)}</td>
        <td class="num">${fmtPct(c.pass_rate)}</td>
        <td class="num">${fmtNum(c.certified)}</td>
        <td class="num">${fmtNum(c.eligible_no_cert)}</td>
        <td><a class="adm-btn adm-btn--line adm-btn--small" href="?course=${encodeURIComponent(c.course_code)}">Chi tiết →</a></td>
      </tr>`
      )
      .join("");
    $("view").innerHTML = `
      <p class="rp-note">Tính trên quyền học đang hoạt động · Cập nhật ${esc(R().fmtDateTime(d.generated_at))}</p>
      ${cards([
        ["Học viên đang có quyền học", fmtNum(d.students)],
        ["Lượt đăng ký khóa", fmtNum(t.assigned)],
        ["Đã bắt đầu học", fmtNum(t.started)],
        ["Hoàn thành khóa", fmtNum(t.completed)],
        ["Đạt kiểm tra", fmtNum(t.passed), "good"],
        ["Chứng nhận đã cấp", fmtNum(d.certificates?.valid), "good"],
        ["Tỷ lệ hoàn thành", fmtPct(t.completion_rate)],
        ["Tỷ lệ đạt", fmtPct(t.pass_rate)],
      ])}
      <p class="rp-note">Nguồn quyền học — ${src || "—"}</p>

      <section class="adm-card" style="margin-top:1rem">
        <h2>Hiệu quả theo khóa học</h2>
        <div class="rp-wrap"><table class="rp-table">
          <thead><tr>
            <th>Khóa học</th><th class="num">Đăng ký</th><th class="num">Bắt đầu</th><th class="num">Hoàn thành</th>
            <th class="num">Tỷ lệ HT</th><th class="num">Đã kiểm tra</th><th class="num">Đạt</th><th class="num">Tỷ lệ đạt</th>
            <th class="num">GCN đã cấp</th><th class="num">Đạt, chưa cấp</th><th></th>
          </tr></thead>
          <tbody>${courseRows || '<tr><td colspan="11">Chưa có quyền học nào.</td></tr>'}</tbody>
        </table></div>
      </section>

      <section class="adm-card" style="margin-top:1rem">
        <h2>Phễu học tập toàn hệ thống</h2>
        ${funnelTable([{ label: "Toàn hệ thống", data: t }])}
      </section>

      <section class="adm-card" style="margin-top:1rem">
        <h2>Thống kê chứng nhận</h2>
        ${cards([
          ["Đang hiệu lực", fmtNum(d.certificates?.valid), "good"],
          ["Cấp trong 30 ngày", fmtNum(d.certificates?.last_30_days)],
          ["Đủ điều kiện, chờ cấp", fmtNum(d.certificates?.eligible), "warn"],
          ["Đã thu hồi", fmtNum(d.certificates?.revoked)],
        ])}
        <p class="rp-note">Quản lý chi tiết tại <a href="../chung-nhan/">Tất cả chứng nhận</a>. Báo cáo theo đợt sinh viên xem ở <a href="../doi-tac/">Campus / Đối tác</a>.</p>
      </section>`;
  }

  async function course(code) {
    crumbs([["Tổng quan", "./"], ["Khóa " + code]]);
    const d = await rpc("admin_analytics_course", { p_course_code: code });
    const { esc, funnelTable, studentTable, toCsv, download, slug, COLS_ENROLLMENT, printDoc, fmtDateTime, learnState, resultState, certState } = R();
    $("view").innerHTML = `
      <h2 style="margin:0 0 .25rem">${esc(d.course_code)} · ${esc(d.course_title)}</h2>
      <p class="rp-note">Cập nhật ${esc(fmtDateTime(d.generated_at))}</p>
      ${funnelTable([{ label: d.course_code, data: d.total || {} }])}
      <div class="rp-tools">
        <button type="button" class="rp-btn" id="csv">Xuất Excel (CSV)</button>
        <button type="button" class="rp-btn rp-btn--line" id="print">In / Lưu PDF</button>
      </div>
      <div id="students"></div>`;
    const st = studentTable($("students"), d.rows || [], {
      program: false,
      onStudent: (r) => {
        location.href = "?user=" + encodeURIComponent(r.user_id) + "&from=" + encodeURIComponent(code);
      },
    });
    $("csv").addEventListener("click", () =>
      download(`${slug(d.course_code)}-hoc-vien-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(COLS_ENROLLMENT, st.filtered()))
    );
    $("print").addEventListener("click", () => {
      const list = st.filtered();
      printDoc(
        "Báo cáo " + d.course_code,
        `<div class="brand">SA247 <em>Quản trị</em></div>
        <h1>Báo cáo khóa học ${esc(d.course_code)} · ${esc(d.course_title)}</h1>
        <p class="meta">Lập lúc ${esc(fmtDateTime(d.generated_at))}</p>
        ${funnelTable([{ label: d.course_code, data: d.total || {} }])}
        <h2>Danh sách (${list.length} dòng)</h2>
        <table><thead><tr><th>Họ tên</th><th>Email</th><th>Nguồn</th><th class="num">% hoàn thành</th><th class="num">Điểm</th>
        <th>Trạng thái học</th><th>Kết quả</th><th>Chứng nhận</th><th>Mã chứng nhận</th></tr></thead><tbody>
        ${list
          .map(
            (r) => `<tr><td>${esc(r.full_name || "")}</td><td>${esc(r.email || "")}</td><td>${esc(R().SOURCE_VI[r.source] || r.source || "")}</td>
          <td class="num">${r.progress_percent ?? 0}%</td><td class="num">${r.attempts > 0 ? esc(r.best_score) + "%" : "—"}</td>
          <td>${esc(learnState(r).label)}</td><td>${esc(resultState(r).label)}</td><td>${esc(certState(r).label)}</td><td>${esc(r.cert_code || "")}</td></tr>`
          )
          .join("")}</tbody></table>`
      );
    });
  }

  async function student(uid, fromCourse) {
    const trail = [["Tổng quan", "./"]];
    if (fromCourse) trail.push(["Khóa " + fromCourse, "?course=" + encodeURIComponent(fromCourse)]);
    trail.push(["Học viên"]);
    crumbs(trail);
    const d = await rpc("admin_analytics_student", { p_user_id: uid });
    const { esc, fmtDate, fmtDateTime, pill, learnState, resultState, certState, SOURCE_VI } = R();
    const programs = (d.programs || [])
      .map((p) => `${esc(p.program_name)} (${esc(p.partner_name)}) · mã SV <code>${esc(p.external_code)}</code>`)
      .join("<br />");
    const rows = (d.rows || [])
      .map(
        (r) => `<tr>
        <td><strong>${esc(r.course_code)}</strong><div class="rp-note">${esc(r.course_title)}</div></td>
        <td>${esc(SOURCE_VI[r.source] || r.source || "")}${r.program_name ? `<div class="rp-note">${esc(r.program_name)}</div>` : ""}
          ${r.enrollment_status !== "active" ? `<div class="rp-note">Quyền học: ${esc(r.enrollment_status)}</div>` : ""}</td>
        <td>${pill(learnState(r))}</td>
        <td class="num">${r.done_lessons || 0}/${r.total_lessons || 0} bài<div class="rp-bar"><i style="width:${Math.min(100, r.progress_percent || 0)}%"></i></div></td>
        <td>${esc(fmtDateTime(r.last_activity_at)) || "—"}</td>
        <td class="num">${r.attempts || 0} lần · cao nhất ${r.attempts > 0 ? esc(r.best_score) + "%" : "—"}</td>
        <td>${pill(resultState(r))}${r.passed_at ? `<div class="rp-note">${esc(fmtDate(r.passed_at))}</div>` : ""}</td>
        <td>${pill(certState(r))}${r.cert_code ? `<div class="rp-note"><a href="../../xac-minh/?code=${encodeURIComponent(r.cert_code)}" target="_blank" rel="noopener">${esc(r.cert_code)}</a></div>` : ""}</td>
      </tr>`
      )
      .join("");
    $("view").innerHTML = `
      <section class="adm-card">
        <h2 style="margin:0 0 .25rem">${esc(d.full_name || d.email || "Học viên")}</h2>
        <p class="rp-note">${esc(d.email || "")} · Đăng nhập gần nhất: ${esc(fmtDateTime(d.last_sign_in_at)) || "chưa đăng nhập"}</p>
        ${programs ? `<p class="rp-note">Chương trình đối tác: ${programs}</p>` : ""}
        <p style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0 0">
          <a class="adm-btn adm-btn--line adm-btn--small" href="../nguoi-hoc/ho-so.html?id=${encodeURIComponent(uid)}">Hồ sơ người học</a>
          <a class="adm-btn adm-btn--line adm-btn--small" href="../tien-do/?id=${encodeURIComponent(uid)}">Tiến độ từng bài</a>
        </p>
      </section>
      <section class="adm-card" style="margin-top:1rem">
        <h2>Khóa học, kết quả & chứng nhận</h2>
        <div class="rp-wrap"><table class="rp-table">
          <thead><tr><th>Khóa học</th><th>Nguồn</th><th>Trạng thái học</th><th class="num">Tiến độ</th>
          <th>Hoạt động gần nhất</th><th class="num">Kiểm tra</th><th>Kết quả</th><th>Chứng nhận</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8">Chưa có quyền học.</td></tr>'}</tbody>
        </table></div>
      </section>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Phân tích học tập");
      if (!ctx) return;
      sb = ctx.sb;
      R().injectCss();
      const q = new URLSearchParams(location.search);
      if (q.get("user")) await student(q.get("user"), q.get("from"));
      else if (q.get("course")) await course(q.get("course"));
      else await overview();
    } catch (e) {
      const msg = String(e?.message || e);
      $("view").innerHTML = "";
      $("adm-status").textContent =
        msg === "forbidden" ? "Chỉ quản trị viên được xem phân tích học tập." : msg;
      $("adm-status").className = "adm-msg is-err";
    }
  });
})();
