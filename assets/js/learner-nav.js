/* SA247 · Nav học viên theo IA Platform (docs/SA247-PLATFORM-IA.md) */
(function () {
  const ITEMS = [
    { key: "hoc-tap", href: "../dashboard/", label: "Học tập" },
    { key: "khoa-cua-toi", href: "../khoa-cua-toi/", label: "Khóa học của tôi" },
    { key: "lo-trinh", href: "../lo-trinh/", label: "Lộ trình của tôi" },
    { key: "tien-do", href: "../tien-do/", label: "Tiến độ" },
    { key: "kiem-tra", href: "../kiem-tra/", label: "Kiểm tra & kết quả" },
    { key: "chung-nhan", href: "../chung-nhan/", label: "Chứng nhận" },
    { key: "don-hang", href: "../don-hang/", label: "Đơn hàng & thanh toán" },
    { key: "ho-so", href: "../ho-so/", label: "Hồ sơ" },
    { key: "cai-dat", href: "../cai-dat/", label: "Cài đặt" },
  ];

  function activeKeyFromPath() {
    const p = location.pathname.replace(/\\/g, "/").toLowerCase();
    if (p.includes("/khoa-cua-toi")) return "khoa-cua-toi";
    if (p.includes("/lo-trinh")) return "lo-trinh";
    if (p.includes("/tien-do") && !p.includes("/admin/")) return "tien-do";
    if (p.includes("/kiem-tra") || p.includes("/quiz/")) return "kiem-tra";
    if (p.includes("/chung-nhan")) return "chung-nhan";
    if (p.includes("/don-hang") && !p.includes("/admin/")) return "don-hang";
    if (p.includes("/ho-so")) return "ho-so";
    if (p.includes("/cai-dat") || p.includes("/doi-mat-khau")) return "cai-dat";
    if (p.includes("/dashboard") || p.includes("/hoc-tap")) return "hoc-tap";
    return "";
  }

  function paintNav(activeKey) {
    const nav = document.querySelector(".app-side__nav[data-learner-nav]");
    if (!nav) return;
    const active = activeKey || nav.getAttribute("data-active") || activeKeyFromPath();
    nav.innerHTML = ITEMS.map((it) => {
      const cls = it.key === active ? ' class="is-active"' : "";
      return `<a${cls} href="${it.href}">${it.label}</a>`;
    }).join("");
  }

  window.sa247LearnerNav = { ITEMS, paintNav, activeKeyFromPath };

  document.addEventListener("DOMContentLoaded", () => paintNav());
})();
