/* Auth-aware top nav: login XOR (my courses + logout) */
(function () {
  function setHidden(el, hide) {
    if (!el) return;
    if (hide) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  async function paint() {
    const login = document.querySelector("[data-nav-login]");
    const dash = document.querySelector("[data-nav-dashboard]");
    const logout = document.querySelector("[data-nav-logout]");
    if (!login && !dash && !logout) return;

    let signedIn = false;
    try {
      if (window.sa247Auth?.ready) {
        const session = await sa247Auth.getSession();
        signedIn = Boolean(session);
      }
    } catch (err) {
      console.warn("[nav auth]", err);
      signedIn = false;
    }

    // Mutual exclusion: never show login together with dashboard/logout
    setHidden(login, signedIn);
    setHidden(dash, !signedIn);
    setHidden(logout, !signedIn);

    document.documentElement.classList.toggle("sa247-signed-in", signedIn);

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
    // Default: logged-out UI until session resolves
    setHidden(document.querySelector("[data-nav-dashboard]"), true);
    setHidden(document.querySelector("[data-nav-logout]"), true);
    setHidden(document.querySelector("[data-nav-login]"), false);
    paint();
  });

  window.sa247PaintNav = paint;
})();
