/* SA247 course page UX — hero meta, sticky CTA theo trạng thái entitlement (TL10) */
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

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    return v.toLocaleString("vi-VN") + "đ";
  }

  function paintHeroMeta(detail, boot, priceLabel) {
    const free = detail?.freeCount ?? boot.free_count ?? 0;
    const lessons = detail?.lessonCount;
    const mods = detail?.moduleCount;
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
    if (mods != null && mods !== "") bits.push(`${mods} chương`);
    if (typeof lessons === "number") bits.push(`${lessons} bài học`);
    else if (lessons) bits.push(String(lessons));
    if (free) bits.push(`${free} bài học thử`);
    bits.push("Khóa học chính thức");
    if (priceLabel) bits.push(priceLabel);
    bits.push(statusVi);
    meta.innerHTML = bits.map((b) => `<span>${b}</span>`).join("");

    document.querySelectorAll("[data-live-price]").forEach((el) => {
      if (priceLabel) el.textContent = priceLabel;
    });
    const liveMeta = document.querySelector("#course-hero-meta [data-live-meta]");
    if (liveMeta && (mods != null || lessons != null)) {
      liveMeta.textContent =
        mods != null || typeof lessons === "number"
          ? `${mods || 0} chương · ${typeof lessons === "number" ? lessons : "…"} bài học`
          : liveMeta.textContent;
    }
  }

  function applyCta(state, priceLabel) {
    const price = priceLabel || "69.000đ";
    const bar = document.getElementById("course-sticky-cta");
    const label = bar?.querySelector("[data-sticky-label]");
    const btn = bar?.querySelector("[data-sticky-btn]");
    const heroCta = document.querySelector("[data-hero-cta]");
    const navCta = document.querySelector(".nav__cta");

    const map = {
      "signed-out": {
        label: `Khóa học chính thức · ${price}`,
        text: `Đăng ký học – ${price}`,
        href: "#goi-pro",
      },
      "signed-in-locked": {
        label: `Đã đăng nhập · đăng ký để học toàn bộ`,
        text: `Đăng ký học – ${price}`,
        href: "#goi-pro",
      },
      enrolled: {
        label: "Bạn đã có quyền học — tiếp tục học",
        text: "Tiếp tục học",
        href: "#learner-root",
      },
      completed: {
        label: "Đã hoàn thành khóa — xem kết quả",
        text: "Xem kết quả",
        href: "../dashboard/",
      },
      eligible: {
        label: "Đủ điều kiện cấp GCN",
        text: "Nhận chứng nhận",
        href: null,
      },
      issued: {
        label: "Bạn đã có giấy chứng nhận",
        text: "Xem chứng nhận",
        href: "../chung-nhan/",
      },
    };

    const cfg = map[state] || map["signed-out"];
    let href = cfg.href;
    if (state === "eligible") {
      const boot = bootJson();
      href =
        "../chung-nhan/mua.html?course=" +
        encodeURIComponent(boot.code || "");
    }

    if (bar) bar.hidden = false;
    if (label) label.textContent = cfg.label;
    if (btn) {
      btn.textContent = cfg.text;
      btn.setAttribute("href", href);
    }
    if (heroCta) {
      heroCta.textContent = cfg.text;
      heroCta.setAttribute("href", href);
    }
    if (navCta && !document.documentElement.classList.contains("sa247-staff")) {
      navCta.textContent = cfg.text;
      navCta.setAttribute("href", href);
    }
  }

  async function resolveState(boot) {
    let priceLabel = money(boot.price) || boot.price_label || "69.000đ";

    if (window.sa247Auth?.ready) {
      try {
        const sb = await sa247Auth.ensureClient();
        if (boot.code) {
          const { data: course } = await sb
            .from("courses")
            .select("id,price")
            .eq("code", boot.code)
            .maybeSingle();
          if (course?.price != null) priceLabel = money(course.price);
          window.__sa247CoursePrice = priceLabel;

          const session = await sa247Auth.getSession();
          if (!session) {
            applyCta("signed-out", priceLabel);
            return { state: "signed-out", priceLabel, course };
          }
          if (!course) {
            applyCta("signed-in-locked", priceLabel);
            return { state: "signed-in-locked", priceLabel };
          }
          const ok = await sa247Auth.hasCourseAccess(course.id);
          if (!ok) {
            applyCta("signed-in-locked", priceLabel);
            return { state: "signed-in-locked", priceLabel, course };
          }

          // Cert lifecycle
          let certStatus = null;
          try {
            const { data: certs } = await sb.rpc("list_my_certificates");
            const hit = (certs || []).find((c) => c.course_code === boot.code);
            certStatus = hit?.status || null;
          } catch {
            /* ignore */
          }
          if (certStatus === "issued" || certStatus === "valid") {
            applyCta("issued", priceLabel);
            return { state: "issued", priceLabel, course };
          }
          if (certStatus === "eligible") {
            applyCta("eligible", priceLabel);
            return { state: "eligible", priceLabel, course };
          }

          // Completed curriculum?
          let completed = false;
          try {
            const { data: outline } = await sb.rpc("get_course_outline", {
              p_course_code: boot.code,
            });
            const lessons = outline?.lessons || outline?.modules || [];
            // outline shape varies — if progress says 100%
            const prog = window.__sa247Progress;
            if (prog?.percent >= 100) completed = true;
            if (outline?.completed === true) completed = true;
            void lessons;
          } catch {
            /* ignore */
          }
          if (completed) {
            applyCta("completed", priceLabel);
            return { state: "completed", priceLabel, course };
          }

          applyCta("enrolled", priceLabel);
          return { state: "enrolled", priceLabel, course };
        }
      } catch (e) {
        console.warn("[course-page]", e);
      }
    }

    applyCta("signed-out", priceLabel);
    return { state: "signed-out", priceLabel };
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
        <div class="curriculum-acc__body"><p>Chương ${id}: ${name}. Xem chi tiết bài trong <a href="#learner-root">Lớp học</a>.</p></div>`;
      wrap.appendChild(d);
    });
    board.replaceWith(wrap);
  }

  function paintLiveCurriculum(detail) {
    const host = document.getElementById("live-curriculum");
    if (!host || !detail) return;
    host.hidden = false;
    host.innerHTML = `<p class="lead">Mục lục từ hệ thống: <strong>${detail.moduleCount || 0}</strong> chương · <strong>${detail.lessonCount || 0}</strong> bài · <strong>${detail.freeCount || 0}</strong> học thử.</p>
      <p class="meta">Sau khi đăng ký khóa học bạn xem được toàn bộ bài — không khóa từng video.</p>`;
  }

  function paintTrust(boot) {
    const host = document.getElementById("course-trust");
    if (!host) return;
    const items = boot.deliverables || [];
    if (!items.length) {
      host.innerHTML = `<ul class="trust-list">
        <li>Đăng ký 69.000đ → học toàn bộ khóa</li>
        <li>Không khóa từng video · tiến độ trên hệ thống</li>
        <li>Kiểm tra cuối khóa · GCN tùy chọn sau khi đạt</li>
        <li><a href="../verify/">Xác minh chứng nhận công khai</a></li>
      </ul>`;
      return;
    }
    host.innerHTML =
      '<ul class="trust-list">' +
      items
        .slice(0, 6)
        .map((d) => `<li>${typeof d === "string" ? d : d.title || d.body || ""}</li>`)
        .join("") +
      '<li><a href="../verify/">Xác minh chứng nhận</a></li></ul>';
  }

  document.addEventListener("DOMContentLoaded", () => {
    const boot = bootJson();
    paintHeroMeta(null, boot, boot.price_label || "69.000đ");
    paintTrust(boot);
    enhanceCurriculumAccordion();
    resolveState(boot).then((r) => {
      paintHeroMeta(null, boot, r.priceLabel);
    });
  });

  window.addEventListener("sa247:classroom-ready", (ev) => {
    const boot = bootJson();
    const price = window.__sa247CoursePrice || boot.price_label || "69.000đ";
    paintHeroMeta(ev.detail, boot, price);
    paintLiveCurriculum(ev.detail);
    resolveState(boot);
  });

  window.addEventListener("sa247:progress", (ev) => {
    if (ev.detail) window.__sa247Progress = ev.detail;
    resolveState(bootJson());
  });
})();
