/* Admin · Tạo / sửa đơn (Sale · Admin) — cùng cơ chế giá với giỏ khách; nháp → gửi link → khách xác nhận → thanh toán */
(function () {
  let BANK = null;

  let buyer = null;
  let courses = [];
  let quote = null;
  let isOwner = false;
  let editId = null;
  const picked = new Map();

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(n) {
    return sa247Admin.fmtVnd(n);
  }

  function items() {
    return [...picked.entries()].map(([code, cert]) => ({ code, cert }));
  }

  function vietQrUrl(amount, addInfo) {
    if (!BANK) return "";
    const base = `https://img.vietqr.io/image/${encodeURIComponent(BANK.bin)}-${encodeURIComponent(BANK.account)}-compact2.png`;
    const q = new URLSearchParams({ amount: String(amount), addInfo: String(addInfo), accountName: BANK.owner });
    return `${base}?${q.toString()}`;
  }

  function orderLink(token) {
    return `${location.origin}/don-hang/xem.html?t=${token}`;
  }

  function family(code) {
    return String(code || "").replace(/-?\d+$/, "");
  }

  function paintCourses() {
    document.getElementById("course-list").innerHTML = courses
      .map((c) => {
        const on = picked.has(c.code);
        const cert = picked.get(c.code) || "none";
        return `<div class="cmb-course">
          <label style="flex:1"><input type="checkbox" value="${esc(c.code)}" ${on ? "checked" : ""} data-pick />
            <strong>${esc(c.code)}</strong> · ${esc(c.title)}${c.is_published ? "" : " <em>(chưa mở)</em>"}</label>
          ${
            on
              ? `<select data-cert="${esc(c.code)}">
                  <option value="none" ${cert === "none" ? "selected" : ""}>GCN: chưa đăng ký</option>
                  <option value="cert_pdf" ${cert === "cert_pdf" ? "selected" : ""}>GCN PDF</option>
                  <option value="cert_hard" ${cert === "cert_hard" ? "selected" : ""}>GCN bản cứng</option>
                </select>`
              : ""
          }
        </div>`;
      })
      .join("");
    const fams = new Set([...picked.keys()].map(family));
    const sug = courses.filter((c) => c.is_published && !picked.has(c.code) && fams.has(family(c.code))).slice(0, 3);
    document.getElementById("suggest-box").innerHTML = sug.length
      ? "Gợi ý cùng lộ trình: " +
        sug.map((c) => `<button type="button" class="adm-btn adm-btn--line adm-btn--small" data-suggest="${esc(c.code)}">+ ${esc(c.code)}</button>`).join(" ")
      : "";
  }

  async function refreshQuote(sb) {
    const box = document.getElementById("quote-box");
    const btns = [document.getElementById("btn-create"), document.getElementById("btn-draft")];
    quote = null;
    if (!picked.size) {
      box.textContent = "Chọn khóa để xem ưu đãi theo số lượng.";
      btns.forEach((b) => (b.disabled = true));
      return;
    }
    const { data, error } = await sb.rpc("admin_quote_cart", { p_items: items() });
    if (error) {
      box.innerHTML = `<span class="adm-msg--err">${esc(error.message)}</span>`;
      btns.forEach((b) => (b.disabled = true));
      return;
    }
    quote = data;
    const needOwner = !!data.needs_owner_quote;
    btns.forEach((b) => (b.disabled = !buyer || (needOwner && !isOwner)));
    box.innerHTML = `
      <p><strong>${data.course_count} khóa</strong> · ${fmt(data.course_list)}${
        data.course_discount > 0 ? ` − ${data.course_discount_percent}% = <strong>${fmt(data.course_pay)}</strong>` : ""
      }</p>
      ${
        data.cert_count
          ? `<p><strong>${data.cert_count} GCN</strong> (${data.cert_pdf_count} PDF · ${data.cert_hard_count} bản cứng) · ${fmt(data.cert_list)}${
              data.cert_discount > 0 ? ` − ${data.cert_discount_percent}% = <strong>${fmt(data.cert_pay)}</strong>` : ""
            }</p>`
          : ""
      }
      ${data.shipping_fee ? `<p>Phí vận chuyển (mỗi đơn, không chiết khấu): ${fmt(data.shipping_fee)}</p>` : ""}
      <p>Giá gốc ${fmt(data.list_amount)} · Tổng theo chính sách:
        <strong>${data.amount != null ? fmt(data.amount) : "Cần báo giá riêng"}</strong></p>
      ${data.next_tier ? `<p class="adm-muted">Thêm ${data.next_tier.need} khóa để khách nhận ưu đãi ${data.next_tier.percent}%.</p>` : ""}
      ${needOwner && !isOwner ? '<p class="adm-msg--err">Từ 11 khóa: chỉ chủ sở hữu được lập báo giá / đơn.</p>' : ""}
      ${!buyer ? "<p>Chưa chọn người học.</p>" : ""}`;
  }

  function showResult(sb, res) {
    const box = document.getElementById("pay-box");
    const link = orderLink(res.view_token);
    const q = res.quote || quote || {};
    const codes = (q.items || []).map((c) => c.code + (c.cert !== "none" ? (c.cert === "cert_hard" ? " (+GCN bản cứng)" : " (+GCN PDF)") : "")).join(", ");
    const msg = [
      `SA247 gửi anh/chị đơn hàng ${res.order_code}`,
      `${q.course_count || ""} khóa: ${codes}`,
      res.discount_amount > 0 ? `Ưu đãi: −${fmt(res.discount_amount)}` : "",
      `Tổng thanh toán: ${fmt(res.amount)}`,
      `Xem đơn & thanh toán: ${link}`,
    ]
      .filter(Boolean)
      .join("\n");
    const draft = res.status === "draft";
    document.getElementById("pay-detail").innerHTML = `
      <p>Đơn <strong>${esc(res.order_code)}</strong> · ${draft ? "<b>Nháp</b> — khách cần bấm xác nhận trên link" : "Chờ thanh toán"} · ${esc(buyer?.full_name || buyer?.email || "")}</p>
      <p>Link cho khách: <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></p>
      <textarea readonly rows="6" style="width:100%;font:inherit" id="send-text">${esc(msg)}</textarea>
      <p class="prf-inline">
        <button type="button" class="adm-btn adm-btn--primary adm-btn--small" id="copy-send">Sao chép tin nhắn gửi khách</button>
        <button type="button" class="adm-btn adm-btn--line adm-btn--small" id="mark-sent">Đánh dấu đã gửi</button>
        ${draft ? `<a class="adm-btn adm-btn--line adm-btn--small" href="./tao.html?id=${esc(res.order_id)}">Sửa nháp</a>` : ""}
      </p>
      ${
        draft || !BANK
          ? ""
          : `<p><img alt="QR chuyển khoản" width="200" height="200" src="${esc(vietQrUrl(res.amount, res.payment_code))}" /></p>
             <p class="adm-muted">Nội dung CK: <strong>${esc(res.payment_code)}</strong> · ${fmt(res.amount)}. SePay khớp đơn → cấp quyền học từng khóa; GCN đã đăng ký được cấp tự động khi học viên đủ điều kiện.</p>`
      }`;
    box.hidden = false;
    document.getElementById("copy-send")?.addEventListener("click", async (ev) => {
      try {
        await navigator.clipboard.writeText(msg);
        ev.target.textContent = "Đã sao chép";
      } catch {
        document.getElementById("send-text")?.select();
        ev.target.textContent = "Nhấn Ctrl+C để sao chép";
      }
    });
    document.getElementById("mark-sent")?.addEventListener("click", async (ev) => {
      const { error } = await sb.rpc("admin_mark_order_sent", { p_order_id: res.order_id });
      ev.target.textContent = error ? error.message : "Đã ghi nhận gửi khách";
    });
  }

  async function selectBuyer(sb, uid, email) {
    const { data: p } = await sb.from("profiles").select("id,full_name,phone").eq("id", uid).maybeSingle();
    buyer = { id: uid, email, full_name: p?.full_name, phone: p?.phone };
    const box = document.getElementById("buyer-box");
    box.hidden = false;
    box.innerHTML = `<strong>${esc(p?.full_name || "(chưa đặt tên)")}</strong> · ${esc(email)}${p?.phone ? " · " + esc(p.phone) : ""}`;
  }

  async function loadDraft(sb, id) {
    const { data: o, error } = await sb
      .from("orders")
      .select("id,order_code,status,user_id,buyer_email,items:order_items(product_code,course:courses(code))")
      .eq("id", id)
      .maybeSingle();
    if (error || !o) throw new Error("Không tìm thấy đơn.");
    if (o.status !== "draft") throw new Error("Chỉ sửa được đơn nháp.");
    editId = o.id;
    document.getElementById("page-title").textContent = `Sửa đơn nháp ${o.order_code}`;
    (o.items || []).forEach((i) => {
      const code = i.course?.code;
      if (!code) return;
      if (i.product_code === "course" && !picked.has(code)) picked.set(code, "none");
      if (i.product_code === "cert_pdf" || i.product_code === "cert_hard") picked.set(code, i.product_code);
    });
    if (o.user_id) await selectBuyer(sb, o.user_id, o.buyer_email || "");
  }

  async function save(sb, submit) {
    const msg = document.getElementById("create-msg");
    if (!buyer || !picked.size) return;
    const ovPct = document.getElementById("ov-pct")?.value;
    const ovAmt = document.getElementById("ov-amt")?.value;
    const ovNote = document.getElementById("ov-note")?.value;
    msg.textContent = submit === "draft" ? "Đang lưu nháp…" : "Đang tạo đơn…";
    const { data, error } = await sb.rpc("admin_save_order", {
      p_order_id: editId,
      p_user_id: buyer.id,
      p_items: items(),
      p_submit: submit,
      p_discount_percent: isOwner && ovPct !== "" ? Number(ovPct) : null,
      p_amount_override: isOwner && ovAmt !== "" ? Number(ovAmt) : null,
      p_note: isOwner ? ovNote || null : null,
    });
    if (error) {
      const m = String(error.message || "");
      const map = {
        override_owner_only: "Chỉ chủ sở hữu được chỉnh % hoặc số tiền ngoài bảng.",
        owner_quote_required: "Từ 11 khóa cần chủ sở hữu lập báo giá.",
        user_not_found: "Không tìm thấy tài khoản.",
        order_not_draft: "Đơn đã được xác nhận — không sửa được nữa.",
      };
      const enrolled = m.match(/already_enrolled:\s*(.+)/)?.[1];
      msg.innerHTML = `<span class="adm-msg--err">${esc(
        enrolled ? `Người học đã có quyền học: ${enrolled}. Bỏ các khóa này khỏi đơn.` : map[m] || m
      )}</span>`;
      return;
    }
    editId = data.status === "draft" ? data.order_id : null;
    msg.innerHTML = `<span class="adm-msg--ok">${
      data.status === "draft" ? "Đã lưu nháp." : "Đã tạo đơn chờ thanh toán."
    } Gửi link cho khách bên dưới.</span>`;
    showResult(sb, data);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tạo đơn", { requireCommerce: true });
      if (!ctx) return;
      const { sb, session } = ctx;
      BANK = (await window.sa247PublicConfig?.bank()) || null;
      isOwner = sa247Admin.isOwner(session);
      document.getElementById("owner-box").hidden = !isOwner;

      const { data: cs, error: cErr } = await sb.from("courses").select("code,title,is_published").order("code");
      if (cErr) throw cErr;
      courses = cs || [];

      const id = new URL(location.href).searchParams.get("id");
      if (id) {
        try {
          await loadDraft(sb, id);
        } catch (e) {
          document.getElementById("create-msg").innerHTML = `<span class="adm-msg--err">${esc(e.message)}</span>`;
        }
      }
      paintCourses();
      await refreshQuote(sb);

      const list = document.getElementById("course-list");
      list.addEventListener("change", async (ev) => {
        const pick = ev.target.closest("[data-pick]");
        const cert = ev.target.closest("[data-cert]");
        if (pick) {
          if (pick.checked) picked.set(pick.value, document.getElementById("cert-all").value || "none");
          else picked.delete(pick.value);
          paintCourses();
        }
        if (cert) picked.set(cert.getAttribute("data-cert"), cert.value);
        await refreshQuote(sb);
      });
      document.getElementById("suggest-box").addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-suggest]");
        if (!b) return;
        picked.set(b.getAttribute("data-suggest"), document.getElementById("cert-all").value || "none");
        paintCourses();
        await refreshQuote(sb);
      });
      document.getElementById("cert-all").addEventListener("change", async (ev) => {
        const v = ev.target.value;
        if (!v) return;
        [...picked.keys()].forEach((k) => picked.set(k, v));
        paintCourses();
        await refreshQuote(sb);
      });

      document.getElementById("find-form").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const email = String(new FormData(ev.target).get("email") || "").trim();
        const msg = document.getElementById("find-msg");
        buyer = null;
        document.getElementById("buyer-box").hidden = true;
        msg.textContent = "Đang tìm…";
        const { data, error } = await sb.rpc("admin_find_user_by_email", { p_email: email });
        const uid = data?.user_id;
        if (error || !uid) {
          msg.innerHTML = `<span class="adm-msg--err">${
            error ? esc(error.message) : 'Chưa có tài khoản với email này. <a href="../nguoi-hoc/">Thêm người học</a> trước, rồi lập đơn.'
          }</span>`;
          await refreshQuote(sb);
          return;
        }
        msg.textContent = "";
        await selectBuyer(sb, uid, email);
        await refreshQuote(sb);
      });

      document.getElementById("btn-draft").addEventListener("click", () => save(sb, "draft"));
      document.getElementById("btn-create").addEventListener("click", () => save(sb, "pending"));
    } catch (e) {
      const el = document.getElementById("adm-status") || document.getElementById("create-msg");
      if (el) el.textContent = e.message || String(e);
    }
  });
})();
