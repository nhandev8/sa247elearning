/* SA247 learner dashboard — Học tập · Tiếp tục học (P0) */
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

  const C = () => window.sa247Continue;

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

  function nextCourseCard(code) {
    const tip = (nextMap.next_courses || {})[code];
    if (!tip) return "";
    const meta = (nextMap.programs || {})[tip.code] || {};
    const title = meta.title || tip.code;
    const slug = tip.slug || meta.slug || "";
    if (!slug) return "";
    const esc = C().esc;
    return `<aside class="next-course">
      <p class="kicker">Khóa học đề xuất</p>
      <h4>${esc(tip.code)} · ${esc(title)}</h4>
      <p>${esc(tip.why || "")}</p>
      <a class="btn btn--amber btn--small" href="../${esc(slug)}/#dang-ky">Xem khóa · đăng ký</a>
    </aside>`;
  }

  function paintContinueHero(primary) {
    const host = el("continue-hero");
    if (!host) return;
    const esc = C().esc;
    if (!primary || !primary.course?.code) {
      host.hidden = false;
      host.innerHTML = `<div class="continue-hero__empty">
        <h2>Chào mừng bạn đến Học tập</h2>
        <p>Bạn chưa có khóa nào. Chọn lộ trình phù hợp, học thử, rồi đăng ký để lưu tiến độ.</p>
        <a class="btn btn--amber" href="../index.html#career-map">Tìm khóa phù hợp</a>
      </div>`;
      return;
    }

    const c = primary.course;
    const labels = C().ctaLabels(primary.state);
    const href =
      primary.state === "completed"
        ? `../${esc(c.slug)}/#learner-root`
        : C().learnHref(c.slug, primary.lesson);

    let lessonLine = "";
    if (primary.state === "completed") {
      lessonLine = `<p class="continue-hero__lesson">Bạn đã hoàn thành khóa học. Có thể xem lại hoặc làm kiểm tra.</p>`;
    } else if (primary.lesson) {
      const mod = primary.lesson.moduleCode || primary.lesson.moduleTitle || "";
      const code = primary.lesson.lesson_code || "";
      lessonLine = `<p class="continue-hero__lesson">Bạn đang học:<br /><strong>${esc(mod)}${code ? " · " + esc(code) : ""}</strong><br />${esc(primary.lesson.title)}</p>`;
    }

    const when = C().fmtRelative(primary.lastAt);
    const pos =
      primary.watchedSeconds > 15
        ? `<p class="continue-hero__pos">Tiếp tục từ ${C().fmtClock(primary.watchedSeconds)}</p>`
        : "";

    const secondary =
      primary.state === "completed"
        ? `<a class="btn btn--line" href="../quiz/?course=${encodeURIComponent(c.code)}">Làm bài kiểm tra</a>`
        : `<a class="btn btn--line" href="../${esc(c.slug)}/">Về trang khóa</a>`;

    host.hidden = false;
    host.innerHTML = `
      <p class="kicker">Tiếp tục học</p>
      <div class="continue-hero__card">
        <span class="continue-hero__code">${esc(c.code)}</span>
        <h2>${esc(c.title || c.code)}</h2>
        <p class="continue-hero__pct">Đã hoàn thành <strong>${primary.pct}%</strong>
          · ${primary.done}/${primary.total} bài${when ? " · Học lần cuối: " + esc(when) : ""}</p>
        ${C().progressBarHtml(primary.pct)}
        ${lessonLine}
        ${pos}
        <div class="continue-hero__actions">
          <a class="btn btn--amber" href="${href}">${esc(labels.text)} →</a>
          ${secondary}
        </div>
      </div>`;
  }

  function paintTodos(snapshots) {
    const ul = el("todo-list");
    if (!ul) return;
    const esc = C().esc;
    const items = [];
    (snapshots || []).forEach((s) => {
      const c = s.course || {};
      if (!c.code) return;
      if (s.state === "completed") {
        items.push({
          html: `<strong>${esc(c.code)}</strong> — Làm bài kiểm tra cuối khóa hoặc xem lại bài học.`,
          href: `../quiz/?course=${encodeURIComponent(c.code)}`,
          cta: "Kỳ thi",
        });
      } else if (s.lesson) {
        const left = Math.max(0, (s.total || 0) - (s.done || 0));
        items.push({
          html: `<strong>${esc(c.code)}</strong> — ${esc(s.lesson.title)}
            <span class="meta">(${left} bài còn lại · ${s.pct}%)</span>`,
          href: C().learnHref(c.slug, s.lesson),
          cta: "Tiếp tục học",
        });
      }
    });
    if (!items.length) {
      ul.innerHTML =
        '<li class="todo-learn__empty">Không có việc đang mở. <a href="../index.html#chuong-trinh">Xem danh mục khóa học</a>.</li>';
      return;
    }
    ul.innerHTML = items
      .map(
        (it) =>
          `<li><div>${it.html}</div><a class="btn btn--line btn--small" href="${it.href}">${esc(it.cta)}</a></li>`
      )
      .join("");
  }

  function paintCourses(snapshots) {
    const box = el("courses");
    const status = el("status");
    const esc = C().esc;
    if (!snapshots?.length) {
      status.innerHTML =
        'Bạn chưa đăng ký khóa nào. <a href="../index.html#career-map">Tìm khóa phù hợp</a>.';
      box.innerHTML = "";
      return;
    }
    status.textContent = `${snapshots.length} khóa trong tài khoản:`;
    box.innerHTML = snapshots
      .map((s) => {
        const c = s.course || {};
        const labels = C().ctaLabels(s.state);
        const href =
          s.state === "completed"
            ? `../${esc(c.slug)}/#learner-root`
            : C().learnHref(c.slug, s.lesson);
        const st =
          s.state === "completed"
            ? "Hoàn thành"
            : s.state === "in_progress"
              ? "Đang học"
              : "Chưa bắt đầu";
        const nextLine = s.lesson
          ? `<p class="continue-next"><span>Bài tiếp theo</span><strong>${esc(s.lesson.title)}</strong></p>`
          : s.state === "completed"
            ? `<p class="continue-next is-done"><strong>Đã hoàn thành khóa này.</strong></p>`
            : "";
        return `<article class="program-card program-card--progress">
          <span class="code">${esc(c.code || "")}</span>
          <h3>${esc(c.title || "Khóa học")}</h3>
          <p class="meta progress-meta">${st} · <strong>${s.pct}%</strong> · ${s.done}/${s.total} bài</p>
          ${C().progressBarHtml(s.pct)}
          ${nextLine}
          <a class="btn btn--amber btn--small" href="${href}">${esc(labels.text)}</a>
        </article>`;
      })
      .join("");
  }

  function paintNextBest(snapshots) {
    const nextHost = el("next-best");
    if (!nextHost) return;
    const finished = (snapshots || []).filter((d) => d.pct >= 80);
    const focus = finished[0] || snapshots?.[0];
    if (focus?.course?.code) {
      const card = nextCourseCard(focus.course.code);
      nextHost.innerHTML = card
        ? `<h2>Bạn nên học gì tiếp theo?</h2>${card}`
        : `<h2>Lộ trình nghề nghiệp</h2>
           <p class="lead"><a href="../index.html#career-map">Career Map</a> giúp bạn chọn bước tiếp theo theo công việc.</p>`;
    } else {
      nextHost.innerHTML = "";
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
    const esc = C().esc;
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
      el("welcome").textContent = "Chưa cấu hình Supabase.";
      return;
    }

    // wait continue-learning.js
    for (let i = 0; i < 40 && !window.sa247Continue; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!window.sa247Continue) {
      el("welcome").textContent = "Không tải được module Tiếp tục học.";
      return;
    }

    const session = await sa247Auth.getSession();
    if (!session) {
      location.href = "../auth/login.html?next=" + encodeURIComponent("../dashboard/");
      return;
    }

    const name =
      session.user.user_metadata?.full_name ||
      session.user.email?.split("@")[0] ||
      "bạn";
    el("user-label").textContent = session.user.email || name;
    el("welcome").textContent = `Chào mừng bạn trở lại, ${name}`;

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

    try {
      const { primary, snapshots } = await C().loadPrimaryContinue(sb, session.user.id);
      paintContinueHero(primary);
      paintCourses(snapshots);
      paintTodos(snapshots);
      paintNextBest(snapshots);
    } catch (e) {
      console.warn(e);
      el("status").textContent = e.message || "Không tải được tiến độ.";
    }

    await loadOrders(sb);
  });
})();
