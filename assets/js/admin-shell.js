/* Khung menu quản trị SA247 (tiếng Việt) */
(function () {
  function depthFromAdmin() {
    const path = location.pathname.replace(/\\/g, "/");
    const idx = path.lastIndexOf("/admin/");
    if (idx < 0) return 0;
    const rest = path.slice(idx + "/admin/".length);
    if (!rest || rest === "index.html") return 0;
    return rest.split("/").filter((p) => p && p !== "index.html").length;
  }

  function hrefFor(target, opts) {
    const d = depthFromAdmin();
    const upFromAdmin = "../".repeat(d + 1);
    if (opts?.site) return upFromAdmin + target;
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
        { target: "cau-hoi/", label: "Ngân hàng câu hỏi", key: "cau-hoi" },
        { target: "bai-kiem-tra/", label: "Bài kiểm tra", key: "bai-kiem-tra" },
        { target: "chung-nhan/", label: "Chứng nhận", key: "chung-nhan" },
      ],
    },
    {
      group: "Quản lý tài khoản",
      items: [
        { target: "tai-khoan/", label: "Tất cả tài khoản", key: "tai-khoan" },
        { target: "quyen-hoc/", label: "Quyền học", key: "quyen-hoc" },
        { target: "don-hang/", label: "Đơn hàng", key: "don-hang" },
        { target: "nhat-ky/", label: "Nhật ký hoạt động", key: "nhat-ky" },
      ],
    },
    {
      group: "Thư viện & công cụ",
      items: [
        { label: "Thư viện HSE", soon: true },
        { label: "Công cụ HSE", soon: true },
        { target: "thong-ke/", label: "Thống kê", key: "thong-ke" },
      ],
    },
    {
      group: "Cài đặt",
      items: [
        {
          target: "auth/doi-mat-khau.html",
          label: "Đổi mật khẩu",
          key: "doi-mat-khau",
          site: true,
        },
        { label: "Thông tin hệ thống", soon: true },
        { target: "phan-quyen/", label: "Phân quyền", key: "phan-quyen" },
      ],
    },
  ];

  function activeKey() {
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/doi-mat-khau")) return "doi-mat-khau";
    if (path.includes("/khoa-hoc")) return "khoa-hoc";
    if (path.includes("/tien-do")) return "tien-do";
    if (path.includes("/cau-hoi")) return "cau-hoi";
    if (path.includes("/bai-kiem-tra")) return "bai-kiem-tra";
    if (path.includes("/chung-nhan")) return "chung-nhan";
    if (path.includes("/tai-khoan")) return "tai-khoan";
    if (path.includes("/quyen-hoc")) return "quyen-hoc";
    if (path.includes("/don-hang")) return "don-hang";
    if (path.includes("/nhat-ky")) return "nhat-ky";
    if (path.includes("/thong-ke")) return "thong-ke";
    if (path.includes("/phan-quyen")) return "phan-quyen";
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
          return `<a class="${active}" href="${hrefFor(it.target, { site: it.site })}">${it.label}</a>`;
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
        sa247Admin.roleLabelVi(ctx.profile.role) +
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
