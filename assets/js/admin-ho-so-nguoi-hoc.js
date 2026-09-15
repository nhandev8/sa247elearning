/* Admin · Hồ sơ người học (compose enrollments / progress / quiz / certs / orders) */
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

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Hồ sơ người học");
      if (!ctx) return;
      const { sb } = ctx;
      const uid = new URLSearchParams(location.search).get("id");
      const host = document.getElementById("dossier");
      const status = document.getElementById("adm-status");
      if (!uid) {
        status.textContent = "Thiếu id người dùng.";
        return;
      }

      const { data: profile, error: pErr } = await sb
        .from("profiles")
        .select("id,full_name,phone,role,avatar_url,cert_display_name,created_at")
        .eq("id", uid)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) {
        status.textContent = "Không tìm thấy hồ sơ.";
        return;
      }

      const [enrs, certs, orders, attempts, prog] = await Promise.all([
        sb
          .from("enrollments")
          .select("status,enrolled_at,expires_at,course:courses(code,title)")
          .eq("user_id", uid),
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
          .select("completed,progress_percent,last_watched_at,lesson:lessons(lesson_code,title,course:courses(code))")
          .eq("user_id", uid)
          .order("last_watched_at", { ascending: false })
          .limit(20),
      ]);

      status.textContent = profile.full_name || uid;
      const eList = enrs.data || [];
      const cList = certs.data || [];
      const oList = orders.data || [];
      const aList = attempts.data || [];
      const pList = prog.data || [];

      host.innerHTML = `
        <section class="adm-card">
          <h2>Thông tin cá nhân</h2>
          <p><strong>${esc(profile.full_name || "(chưa đặt tên)")}</strong></p>
          <p class="adm-muted">ID: ${esc(profile.id)}</p>
          <p>Vai trò: ${esc(roleVi(profile.role))} · SĐT: ${esc(profile.phone || "—")}</p>
          <p>Tên trên GCN (mặc định): ${esc(profile.cert_display_name || "—")}</p>
          <p class="adm-muted">Tham gia: ${sa247Admin.fmtTime(profile.created_at)}</p>
        </section>
        <section class="adm-card">
          <h2>Quyền học / enrollment</h2>
          ${
            eList.length
              ? `<ul class="adm-todo">${eList
                  .map((e) => {
                    const c = e.course || {};
                    return `<li><strong>${esc(c.code || "")}</strong> — ${esc(c.title || "")}
                      · ${esc(e.status)} · từ ${sa247Admin.fmtTime(e.enrolled_at)}
                      ${e.expires_at ? " · hết " + sa247Admin.fmtTime(e.expires_at) : ""}</li>`;
                  })
                  .join("")}</ul>`
              : "<p class=\"adm-muted\">Chưa có enrollment.</p>"
          }
        </section>
        <section class="adm-card">
          <h2>Tiến độ gần đây</h2>
          ${
            pList.length
              ? `<ul class="adm-todo">${pList
                  .map((p) => {
                    const L = p.lesson || {};
                    const c = L.course || {};
                    return `<li>${esc(c.code || "")} · ${esc(L.lesson_code || "")} — ${esc(L.title || "")}
                      · ${p.completed ? "xong" : (p.progress_percent || 0) + "%"}
                      · ${sa247Admin.fmtTime(p.last_watched_at)}</li>`;
                  })
                  .join("")}</ul>`
              : "<p class=\"adm-muted\">Chưa có lesson_progress.</p>"
          }
        </section>
        <section class="adm-card">
          <h2>Đánh giá</h2>
          ${
            aList.length
              ? `<ul class="adm-todo">${aList
                  .map((a) => {
                    const c = a.course || {};
                    return `<li>${esc(c.code || "")} · ${a.score_percent}% · ${a.passed ? "Đạt" : "Chưa đạt"}
                      · ${sa247Admin.fmtTime(a.created_at)}</li>`;
                  })
                  .join("")}</ul>`
              : "<p class=\"adm-muted\">Chưa có lần làm quiz.</p>"
          }
        </section>
        <section class="adm-card">
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
                  .join("")}</ul>`
              : "<p class=\"adm-muted\">Chưa có chứng nhận.</p>"
          }
        </section>
        <section class="adm-card">
          <h2>Giao dịch</h2>
          ${
            oList.length
              ? `<ul class="adm-todo">${oList
                  .map((o) => {
                    const c = o.course || {};
                    return `<li>${esc(o.order_code)} · ${esc(c.code || "")}
                      · ${Number(o.amount).toLocaleString("vi-VN")}đ · ${esc(o.status)}
                      · ${sa247Admin.fmtTime(o.created_at)}</li>`;
                  })
                  .join("")}</ul>`
              : "<p class=\"adm-muted\">Chưa có đơn.</p>"
          }
        </section>`;
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
