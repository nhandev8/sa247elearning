/* Auth-aware top nav for marketing header (post login: Học tập + Tài khoản). */
(function () {
  function setHidden(el, hide) {
    if (!el) return;
    if (hide) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  async function paint() {
    const login = document.querySelector("[data-nav-login]");
    const register = document.querySelector("[data-nav-register]");
    const learnWrap = document.querySelector("[data-nav-learn-wrap]");
    const dashBtn = document.querySelector("[data-nav-dashboard]");
    const accountBtn = document.querySelector("[data-nav-account]");
    const admin = document.querySelector("[data-nav-admin]");
    const logout = document.querySelector("[data-nav-logout]");
    const cta = document.querySelector(".nav__cta");
    const loginMobile = document.querySelector("[data-nav-login-mobile]");
    const learnMobile = document.querySelector("[data-nav-learn-mobile]");

    if (!login && !dashBtn && !logout && !admin && !accountBtn) return;

    let signedIn = false;
    let staff = false;
    let label = "Tài khoản";
    try {
      if (window.sa247Auth?.ready) {
        const session = await sa247Auth.getSession();
        signedIn = Boolean(session);
        if (signedIn) {
          const profile = await sa247Auth.getProfile({ timeoutMs: 1500 });
          staff = sa247Auth.isStaffRole(profile?.role);
          const name = (profile?.full_name || profile?.ho_ten || session.user?.email || "").trim();
          if (name) label = name.split(/\s+/).slice(-2).join(" ") || name;
        }
      }
    } catch (err) {
      console.warn("[nav auth]", err);
      signedIn = false;
      staff = false;
    }

    // Public: never show Đăng ký in header
    setHidden(register, true);
    setHidden(login, signedIn);
    setHidden(learnWrap, !signedIn);
    setHidden(dashBtn, !signedIn);
    setHidden(accountBtn, !signedIn);
    setHidden(admin, !(signedIn && staff));
    setHidden(logout, !signedIn);
    setHidden(loginMobile, signedIn);
    setHidden(learnMobile, !signedIn);

    if (accountBtn) accountBtn.textContent = label;

    document.documentElement.classList.toggle("sa247-signed-in", signedIn);
    document.documentElement.classList.toggle("sa247-staff", staff);

    // Never hijack marketing CTA to Admin — admin only in account menu
    if (cta && !document.body.classList.contains("course-page")) {
      if (!cta.dataset.lockedHref) cta.dataset.lockedHref = cta.getAttribute("href") || "";
      if (!cta.dataset.lockedText) cta.dataset.lockedText = cta.textContent || "Tìm khóa phù hợp";
      if (cta.dataset.lockedHref) cta.setAttribute("href", cta.dataset.lockedHref);
      cta.textContent = cta.dataset.lockedText;
    }

    if (logout && !logout.dataset.bound) {
      logout.dataset.bound = "1";
      logout.addEventListener("click", async (e) => {
        e.preventDefault();
        logout.disabled = true;
        try {
          await sa247Auth.signOut();
        } catch (err) {
          console.warn(err);
        }
        location.href = logout.getAttribute("data-home") || "index.html";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Wait one tick so marketing-nav can mount hooks first
    requestAnimationFrame(() => {
      setHidden(document.querySelector("[data-nav-learn-wrap]"), true);
      setHidden(document.querySelector("[data-nav-dashboard]"), true);
      setHidden(document.querySelector("[data-nav-admin]"), true);
      setHidden(document.querySelector("[data-nav-logout]"), true);
      setHidden(document.querySelector("[data-nav-account]"), true);
      setHidden(document.querySelector("[data-nav-register]"), true);
      setHidden(document.querySelector("[data-nav-login]"), false);
      paint();
    });
  });

  window.sa247PaintNav = paint;
})();
