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

  async function hasCourseAccess(courseId) {
    const sb = await ensureClient();
    const session = await getSession();
    if (!session) return false;
    const { data, error } = await sb
      .from("enrollments")
      .select("id,status")
      .eq("course_id", courseId)
      .eq("status", "active")
      .maybeSingle();
    if (error) {
      console.warn("[SA247] enrollment check", error.message);
      return false;
    }
    return Boolean(data);
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
    ],
    isStaffRole(role) {
      return window.sa247Auth.STAFF_ROLES.includes(role);
    },
    async getProfile() {
      const session = await getSession();
      if (!session) return null;
      const sb = await ensureClient();
      const { data, error } = await sb
        .from("profiles")
        .select("id,full_name,role,phone")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error) {
        console.warn("[SA247] profile", error.message);
        return null;
      }
      return data;
    },
    /** Sau đăng nhập: staff → admin; học viên → dashboard (trừ khi next chỉ định trang khác). */
    async homeAfterLogin(explicitNext) {
      const profile = await this.getProfile();
      const staff = this.isStaffRole(profile?.role);
      const next = (explicitNext || "").trim();
      if (next) {
        const isDefaultDash =
          /\/dashboard\/?$/i.test(next) ||
          next === "../dashboard/" ||
          next.endsWith("dashboard/");
        if (!(staff && isDefaultDash)) return next;
      }
      return staff ? "../admin/" : "../dashboard/";
    },
    async signIn(email, password) {
      const sb = await ensureClient();
      return sb.auth.signInWithPassword({ email, password });
    },
    async signUp(email, password, fullName) {
      const sb = await ensureClient();
      return sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || "" } },
      });
    },
    async signOut() {
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
