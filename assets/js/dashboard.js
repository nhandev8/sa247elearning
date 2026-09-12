/* SA247 learner dashboard — progress psychology + next best course */
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

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let nextMap = { next_courses: {}, programs: {} };

  async function loadNextMap() {
    try {
      const res = await fetch("../assets/js/next-courses.json", { cache: "no-store" });
      if (res.ok) nextMap = await res.json();
    } catch (e) {
      console.warn("[dashboard] next-courses", e);
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

  async function courseProgressDetail(sb, userId, courseCode) {
    const empty = {
      done: 0,
      total: 0,
      pct: 0,
      nextTitle: "",
      nextModule: "",
      moduleDone: 0,
      moduleTotal: 0,
    };
    if (!courseCode) return empty;

    const { data: outline, error } = await sb.rpc("get_course_outline", {
      p_course_code: courseCode,
    });
    if (error || !outline) return empty;

    const flat = [];
    (outline.modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => {
        if (!String(l.lesson_code || "").trim()) return;
        if (l.publish_status === "replaced") return;
        flat.push({
          id: l.id,
          title: l.title || l.lesson_code,
          moduleTitle: m.title || m.code || "",
          moduleId: m.id,
        });
      });
    });
    if (!flat.length) return empty;

    const ids = flat.map((l) => l.id);
    const { data: prog } = await sb
      .from("lesson_progress")
      .select("lesson_id,completed")
      .eq("user_id", userId)
      .in("lesson_id", ids);

    const doneSet = new Set(
      (prog || []).filter((p) => p.completed).map((p) => p.lesson_id)
    );
    const done = doneSet.size;
    const total = flat.length;
    const pct = Math.round((done / total) * 100);

    const next = flat.find((l) => !doneSet.has(l.id)) || null;
    const mods = outline.modules || [];
    let moduleDone = 0;
    let moduleTotal = mods.length;
    let curModIdx = 0;
    if (next) {
      curModIdx = Math.max(
        0,
        mods.findIndex((m) => m.id === next.moduleId)
      );
    } else if (done === total) {
      curModIdx = Math.max(0, moduleTotal - 1);
    }
    mods.forEach((m, i) => {
      const lessons = (m.lessons || []).filter(
        (l) => String(l.lesson_code || "").trim() && l.publish_status !== "replaced"
      );
      if (!lessons.length) return;
      if (lessons.every((l) => doneSet.has(l.id))) moduleDone += 1;
      if (i === curModIdx) {
        /* keep */
      }
    });

    return {
      done,
      total,
      pct,
      nextTitle: next ? next.title : "",
      nextModule: next ? next.moduleTitle : "",
      moduleDone,
      moduleTotal,
      curMod: curModIdx + 1,
    };
  }

  function nextCourseCard(code) {
    const tip = (nextMap.next_courses || {})[code];
    if (!tip) return "";
    const meta = (nextMap.programs || {})[tip.code] || {};
    const title = meta.title || tip.code;
    const slug = tip.slug || meta.slug || "";
    if (!slug) return "";
    return `<aside class="next-course">
      <p class="kicker">Bước tiếp theo</p>
      <h4>${esc(tip.code)} · ${esc(title)}</h4>
      <p>${esc(tip.why || "")}</p>
      <a class="btn btn--amber btn--small" href="../${esc(slug)}/#dang-ky">Học tiếp · 69.000đ</a>
    </aside>`;
  }

  async function loadCourses(sb, userId) {
    const { data, error } = await sb
      .from("enrollments")
      .select("status, enrolled_at, course:courses(id,code,slug,title)")
      .eq("status", "active")
      .order("enrolled_at", { ascending: false });

    const box = el("courses");
    const status = el("status");
    const nextHost = el("next-best");
    if (error) {
      status.textContent = error.message;
      return;
    }
    if (!data?.length) {
      status.innerHTML =
        'Bạn chưa đăng ký khóa nào. <a href="../index.html#career-map">Tìm khóa phù hợp</a> → học thử → đăng ký 69.000đ.';
      box.innerHTML = "";
      if (nextHost) nextHost.innerHTML = "";
      return;
    }
    status.textContent = `${data.length} khóa đang học — tiếp tục để giữ nhịp:`;

    const details = await Promise.all(
      data.map(async (row) => {
        const c = row.course || {};
        const prog = await courseProgressDetail(sb, userId, c.code);
        return { row, c, prog };
      })
    );

    box.innerHTML = details
      .map(({ row, c, prog }) => {
        const nextLine = prog.nextTitle
          ? `<p class="continue-next"><span>Bài tiếp theo</span><strong>${esc(prog.nextTitle)}</strong></p>`
          : prog.pct >= 100
            ? `<p class="continue-next is-done"><strong>Bạn đã hoàn thành khóa này.</strong></p>`
            : "";
        const modLine =
          prog.moduleTotal > 0
            ? `Chương ${prog.curMod || 1}/${prog.moduleTotal}`
            : "";
        return `<article class="program-card program-card--progress">
          <span class="code">${esc(c.code || "")}</span>
          <h3>${esc(c.title || "Khóa học")}</h3>
          <p class="meta progress-meta">Bạn đã hoàn thành <strong>${prog.pct}%</strong>
            · ${prog.done}/${prog.total} bài${modLine ? " · " + modLine : ""}</p>
          <div class="progress-bar" role="progressbar" aria-valuenow="${prog.pct}" aria-valuemin="0" aria-valuemax="100">
            <span style="width:${prog.pct}%"></span>
          </div>
          ${nextLine}
          <a class="btn btn--amber btn--small" href="../${esc(c.slug)}/#noi-dung-khoa">Tiếp tục học</a>
          <p class="meta">${fmtTime(row.enrolled_at)}</p>
        </article>`;
      })
      .join("");

    if (nextHost) {
      const finished = details.filter((d) => d.prog.pct >= 80);
      const focus = finished[0] || details[0];
      if (focus?.c?.code) {
        const card = nextCourseCard(focus.c.code);
        nextHost.innerHTML = card
          ? `<h2>Bạn nên học gì tiếp theo?</h2>${card}`
          : `<h2>Lộ trình nghề nghiệp</h2>
             <p class="lead"><a href="../index.html#career-map">Career Map</a> giúp bạn chọn bước tiếp theo theo công việc.</p>`;
      }
    }
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
            <strong>${esc(c.code || "")} · ${esc(o.order_code)}</strong>
            <p>${esc(c.title || "")}</p>
            <p class="meta">${fmtVnd(o.amount)} · ${fmtTime(o.created_at)}</p>
          </div>
          <div class="order-card__right">
            <span class="order-badge">${paid ? "Đã thanh toán" : "Chờ CK"}</span>
            ${
              paid
                ? `<a class="btn btn--line btn--small" href="../${esc(c.slug)}/">Vào học</a>`
                : `<a class="btn btn--amber btn--small" href="../${esc(c.slug)}/#dang-ky">Xem QR</a>`
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

    await Promise.all([bindLogout(), loadNextMap()]);

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
    }

    await Promise.all([loadCourses(sb, session.user.id), loadOrders(sb)]);
  });
})();
