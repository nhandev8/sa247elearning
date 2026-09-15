/* SA247 · Hồ sơ học viên */
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function setAvatarPreview(url, name) {
    const box = el("avatar-preview");
    if (!box) return;
    const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
    if (url) {
      box.innerHTML = `<img src="${esc(url)}" alt="" />`;
      box.classList.add("has-img");
    } else {
      box.innerHTML = `<span>${esc(initial)}</span>`;
      box.classList.remove("has-img");
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

  async function loadStats(sb, userId) {
    const host = el("profile-stats");
    if (!host) return;
    let learning = 0;
    let done = 0;
    let certs = 0;
    try {
      const { data: enrs } = await sb
        .from("enrollments")
        .select("id,status,course_id")
        .eq("user_id", userId)
        .eq("status", "active");
      learning = (enrs || []).length;
    } catch (_) {}
    try {
      const { data: certRows } = await sb.rpc("list_my_certificates");
      const list = Array.isArray(certRows) ? certRows : [];
      certs = list.filter((c) => c.status === "issued" || c.status === "valid").length;
      done = list.filter(
        (c) =>
          c.status === "issued" ||
          c.status === "valid" ||
          c.status === "eligible"
      ).length;
    } catch (_) {}
    host.innerHTML = `
      <div class="learn-stat"><strong>${learning}</strong><span>Khóa đang học</span></div>
      <div class="learn-stat"><strong>${done}</strong><span>Khóa hoàn thành / đủ ĐK</span></div>
      <div class="learn-stat"><strong>${certs}</strong><span>Chứng nhận đã cấp</span></div>`;
  }

  async function main() {
    el("menu-toggle")?.addEventListener("click", () => {
      document.querySelector(".app-shell")?.classList.toggle("is-side-open");
    });
    await bindLogout();

    const status = el("profile-status");
    if (!window.sa247Auth?.ready) {
      status.textContent = "Chưa cấu hình Supabase.";
      return;
    }

    const session = await sa247Auth.getSession();
    if (!session) {
      location.href = "../auth/login.html?next=" + encodeURIComponent("../ho-so/");
      return;
    }

    const user = session.user;
    el("user-label").textContent = user.email || "Học viên";

    const sb = await sa247Auth.ensureClient();
    const profile = await sa247Auth.getProfile({ session, timeoutMs: 4000 });
    if (!profile) {
      status.textContent = "Không tải được hồ sơ.";
      return;
    }

    const form = el("profile-form");
    const certWrap = el("cert-name-wrap");
    const certInput = el("cert_display_name");
    const msg = el("form-msg");
    form.hidden = false;
    certWrap.hidden = false;
    el("save-btn").hidden = false;
    status.textContent = "Cập nhật thông tin tài khoản và tên in trên chứng nhận.";

    form.full_name.value = profile.full_name || "";
    form.email.value = user.email || "";
    form.phone.value = profile.phone || "";
    certInput.value = profile.cert_display_name || profile.full_name || "";
    setAvatarPreview(profile.avatar_url, profile.full_name);

    const verified = Boolean(user.email_confirmed_at);
    const emailStatus = el("email-status");
    const resendBtn = el("resend-verify");
    if (verified) {
      emailStatus.innerHTML = '<span class="profile-badge is-ok">Đã xác minh</span>';
      resendBtn.hidden = true;
    } else {
      emailStatus.innerHTML =
        '<span class="profile-badge is-warn">Chưa xác minh email</span> — kiểm tra hộp thư hoặc gửi lại.';
      resendBtn.hidden = false;
    }

    let certLocked = false;
    try {
      const { data: locked } = await sb.rpc("learner_has_issued_certificate", {
        p_uid: user.id,
      });
      certLocked = Boolean(locked);
    } catch (_) {
      try {
        const { data: mine } = await sb.rpc("list_my_certificates");
        certLocked = (mine || []).some(
          (c) => c.status === "issued" || c.status === "valid"
        );
      } catch (__) {}
    }
    if (certLocked) {
      certInput.readOnly = true;
      el("cert-lock-note").hidden = false;
    }

    await loadStats(sb, user.id);

    resendBtn?.addEventListener("click", async () => {
      resendBtn.disabled = true;
      msg.textContent = "Đang gửi email xác minh…";
      const { error } = await sa247Auth.resendEmailVerification(user.email);
      if (error) {
        msg.className = "form-msg is-err";
        msg.textContent = error.message || "Không gửi được email.";
        resendBtn.disabled = false;
        return;
      }
      msg.className = "form-msg is-ok";
      msg.textContent = "Đã gửi lại email xác minh. Kiểm tra hộp thư.";
      resendBtn.disabled = false;
    });

    el("avatar-file")?.addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        msg.className = "form-msg is-err";
        msg.textContent = "Ảnh tối đa 2 MB.";
        return;
      }
      msg.textContent = "Đang tải ảnh…";
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/avatar.${ext === "jpeg" ? "jpg" : ext}`;
      const { error: upErr } = await sb.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) {
        msg.className = "form-msg is-err";
        msg.textContent = upErr.message || "Không tải được ảnh.";
        return;
      }
      const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
      const url = pub?.publicUrl ? `${pub.publicUrl}?t=${Date.now()}` : "";
      const { error } = await sa247Auth.updateProfile({ avatar_url: url.split("?")[0] });
      if (error) {
        msg.className = "form-msg is-err";
        msg.textContent = error.message || "Không lưu được ảnh.";
        return;
      }
      setAvatarPreview(url, form.full_name.value);
      msg.className = "form-msg is-ok";
      msg.textContent = "Đã cập nhật ảnh đại diện.";
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fullName = String(form.full_name.value || "").trim();
      const phone = String(form.phone.value || "").trim();
      const certName = String(certInput.value || "").trim();
      if (!fullName) {
        msg.className = "form-msg is-err";
        msg.textContent = "Nhập họ và tên tài khoản.";
        return;
      }
      if (!certLocked && !certName) {
        msg.className = "form-msg is-err";
        msg.textContent = "Nhập họ tên sẽ in trên chứng nhận.";
        return;
      }
      msg.className = "form-msg";
      msg.textContent = "Đang lưu…";
      el("save-btn").disabled = true;
      const patch = { full_name: fullName, phone: phone || null };
      if (!certLocked) patch.cert_display_name = certName;
      const { error } = await sa247Auth.updateProfile(patch);
      el("save-btn").disabled = false;
      if (error) {
        msg.className = "form-msg is-err";
        msg.textContent = error.message || "Không lưu được hồ sơ.";
        return;
      }
      try {
        await sb.auth.updateUser({ data: { full_name: fullName } });
      } catch (_) {}
      setAvatarPreview(profile.avatar_url, fullName);
      msg.className = "form-msg is-ok";
      msg.textContent = "Đã lưu thay đổi.";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => {
      console.error(e);
      el("profile-status").textContent = e.message || String(e);
    });
  });
})();
