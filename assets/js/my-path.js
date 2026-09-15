(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const Boot = window.sa247LearnerBoot;
    await Boot.bindChrome();
    const session = await Boot.requireSession("../lo-trinh/");
    if (!session) return;
    await Boot.paintUser(session);
    const Cont = await Boot.waitContinue();
    const nextMap = await Boot.loadNextMap();
    if (!Cont) return;
    const sb = await sa247Auth.ensureClient();
    const { snapshots } = await Cont.loadPrimaryContinue(sb, session.user.id);
    sa247LearnerPanels.paintJourney("journey-list", snapshots, nextMap);
  });
})();
