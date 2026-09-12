/* SA247 printable certificate view + QR by cert_code */
(function () {
  const CERT_PROGRAMS_URL = "../assets/certificates/programs.json";

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
    const u = new URL("../verify/", location.href);
    u.searchParams.set("code", code);
    return u.href;
  }

  function certTitleFromMap(map, courseCode, fallback) {
    const hit = (map?.programs || []).find((p) => p.code === courseCode);
    return hit?.cert_title || (fallback || courseCode || "").toUpperCase();
  }

  async function loadProgramMap() {
    try {
      const res = await fetch(CERT_PROGRAMS_URL, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1f3a", light: "#ffffff" },
    });
  }

  function fillCertificate(data, map) {
    const code = data.cert_code;
    const verifyUrl = verifyPageUrl(code);
    el("cert-name").textContent = data.full_name || "—";
    el("cert-course").textContent = certTitleFromMap(
      map,
      data.course_code,
      data.course_title
    );
    el("cert-course-code").textContent = data.course_code || "—";
    el("cert-code").textContent = code;
    el("cert-date").textContent = fmtDate(data.issued_at);
    el("toolbar-code").textContent = code;
    el("btn-verify").href = `./?code=${encodeURIComponent(code)}`;
    el("cert-verify-url").textContent = "Quét QR để xác minh chứng nhận";
    el("cert-stage").hidden = false;
    return renderQr(el("cert-qr"), verifyUrl);
  }

  async function loadLive(code, map) {
    if (!window.sa247Auth?.ready) {
      throw new Error("Thiếu cấu hình Supabase.");
    }
    const sb = await sa247Auth.ensureClient();
    const { data, error } = await sb.rpc("verify_certificate", {
      p_cert_code: code,
    });
    if (error) throw new Error(error.message);
    if (!data?.valid) throw new Error("Không tìm thấy chứng nhận hợp lệ.");
    await fillCertificate(data, map);
    el("cert-status").textContent =
      "Hợp lệ — bạn có thể in hoặc lưu PDF (In → Save as PDF).";
  }

  async function loadSample(courseCode, map) {
    const prog =
      (map?.programs || []).find((p) => p.code === courseCode) ||
      (map?.programs || [])[0];
    if (!prog) throw new Error("Không có mẫu chương trình.");
    const stub = courseCode.replace(/-/g, "");
    const sampleCode = `SA247-${stub}-MAU000`;
    const data = {
      valid: true,
      full_name: "Nguyễn Văn A",
      course_code: prog.code,
      course_title: prog.title,
      cert_code: sampleCode,
      issued_at: "2026-09-12T00:00:00+07:00",
      score_percent: 100,
    };
    el("certificate").classList.add("is-sample");
    await fillCertificate(data, map);
    el("cert-status").textContent =
      `Mẫu minh họa cho ${prog.code}. QR trỏ về trang xác minh với mã mẫu (không phải chứng nhận đã cấp).`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const code = (params.get("code") || "").trim();
    const sample = (params.get("sample") || "").trim();
    const status = el("cert-status");

    el("btn-print")?.addEventListener("click", () => window.print());

    try {
      const map = await loadProgramMap();
      if (code) {
        await loadLive(code, map);
      } else if (sample) {
        await loadSample(sample, map);
      } else {
        status.innerHTML =
          'Thiếu mã chứng nhận. Mở từ trang xác minh hoặc thêm <code>?code=…</code>. Xem mẫu: <a href="?sample=ATNM-01">ATNM-01</a>.';
      }
    } catch (err) {
      status.textContent = err?.message || String(err);
    }
  });
})();
