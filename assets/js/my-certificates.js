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
    const fallback = { pdf: "169.000đ", hard: "199.000đ" };
    try {
      const { data, error } = await sb.rpc("get_product_prices");
      if (error || !data || typeof data !== "object") return fallback;
      const pdf = data.cert_pdf?.amount ?? data.cert_pdf;
      const hard = data.cert_hard?.amount ?? data.cert_hard;
      return {
        pdf: pdf != null ? fmtVnd(pdf) : fallback.pdf,
        hard: hard != null ? fmtVnd(hard) : fallback.hard,
      };
    } catch {
      return fallback;
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

  function paint(list, prices, ships) {
    const box = el("cert-list");
    const status = el("cert-status");
    const pdfL = prices?.pdf || "169.000đ";
    const hardL = prices?.hard || "199.000đ";
    if (!list?.length) {
      status.innerHTML =
        'Bạn chưa có chứng nhận / đủ điều kiện nào. Hoàn thành khóa → đạt kỳ thi. <a href="../quiz/">Vào kỳ thi</a>';
      box.innerHTML = "";
      return;
    }
    status.textContent = `${list.length} bản ghi chứng nhận trong hồ sơ của bạn.`;
    box.innerHTML = list
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
          </dl>
          ${
            issued
              ? `<p class="cert-mine-actions">
                  <a class="btn btn--amber" href="../verify/chung-nhan.html?code=${code}">Xem chứng nhận</a>
                  <button type="button" class="btn btn--line" data-pdf="${esc(c.cert_code)}">Tải PDF (15 phút)</button>
                  <a class="btn btn--line" href="../verify/?code=${code}">Xác minh</a>
                  ${
                    c.can_buy_hard
                      ? `<a class="btn btn--line" href="./mua.html?course=${courseQ}&amp;type=cert_hard">Đăng ký bản cứng · ${hardL} + ship</a>`
                      : ""
                  }
                </p>`
              : eligible
                ? `<p class="cert-mine-actions">
                    <a class="btn btn--amber" href="./mua.html?course=${courseQ}&amp;type=cert_pdf">PDF điện tử · ${pdfL}</a>
                    <a class="btn btn--line" href="./mua.html?course=${courseQ}&amp;type=cert_hard">Bản cứng · ${hardL} + ship</a>
                    <a class="btn btn--line" href="./mua.html?course=${courseQ}">Chọn hình thức nhận</a>
                  </p>`
                : replaced
                  ? `<p class="meta">Mã này đã được thay thế — dùng mã chứng nhận mới trong danh sách.</p>`
                  : `<p class="meta">Đã thu hồi${c.revoke_reason ? ": " + esc(c.revoke_reason) : ""}.</p>`
          }
          ${(ships || [])
            .filter((s) => s.course_code === c.course_code)
            .map(
              (s) =>
                `<p class="meta">Bản cứng · ${esc(s.hard_fulfillment_status || s.status || "đang xử lý")}${
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
    paint(list || [], prices, ships);
    el("cert-list")?.addEventListener("click", async (ev) => {
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
