/**
 * SA247 marketing navigation — 5 content items + CTA + account.
 * Mounts into #nav. Public: no Xác minh / Học tập / Quản trị / Đăng ký.
 * Mobile drawer: visitor menu vs learner menu, switched by html.sa247-signed-in (app-shell.js).
 */
(function () {
  function rootPrefix() {
    const parts = location.pathname.split("/").filter(Boolean);
    const base = parts.indexOf("sa247elearning");
    const after = base >= 0 ? parts.slice(base + 1) : parts;
    const segs = after.slice();
    if (segs.length && /\.[a-z0-9]+$/i.test(segs[segs.length - 1])) segs.pop();
    return segs.length ? "../".repeat(segs.length) : "";
  }

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v == null || v === false) return;
        if (k === "className") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      });
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  function megaCol(title, links, r) {
    return h("div", { className: "mega__col" }, [
      h("p", { className: "mega__label", text: title }),
      h(
        "ul",
        { className: "mega__list" },
        links.map(([href, label, sub]) =>
          h("li", null, [
            h("a", { href: r + href }, [
              h("strong", { text: label }),
              sub ? h("span", { text: sub }) : null,
            ]),
          ])
        )
      ),
    ]);
  }

  function buildMegaCourses(r) {
    return h("div", { className: "mega mega--wide", role: "region", "aria-label": "Khóa học" }, [
      megaCol("ATVSLĐ", [
        ["atnm-01/", "ATNM-01", "Sống sót 6 tháng đầu nghề ATVSLĐ nhà máy"],
        ["atnm-02/", "ATNM-02", "Quản lý ATVSLĐ nhà máy"],
      ], r),
      megaCol("An toàn xây dựng", [
        ["atxd-01/", "ATXD-01", "Sống sót 6 tháng đầu nghề ATVSLĐ công trường"],
        ["atxd-02/", "ATXD-02", "Quản lý ATVSLĐ công trường xây dựng"],
      ], r),
      megaCol("Kỹ thuật & nghiệp vụ", [
        ["ktn-01/", "KTN-01", "Thiết bị nâng"],
        ["cvnh-01/", "CVNH-01", "Công việc nguy hiểm"],
        ["al-01/", "AL-01", "Thiết bị áp lực"],
      ], r),
      megaCol("Hệ thống quản lý", [
        ["iso45001/", "ISO 45001", "Hệ thống quản lý OHS"],
        ["iso9001/", "ISO 9001", "Hệ thống quản lý QMS"],
      ], r),
      h("div", { className: "mega__foot mega__foot--cta" }, [
        h("p", {
          className: "mega__prompt",
          html: '<span data-sa247-course-count>9</span> khóa học · Từ <span data-sa247-price="course_default">99.000đ</span>',
        }),
        h("a", { href: r + "index.html#chuong-trinh", className: "btn btn--amber mega__cta-btn", text: "Xem tất cả khóa học" }),
      ]),
    ]);
  }

  function buildMegaPath(r) {
    return h("div", { className: "mega", role: "region", "aria-label": "Lộ trình HSE" }, [
      megaCol("Bắt đầu nghề", [
        ["index.html#career-map", "Mới vào nghề HSE", null],
        ["atnm-02/", "HSE nhà máy", null],
      ], r),
      megaCol("An toàn xây dựng", [
        ["atxd-01/", "HSE công trường", null],
        ["atxd-02/", "Trưởng / phụ trách HSE", null],
      ], r),
      megaCol("Kỹ thuật", [
        ["ktn-01/", "Thiết bị nâng", null],
        ["al-01/", "Thiết bị áp lực", null],
        ["cvnh-01/", "Công việc nguy hiểm", null],
      ], r),
      megaCol("Hệ thống", [
        ["iso45001/", "ISO 45001", null],
        ["iso9001/", "ISO 9001", null],
      ], r),
      h("div", { className: "mega__foot mega__foot--cta" }, [
        h("p", { className: "mega__prompt", text: "Bạn đang ở đâu trong nghề HSE?" }),
        h("a", { href: r + "tim-khoa/", className: "btn btn--amber mega__cta-btn", text: "Tìm lộ trình cho tôi" }),
      ]),
    ]);
  }

  function buildMegaBook(r) {
    return h("div", { className: "mega", role: "region", "aria-label": "Sách HSE" }, [
      h("div", { className: "mega__col mega__col--hero" }, [
        h("p", { className: "mega__label", text: "HSE Digital Transformation" }),
        h("p", { className: "mega__prompt", style: "margin:0 0 .65rem", text: "Đọc miễn phí toàn bộ" }),
        h("ul", { className: "mega__list" }, [
          h("li", null, [h("a", { href: r + "sach/hse-digital-transformation/", html: "<strong>Trang sách</strong>" })]),
          h("li", null, [h("a", { href: r + "sach/hse-digital-transformation/bia.html", html: "<strong>Trang bìa</strong>" })]),
          h("li", null, [h("a", { href: r + "sach/hse-digital-transformation/muc-luc.html", html: "<strong>Mục lục</strong>" })]),
        ]),
      ]),
      megaCol("Đọc sách", [
        ["sach/hse-digital-transformation/loi-cam-on.html", "Lời cảm ơn", null],
        ["sach/hse-digital-transformation/loi-noi-dau.html", "Lời nói đầu", null],
        ["sach/hse-digital-transformation/mo-dau.html", "Mở đầu sách", null],
        ["sach/hse-digital-transformation/chuong-01.html", "Chương 01", null],
      ], r),
      megaCol("Khám phá", [
        ["sach/hse-digital-transformation/muc-luc.html", "Toàn bộ mục lục", null],
        ["sach/hse-digital-transformation/chuong-05.html", "Framework / dữ liệu", null],
        ["tim-khoa/", "Tìm khóa phù hợp", null],
      ], r),
      h("div", { className: "mega__foot mega__foot--cta" }, [
        h("p", { className: "mega__prompt", text: "Từ trang bìa đến 23 chương — đọc online" }),
        h("a", { href: r + "sach/hse-digital-transformation/bia.html", className: "btn btn--amber mega__cta-btn", text: "Bắt đầu đọc" }),
      ]),
    ]);
  }

  function buildMegaKnowledge(r) {
    return h("div", { className: "mega", role: "region", "aria-label": "Kiến thức" }, [
      megaCol("Kiến thức miễn phí", [
        ["kien-thuc/", "Bài viết HSE", null],
        ["kien-thuc/#tinh-huong", "Tình huống thực tế", null],
        ["kien-thuc/#checklist", "Checklist", null],
        ["kien-thuc/", "Hướng dẫn nghiệp vụ", null],
      ], r),
      megaCol("Theo công việc", [
        ["kien-thuc/?q=nha-may", "HSE nhà máy", null],
        ["kien-thuc/?q=cong-truong", "HSE công trường", null],
        ["kien-thuc/?q=thiet-bi", "Thiết bị", null],
        ["kien-thuc/?q=nguy-hiem", "Công việc nguy hiểm", null],
        ["kien-thuc/?q=iso", "ISO", null],
      ], r),
      megaCol("Tài nguyên", [
        ["sach/hse-digital-transformation/", "Framework", null],
        ["kien-thuc/#checklist", "Biểu mẫu", null],
        ["campus/", "SA247 Campus (sinh viên)", null],
        ["sach/hse-digital-transformation/", "Công cụ HSE", null],
      ], r),
      h("div", { className: "mega__foot" }, [
        h("a", { href: r + "kien-thuc/", className: "mega__all", text: "→ Xem toàn bộ kiến thức" }),
      ]),
    ]);
  }

  function buildMegaAbout(r) {
    return h("div", { className: "mega mega--slim", role: "region", "aria-label": "Về SA247" }, [
      h("ul", { className: "mega__list mega__list--flat" }, [
        h("li", null, [h("a", { href: r + "ve-sa247/#sa247-la-ai", text: "SA247 là gì?" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#su-menh", text: "Sứ mệnh" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#triet-ly", text: "Triết lý đào tạo" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#cam-ket", text: "Phương pháp học" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#chuyen-gia", text: "Chuyên gia SA247" })]),
        h("li", null, [h("a", { href: r + "hop-tac/", text: "Hợp tác doanh nghiệp & tổ chức" })]),
        h("li", null, [h("a", { href: r + "cam-ket-du-lieu/", text: "Cam kết dữ liệu" })]),
        h("li", null, [h("a", { href: r + "sach/hse-digital-transformation/", text: "HSE Digital Transformation" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#faq", text: "Câu hỏi thường gặp" })]),
        h("li", null, [h("a", { href: r + "index.html#tu-van", text: "Liên hệ" })]),
      ]),
    ]);
  }

  function closeAllMegas(except) {
    document.querySelectorAll(".nav-item").forEach((n) => {
      if (except && n === except) return;
      n.classList.remove("is-open");
      const t = n.querySelector(".nav-item__trigger");
      const p = n.querySelector(".mega");
      if (t) t.setAttribute("aria-expanded", "false");
      if (p) {
        p.hidden = true;
        p.setAttribute("hidden", "");
      }
    });
  }

  function item(label, href, megaBuilder, r) {
    const wrap = h("div", { className: "nav-item" });
    if (!megaBuilder) {
      wrap.appendChild(h("a", { className: "nav-item__trigger", href: r + href }, [label]));
      return wrap;
    }
    const btn = h("a", {
      className: "nav-item__trigger",
      href: r + href,
      "aria-haspopup": "true",
      "aria-expanded": "false",
    }, [label]);
    const panel = megaBuilder(r);
    panel.hidden = true;
    panel.setAttribute("hidden", "");
    wrap.appendChild(btn);
    wrap.appendChild(panel);

    let closeTimer;
    const open = () => {
      clearTimeout(closeTimer);
      closeAllMegas(wrap);
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      panel.hidden = false;
      panel.removeAttribute("hidden");
    };
    const close = () => {
      closeTimer = setTimeout(() => {
        wrap.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        panel.hidden = true;
        panel.setAttribute("hidden", "");
      }, 80);
    };
    wrap.addEventListener("mouseenter", open);
    wrap.addEventListener("mouseleave", close);
    wrap.addEventListener("focusin", open);
    wrap.addEventListener("focusout", (e) => {
      if (!wrap.contains(e.relatedTarget)) close();
    });
    btn.addEventListener("click", (e) => {
      if (window.matchMedia("(min-width: 960px)").matches && panel.hidden) {
        e.preventDefault();
        open();
      }
    });
    return wrap;
  }

  function buildLearnMenu(r) {
    return h("div", { className: "acct-menu", "data-nav-learn-menu": "", hidden: true }, [
      h("p", { className: "acct-menu__label", text: "Trung tâm học tập" }),
      h("a", { href: r + "dashboard/", text: "Tiếp tục học" }),
      h("a", { href: r + "khoa-cua-toi/", text: "Khóa học của tôi" }),
      h("a", { href: r + "lo-trinh/", text: "Lộ trình của tôi" }),
      h("a", { href: r + "tien-do/", text: "Tiến độ" }),
      h("a", { href: r + "kiem-tra/", text: "Kiểm tra & kết quả" }),
      h("a", { href: r + "chung-nhan/", text: "Chứng nhận" }),
      h("a", { href: r + "don-hang/", text: "Đơn hàng" }),
    ]);
  }

  function buildAccountMenu(r) {
    return h("div", { className: "acct-menu", "data-nav-account-menu": "", hidden: true }, [
      h("a", { href: r + "ho-so/", text: "Hồ sơ" }),
      h("a", { href: r + "cai-dat/", text: "Cài đặt" }),
      h("a", { href: r + "xac-minh/", text: "Xác minh chứng nhận" }),
      h("a", { href: r + "admin/", "data-nav-admin": "", hidden: true, text: "Quản trị" }),
      h("button", {
        type: "button",
        className: "acct-menu__btn",
        "data-nav-logout": "",
        "data-home": r + "index.html",
        hidden: true,
        text: "Đăng xuất",
      }),
    ]);
  }

  function drawerLinks(links, r, label) {
    return h(
      "nav",
      { className: "nav-drawer__nav", "aria-label": label },
      links.map(([t, href]) => h("a", { href: r + href, className: "nav-drawer__link", text: t }))
    );
  }

  /* Visitor: "SA247 có khóa gì phù hợp với tôi?" */
  function buildGuestDrawer(r) {
    return h("div", { className: "nav-drawer__guest" }, [
      drawerLinks([
        ["Trang chủ", "index.html"],
        ["Khóa học", "index.html#chuong-trinh"],
        ["Lộ trình HSE", "index.html#career-map"],
        ["Kiến thức", "kien-thuc/"],
        ["Chứng nhận", "xac-minh/"],
        ["Nhà trường", "campus/"],
        ["Hỗ trợ", "ve-sa247/#faq"],
      ], r, "Khám phá SA247"),
      h("div", { className: "nav-drawer__actions" }, [
        h("a", { href: r + "index.html#chuong-trinh", className: "nav-drawer__cta", text: "Xem khóa học" }),
        h("a", { href: r + "auth/login.html", className: "nav-drawer__cta nav-drawer__cta--line", "data-nav-login-mobile": "", text: "Đăng nhập" }),
      ]),
      h("p", { className: "nav-drawer__minor" }, [
        h("a", { href: r + "sach/hse-digital-transformation/", text: "Sách HSE miễn phí" }),
        " · ",
        h("a", { href: r + "ve-sa247/", text: "Về SA247" }),
      ]),
    ]);
  }

  /* Learner: "Tôi đang học đến đâu và tiếp tục ở đâu?" */
  function buildLearnerDrawer(r) {
    const logout = h("button", { type: "button", className: "nav-drawer__logout", text: "Đăng xuất" });
    logout.addEventListener("click", () => {
      document.querySelector("[data-nav-logout]")?.click();
    });
    return h("div", { className: "nav-drawer__learner" }, [
      h("div", { className: "nav-resume", "data-nav-resume": "" }, [
        h("p", { className: "nav-resume__hello", "data-nav-resume-hello": "", text: "Xin chào" }),
        h("p", { className: "nav-resume__label", text: "Tiếp tục học" }),
        h("p", { className: "nav-resume__title", "data-nav-resume-title": "", text: "Khóa học của bạn" }),
        h("div", { className: "nav-resume__bar", "data-nav-resume-bar": "", hidden: true }, [
          h("span", { "data-nav-resume-fill": "" }),
        ]),
        h("p", { className: "nav-resume__meta", "data-nav-resume-meta": "", hidden: true }),
        h("a", { href: r + "dashboard/", className: "nav-drawer__cta", "data-nav-resume-cta": "", text: "Tiếp tục học" }),
      ]),
      drawerLinks([
        ["Học tập", "dashboard/"],
        ["Khóa học của tôi", "khoa-cua-toi/"],
        ["Tiến độ", "tien-do/"],
        ["Kiểm tra", "kiem-tra/"],
        ["Chứng nhận", "chung-nhan/"],
        ["Tài khoản", "ho-so/"],
      ], r, "Học tập"),
      h("p", { className: "nav-drawer__minor" }, [
        h("a", { href: r + "don-hang/", text: "Đơn hàng" }),
        " · ",
        h("a", { href: r + "index.html#chuong-trinh", text: "Khám phá khóa học" }),
        h("span", { className: "nav-drawer__staff" }, [" · ", h("a", { href: r + "admin/", text: "Quản trị" })]),
      ]),
      logout,
    ]);
  }

  function buildMobileDrawer(r) {
    const drawer = h("div", { className: "nav-drawer", id: "nav-drawer", hidden: true });
    drawer.appendChild(buildGuestDrawer(r));
    drawer.appendChild(buildLearnerDrawer(r));
    return drawer;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function fillResume(nav, r) {
    const card = nav.querySelector("[data-nav-resume]");
    if (!card || card.dataset.loaded === "1") return;
    if (!document.documentElement.classList.contains("sa247-signed-in")) return;
    card.dataset.loaded = "1";

    const name = nav.querySelector("[data-nav-account]")?.textContent?.trim();
    if (name && name !== "Tài khoản") card.querySelector("[data-nav-resume-hello]").textContent = "Xin chào, " + name;

    try {
      if (!window.sa247Auth?.ensureClient) return;
      if (!window.sa247Continue) await loadScriptOnce(r + "assets/js/continue-learning.js?v=20260915p0");
      const sb = await sa247Auth.ensureClient();
      const session = await sa247Auth.getSession();
      if (!session?.user?.id || !window.sa247Continue) return;
      const { primary } = await sa247Continue.loadPrimaryContinue(sb, session.user.id);
      const title = card.querySelector("[data-nav-resume-title]");
      const cta = card.querySelector("[data-nav-resume-cta]");
      if (!primary) {
        title.textContent = "Bạn chưa có khóa học nào";
        cta.textContent = "Xem khóa học";
        cta.setAttribute("href", r + "index.html#chuong-trinh");
        return;
      }
      const course = primary.course || {};
      title.textContent = course.title || course.code || "Khóa học của bạn";
      const pct = Math.max(0, Math.min(100, Math.round(Number(primary.pct) || 0)));
      const bar = card.querySelector("[data-nav-resume-bar]");
      bar.querySelector("[data-nav-resume-fill]").style.width = pct + "%";
      bar.hidden = false;
      const meta = card.querySelector("[data-nav-resume-meta]");
      meta.textContent = primary.total
        ? `${pct}% · ${primary.done}/${primary.total} bài`
        : `${pct}% hoàn thành`;
      meta.hidden = false;
      cta.textContent = sa247Continue.ctaLabels(primary.state).text;
      if (course.slug) {
        cta.setAttribute("href", r + sa247Continue.learnHref(course.slug, primary.lesson).replace(/^\.\.\//, ""));
      }
    } catch (err) {
      console.warn("[nav resume]", err);
    }
  }

  function mount() {
    const nav = document.getElementById("nav");
    if (!nav || nav.dataset.marketingMounted === "1") return;
    if (document.body.classList.contains("app-body")) return;

    const r = rootPrefix();
    nav.dataset.marketingMounted = "1";
    nav.classList.add("nav--marketing");
    if (!document.querySelector(".hero, .hub-hero, .about-hero, .hse-dt-hero, .book-hero") && !document.body.classList.contains("book-page")) {
      nav.classList.add("is-solid");
    }
    nav.innerHTML = "";

    const inner = h("div", { className: "wrap nav__inner" });

    const brand = h("a", { className: "nav__brand", href: r + "index.html" }, [
      "SA247 ",
      h("em", { text: "E-LEARNING" }),
    ]);

    const burger = h("button", {
      type: "button",
      className: "nav__burger",
      "aria-label": "Mở menu",
      "aria-controls": "nav-drawer",
      "aria-expanded": "false",
      "data-nav-burger": "",
      text: "☰",
    });

    const menu = h("div", { className: "nav__menu", "aria-label": "Điều hướng chính" }, [
      item("Lộ trình HSE", "index.html#career-map", buildMegaPath, r),
      item("Khóa học", "index.html#chuong-trinh", buildMegaCourses, r),
      item("Sách HSE", "sach/hse-digital-transformation/", buildMegaBook, r),
      item("Kiến thức", "kien-thuc/", buildMegaKnowledge, r),
      item("Campus", "campus/", null, r),
      item("Về SA247", "ve-sa247/", buildMegaAbout, r),
    ]);

    const actions = h("div", { className: "nav__actions" });
    actions.appendChild(
      h("a", {
        className: "nav__cta",
        href: r + "tim-khoa/",
        "data-sa247-event": "cta_find_course",
        text: "Tìm khóa phù hợp",
      })
    );

    const learnWrap = h("div", { className: "nav-acct", "data-nav-learn-wrap": "", hidden: true });
    learnWrap.appendChild(
      h("button", {
        type: "button",
        className: "nav__link nav__link--btn",
        "data-nav-dashboard": "",
        "aria-expanded": "false",
        text: "Học tập",
      })
    );
    learnWrap.appendChild(buildLearnMenu(r));
    actions.appendChild(learnWrap);

    const acctWrap = h("div", { className: "nav-acct", "data-nav-account-wrap": "" });
    acctWrap.appendChild(
      h("a", {
        className: "nav__link",
        "data-nav-login": "",
        href: r + "auth/login.html",
        text: "Đăng nhập",
      })
    );
    acctWrap.appendChild(
      h("button", {
        type: "button",
        className: "nav__link nav__link--btn nav__avatar",
        "data-nav-account": "",
        hidden: true,
        "aria-expanded": "false",
        text: "Tài khoản",
      })
    );
    acctWrap.appendChild(buildAccountMenu(r));
    actions.appendChild(acctWrap);

    // Hidden legacy hooks for app-shell compatibility (register never shown)
    actions.appendChild(
      h("a", { "data-nav-register": "", href: r + "auth/register.html", hidden: true, className: "nav__link", text: "Đăng ký" })
    );

    inner.appendChild(brand);
    inner.appendChild(burger);
    inner.appendChild(menu);
    inner.appendChild(actions);
    nav.appendChild(inner);
    nav.appendChild(buildMobileDrawer(r));

    wireDrawer(nav, r);
    wireAccountMenus(nav);
  }

  function wireDrawer(nav, r) {
    const burger = nav.querySelector("[data-nav-burger]");
    const drawer = nav.querySelector("#nav-drawer");
    if (!burger || !drawer) return;
    burger.addEventListener("click", () => {
      const open = drawer.hidden;
      drawer.hidden = !open;
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
      burger.textContent = open ? "✕" : "☰";
      document.body.classList.toggle("nav-drawer-open", open);
      if (open) fillResume(nav, r);
    });
    drawer.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        drawer.hidden = true;
        burger.setAttribute("aria-expanded", "false");
        burger.textContent = "☰";
        document.body.classList.remove("nav-drawer-open");
      });
    });
  }

  function wireAccountMenus(nav) {
    function toggle(wrap, btnSel, menuSel) {
      const wrapEl = nav.querySelector(wrap);
      if (!wrapEl) return;
      const btn = wrapEl.querySelector(btnSel);
      const menu = wrapEl.querySelector(menuSel);
      if (!btn || !menu) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = menu.hidden;
        nav.querySelectorAll(".acct-menu").forEach((m) => {
          m.hidden = true;
        });
        nav.querySelectorAll("[aria-expanded='true']").forEach((b) => {
          if (b !== btn && (b.matches("[data-nav-dashboard]") || b.matches("[data-nav-account]"))) {
            b.setAttribute("aria-expanded", "false");
          }
        });
        menu.hidden = !willOpen;
        btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    }
    toggle("[data-nav-learn-wrap]", "[data-nav-dashboard]", "[data-nav-learn-menu]");
    toggle("[data-nav-account-wrap]", "[data-nav-account]", "[data-nav-account-menu]");
    document.addEventListener("click", (e) => {
      if (nav.contains(e.target)) return;
      nav.querySelectorAll(".acct-menu").forEach((m) => {
        m.hidden = true;
      });
    });
  }

  const COURSE_GROUP_ORDER = ["ATVSLĐ", "An toàn xây dựng", "Kỹ thuật & nghiệp vụ", "Hệ thống quản lý"];

  async function refreshCourseMenu() {
    const list = await window.sa247PublicConfig?.courses?.();
    const current = document.querySelector('#nav .mega[aria-label="Khóa học"]');
    if (!current || !list?.length) return;
    const groups = new Map();
    list.forEach((c) => {
      const g = c.category || "Khóa học khác";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push([`${c.slug}/`, c.code, c.title]);
    });
    const rank = (g) => (COURSE_GROUP_ORDER.indexOf(g) + 1) || 99;
    const r = rootPrefix();
    const foot = current.querySelector(".mega__foot");
    current.querySelectorAll(".mega__col").forEach((col) => col.remove());
    [...groups.keys()]
      .sort((a, b) => rank(a) - rank(b))
      .forEach((g) => current.insertBefore(megaCol(g, groups.get(g), r), foot));
  }

  function loadPublicConfig() {
    if (window.sa247PublicConfig) {
      window.sa247PublicConfig.hydrate();
      refreshCourseMenu();
      return;
    }
    document.addEventListener("sa247:public-config-ready", refreshCourseMenu, { once: true });
    if (document.querySelector("script[data-sa247-public-config]")) return;
    const self = document.querySelector('script[src*="marketing-nav.js"]');
    const s = document.createElement("script");
    s.src = self ? self.src.replace(/marketing-nav\.js/, "public-config.js") : rootPrefix() + "assets/js/public-config.js";
    s.defer = true;
    s.setAttribute("data-sa247-public-config", "");
    document.head.appendChild(s);
  }

  function boot() {
    mount();
    loadPublicConfig();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.sa247MountMarketingNav = mount;
})();
