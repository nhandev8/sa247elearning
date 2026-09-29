/* /hoc/ — header lớp học: mã khóa · tiến độ · một nút theo next_action (server) · mục lục */
(function () {
  const $ = (id) => document.getElementById(id);

  function ctaHref(state, code) {
    const a = state.next_action || {};
    const c = encodeURIComponent(code);
    switch (a.kind) {
      case "assessment":
        return `../quiz/?course=${c}`;
      case "certificate":
        return state.state === "ASSESSMENT_PASSED" ? `../chung-nhan/mua.html?course=${c}` : "../chung-nhan/";
      case "support":
        return "../phan-hoi/";
      default:
        return null;
    }
  }

  function paintProgress(pct) {
    $("lx-progress").hidden = false;
    $("lx-pct").textContent = `${pct}%`;
    $("lx-bar").style.width = `${pct}%`;
  }

  window.addEventListener("sa247:course", (e) => {
    const c = e.detail || {};
    $("lx-code").textContent = c.code || "";
    $("lx-title").textContent = c.title || "";
    document.title = `${c.code} · Học tập · SA247`;
    if (c.slug) $("lx-info").href = `../${c.slug}/?info=1`;
    $("lx-assess").href = `../kiem-tra/?course=${encodeURIComponent(c.code || "")}`;
  });

  window.addEventListener("sa247:course-progress", (e) => paintProgress(e.detail.percent));

  window.addEventListener("sa247:course-state", (e) => {
    const s = e.detail || {};
    paintProgress(s.progress_percent ?? 0);
    const href = ctaHref(s, s.course_code);
    const cta = $("lx-cta");
    if (href && s.next_action?.label) {
      cta.href = href;
      cta.textContent = s.next_action.label;
      cta.hidden = false;
    } else {
      cta.hidden = true;
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    $("lx-toc").addEventListener("click", () => {
      document.querySelector(".classroom")?.classList.toggle("is-side-open");
    });
  });
})();
