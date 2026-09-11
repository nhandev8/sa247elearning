/* Auth-aware top nav: login XOR (my courses / admin + logout) */
(function () {
  function setHidden(el, hide) {
    if (!el) return;
    if (hide) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  async function paint() {
    const login = document.querySelector("[data-nav-login]");
    const dash = document.querySelector("[data-nav-dashboard]");
    const admin = document.querySelector("[data-nav-admin]");
    const logout = document.querySelector("[data-nav-logout]");
    const cta = document.querySelector(".nav__cta");
    if (!login && !dash && !logout && !admin) return;

    let signedIn = false;
    let staff = false;
    try {
      if (window.sa247Auth?.ready) {
        const session = await sa247Auth.getSession();
        signedIn = Boolean(session);
        if (signedIn) {
          const profile = await sa247Auth.getProfile({ timeoutMs: 1500 });
          staff = sa247Auth.isStaffRole(profile?.role);
        }
      }
    } catch (err) {
      console.warn("[nav auth]", err);
      signedIn = false;
      staff = false;
    }

    setHidden(login, signedIn);
    setHidden(dash, !signedIn);
    setHidden(admin, !(signedIn && staff));
    setHidden(logout, !signedIn);

    document.documentElement.classList.toggle("sa247-signed-in", signedIn);
    document.documentElement.classList.toggle("sa247-staff", staff);

    // Staff: CTA chính = vào Quản trị (trừ khi đang ở trang khóa với CTA học thử)
    if (cta && staff && !document.body.classList.contains("course-page")) {
      const adminHref = admin?.getAttribute("href") || "admin/";
      cta.setAttribute("href", adminHref);
      cta.textContent = "Quản trị";
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
    setHidden(document.querySelector("[data-nav-dashboard]"), true);
    setHidden(document.querySelector("[data-nav-admin]"), true);
    setHidden(document.querySelector("[data-nav-logout]"), true);
    setHidden(document.querySelector("[data-nav-login]"), false);
    paint();
  });

  window.sa247PaintNav = paint;
})();
