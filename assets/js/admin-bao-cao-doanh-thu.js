/* Admin · Báo cáo doanh thu (paid only) */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Báo cáo doanh thu", {
        requireCommerce: true,
      });
      if (!ctx) return;
      const { sb } = ctx;

      const { data: commerce, error } = await sb.rpc("admin_commerce_summary");
      if (error) throw error;

      document.getElementById("adm-status").textContent =
        "Doanh thu = tổng đơn status = paid (mỗi đơn một dòng). Pending / expired / mismatch không tính doanh thu.";

      document.getElementById("adm-stats").innerHTML = [
        ["Đơn đã thanh toán", commerce?.paid_orders ?? 0],
        ["Doanh thu", sa247Admin.fmtVnd(commerce?.paid_revenue)],
        ["Đơn chờ thanh toán", commerce?.pending_orders ?? 0],
        ["Đơn hết hạn", commerce?.expired_orders ?? 0],
        ["Cờ sai số tiền", commerce?.amount_mismatch_orders ?? 0],
        ["Đơn khác (loại trừ)", commerce?.excluded_orders ?? 0],
      ]
        .map(
          ([label, val]) =>
            `<article class="adm-stat"><strong>${val}</strong><span>${label}</span></article>`
        )
        .join("");

      const { data: recent, error: oErr } = await sb
        .from("orders")
        .select(
          "order_code,status,amount,payment_flag,paid_at,created_at,product_type,course:courses(code,title)"
        )
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(40);
      if (oErr) throw oErr;

      document.getElementById("rows").innerHTML = (recent || [])
        .map((o) => {
          const c = o.course || {};
          return `<tr>
            <td><strong>${o.order_code}</strong>
              <div class="adm-msg">${o.product_type || ""}</div></td>
            <td>${c.code || ""} · ${c.title || ""}</td>
            <td>${sa247Admin.fmtVnd(o.amount)}</td>
            <td>${sa247Admin.fmtTime(o.paid_at || o.created_at)}</td>
          </tr>`;
        })
        .join("");
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
