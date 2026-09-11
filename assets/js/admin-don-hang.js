/* Đơn hàng — xác nhận thủ công */
(function () {
  let cache = [];

  function paint() {
    const f = document.getElementById("filter").value;
    const list = cache.filter((o) => f === "all" || o.status === f);
    document.getElementById("rows").innerHTML = list
      .map((o) => {
        const c = o.course || {};
        return `<tr>
          <td><strong>${o.order_code}</strong><div class="adm-msg">${o.user_id}</div></td>
          <td>${c.code || ""} · ${c.title || ""}</td>
          <td>${sa247Admin.fmtVnd(o.amount)}</td>
          <td>${sa247Admin.statusOrderVi(o.status)}</td>
          <td>${sa247Admin.fmtTime(o.created_at)}</td>
          <td>
            ${
              o.status === "pending"
                ? `<button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-confirm="${o.order_code}">Xác nhận thanh toán</button>`
                : "—"
            }
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
            "id,order_code,status,amount,created_at,user_id,course:courses(code,title)"
          )
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        cache = data || [];
        paint();
      }

      await reload();
      document.getElementById("filter").addEventListener("change", paint);
      document.getElementById("rows").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-confirm]");
        if (!btn) return;
        if (!confirm("Xác nhận thanh toán và cấp quyền học?")) return;
        const { error } = await sb.rpc("admin_confirm_order", {
          p_order_code: btn.getAttribute("data-confirm"),
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
