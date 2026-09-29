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

  window.sa247LearnerNav = { ITEMS, paintNav, activeKeyFromPath };

  document.addEventListener("DOMContentLoaded", () => paintNav());
})();
