/* SA247 Content Engine — client tracking (UTM capture + funnel events).
 *
 * - Bắt UTM/gclid/fbclid trên mọi trang; lưu first-touch + last-touch (localStorage, TTL 30 ngày).
 * - window.sa247track(event, props) để bắn sự kiện phễu.
 * - Tự bắn page_view, delegate click [data-sa247-event], nghe DOM event "sa247:progress".
 * - Sink: bảng Supabase marketing_events (insert-only) qua window.sa247Auth; no-op nếu chưa cấu hình.
 * - Tùy chọn GA4: đặt window.SA247_GA_ID (mặc định rỗng => tắt).
 *
 * KHÔNG đụng entitlement / giá / quyền học. Chỉ đo lường.
 */
(function () {
  "use strict";

  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
  var FIRST_KEY = "sa247_attr_first";
  var LAST_KEY = "sa247_attr_last";
  var SID_KEY = "sa247_sid";
  var UTM_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
  ];

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function safeSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      /* ignore */
    }
  }

  function parseParams() {
    var out = {};
    try {
      var sp = new URLSearchParams(location.search);
      UTM_KEYS.forEach(function (k) {
        var v = sp.get(k);
        if (v) out[k] = String(v).slice(0, 200);
      });
    } catch (e) {
      /* ignore */
    }
    return out;
  }

  function readTouch(key) {
    var raw = safeGet(key);
    if (!raw) return null;
    try {
      var obj = JSON.parse(raw);
      if (obj && obj.ts && Date.now() - obj.ts > TTL_MS) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  function sessionId() {
    var sid;
    try {
      sid = sessionStorage.getItem(SID_KEY);
    } catch (e) {
      sid = null;
    }
    if (!sid) {
      sid =
        "s_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 8);
      try {
        sessionStorage.setItem(SID_KEY, sid);
      } catch (e) {
        /* ignore */
      }
    }
    return sid;
  }

  // --- Capture attribution on load ---
  var incoming = parseParams();
  if (Object.keys(incoming).length) {
    var touch = { ts: Date.now(), data: incoming, path: location.pathname };
    if (!readTouch(FIRST_KEY)) safeSet(FIRST_KEY, JSON.stringify(touch));
    safeSet(LAST_KEY, JSON.stringify(touch));
  }

  function attribution() {
    var first = readTouch(FIRST_KEY);
    var last = readTouch(LAST_KEY) || first;
    var merged = {};
    UTM_KEYS.forEach(function (k) {
      var v = (last && last.data && last.data[k]) || (first && first.data && first.data[k]);
      if (v) merged[k] = v;
    });
    merged.first_touch = first ? first.data : null;
    return merged;
  }

  // --- Fill hidden UTM inputs opportunistically (no form edits required) ---
  function fillHiddenInputs(root) {
    var attr = attribution();
    var nodes = (root || document).querySelectorAll("[data-sa247-utm]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-sa247-utm");
      if (key && attr[key] != null && "value" in el) el.value = attr[key];
    }
  }

  // --- Sinks ---
  function sinkSupabase(payload) {
    if (!window.sa247Auth || !window.sa247Auth.ready || !window.sa247Auth.ensureClient) {
      return; // no-op an toàn
    }
    window.sa247Auth
      .ensureClient()
      .then(function (sb) {
        if (!sb) return;
        var uid = null;
        // Gắn user_id nếu có phiên (không chặn nếu chưa đăng nhập).
        var doInsert = function () {
          sb.from("marketing_events")
            .insert([
              {
                event: payload.event,
                user_id: uid,
                session_id: payload.session_id,
                path: payload.path,
                referrer: payload.referrer,
                utm_source: payload.utm_source || null,
                utm_medium: payload.utm_medium || null,
                utm_campaign: payload.utm_campaign || null,
                utm_content: payload.utm_content || null,
                utm_term: payload.utm_term || null,
                gclid: payload.gclid || null,
                fbclid: payload.fbclid || null,
                props: payload.props || {},
              },
            ])
            .then(function () {}, function () {});
        };
        if (sb.auth && sb.auth.getSession) {
          sb.auth
            .getSession()
            .then(function (res) {
              uid = (res && res.data && res.data.session && res.data.session.user && res.data.session.user.id) || null;
              doInsert();
            }, doInsert);
        } else {
          doInsert();
        }
      }, function () {});
  }

  function sinkGA(payload) {
    var id = window.SA247_GA_ID;
    if (!id) return;
    if (typeof window.gtag === "function") {
      window.gtag("event", payload.event, {
        campaign: payload.utm_campaign,
        source: payload.utm_source,
        medium: payload.utm_medium,
      });
    }
  }

  // --- Public API ---
  function track(event, props) {
    if (!event) return;
    var attr = attribution();
    var payload = {
      event: String(event).slice(0, 80),
      session_id: sessionId(),
      path: location.pathname + location.search,
      referrer: document.referrer || "",
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
      utm_content: attr.utm_content,
      utm_term: attr.utm_term,
      gclid: attr.gclid,
      fbclid: attr.fbclid,
      props: props || {},
    };
    try {
      sinkSupabase(payload);
    } catch (e) {
      /* ignore */
    }
    try {
      sinkGA(payload);
    } catch (e) {
      /* ignore */
    }
    if (window.SA247_TRACK_DEBUG) {
      // eslint-disable-next-line no-console
      console.debug("[sa247track]", payload);
    }
  }

  window.sa247track = track;
  window.sa247Attribution = attribution;

  // --- Auto wiring ---
  function onReady() {
    fillHiddenInputs(document);

    // page_view + view_course (nếu trang có data-course-code trên body/main)
    var courseCode =
      (document.body && document.body.getAttribute("data-course-code")) ||
      (document.querySelector("[data-course-code]") &&
        document.querySelector("[data-course-code]").getAttribute("data-course-code")) ||
      "";
    track("page_view", courseCode ? { course_code: courseCode } : {});
    if (courseCode && /(\/khoa-hoc\/|course)/i.test(location.pathname + (document.body.className || ""))) {
      // trang khóa: gửi thêm view_course
      track("view_course", { course_code: courseCode });
    }

    // Delegate click cho mọi phần tử có data-sa247-event
    document.addEventListener(
      "click",
      function (ev) {
        var node = ev.target;
        while (node && node !== document) {
          if (node.getAttribute && node.getAttribute("data-sa247-event")) {
            var evName = node.getAttribute("data-sa247-event");
            var props = {};
            var code = node.getAttribute("data-course-code");
            if (code) props.course_code = code;
            var label = node.getAttribute("data-sa247-label");
            if (label) props.label = label;
            track(evName, props);
            break;
          }
          node = node.parentNode;
        }
      },
      true
    );

    // Form submit: nếu form có data-sa247-event thì bắn khi submit
    document.addEventListener(
      "submit",
      function (ev) {
        var form = ev.target;
        if (form && form.getAttribute && form.getAttribute("data-sa247-event")) {
          fillHiddenInputs(form);
          track(form.getAttribute("data-sa247-event"), {});
        }
      },
      true
    );

    // Sự kiện học nội bộ từ learn-player.js
    window.addEventListener("sa247:progress", function (ev) {
      var d = (ev && ev.detail) || {};
      var name = d.completed ? "learn_complete" : "learn_start";
      track(name, {
        course_code: d.courseCode || d.course_code || "",
        lesson_code: d.lessonCode || d.lesson_code || "",
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
