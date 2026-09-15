/* Shared boot for learner IA pages */
(function () {
  async function requireSession(nextPath) {
    if (!window.sa247Auth?.ready) return { error: "missing_config" };
    const session = await sa247Auth.getSession();
    if (!session) {
      location.href =
        "../auth/login.html?next=" + encodeURIComponent(nextPath || location.pathname);
      return null;
    }
    return session;
  }

  async function bindChrome() {
    document.getElementById("menu-toggle")?.addEventListener("click", () => {
      document.querySelector(".app-shell")?.classList.toggle("is-side-open");
    });
    const btn = document.getElementById("logout");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await sa247Auth.signOut();
        } catch (_) {}
        location.href = "../index.html";
      });
    }
  }

  async function paintUser(session) {
    const profile = await sa247Auth.getProfile({ session, timeoutMs: 3500 });
    const name =
      (profile?.full_name && String(profile.full_name).trim()) ||
      session.user.user_metadata?.full_name ||
      session.user.email ||
      "Học viên";
    const label = document.getElementById("user-label");
    if (label) label.textContent = session.user.email || name;
    if (sa247Auth.isStaffRole(profile?.role)) {
      const nav = document.querySelector(".app-side__nav");
      if (nav && !nav.querySelector("[data-admin-link]")) {
        nav.insertAdjacentHTML(
          "beforeend",
          `<a data-admin-link href="../admin/">Quản trị</a>`
        );
      }
    }
    return { profile, name };
  }

  async function loadNextMap() {
    try {
      const res = await fetch("../assets/js/next-courses.json", { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (_) {}
    return { next_courses: {}, programs: {} };
  }

  async function waitContinue(max = 40) {
    for (let i = 0; i < max && !window.sa247Continue; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return window.sa247Continue || null;
  }

  window.sa247LearnerBoot = {
    requireSession,
    bindChrome,
    paintUser,
    loadNextMap,
    waitContinue,
  };
})();
