/* SA247 · Học tập hub (IA): continue + todos + stats only */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  const C = () => window.sa247Continue;

  function paintContinueHero(primary) {
    const host = el("continue-hero");
    if (!host) return;
    const esc = C().esc;
    if (!primary || !primary.course?.code) {
      host.hidden = false;
      host.innerHTML = `<div class="continue-hero__empty">
        <p class="kicker">Bắt đầu</p>
        <h2>Chưa có khóa nào đang học</h2>
        <p>Chọn lộ trình phù hợp, học thử vài bài mở sẵn, rồi đăng ký để lưu tiến độ trên tài khoản.</p>
        <div class="continue-hero__actions">
          <a class="btn btn--amber" href="../index.html#career-map">Tìm khóa phù hợp</a>
          <a class="btn btn--line" href="../kien-thuc/">Kiến thức miễn phí</a>
        </div>
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
        ? `<a class="btn btn--line" href="../kiem-tra/?course=${encodeURIComponent(c.code)}">Làm bài kiểm tra</a>`
        : `<a class="btn btn--line" href="../${esc(c.slug)}/">Về trang khóa</a>`;

    host.hidden = false;
    host.innerHTML = `
      <article class="continue-hero__card">
        <div class="continue-hero__copy">
          <p class="kicker">Tiếp tục học</p>
          <span class="continue-hero__code">${esc(c.code)}</span>
          <h2>${esc(c.title || c.code)}</h2>
          <p class="continue-hero__pct">Đã hoàn thành <strong>${primary.pct}%</strong>
            · ${primary.done}/${primary.total} bài${when ? " · Học lần cuối: " + esc(when) : ""}</p>
          ${C().progressBarHtml(primary.pct)}
          ${lessonLine}
          ${pos}
        </div>
        <div class="continue-hero__actions">
          <a class="btn btn--amber" href="${href}">${esc(labels.text)} →</a>
          ${secondary}
        </div>
      </article>`;
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
    host.innerHTML = `
      <div class="learn-stat"><strong>${esc(String(inProg))}</strong><span>Đang học</span></div>
      <div class="learn-stat"><strong>${esc(String(doneCourses))}</strong><span>Hoàn thành</span></div>
      <div class="learn-stat"><strong>${esc(String(n))}</strong><span>Khóa đang có</span></div>
      <div class="learn-stat"><strong>${esc(String(certCount || 0))}</strong><span>Chứng nhận</span></div>`;
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
          href: `../kiem-tra/?course=${encodeURIComponent(c.code)}`,
          cta: "Kiểm tra",
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
        '<li class="todo-learn__empty">Không có việc đang mở. <a href="../khoa-cua-toi/">Xem khóa của tôi</a>.</li>';
      return;
    }
    ul.innerHTML = items
      .map(
        (it) =>
          `<li><div>${it.html}</div><a class="btn btn--line btn--small" href="${it.href}">${esc(it.cta)}</a></li>`
      )
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
        <div class="profile-nudge__copy">
          <p class="kicker">Hoàn thiện hồ sơ</p>
          <p class="profile-nudge__hint">${hint}</p>
          <p class="meta">Không bắt buộc để mua khóa.</p>
        </div>
        <div class="profile-nudge__meter">
          <div class="progress-bar profile-nudge__bar" aria-label="Độ đầy đủ hồ sơ ${score}%">
            <span style="width:${score}%"></span>
          </div>
          <p class="profile-nudge__pct">${score}%</p>
          <a class="btn btn--amber btn--small" href="../ho-so/">Hoàn thiện hồ sơ</a>
        </div>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    if (!window.sa247Auth?.ready) {
      el("welcome").textContent = "Chưa cấu hình Supabase.";
      return;
    }
    const session = await Boot.requireSession("../dashboard/");
    if (!session) return;
    const { name, profile } = await Boot.paintUser(session);
    el("welcome").textContent = `Xin chào, ${name}`;
    paintProfileNudge(profile);

    const Cont = await Boot.waitContinue();
    if (!Cont) {
      el("welcome").textContent = "Không tải được module Tiếp tục học.";
      return;
    }
    const sb = await sa247Auth.ensureClient();
    try {
      const { primary, snapshots } = await Cont.loadPrimaryContinue(sb, session.user.id);
      const certN = await countCerts(sb);
      paintContinueHero(primary);
      paintStats(snapshots, certN);
      paintTodos(snapshots);
    } catch (e) {
      console.warn(e);
      el("todo-list").innerHTML = `<li class="todo-learn__empty">${e.message || "Lỗi tải tiến độ."}</li>`;
    }
  });
})();
