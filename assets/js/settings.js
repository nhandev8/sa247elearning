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

    const toggle = document.getElementById("learning-reminders");
    const msg = document.getElementById("learning-reminders-msg");
    if (!toggle) return;

    const sb = await sa247Auth.ensureClient();
    try {
      const { data, error } = await sb.rpc("get_my_email_prefs");
      if (error) throw error;
      toggle.checked = data?.learning_reminders !== false;
    } catch (e) {
      if (msg) msg.textContent = "Chưa tải được tùy chọn email. Tải lại trang.";
      toggle.disabled = true;
      return;
    }

    toggle.addEventListener("change", async () => {
      toggle.disabled = true;
      if (msg) msg.textContent = "Đang lưu…";
      try {
        const { data, error } = await sb.rpc("set_my_learning_reminders", {
          p_enabled: !!toggle.checked,
        });
        if (error) throw error;
        toggle.checked = data?.learning_reminders !== false;
        if (msg) {
          msg.textContent = toggle.checked
            ? "Đã bật email nhắc học (khi bạn không học ≥ 3 ngày)."
            : "Đã tắt email nhắc học.";
        }
      } catch (e) {
        toggle.checked = !toggle.checked;
        if (msg) msg.textContent = "Không lưu được. Thử lại.";
      } finally {
        toggle.disabled = false;
      }
    });
  });
})();
