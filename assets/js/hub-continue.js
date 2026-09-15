/* Hub: khi đã đăng nhập + có quyền học → thanh Tiếp tục học (P0) */
(function () {
  async function paint() {
    const host = document.getElementById("hub-continue");
    if (!host) return;
    if (!window.sa247Auth?.ready) return;

    for (let i = 0; i < 40 && !window.sa247Continue; i++) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (!window.sa247Continue) return;

    const session = await sa247Auth.getSession();
    if (!session) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    try {
      const sb = await sa247Auth.ensureClient();
      const { primary } = await sa247Continue.loadPrimaryContinue(sb, session.user.id);
      if (!primary?.course?.code) {
        host.hidden = false;
        host.innerHTML = `<div class="wrap hub-continue__inner hub-continue__inner--empty">
          <p><strong>Bạn đã đăng nhập.</strong> Chưa có khóa đang học —
          <a href="#career-map">chọn lộ trình</a> hoặc
          <a href="dashboard/">vào Học tập</a>.</p>
        </div>`;
        return;
      }
      const c = primary.course;
      const labels = sa247Continue.ctaLabels(primary.state);
      const href =
        primary.state === "completed"
          ? `${c.slug}/#learner-root`
          : sa247Continue.learnHref(c.slug, primary.lesson).replace(/^\.\.\//, "");
      const lessonBits = primary.lesson
        ? `${sa247Continue.esc(primary.lesson.moduleCode || "")}${
            primary.lesson.lesson_code
              ? " · " + sa247Continue.esc(primary.lesson.lesson_code)
              : ""
          } — ${sa247Continue.esc(primary.lesson.title)}`
        : primary.state === "completed"
          ? "Đã hoàn thành khóa — làm kiểm tra hoặc xem lại"
          : "";
      const when = sa247Continue.fmtRelative(primary.lastAt);
      host.hidden = false;
      host.innerHTML = `<div class="wrap hub-continue__inner">
        <div class="hub-continue__text">
          <p class="hub-continue__kicker">Tiếp tục học</p>
          <p class="hub-continue__title"><strong>${sa247Continue.esc(c.code)}</strong> · ${sa247Continue.esc(c.title || "")}</p>
          <p class="hub-continue__meta">${primary.pct}% hoàn thành${when ? " · " + when : ""}${
            lessonBits ? "<br />" + lessonBits : ""
          }</p>
          ${sa247Continue.progressBarHtml(primary.pct)}
        </div>
        <div class="hub-continue__actions">
          <a class="btn btn--amber" href="${href}">${sa247Continue.esc(labels.text)} →</a>
          <a class="btn btn--line" href="dashboard/">Học tập</a>
        </div>
      </div>`;
    } catch (e) {
      console.warn("[hub-continue]", e);
      host.hidden = true;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    paint().catch((e) => console.warn("[hub-continue]", e));
  });
})();
