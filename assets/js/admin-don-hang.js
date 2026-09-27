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
      {
        course: "Khóa học",
        cert_pdf: "Đăng ký nhận GCN PDF",
        cert_hard: "Đăng ký nhận GCN bản cứng",
      }[t] ||
      t ||
      "—"
    );
  }

  function sourceVi(s) {
    return (
      {
        KHACH_TU_TAO: "Khách tự tạo",
        SALE_TAO: "Sale tạo",
        ADMIN_TAO: "Admin tạo",
        CAMPUS: "Campus",
        DOI_TAC: "Đối tác",
      }[s] || ""
    );
  }

  function isHardOrder(o) {
    if ((o.items || []).some((i) => i.product_code === "cert_hard")) return true;
    return o.product_type === "cert_hard" || o.cert_option === "cert_hard";
  }

  function itemLabel(i) {
    const code = i.course?.code || "";
    if (i.product_code === "cert_pdf") return `GCN PDF ${code}`.trim();
    if (i.product_code === "cert_hard") return `GCN bản cứng ${code}`.trim();
    if (i.product_code === "course") return code || "Khóa học";
    return i.product_code;
  }

  function paint() {
    const f = document.getElementById("filter").value;
    const list = cache.filter((o) => {
      if (f === "all") return true;
      if (f === "cert_hard") return isHardOrder(o);
      if (f === "amount_mismatch") return o.payment_flag === "amount_mismatch";
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
        const flag = o.payment_flag
          ? `<div class="adm-msg adm-msg--err">${sa247Admin.paymentFlagVi(o.payment_flag)}</div>`
          : "";
        const hardCtrl =
          isHardOrder(o) && o.status === "paid" && o.hard_fulfillment_status
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
            <div class="adm-msg">${sourceVi(o.order_source) ? sourceVi(o.order_source) + " · " : ""}${
              o.order_source ? "" : productVi(o.product_type)
            }${o.order_kind === "combo_custom" ? " · combo" : ""}${
              o.cert_option && o.cert_option !== "none"
                ? ` · kèm ${o.cert_option === "cert_hard" ? "đăng ký nhận GCN bản cứng" : "đăng ký nhận GCN PDF"}`
                : ""
            }</div>
            ${o.payment_code ? `<div class="adm-msg">CK: <code>${o.payment_code}</code></div>` : ""}
            <div class="adm-msg">${o.buyer_email || ""}</div>
            ${shipLine}
          </td>
          <td>${
            (o.items || []).filter((i) => i.product_code && i.product_code !== "shipping").length
              ? (o.items || [])
                  .filter((i) => i.product_code && i.product_code !== "shipping")
                  .map(itemLabel)
                  .join(", ")
              : `${c.code || ""} · ${c.title || ""}`
          }</td>
          <td>${sa247Admin.fmtVnd(o.amount)}${
            o.list_amount && o.list_amount !== o.amount
              ? `<div class="adm-msg">gốc ${sa247Admin.fmtVnd(o.list_amount)}${o.discount_percent ? " · −" + o.discount_percent + "%" : ""}</div>`
              : ""
          }${
            o.shipping_fee
              ? `<div class="adm-msg">ship ${sa247Admin.fmtVnd(o.shipping_fee)}</div>`
              : ""
          }</td>
          <td>${sa247Admin.statusOrderVi(o.status)}${flag}${
            o.sent_at ? `<div class="adm-msg">Đã gửi khách ${sa247Admin.fmtTime(o.sent_at)}</div>` : ""
          }</td>
          <td>${sa247Admin.fmtTime(o.created_at)}</td>
          <td>
            ${
              o.status === "draft"
                ? `<a class="adm-btn adm-btn--primary adm-btn--small" href="./tao.html?id=${o.id}">Sửa nháp</a>`
                : ""
            }
            ${
              o.view_token && (o.status === "draft" || o.status === "pending")
                ? `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-copy-link="${o.view_token}">Sao chép link đơn</button>`
                : ""
            }
            ${
              o.status === "pending"
                ? `<button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-confirm="${o.order_code}">Xác nhận thanh toán</button>
                   <button type="button" class="adm-btn adm-btn--danger adm-btn--small" data-fail="${o.order_code}">Đánh dấu thất bại</button>`
                : o.status === "draft"
                  ? ""
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
      const ctx = await sa247AdminShell.boot("Đơn hàng", { requireCommerce: true });
      if (!ctx) return;
      const { sb } = ctx;

      async function reload() {
        const { data, error } = await sb
          .from("orders")
          .select(
            "id,order_code,payment_code,status,amount,list_amount,discount_percent,order_kind,product_type,product_amount,shipping_fee,order_source,view_token,sent_at,hard_fulfillment_status,tracking_code,carrier_name,ship_full_name,ship_phone,ship_address,ship_province,buyer_email,payment_flag,created_at,user_id,cert_option,course:courses(code,title),items:order_items(product_code,course:courses(code))"
          )
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        cache = data || [];
        paint();
      }

      await reload();
      document.getElementById("filter").addEventListener("change", paint);
      document.getElementById("rows").addEventListener("click", async (ev) => {
        const copyBtn = ev.target.closest("[data-copy-link]");
        if (copyBtn) {
          const link = `${location.origin}/don-hang/xem.html?t=${copyBtn.getAttribute("data-copy-link")}`;
          try {
            await navigator.clipboard.writeText(link);
            copyBtn.textContent = "Đã sao chép";
          } catch {
            prompt("Link đơn hàng:", link);
          }
          return;
        }
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
        const failBtn = ev.target.closest("[data-fail]");
        if (failBtn) {
          if (!confirm("Đánh dấu đơn thất bại? Khóa học sẽ không được mở.")) return;
          const { error } = await sb.rpc("admin_mark_order_failed", {
            p_order_code: failBtn.getAttribute("data-fail"),
            p_reason: "provider_rejected",
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
