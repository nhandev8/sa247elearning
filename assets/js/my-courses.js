(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    const session = await Boot.requireSession("../khoa-cua-toi/");
    if (!session) return;
    await Boot.paintUser(session);
    const Cont = await Boot.waitContinue();
    if (!Cont) {
      document.getElementById("status").textContent = "Không tải được tiến độ.";
      return;
    }
    const sb = await sa247Auth.ensureClient();
    const { snapshots } = await Cont.loadPrimaryContinue(sb, session.user.id);
    sa247LearnerPanels.paintCourses("courses", "status", snapshots);
  });
})();
