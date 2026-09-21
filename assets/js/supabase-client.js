/* SA247 Supabase browser client (anon key only). */
(function () {
  const cfg = window.SA247_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) {
    console.warn("[SA247] Missing supabase config — set SA247_SUPABASE_URL + ANON_KEY then rebuild.");
    window.sa247Auth = {
      ready: false,
      async getSession() { return null; },
      async hasCourseAccess() { return false; },
    };
    return;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureClient() {
    if (window.__sa247Sb) return window.__sa247Sb;
    if (!window.supabase) {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    window.__sa247Sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
    return window.__sa247Sb;
  }

  async function getSession() {
    const sb = await ensureClient();
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  async function hasCourseAccess(courseId, opts) {
    const sb = await ensureClient();
    const session = await getSession();
    if (!session?.user?.id) return false;
    const uid = session.user.id;
    const code = (opts?.courseCode || "").trim();
    const now = Date.now();

    function rowActive(rows) {
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return false;
      if (row.status && row.status !== "active") return false;
      if (row.expires_at) {
        const t = Date.parse(row.expires_at);
        if (Number.isFinite(t) && t < now) return false;
      }
      return true;
    }

    let cid = courseId || null;
    if (!cid && code) {
      const { data: course, error: cErr } = await sb
        .from("courses")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (cErr) console.warn("[SA247] course resolve", cErr.message);
      cid = course?.id || null;
    }

    if (!cid) return false;

    // Luôn lọc user_id: staff RLS thấy nhiều enrollment → maybeSingle cũ bị lỗi → false
    const { data, error } = await sb
      .from("enrollments")
      .select("id,status,expires_at")
      .eq("user_id", uid)
      .eq("course_id", cid)
      .eq("status", "active")
      .limit(1);
    if (error) {
      console.warn("[SA247] enrollment check", error.message);
      return false;
    }
    return rowActive(data);
  }

  /** Premium lesson rows only return if RLS allows (enrolled). */
  async function fetchLesson(lessonId) {
    const sb = await ensureClient();
    const { data, error } = await sb
      .from("lessons")
      .select("id,title,youtube_video_id,is_free,is_published")
      .eq("id", lessonId)
      .maybeSingle();
    return { data, error };
  }

  const PROFILE_CACHE_KEY = "sa247_profile_v2";
  const PROFILE_SELECT = "id,full_name,role,phone,avatar_url,cert_display_name";
  let profileMem = null;

  function readProfileCache() {
    if (profileMem) return profileMem;
    try {
      const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      profileMem = JSON.parse(raw);
      return profileMem;
    } catch {
      return null;
    }
  }

  function writeProfileCache(profile) {
    profileMem = profile || null;
    try {
      if (profile) sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      else sessionStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  function clearProfileCache() {
    writeProfileCache(null);
  }

  function withTimeout(promise, ms, fallback) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timer)),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  }

  window.sa247Auth = {
    ready: true,
    ensureClient,
    getSession,
    hasCourseAccess,
    fetchLesson,
    STAFF_ROLES: [
      "admin",
      "quan_tri_cao_nhat",
      "quan_tri",
      "quan_ly_noi_dung",
      "giang_vien",
      "kinh_doanh",
    ],
    isStaffRole(role) {
      return window.sa247Auth.STAFF_ROLES.includes(role);
    },
    async getProfile(opts) {
      const timeoutMs = opts?.timeoutMs ?? 2500;
      const cached = readProfileCache();
      let session = opts?.session || null;
      if (!session) {
        session = await withTimeout(getSession(), Math.min(timeoutMs, 1500), null);
      }
      if (!session?.user?.id) {
        writeProfileCache(null);
        return null;
      }
      if (cached && cached.id === session.user.id) {
        ensureClient()
          .then((sb) =>
            sb
              .from("profiles")
              .select(PROFILE_SELECT)
              .eq("id", session.user.id)
              .maybeSingle()
          )
          .then(({ data, error }) => {
            if (!error && data) writeProfileCache(data);
          })
          .catch(() => {});
        return cached;
      }

      const sb = await withTimeout(ensureClient(), 2000, null);
      if (!sb) return cached;
      const result = await withTimeout(
        sb
          .from("profiles")
          .select(PROFILE_SELECT)
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.warn("[SA247] profile", error.message);
              return null;
            }
            return data;
          }),
        timeoutMs,
        cached
      );
      if (result) writeProfileCache(result);
      return result;
    },
    /** Cập nhật hồ sơ học viên (full_name, phone, avatar_url, cert_display_name). */
    async updateProfile(patch) {
      const sb = await ensureClient();
      const session = await getSession();
      if (!session?.user?.id) {
        return { data: null, error: { message: "Bạn chưa đăng nhập." } };
      }
      const allowed = {};
      for (const key of ["full_name", "phone", "avatar_url", "cert_display_name"]) {
        if (Object.prototype.hasOwnProperty.call(patch || {}, key)) {
          allowed[key] = patch[key];
        }
      }
      if (!Object.keys(allowed).length) {
        return { data: null, error: { message: "Không có trường hợp lệ để cập nhật." } };
      }
      const { data, error } = await sb
        .from("profiles")
        .update(allowed)
        .eq("id", session.user.id)
        .select(PROFILE_SELECT)
        .maybeSingle();
      if (!error && data) writeProfileCache(data);
      else if (!error) clearProfileCache();
      return { data, error };
    },
    async resendEmailVerification(email) {
      const sb = await ensureClient();
      const redirect = new URL("../auth/callback.html", location.href).href;
      return sb.auth.resend({
        type: "signup",
        email: String(email || "").trim(),
        options: { emailRedirectTo: redirect },
      });
    },
    clearProfileCache,
    /** Sau đăng nhập: staff → admin; học viên → dashboard (trừ khi next chỉ định trang khác). */
    async homeAfterLogin(explicitNext, session) {
      const next = (explicitNext || "").trim();
      const isDefaultDash =
        !next ||
        /\/dashboard\/?$/i.test(next) ||
        next === "../dashboard/" ||
        next.endsWith("dashboard/");
      const fallback = next && !isDefaultDash ? next : "../dashboard/";

      const profile = await this.getProfile({
        session: session || undefined,
        timeoutMs: 800,
      });
      const staff = this.isStaffRole(profile?.role);
      if (next && !isDefaultDash) return next;
      if (staff) return "../admin/";
      return fallback;
    },
    async signIn(email, password) {
      writeProfileCache(null);
      const sb = await ensureClient();
      return sb.auth.signInWithPassword({ email, password });
    },
    async signUp(email, password, fullName) {
      writeProfileCache(null);
      const sb = await ensureClient();
      const redirect = new URL("callback.html", location.href).href;
      return sb.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || "" },
          emailRedirectTo: redirect,
        },
      });
    },
    async signOut() {
      writeProfileCache(null);
      const sb = await ensureClient();
      return sb.auth.signOut();
    },
    /** Đổi mật khẩu khi đã đăng nhập: xác nhận mật khẩu hiện tại rồi cập nhật. */
    async changePassword(currentPassword, newPassword) {
      const sb = await ensureClient();
      const session = await getSession();
      if (!session?.user?.email) {
        return { data: null, error: { message: "Bạn chưa đăng nhập." } };
      }
      const email = session.user.email;
      const { error: reAuthError } = await sb.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reAuthError) {
        return {
          data: null,
          error: { message: "Mật khẩu hiện tại không đúng." },
        };
      }
      return sb.auth.updateUser({ password: newPassword });
    },
    /** Đặt mật khẩu mới (sau link quên mật khẩu / recovery session). */
    async updatePassword(newPassword) {
      const sb = await ensureClient();
      return sb.auth.updateUser({ password: newPassword });
    },
    /** Gửi email đặt lại mật khẩu. redirectTo = URL callback trên site. */
    async requestPasswordReset(email, redirectTo) {
      const sb = await ensureClient();
      return sb.auth.resetPasswordForEmail(String(email || "").trim(), {
        redirectTo:
          redirectTo ||
          new URL("callback.html", location.href).href,
      });
    },
  };
})();
