/* SA247 certificate view
 * - Form mẫu (?sample=): trưng bày thiết kế — không điền dữ liệu
 * - Phôi + overlay (?code=): chỉ khi verify_certificate hợp lệ (hệ thống đã cấp)
 */
(function () {
  const CERT_PROGRAMS_URL = "../assets/certificates/programs.json";
  const ASSETS = "../assets/certificates/";

  function el(id) {
    return document.getElementById(id);
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("vi-VN");
    } catch {
      return iso || "";
    }
  }

  function verifyPageUrl(code) {
    // URL tuyệt đối để QR mở đúng trang xác minh (không phụ thuộc path tương đối)
    const u = new URL("../xac-minh/", location.href);
    u.searchParams.set("code", code);
    return u.href;
  }

  function findProgram(map, courseCode) {
    return (map?.programs || []).find((p) => p.code === courseCode) || null;
  }

  async function loadProgramMap() {
    const res = await fetch(CERT_PROGRAMS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Không tải được danh mục chứng nhận.");
    return res.json();
  }

  function qrImageFallback(container, text) {
    const img = document.createElement("img");
    img.alt = "Mã QR xác minh chứng nhận";
    img.decoding = "async";
    img.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=0&ecc=M&data=" +
      encodeURIComponent(text);
    container.appendChild(img);
  }

  /** Chỉ giữ một ảnh QR căn giữa khung — bỏ canvas/table thừa của thư viện. */
  function finalizeQrDom(container) {
    const img = container.querySelector("img");
    const canvas = container.querySelector("canvas");
    let src = "";
    if (img && img.src) src = img.src;
    else if (canvas) {
      try {
        src = canvas.toDataURL("image/png");
      } catch (_) {
        /* ignore */
      }
    }
    container.innerHTML = "";
    if (!src) return false;
    const out = document.createElement("img");
    out.alt = "Mã QR xác minh chứng nhận";
    out.src = src;
    out.decoding = "async";
    container.appendChild(out);
    return true;
  }

  async function renderQr(container, text) {
    container.innerHTML = "";
    const size = 256;

    // node-qrcode (toCanvas)
    if (typeof QRCode !== "undefined" && typeof QRCode.toCanvas === "function") {
      try {
        const canvas = document.createElement("canvas");
        container.appendChild(canvas);
        await QRCode.toCanvas(canvas, text, {
          width: size,
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#0b1f3a", light: "#ffffff" },
        });
        if (finalizeQrDom(container)) return;
      } catch (_) {
        container.innerHTML = "";
      }
    }

    // qrcodejs (davidshimjs)
    if (typeof QRCode === "function" || (typeof QRCode !== "undefined" && QRCode.CorrectLevel)) {
      try {
        const holder = document.createElement("div");
        holder.style.position = "absolute";
        holder.style.left = "-9999px";
        holder.style.width = size + "px";
        holder.style.height = size + "px";
        document.body.appendChild(holder);
        // eslint-disable-next-line no-new
        new QRCode(holder, {
          text,
          width: size,
          height: size,
          colorDark: "#0b1f3a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : 2,
        });
        // đợi img data URL (qrcodejs vẽ async nhẹ)
        await new Promise((r) => setTimeout(r, 30));
        const okImg = holder.querySelector("img");
        const okCanvas = holder.querySelector("canvas");
        let src = okImg?.src || "";
        if (!src && okCanvas) {
          try {
            src = okCanvas.toDataURL("image/png");
          } catch (_) {
            /* ignore */
          }
        }
        holder.remove();
        if (src) {
          const out = document.createElement("img");
          out.alt = "Mã QR xác minh chứng nhận";
          out.src = src;
          container.appendChild(out);
          return;
        }
      } catch (_) {
        container.innerHTML = "";
      }
    }

    qrImageFallback(container, text);
  }

  function showFormMau(prog) {
    el("showcase-img").src = ASSETS + prog.form_mau;
    el("showcase-img").alt = `Form mẫu giấy chứng nhận ${prog.code}`;
    el("toolbar-code").textContent = `Form mẫu · ${prog.code}`;
    el("btn-verify").href = "./";
    el("btn-print").hidden = true;
    el("cert-stage").hidden = true;
    el("showcase-stage").hidden = false;
  }

  async function renderIssued(data, prog) {
    const code = data.cert_code;
    el("cert-phoi").src = ASSETS + prog.phoi;
    el("cert-phoi").alt = `Giấy chứng nhận hoàn thành khóa học ${prog.code}`;
    el("cert-name").textContent = data.full_name || "—";
    el("cert-code").textContent = code;
    el("cert-date").textContent = fmtDate(data.issued_at);
    let progLine = el("cert-program");
    if (!progLine) {
      progLine = document.createElement("p");
      progLine.id = "cert-program";
      progLine.className = "cert-disclaimer";
      el("cert-stage")?.after(progLine);
    }
    const issuer = data.issuer && data.issuer.display_name ? data.issuer : null;
    if (data.program_name || issuer) {
      progLine.hidden = false;
      progLine.textContent =
        (data.program_name ? "Thuộc " + data.program_name : "Đơn vị: " + issuer.display_name) +
        (data.member_code ? " · Mã sinh viên / đối tượng: " + data.member_code : "") +
        (issuer
          ? " · Cấp cho học viên của " + issuer.display_name + " · " + (issuer.platform_note || "Vận hành trên nền tảng SA247") + "."
          : " · do SA247 E-Learning tổ chức.");
    } else {
      progLine.hidden = true;
      progLine.textContent = "";
    }
    el("toolbar-code").textContent = code;
    el("btn-verify").href = `./?code=${encodeURIComponent(code)}`;
    el("btn-print").hidden = false;
    el("showcase-stage").hidden = true;
    el("cert-stage").hidden = false;
    const disc = el("cert-disclaimer");
    if (disc) {
      disc.hidden = false;
      disc.textContent =
        data.legal_disclaimer ||
        "Giấy chứng nhận này không thay thế văn bằng, chứng chỉ, giấy phép hoặc giấy chứng nhận bắt buộc theo quy định pháp luật, nếu có.";
    }
    await renderQr(el("cert-qr"), verifyPageUrl(code));
  }

  /** Khóa riêng của đơn vị — không có phôi thiết kế: dựng giấy bằng HTML từ dữ liệu hệ thống. */
  async function renderGeneric(data, map) {
    const code = data.cert_code;
    const issuer = data.issuer && data.issuer.display_name ? data.issuer : null;
    const sheet = el("certificate");
    sheet.classList.add("cert-sheet--generic");
    if (issuer?.primary_color) sheet.style.setProperty("--cg-c1", issuer.primary_color);
    if (issuer?.accent_color) sheet.style.setProperty("--cg-c2", issuer.accent_color);
    sheet.innerHTML = "";
    const add = (tag, cls, text, parent) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      (parent || sheet).appendChild(n);
      return n;
    };
    const head = add("div", "cg-head");
    if (issuer?.logo_url) {
      const img = add("img", "cg-logo", null, head);
      img.src = issuer.logo_url;
      img.alt = issuer.display_name;
      img.referrerPolicy = "no-referrer";
    }
    add("div", "cg-org", issuer ? issuer.display_name : map.academy || "Safety and You 247 Academy", head);
    add("h1", "cg-title", "GIẤY CHỨNG NHẬN");
    add("p", "cg-sub", "Hoàn thành khóa học");
    add("p", "cg-lead", "Chứng nhận học viên");
    add("div", "cg-name", data.full_name || "—");
    add("p", "cg-lead", "đã hoàn thành và đạt yêu cầu kiểm tra khóa học");
    add("div", "cg-course", data.course_title || data.course_code);
    if (data.program_name) add("p", "cg-meta", "Thuộc " + data.program_name + (data.member_code ? " · Mã: " + data.member_code : ""));
    const foot = add("div", "cg-foot");
    const left = add("div", "cg-verify", null, foot);
    const qr = add("div", "cg-qr", null, left);
    add("div", "cg-code", "Mã: " + code, left);
    add("div", "cg-date", "Ngày cấp: " + fmtDate(data.issued_at), left);
    const sign = add("div", "cg-sign", null, foot);
    add("div", "cg-sign-title", issuer?.cert_signer_title || (issuer ? "Đại diện " + issuer.display_name : map.issuer_title || ""), sign);
    add("div", "cg-sign-name", issuer?.cert_signer_name || (issuer ? "" : map.issuer_name || ""), sign);
    add("p", "cg-platform", issuer ? issuer.platform_note || "Vận hành trên nền tảng SA247" : "SA247 E-Learning · sa247.vn");

    el("toolbar-code").textContent = code;
    el("btn-verify").href = `./?code=${encodeURIComponent(code)}`;
    el("btn-print").hidden = false;
    el("showcase-stage").hidden = true;
    el("cert-stage").hidden = false;
    const disc = el("cert-disclaimer");
    if (disc) {
      disc.hidden = false;
      disc.textContent =
        data.legal_disclaimer ||
        "Giấy chứng nhận này không thay thế văn bằng, chứng chỉ, giấy phép hoặc giấy chứng nhận bắt buộc theo quy định pháp luật, nếu có.";
    }
    await renderQr(qr, verifyPageUrl(code));
  }

  async function loadLive(code, map) {
    if (!window.sa247Auth?.ready) throw new Error("Thiếu cấu hình Supabase.");
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("verify_certificate", {
      p_cert_code: code,
    });
    if (error) throw new Error(error.message);
    if (!data?.valid) {
      const reason = data?.reason;
      if (reason === "revoked") {
        throw new Error("Chứng nhận đã thu hồi — không hiển thị phôi.");
      }
      if (reason === "replaced") {
        throw new Error("Mã đã được thay thế — dùng mã chứng nhận mới.");
      }
      if (reason === "rate_limited") {
        throw new Error("Tra cứu quá nhiều lần. Vui lòng đợi khoảng 10 phút rồi tải lại.");
      }
      throw new Error(
        "Không tìm thấy chứng nhận hợp lệ. Giấy chỉ hiển thị sau khi hệ thống đã cấp."
      );
    }
    const prog = findProgram(map, data.course_code);
    if (prog) await renderIssued(data, prog);
    else await renderGeneric(data, map);
    el("cert-status").textContent =
      "Giấy chứng nhận hoàn thành khóa học · " +
      (data.issuer?.display_name || "Safety and You 247 Academy") +
      " — dữ liệu từ hồ sơ. Có thể in hoặc lưu PDF.";
  }

  function loadFormSample(courseCode, map) {
    const prog = findProgram(map, courseCode) || (map.programs || [])[0];
    if (!prog) throw new Error("Không có form mẫu chương trình.");
    showFormMau(prog);
    el("cert-status").textContent =
      `Form mẫu trưng bày cho ${prog.code}. Không phải chứng nhận đã cấp — không điền tên, ngày hay mã trên phôi.`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const code = (params.get("code") || "").trim();
    const sample = (params.get("sample") || "").trim();
    const status = el("cert-status");

    el("btn-print")?.addEventListener("click", () => window.print());

    try {
      const map = await loadProgramMap();
      if (code) await loadLive(code, map);
      else if (sample) loadFormSample(sample, map);
      else {
        status.innerHTML =
          'Mở giấy đã cấp bằng <code>?code=…</code> (mã hệ thống sinh). ' +
          'Xem form mẫu thiết kế: <a href="?sample=ATNM-01">ATNM-01</a>.';
      }
    } catch (err) {
      status.textContent = err?.message || String(err);
    }
  });
})();
