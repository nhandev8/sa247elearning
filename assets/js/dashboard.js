/* SA247 learner dashboard — P0 Học tập + P1 lộ trình / thành tích / lịch sử */
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
      <p class="kicker">Bước tiếp theo được đề xuất</p>
      <h4>${esc(tip.code)} · ${esc(title)}</h4>
      <p>${esc(tip.why || "")}</p>
      <a class="btn btn--amber btn--small" href="../${esc(slug)}/#dang-ky">Học tiếp · xem khóa</a>
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
        <a class="btn btn--line" href="../kien-thuc/">Đọc kiến thức miễn phí</a>
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

  function paintStats(snapshots, certCount) {
    const host = el("learn-stats");
    if (!host) return;
    const esc = C().esc;
    const n = snapshots?.length || 0;
    const doneCourses = (snapshots || []).filter((s) => s.pct >= 100).length;
    const inProg = (snapshots || []).filter(
      (s) => s.state === "in_progress" || (s.pct > 0 && s.pct < 100)
    ).length;
    const lessonsDone = (snapshots || []).reduce((a, s) => a + (s.done || 0), 0);
    host.innerHTML = `
      <div class="learn-stat"><strong>${esc(String(n))}</strong><span>Khóa đang có</span></div>
      <div class="learn-stat"><strong>${esc(String(inProg))}</strong><span>Đang học</span></div>
      <div class="learn-stat"><strong>${esc(String(doneCourses))}</strong><span>Khóa hoàn thành</span></div>
      <div class="learn-stat"><strong>${esc(String(lessonsDone))}</strong><span>Bài đã xong</span></div>
      <div class="learn-stat"><strong>${esc(String(certCount || 0))}</strong><span>Chứng nhận</span></div>`;
  }

  function paintJourney(snapshots) {
    const ol = el("journey-list");
    if (!ol) return;
    const esc = C().esc;
    const owned = new Set((snapshots || []).map((s) => s.course?.code).filter(Boolean));
    const start =
      (snapshots || []).find((s) => s.state === "in_progress")?.course?.code ||
      (snapshots || []).find((s) => s.pct >= 100)?.course?.code ||
      (snapshots || [])[0]?.course?.code ||
      "ATNM-01";

    const chain = [start];
    let cur = start;
    for (let i = 0; i < 4; i++) {
      const tip = (nextMap.next_courses || {})[cur];
      if (!tip?.code || chain.includes(tip.code)) break;
      chain.push(tip.code);
      cur = tip.code;
    }

    ol.innerHTML = chain
      .map((code, idx) => {
        const snap = (snapshots || []).find((s) => s.course?.code === code);
        const meta = (nextMap.programs || {})[code] || {};
        const title = snap?.course?.title || meta.title || code;
        const slug = snap?.course?.slug || meta.slug || code.toLowerCase();
        const ownedHere = owned.has(code);
        const here =
          snap && (snap.state === "in_progress" || (snap.pct > 0 && snap.pct < 100));
        const done = snap && snap.pct >= 100;
        const cls = done ? "is-done" : here ? "is-here" : ownedHere ? "is-owned" : "";
        const badge = done
          ? "Hoàn thành"
          : here
            ? "Bạn đang ở đây"
            : ownedHere
              ? "Đã mở khóa"
              : "Đề xuất";
        const tipWhy =
          idx > 0
            ? (nextMap.next_courses || {})[chain[idx - 1]]?.why || ""
            : "";
        return `<li class="journey-item ${cls}">
          <span class="journey-item__badge">${esc(badge)}</span>
          <strong>${esc(code)}</strong>
          <span>${esc(title)}</span>
          ${tipWhy ? `<p class="meta">${esc(tipWhy)}</p>` : ""}
          <a class="btn btn--line btn--small" href="../${esc(slug)}/">${
            ownedHere ? (done ? "Xem lại" : "Tiếp tục") : "Xem khóa"
          }</a>
        </li>`;
      })
      .join("");
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
          html: `<strong>${esc(c.code)}</strong> — Làm bài kiểm tra cuối khóa hoặc đăng ký chứng nhận.`,
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

  function paintHistory(snapshots) {
    const ul = el("learn-history");
    if (!ul) return;
    const esc = C().esc;
    const rows = [];
    (snapshots || []).forEach((s) => {
      if (!s.lastAt || !s.lesson) return;
      rows.push({
        at: s.lastAt,
        code: s.course?.code || "",
        slug: s.course?.slug || "",
        title: s.lesson.title,
        lesson: s.lesson,
        watched: s.watchedSeconds || 0,
      });
    });
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    if (!rows.length) {
      ul.innerHTML = '<li class="meta">Chưa có phiên học gần đây.</li>';
      return;
    }
    ul.innerHTML = rows
      .slice(0, 8)
      .map((r) => {
        const href = C().learnHref(r.slug, r.lesson);
        const pos =
          r.watched > 15 ? ` · dừng ở ${C().fmtClock(r.watched)}` : "";
        return `<li>
          <div><strong>${esc(r.code)}</strong> — ${esc(r.title)}
            <span class="meta">${esc(C().fmtRelative(r.at))}${pos}</span></div>
          <a class="btn btn--line btn--small" href="${href}">Mở bài</a>
        </li>`;
      })
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
        const quizBtn =
          s.pct >= 80
            ? `<a class="btn btn--line btn--small" href="../quiz/?course=${encodeURIComponent(c.code)}">Kỳ thi</a>`
            : "";
        return `<article class="program-card program-card--progress">
          <span class="code">${esc(c.code || "")}</span>
          <h3>${esc(c.title || "Khóa học")}</h3>
          <p class="meta progress-meta">${st} · <strong>${s.pct}%</strong> · ${s.done}/${s.total} bài</p>
          ${C().progressBarHtml(s.pct)}
          ${nextLine}
          <div class="continue-hero__actions">
            <a class="btn btn--amber btn--small" href="${href}">${esc(labels.text)}</a>
            ${quizBtn}
          </div>
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
        ? `<h2>Khóa học đề xuất tiếp theo</h2>${card}`
        : `<h2>Lộ trình nghề nghiệp</h2>
           <p class="lead"><a href="../index.html#career-map">Career Map</a> giúp bạn chọn bước tiếp theo.</p>`;
    } else {
      nextHost.innerHTML = "";
    }
  }

  function orderStatusVi(status) {
    return (
      {
        pending: "Chờ thanh toán",
        paid: "Đã thanh toán · đã cấp quyền",
        cancelled: "Đã hủy",
        expired: "Hết hạn",
        failed: "Thất bại",
      }[status] || status || "—"
    );
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
            <p class="meta"><strong>${esc(orderStatusVi(o.status))}</strong>${
              o.paid_at ? " · " + fmtTime(o.paid_at) : ""
            }</p>
          </div>
          <div class="order-card__right">
            <span class="order-badge">${paid ? "Đã thanh toán" : "Chờ CK"}</span>
            ${
              paid
                ? `<a class="btn btn--line btn--small" href="../${esc(c.slug)}/#learner-root">Vào học</a>`
                : `<a class="btn btn--amber btn--small" href="../${esc(c.slug)}/#dang-ky">Thanh toán / QR</a>`
            }
          </div>
        </article>`;
      })
      .join("");
  }

  async function countCerts(sb) {
    try {
      const { data } = await sb.rpc("list_my_certificates");
      return (data || []).filter(
        (c) => c.status === "issued" || c.status === "valid" || c.status === "eligible"
      ).length;
    } catch {
      return 0;
    }
  }

  /** Soft nudge: không chặn mua khóa — chỉ gợi ý bổ sung SĐT / ảnh. */
  function paintProfileNudge(profile) {
    const host = el("profile-nudge");
    if (!host) return;
    const hasName = Boolean(String(profile?.full_name || "").trim());
    const hasPhone = Boolean(String(profile?.phone || "").trim());
    const hasAvatar = Boolean(String(profile?.avatar_url || "").trim());
    let score = 0;
    if (hasName) score += 40;
    if (hasPhone) score += 30;
    if (hasAvatar) score += 30;
    if (score >= 100) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    const missing = [];
    if (!hasName) missing.push("họ và tên");
    if (!hasPhone) missing.push("số điện thoại");
    if (!hasAvatar) missing.push("ảnh đại diện");
    const hint =
      missing.length === 1
        ? `Bổ sung ${missing[0]}`
        : `Bổ sung ${missing.slice(0, -1).join(", ")} và ${missing[missing.length - 1]}`;
    host.hidden = false;
    host.innerHTML = `
      <div class="profile-nudge__card">
        <p class="kicker">Hoàn thiện hồ sơ học viên</p>
        <div class="progress-bar profile-nudge__bar" aria-label="Độ đầy đủ hồ sơ ${score}%">
          <span style="width:${score}%"></span>
        </div>
        <p class="profile-nudge__pct">${score}%</p>
        <p class="profile-nudge__hint">${hint}</p>
        <p class="meta">Không bắt buộc để mua khóa — hữu ích khi liên hệ và cấp chứng nhận.</p>
        <p><a class="btn btn--amber btn--small" href="../ho-so/">Hoàn thiện hồ sơ</a></p>
      </div>`;
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

    const sb = await sa247Auth.ensureClient();
    const profile = await sa247Auth.getProfile({ session, timeoutMs: 4000 });
    const name =
      (profile?.full_name && String(profile.full_name).trim()) ||
      session.user.user_metadata?.full_name ||
      session.user.email?.split("@")[0] ||
      "bạn";
    el("user-label").textContent = session.user.email || name;
    el("welcome").textContent = `Xin chào, ${name}`;

    if (sa247Auth.isStaffRole(profile?.role)) {
      const nav = document.querySelector(".app-side__nav");
      if (nav && !nav.querySelector("[data-admin-link]")) {
        nav.insertAdjacentHTML(
          "beforeend",
          `<a data-admin-link href="../admin/"><span class="ico" aria-hidden="true">⚙</span>Quản trị</a>`
        );
      }
    }

    paintProfileNudge(profile);

    try {
      const { primary, snapshots } = await C().loadPrimaryContinue(sb, session.user.id);
      const certN = await countCerts(sb);
      paintContinueHero(primary);
      paintStats(snapshots, certN);
      paintCourses(snapshots);
      paintJourney(snapshots);
      paintTodos(snapshots);
      paintHistory(snapshots);
      paintNextBest(snapshots);
    } catch (e) {
      console.warn(e);
      el("status").textContent = e.message || "Không tải được tiến độ.";
    }

    await loadOrders(sb);
  });
})();
