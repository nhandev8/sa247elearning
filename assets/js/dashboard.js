/* SA247 learner dashboard */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function fmtTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch {
      return iso;
    }
  }

  async function bindLogout() {
    const btn = el("logout");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Đang thoát…";
      try {
        await sa247Auth.signOut();
      } catch (e) {
        console.warn(e);
      }
      location.href = "../index.html";
    });
  }

  async function courseProgress(sb, userId, courseId) {
    const { data: modules } = await sb
      .from("modules")
      .select("id,lessons(id)")
      .eq("course_id", courseId);
    const lessonIds = [];
    (modules || []).forEach((m) =>
      (m.lessons || []).forEach((l) => lessonIds.push(l.id))
    );
    if (!lessonIds.length) return { done: 0, total: 0, pct: 0 };
    const { data: prog } = await sb
      .from("lesson_progress")
      .select("lesson_id,completed")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds)
      .eq("completed", true);
    const done = (prog || []).length;
    const total = lessonIds.length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }

  async function loadCourses(sb, userId) {
    const { data, error } = await sb
      .from("enrollments")
      .select("status, enrolled_at, course:courses(id,code,slug,title)")
      .eq("status", "active")
      .order("enrolled_at", { ascending: false });

    const box = el("courses");
    const status = el("status");
    if (error) {
      status.textContent = error.message;
      return;
    }
    if (!data?.length) {
      status.innerHTML =
        'Bạn chưa mở khóa khóa nào. <a href="../index.html#career-map">Career Map</a> → học thử → thanh toán 199.000đ.';
      box.innerHTML = "";
      return;
    }
    status.textContent = `${data.length} khóa đang học:`;
    const cards = await Promise.all(
      data.map(async (row) => {
        const c = row.course || {};
        const prog = c.id
          ? await courseProgress(sb, userId, c.id)
          : { done: 0, total: 0, pct: 0 };
        const progLabel =
          prog.total > 0
            ? `Tiến độ ${prog.pct}% · ${prog.done}/${prog.total} bài`
            : "Đã mở khóa";
        return `<a class="program-card" href="../${c.slug}/#noi-dung-khoa">
          <span class="code">${c.code || ""}</span>
          <h3>${c.title || "Khóa học"}</h3>
          <p class="meta">${progLabel} · ${fmtTime(row.enrolled_at)}</p>
          <div class="progress-bar" aria-hidden="true"><span style="width:${prog.pct}%"></span></div>
          <span class="go">Tiếp tục học →</span>
        </a>`;
      })
    );
    box.innerHTML = cards.join("");
  }

  async function loadOrders(sb) {
    const { data, error } = await sb
      .from("orders")
      .select("order_code,status,amount,created_at,paid_at,course:courses(code,slug,title)")
      .order("created_at", { ascending: false })
      .limit(20);

    const box = el("orders");
    const status = el("orders-status");
    if (error) {
      status.textContent = error.message;
      return;
    }
    if (!data?.length) {
      status.textContent = "Chưa có đơn thanh toán.";
      box.innerHTML = "";
      return;
    }
    status.textContent = "";
    box.innerHTML = data
      .map((o) => {
        const c = o.course || {};
        const paid = o.status === "paid";
        return `<article class="order-card ${paid ? "is-paid" : "is-pending"}">
          <div>
            <strong>${c.code || ""} · ${o.order_code}</strong>
            <p>${c.title || ""}</p>
            <p class="meta">${fmtVnd(o.amount)} · ${fmtTime(o.created_at)}</p>
          </div>
          <div class="order-card__right">
            <span class="order-badge">${paid ? "Đã thanh toán" : "Chờ CK"}</span>
            ${
              paid
                ? `<a class="btn btn--line btn--small" href="../${c.slug}/">Vào học</a>`
                : `<a class="btn btn--amber btn--small" href="../${c.slug}/#goi-pro">Xem QR</a>`
            }
          </div>
        </article>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    el("menu-toggle")?.addEventListener("click", () => {
      document.querySelector(".app-shell")?.classList.toggle("is-side-open");
    });

    await bindLogout();

    if (!window.sa247Auth?.ready) {
      el("status").textContent = "Chưa cấu hình Supabase.";
      return;
    }

    const session = await sa247Auth.getSession();
    if (!session) {
      location.href = "../auth/login.html?next=" + encodeURIComponent("../dashboard/");
      return;
    }

    const name = session.user.user_metadata?.full_name || session.user.email;
    el("user-label").textContent = name;

    const sb = await sa247Auth.ensureClient();
    const profile = await sa247Auth.getProfile();
    if (sa247Auth.isStaffRole(profile?.role)) {
      const nav = document.querySelector(".app-side__nav");
      if (nav && !nav.querySelector("[data-admin-link]")) {
        nav.insertAdjacentHTML(
          "beforeend",
          `<a data-admin-link href="../admin/"><span class="ico" aria-hidden="true">⚙</span>Quản trị</a>`
        );
      }
      const status = el("status");
      if (status) {
        status.insertAdjacentHTML(
          "afterend",
          `<p class="lead"><a class="btn btn--amber btn--small" href="../admin/">Mở bảng điều khiển quản trị →</a></p>`
        );
      }
    }

    await Promise.all([loadCourses(sb, session.user.id), loadOrders(sb)]);
  });
})();
