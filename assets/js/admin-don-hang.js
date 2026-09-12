/* Admin · Đơn hàng + fulfillment GCN cứng */
(function () {
  let cache = [];

  const HARD_STATUSES = [
    "CHO_XU_LY",
    "DA_XAC_NHAN",
    "DANG_IN",
    "DA_DONG_GOI",
    "DA_BAN_GIAO_VAN_CHUYEN",
    "DA_GIAO",
    "GIAO_KHONG_THANH_CONG",
    "HOAN_VE",
    "HUY",
    "CAN_BO_SUNG_THONG_TIN",
  ];

  function productVi(t) {
    return (
      { course: "Khóa học", cert_pdf: "GCN PDF", cert_hard: "GCN cứng" }[t] ||
      t ||
      "—"
    );
  }

  function paint() {
    const f = document.getElementById("filter").value;
    const list = cache.filter((o) => {
      if (f === "all") return true;
      if (f === "cert_hard") return o.product_type === "cert_hard";
      return o.status === f;
    });
    document.getElementById("rows").innerHTML = list
      .map((o) => {
        const c = o.course || {};
        const shipBits = [];
        if (o.ship_full_name) shipBits.push(o.ship_full_name);
        if (o.ship_phone) shipBits.push(o.ship_phone);
        if (o.ship_address) shipBits.push(o.ship_address);
        if (o.ship_province) shipBits.push(o.ship_province);
        const shipLine = shipBits.length
          ? `<div class="adm-msg">${shipBits.join(" · ")}</div>`
          : "";
        const hardCtrl =
          o.product_type === "cert_hard" && o.status === "paid"
            ? `<div class="adm-hard-ops" data-hard-id="${o.id}">
                <select data-hard-status>
                  ${HARD_STATUSES.map(
                    (s) =>
                      `<option value="${s}" ${
                        o.hard_fulfillment_status === s ? "selected" : ""
                      }>${s}</option>`
                  ).join("")}
                </select>
                <input data-hard-track placeholder="Mã vận đơn" value="${
                  o.tracking_code || ""
                }" />
                <input data-hard-carrier placeholder="Đơn vị VC" value="${
                  o.carrier_name || ""
                }" />
                <button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-hard-save>Lưu VC</button>
              </div>`
            : o.hard_fulfillment_status
              ? `<div class="adm-msg">${o.hard_fulfillment_status}${
                  o.tracking_code ? " · " + o.tracking_code : ""
                }</div>`
              : "";
        return `<tr>
          <td>
            <strong>${o.order_code}</strong>
            <div class="adm-msg">${productVi(o.product_type)}</div>
            <div class="adm-msg">${o.user_id || o.buyer_email || ""}</div>
            ${shipLine}
          </td>
          <td>${c.code || ""} · ${c.title || ""}</td>
          <td>${sa247Admin.fmtVnd(o.amount)}${
            o.shipping_fee
              ? `<div class="adm-msg">ship ${sa247Admin.fmtVnd(o.shipping_fee)}</div>`
              : ""
          }</td>
          <td>${sa247Admin.statusOrderVi(o.status)}</td>
          <td>${sa247Admin.fmtTime(o.created_at)}</td>
          <td>
            ${
              o.status === "pending"
                ? `<button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-confirm="${o.order_code}">Xác nhận thanh toán</button>`
                : "—"
            }
            ${hardCtrl}
          </td>
        </tr>`;
      })
      .join("");
    document.getElementById("adm-status").textContent = `${list.length} đơn`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Đơn hàng");
      if (!ctx) return;
      const { sb } = ctx;

      async function reload() {
        const { data, error } = await sb
          .from("orders")
          .select(
            "id,order_code,status,amount,product_type,product_amount,shipping_fee,hard_fulfillment_status,tracking_code,carrier_name,ship_full_name,ship_phone,ship_address,ship_province,buyer_email,created_at,user_id,course:courses(code,title)"
          )
          .order("created_at", { ascending: false })
          .limit(150);
        if (error) throw error;
        cache = data || [];
        paint();
      }

      await reload();
      document.getElementById("filter").addEventListener("change", paint);
      document.getElementById("rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-confirm]");
        if (btn) {
          if (!confirm("Xác nhận thanh toán và cấp quyền / GCN?")) return;
          const { error } = await sb.rpc("admin_confirm_order", {
            p_order_code: btn.getAttribute("data-confirm"),
          });
          if (error) return alert(error.message);
          await reload();
          return;
        }
        const save = ev.target.closest("[data-hard-save]");
        if (!save) return;
        const wrap = save.closest("[data-hard-id]");
        if (!wrap) return;
        const id = wrap.getAttribute("data-hard-id");
        const status = wrap.querySelector("[data-hard-status]")?.value;
        const tracking = wrap.querySelector("[data-hard-track]")?.value?.trim();
        const carrier = wrap.querySelector("[data-hard-carrier]")?.value?.trim();
        const { error } = await sb.rpc("admin_update_hard_fulfillment", {
          p_order_id: id,
          p_status: status,
          p_tracking_code: tracking || null,
          p_carrier_name: carrier || null,
        });
        if (error) return alert(error.message);
        await reload();
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
