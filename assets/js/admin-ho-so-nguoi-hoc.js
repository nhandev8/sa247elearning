/* Admin · Hồ sơ người dùng — hub thao tác tài khoản + học tập */
(function () {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function roleVi(r) {
    return (
      {
        hoc_vien: "Học viên",
        student: "Học viên",
        quan_tri_cao_nhat: "Quản trị cao nhất",
        quan_tri: "Quản trị",
        quan_ly_noi_dung: "QL nội dung",
        giang_vien: "Giảng viên",
        admin: "Quản trị (legacy)",
      }[r] ||
      r ||
      "—"
    );
  }

  async function loadDossier(sb, uid, host, statusEl) {
    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id,full_name,phone,role,avatar_url,cert_display_name,created_at")
      .eq("id", uid)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) {
      statusEl.textContent = "Không tìm thấy hồ sơ.";
      host.innerHTML = "";
      return;
    }

    let email = "";
    try {
      const { data: em, error: emErr } = await sb.rpc("admin_get_user_email", {
        p_user_id: uid,
      });
      if (!emErr) email = em || "";
    } catch {
      /* ignore */
    }

    const [enrs, certs, orders, attempts, prog, courses] = await Promise.all([
      sb
        .from("enrollments")
        .select("id,status,enrolled_at,expires_at,course_id,course:courses(code,title)")
        .eq("user_id", uid)
        .order("enrolled_at", { ascending: false }),
      sb
        .from("certificates")
        .select("cert_code,full_name,status,score_percent,issued_at,course:courses(code,title)")
        .eq("user_id", uid)
        .order("issued_at", { ascending: false }),
      sb
        .from("orders")
        .select("order_code,status,amount,created_at,course:courses(code)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("quiz_attempts")
        .select("score_percent,passed,created_at,course:courses(code)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30),
      sb
        .from("lesson_progress")
        .select(
          "completed,progress_percent,last_watched_at,lesson:lessons(lesson_code,title,course:courses(code))"
        )
        .eq("user_id", uid)
        .order("last_watched_at", { ascending: false })
        .limit(40),
      sb.from("courses").select("code,title").order("code"),
    ]);

    if (enrs.error) throw enrs.error;

    const eList = enrs.data || [];
    const cList = certs.data || [];
    const oList = orders.data || [];
    const aList = attempts.data || [];
    const pList = prog.data || [];
    const courseOpts = (courses.data || [])
      .map((c) => `<option value="${esc(c.code)}">${esc(c.code)} · ${esc(c.title)}</option>`)
      .join("");

    // Progress summary by course code
    const progByCourse = {};
    pList.forEach((p) => {
      const code = p.lesson?.course?.code || "?";
      if (!progByCourse[code]) progByCourse[code] = { done: 0, recent: 0, last: null };
      if (p.completed) progByCourse[code].done += 1;
      progByCourse[code].recent += 1;
      if (!progByCourse[code].last && p.last_watched_at) {
        progByCourse[code].last = p.last_watched_at;
      }
    });

    statusEl.textContent = profile.full_name || email || uid;

    host.innerHTML = `
      <section class="adm-card" id="sec-account">
        <h2>Tài khoản</h2>
        <p><strong>${esc(profile.full_name || "(chưa đặt tên)")}</strong></p>
        <p>Email: <strong>${esc(email || "—")}</strong></p>
        <p class="adm-muted">ID: ${esc(profile.id)}</p>
        <p>Vai trò: ${esc(roleVi(profile.role))} · SĐT: ${esc(profile.phone || "—")}</p>
        <p>Tên trên GCN (mặc định): ${esc(profile.cert_display_name || "—")}</p>
        <p class="adm-muted">Tham gia: ${sa247Admin.fmtTime(profile.created_at)}</p>
        <p class="adm-msg">Đổi vai trò hệ thống: <a href="../phan-quyen/">Vai trò &amp; phân quyền</a></p>
      </section>

      <section class="adm-card" id="sec-access">
        <h2>Quyền học</h2>
        <form id="grant-form" class="adm-form" style="margin-bottom:1rem">
          <label>Cấp khóa
            <select name="course_code" required>${courseOpts || "<option value=\"\">(chưa có khóa)</option>"}</select>
          </label>
          <label>Ghi chú
            <input name="note" type="text" placeholder="Lý do cấp quyền (tuỳ chọn)" />
          </label>
          <button type="submit" class="adm-btn" ${courseOpts ? "" : "disabled"}>Cấp quyền học</button>
          <p class="adm-msg" id="grant-msg"></p>
        </form>
        ${
          eList.length
            ? `<div class="adm-table-wrap"><table class="adm-table">
                <thead><tr><th>Khóa</th><th>Trạng thái</th><th>Từ</th><th></th></tr></thead>
                <tbody>
                ${eList
                  .map((e) => {
                    const c = e.course || {};
                    const revoke =
                      e.status === "active"
                        ? `<button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-revoke="${esc(e.id)}">Thu hồi</button>`
                        : "—";
                    return `<tr>
                      <td><strong>${esc(c.code || "")}</strong><div class="adm-msg">${esc(c.title || "")}</div></td>
                      <td>${esc(sa247Admin.statusEnrollVi(e.status))}</td>
                      <td>${sa247Admin.fmtTime(e.enrolled_at)}${
                        e.expires_at
                          ? `<div class="adm-msg">Hết ${sa247Admin.fmtTime(e.expires_at)}</div>`
                          : ""
                      }</td>
                      <td>${revoke}</td>
                    </tr>`;
                  })
                  .join("")}
                </tbody></table></div>`
            : '<p class="adm-muted">Chưa có quyền học. Cấp khóa ở form trên.</p>'
        }
      </section>

      <section class="adm-card" id="sec-progress">
        <h2>Tiến độ học tập</h2>
        ${
          Object.keys(progByCourse).length
            ? `<ul class="adm-todo">${Object.entries(progByCourse)
                .map(
                  ([code, s]) =>
                    `<li><strong>${esc(code)}</strong> — ${s.done} bài hoàn thành (trong ${s.recent} bản ghi gần đây)
                      ${s.last ? " · gần nhất " + sa247Admin.fmtTime(s.last) : ""}</li>`
                )
                .join("")}</ul>
              <p class="adm-msg">Chi tiết gần đây:</p>
              <ul class="adm-todo">${pList
                .slice(0, 15)
                .map((p) => {
                  const L = p.lesson || {};
                  const c = L.course || {};
                  return `<li>${esc(c.code || "")} · ${esc(L.lesson_code || "")} — ${esc(L.title || "")}
                    · ${p.completed ? "xong" : (p.progress_percent || 0) + "%"}
                    · ${sa247Admin.fmtTime(p.last_watched_at)}</li>`;
                })
                .join("")}</ul>`
            : '<p class="adm-muted">Chưa có lesson_progress.</p>'
        }
        <p class="adm-msg"><a href="../tien-do/">Xem tiến độ theo khóa (toàn hệ thống)</a></p>
      </section>

      <section class="adm-card" id="sec-quiz">
        <h2>Kiểm tra &amp; kết quả</h2>
        ${
          aList.length
            ? `<ul class="adm-todo">${aList
                .map((a) => {
                  const c = a.course || {};
                  return `<li>${esc(c.code || "")} · ${a.score_percent}% · ${
                    a.passed ? "Đạt" : "Chưa đạt"
                  } · ${sa247Admin.fmtTime(a.created_at)}</li>`;
                })
                .join("")}</ul>`
            : '<p class="adm-muted">Chưa có lần làm quiz.</p>'
        }
      </section>

      <section class="adm-card" id="sec-cert">
        <h2>Chứng nhận</h2>
        ${
          cList.length
            ? `<ul class="adm-todo">${cList
                .map((c) => {
                  const course = c.course || {};
                  return `<li><strong>${esc(c.cert_code)}</strong> · ${esc(course.code || "")}
                    · ${esc(c.full_name || "")} · ${esc(c.status)}
                    · ${sa247Admin.fmtTime(c.issued_at)}</li>`;
                })
                .join("")}</ul>
              <p class="adm-msg"><a href="../chung-nhan/">Quản lý chứng nhận (toàn hệ thống)</a></p>`
            : '<p class="adm-muted">Chưa có chứng nhận.</p>'
        }
      </section>

      <section class="adm-card" id="sec-orders">
        <h2>Đơn hàng &amp; thanh toán</h2>
        ${
          oList.length
            ? `<ul class="adm-todo">${oList
                .map((o) => {
                  const c = o.course || {};
                  return `<li>${esc(o.order_code)} · ${esc(c.code || "")}
                    · ${Number(o.amount).toLocaleString("vi-VN")}đ · ${esc(o.status)}
                    · ${sa247Admin.fmtTime(o.created_at)}</li>`;
                })
                .join("")}</ul>
              <p class="adm-msg"><a href="../don-hang/">Đơn hàng (toàn hệ thống)</a></p>`
            : '<p class="adm-muted">Chưa có đơn.</p>'
        }
      </section>`;

    const grantForm = document.getElementById("grant-form");
    grantForm?.addEventListener("submit", async (ev) => {
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
      msg.innerHTML = '<span class="adm-msg--ok">Đã cấp quyền học.</span>';
      await loadDossier(sb, uid, host, statusEl);
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
        await loadDossier(sb, uid, host, statusEl);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Hồ sơ người dùng");
      if (!ctx) return;
      const { sb } = ctx;
      const uid = new URLSearchParams(location.search).get("id");
      const host = document.getElementById("dossier");
      const status = document.getElementById("adm-status");
      if (!uid) {
        status.textContent = "Thiếu id người dùng.";
        return;
      }
      await loadDossier(sb, uid, host, status);
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
