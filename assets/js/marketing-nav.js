/**
 * SA247 marketing navigation — 5 content items + CTA + account.
 * Mounts into #nav. Public: no Xác minh / Học tập / Quản trị / Đăng ký.
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
      h("div", { className: "mega__foot" }, [
        h("a", { href: r + "index.html#chuong-trinh", className: "mega__all", text: "→ Xem tất cả khóa học" }),
      ]),
    ]);
  }

  function buildMegaPath(r) {
    return h("div", { className: "mega", role: "region", "aria-label": "Lộ trình HSE" }, [
      megaCol("Bắt đầu nghề", [
        ["index.html#career-map", "Mới vào nghề HSE", null],
        ["atnm-02/", "HSE nhà máy", null],
      ], r),
      megaCol("HSE xây dựng", [
        ["atxd-01/", "HSE công trường", null],
        ["atxd-02/", "Trưởng / phụ trách HSE", null],
      ], r),
      megaCol("Nghiệp vụ kỹ thuật", [
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
        ["chuyen-doi-so-hse/", "Framework", null],
        ["kien-thuc/#checklist", "Biểu mẫu", null],
        ["chuyen-doi-so-hse/", "Công cụ HSE", null],
      ], r),
      h("div", { className: "mega__foot" }, [
        h("a", { href: r + "kien-thuc/", className: "mega__all", text: "→ Xem toàn bộ kiến thức" }),
      ]),
    ]);
  }

  function buildMegaHseDt(r) {
    return h("div", { className: "mega", role: "region", "aria-label": "Chuyển đổi số HSE" }, [
      megaCol("HSE Digital Transformation", [
        ["chuyen-doi-so-hse/", "Tổng quan", null],
        ["chuyen-doi-so-hse/#ban-do", "23 chương", null],
        ["chuyen-doi-so-hse/chuong-1.html", "Đọc thử", null],
      ], r),
      megaCol("Framework", [
        ["chuyen-doi-so-hse/chuong-5.html", "HSE Data", null],
        ["chuyen-doi-so-hse/chuong-8.html", "Số hóa quy trình", null],
        ["chuyen-doi-so-hse/chuong-12.html", "Dashboard & KPI", null],
        ["chuyen-doi-so-hse/chuong-23.html", "Digital HSE Roadmap", null],
      ], r),
      megaCol("Ứng dụng", [
        ["chuyen-doi-so-hse/premium.html", "Công cụ HSE", null],
        ["chuyen-doi-so-hse/", "Checklist số", null],
        ["chuyen-doi-so-hse/", "QR sự cố", null],
      ], r),
      h("div", { className: "mega__foot" }, [
        h("a", { href: r + "chuyen-doi-so-hse/", className: "mega__all", text: "→ Khám phá HSE Digital Transformation" }),
      ]),
    ]);
  }

  function buildMegaAbout(r) {
    return h("div", { className: "mega mega--slim", role: "region", "aria-label": "Về SA247" }, [
      h("ul", { className: "mega__list mega__list--flat" }, [
        h("li", null, [h("a", { href: r + "ve-sa247/#sa247-la-ai", text: "SA247 là gì?" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#triet-ly", text: "Tuyên ngôn" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#cam-ket", text: "Phương pháp đào tạo" })]),
        h("li", null, [h("a", { href: r + "ve-sa247/#sa247-la-ai", text: "Người sáng lập" })]),
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
      h("a", { href: r + "verify/", text: "Xác minh chứng nhận" }),
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

  function buildMobileDrawer(r) {
    const drawer = h("div", { className: "nav-drawer", id: "nav-drawer", hidden: true });
    const links = [
      ["Khóa học", "index.html#chuong-trinh"],
      ["Lộ trình HSE", "index.html#career-map"],
      ["Kiến thức", "kien-thuc/"],
      ["Chuyển đổi số HSE", "chuyen-doi-so-hse/"],
      ["Về SA247", "ve-sa247/"],
    ];
    const list = h(
      "nav",
      { className: "nav-drawer__nav", "aria-label": "Menu di động" },
      links.map(([t, href]) => h("a", { href: r + href, className: "nav-drawer__link", text: t }))
    );
    drawer.appendChild(list);
    drawer.appendChild(h("hr", { className: "nav-drawer__hr" }));
    drawer.appendChild(
      h("a", { href: r + "tim-khoa/", className: "nav-drawer__cta", text: "Tìm khóa phù hợp" })
    );
    drawer.appendChild(
      h("a", { href: r + "auth/login.html", className: "nav-drawer__login", "data-nav-login-mobile": "", text: "Đăng nhập" })
    );
    drawer.appendChild(
      h("a", { href: r + "dashboard/", className: "nav-drawer__login", "data-nav-learn-mobile": "", hidden: true, text: "Học tập" })
    );
    return drawer;
  }

  function mount() {
    const nav = document.getElementById("nav");
    if (!nav || nav.dataset.marketingMounted === "1") return;
    if (document.body.classList.contains("app-body")) return;

    const r = rootPrefix();
    nav.dataset.marketingMounted = "1";
    nav.classList.add("nav--marketing");
    if (!document.querySelector(".hero, .hub-hero, .about-hero, .hse-dt-hero")) {
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
      item("Khóa học", "index.html#chuong-trinh", buildMegaCourses, r),
      item("Lộ trình HSE", "index.html#career-map", buildMegaPath, r),
      item("Kiến thức", "kien-thuc/", buildMegaKnowledge, r),
      item("Chuyển đổi số HSE", "chuyen-doi-so-hse/", buildMegaHseDt, r),
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

    wireDrawer(nav);
    wireAccountMenus(nav);
  }

  function wireDrawer(nav) {
    const burger = nav.querySelector("[data-nav-burger]");
    const drawer = nav.querySelector("#nav-drawer");
    if (!burger || !drawer) return;
    burger.addEventListener("click", () => {
      const open = drawer.hidden;
      drawer.hidden = !open;
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.textContent = open ? "✕" : "☰";
      document.body.classList.toggle("nav-drawer-open", open);
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.sa247MountMarketingNav = mount;
})();
