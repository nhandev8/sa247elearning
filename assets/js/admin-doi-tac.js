/* SA247 · Admin Campus: Đối tác → Chương trình → Thành viên · Đề xuất hợp tác */
(function () {
  let sb;
  let canAnalytics = false;
  let partners = [];
  let programs = [];
  let leads = [];
  let courses = [];
  let currentPartner = null;
  let currentProgram = "";
  let members = [];
  let importRows = [];

  const TYPE_VI = {
    university: "Trường đại học",
    enterprise: "Doanh nghiệp",
    association: "Hiệp hội",
    community: "Cộng đồng",
  };
  const AUD_VI = {
    SINH_VIEN: "Sinh viên",
    NHAN_VIEN_DOANH_NGHIEP: "Nhân viên doanh nghiệp",
    HOC_VIEN: "Học viên",
    GIANG_VIEN: "Giảng viên",
    KHACH_MOI: "Khách mời",
    DOI_TAC: "Đối tác",
  };
  const PROG_ST = {
    draft: ["Bản nháp", "draft"],
    active: ["Đang mở", "ok"],
    paused: ["Tạm dừng", "warn"],
    ended: ["Đã kết thúc", "danger"],
  };
  const MEM_ST = {
    active: ["Đang tham gia", "ok"],
    invited: ["Chờ đăng ký", "warn"],
    suspended: ["Tạm dừng", "danger"],
    removed: ["Đã gỡ", "draft"],
  };
  const NEXT_ST = {
    draft: [["active", "Mở chương trình"], ["ended", "Kết thúc"]],
    active: [["paused", "Tạm dừng"], ["ended", "Kết thúc"]],
    paused: [["active", "Mở lại"], ["ended", "Kết thúc"]],
    ended: [],
  };
  const CERT_VI = {
    MIEN_PHI_PDF: "Miễn phí giấy chứng nhận bản PDF",
    MIEN_PHI_BAN_CUNG: "Miễn phí giấy chứng nhận bản cứng",
    TU_DANG_KY: "Người học tự đăng ký nhận giấy chứng nhận",
  };
  const PERM_VI = {
    XEM_BAO_CAO: "Xem báo cáo",
    XUAT_BAO_CAO: "Xuất báo cáo",
    XEM_THANH_VIEN: "Xem thành viên",
    XEM_TIEN_DO: "Xem tiến độ",
    XEM_KET_QUA_KIEM_TRA: "Xem kết quả kiểm tra",
  };
  const LEAD_ST_VI = {
    moi: "Mới",
    dang_lien_he: "Đang liên hệ",
    da_hop_tac: "Đã hợp tác",
    khong_phu_hop: "Không phù hợp",
  };
  const LEAD_ROLE_VI = {
    sinh_vien: "Sinh viên",
    giang_vien: "Giảng viên",
    can_bo_truong: "Cán bộ trường / doanh nghiệp",
    khac: "Khác",
  };
  const IMPORT_ST = {
    co_tai_khoan: "Có tài khoản — liên kết ngay",
    cho_dang_ky: "Chờ đăng ký",
    da_co: "Đã có trong chương trình",
    loi_email: "Lỗi: email không hợp lệ",
    loi_ma: "Lỗi: thiếu mã SV/NV (chương trình bắt buộc mã)",
    trung_trong_file: "Trùng trong danh sách",
  };
  const ERR_VI = {
    forbidden: "Tài khoản không có quyền quản trị Campus (cần vai trò phù hợp và đăng nhập 2 lớp).",
    partner_type_required: "Chọn loại đối tác.",
    name_required: "Tên phải có ít nhất 3 ký tự.",
    contact_name_required: "Nhập họ tên người liên hệ.",
    contact_email_invalid: "Email người liên hệ không hợp lệ.",
    contact_phone_required: "Nhập số điện thoại người liên hệ (ít nhất 8 chữ số).",
    partner_name_exists: "Đã có đối tác cùng tên.",
    abbr_invalid: "Tên viết tắt cần 2–10 ký tự chữ/số.",
    partner_not_found: "Không tìm thấy đối tác.",
    primary_contact_required: "Không thể gỡ liên hệ chính — đặt người khác làm liên hệ chính trước.",
    user_not_found: "Email này chưa có tài khoản SA247.",
    permissions_required: "Chọn ít nhất một quyền.",
    revoke_reason_required: "Cần nhập lý do (ít nhất 5 ký tự).",
    access_not_found: "Quyền này đã được thu hồi trước đó.",
    audience_required: "Chọn đối tượng.",
    courses_required: "Chọn ít nhất một khóa học trước khi mở chương trình.",
    invalid_status_transition: "Không chuyển được trạng thái này. Đã kết thúc là trạng thái cuối.",
    program_ended_locked: "Chương trình đã kết thúc — không sửa được. Hãy tạo đợt mới.",
    program_not_found: "Không tìm thấy chương trình.",
    member_not_found: "Không tìm thấy thành viên.",
    member_not_linked: "Thành viên chưa có tài khoản — không kích hoạt được.",
    rows_must_be_array: "Danh sách không hợp lệ.",
    too_many_rows: "Tối đa 5.000 dòng mỗi lần nhập.",
    course_not_found: "Có mã khóa học không tồn tại.",
    certificate_benefit_required: "Chọn quyền lợi giấy chứng nhận.",
    dates_invalid: "Ngày kết thúc phải sau ngày bắt đầu.",
    max_uses_invalid: "Giới hạn lượt phải là số dương.",
    partner_inactive: "Đối tác đang ngừng hợp tác — không tạo chương trình mới được.",
    contact_not_found: "Không tìm thấy người liên hệ.",
    invalid_status: "Trạng thái không hợp lệ.",
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function errText(e) {
    const m = String((e && (e.message || e.error_description)) || e || "");
    return ERR_VI[m] || m;
  }
  function status(el, t, ok) {
    const n = document.getElementById(el);
    if (!n) return;
    n.textContent = t || "";
    n.className = "adm-msg" + (ok === false ? " adm-msg--err" : t ? " adm-msg--ok" : "");
  }
  const fail = (el) => (e) => status(el, errText(e), false);
  function badge(map, key) {
    const [t, k] = map[key] || [key, "draft"];
    return `<span class="adm-badge adm-badge--${k}">${esc(t)}</span>`;
  }
  function fmtDate(v, withTime) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return withTime ? d.toLocaleString("vi-VN") : d.toLocaleDateString("vi-VN");
  }
  function localToIso(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  function isoToLocal(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function askReason(msg) {
    const r = prompt(msg + "\n\nLý do (bắt buộc, ít nhất 5 ký tự):");
    if (r == null) return null;
    if (r.trim().length < 5) {
      alert("Lý do cần ít nhất 5 ký tự.");
      return null;
    }
    return r.trim();
  }
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  /* ---------- Điều hướng khu vực ---------- */
  function showArea(area) {
    document.querySelectorAll("[data-area]").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.area === area))
    );
    document.querySelectorAll("[data-area-panel]").forEach((p) => {
      p.hidden = p.dataset.areaPanel !== area;
    });
    const u = new URL(location.href);
    u.hash = area;
    history.replaceState(null, "", u);
  }
  function subTabs(attr, panelAttr, key) {
    document.querySelectorAll(`[${attr}]`).forEach((b) =>
      b.setAttribute("aria-selected", String(b.getAttribute(attr) === key))
    );
    document.querySelectorAll(`[${panelAttr}]`).forEach((p) => {
      p.hidden = p.getAttribute(panelAttr) !== key;
    });
  }

  function wizard(cardId, opts) {
    const card = document.getElementById(cardId);
    const form = card.querySelector("form");
    const steps = [...form.querySelectorAll(".cp-step")];
    const stepper = card.querySelector("[data-stepper]");
    const btnPrev = form.querySelector("[data-wiz-prev]");
    const btnNext = form.querySelector("[data-wiz-next]");
    const btnSubmit = form.querySelector("[data-wiz-submit]");
    const msg = document.createElement("p");
    msg.className = "adm-msg adm-msg--err";
    msg.hidden = true;
    form.querySelector(".cp-wiz-nav").before(msg);
    let cur = 0;
    let free = false;

    stepper.innerHTML = steps
      .map((s, i) => `<li><button type="button" data-go="${i}"><span>${i + 1}</span>${esc(s.dataset.title)}</button></li>`)
      .join("");

    function showErr(text) {
      msg.textContent = text || "";
      msg.hidden = !text;
    }
    function checkStep(i, report) {
      const bad = [...steps[i].querySelectorAll("input,select,textarea")].find((el) => !el.disabled && !el.checkValidity());
      const custom = !bad && opts.validate ? opts.validate(i) : "";
      if (!bad && !custom) return true;
      if (report) {
        go(i, true);
        if (custom) showErr(custom);
        else if (bad.type === "radio" || bad.type === "checkbox") showErr("Vui lòng chọn một lựa chọn ở bước này.");
        else {
          showErr("");
          bad.reportValidity();
          bad.focus();
        }
      }
      return false;
    }
    function render() {
      steps.forEach((s, i) => (s.hidden = i !== cur));
      stepper.querySelectorAll("li").forEach((li, i) => {
        li.classList.toggle("is-current", i === cur);
        li.classList.toggle("is-done", i !== cur && (free || i < cur));
      });
      const last = cur === steps.length - 1;
      btnPrev.hidden = cur === 0;
      btnNext.hidden = last;
      btnSubmit.hidden = !(last || free);
      btnNext.classList.toggle("adm-btn--primary", !free);
      btnNext.classList.toggle("adm-btn--line", free);
    }
    function go(i, skipCheck) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      if (!skipCheck && !free && i > cur) {
        for (let k = cur; k < i; k++) if (!checkStep(k, true)) return;
      }
      showErr("");
      cur = i;
      render();
      if (opts.onChange) opts.onChange();
    }

    stepper.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-go]");
      if (b) go(Number(b.dataset.go));
    });
    btnPrev.addEventListener("click", () => go(cur - 1));
    btnNext.addEventListener("click", () => go(cur + 1));
    form.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.target.tagName === "TEXTAREA" || ev.target.tagName === "BUTTON") return;
      ev.preventDefault();
      if (cur < steps.length - 1) go(cur + 1);
      else form.requestSubmit();
    });
    ["input", "change"].forEach((t) =>
      form.addEventListener(t, () => {
        if (!msg.hidden) showErr("");
        if (opts.onChange) opts.onChange();
      })
    );

    return {
      go,
      reset(freeMode) {
        free = !!freeMode;
        cur = 0;
        showErr("");
        render();
        if (opts.onChange) opts.onChange();
      },
      validateAll() {
        for (let i = 0; i < steps.length; i++) if (!checkStep(i, true)) return false;
        return true;
      },
    };
  }
  function summaryHtml(title, rows) {
    return `<h4>${esc(title)}</h4><dl>${rows
      .map(([k, v, raw]) =>
        v ? `<div><dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd></div>` : `<div><dt>${esc(k)}</dt><dd class="is-empty">Chưa nhập</dd></div>`
      )
      .join("")}</dl>`;
  }
  let partnerWiz;
  let programWiz;

  /* ================= ĐỐI TÁC ================= */
  async function loadPartners() {
    partners = (await rpc("admin_list_partners")) || [];
    renderPartners();
    const sel = document.getElementById("program-partner");
    const prev = sel.value;
    sel.innerHTML =
      '<option value="">— Chọn đối tác —</option>' +
      partners
        .filter((p) => p.status === "active")
        .map((p) => `<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)}</option>`)
        .join("");
    if (prev) sel.value = prev;
  }
  function renderPartners() {
    const q = document.getElementById("partner-search").value.trim().toLowerCase();
    const list = partners.filter(
      (p) => !q || [p.code, p.name, p.contact_name, p.contact_email].join(" ").toLowerCase().includes(q)
    );
    document.getElementById("partner-rows").innerHTML = list.length
      ? list
          .map(
            (p) => `<tr>
        <td><code>${esc(p.code)}</code></td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(TYPE_VI[p.partner_type] || p.partner_type)}</td>
        <td>${esc(p.contact_name || "—")}${p.contact_email ? `<br /><span class="adm-muted">${esc(p.contact_email)}</span>` : ""}</td>
        <td>${esc(p.contact_phone || "—")}</td>
        <td>${p.programs_active || 0} đang mở / ${p.programs || 0}</td>
        <td>${p.status === "active" ? '<span class="adm-badge adm-badge--ok">Đang hợp tác</span>' : '<span class="adm-badge adm-badge--draft">Ngừng hợp tác</span>'}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-open-partner="${esc(p.code)}">Hồ sơ</button></td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="8">${partners.length ? "Không có đối tác khớp tìm kiếm." : "Chưa có đối tác."}</td></tr>`;
  }
  function showPartnerView(view) {
    document.getElementById("partner-list-card").hidden = view !== "list";
    document.getElementById("partner-new-card").hidden = view !== "new";
    document.getElementById("partner-profile").hidden = view !== "profile";
  }

  let suggestTimer = 0;
  function refreshCodeSuggestion() {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
      const f = document.getElementById("partner-new-form");
      const type = f.querySelector('[name="partner_type"]:checked')?.value;
      const name = f.elements.name.value.trim();
      const out = document.getElementById("partner-code-preview");
      if (!type || name.length < 3) {
        out.textContent = "—";
        updatePartnerSummary();
        return;
      }
      try {
        const r = await rpc("admin_suggest_partner_code", {
          p_partner_type: type,
          p_name: name,
          p_abbr: f.elements.abbr.dataset.touched ? f.elements.abbr.value.trim() : null,
        });
        if (!f.elements.abbr.dataset.touched) f.elements.abbr.value = r.abbr || "";
        out.textContent = r.valid ? r.code : "Viết tắt cần 2–10 ký tự";
      } catch (e) {
        out.textContent = errText(e);
      }
      updatePartnerSummary();
    }, 300);
  }
  function updatePartnerSummary() {
    const f = document.getElementById("partner-new-form");
    const type = f.querySelector('[name="partner_type"]:checked')?.value;
    const code = document.getElementById("partner-code-preview").textContent.trim();
    const contact = [f.elements.c_full_name.value.trim(), f.elements.c_position.value.trim()].filter(Boolean).join(" · ");
    document.getElementById("partner-summary").innerHTML = summaryHtml("Tóm tắt đối tác", [
      ["Loại đối tác", TYPE_VI[type] || ""],
      ["Tên đối tác", f.elements.name.value.trim()],
      ["Mã dự kiến", code && code !== "—" ? `<div class="cp-code-box">${esc(code)}</div>` : "", true],
      ["Người liên hệ", contact],
      ["Email", f.elements.c_email.value.trim()],
      ["Điện thoại", f.elements.c_phone.value.trim()],
    ]);
  }
  function openNewPartner(prefill) {
    const f = document.getElementById("partner-new-form");
    f.reset();
    delete f.elements.abbr.dataset.touched;
    document.getElementById("partner-code-preview").textContent = "—";
    const leadNote = document.getElementById("partner-new-lead");
    leadNote.hidden = true;
    f.elements.lead_id.value = "";
    if (prefill) {
      f.elements.lead_id.value = prefill.lead_id || "";
      const r = f.querySelector(`[name="partner_type"][value="${prefill.partner_type || "university"}"]`);
      if (r) r.checked = true;
      f.elements.name.value = prefill.name || "";
      f.elements.c_full_name.value = prefill.contact_name || "";
      f.elements.c_position.value = prefill.contact_position || "";
      f.elements.c_email.value = prefill.contact_email || "";
      f.elements.c_phone.value = prefill.contact_phone || "";
      f.elements.note.value = prefill.note || "";
      leadNote.textContent = "Tạo từ đề xuất hợp tác — kiểm tra lại thông tin trước khi lưu. Đề xuất sẽ chuyển sang “Đã hợp tác”.";
      leadNote.hidden = false;
    }
    partnerWiz.reset(false);
    if (prefill) {
      partnerWiz.go(1);
      refreshCodeSuggestion();
    }
    showArea("partners");
    showPartnerView("new");
  }

  async function openPartner(code, tab) {
    const d = await rpc("admin_get_partner", { p_code: code });
    currentPartner = d;
    const p = d.partner;
    document.getElementById("pp-title").textContent = p.name;
    const st = document.getElementById("pp-status");
    st.textContent = p.status === "active" ? "Đang hợp tác" : "Ngừng hợp tác";
    st.className = "adm-badge adm-badge--" + (p.status === "active" ? "ok" : "draft");
    document.getElementById("pp-meta").innerHTML =
      `<code>${esc(p.code)}</code> · ${esc(TYPE_VI[p.partner_type] || p.partner_type)} · tạo ngày ${esc(fmtDate(p.created_at))}`;
    const ef = document.getElementById("pp-edit-form");
    ef.elements.name.value = p.name || "";
    ef.elements.address.value = p.address || "";
    ef.elements.website.value = p.website || "";
    ef.elements.status.value = p.status || "active";
    ef.elements.note.value = p.note || "";

    document.getElementById("pp-contacts").innerHTML = (d.contacts || []).length
      ? d.contacts
          .map(
            (c) => `<tr>
        <td><strong>${esc(c.full_name)}</strong></td>
        <td>${esc(c.position || "—")}</td>
        <td>${esc(c.email)}</td>
        <td>${esc(c.phone)}</td>
        <td>${c.is_primary ? '<span class="adm-badge adm-badge--ok">Liên hệ chính</span>' : ""}</td>
        <td class="adm-actions">
          <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-edit-contact="${esc(c.id)}">Sửa</button>
          ${c.is_primary ? "" : `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-remove-contact="${esc(c.id)}">Ngừng</button>`}
        </td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="6">Chưa có người liên hệ.</td></tr>';
    resetContactForm();

    document.getElementById("pp-programs").innerHTML = (d.programs || []).length
      ? d.programs
          .map(
            (r) => `<tr>
        <td><code>${esc(r.code)}</code></td>
        <td>${esc(r.name)}</td>
        <td>${esc(AUD_VI[r.audience_type] || r.audience_type)}</td>
        <td>${esc([fmtDate(r.starts_at), fmtDate(r.ends_at)].filter(Boolean).join(" → ") || "—")}</td>
        <td>${r.members || 0}</td>
        <td>${badge(PROG_ST, r.status)}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-open-program="${esc(r.code)}">Chi tiết</button></td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="7">Đối tác chưa có chương trình.</td></tr>';

    renderAccess(d.access || []);
    document.getElementById("pp-access-missing").hidden = true;

    document.getElementById("pp-members-total").textContent =
      `Tổng ${d.members_total || 0} thành viên trên ${(d.programs || []).length} chương trình.`;
    document.getElementById("pp-members").innerHTML = (d.programs || []).length
      ? d.programs
          .map(
            (r) => `<tr>
        <td><code>${esc(r.code)}</code> ${esc(r.name)}</td>
        <td>${r.members || 0}</td>
        <td>${badge(PROG_ST, r.status)}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-members-of="${esc(r.code)}">Xem thành viên</button></td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="4">Chưa có chương trình.</td></tr>';

    document.getElementById("pp-activity").innerHTML = (d.activity || []).length
      ? d.activity
          .map(
            (a) => `<li><span class="adm-muted">${esc(fmtDate(a.at, true))}</span> · ${esc(a.summary)}${a.actor ? ` <span class="adm-muted">(${esc(a.actor)})</span>` : ""}</li>`
          )
          .join("")
      : "<li>Chưa có hoạt động.</li>";

    subTabs("data-pp-tab", "data-pp-panel", tab || "overview");
    showArea("partners");
    showPartnerView("profile");
  }
  function renderAccess(list) {
    document.getElementById("pp-access").innerHTML = list.length
      ? list
          .map((a) => {
            const active = a.status === "active";
            return `<tr>
        <td><strong>${esc(a.full_name || "—")}</strong><br /><span class="adm-muted">${esc(a.email || "")}</span></td>
        <td>${(a.permissions || []).map((p) => `<span class="adm-badge adm-badge--draft">${esc(PERM_VI[p] || p)}</span>`).join(" ")}</td>
        <td>${active ? '<span class="adm-badge adm-badge--ok">Đang có quyền</span>' : `<span class="adm-badge adm-badge--danger">Đã thu hồi</span>${a.revoke_reason ? `<br /><span class="adm-muted">${esc(a.revoke_reason)}</span>` : ""}`}</td>
        <td>${esc(fmtDate(active ? a.granted_at : a.revoked_at, true))}</td>
        <td>${active ? `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-revoke-access="${esc(a.user_id)}">Thu hồi</button>` : ""}</td>
      </tr>`;
          })
          .join("")
      : '<tr><td colspan="5">Chưa cấp quyền cho ai.</td></tr>';
  }
  function resetContactForm() {
    const f = document.getElementById("pp-contact-form");
    f.reset();
    f.elements.id.value = "";
    document.getElementById("pp-contact-submit").textContent = "Thêm người liên hệ";
    document.getElementById("pp-contact-reset").hidden = true;
  }
  function signupGuide(email) {
    return [
      "Hướng dẫn đăng ký tài khoản SA247 để xem báo cáo đối tác:",
      "1. Truy cập https://sa247.vn/dang-ky/",
      `2. Đăng ký bằng đúng email: ${email}`,
      "3. Mở hộp thư, bấm liên kết xác minh email do SA247 gửi.",
      "4. Báo lại cho SA247 để được cấp quyền. Sau đó đăng nhập và xem báo cáo tại https://sa247.vn/doi-tac/",
    ].join("\n");
  }

  /* ================= CHƯƠNG TRÌNH ================= */
  async function loadCourses() {
    const { data, error } = await sb
      .from("courses")
      .select("code,title,is_published,status")
      .order("code");
    if (error) throw error;
    courses = (data || []).filter((c) => c.is_published !== false && c.status !== "archived");
    renderCourseChecks([]);
  }
  function renderCourseChecks(selected) {
    const box = document.getElementById("program-courses");
    box.innerHTML = courses.length
      ? courses
          .map(
            (c) => `<label class="cp-choice cp-choice--check cp-choice--row"><input type="checkbox" name="course" value="${esc(c.code)}"${selected.includes(c.code) ? " checked" : ""} /><code>${esc(c.code)}</code><strong>${esc(c.title)}</strong></label>`
          )
          .join("")
      : '<p class="cp-note">Chưa có khóa học đang mở.</p>';
  }
  function updateProgramSummary() {
    const f = document.getElementById("program-form");
    const psel = f.elements.partner_code;
    const partner = psel.value ? psel.options[psel.selectedIndex]?.textContent || psel.value : "";
    const picked = [...f.querySelectorAll('[name="course"]:checked')].map((x) => x.value);
    const s = f.elements.starts_at.value;
    const e = f.elements.ends_at.value;
    const dates = s || e ? `${s ? fmtDate(localToIso(s)) : "…"} → ${e ? fmtDate(localToIso(e)) : "không giới hạn"}` : "";
    const cert = f.querySelector('[name="certificate_benefit"]:checked')?.value;
    const act = f.elements.activation_enabled.checked
      ? "Bật" + (f.elements.max_uses.value ? ` · tối đa ${f.elements.max_uses.value} lượt` : " · không giới hạn lượt")
      : "Tắt";
    document.getElementById("program-maxuses-wrap").hidden = !f.elements.activation_enabled.checked;
    document.getElementById("program-summary").innerHTML = summaryHtml("Tóm tắt chương trình", [
      ["Đối tác", partner],
      ["Tên chương trình", f.elements.name.value.trim()],
      ["Đối tượng", AUD_VI[f.elements.audience_type.value] || ""],
      ["Thời gian", dates],
      ["Khóa học", picked.length ? picked.map((c) => `<code class="cp-course">${esc(c)}</code>`).join(" ") : "", true],
      ["Học phí", "Miễn phí theo chương trình"],
      ["Giấy chứng nhận", CERT_VI[cert] || ""],
      ["Mã kích hoạt", act],
    ]);
  }
  async function loadPrograms() {
    programs = (await rpc("admin_list_programs")) || [];
    renderPrograms();
    const sel = document.getElementById("member-program");
    const prev = sel.value || currentProgram;
    sel.innerHTML =
      '<option value="">— Chọn chương trình —</option>' +
      programs
        .map((p) => `<option value="${esc(p.code)}">${esc(p.code)} — ${esc(p.name)} (${esc((PROG_ST[p.status] || [p.status])[0])})</option>`)
        .join("");
    if (prev) sel.value = prev;
  }
  function renderPrograms() {
    const f = document.getElementById("program-filter").value;
    const list = programs.filter((p) => !f || p.status === f);
    document.getElementById("program-rows").innerHTML = list.length
      ? list
          .map((p) => {
            const k = p.kpi || {};
            return `<tr>
        <td><code>${esc(p.code)}</code></td>
        <td><strong>${esc(p.name)}</strong><br /><span class="adm-muted">${esc(AUD_VI[p.audience_type] || p.audience_type)}</span></td>
        <td>${esc(p.partner_name)}</td>
        <td>${(p.courses || []).map((c) => `<code class="cp-course">${esc(c)}</code>`).join("") || "—"}</td>
        <td>${k.members || 0}</td>
        <td>${k.pending || 0}</td>
        <td>${k.completed || 0}</td>
        <td>${k.passed || 0}</td>
        <td>${k.eligible || 0}</td>
        <td>${badge(PROG_ST, p.status)}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-open-program="${esc(p.code)}">Chi tiết</button></td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="11">${programs.length ? "Không có chương trình ở trạng thái này." : "Chưa có chương trình."}</td></tr>`;
  }
  function showProgramView(view) {
    document.getElementById("program-list-card").hidden = view !== "list";
    document.getElementById("program-form-card").hidden = view !== "form";
    document.getElementById("program-detail").hidden = view !== "detail";
  }
  function openProgramForm(prog, partnerCode) {
    const f = document.getElementById("program-form");
    f.reset();
    f.elements.program_code.value = prog ? prog.code : "";
    document.getElementById("program-form-title").textContent = prog ? "Sửa chương trình " + prog.code : "Tạo chương trình";
    document.getElementById("program-submit").textContent = prog ? "Lưu thay đổi" : "Lưu bản nháp";
    const psel = f.elements.partner_code;
    if (prog) {
      if (![...psel.options].some((o) => o.value === prog.partner_code)) {
        psel.insertAdjacentHTML("beforeend", `<option value="${esc(prog.partner_code)}">${esc(prog.partner_code)} — ${esc(prog.partner_name)}</option>`);
      }
      psel.value = prog.partner_code;
      psel.disabled = true;
      f.elements.name.value = prog.name || "";
      f.elements.audience_type.value = prog.audience_type || "SINH_VIEN";
      f.elements.starts_at.value = isoToLocal(prog.starts_at);
      f.elements.ends_at.value = isoToLocal(prog.ends_at);
      f.elements.description.value = prog.description || "";
      const cb = f.querySelector(`[name="certificate_benefit"][value="${prog.certificate_benefit || "TU_DANG_KY"}"]`);
      if (cb) cb.checked = true;
      f.elements.activation_enabled.checked = !!prog.activation_enabled;
      f.elements.max_uses.value = prog.max_uses || "";
      f.elements.require_external_code.checked = !!prog.require_external_code;
      f.elements.auto_link_on_signup.checked = prog.auto_link_on_signup !== false;
      renderCourseChecks(prog.courses || []);
    } else {
      psel.disabled = false;
      psel.value = partnerCode || "";
      renderCourseChecks([]);
    }
    programWiz.reset(!!prog);
    if (!prog && partnerCode && psel.value) programWiz.go(1);
    showArea("programs");
    showProgramView("form");
  }
  async function openProgram(code) {
    currentProgram = code;
    const p = programs.find((x) => x.code === code);
    if (!p) throw new Error("program_not_found");
    document.getElementById("pd-title").textContent = p.name;
    const st = document.getElementById("pd-status");
    const [stText, stKind] = PROG_ST[p.status] || [p.status, "draft"];
    st.textContent = stText;
    st.className = "adm-badge adm-badge--" + stKind;
    document.getElementById("pd-meta").innerHTML = [
      `<code>${esc(p.code)}</code>`,
      esc(p.partner_name),
      esc(AUD_VI[p.audience_type] || p.audience_type),
      "Khóa: " + ((p.courses || []).map(esc).join(", ") || "chưa chọn"),
      "Học phí: miễn phí theo chương trình",
      "Giấy chứng nhận: " + esc(CERT_VI[p.certificate_benefit] || p.certificate_benefit),
      [fmtDate(p.starts_at), fmtDate(p.ends_at)].filter(Boolean).join(" → "),
    ]
      .filter(Boolean)
      .join(" · ");
    const k = p.kpi || {};
    document.getElementById("pd-kpi").innerHTML = [
      [k.members, "Thành viên"],
      [k.pending, "Chờ đăng ký"],
      [k.completed, "Đã hoàn thành"],
      [k.passed, "Đạt kiểm tra"],
      [k.eligible, "Đủ điều kiện GCN"],
    ]
      .map(([n, t]) => `<div class="adm-stat"><strong>${n || 0}</strong><span>${t}</span></div>`)
      .join("");
    document.getElementById("pd-status-actions").innerHTML =
      (NEXT_ST[p.status] || [])
        .map(
          ([s, t]) => `<button type="button" class="adm-btn ${s === "ended" ? "adm-btn--danger" : "adm-btn--primary"} adm-btn--small" data-set-status="${s}">${t}</button>`
        )
        .join("") || '<span class="adm-muted">Chương trình đã kết thúc — không đổi trạng thái được.</span>';
    const left = p.max_uses ? Math.max(0, p.max_uses - (p.used || 0)) : null;
    document.getElementById("pd-activation").innerHTML = p.activation_enabled
      ? `<p class="cp-inline"><span class="cp-code">${esc(p.activation_code || "—")}</span>
          <button type="button" class="adm-btn adm-btn--line adm-btn--small" id="pd-copy-code">Sao chép</button>
          ${p.status !== "ended" ? '<button type="button" class="adm-btn adm-btn--line adm-btn--small" id="pd-regen-code">Tạo mã mới</button>' : ""}</p>
         <p class="cp-note">Đã dùng ${p.used || 0}${p.max_uses ? ` / ${p.max_uses} · còn lại ${left}` : " · không giới hạn lượt"}${p.require_external_code ? " · bắt buộc mã thành viên có trong danh sách" : ""}.</p>`
      : '<p class="cp-note">Đang tắt tự kích hoạt bằng mã — chỉ thành viên trong danh sách được cấp quyền. Bật trong “Sửa chương trình”.</p>';
    document.getElementById("pd-edit").hidden = p.status === "ended";
    showArea("programs");
    showProgramView("detail");

    const box = document.getElementById("report-box");
    box.innerHTML = '<p class="cp-note">Đang tải báo cáo…</p>';
    try {
      const [report, rows] = await Promise.all([
        rpc("admin_program_report", { p_program_code: code }),
        rpc("program_students", { p_program_code: code }),
      ]);
      if (!(report.courses || []).length) {
        box.innerHTML = '<p class="cp-note">Chương trình chưa có khóa học.</p>';
      } else {
        SA247Report.renderProgram(box, report, rows || [], {
          onStudent: canAnalytics
            ? (r) => {
                location.href = "../phan-tich/?user=" + encodeURIComponent(r.user_id);
              }
            : null,
        });
      }
    } catch (e) {
      box.innerHTML = `<p class="adm-msg adm-msg--err">${esc(errText(e))}</p>`;
    }
  }

  /* ================= THÀNH VIÊN ================= */
  async function loadMembers() {
    const code = document.getElementById("member-program").value;
    currentProgram = code || currentProgram;
    if (!code) {
      members = [];
      renderMembers();
      return;
    }
    members = (await rpc("admin_list_program_members", { p_program_code: code })) || [];
    renderMembers();
  }
  function courseCell(c) {
    const acc = c.access === "active" ? "có quyền" : c.access ? "đã thu hồi" : "chưa cấp";
    const bits = [
      `<code>${esc(c.course_code)}</code>`,
      acc,
      c.progress != null ? `${Math.round(c.progress)}%` : "",
      c.passed ? "đạt KT" : c.attempts ? "chưa đạt KT" : "",
      c.cert_code ? `GCN ${esc(c.cert_code)}` : c.eligible ? "đủ điều kiện GCN" : "",
    ].filter(Boolean);
    return `<div>${bits.join(" · ")}</div>`;
  }
  function renderMembers() {
    const q = document.getElementById("member-search").value.trim().toLowerCase();
    const match = (m) =>
      !q || [m.full_name, m.email, m.external_code, m.class_name].join(" ").toLowerCase().includes(q);
    const codeOf = (m) => (m.external_code && m.external_code !== m.email ? m.external_code : "—");
    const linked = members.filter((m) => m.linked && match(m));
    const pending = members.filter((m) => !m.linked && match(m));
    const hasProg = !!document.getElementById("member-program").value;
    document.getElementById("member-rows").innerHTML = linked.length
      ? linked
          .map(
            (m) => `<tr>
        <td><strong>${esc(m.full_name || "—")}</strong>${m.class_name ? `<br /><span class="adm-muted">${esc(m.class_name)}</span>` : ""}</td>
        <td>${esc(codeOf(m))}</td>
        <td>${esc(m.email || "—")}</td>
        <td>${(m.courses || []).map(courseCell).join("") || "—"}</td>
        <td>${badge(MEM_ST, m.status)}</td>
        <td class="adm-actions">
          ${m.status === "active" ? `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-member-status="suspended" data-id="${esc(m.id)}">Tạm dừng</button>` : `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-member-status="active" data-id="${esc(m.id)}">Kích hoạt lại</button>`}
          <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-member-status="removed" data-id="${esc(m.id)}">Gỡ</button>
        </td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="6">${hasProg ? "Chưa có thành viên đã liên kết tài khoản." : "Chọn chương trình để xem thành viên."}</td></tr>`;
    document.getElementById("pending-rows").innerHTML = pending.length
      ? pending
          .map(
            (m) => `<tr>
        <td>${esc(m.full_name || "—")}</td>
        <td>${esc(codeOf(m))}</td>
        <td>${esc(m.email || "—")}</td>
        <td>${esc([m.faculty, m.class_name].filter(Boolean).join(" · ") || "—")}</td>
        <td><button type="button" class="adm-btn adm-btn--line adm-btn--small" data-member-status="removed" data-id="${esc(m.id)}">Gỡ</button></td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="5">${hasProg ? "Không có ai đang chờ đăng ký." : "Chọn chương trình."}</td></tr>`;
    const pendingTab = document.querySelector('[data-mem-tab="pending"]');
    pendingTab.textContent = `Chờ đăng ký${hasProg ? ` (${members.filter((m) => !m.linked).length})` : ""}`;
  }
  function parseImport(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const sep = lines[0].includes("\t") ? "\t" : lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
    const rows = lines.map((l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, "")));
    if (rows.length && !/@/.test(rows[0][0] || "") && /mail/i.test(rows[0].join(" "))) rows.shift();
    return rows.map((p) => ({
      email: p[0] || "",
      full_name: p[1] || "",
      external_code: p[2] || "",
      faculty: p[3] || "",
      major: p[4] || "",
      cohort: p[5] || "",
      class_name: p[6] || "",
    }));
  }

  /* ================= ĐỀ XUẤT HỢP TÁC ================= */
  async function loadLeads() {
    const filter = document.getElementById("lead-filter").value || null;
    leads = (await rpc("admin_list_campus_leads", { p_status: filter })) || [];
    const opts = (cur) =>
      Object.entries(LEAD_ST_VI)
        .map(([v, t]) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`)
        .join("");
    document.getElementById("lead-rows").innerHTML = leads.length
      ? leads
          .map(
            (l) => `<tr data-lead="${esc(l.id)}">
        <td>${esc(fmtDate(l.created_at, true))}</td>
        <td><strong>${esc(l.school_name)}</strong>${l.faculty ? "<br />" + esc(l.faculty) : ""}</td>
        <td>${esc(l.full_name)}<br /><span class="adm-muted">${esc(LEAD_ROLE_VI[l.role] || l.role || "")}</span></td>
        <td><a href="mailto:${esc(l.email)}">${esc(l.email)}</a>${l.phone ? "<br />" + esc(l.phone) : ""}</td>
        <td>${esc(l.academic_year || "—")}<br /><span class="adm-muted">${l.expected_students ? l.expected_students + " SV" : ""}</span></td>
        <td>${esc(l.note || "")}</td>
        <td><select data-lead-status>${opts(l.status)}</select></td>
        <td><input data-lead-note value="${esc(l.admin_note || "")}" placeholder="Ghi chú nội bộ" /></td>
        <td class="adm-actions">
          <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-lead-save>Lưu</button>
          ${l.converted_partner_id ? '<span class="adm-badge adm-badge--ok">Đã tạo đối tác</span>' : '<button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-lead-convert>Tạo đối tác từ đề xuất</button>'}
        </td>
      </tr>`
          )
          .join("")
      : '<tr><td colspan="9">Chưa có đề xuất.</td></tr>';
  }

  /* ================= KHỞI ĐỘNG ================= */
  document.addEventListener("DOMContentLoaded", async () => {
    const ctx = await sa247AdminShell.boot("Campus", { requireCommerce: true });
    if (!ctx) return;
    sb = ctx.sb;
    canAnalytics = !!window.sa247Admin?.isFullAdmin?.(ctx.profile.role);

    document.querySelectorAll("[data-area]").forEach((b) =>
      b.addEventListener("click", () => {
        showArea(b.dataset.area);
        if (b.dataset.area === "partners") showPartnerView("list");
        if (b.dataset.area === "programs") showProgramView("list");
        if (b.dataset.area === "members") loadMembers().catch(fail("adm-status"));
      })
    );
    document.querySelectorAll("[data-pp-tab]").forEach((b) =>
      b.addEventListener("click", () => subTabs("data-pp-tab", "data-pp-panel", b.dataset.ppTab))
    );
    document.querySelectorAll("[data-mem-tab]").forEach((b) =>
      b.addEventListener("click", () => subTabs("data-mem-tab", "data-mem-panel", b.dataset.memTab))
    );

    try {
      await Promise.all([loadPartners(), loadPrograms(), loadCourses()]);
    } catch (e) {
      status("adm-status", errText(e), false);
    }
    loadLeads().catch(fail("lead-msg"));
    const hash = location.hash.replace("#", "");
    if (["partners", "programs", "members", "leads"].includes(hash)) showArea(hash);

    /* --- Đối tác --- */
    document.getElementById("partner-search").addEventListener("input", renderPartners);
    document.getElementById("btn-partner-new").addEventListener("click", () => openNewPartner(null));
    document.querySelector("[data-cancel-partner-new]").addEventListener("click", () => showPartnerView("list"));
    document.getElementById("btn-partner-back").addEventListener("click", () => {
      currentPartner = null;
      showPartnerView("list");
    });
    const npf = document.getElementById("partner-new-form");
    partnerWiz = wizard("partner-new-card", { onChange: updatePartnerSummary });
    npf.querySelectorAll('[name="partner_type"]').forEach((r) =>
      r.addEventListener("change", () => {
        refreshCodeSuggestion();
        partnerWiz.go(1);
      })
    );
    npf.elements.name.addEventListener("input", refreshCodeSuggestion);
    npf.elements.abbr.addEventListener("input", () => {
      npf.elements.abbr.dataset.touched = npf.elements.abbr.value.trim() ? "1" : "";
      if (!npf.elements.abbr.dataset.touched) delete npf.elements.abbr.dataset.touched;
      refreshCodeSuggestion();
    });
    npf.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      if (!partnerWiz.validateAll()) return;
      try {
        const r = await rpc("admin_create_partner", {
          p_partner_type: f.querySelector('[name="partner_type"]:checked')?.value || null,
          p_name: f.elements.name.value.trim(),
          p_abbr: f.elements.abbr.value.trim() || null,
          p_contact: {
            full_name: f.elements.c_full_name.value.trim(),
            position: f.elements.c_position.value.trim(),
            email: f.elements.c_email.value.trim(),
            phone: f.elements.c_phone.value.trim(),
          },
          p_address: f.elements.address.value.trim() || null,
          p_website: f.elements.website.value.trim() || null,
          p_note: f.elements.note.value.trim() || null,
          p_lead_id: f.elements.lead_id.value || null,
        });
        status("adm-status", `Đã tạo đối tác ${r.code}.`);
        await loadPartners();
        if (f.elements.lead_id.value) loadLeads().catch(fail("lead-msg"));
        await openPartner(r.code);
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });
    document.getElementById("partner-rows").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-open-partner]");
      if (b) openPartner(b.dataset.openPartner).catch(fail("adm-status"));
    });
    document.getElementById("pp-edit-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      try {
        await rpc("admin_update_partner", {
          p_code: currentPartner.partner.code,
          p_name: f.elements.name.value.trim(),
          p_address: f.elements.address.value.trim() || null,
          p_website: f.elements.website.value.trim() || null,
          p_note: f.elements.note.value.trim() || null,
          p_status: f.elements.status.value,
        });
        status("adm-status", "Đã lưu thông tin đối tác.");
        await loadPartners();
        await openPartner(currentPartner.partner.code, "overview");
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });
    document.getElementById("pp-contacts").addEventListener("click", async (ev) => {
      const edit = ev.target.closest("[data-edit-contact]");
      const rm = ev.target.closest("[data-remove-contact]");
      if (edit) {
        const c = (currentPartner.contacts || []).find((x) => x.id === edit.dataset.editContact);
        if (!c) return;
        const f = document.getElementById("pp-contact-form");
        f.elements.id.value = c.id;
        f.elements.full_name.value = c.full_name || "";
        f.elements.position.value = c.position || "";
        f.elements.email.value = c.email || "";
        f.elements.phone.value = c.phone || "";
        f.elements.is_primary.checked = !!c.is_primary;
        document.getElementById("pp-contact-submit").textContent = "Lưu người liên hệ";
        document.getElementById("pp-contact-reset").hidden = false;
        f.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (rm) {
        if (!confirm("Ngừng người liên hệ này?")) return;
        try {
          await rpc("admin_remove_partner_contact", { p_contact_id: rm.dataset.removeContact });
          await openPartner(currentPartner.partner.code, "overview");
        } catch (e) {
          status("adm-status", errText(e), false);
        }
      }
    });
    document.getElementById("pp-contact-reset").addEventListener("click", resetContactForm);
    document.getElementById("pp-contact-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      try {
        await rpc("admin_save_partner_contact", {
          p_partner_code: currentPartner.partner.code,
          p_contact: {
            id: f.elements.id.value || null,
            full_name: f.elements.full_name.value.trim(),
            position: f.elements.position.value.trim(),
            email: f.elements.email.value.trim(),
            phone: f.elements.phone.value.trim(),
            is_primary: f.elements.is_primary.checked,
          },
        });
        status("adm-status", "Đã lưu người liên hệ.");
        await loadPartners();
        await openPartner(currentPartner.partner.code, "overview");
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });
    document.getElementById("pp-new-program").addEventListener("click", () =>
      openProgramForm(null, currentPartner?.partner?.code)
    );
    document.getElementById("pp-access-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const email = f.elements.email.value.trim();
      const perms = [...f.querySelectorAll('[name="perm"]:checked')].map((x) => x.value);
      document.getElementById("pp-access-missing").hidden = true;
      try {
        await rpc("admin_grant_partner_access", {
          p_partner_code: currentPartner.partner.code,
          p_email: email,
          p_permissions: perms,
        });
        status("adm-status", `Đã cấp quyền cho ${email}.`);
        f.elements.email.value = "";
        await openPartner(currentPartner.partner.code, "access");
      } catch (e) {
        if (String(e.message || e) === "user_not_found") {
          const box = document.getElementById("pp-access-missing");
          box.hidden = false;
          box.dataset.email = email;
          status("adm-status", "");
        } else {
          status("adm-status", errText(e), false);
        }
      }
    });
    document.getElementById("pp-copy-guide").addEventListener("click", async () => {
      const email = document.getElementById("pp-access-missing").dataset.email || "";
      const ok = await copyText(signupGuide(email));
      status("adm-status", ok ? "Đã sao chép hướng dẫn đăng ký — gửi cho cán bộ đối tác." : "Không sao chép được, hãy thử lại.", ok);
    });
    document.getElementById("pp-access").addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-revoke-access]");
      if (!b) return;
      const reason = askReason("Thu hồi quyền xem báo cáo của tài khoản này?");
      if (!reason) return;
      try {
        await rpc("admin_revoke_partner_access", {
          p_partner_code: currentPartner.partner.code,
          p_user_id: b.dataset.revokeAccess,
          p_reason: reason,
        });
        status("adm-status", "Đã thu hồi quyền.");
        await openPartner(currentPartner.partner.code, "access");
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });
    document.getElementById("partner-profile").addEventListener("click", (ev) => {
      const op = ev.target.closest("[data-open-program]");
      const mo = ev.target.closest("[data-members-of]");
      if (op) openProgram(op.dataset.openProgram).catch(fail("adm-status"));
      if (mo) {
        document.getElementById("member-program").value = mo.dataset.membersOf;
        showArea("members");
        loadMembers().catch(fail("adm-status"));
      }
    });

    /* --- Chương trình --- */
    document.getElementById("program-filter").addEventListener("change", renderPrograms);
    document.getElementById("btn-program-new").addEventListener("click", () => openProgramForm(null));
    document.querySelector("[data-cancel-program]").addEventListener("click", () => showProgramView("list"));
    document.getElementById("btn-program-back").addEventListener("click", () => showProgramView("list"));
    document.getElementById("program-rows").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-open-program]");
      if (b) openProgram(b.dataset.openProgram).catch(fail("adm-status"));
    });
    programWiz = wizard("program-form-card", {
      onChange: updateProgramSummary,
      validate: (i) =>
        i === 2 && !document.querySelector('#program-form [name="course"]:checked') ? "Chọn ít nhất 1 khóa học." : "",
    });
    document.getElementById("program-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      if (!programWiz.validateAll()) return;
      const code = f.elements.program_code.value;
      const common = {
        p_name: f.elements.name.value.trim(),
        p_audience_type: f.elements.audience_type.value,
        p_course_codes: [...f.querySelectorAll('[name="course"]:checked')].map((x) => x.value),
        p_certificate_benefit: f.querySelector('[name="certificate_benefit"]:checked')?.value || "TU_DANG_KY",
        p_starts_at: localToIso(f.elements.starts_at.value),
        p_ends_at: localToIso(f.elements.ends_at.value),
        p_activation_enabled: f.elements.activation_enabled.checked,
        p_max_uses: f.elements.max_uses.value ? Number(f.elements.max_uses.value) : null,
        p_require_external_code: f.elements.require_external_code.checked,
        p_auto_link_on_signup: f.elements.auto_link_on_signup.checked,
        p_description: f.elements.description.value.trim() || null,
      };
      if (!code && !f.elements.partner_code.value) {
        status("adm-status", "Chọn đối tác.", false);
        return;
      }
      try {
        let target = code;
        if (code) {
          await rpc("admin_update_program", { p_program_code: code, ...common });
          status("adm-status", `Đã lưu chương trình ${code}.`);
        } else {
          const r = await rpc("admin_create_program", { p_partner_code: f.elements.partner_code.value, ...common });
          target = r.code;
          status("adm-status", `Đã tạo chương trình ${r.code} (bản nháp). Kiểm tra lại rồi bấm “Mở chương trình”.`);
        }
        await Promise.all([loadPrograms(), loadPartners()]);
        await openProgram(target);
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });
    document.getElementById("program-detail").addEventListener("click", async (ev) => {
      const s = ev.target.closest("[data-set-status]");
      if (s) {
        const to = s.dataset.setStatus;
        const msg =
          to === "ended"
            ? "Kết thúc chương trình? Đây là trạng thái cuối, không mở lại được — muốn tiếp tục cần tạo đợt mới."
            : to === "active"
              ? "Mở chương trình? Thành viên đã liên kết tài khoản sẽ được cấp quyền học ngay."
              : "Tạm dừng chương trình? Mã kích hoạt ngừng nhận người mới.";
        if (!confirm(msg)) return;
        try {
          const r = await rpc("admin_set_program_status", { p_program_code: currentProgram, p_status: to });
          status("adm-status", `Đã chuyển trạng thái.${r.enrolled ? ` Cấp ${r.enrolled} quyền học.` : ""}`);
          await Promise.all([loadPrograms(), loadPartners()]);
          await openProgram(currentProgram);
        } catch (e) {
          status("adm-status", errText(e), false);
        }
        return;
      }
      if (ev.target.id === "pd-copy-code") {
        const p = programs.find((x) => x.code === currentProgram);
        const ok = await copyText(p?.activation_code || "");
        status("adm-status", ok ? "Đã sao chép mã kích hoạt." : "Không sao chép được.", ok);
      }
      if (ev.target.id === "pd-regen-code") {
        if (!confirm("Tạo mã kích hoạt mới? Mã cũ hết hiệu lực ngay.")) return;
        try {
          await rpc("admin_regenerate_activation_code", { p_program_code: currentProgram });
          status("adm-status", "Đã tạo mã kích hoạt mới.");
          await loadPrograms();
          await openProgram(currentProgram);
        } catch (e) {
          status("adm-status", errText(e), false);
        }
      }
      if (ev.target.id === "pd-edit") {
        openProgramForm(programs.find((x) => x.code === currentProgram));
      }
      if (ev.target.id === "pd-members") {
        document.getElementById("member-program").value = currentProgram;
        showArea("members");
        loadMembers().catch(fail("adm-status"));
      }
    });

    /* --- Thành viên --- */
    document.getElementById("member-program").addEventListener("change", () => {
      importRows = [];
      document.getElementById("import-preview").hidden = true;
      loadMembers().catch(fail("adm-status"));
    });
    document.getElementById("member-search").addEventListener("input", renderMembers);
    document.querySelector('[data-area-panel="members"]').addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-member-status]");
      if (!b) return;
      const to = b.dataset.memberStatus;
      let reason = null;
      if (to !== "active") {
        reason = askReason(
          to === "removed"
            ? "Gỡ thành viên khỏi chương trình? Quyền học cấp theo chương trình sẽ bị thu hồi."
            : "Tạm dừng thành viên? Quyền học cấp theo chương trình sẽ bị thu hồi."
        );
        if (!reason) return;
      } else if (!confirm("Kích hoạt lại thành viên và cấp lại quyền học (nếu chương trình đang mở)?")) {
        return;
      }
      try {
        const r = await rpc("admin_set_member_status", { p_member_id: b.dataset.id, p_status: to, p_reason: reason });
        status("adm-status", `Đã cập nhật thành viên${r.enrollments ? ` (${r.enrollments} quyền học thay đổi)` : ""}.`);
        await loadMembers();
        loadPrograms().catch(() => {});
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });
    document.getElementById("import-file").addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      document.getElementById("import-text").value = await file.text();
    });
    document.getElementById("btn-import-preview").addEventListener("click", async () => {
      const code = document.getElementById("member-program").value;
      if (!code) return status("import-msg", "Chọn chương trình trước.", false);
      const rows = parseImport(document.getElementById("import-text").value);
      if (!rows.length) return status("import-msg", "Chưa có dòng nào.", false);
      try {
        const r = await rpc("admin_preview_program_import", { p_program_code: code, p_rows: rows });
        const okStates = ["co_tai_khoan", "cho_dang_ky"];
        importRows = rows.filter((_, i) => okStates.includes(r.rows[i]?.state));
        const s = r.summary || {};
        document.getElementById("import-summary").innerHTML = [
          [s.co_tai_khoan, "Có tài khoản"],
          [s.cho_dang_ky, "Chờ đăng ký"],
          [s.da_co, "Đã có (bỏ qua)"],
          [s.loi, "Lỗi / trùng (bỏ qua)"],
        ]
          .map(([n, t]) => `<div class="adm-stat"><strong>${n || 0}</strong><span>${t}</span></div>`)
          .join("");
        document.getElementById("import-preview-rows").innerHTML = (r.rows || [])
          .map(
            (x) => `<tr><td>${x.row}</td><td>${esc(x.email || "")}</td><td>${esc(x.full_name || "")}</td><td>${esc(x.external_code || "")}</td><td class="cp-state-${esc(x.state)}">${esc(IMPORT_ST[x.state] || x.state)}</td></tr>`
          )
          .join("");
        document.getElementById("import-preview").hidden = false;
        document.getElementById("btn-import-confirm").disabled = !importRows.length;
        status("import-msg", importRows.length ? `${importRows.length} dòng hợp lệ sẵn sàng nhập.` : "Không có dòng hợp lệ để nhập.", !!importRows.length);
      } catch (e) {
        status("import-msg", errText(e), false);
      }
    });
    document.getElementById("btn-import-confirm").addEventListener("click", async () => {
      const code = document.getElementById("member-program").value;
      if (!code || !importRows.length) return;
      if (!confirm(`Nhập ${importRows.length} thành viên vào ${code}?`)) return;
      try {
        const r = await rpc("admin_import_program_members", { p_program_code: code, p_rows: importRows });
        status(
          "import-msg",
          `Đã nhập ${r.rows || 0} dòng · liên kết ${r.linked || 0} tài khoản · chờ đăng ký ${r.pending || 0} · bỏ qua ${r.skipped || 0} · cấp ${r.enrolled_courses || 0} quyền học.`
        );
        importRows = [];
        document.getElementById("import-preview").hidden = true;
        document.getElementById("import-text").value = "";
        await loadMembers();
        loadPrograms().catch(() => {});
      } catch (e) {
        status("import-msg", errText(e), false);
      }
    });
    document.getElementById("member-add-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const code = document.getElementById("member-program").value;
      if (!code) return status("adm-status", "Chọn chương trình trước.", false);
      const f = ev.target;
      try {
        const r = await rpc("admin_add_program_member", {
          p_program_code: code,
          p_email: f.elements.email.value.trim(),
          p_external_code: f.elements.external_code.value.trim() || null,
          p_full_name: f.elements.full_name.value.trim() || null,
          p_faculty: f.elements.faculty.value.trim() || null,
          p_major: f.elements.major.value.trim() || null,
          p_cohort: f.elements.cohort.value.trim() || null,
          p_class_name: f.elements.class_name.value.trim() || null,
        });
        if (!r.rows) {
          status("adm-status", "Không thêm được: email không hợp lệ, thiếu mã bắt buộc hoặc đã có trong chương trình với mã khác.", false);
          return;
        }
        status("adm-status", r.linked ? `Đã thêm và liên kết tài khoản${r.enrolled_courses ? `, cấp ${r.enrolled_courses} quyền học` : ""}.` : "Đã thêm vào danh sách chờ đăng ký.");
        f.reset();
        await loadMembers();
        loadPrograms().catch(() => {});
      } catch (e) {
        status("adm-status", errText(e), false);
      }
    });

    /* --- Đề xuất hợp tác --- */
    document.getElementById("lead-filter").addEventListener("change", () => loadLeads().catch(fail("lead-msg")));
    document.getElementById("lead-rows").addEventListener("click", async (ev) => {
      const row = ev.target.closest("[data-lead]");
      if (!row) return;
      const id = row.getAttribute("data-lead");
      if (ev.target.closest("[data-lead-save]")) {
        try {
          await rpc("admin_update_campus_lead", {
            p_id: id,
            p_status: row.querySelector("[data-lead-status]").value,
            p_admin_note: row.querySelector("[data-lead-note]").value.trim() || null,
          });
          status("lead-msg", "Đã cập nhật đề xuất.");
          await loadLeads();
        } catch (e) {
          status("lead-msg", errText(e), false);
        }
      }
      if (ev.target.closest("[data-lead-convert]")) {
        const l = leads.find((x) => x.id === id);
        if (!l) return;
        openNewPartner({
          lead_id: l.id,
          partner_type: "university",
          name: l.school_name,
          contact_name: l.full_name,
          contact_position: [LEAD_ROLE_VI[l.role] || "", l.faculty || ""].filter(Boolean).join(" · "),
          contact_email: l.email,
          contact_phone: l.phone,
          note: [l.academic_year ? "Năm học " + l.academic_year : "", l.expected_students ? l.expected_students + " SV dự kiến" : "", l.note || ""]
            .filter(Boolean)
            .join(" · "),
        });
      }
    });
  });
})();
