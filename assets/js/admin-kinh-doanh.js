/* Admin · Hub Kinh doanh */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Kinh doanh", { requireCommerce: true });
      if (!ctx) return;
      const { sb } = ctx;
      const status = document.getElementById("adm-status");
      const stats = document.getElementById("adm-stats");

      const { data: commerce, error } = await sb.rpc("admin_commerce_summary");
      if (error) throw error;

      const paid = Number(commerce?.paid_orders || 0);
      const revenue = Number(commerce?.paid_revenue || 0);
      const pending = Number(commerce?.pending_orders || 0);
      const expired = Number(commerce?.expired_orders || 0);
      const mismatch = Number(commerce?.amount_mismatch_orders || 0);

      status.textContent =
        "Module Kinh doanh — đơn hàng, xác nhận thanh toán, cấp quyền sau khi paid.";
      stats.innerHTML = [
        ["Đơn đã thanh toán", paid],
        ["Doanh thu (paid)", sa247Admin.fmtVnd(revenue)],
        ["Đơn chờ CK", pending],
        ["Hết hạn", expired],
        ["Sai số tiền", mismatch],
      ]
        .map(
          ([label, val]) =>
            `<article class="adm-stat"><strong>${val}</strong><span>${label}</span></article>`
        )
        .join("");

      document.getElementById("adm-links").innerHTML = [
        { href: "../don-hang/", t: "Đơn hàng", d: "Xem / xác nhận thanh toán · Sai số tiền · Hết hạn" },
        { href: "../gia-ship/", t: "Giá & ship", d: "Xem mức giá sản phẩm (sửa giá: quản trị)" },
        {
          href: "../bao-cao-doanh-thu/",
          t: "Báo cáo doanh thu",
          d: "Tóm tắt paid-only qua admin_commerce_summary",
        },
        {
          href: "../quyen-hoc/",
          t: "Cấp quyền học",
          d: "Grant / revoke enrollment (sau thanh toán hoặc thủ công)",
        },
      ]
        .map(
          (x) =>
            `<a class="adm-card" href="${x.href}" style="display:block;text-decoration:none;color:inherit">
              <h2>${x.t}</h2><p class="adm-msg">${x.d}</p></a>`
        )
        .join("");
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
