/* Admin · product_prices */
(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Giá & ship");
      if (!ctx) return;
      const { sb } = ctx;
      const status = document.getElementById("adm-status");
      const rows = document.getElementById("rows");

      async function reload() {
        const { data, error } = await sb
          .from("product_prices")
          .select("code,amount,label,updated_at")
          .order("code");
        if (error) throw error;
        rows.innerHTML = (data || [])
          .map(
            (r) => `<tr data-code="${r.code}">
            <td><code>${r.code}</code></td>
            <td><input data-label value="${(r.label || "").replace(/"/g, "&quot;")}" /></td>
            <td><input data-amount type="number" min="0" step="1000" value="${r.amount}" /></td>
            <td><button type="button" class="adm-btn adm-btn--primary adm-btn--small" data-save>Lưu</button></td>
          </tr>`
          )
          .join("");
        status.textContent = `${(data || []).length} mức giá`;
      }

      await reload();

      rows.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-save]");
        if (!btn) return;
        const tr = btn.closest("tr");
        const code = tr.getAttribute("data-code");
        const amount = Number(tr.querySelector("[data-amount]")?.value);
        const label = tr.querySelector("[data-label]")?.value?.trim();
        status.textContent = "Đang lưu…";
        const { error } = await sb.rpc("admin_upsert_product_price", {
          p_code: code,
          p_amount: amount,
          p_label: label || null,
        });
        if (error) {
          status.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        status.textContent = `Đã lưu ${code}`;
        await reload();
      });

      document.getElementById("sync-courses")?.addEventListener("click", async () => {
        status.textContent = "Đang đồng bộ…";
        const { data, error } = await sb.rpc("admin_sync_course_default_price");
        if (error) {
          status.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        status.textContent = `Đã cập nhật ${data || 0} khóa học`;
      });
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
