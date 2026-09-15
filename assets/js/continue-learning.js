/* SA247 · Tiếp tục học — resolver dùng chung (dashboard, course CTA, player) */
(function (global) {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function fmtRelative(iso) {
    if (!iso) return "";
    try {
      const t = new Date(iso).getTime();
      const d = Date.now() - t;
      const day = 86400000;
      if (d < day && new Date(iso).toDateString() === new Date().toDateString()) {
        return "Hôm nay";
      }
      if (d < 2 * day) return "Hôm qua";
      if (d < 7 * day) return Math.floor(d / day) + " ngày trước";
      return new Date(iso).toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  }

  function fmtClock(sec) {
    const n = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(n / 60);
    const s = n % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function flattenOutline(outline) {
    const flat = [];
    (outline?.modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => {
        if (!String(l.lesson_code || "").trim()) return;
        if (l.publish_status === "replaced") return;
        flat.push({
          id: l.id,
          lesson_code: l.lesson_code,
          title: l.title || l.lesson_code,
          moduleId: m.id,
          moduleCode: m.code || "",
          moduleTitle: m.title || m.code || "",
          youtube_video_id: l.youtube_video_id || "",
          is_free: !!(l.is_free || l.access === "hoc_thu"),
          sort_order: l.sort_order || 0,
        });
      });
    });
    return flat;
  }

  /**
   * Resolve điểm tiếp tục trong một khóa.
   * @returns {{ state, pct, done, total, lesson, watchedSeconds, lastAt, modulePct, nextAction }}
   */
  function resolveCourseContinue(flat, progressRows) {
    const map = Object.create(null);
    (progressRows || []).forEach((p) => {
      map[p.lesson_id] = p;
    });

    const total = flat.length;
    const done = flat.filter((l) => map[l.id]?.completed).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    if (!total) {
      return {
        state: "empty",
        pct: 0,
        done: 0,
        total: 0,
        lesson: null,
        watchedSeconds: 0,
        lastAt: null,
        nextAction: "catalog",
      };
    }

    if (done >= total) {
      return {
        state: "completed",
        pct: 100,
        done,
        total,
        lesson: null,
        watchedSeconds: 0,
        lastAt: null,
        nextAction: "quiz",
      };
    }

    // Prefer in-progress (started, not completed) by last_watched_at
    let best = null;
    let bestAt = "";
    flat.forEach((l) => {
      const p = map[l.id];
      if (!p || p.completed) return;
      if (p.last_watched_at && p.last_watched_at > bestAt) {
        bestAt = p.last_watched_at;
        best = l;
      }
    });

    // Else first incomplete
    if (!best) {
      best = flat.find((l) => !map[l.id]?.completed) || flat[0];
    }

    const prog = best ? map[best.id] : null;
    const started = !!(prog && (prog.last_watched_at || prog.watched_seconds > 0 || prog.progress_percent > 0));

    return {
      state: started || done > 0 ? "in_progress" : "not_started",
      pct,
      done,
      total,
      lesson: best,
      watchedSeconds: Number(prog?.watched_seconds) || 0,
      lastAt: prog?.last_watched_at || null,
      nextAction: "continue",
      progressMap: map,
    };
  }

  function nextLessonAfter(flat, lessonId) {
    const i = flat.findIndex((l) => l.id === lessonId);
    if (i < 0) return null;
    return flat[i + 1] || null;
  }

  function learnHref(slug, lesson) {
    const base = "../" + encodeURIComponent(slug || "") + "/#learner-root";
    if (!lesson?.id && !lesson?.lesson_code) return base;
    const q = lesson.lesson_code
      ? "lesson=" + encodeURIComponent(lesson.lesson_code)
      : "lesson_id=" + encodeURIComponent(lesson.id);
    return base.split("#")[0] + "?" + q + "#learner-root";
  }

  function progressBarHtml(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="progress-bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p}%"></span></div>`;
  }

  /**
   * Load continue snapshot for one enrolled course.
   */
  async function loadCourseSnapshot(sb, userId, course) {
    const code = course.code;
    const { data: outline, error } = await sb.rpc("get_course_outline", {
      p_course_code: code,
    });
    if (error || !outline) {
      return {
        course,
        state: "empty",
        pct: 0,
        done: 0,
        total: 0,
        lesson: null,
        watchedSeconds: 0,
        lastAt: null,
        flat: [],
        error: error?.message,
      };
    }
    const flat = flattenOutline(outline);
    const ids = flat.map((l) => l.id).filter(Boolean);
    let rows = [];
    if (ids.length) {
      const { data: prog } = await sb
        .from("lesson_progress")
        .select(
          "lesson_id,completed,progress_percent,last_watched_at,watched_seconds,completed_at"
        )
        .eq("user_id", userId)
        .in("lesson_id", ids);
      rows = prog || [];
    }
    const resolved = resolveCourseContinue(flat, rows);
    return { course, outline, flat, ...resolved };
  }

  /**
   * Across all active enrollments — pick the one to resume (most recent activity).
   */
  async function loadPrimaryContinue(sb, userId) {
    const { data: enrolls, error } = await sb
      .from("enrollments")
      .select("status, enrolled_at, course:courses(id,code,slug,title)")
      .eq("status", "active")
      .order("enrolled_at", { ascending: false });
    if (error) throw error;
    if (!enrolls?.length) return { enrolls: [], primary: null, snapshots: [] };

    const snapshots = await Promise.all(
      enrolls.map(async (row) => {
        const c = row.course || {};
        const snap = await loadCourseSnapshot(sb, userId, c);
        snap.enrolled_at = row.enrolled_at;
        return snap;
      })
    );

    let primary = null;
    let bestAt = "";
    snapshots.forEach((s) => {
      if (s.state === "completed" || s.state === "empty") return;
      const at = s.lastAt || s.enrolled_at || "";
      if (!primary || at > bestAt) {
        bestAt = at;
        primary = s;
      }
    });
    if (!primary) {
      primary =
        snapshots.find((s) => s.state === "in_progress" || s.state === "not_started") ||
        snapshots[0] ||
        null;
    }
    return { enrolls, primary, snapshots };
  }

  function ctaLabels(state) {
    const map = {
      not_started: { text: "Bắt đầu học", verb: "bắt đầu" },
      in_progress: { text: "Tiếp tục học", verb: "tiếp tục" },
      completed: { text: "Xem lại khóa học", verb: "xem lại" },
      empty: { text: "Vào lớp học", verb: "vào học" },
    };
    return map[state] || map.not_started;
  }

  global.sa247Continue = {
    esc,
    fmtRelative,
    fmtClock,
    flattenOutline,
    resolveCourseContinue,
    nextLessonAfter,
    learnHref,
    progressBarHtml,
    loadCourseSnapshot,
    loadPrimaryContinue,
    ctaLabels,
  };
})(window);
