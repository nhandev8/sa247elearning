/* SA247 course page UX — hero meta, sticky CTA, live curriculum accordion, trust */
(function () {
  function bootJson() {
    const el = document.getElementById("sa247-course-boot");
    if (!el) return {};
    try {
      return JSON.parse(el.textContent || "{}");
    } catch {
      return {};
    }
  }

  function setText(sel, text) {
    const el = document.querySelector(sel);
    if (el && text != null && text !== "") el.textContent = text;
  }

  function paintHeroMeta(detail, boot) {
    const free = detail?.freeCount ?? boot.free_count ?? 0;
    const lessons = detail?.lessonCount ?? boot.lessons_count_label;
    const mods = detail?.moduleCount ?? boot.modules_count;
    const status = detail?.status || boot.status || "dang_mo";
    const statusVi = {
      ban_nhap: "Bản nháp",
      dang_hoan_thien: "Đang hoàn thiện",
      dang_mo: "Đang mở",
      sap_mo: "Sắp mở",
      tam_dung: "Tạm dừng",
      da_dong: "Đã đóng",
    }[status] || status;

    const meta = document.getElementById("course-hero-meta");
    if (!meta) return;
    const bits = [];
    if (mods) bits.push(`${mods} mô-đun`);
    if (lessons) bits.push(typeof lessons === "number" ? `${lessons} bài` : String(lessons));
    if (free) bits.push(`${free} bài học thử`);
    if (boot.duration_label || detail?.duration_label) {
      bits.push(boot.duration_label || detail.duration_label);
    }
    bits.push(statusVi);
    meta.innerHTML = bits.map((b) => `<span>${b}</span>`).join("");
  }

  function paintSticky(state) {
    const bar = document.getElementById("course-sticky-cta");
    if (!bar) return;
    const label = bar.querySelector("[data-sticky-label]");
    const btn = bar.querySelector("[data-sticky-btn]");
    if (!label || !btn) return;

    bar.hidden = false;
    if (state === "enrolled") {
      label.textContent = "Bạn đã mở khóa — tiếp tục học";
      btn.textContent = "Vào lớp học";
      btn.setAttribute("href", "#learner-root");
    } else if (state === "signed-out") {
      label.textContent = "Học thử miễn phí · mở khóa khi sẵn sàng";
      btn.textContent = "Học thử";
      btn.setAttribute("href", "#hoc-thu");
    } else if (state === "signed-in-locked") {
      label.textContent = "Đã đăng nhập — mở khóa để học toàn bộ";
      btn.textContent = "Mở khóa";
      btn.setAttribute("href", "#goi-pro");
    } else {
      label.textContent = "Xem bài học thử";
      btn.textContent = "Học thử";
      btn.setAttribute("href", "#hoc-thu");
    }
  }

  async function resolveSticky(boot) {
    if (!window.sa247Auth?.ready) {
      paintSticky("signed-out");
      return;
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      paintSticky("signed-out");
      return;
    }
    const code = boot.code;
    if (!code) {
      paintSticky("signed-in-locked");
      return;
    }
    const sb = await sa247Auth.ensureClient();
    const { data: course } = await sb.from("courses").select("id").eq("code", code).maybeSingle();
    if (!course) {
      paintSticky("signed-in-locked");
      return;
    }
    const ok = await sa247Auth.hasCourseAccess(course.id);
    paintSticky(ok ? "enrolled" : "signed-in-locked");
  }

  function enhanceCurriculumAccordion() {
    const board = document.querySelector("#lo-trinh .module-board");
    if (!board || board.dataset.accordion === "1") return;
    board.dataset.accordion = "1";
    const cards = [...board.querySelectorAll(".mod")];
    if (!cards.length) return;
    const wrap = document.createElement("div");
    wrap.className = "curriculum-acc";
    cards.forEach((card, i) => {
      const id = card.querySelector("b")?.textContent || `M${i + 1}`;
      const name = card.querySelector("span")?.textContent || "";
      const d = document.createElement("details");
      d.className = "curriculum-acc__item reveal";
      if (i === 0) d.open = true;
      d.innerHTML = `<summary><b>${id}</b> <span>${name}</span></summary>
        <div class="curriculum-acc__body"><p>Mô-đun ${id}: ${name}. Xem chi tiết bài học trong <a href="#learner-root">Lớp học</a>.</p></div>`;
      wrap.appendChild(d);
    });
    board.replaceWith(wrap);
  }

  function paintLiveCurriculum(detail) {
    const host = document.getElementById("live-curriculum");
    if (!host || !detail) return;
    // Classroom already lists all lessons; show summary strip for guests
    host.hidden = false;
    host.innerHTML = `<p class="lead">Mục lục trực tiếp từ hệ thống: <strong>${detail.moduleCount || 0}</strong> chương · <strong>${detail.lessonCount || 0}</strong> bài · <strong>${detail.freeCount || 0}</strong> học thử.</p>
      <p class="meta">Cuộn xuống <a href="#learner-root">Lớp học</a> để xem / học thử. Bài khóa hiện badge “Khóa”.</p>`;
  }

  function paintTrust(boot) {
    const host = document.getElementById("course-trust");
    if (!host) return;
    const items = boot.deliverables || [];
    if (!items.length) {
      host.innerHTML = `<ul class="trust-list">
        <li>Học thử trước — quyết định sau</li>
        <li>Thanh toán mở khóa tự động qua SePay</li>
        <li>Quiz &amp; chứng chỉ (khi đủ điều kiện)</li>
        <li><a href="../verify/">Xác minh chứng chỉ công khai</a></li>
      </ul>`;
      return;
    }
    host.innerHTML =
      '<ul class="trust-list">' +
      items
        .slice(0, 6)
        .map((d) => `<li>${typeof d === "string" ? d : d.title || d.body || ""}</li>`)
        .join("") +
      '<li><a href="../verify/">Xác minh chứng chỉ</a></li></ul>';
  }

  document.addEventListener("DOMContentLoaded", () => {
    const boot = bootJson();
    paintHeroMeta(null, boot);
    paintTrust(boot);
    enhanceCurriculumAccordion();
    resolveSticky(boot).catch(() => paintSticky("signed-out"));

    // Update nav primary CTA on course pages
    const navCta = document.querySelector(".nav__cta");
    if (navCta && boot.code) {
      navCta.setAttribute("href", "#hoc-thu");
      navCta.textContent = "Học thử";
    }
  });

  window.addEventListener("sa247:classroom-ready", (ev) => {
    const boot = bootJson();
    paintHeroMeta(ev.detail, boot);
    paintLiveCurriculum(ev.detail);
    resolveSticky(boot);
  });

  window.addEventListener("sa247:progress", () => {
    resolveSticky(bootJson());
  });
})();
