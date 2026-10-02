/**
 * SA247 marketing navigation — 5 trụ cột (Học · Tri thức · Giải pháp · Đối tác · Về SA247) + CTA + account.
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

  /*
   * Public navigation v3 — 5 trụ cột (docs/SA247-PLATFORM-IA.md).
   * Chỉ hiện mục có trang thật; mục dài hạn chưa có trang thì không đưa vào đây.
   * Mỗi trụ: nhãn, href trigger, mục chính [href, tên, mô tả], mục phụ [href, tên]
   */
  const PILLARS = [
    {
      label: "Học",
      href: "index.html#chuong-trinh",
      items: [
        ["index.html#career-map", "Lộ trình HSE", "Chọn hướng phát triển phù hợp"],
        ["index.html#chuong-trinh", "Khóa học", "Học theo nhu cầu và công việc"],
      ],
      minor: [["khoa-sap-mo/", "Khóa sắp mở"]],
    },
    {
      label: "Tri thức",
      href: "kien-thuc/",
      items: [
        ["kien-thuc/", "Kiến thức HSE", "Kiến thức thực tế và chuyên môn"],
        ["sach/hse-digital-transformation/", "Sách HSE", "HSE Digital Transformation"],
      ],
      minor: [["sach/hse-digital-transformation/muc-luc.html", "Mục lục sách"]],
    },
    {
      label: "Giải pháp",
      href: "phan-mem/",
      items: [
        ["phan-mem/hse-compliance/", "HSE Compliance", "HSE Compliance – Vietnam Law Checker"],
        ["hop-tac/#mo-hinh", "Nền tảng E-Learning", "Đào tạo và quản trị học tập trực tuyến cho tổ chức"],
      ],
      minor: [["phan-mem/", "Tất cả giải pháp"]],
    },
    {
      label: "Đối tác",
      href: "hop-tac/",
      items: [
        ["campus/", "Trường học", "SA247 Campus"],
        ["hop-tac/#mo-hinh-a", "Doanh nghiệp", "Đào tạo HSE cho doanh nghiệp"],
        ["hop-tac/#mo-hinh-b", "Đơn vị đào tạo", "Nền tảng và chương trình đào tạo"],
        ["hop-tac/#khao-sat", "Hợp tác cùng SA247", "Đặt lịch khảo sát nhu cầu"],
      ],
      minor: [
        ["cam-ket-du-lieu/", "Cam kết dữ liệu"],
        ["don-vi/", "Cổng đơn vị"],
      ],
    },
    {
      label: "Về SA247",
      href: "ve-sa247/",
      items: [
        ["ve-sa247/", "Giới thiệu", "SA247 là ai, triết lý đào tạo"],
        ["ve-sa247/#su-menh", "Tầm nhìn & sứ mệnh", "Điều SA247 theo đuổi"],
        ["ve-sa247/#tu-van", "Liên hệ", "Điện thoại, email, Zalo"],
      ],
      minor: [
        ["ve-sa247/#faq", "Câu hỏi thường gặp"],
        ["xac-minh/", "Xác minh chứng nhận"],
      ],
    },
  ];

  function pillarPanel(p) {
    return (r) =>
      h("div", { className: "mega mega--pillar", role: "region", "aria-label": p.label }, [
        h(
          "ul",
          { className: "mega__list" },
          p.items.map(([href, label, sub]) =>
            h("li", null, [
              h("a", { href: r + href }, [h("strong", { text: label }), sub ? h("span", { text: sub }) : null]),
            ])
          )
        ),
        p.minor
          ? h("div", { className: "mega__foot mega__foot--pillar" }, [
              h(
                "p",
                { className: "mega__minor" },
                p.minor.flatMap(([href, label], i) => [i ? " · " : null, h("a", { href: r + href, text: label })])
              ),
            ])
          : null,
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
    wrap.addEventListener("focusin", () => {
      if (wrap.dataset.escClosed === "1") {
        delete wrap.dataset.escClosed;
        return;
      }
      open();
    });
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

  /* Visitor: cùng 5 trụ cột như desktop, dạng accordion */
  function buildGuestDrawer(r) {
    const groups = PILLARS.map((p) =>
      h("details", { className: "nav-drawer__group" }, [
        h("summary", { className: "nav-drawer__link nav-drawer__summary", text: p.label }),
        h(
          "div",
          { className: "nav-drawer__sub" },
          p.items
            .map(([href, label]) => h("a", { href: r + href, text: label }))
            .concat((p.minor || []).map(([href, label]) => h("a", { href: r + href, className: "is-minor", text: label })))
        ),
      ])
    );
    groups.forEach((d) =>
      d.addEventListener("toggle", () => {
        if (d.open) groups.forEach((o) => o !== d && (o.open = false));
      })
    );
    return h("div", { className: "nav-drawer__guest" }, [
      h("nav", { className: "nav-drawer__nav", "aria-label": "Khám phá SA247" }, [
        h("a", { href: r + "index.html", className: "nav-drawer__link", text: "Trang chủ" }),
        ...groups,
      ]),
      h("div", { className: "nav-drawer__actions" }, [
        h("a", { href: r + "tim-khoa/", className: "nav-drawer__cta", text: "Tìm khóa phù hợp" }),
        h("a", { href: r + "auth/login.html", className: "nav-drawer__cta nav-drawer__cta--line", "data-nav-login-mobile": "", text: "Đăng nhập" }),
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

    const menu = h(
      "div",
      { className: "nav__menu", "aria-label": "Điều hướng chính" },
      PILLARS.map((p) => item(p.label, p.href, pillarPanel(p), r))
    );

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
    wireMegaDismiss(nav);
  }

  function wireMegaDismiss(nav) {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const openItem = nav.querySelector(".nav-item.is-open");
      if (!openItem) return;
      closeAllMegas();
      const trigger = openItem.querySelector(".nav-item__trigger");
      if (trigger && document.activeElement !== trigger) {
        openItem.dataset.escClosed = "1";
        trigger.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest || !e.target.closest(".nav-item")) closeAllMegas();
    });
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

  function loadPublicConfig() {
    if (window.sa247PublicConfig) {
      window.sa247PublicConfig.hydrate();
      return;
    }
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
