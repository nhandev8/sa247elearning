(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    const session = await Boot.requireSession("../don-hang/");
    if (!session) return;
    await Boot.paintUser(session);
    await Boot.waitContinue();
    const sb = await sa247Auth.ensureClient();
    await sa247LearnerPanels.paintOrders(sb, "orders", "orders-status");
  });
})();
