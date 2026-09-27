/* Admin · Hồ sơ người học — trung tâm thao tác theo từng người học */
(function () {
  const L = () => window.sa247Learner;
  const esc = (s) => L().esc(s);

  function quizLabel(a) {
    const q = a.quiz || {};
    if (q.scope === "khoa") return "Kiểm tra cuối khóa";
    if (a.module_code || q.module_code) return `Kiểm tra chương ${esc(a.module_code || q.module_code)}`;
    return esc(q.title || "Bài kiểm tra");
  }

  function feedbackStatusVi(s) {
    return (
      {
        MOI_TAO: "Mới tạo",
        DA_TIEP_NHAN: "Đã tiếp nhận",
        DANG_XU_LY: "Đang xử lý",
        CHO_XAC_MINH: "Chờ xác minh",
        CHO_THONG_TIN: "Chờ thông tin",
        DA_KHAC_PHUC: "Đã khắc phục",
        DA_DONG: "Đã đóng",
        KHONG_PHAI_LOI: "Không phải lỗi",
        TRUNG_LAP: "Trùng lặp",
        KHONG_THE_TAI_HIEN: "Không tái hiện được",
      }[s] || s || "—"
    );
  }

  function certStatusVi(s) {
    return { valid: "Đã cấp", issued: "Đã cấp", eligible: "Đủ điều kiện", revoked: "Đã thu hồi" }[s] || s || "—";
  }

  function table(head, rowsHtml, empty) {
    if (!rowsHtml.length) return `<p class="adm-muted">${empty}</p>`;
    return `<div class="adm-table-wrap"><table class="adm-table"><thead><tr>${head
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr></thead><tbody>${rowsHtml.join("")}</tbody></table></div>`;
  }

  function buildTimeline(sum, d) {
    const ev = [];
    const add = (at, text) => at && ev.push({ at, text });
    add(sum.joined_at, "Tạo tài khoản SA247");
    add(sum.last_sign_in_at, "Đăng nhập gần nhất");
    d.enrollments.forEach((e) =>
      add(e.enrolled_at, `Được cấp quyền học <strong>${esc(e.course?.code)}</strong> · ${esc(L().SOURCE[L().sourceKey(e.source)])}`)
    );
    d.progress.forEach((p) => {
      const title = `${esc(p.lesson?.lesson_code || "")} — ${esc(p.lesson?.title || "")}`;
      if (p.completed && p.completed_at) add(p.completed_at, `Hoàn thành bài ${title}`);
      else add(p.last_watched_at, `Học bài ${title} (${p.progress_percent || 0}%)`);
    });
    d.attempts.forEach((a) =>
      add(
        a.created_at,
        `${quizLabel(a)} ${esc(a.course?.code || "")}: ${a.score_percent}% · ${a.passed ? "Đạt" : "Chưa đạt"}`
      )
    );
    d.certs.forEach((c) => add(c.issued_at, `Nhận chứng nhận <strong>${esc(c.cert_code)}</strong>`));
    d.orders.forEach((o) => add(o.created_at, `Tạo đơn ${esc(o.order_code)} · ${sa247Admin.statusOrderVi(o.status)}`));
    d.feedback.forEach((f) => add(f.created_at, `Gửi phản hồi ${esc(f.ticket_code || "")}: ${esc(f.title || "")}`));
    return ev
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 40)
      .map((e) => `<li><time>${esc(new Date(e.at).toLocaleString("vi-VN"))}</time><span>${e.text}</span></li>`)
      .join("");
  }

  const BLOCKER_VI = {
    self: "Không thể thao tác trên chính tài khoản của bạn.",
    owner_account: "Tài khoản Quản trị cao nhất không thể khoá hoặc xoá.",
    staff_requires_owner: "Chỉ Quản trị cao nhất được khoá hoặc xoá tài khoản nhân sự.",
    paid_orders: "Có đơn hàng đã thanh toán — cần giữ chứng từ kế toán.",
    issued_certificates: "Có giấy chứng nhận đã cấp — cần giữ để tra cứu xác thực.",
    rate_limited: "Thao tác quá nhiều lần. Thử lại sau.",
  };

  const MANAGE_ERR_VI = {
    reason_required: "Cần nhập lý do (ít nhất 5 ký tự).",
    confirm_email_mismatch: "Email xác nhận không khớp.",
    forbidden: "Chỉ quản trị viên mới được thao tác.",
    not_found: "Không tìm thấy tài khoản.",
    delete_failed: "Không xoá được tài khoản.",
    lock_failed: "Không khoá được tài khoản.",
    unlock_failed: "Không mở khoá được tài khoản.",
  };

  async function manageUser(sb, body) {
    const { data, error } = await sb.functions.invoke("admin-manage-user", { body });
    if (!error) return data;
    try {
      return await error.context.json();
    } catch {
      return { ok: false, error: error.message };
    }
  }

  function manageErrText(res) {
    if (res?.error === "blocked") return (res.blockers || []).map((b) => BLOCKER_VI[b] || b).join(" ");
    return MANAGE_ERR_VI[res?.error] || res?.detail || res?.error || "Có lỗi xảy ra.";
  }

  async function paintAccount(sb, uid, reload) {
    const box = document.getElementById("sec-account");
    if (!box) return;
    const { data: c, error } = await sb.rpc("admin_user_account_check", { p_user_id: uid, p_intent: "view" });
    if (error || !c?.ok) {
      box.innerHTML = `<h2>Quản lý tài khoản</h2><p class="adm-msg adm-msg--err">${esc(error?.message || c?.error || "Không kiểm tra được.")}</p>`;
      return;
    }
    const n = c.counts || {};
    const delBlock = (c.delete_blockers || []).map((b) => `<li>${esc(BLOCKER_VI[b] || b)}</li>`).join("");
    const lockBlock = (c.lock_blockers || []).length > 0;
    box.innerHTML = `
      <h2>Quản lý tài khoản</h2>
      <p>Trạng thái đăng nhập: ${
        c.locked ? '<span class="adm-badge adm-badge--warn">Đã khoá</span>' : '<span class="adm-badge adm-badge--ok">Đang hoạt động</span>'
      }
        · ${n.enrollments || 0} quyền học · ${n.paid_orders || 0} đơn đã thanh toán · ${n.issued_certificates || 0} GCN đã cấp</p>
      ${
        lockBlock
          ? ""
          : `<form class="adm-form prf-inline" id="acc-lock-form" style="max-width:none;margin:.6rem 0">
              ${c.locked ? "" : '<input name="reason" type="text" placeholder="Lý do khoá (bắt buộc)" style="flex:1 1 240px" />'}
              <button type="submit" class="adm-btn ${c.locked ? "adm-btn--line" : "adm-btn--danger"}">${c.locked ? "Mở khoá đăng nhập" : "Khoá đăng nhập"}</button>
              <span class="adm-msg" id="acc-lock-msg"></span>
            </form>`
      }
      <details style="margin-top:.6rem">
        <summary>Xoá tài khoản vĩnh viễn</summary>
        ${
          c.can_delete
            ? `<p class="adm-msg adm-msg--err" style="margin-top:.6rem">Xoá vĩnh viễn tài khoản, hồ sơ, quyền học, tiến độ, bài kiểm tra và đơn chưa thanh toán. Không thể hoàn tác.</p>
              <form class="adm-form" id="acc-del-form" style="max-width:32rem">
                <label>Lý do xoá
                  <input name="reason" type="text" required minlength="5" maxlength="300" autocomplete="off" />
                </label>
                <label>Nhập lại email <strong>${esc(c.email || "")}</strong> để xác nhận
                  <input name="confirm_email" type="email" required autocomplete="off" />
                </label>
                <button type="submit" class="adm-btn adm-btn--danger">Xoá vĩnh viễn</button>
                <span class="adm-msg" id="acc-del-msg"></span>
              </form>`
            : `<p class="adm-msg" style="margin-top:.6rem">Không thể xoá tài khoản này:</p><ul class="adm-todo">${delBlock}</ul>
               ${lockBlock ? "" : '<p class="adm-msg">Dùng <strong>Khoá đăng nhập</strong> để chặn truy cập mà vẫn giữ hồ sơ.</p>'}`
        }
      </details>`;

    document.getElementById("acc-lock-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = document.getElementById("acc-lock-msg");
      const reason = String(new FormData(ev.target).get("reason") || "").trim();
      msg.className = "adm-msg";
      msg.textContent = "Đang xử lý…";
      const res = await manageUser(sb, { action: c.locked ? "unlock" : "lock", user_id: uid, reason });
      if (!res?.ok) {
        msg.className = "adm-msg adm-msg--err";
        msg.textContent = manageErrText(res);
        return;
      }
      await reload();
    });

    document.getElementById("acc-del-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const msg = document.getElementById("acc-del-msg");
      if (!confirm(`Xoá vĩnh viễn tài khoản ${c.email}? Không thể hoàn tác.`)) return;
      msg.className = "adm-msg";
      msg.textContent = "Đang xoá…";
      const res = await manageUser(sb, {
        action: "delete",
        user_id: uid,
        reason: String(fd.get("reason") || "").trim(),
        confirm_email: String(fd.get("confirm_email") || "").trim(),
      });
      if (!res?.ok) {
        msg.className = "adm-msg adm-msg--err";
        msg.textContent = manageErrText(res);
        return;
      }
      msg.className = "adm-msg adm-msg--ok";
      msg.textContent = "Đã xoá tài khoản.";
      setTimeout(() => (location.href = "../tai-khoan/"), 900);
    });
  }

  async function fetchAll(sb, uid, canCommerce) {
    const q = (p) => p.then((r) => r.data || []);
    const [overview, profile, email, enrollments, attempts, certs, orders, feedback, progress, courses] =
      await Promise.all([
        sb.rpc("admin_learner_overview", { p_user_id: uid, p_inactive_days: 14 }),
        sb
          .from("profiles")
          .select("id,full_name,phone,role,learner_type,cert_display_name,auth_provider,created_at")
          .eq("id", uid)
          .maybeSingle(),
        sb.rpc("admin_get_user_email", { p_user_id: uid }),
        q(
          sb
            .from("enrollments")
            .select("id,status,source,grant_reason,enrolled_at,expires_at,course:courses(code,title)")
            .eq("user_id", uid)
            .order("enrolled_at", { ascending: false })
        ),
        q(
          sb
            .from("quiz_attempts")
            .select("score_percent,passed,created_at,module_code,course:courses(code),quiz:quiz_defs(title,scope,module_code)")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(50)
        ),
        q(
          sb
            .from("certificates")
            .select("cert_code,full_name,status,score_percent,issued_at,course:courses(code,title)")
            .eq("user_id", uid)
            .order("issued_at", { ascending: false })
        ),
        canCommerce
          ? q(
              sb
                .from("orders")
                .select("order_code,status,amount,created_at,paid_at,product_type,course:courses(code)")
                .eq("user_id", uid)
                .order("created_at", { ascending: false })
                .limit(30)
            )
          : Promise.resolve([]),
        q(
          sb
            .from("feedback")
            .select("id,ticket_code,title,category,status,created_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(30)
        ),
        q(
          sb
            .from("lesson_progress")
            .select("completed,completed_at,progress_percent,last_watched_at,lesson:lessons(lesson_code,title)")
            .eq("user_id", uid)
            .order("last_watched_at", { ascending: false, nullsFirst: false })
            .limit(60)
        ),
        q(sb.from("courses").select("code,title").order("code")),
      ]);
    if (overview.error) throw overview.error;
    if (profile.error) throw profile.error;
    return {
      summary: (overview.data?.rows || [])[0] || null,
      profile: profile.data,
      email: email.data || "",
      enrollments,
      attempts,
      certs,
      orders,
      feedback,
      progress,
      courses,
    };
  }

  async function loadDossier(ctx, uid, host, statusEl) {
    const { sb } = ctx;
    const role = ctx.profile.role;
    const isAdmin = sa247Admin.isFullAdmin(role);
    const canCommerce = sa247Admin.canManageCommerce(role);
    const d = await fetchAll(sb, uid, canCommerce);
    if (!d.profile) {
      statusEl.textContent = "Không tìm thấy hồ sơ.";
      host.innerHTML = "";
      return;
    }
    const p = d.profile;
    const sum = d.summary || {
      courses: [],
      campus: [],
      flags: {},
      status: "no_access",
      n_active: 0,
      n_learning: 0,
      n_completed: 0,
      n_not_started: 0,
      joined_at: p.created_at,
    };
    const email = sum.email || d.email;
    statusEl.textContent = "";
    document.title = `${p.full_name || email || "Hồ sơ"} · Hồ sơ người học`;

    const typeOpts = Object.entries(L().LEARNER_TYPE)
      .map(([k, v]) => `<option value="${k}"${p.learner_type === k ? " selected" : ""}>${v}</option>`)
      .join("");
    const campus = sum.campus || [];

    const learnRows = (sum.courses || []).map(
      (c) => `<tr>
        <td><strong>${esc(c.code)}</strong><div class="adm-msg">${esc(c.title)}</div></td>
        <td><div class="lrn-course" style="grid-template-columns:1fr 2.6rem">${L().bar(c.progress)}<span>${c.progress}%</span></div></td>
        <td>${c.active ? L().courseStatusLabel(c.status) : '<span class="adm-muted">Không còn quyền</span>'}
          ${c.cert_pending ? '<div><span class="adm-badge adm-badge--ok">Chờ cấp chứng nhận</span></div>' : ""}</td>
        <td>${c.final_best != null ? `${c.final_best}%${c.final_passed ? " · Đạt" : ""}` : "—"}</td>
        <td><a class="adm-btn adm-btn--line adm-btn--small" href="../tien-do/?id=${encodeURIComponent(uid)}">Chi tiết</a></td>
      </tr>`
    );

    const accessRows = d.enrollments.map((e) => {
      const expired = e.expires_at && new Date(e.expires_at) < new Date();
      const revoke =
        canCommerce && e.status === "active"
          ? `<button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-revoke="${esc(e.id)}">Thu hồi</button>`
          : "";
      return `<tr>
        <td><strong>${esc(e.course?.code)}</strong><div class="adm-msg">${esc(e.course?.title)}</div></td>
        <td>${esc(L().SOURCE[L().sourceKey(e.source)])}${e.grant_reason ? `<div class="adm-msg">${esc(e.grant_reason)}</div>` : ""}</td>
        <td>${L().fmtDate(e.enrolled_at)}</td>
        <td>${e.expires_at ? L().fmtDate(e.expires_at) : "Không thời hạn"}</td>
        <td>${expired ? "Hết hạn" : esc(sa247Admin.statusEnrollVi(e.status))}</td>
        <td>${revoke}</td>
      </tr>`;
    });

    const quizRows = d.attempts.map(
      (a) => `<tr>
        <td>${esc(new Date(a.created_at).toLocaleString("vi-VN"))}</td>
        <td>${esc(a.course?.code || "")}</td>
        <td>${quizLabel(a)}</td>
        <td><strong>${a.score_percent}%</strong></td>
        <td>${a.passed ? '<span class="adm-badge adm-badge--ok">Đạt</span>' : '<span class="adm-badge adm-badge--warn">Chưa đạt</span>'}</td>
      </tr>`
    );

    const certRows = d.certs.map(
      (c) => `<tr>
        <td><strong>${esc(c.cert_code)}</strong></td>
        <td>${esc(c.course?.code || "")}</td>
        <td>${esc(c.full_name || "")}</td>
        <td>${certStatusVi(c.status)}</td>
        <td>${L().fmtDate(c.issued_at)}</td>
      </tr>`
    );

    const orderRows = d.orders.map(
      (o) => `<tr>
        <td><strong>${esc(o.order_code)}</strong></td>
        <td>${esc(o.course?.code || "")}</td>
        <td>${sa247Admin.fmtVnd(o.amount)}</td>
        <td>${esc(sa247Admin.statusOrderVi(o.status))}</td>
        <td>${L().fmtDate(o.created_at)}</td>
      </tr>`
    );

    const fbRows = d.feedback.map(
      (f) => `<tr>
        <td><strong>${esc(f.ticket_code || "")}</strong></td>
        <td>${esc(f.title || "")}</td>
        <td>${esc(feedbackStatusVi(f.status))}</td>
        <td>${L().fmtDate(f.created_at)}</td>
      </tr>`
    );

    const courseOpts = d.courses
      .map((c) => `<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.title)}</option>`)
      .join("");

    const flags = sum.flags || {};
    const attn = [
      flags.not_started && "Có quyền học nhưng chưa bắt đầu",
      flags.inactive && "Không hoạt động quá 14 ngày",
      flags.need_quiz && "Đã xem hết video nhưng chưa đạt kiểm tra cuối khóa",
      flags.cert_pending && "Đủ điều kiện, chưa được cấp chứng nhận",
    ].filter(Boolean);

    host.innerHTML = `
      <section class="adm-card prf-hero">
        <div>
          <h2>${esc(p.full_name || "(chưa đặt tên)")}</h2>
          <p>${esc(sa247Admin.roleLabelVi(p.role))} · ${esc(L().LEARNER_TYPE[p.learner_type] || "Cá nhân")}${
            campus[0] ? ` · ${esc(campus[0].partner_name || campus[0].program_name || "Campus")}${campus[0].cohort ? " · " + esc(campus[0].cohort) : ""}` : ""
          }</p>
          <div style="margin-top:.5rem">${L().statusBadge(sum.status, flags.inactive)}</div>
        </div>
        <div class="prf-hero__meta">
          <span>Email: <strong>${esc(email || "—")}</strong></span>
          <span>Điện thoại: <strong>${esc(p.phone || "—")}</strong></span>
          <span>Ngày tham gia: <strong>${L().fmtDate(p.created_at)}</strong></span>
          <span>Hoạt động gần nhất: <strong>${L().relTime(sum.last_activity_at)}</strong></span>
        </div>
      </section>

      ${attn.length ? `<section class="adm-card" style="border-color:rgba(154,107,0,.35);margin-bottom:1rem"><h2>Cần chú ý</h2><ul class="adm-todo">${attn.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}

      <div class="prf-stats">
        <div class="adm-stat"><strong>${sum.n_active || 0}</strong><span>Khóa có quyền học</span></div>
        <div class="adm-stat"><strong>${sum.n_learning || 0}</strong><span>Đang học</span></div>
        <div class="adm-stat"><strong>${sum.n_completed || 0}</strong><span>Hoàn thành</span></div>
        <div class="adm-stat"><strong>${sum.n_not_started || 0}</strong><span>Chưa bắt đầu</span></div>
      </div>

      <nav class="prf-nav" aria-label="Mục hồ sơ">
        <a href="#sec-learn">Học tập</a><a href="#sec-access">Quyền học</a><a href="#sec-quiz">Kiểm tra</a>
        <a href="#sec-cert">Chứng nhận</a>${canCommerce ? '<a href="#sec-orders">Đơn hàng</a>' : ""}
        <a href="#sec-feedback">Phản hồi</a><a href="#sec-activity">Hoạt động</a><a href="#sec-system">Thông tin hệ thống</a>
      </nav>

      <div class="prf-sections">
        <section class="adm-card" id="sec-learn">
          <h2>Học tập</h2>
          ${table(["Khóa học", "Tiến độ", "Trạng thái", "Điểm cuối khóa", ""], learnRows, "Chưa có khóa học nào.")}
        </section>

        <section class="adm-card" id="sec-access">
          <h2>Quyền học</h2>
          ${
            canCommerce
              ? `<form id="grant-form" class="adm-form prf-inline" style="max-width:none;margin-bottom:.9rem">
                  <select name="course_code" required aria-label="Khóa học">${courseOpts}</select>
                  <input name="note" type="text" placeholder="Lý do cấp quyền (tuỳ chọn)" style="flex:1 1 220px" />
                  <button type="submit" class="adm-btn adm-btn--primary">Cấp quyền học</button>
                  <span class="adm-msg" id="grant-msg"></span>
                </form>`
              : ""
          }
          ${table(["Khóa học", "Nguồn cấp", "Bắt đầu", "Hết hạn", "Trạng thái", ""], accessRows, "Chưa có quyền học.")}
        </section>

        <section class="adm-card" id="sec-quiz">
          <h2>Kiểm tra</h2>
          ${table(["Thời gian", "Khóa", "Bài kiểm tra", "Điểm", "Kết quả"], quizRows, "Chưa làm bài kiểm tra nào.")}
        </section>

        <section class="adm-card" id="sec-cert">
          <h2>Chứng nhận</h2>
          ${table(["Mã chứng nhận", "Khóa", "Tên trên GCN", "Trạng thái", "Ngày cấp"], certRows, "Chưa có chứng nhận.")}
        </section>

        ${
          canCommerce
            ? `<section class="adm-card" id="sec-orders">
                <h2>Đơn hàng &amp; thanh toán</h2>
                ${table(["Mã đơn", "Khóa", "Số tiền", "Trạng thái", "Ngày tạo"], orderRows, "Chưa có đơn hàng.")}
              </section>`
            : ""
        }

        <section class="adm-card" id="sec-feedback">
          <h2>Phản hồi &amp; hỗ trợ</h2>
          ${table(["Mã", "Nội dung", "Trạng thái", "Ngày gửi"], fbRows, "Chưa gửi phản hồi nào.")}
          ${fbRows.length ? '<p class="adm-msg"><a href="../phan-hoi/">Xử lý tại Phản hồi &amp; Hỗ trợ →</a></p>' : ""}
        </section>

        <section class="adm-card" id="sec-activity">
          <h2>Hoạt động</h2>
          <ul class="prf-timeline">${buildTimeline(sum, d) || '<li><span class="adm-muted">Chưa có hoạt động.</span></li>'}</ul>
        </section>

        ${
          campus.length
            ? `<section class="adm-card" id="sec-campus"><h2>Campus</h2>${table(
                ["Chương trình", "Đối tác", "Khóa / lớp", "Khoa · ngành", "Mã SV"],
                campus.map(
                  (c) => `<tr><td>${esc(c.program_name || c.program_code)}</td><td>${esc(c.partner_name || "")}</td>
                    <td>${esc(c.cohort || "")}</td><td>${esc([c.faculty, c.major].filter(Boolean).join(" · "))}</td>
                    <td>${esc(c.external_code || "")}</td></tr>`
                ),
                ""
              )}</section>`
            : ""
        }

        ${isAdmin ? '<section class="adm-card" id="sec-account"><h2>Quản lý tài khoản</h2><p class="adm-msg">Đang kiểm tra…</p></section>' : ""}

        <section class="adm-card prf-sys" id="sec-system">
          <details>
            <summary>Thông tin hệ thống</summary>
            <div style="display:grid;gap:.45rem;margin-top:.75rem;font-size:.9rem">
              <span>Mã tài khoản: <code id="sys-uid">${esc(p.id)}</code>
                <button type="button" class="adm-btn adm-btn--line adm-btn--small" id="copy-uid">Sao chép</button></span>
              <span>Đăng nhập bằng: ${esc(p.auth_provider || "email")} · Email đã xác nhận: ${sum.email_confirmed ? "Có" : "Chưa"}</span>
              <span>Đăng nhập gần nhất: ${sum.last_sign_in_at ? esc(new Date(sum.last_sign_in_at).toLocaleString("vi-VN")) : "—"}</span>
              <span>Tạo lúc: ${esc(new Date(p.created_at).toLocaleString("vi-VN"))}</span>
              <span>Tên trên GCN (mặc định): ${esc(p.cert_display_name || "—")}</span>
              ${
                isAdmin
                  ? `<span class="prf-inline">Loại người học:
                      <select id="learner-type">${typeOpts}</select>
                      <button type="button" class="adm-btn adm-btn--line adm-btn--small" id="save-type">Lưu</button>
                      <span class="adm-msg" id="type-msg"></span></span>
                    <span>Vai trò hệ thống: ${esc(sa247Admin.roleLabelVi(p.role))} — đổi tại <a href="../phan-quyen/">Vai trò &amp; phân quyền</a></span>`
                  : ""
              }
            </div>
          </details>
        </section>
      </div>`;

    const reload = () => loadDossier(ctx, uid, host, statusEl);

    if (isAdmin) paintAccount(sb, uid, reload);

    document.getElementById("copy-uid")?.addEventListener("click", async (ev) => {
      try {
        await navigator.clipboard.writeText(p.id);
        ev.target.textContent = "Đã sao chép";
      } catch {
        const r = document.createRange();
        r.selectNodeContents(document.getElementById("sys-uid"));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      }
    });

    document.getElementById("save-type")?.addEventListener("click", async () => {
      const msg = document.getElementById("type-msg");
      msg.textContent = "Đang lưu…";
      const { error } = await sb.rpc("admin_set_learner_type", {
        p_user_id: uid,
        p_type: document.getElementById("learner-type").value,
      });
      if (error) {
        msg.innerHTML = `<span class="adm-msg--err">${esc(error.message)}</span>`;
        return;
      }
      await reload();
    });

    document.getElementById("grant-form")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const msg = document.getElementById("grant-msg");
      msg.textContent = "Đang cấp quyền…";
      const { error } = await sb.rpc("admin_grant_enrollment_for_user", {
        p_user_id: uid,
        p_course_code: String(fd.get("course_code") || ""),
        p_note: String(fd.get("note") || ""),
      });
      if (error) {
        msg.innerHTML = `<span class="adm-msg--err">${esc(error.message)}</span>`;
        return;
      }
      await reload();
    });

    host.querySelectorAll("[data-revoke]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Thu hồi quyền học này?")) return;
        const { error } = await sb.rpc("admin_revoke_enrollment", {
          p_enrollment_id: btn.getAttribute("data-revoke"),
        });
        if (error) {
          alert(error.message);
          return;
        }
        await reload();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Hồ sơ người học");
      if (!ctx) return;
      const uid = new URLSearchParams(location.search).get("id");
      const host = document.getElementById("dossier");
      const status = document.getElementById("adm-status");
      if (!uid) {
        status.innerHTML = 'Chưa chọn người học. <a href="./">Chọn trong danh sách Người học →</a>';
        return;
      }
      await loadDossier(ctx, uid, host, status);
    } catch (e) {
      document.getElementById("adm-status").innerHTML = `<span class="adm-msg--err">${L().esc(e.message || e)}</span>`;
    }
  });
})();
