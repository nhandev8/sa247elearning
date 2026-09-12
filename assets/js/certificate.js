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
    const u = new URL("./", location.href);
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

  async function renderQr(container, text) {
    container.innerHTML = "";
    if (typeof QRCode === "undefined") {
      container.textContent = "QR";
      return;
    }
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    await QRCode.toCanvas(canvas, text, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1f3a", light: "#ffffff" },
    });
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
    el("cert-phoi").alt = `Giấy chứng nhận ${prog.code}`;
    el("cert-name").textContent = data.full_name || "—";
    el("cert-code").textContent = code;
    el("cert-date").textContent = fmtDate(data.issued_at);
    el("toolbar-code").textContent = code;
    el("btn-verify").href = `./?code=${encodeURIComponent(code)}`;
    el("btn-print").hidden = false;
    el("showcase-stage").hidden = true;
    el("cert-stage").hidden = false;
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
      throw new Error(
        "Không tìm thấy chứng nhận hợp lệ. Giấy chỉ hiển thị sau khi hệ thống đã cấp."
      );
    }
    const prog = findProgram(map, data.course_code);
    if (!prog) throw new Error(`Chưa có phôi thiết kế cho khóa ${data.course_code}.`);
    await renderIssued(data, prog);
    el("cert-status").textContent =
      "Chứng nhận đã cấp — dữ liệu từ hồ sơ học viên. Có thể in hoặc lưu PDF.";
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
