(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    const session = await Boot.requireSession("../cai-dat/");
    if (!session) return;
    await Boot.paintUser(session);
    const el = document.getElementById("settings-email");
    if (el) {
      el.textContent =
        "Email đăng nhập: " +
        (session.user.email || "—") +
        (session.user.email_confirmed_at ? " · Đã xác minh" : " · Chưa xác minh");
    }
  });
})();
