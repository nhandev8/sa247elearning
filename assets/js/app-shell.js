/* Auth-aware top nav: login / my courses / logout */
(function () {
  async function paint() {
    const login = document.querySelector("[data-nav-login]");
    const dash = document.querySelector("[data-nav-dashboard]");
    const logout = document.querySelector("[data-nav-logout]");
    if (!login && !dash && !logout) return;

    if (!window.sa247Auth?.ready) {
      if (login) login.hidden = false;
      if (dash) dash.hidden = true;
      if (logout) logout.hidden = true;
      return;
    }

    const session = await sa247Auth.getSession();
    const signedIn = Boolean(session);
    if (login) login.hidden = signedIn;
    if (dash) dash.hidden = !signedIn;
    if (logout) {
      logout.hidden = !signedIn;
      if (!logout.dataset.bound) {
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
  }

  document.addEventListener("DOMContentLoaded", paint);
  window.sa247PaintNav = paint;
})();
