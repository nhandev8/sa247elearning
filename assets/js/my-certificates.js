/* Học viên · Chứng nhận của tôi */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("vi-VN");
    } catch {
      return iso || "—";
    }
  }

  function statusVi(s) {
    return (
      {
        valid: "Hợp lệ — đã cấp",
        issued: "Hợp lệ — đã cấp",
        eligible: "Đủ điều kiện — chưa đăng ký nhận",
        revoked: "Đã thu hồi",
        replaced: "Đã thay thế (xem mã mới)",
      }[s] ||
      s ||
      "—"
    );
  }

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  async function loadCertPriceLabels(sb) {
    const label = (v) => (v != null ? fmtVnd(v) : "");
    try {
      const { data, error } = await sb.rpc("get_product_prices");
      if (error || !data || typeof data !== "object") return {};
      return {
        pdf: label(data.cert_pdf?.amount),
        hard: label(data.cert_hard?.amount),
        ship: label(data.shipping_default?.amount),
        course: label(data.course_default?.amount),
      };
    } catch {
      return {};
    }
  }

  async function bindLogout() {
    const btn = el("logout");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await sa247Auth.signOut();
      } catch (_) {}
      location.href = "../index.html";
    });
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  const HARD_VI = {
    CHO_XU_LY: "Chờ xử lý",
    DA_XAC_NHAN: "Đã xác nhận",
    DANG_IN: "Đang in",
    DA_DONG_GOI: "Đã đóng gói",
    DA_BAN_GIAO_VAN_CHUYEN: "Đã bàn giao vận chuyển",
    DA_GIAO: "Đã giao",
    GIAO_KHONG_THANH_CONG: "Giao không thành công",
    HOAN_VE: "Hoàn về",
    HUY: "Đã hủy",
    CAN_BO_SUNG_THONG_TIN: "Cần xác nhận thông tin nhận",
  };

  function needsShipping(r) {
    return (
      r.delivery === "hard" &&
      r.status === "da_cap" &&
      (r.hard_fulfillment_status === "CAN_BO_SUNG_THONG_TIN" ||
        !r.ship_full_name || !r.ship_phone || !r.ship_address || !r.ship_province)
    );
  }

  function shipFormHtml(r) {
    return `<form class="order-form cert-ship-form" data-ship-form="${esc(r.order_code)}">
        <p><strong>Vui lòng xác nhận thông tin nhận chứng nhận</strong></p>
        <label>Họ tên người nhận<input name="full_name" required minlength="2" value="${esc(r.ship_full_name || "")}" /></label>
        <label>Số điện thoại<input name="phone" type="tel" required minlength="8" value="${esc(r.ship_phone || "")}" /></label>
        <label>Địa chỉ nhận<input name="address" required value="${esc(r.ship_address || "")}" /></label>
        <label>Tỉnh / thành phố<input name="province" required value="${esc(r.ship_province || "")}" /></label>
        <label>Ghi chú (không bắt buộc)<input name="note" value="${esc(r.ship_note || "")}" /></label>
        <button type="submit" class="btn btn--amber">Xác nhận thông tin nhận</button>
        <p class="form-msg" data-msg role="status"></p>
      </form>`;
  }

  function regsHtml(regs) {
    const rows = (regs || []).filter((r) => r.status === "cho_du_dieu_kien" || needsShipping(r));
    if (!rows.length) return "";
    return rows
      .map((r) => {
        const kind = r.delivery === "hard" ? "bản cứng" : "bản PDF";
        const body =
          r.status === "cho_du_dieu_kien"
            ? `<p class="meta">Đã đăng ký nhận giấy chứng nhận ${kind} · <strong>Chờ đủ điều kiện</strong></p>
               <p class="meta">Hoàn thành khóa học và đạt yêu cầu kiểm tra — hệ thống tự cấp chứng nhận, không cần tạo đơn mới.</p>
               <p class="cert-mine-actions"><a class="btn btn--line" href="../hoc-tap/">Tiếp tục học</a></p>`
            : `<p class="meta">🎓 Chứng nhận <code>${esc(r.cert_code || "")}</code> đã được cấp. Bản cứng sẽ được gửi sau khi bạn xác nhận thông tin nhận.</p>
               ${shipFormHtml(r)}`;
        return `<article class="cert-mine-card">
          <p class="kicker">${esc(r.course_code)} · Đơn ${esc(r.order_code)}</p>
          <h2>${esc(r.course_title || "Khóa học")}</h2>
          ${body}
        </article>`;
      })
      .join("");
  }

  /* Checklist điều kiện nhận GCN — dữ liệu từ Eligibility Engine phía máy chủ */
  function eligHtml(elig) {
    const rows = (elig || []).filter(
      (r) => !r.eligible && !["valid", "issued", "eligible"].includes(r.certificate_status || "")
    );
    if (!rows.length) return "";
    const item = (ok, text) =>
      `<li class="${ok ? "is-ok" : "is-missing"}"><span aria-hidden="true">${ok ? "☑" : "☐"}</span> ${text}</li>`;
    return rows
      .map((r) => {
        const missing = r.missing || [];
        const regVi =
          r.registration_status === "cho_du_dieu_kien"
            ? "Đã đăng ký nhận giấy chứng nhận · chờ đủ điều kiện"
            : r.registration_status === "cho_thanh_toan"
              ? "Đăng ký nhận giấy chứng nhận · chờ thanh toán"
              : "Chưa đăng ký nhận giấy chứng nhận (có thể đăng ký sau khi đủ điều kiện)";
        const revoked = missing.includes("revoked");
        return `<article class="cert-mine-card cert-mine-card--progress">
          <p class="kicker">${esc(r.course_code)} · Tiến trình nhận giấy chứng nhận</p>
          <h2>${esc(r.course_title || "Khóa học")}</h2>
          ${
            revoked
              ? `<p class="meta">Giấy chứng nhận của khóa này đã bị thu hồi. Liên hệ SA247 nếu cần xem xét cấp lại.</p>`
              : `<ul class="cert-checklist">
              ${item(!missing.includes("enrollment"), "Quyền học hợp lệ")}
              ${item(
                !missing.includes("progress"),
                `Hoàn thành bài học: <strong>${esc(r.progress_percent ?? 0)}%</strong> / yêu cầu ${esc(r.progress_required ?? 100)}%`
              )}
              ${item(
                !missing.includes("final_quiz") && !missing.includes("final_quiz_not_configured"),
                `Bài kiểm tra cuối khóa${r.final_pass_percent ? ` (đạt từ ${esc(r.final_pass_percent)}%)` : ""}${
                  r.final_best_score != null ? ` · điểm cao nhất ${esc(r.final_best_score)}%` : ""
                }`
              )}
            </ul>
            <p class="meta">${esc(regVi)}</p>
            <p class="cert-mine-actions"><a class="btn btn--line" href="../hoc/?course=${encodeURIComponent(r.course_code)}">Tiếp tục học</a>
              <a class="btn btn--line" href="../kiem-tra/?course=${encodeURIComponent(r.course_code)}">Kiểm tra cuối khóa</a></p>`
          }
        </article>`;
      })
      .join("");
  }

  function paint(list, prices, ships, regs, elig) {
    const box = el("cert-list");
    const status = el("cert-status");
    const pdfL = prices?.pdf ? ` · ${prices.pdf}` : "";
    const hardL = (prices?.hard ? ` · ${prices.hard}` : "") + (prices?.ship ? ` + ${prices.ship} phí vận chuyển` : "");
    const regBlock = regsHtml(regs) + eligHtml(elig);
    if (!list?.length) {
      status.innerHTML = regBlock
        ? "Bạn đã đăng ký nhận giấy chứng nhận. Chứng nhận được cấp tự động khi bạn đủ điều kiện."
        : `Chứng nhận mở sau khi bạn hoàn thành khóa học và đạt bài kiểm tra. Học phí${prices?.course ? ` ${prices.course}` : ""} không gồm GCN. <a href="../kiem-tra/">Xem bài kiểm tra</a>`;
      box.innerHTML = regBlock;
      return;
    }
    status.textContent = `${list.length} bản ghi chứng nhận trong hồ sơ của bạn.`;
    box.innerHTML = regBlock + list
      .map((c) => {
        const code = encodeURIComponent(c.cert_code || "");
        const courseQ = encodeURIComponent(c.course_code || "");
        const issued = c.status === "valid" || c.status === "issued";
        const eligible = c.status === "eligible";
        const replaced = c.status === "replaced";
        return `<article class="cert-mine-card">
          <p class="kicker">${esc(c.course_code)}</p>
          <h2>${esc(c.course_title || "Khóa học")}</h2>
          <dl class="cert-mine-meta">
            <div><dt>Mã chứng nhận</dt><dd><code>${esc(c.cert_code || "—")}</code></dd></div>
            <div><dt>Ngày</dt><dd>${esc(fmtDate(c.issued_at))}</dd></div>
            <div><dt>Trạng thái</dt><dd>${esc(statusVi(c.status))}</dd></div>
            ${c.score_percent != null ? `<div><dt>Điểm</dt><dd>${esc(c.score_percent)}%</dd></div>` : ""}
            ${c.delivery_type ? `<div><dt>Hình thức</dt><dd>${c.delivery_type === "hard" ? "Bản cứng" : "PDF"}</dd></div>` : ""}
            ${c.program_name ? `<div><dt>Chương trình</dt><dd>${esc(c.program_name)}</dd></div>` : ""}
          </dl>
          ${
            issued
              ? `<p class="cert-mine-actions">
                  <a class="btn btn--amber" href="../xac-minh/chung-nhan.html?code=${code}">Xem chứng nhận</a>
                  <button type="button" class="btn btn--line" data-pdf="${esc(c.cert_code)}">Tải PDF (15 phút)</button>
                  <a class="btn btn--line" href="../xac-minh/?code=${code}">Xác minh</a>
                  ${
                    c.can_buy_hard
                      ? `<a class="btn btn--line" href="./mua.html?course=${courseQ}&amp;type=cert_hard">Đăng ký nhận giấy chứng nhận bản cứng${hardL}</a>`
                      : ""
                  }
                </p>`
              : eligible
                ? `<p class="cert-mine-actions">
                    ${
                      c.can_claim_program_cert
                        ? `<button type="button" class="btn btn--amber" data-free-cert="${esc(c.course_code)}">Nhận chứng nhận miễn phí (chương trình đối tác)</button>`
                        : `<p class="meta">🎓 Bạn đã đủ điều kiện nhận giấy chứng nhận. Phí cấp giấy chứng nhận không gồm lại học phí.</p>
                    <a class="btn btn--amber" href="./mua.html?course=${courseQ}&amp;type=cert_pdf">Đăng ký nhận giấy chứng nhận PDF${pdfL}</a>
                    <a class="btn btn--line" href="./mua.html?course=${courseQ}&amp;type=cert_hard">Đăng ký nhận giấy chứng nhận bản cứng${hardL}</a>
                    <a class="btn btn--line" href="./mua.html?course=${courseQ}">Chọn hình thức nhận</a>`
                    }
                  </p>`
                : replaced
                  ? `<p class="meta">Mã này đã được thay thế — dùng mã chứng nhận mới trong danh sách.</p>`
                  : `<p class="meta">Đã thu hồi${c.revoke_reason ? ": " + esc(c.revoke_reason) : ""}.</p>`
          }
          ${(ships || [])
            .filter((s) => s.course_code === c.course_code)
            .map(
              (s) =>
                `<p class="meta">Bản cứng · ${esc(HARD_VI[s.hard_fulfillment_status] || s.hard_fulfillment_status || "đang xử lý")}${
                  s.tracking_code ? " · vận đơn " + esc(s.tracking_code) : ""
                }${s.carrier_name ? " · " + esc(s.carrier_name) : ""}</p>`
            )
            .join("")}
        </article>`;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (window.sa247LearnerBoot) {
      await sa247LearnerBoot.bindChrome();
    } else {
      await bindLogout();
      el("menu-toggle")?.addEventListener("click", () => {
        document.querySelector(".app-shell")?.classList.toggle("is-side-open");
      });
    }
    if (!window.sa247Auth?.ready) {
      el("cert-status").innerHTML =
        'Thiếu cấu hình. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    const session = await sa247Auth.getSession();
    if (!session) {
      el("cert-status").innerHTML =
        'Cần đăng nhập. <a href="../auth/login.html">Đăng nhập</a>';
      return;
    }
    if (window.sa247LearnerBoot) await sa247LearnerBoot.paintUser(session);
    else el("user-label").textContent = session.user.email || "Học viên";
    const sb = await sa247Auth.ensureClient();
    let list = null;
    const rpc = await sb.rpc("list_my_certificates");
    if (!rpc.error) {
      list = rpc.data || [];
    } else {
      let res = await sb
        .from("certificates")
        .select(
          "cert_code,full_name,score_percent,issued_at,status,delivery_type,revoked_at,revoke_reason,course:courses(code,title,slug)"
        )
        .order("issued_at", { ascending: false });
      if (res.error) {
        res = await sb
          .from("certificates")
          .select("cert_code,full_name,score_percent,issued_at,course:courses(code,title,slug)")
          .order("issued_at", { ascending: false });
        if (res.error) {
          el("cert-status").textContent = res.error.message;
          return;
        }
      }
      list = (res.data || []).map((c) => ({
        cert_code: c.cert_code,
        full_name: c.full_name,
        score_percent: c.score_percent,
        issued_at: c.issued_at,
        status: c.status || "issued",
        delivery_type: c.delivery_type,
        revoked_at: c.revoked_at,
        revoke_reason: c.revoke_reason,
        course_code: c.course?.code,
        course_title: c.course?.title,
        course_slug: c.course?.slug,
        can_buy_pdf: (c.status || "issued") === "eligible",
        can_buy_hard:
          (c.status || "") === "eligible" ||
          (((c.status || "") === "valid" || (c.status || "") === "issued") &&
            c.delivery_type !== "hard"),
      }));
    }
    const prices = await loadCertPriceLabels(sb);
    let ships = [];
    try {
      const shipRpc = await sb.rpc("my_hard_shipments");
      if (!shipRpc.error && Array.isArray(shipRpc.data)) ships = shipRpc.data;
    } catch (_) {}
    let regs = [];
    try {
      const regRpc = await sb.rpc("my_cert_registrations");
      if (!regRpc.error && Array.isArray(regRpc.data)) regs = regRpc.data;
    } catch (_) {}
    let elig = [];
    try {
      const eligRpc = await sb.rpc("get_my_certificate_eligibility");
      if (!eligRpc.error && Array.isArray(eligRpc.data)) elig = eligRpc.data;
    } catch (_) {}
    paint(list || [], prices, ships, regs, elig);
    el("cert-list")?.addEventListener("submit", async (ev) => {
      const form = ev.target.closest("[data-ship-form]");
      if (!form) return;
      ev.preventDefault();
      const msg = form.querySelector("[data-msg]");
      const fd = new FormData(form);
      const ship = {};
      ["full_name", "phone", "address", "province", "note"].forEach((k) => {
        ship[k] = String(fd.get(k) || "").trim();
      });
      if (msg) msg.textContent = "Đang lưu…";
      const { error } = await sb.rpc("submit_cert_shipping", {
        p_order_code: form.getAttribute("data-ship-form"),
        p_ship: ship,
      });
      if (error) {
        if (msg) {
          msg.textContent = /SHIP_ADDRESS_REQUIRED/.test(error.message)
            ? "Vui lòng nhập đủ họ tên, số điện thoại, địa chỉ và tỉnh / thành phố."
            : /shipping_locked/.test(error.message)
              ? "Đơn đã chuyển sang in / giao — liên hệ hỗ trợ để đổi thông tin."
              : error.message;
        }
        return;
      }
      if (msg) msg.textContent = "Đã xác nhận. SA247 sẽ in và gửi giấy chứng nhận bản cứng cho bạn.";
      setTimeout(() => location.reload(), 1200);
    });
    el("cert-list")?.addEventListener("click", async (ev) => {
      const freeBtn = ev.target.closest("[data-free-cert]");
      if (freeBtn) {
        freeBtn.disabled = true;
        const prev = freeBtn.textContent;
        freeBtn.textContent = "Đang kiểm tra quyền lợi…";
        try {
          const { data, error } = await sb.rpc("claim_program_certificate", {
            p_course_code: freeBtn.getAttribute("data-free-cert"),
          });
          if (error) throw error;
          freeBtn.textContent = "Đã cấp chứng nhận miễn phí";
          setTimeout(() => location.reload(), 800);
        } catch (e) {
          const m = String(e?.message || "");
          freeBtn.disabled = false;
          freeBtn.textContent = /no_free_cert_benefit/.test(m)
            ? "Khóa này không thuộc chương trình miễn phí"
            : /not_eligible/.test(m)
              ? "Cần đạt kỳ thi trước"
              : m || prev;
        }
        return;
      }
      const btn = ev.target.closest("[data-pdf]");
      if (!btn) return;
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Đang tạo link…";
      try {
        const { data, error } = await sb.functions.invoke("certificate-download", {
          body: { cert_code: btn.getAttribute("data-pdf") },
        });
        if (error || !data?.url) {
          btn.textContent = "PDF chưa sẵn sàng";
          btn.disabled = false;
          return;
        }
        window.open(data.url, "_blank", "noopener");
        btn.textContent = "Đã mở link 15 phút";
      } catch (_) {
        btn.textContent = prev;
        btn.disabled = false;
      }
    });
  });
})();
