/* Quản lý quyền học — 1 người học = 1 dòng; lọc 1 khóa → xem quyền của khóa đó */
(function () {
  const L = () => window.sa247Learner;
  const esc = (s) => L().esc(s);
  const CHIP_LIMIT = 4;
  let people = [];
  let canGrant = false;
  const expanded = new Set();

  function filters() {
    return {
      q: (document.getElementById("q").value || "").trim().toLowerCase(),
      course: document.getElementById("f-course").value,
      state: document.getElementById("f-state").value,
      source: document.getElementById("f-source").value,
      term: document.getElementById("f-term").value,
    };
  }

  function matchEnroll(e, f) {
    if (f.course && e.code !== f.course) return false;
    if (f.state && L().enrollState(e) !== f.state) return false;
    if (f.source && L().sourceKey(e.source) !== f.source) return false;
    if (f.term === "unlimited" && e.expires_at) return false;
    if (f.term === "limited" && !e.expires_at) return false;
    return true;
  }

  const isActive = (e) => e.active === true;

  function paintKpi() {
    const all = people.flatMap((p) => p.enrollments || []);
    document.getElementById("kpi-people").textContent = people.length;
    document.getElementById("kpi-active").textContent = people.filter((p) => (p.enrollments || []).some(isActive)).length;
    document.getElementById("kpi-multi").textContent = people.filter(
      (p) => (p.enrollments || []).filter(isActive).length > 1
    ).length;
    document.getElementById("kpi-expiring").textContent = all.filter((e) => e.expiring).length;
  }

  function who(p) {
    return `<td class="lrn-name"><a href="../nguoi-hoc/ho-so.html?id=${encodeURIComponent(p.id)}#sec-access">
      <strong>${esc(p.full_name || "(chưa đặt tên)")}</strong></a><small>${esc(p.email || "")}</small></td>`;
  }

  function openBtn(p) {
    return `<a class="adm-btn adm-btn--line adm-btn--small" href="../nguoi-hoc/ho-so.html?id=${encodeURIComponent(p.id)}#sec-access">Mở hồ sơ</a>`;
  }

  function chips(p) {
    const list = p.enrollments || [];
    const open = expanded.has(p.id);
    const shown = open ? list : list.slice(0, CHIP_LIMIT);
    const more = list.length - shown.length;
    return `<div class="enr-chips">${shown
      .map((e) => {
        const st = L().enrollState(e);
        return `<span class="enr-chip enr-chip--${st}" title="${esc(e.title)} · ${esc(L().ENROLL_STATE[st].label)}">${esc(e.code)}</span>`;
      })
      .join("")}${
      more > 0
        ? `<button type="button" class="enr-chip enr-chip--more" data-expand="${esc(p.id)}">+${more}</button>`
        : open && list.length > CHIP_LIMIT
          ? `<button type="button" class="enr-chip enr-chip--more" data-expand="${esc(p.id)}">Thu gọn</button>`
          : ""
    }</div>`;
  }

  function paint() {
    const f = filters();
    const byEnroll = f.course || f.state || f.source || f.term;
    const list = people.filter((p) => {
      if (f.q && ![p.full_name, p.email, p.phone].join(" ").toLowerCase().includes(f.q)) return false;
      if (byEnroll && !(p.enrollments || []).some((e) => matchEnroll(e, f))) return false;
      return true;
    });
    const head = document.getElementById("enr-head");
    const body = document.getElementById("rows");

    if (f.course) {
      head.innerHTML = `<tr><th>Người học</th><th>Quyền ${esc(f.course)}</th><th>Tiến độ</th><th>Kiểm tra</th>
        <th>Giấy chứng nhận</th><th>Ngày cấp</th><th>Thao tác</th></tr>`;
      body.innerHTML = list
        .map((p) => {
          const e = (p.enrollments || []).find((x) => x.code === f.course);
          return `<tr>${who(p)}
            <td>${L().enrollBadge(e)}${e.expires_at ? `<div class="adm-msg">Hết hạn ${L().fmtDate(e.expires_at)}</div>` : ""}</td>
            <td><div class="lrn-course" style="grid-template-columns:1fr 2.6rem">${L().bar(e.progress)}<span>${e.progress || 0}%</span></div></td>
            <td>${L().quizResult(e)}</td>
            <td>${L().certLabel(e)}</td>
            <td>${L().fmtDate(e.enrolled_at)}</td>
            <td class="enr-actions">${openBtn(p)}${
              canGrant && e.status === "active"
                ? `<button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-revoke="${esc(e.id)}" data-label="${esc(e.code)} của ${esc(p.full_name || p.email)}">Thu hồi</button>`
                : ""
            }</td>
          </tr>`;
        })
        .join("");
    } else {
      head.innerHTML = `<tr><th>Người học</th><th>Khóa học được cấp</th><th class="num">Tổng</th>
        <th class="num">Hoạt động</th><th class="num">Thu hồi</th><th>Hoạt động gần nhất</th><th>Thao tác</th></tr>`;
      body.innerHTML = list
        .map((p) => {
          const en = p.enrollments || [];
          return `<tr>${who(p)}
            <td>${chips(p)}</td>
            <td class="num">${en.length}</td>
            <td class="num">${en.filter(isActive).length}</td>
            <td class="num">${en.filter((e) => e.status === "cancelled").length}</td>
            <td>${esc(L().relTime(p.last_activity_at))}</td>
            <td>${openBtn(p)}</td>
          </tr>`;
        })
        .join("");
    }
    if (!list.length) body.innerHTML = `<tr><td colspan="7" class="adm-muted">Không có người học phù hợp.</td></tr>`;
    document.getElementById("adm-status").textContent = `${list.length} / ${people.length} người học`;
  }

  async function load(sb) {
    const { data, error } = await sb.rpc("admin_enrollment_overview");
    if (error) throw error;
    people = data?.rows || [];
    const codes = [...new Set(people.flatMap((p) => (p.enrollments || []).map((e) => e.code)))].sort();
    const sel = document.getElementById("f-course");
    const cur = sel.value;
    sel.innerHTML =
      '<option value="">Tất cả khóa học</option>' + codes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    if (codes.includes(cur)) sel.value = cur;
    paintKpi();
    paint();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Quyền học");
      if (!ctx) return;
      const { sb } = ctx;
      canGrant = sa247Admin.canManageCommerce(ctx.profile?.role);
      document.querySelectorAll("[data-commerce-only]").forEach((el) => (el.hidden = !canGrant));

      const params = new URLSearchParams(location.search);
      if (params.get("q")) document.getElementById("q").value = params.get("q");
      await load(sb);
      if (params.get("course")) {
        document.getElementById("f-course").value = params.get("course");
        paint();
      }

      ["q", "f-course", "f-state", "f-source", "f-term"].forEach((id) =>
        document.getElementById(id).addEventListener(id === "q" ? "input" : "change", paint)
      );

      document.getElementById("enr-grant").addEventListener("click", () =>
        L().openGrantDialog(sb, { onDone: () => load(sb) })
      );

      document.getElementById("rows").addEventListener("click", async (ev) => {
        const exp = ev.target.closest("[data-expand]");
        if (exp) {
          const id = exp.getAttribute("data-expand");
          expanded.has(id) ? expanded.delete(id) : expanded.add(id);
          paint();
          return;
        }
        const btn = ev.target.closest("[data-revoke]");
        if (!btn) return;
        if (!confirm(`Thu hồi quyền học ${btn.getAttribute("data-label")}?`)) return;
        const { error } = await sb.rpc("admin_revoke_enrollment", { p_enrollment_id: btn.getAttribute("data-revoke") });
        if (error) {
          alert(error.message);
          return;
        }
        await load(sb);
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML = `<span class="adm-msg--err">${esc(e.message || e)}</span>`;
    }
  });
})();
