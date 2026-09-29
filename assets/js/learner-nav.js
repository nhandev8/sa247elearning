/* SA247 · Nav học viên theo IA Platform (docs/SA247-PLATFORM-IA.md) */
(function () {
  const ITEMS = [
    { key: "hoc-tap", href: "../dashboard/", label: "Học tập", group: "learn", tab: "Học", icon: "▶" },
    { key: "khoa-cua-toi", href: "../khoa-cua-toi/", label: "Khóa học của tôi", group: "learn", tab: "Khóa", icon: "▦" },
    { key: "kiem-tra", href: "../kiem-tra/", label: "Kiểm tra & kết quả", group: "learn", tab: "Kết quả", icon: "✎" },
    { key: "chung-nhan", href: "../chung-nhan/", label: "Giấy chứng nhận", group: "learn" },
    { key: "tien-do", href: "../tien-do/", label: "Tiến độ", group: "track" },
    { key: "lo-trinh", href: "../lo-trinh/", label: "Lộ trình của tôi", group: "track" },
    { key: "ho-so", href: "../ho-so/", label: "Hồ sơ", group: "account", tab: "Tôi", icon: "●" },
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
    "chung-nhan": "kiem-tra",
    "ho-so": "ho-so",
    "don-hang": "ho-so",
    "phan-hoi": "ho-so",
    "cai-dat": "ho-so",
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
    if (p.includes("/dashboard") || p.includes("/hoc-tap")) return "hoc-tap";
    return "";
  }

  function paintNav(activeKey) {
    const nav = document.querySelector(".app-side__nav[data-learner-nav]");
    if (!nav) return;
    const active = activeKey || nav.getAttribute("data-active") || activeKeyFromPath();
    nav.innerHTML = GROUPS.map(([g, title]) => {
      const links = ITEMS.filter((it) => it.group === g)
        .map((it) => `<a${it.key === active ? ' class="is-active" aria-current="page"' : ""} href="${it.href}">${it.label}</a>`)
        .join("");
      return `<p class="app-side__group">${title}</p>${links}`;
    }).join("");
    paintTabbar(active);
  }

  /* Mobile: 4 tab cố định — Học · Khóa · Kết quả · Tôi */
  function paintTabbar(active) {
    if (!document.body.classList.contains("app-body")) return;
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
          `<a href="${it.href}"${it.key === onTab ? ' class="is-active" aria-current="page"' : ""}><span aria-hidden="true">${it.icon}</span>${it.tab}</a>`
      )
      .join("");
  }

  window.sa247LearnerNav = { ITEMS, paintNav, activeKeyFromPath };

  document.addEventListener("DOMContentLoaded", () => paintNav());
})();
