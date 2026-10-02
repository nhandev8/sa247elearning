/* SA247 · Nav học viên theo IA Platform (docs/SA247-PLATFORM-IA.md) */
(function () {
  const ITEMS = [
    { key: "hoc-tap", href: "../dashboard/", label: "Học tập", group: "learn", tab: "Học tập", icon: "▶" },
    { key: "khoa-cua-toi", href: "../khoa-cua-toi/", label: "Khóa học của tôi", group: "learn", tab: "Khóa học", icon: "▦" },
    { key: "kiem-tra", href: "../kiem-tra/", label: "Kiểm tra & kết quả", group: "learn", tab: "Kiểm tra", icon: "✎" },
    { key: "chung-nhan", href: "../chung-nhan/", label: "Giấy chứng nhận", group: "learn", tab: "Chứng nhận", icon: "★" },
    { key: "tien-do", href: "../tien-do/", label: "Tiến độ", group: "track" },
    { key: "lo-trinh", href: "../lo-trinh/", label: "Lộ trình của tôi", group: "track" },
    { key: "ho-so", href: "../ho-so/", label: "Hồ sơ", group: "account", tab: "Tài khoản", icon: "●" },
    { key: "don-hang", href: "../don-hang/", label: "Đơn hàng & thanh toán", group: "account" },
    { key: "phan-hoi", href: "../phan-hoi/", label: "Phản hồi & Hỗ trợ", group: "account" },
    { key: "cai-dat", href: "../cai-dat/", label: "Cài đặt", group: "account" },
  ];

  const GROUPS = [
    ["learn", "Học tập"],
    ["track", "Theo dõi"],
    ["account", "Tài khoản"],
  ];

  /* Tab mobile đang sáng cho từng trang */
  const TAB_OF = {
    "hoc-tap": "hoc-tap",
    "tien-do": "hoc-tap",
    "lo-trinh": "hoc-tap",
    "khoa-cua-toi": "khoa-cua-toi",
    "kiem-tra": "kiem-tra",
    "chung-nhan": "chung-nhan",
    "ho-so": "ho-so",
    "don-hang": "ho-so",
    "phan-hoi": "ho-so",
    "cai-dat": "ho-so",
  };

  const svg = (d) =>
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    "hoc-tap": svg('<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none"/>'),
    "khoa-cua-toi": svg('<path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-5A1.5 1.5 0 0 1 3 16z"/><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h5a1.5 1.5 0 0 0 1.5-1.5z"/>'),
    "kiem-tra": svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m9 13 2 2 4-4"/>'),
    "chung-nhan": svg('<circle cx="12" cy="9" r="5.5"/><path d="m8.8 13.4-1.3 7.1L12 18l4.5 2.5-1.3-7.1"/>'),
    "ho-so": svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  };

  function activeKeyFromPath() {
    const p = location.pathname.replace(/\\/g, "/").toLowerCase();
    if (p.includes("/khoa-cua-toi")) return "khoa-cua-toi";
    if (p.includes("/lo-trinh")) return "lo-trinh";
    if (p.includes("/tien-do") && !p.includes("/admin/")) return "tien-do";
    if (p.includes("/kiem-tra") || p.includes("/quiz/")) return "kiem-tra";
    if (p.includes("/chung-nhan")) return "chung-nhan";
    if (p.includes("/don-hang") && !p.includes("/admin/")) return "don-hang";
    if (p.includes("/phan-hoi")) return "phan-hoi";
    if (p.includes("/ho-so")) return "ho-so";
    if (p.includes("/cai-dat") || p.includes("/doi-mat-khau")) return "cai-dat";
    if (p.includes("/dashboard") || p.includes("/hoc-tap") || p.includes("/hoc/")) return "hoc-tap";
    return "";
  }

  function paintNav(activeKey) {
    const nav = document.querySelector(".app-side__nav[data-learner-nav]");
    if (!nav) {
      paintTabbar(activeKey || activeKeyFromPath());
      return;
    }
    const active = activeKey || nav.getAttribute("data-active") || activeKeyFromPath();
    nav.innerHTML = GROUPS.map(([g, title]) => {
      const links = ITEMS.filter((it) => it.group === g)
        .map((it) => `<a${it.key === active ? ' class="is-active" aria-current="page"' : ""} href="${it.href}">${it.label}</a>`)
        .join("");
      return `<p class="app-side__group">${title}</p>${links}`;
    }).join("");
    paintOrgLink(orgUnits);
    paintTabbar(active);
  }

  /* Mobile: 5 tab cố định — Học tập · Khóa học · Kiểm tra · Chứng nhận · Tài khoản */
  function paintTabbar(active) {
    const b = document.body.classList;
    if (!b.contains("app-body") && !b.contains("lx-body")) return;
    let bar = document.querySelector(".app-tabbar");
    if (!bar) {
      bar = document.createElement("nav");
      bar.className = "app-tabbar";
      bar.setAttribute("aria-label", "Điều hướng học tập");
      document.body.appendChild(bar);
      document.body.classList.add("has-tabbar");
    }
    const onTab = TAB_OF[active] || "";
    bar.innerHTML = ITEMS.filter((it) => it.tab)
      .map(
        (it) =>
          `<a href="${it.href}"${it.key === onTab ? ' class="is-active" aria-current="page"' : ""}><span class="app-tabbar__ic" aria-hidden="true">${
            ICONS[it.key] || ""
          }</span><span class="app-tabbar__lb">${it.tab}</span></a>`
      )
      .join("");
  }

  /* Đơn vị white-label: tên/logo/màu cạnh thương hiệu; nhân sự đơn vị: lối vào cổng đơn vị */
  let orgUnits = [];

  async function paintOrg() {
    const auth = window.sa247Auth;
    if (!auth?.ready) return;
    try {
      if (!(await auth.getSession())) return;
      const sb = await auth.ensureClient();
      const [brandRes, unitsRes] = await Promise.all([sb.rpc("my_branding"), sb.rpc("org_my_units")]);
      paintOrgBrand(brandRes?.data);
      orgUnits = Array.isArray(unitsRes?.data) ? unitsRes.data : [];
      paintOrgLink(orgUnits);
    } catch (_) {
      /* branding là phụ — không chặn trang học */
    }
  }

  function paintOrgBrand(b) {
    if (!b || !b.white_label || !b.display_name) return;
    const root = document.documentElement.style;
    if (b.primary_color) root.setProperty("--org-c1", b.primary_color);
    if (b.accent_color) root.setProperty("--org-c2", b.accent_color);
    const side = document.querySelector(".app-side__brand");
    if (!side || document.querySelector(".app-side__org")) return;
    const box = document.createElement("div");
    box.className = "app-side__org";
    box.style.cssText =
      "display:flex;flex-direction:column;gap:.2rem;margin:.4rem 0 .8rem;padding:.55rem .7rem;border-radius:10px;" +
      "border-left:4px solid var(--org-c2, #c9a227);background:rgba(255,255,255,.06);font-size:.85rem;line-height:1.3";
    if (b.logo_url && /^https:\/\//.test(b.logo_url)) {
      const img = document.createElement("img");
      img.src = b.logo_url;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.style.cssText = "max-height:36px;max-width:140px;object-fit:contain;align-self:flex-start";
      box.appendChild(img);
    }
    const t = document.createElement("span");
    t.textContent = b.display_name;
    t.style.fontWeight = "700";
    box.appendChild(t);
    const note = document.createElement("small");
    note.style.opacity = ".7";
    note.textContent = "Vận hành trên nền tảng SA247";
    box.appendChild(note);
    side.after(box);
  }

  function paintOrgLink(units) {
    const nav = document.querySelector(".app-side__nav[data-learner-nav]");
    if (!units.length || !nav || nav.querySelector("[data-org-link]")) return;
    const g = document.createElement("p");
    g.className = "app-side__group";
    g.textContent = "Đơn vị";
    const a = document.createElement("a");
    a.href = "../don-vi/";
    a.dataset.orgLink = "1";
    a.textContent = units.length === 1 ? "Cổng đơn vị · " + units[0].name : "Cổng đơn vị";
    nav.append(g, a);
  }

  window.sa247LearnerNav = { ITEMS, paintNav, activeKeyFromPath };

  document.addEventListener("DOMContentLoaded", () => {
    paintNav();
    paintOrg();
  });
})();
