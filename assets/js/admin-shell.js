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
    let href = prefix + target;
    const uid = opts?.userId;
    if (uid && opts?.keepUser) {
      const join = href.includes("?") ? "&" : "?";
      href += `${join}id=${encodeURIComponent(uid)}`;
    }
    return href;
  }

  function contextUserId() {
    const q = new URLSearchParams(location.search);
    return (q.get("id") || q.get("user") || "").trim();
  }

  // Người dùng = hub thao tác theo tài khoản (hồ sơ sâu). Quyền học / tiến độ gộp vào đây.
  const MENU = [
    {
      group: "Tổng quan",
      items: [{ target: "", label: "Trung tâm điều hành", key: "home" }],
      scope: "full",
    },
    {
      group: "Học viện",
      items: [{ target: "khoa-hoc/", label: "Khóa học", key: "khoa-hoc" }],
      scope: "content",
    },
    {
      group: "Người dùng",
      items: [
        { target: "tai-khoan/", label: "Tất cả người dùng", key: "tai-khoan" },
        {
          target: "tai-khoan/ho-so.html",
          label: "Hồ sơ đang xem",
          key: "ho-so",
          keepUser: true,
          needsUser: true,
        },
        { target: "quyen-hoc/", label: "Quyền học", key: "quyen-hoc", keepUser: true },
        { target: "tien-do/", label: "Tiến độ học tập", key: "tien-do", keepUser: true },
        { target: "phan-quyen/", label: "Vai trò & phân quyền", key: "phan-quyen" },
      ],
      scope: "full",
    },
    {
      group: "Đánh giá",
      items: [
        { target: "cau-hoi/", label: "Ngân hàng câu hỏi", key: "cau-hoi" },
        { target: "bai-kiem-tra/", label: "Bài kiểm tra", key: "bai-kiem-tra" },
      ],
      scope: "content",
    },
    {
      group: "Chứng nhận",
      items: [{ target: "chung-nhan/", label: "Tất cả chứng nhận", key: "chung-nhan" }],
      scope: "full",
    },
    {
      group: "Kinh doanh",
      items: [
        { target: "kinh-doanh/", label: "Hub Kinh doanh", key: "kinh-doanh" },
        { target: "don-hang/", label: "Đơn hàng", key: "don-hang" },
        { target: "gia-ship/", label: "Giá & ship", key: "gia-ship" },
        { target: "bao-cao-doanh-thu/", label: "Báo cáo doanh thu", key: "bao-cao" },
        { target: "quyen-hoc/", label: "Cấp quyền học", key: "quyen-hoc-commerce" },
      ],
      scope: "commerce",
    },
    {
      group: "Phân tích",
      items: [{ target: "thong-ke/", label: "Thống kê nền tảng", key: "thong-ke" }],
      scope: "full",
    },
    {
      group: "Hệ thống",
      items: [
        { target: "nhat-ky/", label: "Nhật ký hoạt động", key: "nhat-ky" },
        {
          target: "auth/doi-mat-khau.html",
          label: "Đổi mật khẩu",
          key: "doi-mat-khau",
          site: true,
        },
        { label: "Tích hợp (SePay / YouTube)", soon: true },
      ],
      scope: "system",
    },
  ];

  function activeKey() {
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/doi-mat-khau")) return "doi-mat-khau";
    if (path.includes("/kinh-doanh")) return "kinh-doanh";
    if (path.includes("/bao-cao-doanh-thu")) return "bao-cao";
    if (path.includes("/khoa-hoc")) return "khoa-hoc";
    if (path.includes("/tien-do")) return "tien-do";
    if (path.includes("/cau-hoi")) return "cau-hoi";
    if (path.includes("/bai-kiem-tra")) return "bai-kiem-tra";
    if (path.includes("/chung-nhan")) return "chung-nhan";
    if (path.includes("/tai-khoan/ho-so")) return "ho-so";
    if (path.includes("/tai-khoan")) return "tai-khoan";
    if (path.includes("/quyen-hoc")) return "quyen-hoc";
    if (path.includes("/don-hang")) return "don-hang";
    if (path.includes("/gia-ship")) return "gia-ship";
    if (path.includes("/nhat-ky")) return "nhat-ky";
    if (path.includes("/thong-ke")) return "thong-ke";
    if (path.includes("/phan-quyen")) return "phan-quyen";
    return "home";
  }

  function menuForRole(role) {
    const commerceOnly = window.sa247Admin?.isCommerceOnly?.(role);
    const canCommerce = window.sa247Admin?.canManageCommerce?.(role);
    const canContent = window.sa247Admin?.canManageContent?.(role);
    const fullAdmin = window.sa247Admin?.isFullAdmin?.(role);

    if (commerceOnly) {
      return MENU.filter((g) => g.scope === "commerce" || g.group === "Hệ thống").map((g) => {
        if (g.group === "Hệ thống") {
          return {
            ...g,
            items: g.items.filter((it) => it.key === "doi-mat-khau" || it.soon),
          };
        }
        return g;
      });
    }

    // Giảng viên / QL nội dung: ẩn Kinh doanh nếu không có quyền commerce
    return MENU.filter((g) => {
      if (g.scope === "commerce") return !!canCommerce;
      if (g.scope === "content") return !!canContent || !!fullAdmin;
      if (g.scope === "full") {
        if (g.group === "Người dùng") return !!fullAdmin || role === "quan_ly_noi_dung" || role === "giang_vien";
        if (g.group === "Chứng nhận" || g.group === "Phân tích") return !!fullAdmin;
        return true;
      }
      if (g.scope === "system") return true;
      return true;
    }).map((g) => {
      if (g.group === "Người dùng" && !fullAdmin) {
        return {
          ...g,
          items: g.items.filter((it) => it.key !== "phan-quyen"),
        };
      }
      if (g.group === "Hệ thống" && !fullAdmin) {
        return {
          ...g,
          items: g.items.filter((it) => it.key === "doi-mat-khau" || it.soon),
        };
      }
      return g;
    });
  }

  function pageAllowed(role, key) {
    if (!window.sa247Admin?.isCommerceOnly?.(role)) return true;
    const allowed = new Set([
      "kinh-doanh",
      "don-hang",
      "gia-ship",
      "bao-cao",
      "quyen-hoc",
      "quyen-hoc-commerce",
      "doi-mat-khau",
      "home",
    ]);
    return allowed.has(key);
  }

  function renderNav(role) {
    const key = activeKey();
    const uid = contextUserId();
    return menuForRole(role)
      .map((g) => {
        const links = g.items
          .map((it) => {
            if (it.soon) {
              return `<a class="is-soon" href="#">${it.label} <small>(sắp có)</small></a>`;
            }
            if (it.needsUser && !uid) return "";
            const active =
              it.key === key ||
              (it.key === "quyen-hoc-commerce" && key === "quyen-hoc")
                ? "is-active"
                : "";
            const href = hrefFor(it.target, {
              site: it.site,
              keepUser: it.keepUser,
              userId: uid,
            });
            return `<a class="${active}" href="${href}">${it.label}</a>`;
          })
          .join("");
        if (!links.trim()) return "";
        return `<div class="adm-nav__group">${g.group}</div>${links}`;
      })
      .join("");
  }

  async function boot(pageTitle, opts) {
    const side = document.getElementById("adm-side-nav");

    document.getElementById("adm-menu-toggle")?.addEventListener("click", () => {
      document.querySelector(".adm-shell")?.classList.toggle("is-open");
    });

    const ctx = await sa247Admin.requireAdmin();
    if (!ctx) return null;

    if (side) side.innerHTML = renderNav(ctx.profile.role);

    const key = activeKey();
    if (!pageAllowed(ctx.profile.role, key)) {
      location.href = hrefFor("kinh-doanh/");
      return null;
    }

    // Commerce-only: home → hub kinh doanh
    if (sa247Admin.isCommerceOnly(ctx.profile.role) && key === "home") {
      location.href = hrefFor("kinh-doanh/");
      return null;
    }

    if (opts?.requireCommerce && !sa247Admin.canManageCommerce(ctx.profile.role)) {
      throw new Error("Tài khoản không có quyền Kinh doanh.");
    }

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

  window.sa247AdminShell = { boot, hrefFor, activeKey };
})();
