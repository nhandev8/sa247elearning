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
    const u = new URL("../verify/", location.href);
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
    img.width = 200;
    img.height = 200;
    img.decoding = "async";
    img.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&ecc=M&data=" +
      encodeURIComponent(text);
    container.appendChild(img);
  }

  async function renderQr(container, text) {
    container.innerHTML = "";
    const size = 200;

    // node-qrcode (toCanvas) — nếu có
    if (typeof QRCode !== "undefined" && typeof QRCode.toCanvas === "function") {
      try {
        const canvas = document.createElement("canvas");
        container.appendChild(canvas);
        await QRCode.toCanvas(canvas, text, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0b1f3a", light: "#ffffff" },
        });
        return;
      } catch (_) {
        container.innerHTML = "";
      }
    }

    // qrcodejs (davidshimjs) — CDN hiện dùng
    if (typeof QRCode === "function" || (typeof QRCode !== "undefined" && QRCode.CorrectLevel)) {
      try {
        // eslint-disable-next-line no-new
        new QRCode(container, {
          text,
          width: size,
          height: size,
          colorDark: "#0b1f3a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 1,
        });
        if (container.querySelector("canvas, img")) return;
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
      throw new Error(
        "Không tìm thấy chứng nhận hợp lệ. Giấy chỉ hiển thị sau khi hệ thống đã cấp."
      );
    }
    const prog = findProgram(map, data.course_code);
    if (!prog) throw new Error(`Chưa có phôi thiết kế cho khóa ${data.course_code}.`);
    await renderIssued(data, prog);
    el("cert-status").textContent =
      "Giấy chứng nhận hoàn thành khóa học · Safety and You 247 Academy — dữ liệu từ hồ sơ. Có thể in hoặc lưu PDF.";
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
