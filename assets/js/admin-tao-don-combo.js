/* Admin · Tạo đơn combo — ưu đãi theo số lượng, mã TT hệ thống, QR */
(function () {
  const BANK = window.SA247_BANK || {
    name: "VPBank",
    owner: "HO HUU NHAN",
    account: "0877787988",
    bin: "VPB",
  };

  let buyer = null;
  let courses = [];
  let quote = null;
  let isOwner = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(n) {
    return sa247Admin.fmtVnd(n);
  }

  function selectedCodes() {
    return [...document.querySelectorAll("#course-list input:checked")].map((el) => el.value);
  }

  function vietQrUrl(amount, addInfo) {
    const base = `https://img.vietqr.io/image/${encodeURIComponent(BANK.bin)}-${encodeURIComponent(BANK.account)}-compact2.png`;
    const q = new URLSearchParams({
      amount: String(amount),
      addInfo: String(addInfo),
      accountName: BANK.owner,
    });
    return `${base}?${q.toString()}`;
  }

  async function refreshQuote(sb) {
    const codes = selectedCodes();
    const box = document.getElementById("quote-box");
    const btn = document.getElementById("btn-create");
    quote = null;
    if (!codes.length) {
      box.textContent = "Chọn khóa để xem ưu đãi theo số lượng.";
      btn.disabled = true;
      return;
    }
    const { data, error } = await sb.rpc("sa247_quote_combo", { p_course_codes: codes });
    if (error) {
      box.innerHTML = `<span class="adm-msg--err">${esc(error.message)}</span>`;
      btn.disabled = true;
      return;
    }
    quote = data;
    const needOwner = !!data.needs_owner_quote;
    const canCreate = !!buyer && (!needOwner || isOwner);
    btn.disabled = !canCreate;
    box.innerHTML = `
      <p><strong>${data.course_count} khóa</strong> · giá niêm yết ${fmt(data.unit_price)}/khóa</p>
      <p>Giá gốc: <strong>${fmt(data.list_amount)}</strong></p>
      <p>${esc(data.label || "")}${
        data.policy_discount_percent != null
          ? ` · ưu đãi ${data.policy_discount_percent}%`
          : ""
      }</p>
      <p>Tổng thanh toán theo chính sách:
        <strong>${data.policy_pay_amount != null ? fmt(data.policy_pay_amount) : "Cần báo giá riêng"}</strong>
      </p>
      ${
        data.policy_pay_amount != null && data.list_amount > data.policy_pay_amount
          ? `<p class="adm-muted">Tiết kiệm ${fmt(data.list_amount - data.policy_pay_amount)}</p>`
          : ""
      }
      ${needOwner && !isOwner ? '<p class="adm-msg--err">Từ 11 khóa: chỉ chủ sở hữu được tạo báo giá / đơn.</p>' : ""}
      ${!buyer ? "<p>Chưa chọn khách hàng.</p>" : ""}`;
  }

  function showPay(res) {
    const box = document.getElementById("pay-box");
    const q = res.quote || quote || {};
    const items = (q.items || []).map((c) => c.code).join(", ");
    const pay = res.payment_code;
    const copy = [
      `Đơn ${res.order_code}`,
      `${q.course_count || ""} khóa: ${items}`,
      `Giá gốc: ${fmt(res.list_amount)}`,
      res.discount_percent ? `Ưu đãi theo số lượng: ${res.discount_percent}%` : "",
      `Thanh toán: ${fmt(res.amount)}`,
      `STK ${BANK.account} · ${BANK.owner} · ${BANK.name}`,
      `Nội dung CK: ${pay}`,
    ]
      .filter(Boolean)
      .join("\n");
    document.getElementById("pay-detail").innerHTML = `
      <p>Đơn <strong>${esc(res.order_code)}</strong> · ${esc(buyer?.full_name || buyer?.email || "")}</p>
      <p>${esc(items)}</p>
      <p>Giá gốc ${fmt(res.list_amount)} · ưu đãi ${res.discount_percent || 0}% · <strong>thu ${fmt(res.amount)}</strong></p>
      <p>Mã thanh toán: <code id="pay-code">${esc(pay)}</code>
        <button type="button" class="adm-btn adm-btn--line adm-btn--small" id="copy-pay">Sao chép thông tin</button></p>
      <p><img alt="QR chuyển khoản" width="220" height="220" src="${esc(vietQrUrl(res.amount, pay))}" /></p>
      <p class="adm-muted">Khách chuyển đúng ${fmt(res.amount)}, nội dung <strong>${esc(pay)}</strong>. SePay khớp đơn rồi hệ thống cấp quyền học từng khóa. Combo không gồm chứng nhận.</p>`;
    box.hidden = false;
    document.getElementById("copy-pay")?.addEventListener("click", async (ev) => {
      try {
        await navigator.clipboard.writeText(copy);
        ev.target.textContent = "Đã sao chép";
      } catch {
        ev.target.textContent = "Không sao chép được — chọn mã rồi Ctrl+C";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tạo đơn combo", { requireCommerce: true });
      if (!ctx) return;
      const { sb, session } = ctx;
      isOwner = sa247Admin.isOwner(session);
      document.getElementById("owner-box").hidden = !isOwner;

      const { data: cs, error: cErr } = await sb.from("courses").select("code,title").order("code");
      if (cErr) throw cErr;
      courses = cs || [];
      document.getElementById("course-list").innerHTML = courses
        .map(
          (c) =>
            `<label class="cmb-course"><input type="checkbox" value="${esc(c.code)}" /> <strong>${esc(c.code)}</strong> · ${esc(c.title)}</label>`
        )
        .join("");
      document.getElementById("course-list").addEventListener("change", () => refreshQuote(sb));

      document.getElementById("find-form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const email = String(new FormData(ev.target).get("email") || "").trim();
        const msg = document.getElementById("find-msg");
        const box = document.getElementById("buyer-box");
        buyer = null;
        box.hidden = true;
        msg.textContent = "Đang tìm…";
        const { data, error } = await sb.rpc("admin_find_user_by_email", { p_email: email });
        if (error) {
          msg.innerHTML = `<span class="adm-msg--err">${esc(error.message)}</span>`;
          await refreshQuote(sb);
          return;
        }
        const uid = data?.user_id;
        if (!uid) {
          msg.innerHTML = '<span class="adm-msg--err">Chưa có tài khoản với email này. Tạo người học trước, rồi lập đơn.</span>';
          await refreshQuote(sb);
          return;
        }
        const { data: p } = await sb.from("profiles").select("id,full_name,phone,role").eq("id", uid).maybeSingle();
        buyer = { id: uid, email, full_name: p?.full_name, phone: p?.phone };
        msg.textContent = "";
        box.hidden = false;
        box.innerHTML = `<strong>${esc(p?.full_name || "(chưa đặt tên)")}</strong> · ${esc(email)}${p?.phone ? " · " + esc(p.phone) : ""}`;
        await refreshQuote(sb);
      });

      document.getElementById("btn-create").addEventListener("click", async () => {
        const msg = document.getElementById("create-msg");
        if (!buyer || !selectedCodes().length) return;
        const ovPct = document.getElementById("ov-pct")?.value;
        const ovAmt = document.getElementById("ov-amt")?.value;
        const ovNote = document.getElementById("ov-note")?.value;
        msg.textContent = "Đang tạo đơn…";
        const payload = {
          p_user_id: buyer.id,
          p_course_codes: selectedCodes(),
          p_discount_percent: isOwner && ovPct !== "" ? Number(ovPct) : null,
          p_amount_override: isOwner && ovAmt !== "" ? Number(ovAmt) : null,
          p_note: isOwner ? ovNote || null : null,
        };
        const { data, error } = await sb.rpc("admin_create_combo_order", payload);
        if (error) {
          const map = {
            override_owner_only: "Chỉ chủ sở hữu được chỉnh % hoặc số tiền ngoài bảng.",
            owner_quote_required: "Từ 11 khóa cần chủ sở hữu tạo báo giá.",
            user_not_found: "Không tìm thấy tài khoản.",
          };
          msg.innerHTML = `<span class="adm-msg--err">${esc(map[error.message] || error.message)}</span>`;
          return;
        }
        msg.innerHTML = '<span class="adm-msg--ok">Đã tạo đơn. Gửi QR / nội dung CK cho khách.</span>';
        showPay(data);
      });
    } catch (e) {
      document.getElementById("create-msg").innerHTML = `<span class="adm-msg--err">${esc(e.message || e)}</span>`;
    }
  });
})();
