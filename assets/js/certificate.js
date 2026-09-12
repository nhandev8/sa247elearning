/* SA247 certificate: Form mẫu (showcase) + Phôi overlay (print) */
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

  function setPhoi(prog) {
    const img = el("cert-phoi");
    img.src = ASSETS + prog.phoi;
    img.alt = `Phôi giấy chứng nhận ${prog.code}`;
  }

  async function fillPhoi(data, prog) {
    const code = data.cert_code;
    setPhoi(prog);
    el("cert-name").textContent = data.full_name || "—";
    el("cert-code").textContent = code;
    el("cert-date").textContent = fmtDate(data.issued_at);
    el("toolbar-code").textContent = code;
    el("btn-verify").href = `./?code=${encodeURIComponent(code)}`;
    el("showcase-stage").hidden = true;
    el("cert-stage").hidden = false;
    await renderQr(el("cert-qr"), verifyPageUrl(code));
  }

  function showFormMau(prog) {
    el("showcase-img").src = ASSETS + prog.form_mau;
    el("showcase-img").alt = `Mẫu giấy chứng nhận ${prog.code}`;
    el("toolbar-code").textContent = prog.code;
    el("btn-verify").href = "./";
    el("cert-stage").hidden = true;
    el("showcase-stage").hidden = false;
  }

  async function loadLive(code, map) {
    if (!window.sa247Auth?.ready) throw new Error("Thiếu cấu hình Supabase.");
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("verify_certificate", {
      p_cert_code: code,
    });
    if (error) throw new Error(error.message);
    if (!data?.valid) throw new Error("Không tìm thấy chứng nhận hợp lệ.");
    const prog = findProgram(map, data.course_code);
    if (!prog) throw new Error(`Chưa có phôi cho khóa ${data.course_code}.`);
    el("certificate").classList.remove("is-sample");
    await fillPhoi(data, prog);
    el("cert-status").textContent =
      "Hợp lệ — phôi đã điền tên, ngày cấp, mã chứng nhận và QR. In hoặc Save as PDF.";
  }

  async function loadSample(courseCode, map, mode) {
    const prog = findProgram(map, courseCode) || (map.programs || [])[0];
    if (!prog) throw new Error("Không có mẫu chương trình.");

    if (mode === "phoi") {
      const sampleCode = `SA247-${prog.stub}-MAU000`;
      el("certificate").classList.add("is-sample");
      await fillPhoi(
        {
          full_name: "Nguyễn Văn A",
          cert_code: sampleCode,
          issued_at: "2026-09-12T00:00:00+07:00",
          course_code: prog.code,
        },
        prog
      );
      el("cert-status").innerHTML =
        `Phôi điền thử cho <strong>${prog.code}</strong>. ` +
        `Xem form trưng bày: <a href="?sample=${encodeURIComponent(prog.code)}">Form mẫu</a>.`;
      return;
    }

    showFormMau(prog);
    el("cert-status").innerHTML =
      `Form mẫu trưng bày cho <strong>${prog.code}</strong>. ` +
      `Thử phôi in (chèn tên/ngày/mã/QR): <a href="?sample=${encodeURIComponent(prog.code)}&mode=phoi">Điền thử phôi</a>.`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const code = (params.get("code") || "").trim();
    const sample = (params.get("sample") || "").trim();
    const mode = (params.get("mode") || "").trim();
    const status = el("cert-status");

    el("btn-print")?.addEventListener("click", () => window.print());

    try {
      const map = await loadProgramMap();
      if (code) await loadLive(code, map);
      else if (sample) await loadSample(sample, map, mode);
      else {
        status.innerHTML =
          'Thiếu mã chứng nhận. Thêm <code>?code=…</code> hoặc xem mẫu: ' +
          '<a href="?sample=ATNM-01">Form mẫu ATNM-01</a> · ' +
          '<a href="?sample=ATNM-01&mode=phoi">Phôi điền thử</a>.';
      }
    } catch (err) {
      status.textContent = err?.message || String(err);
    }
  });
})();
