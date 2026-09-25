/* SA247 course page UX — CTA theo entitlement + trạng thái học (Tiếp tục học P0) */
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

  const SA247_COURSE_PRICE = 99000;
  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "";
    const safe = v === 69000 ? SA247_COURSE_PRICE : v;
    return safe.toLocaleString("vi-VN") + "đ";
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
    if (mods != null && mods !== "") bits.push(`${mods} mô-đun`);
    if (typeof lessons === "number") bits.push(`${lessons} video`);
    else if (lessons) bits.push(String(lessons));
    if (free) bits.push(`${free} video mở sẵn`);
    bits.push("Khóa học chính thức");
    if (priceLabel) bits.push(priceLabel);
    bits.push(statusVi);
    meta.innerHTML = bits.map((b) => `<span>${b}</span>`).join("");

    document.querySelectorAll("[data-live-price]").forEach((el) => {
      if (priceLabel) el.textContent = priceLabel;
    });
  }

  function applyCta(cfg) {
    const bar = document.getElementById("course-sticky-cta");
    const label = bar?.querySelector("[data-sticky-label]");
    const btn = bar?.querySelector("[data-sticky-btn]");
    const heroCta = document.querySelector("[data-hero-cta]");
    const navCta = document.querySelector(".nav__cta");

    if (bar) bar.hidden = false;
    if (label) label.textContent = cfg.label;
    if (btn) {
      btn.textContent = cfg.text;
      btn.setAttribute("href", cfg.href);
    }
    if (heroCta) {
      heroCta.textContent = cfg.text;
      heroCta.setAttribute("href", cfg.href);
    }
    if (navCta && !document.documentElement.classList.contains("sa247-staff")) {
      navCta.textContent = cfg.text;
      navCta.setAttribute("href", cfg.href);
    }
  }

  async function resolveState(boot) {
    let priceLabel = money(boot.price) || boot.price_label || "99.000đ";
    const slug = boot.slug || "";

    if (window.sa247Auth?.ready) {
      try {
        const sb = await sa247Auth.ensureClient();
        if (boot.code) {
          const { data: course } = await sb
            .from("courses")
            .select("id,price,slug,code,title")
            .eq("code", boot.code)
            .maybeSingle();
          if (course?.price != null) priceLabel = money(course.price);
          window.__sa247CoursePrice = priceLabel;
          const courseSlug = course?.slug || slug;

          const session = await sa247Auth.getSession();
          if (!session) {
            applyCta({
              label: `Khóa học chính thức · ${priceLabel}`,
              text: `Đăng ký học – ${priceLabel}`,
              href: "#dang-ky",
            });
            return { state: "signed-out", priceLabel, course };
          }
          const ok = await sa247Auth.hasCourseAccess(course?.id || null, {
            courseCode: boot.code || course?.code || "",
          });
          if (!ok) {
            applyCta({
              label: "Đã đăng nhập · đăng ký để học toàn bộ",
              text: `Đăng ký học – ${priceLabel}`,
              href: "#dang-ky",
            });
            return { state: "signed-in-locked", priceLabel, course };
          }

          // Đã có quyền học → ẩn khối thanh toán / mở khóa
          document.getElementById("dang-ky")?.setAttribute("hidden", "");
          document.getElementById("dang-ky")?.setAttribute("hidden", "");
          document.documentElement.classList.add("sa247-enrolled");

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
            applyCta({
              label: "Bạn đã có giấy chứng nhận",
              text: "Xem chứng nhận",
              href: "../chung-nhan/",
            });
            return { state: "issued", priceLabel, course };
          }
          if (certStatus === "eligible") {
            applyCta({
              label: "Đủ điều kiện cấp GCN",
              text: "Nhận chứng nhận",
              href:
                "../chung-nhan/mua.html?course=" +
                encodeURIComponent(boot.code || ""),
            });
            return { state: "eligible", priceLabel, course };
          }

          // Learning progress → Bắt đầu / Tiếp tục / Xem lại
          for (let i = 0; i < 40 && !window.sa247Continue; i++) {
            await new Promise((r) => setTimeout(r, 40));
          }
          if (window.sa247Continue) {
            const snap = await sa247Continue.loadCourseSnapshot(
              sb,
              session.user.id,
              {
                code: course?.code || boot.code,
                slug: courseSlug,
                title: course?.title || boot.title || boot.code,
              }
            );
            window.__sa247Progress = { percent: snap.pct, snapshot: snap };
            if (snap.state === "completed") {
              applyCta({
                label: "Đã hoàn thành khóa — xem lại hoặc làm kiểm tra",
                text: "Xem lại khóa học",
                href: `../${courseSlug}/#learner-root`,
              });
              return { state: "completed", priceLabel, course, snap };
            }
            if (snap.state === "in_progress" && snap.lesson) {
              const code = snap.lesson.lesson_code || "";
              applyCta({
                label: code
                  ? `Tiếp tục học → ${code}`
                  : "Bạn đang học — tiếp tục",
                text: "Tiếp tục học",
                href: sa247Continue.learnHref(courseSlug, snap.lesson),
              });
              return { state: "in_progress", priceLabel, course, snap };
            }
            applyCta({
              label: "Bạn đã có quyền học — bắt đầu bài đầu tiên",
              text: "Bắt đầu học",
              href: sa247Continue.learnHref(courseSlug, snap.lesson),
            });
            return { state: "not_started", priceLabel, course, snap };
          }

          applyCta({
            label: "Bạn đã có quyền học — tiếp tục học",
            text: "Tiếp tục học",
            href: "#learner-root",
          });
          return { state: "enrolled", priceLabel, course };
        }
      } catch (e) {
        console.warn("[course-page]", e);
      }
    }

    applyCta({
      label: `Khóa học chính thức · ${priceLabel}`,
      text: `Đăng ký học – ${priceLabel}`,
      href: "#dang-ky",
    });
    return { state: "signed-out", priceLabel };
  }

  function enhanceCurriculumAccordion() {
    if (document.querySelector("#lo-trinh .curriculum-acc")) return;
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
        <div class="curriculum-acc__body"><p>Mô-đun ${id}: ${name}. Xem chi tiết video Bxx trong <a href="#learner-root">Lớp học</a>.</p></div>`;
      wrap.appendChild(d);
    });
    board.replaceWith(wrap);
  }

  function paintLiveCurriculum(detail) {
    const host = document.getElementById("live-curriculum");
    if (!host || !detail) return;
    host.hidden = false;
    host.innerHTML = `<p class="lead">Mục lục từ hệ thống: <strong>${detail.moduleCount || 0}</strong> mô-đun · <strong>${detail.lessonCount || 0}</strong> video · <strong>${detail.freeCount || 0}</strong> mở sẵn (≈ 1/5, tối đa 5).</p>
      <p class="meta">Phần còn lại mở sau khi đăng ký khóa học.</p>`;
  }

  function paintTrust(boot, priceLabel) {
    const host = document.getElementById("course-trust");
    if (!host) return;
    const price = priceLabel || boot.price_label || "99.000đ";
    const items = boot.deliverables || [];
    if (!items.length) {
      host.innerHTML = `<ul class="trust-list">
        <li>Đăng ký ${price} → học toàn bộ khóa học</li>
        <li>Không khóa từng video · tiến độ trên hệ thống</li>
        <li>Kiểm tra cuối khóa học · GCN tùy chọn sau khi đạt</li>
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
    const fallback = boot.price_label || "99.000đ";
    paintHeroMeta(null, boot, fallback);
    paintTrust(boot, fallback);
    enhanceCurriculumAccordion();
    resolveState(boot).then((r) => {
      paintTrust(boot, r.priceLabel);
      if (window.__sa247CourseDetail) {
        paintHeroMeta(window.__sa247CourseDetail, boot, r.priceLabel);
        paintLiveCurriculum(window.__sa247CourseDetail);
      }
    });
    window.addEventListener("sa247:course-detail", (ev) => {
      window.__sa247CourseDetail = ev.detail;
      paintHeroMeta(ev.detail, boot, window.__sa247CoursePrice || fallback);
      paintLiveCurriculum(ev.detail);
    });
  });
})();
