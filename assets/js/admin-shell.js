/* Khung menu quản trị SA247 (tiếng Việt) */
(function () {
  function depthFromAdmin() {
    const path = location.pathname.replace(/\\/g, "/");
    const idx = path.lastIndexOf("/admin/");
    if (idx < 0) return 0;
    const rest = path.slice(idx + "/admin/".length);
    // Chỉ đếm thư mục: phần cuối (tên file hoặc rỗng sau "/") không làm tăng độ sâu.
    return rest.split("/").slice(0, -1).filter(Boolean).length;
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

  // `can` phải khớp đúng điều kiện server (is_staff / can_manage_content / can_manage_commerce /
  // is_admin / is_owner): mục nào server từ chối thì không được hiện trên menu.
  const STAFF = (c) => c.staff;
  const CONTENT = (c) => c.content;
  const COMMERCE = (c) => c.commerce;
  const ADMIN = (c) => c.admin;
  const ANY = () => true;

  // Đào tạo · Người học (vòng đời học tập) tách khỏi Hệ thống · Tài khoản (danh tính & vai trò).
  const MENU = [
    {
      group: "Tổng quan",
      items: [{ target: "", label: "Trung tâm điều hành", key: "home", can: STAFF }],
    },
    {
      group: "Học viện",
      items: [{ target: "khoa-hoc/", label: "Khóa học", key: "khoa-hoc", can: CONTENT }],
    },
    {
      group: "Đào tạo",
      items: [
        { target: "nguoi-hoc/", label: "Người học", key: "nguoi-hoc", can: STAFF },
        { target: "nguoi-hoc/?tab=attention", label: "Cần chú ý", key: "nguoi-hoc-attention", can: STAFF },
        {
          target: "nguoi-hoc/ho-so.html",
          label: "Hồ sơ đang xem",
          key: "ho-so",
          keepUser: true,
          needsUser: true,
          can: STAFF,
        },
        { target: "quyen-hoc/", label: "Quyền học", key: "quyen-hoc", keepUser: true, can: STAFF },
        { target: "tien-do/", label: "Tiến độ học tập", key: "tien-do", keepUser: true, can: STAFF },
      ],
    },
    {
      group: "Đánh giá",
      items: [
        { target: "cau-hoi/", label: "Ngân hàng câu hỏi", key: "cau-hoi", can: CONTENT },
        { target: "bai-kiem-tra/", label: "Bài kiểm tra", key: "bai-kiem-tra", can: CONTENT },
      ],
    },
    {
      group: "Chứng nhận",
      items: [{ target: "chung-nhan/", label: "Tất cả chứng nhận", key: "chung-nhan", can: STAFF }],
    },
    {
      group: "Kinh doanh",
      items: [
        { target: "kinh-doanh/", label: "Hub Kinh doanh", key: "kinh-doanh", can: COMMERCE },
        { target: "don-hang/", label: "Đơn hàng", key: "don-hang", can: COMMERCE },
        { target: "don-hang/tao.html", label: "Tạo đơn", key: "tao-don", can: (c) => c.admin || c.owner },
        { target: "don-hang/chinh-sach.html", label: "Ưu đãi số lượng", key: "uu-dai-sl", can: (c) => c.owner },
        { target: "gia-ship/", label: "Giá & ship", key: "gia-ship", can: ADMIN },
        { target: "bao-cao-doanh-thu/", label: "Báo cáo doanh thu", key: "bao-cao", can: COMMERCE },
        { target: "doi-tac/", label: "Campus / Đối tác", key: "doi-tac", can: COMMERCE },
        { target: "cho-mo-khoa/", label: "Chờ mở khóa", key: "cho-mo-khoa", can: (c) => c.staff && c.commerce },
      ],
    },
    {
      group: "Cải tiến",
      items: [{ target: "phan-hoi/", label: "Phản hồi & Hỗ trợ", key: "phan-hoi", can: STAFF }],
    },
    {
      group: "Phân tích",
      items: [
        { target: "phan-tich/", label: "Phân tích học tập", key: "phan-tich", can: ADMIN },
        { target: "thong-ke/", label: "Thống kê nền tảng", key: "thong-ke", can: ADMIN },
      ],
    },
    {
      group: "Hệ thống",
      items: [
        { target: "tai-khoan/", label: "Tài khoản", key: "tai-khoan", can: ADMIN },
        { target: "phan-quyen/", label: "Vai trò & phân quyền", key: "phan-quyen", can: ADMIN },
        { target: "nhat-ky/", label: "Nhật ký hoạt động", key: "nhat-ky", can: ADMIN },
        { target: "bao-mat/", label: "Nhật ký bảo mật", key: "bao-mat", can: ADMIN },
        {
          target: "auth/doi-mat-khau.html",
          label: "Đổi mật khẩu",
          key: "doi-mat-khau",
          site: true,
          can: ANY,
        },
      ],
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
    if (path.includes("/ho-so")) return "ho-so";
    if (path.includes("/nguoi-hoc")) {
      return new URLSearchParams(location.search).get("tab") === "attention"
        ? "nguoi-hoc-attention"
        : "nguoi-hoc";
    }
    if (path.includes("/tai-khoan")) return "tai-khoan";
    if (path.includes("/quyen-hoc")) return "quyen-hoc";
    if (path.includes("/don-hang/tao")) return "tao-don";
    if (path.includes("/don-hang/chinh-sach")) return "uu-dai-sl";
    if (path.includes("/don-hang")) return "don-hang";
    if (path.includes("/gia-ship")) return "gia-ship";
    if (path.includes("/nhat-ky")) return "nhat-ky";
    if (path.includes("/admin/bao-mat")) return "bao-mat";
    if (path.includes("/thong-ke")) return "thong-ke";
    if (path.includes("/phan-tich")) return "phan-tich";
    if (path.includes("/phan-quyen")) return "phan-quyen";
    if (path.includes("/admin/doi-tac")) return "doi-tac";
    if (path.includes("/admin/phan-hoi")) return "phan-hoi";
    return "home";
  }

  function capsFor(ctx) {
    const A = window.sa247Admin;
    const role = ctx.profile.role;
    return {
      staff: ["admin", "quan_tri_cao_nhat", "quan_tri", "quan_ly_noi_dung", "giang_vien"].includes(role),
      content: !!A.canManageContent(role),
      commerce: !!A.canManageCommerce(role),
      admin: !!A.isFullAdmin(role),
      owner: !!A.isOwner(ctx.session),
    };
  }

  function menuFor(caps) {
    return MENU.map((g) => ({ ...g, items: g.items.filter((it) => it.can(caps)) })).filter(
      (g) => g.items.length,
    );
  }

  function pageAllowed(caps, key) {
    const items = MENU.flatMap((g) => g.items).filter((it) => it.key === key);
    return !items.length || items.some((it) => it.can(caps));
  }

  function firstAllowedHref(caps) {
    const it = menuFor(caps)
      .flatMap((g) => g.items)
      .find((x) => !x.site && !x.needsUser);
    return it ? hrefFor(it.target) : hrefFor("auth/doi-mat-khau.html", { site: true });
  }

  function renderNav(caps) {
    const key = activeKey();
    const uid = contextUserId();
    return menuFor(caps)
      .map((g) => {
        const links = g.items
          .map((it) => {
            if (it.needsUser && !uid) return "";
            const active = it.key === key ? "is-active" : "";
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

    const caps = capsFor(ctx);
    if (side) {
      side.innerHTML = renderNav(caps);
      side.querySelector("a.is-active")?.scrollIntoView({ block: "nearest" });
    }

    if (!pageAllowed(caps, activeKey())) {
      location.href = firstAllowedHref(caps);
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
