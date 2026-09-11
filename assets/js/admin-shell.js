/* Khung menu quản trị SA247 (tiếng Việt) */
(function () {
  function depthFromAdmin() {
    const path = location.pathname.replace(/\\/g, "/");
    const idx = path.lastIndexOf("/admin/");
    if (idx < 0) return 0;
    const rest = path.slice(idx + "/admin/".length);
    if (!rest || rest === "index.html") return 0;
    // khoa-hoc/ or khoa-hoc/index.html → 1
    return rest.split("/").filter((p) => p && p !== "index.html").length;
  }

  function hrefFor(target) {
    // target: '' | 'khoa-hoc/' | 'tai-khoan/' ...
    const d = depthFromAdmin();
    const prefix = d === 0 ? "./" : "../".repeat(d);
    if (!target) return prefix;
    return prefix + target;
  }

  const MENU = [
    {
      group: "Bảng điều khiển",
      items: [{ target: "", label: "Tổng quan", key: "home" }],
    },
    {
      group: "Quản lý khóa học",
      items: [
        { target: "khoa-hoc/", label: "Tất cả khóa học", key: "khoa-hoc" },
        { target: "tien-do/", label: "Tiến độ học tập", key: "tien-do" },
        { label: "Ngân hàng câu hỏi", soon: true },
        { label: "Bài kiểm tra", soon: true },
        { label: "Chứng nhận", soon: true },
      ],
    },
    {
      group: "Quản lý tài khoản",
      items: [
        { target: "tai-khoan/", label: "Tất cả tài khoản", key: "tai-khoan" },
        { target: "quyen-hoc/", label: "Quyền học", key: "quyen-hoc" },
        { target: "don-hang/", label: "Đơn hàng", key: "don-hang" },
        { label: "Nhật ký hoạt động", soon: true },
      ],
    },
    {
      group: "Thư viện & công cụ",
      items: [
        { label: "Thư viện HSE", soon: true },
        { label: "Công cụ HSE", soon: true },
        { label: "Thống kê", soon: true },
      ],
    },
    {
      group: "Cài đặt",
      items: [
        { label: "Thông tin hệ thống", soon: true },
        { label: "Phân quyền", soon: true },
      ],
    },
  ];

  function activeKey() {
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/khoa-hoc")) return "khoa-hoc";
    if (path.includes("/tien-do")) return "tien-do";
    if (path.includes("/tai-khoan")) return "tai-khoan";
    if (path.includes("/quyen-hoc")) return "quyen-hoc";
    if (path.includes("/don-hang")) return "don-hang";
    return "home";
  }

  function renderNav() {
    const key = activeKey();
    return MENU.map((g) => {
      const links = g.items
        .map((it) => {
          if (it.soon) {
            return `<a class="is-soon" href="#">${it.label} <small>(sắp có)</small></a>`;
          }
          const active = it.key === key ? "is-active" : "";
          return `<a class="${active}" href="${hrefFor(it.target)}">${it.label}</a>`;
        })
        .join("");
      return `<div class="adm-nav__group">${g.group}</div>${links}`;
    }).join("");
  }

  async function boot(pageTitle) {
    const side = document.getElementById("adm-side-nav");
    if (side) side.innerHTML = renderNav();

    document.getElementById("adm-menu-toggle")?.addEventListener("click", () => {
      document.querySelector(".adm-shell")?.classList.toggle("is-open");
    });

    const ctx = await sa247Admin.requireAdmin();
    if (!ctx) return null;
    const label = document.getElementById("adm-user");
    if (label) {
      label.textContent =
        (ctx.profile.full_name || "Quản trị viên") +
        " · " +
        (ctx.session.user.email || "");
    }
    document.getElementById("adm-logout")?.addEventListener("click", async () => {
      await sa247Auth.signOut();
      const d = depthFromAdmin();
      location.href = new URL("../".repeat(d + 1) + "index.html", location.href).href;
    });
    if (pageTitle) {
      const h = document.querySelector(".adm-top h1");
      if (h) h.textContent = pageTitle;
    }
    return ctx;
  }

  window.sa247AdminShell = { boot, hrefFor };
})();
