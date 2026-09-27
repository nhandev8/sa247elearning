/**
 * SA247 · Course Detail Mobile (See → Try → Understand → Buy → Learn).
 * Presentation only: section order (CSS), trial entry points, sticky tabs, collapsed curriculum.
 * Does not touch checkout, auth, enrollment or course data — course-page.js / learn-player.js own those.
 */
(function () {
  if (!document.body.classList.contains("course-page")) return;
  const mq = window.matchMedia("(max-width: 760px)");

  const TABS = [
    ["hoc-thu", "Học thử"],
    ["sau-khoa-hoc", "Kết quả"],
    ["lo-trinh", "Mục lục"],
    ["dang-ky", "Học phí"],
    ["faq", "Hỏi đáp"],
  ];

  function enrolled() {
    return document.querySelector("#learner-root .classroom")?.getAttribute("data-enrolled") === "1";
  }

  function freeLessonButton() {
    return [...document.querySelectorAll("#learner-root .classroom__lesson")].find((b) =>
      b.querySelector(".badge--free")
    );
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function headerOffset() {
    const nav = document.getElementById("nav")?.getBoundingClientRect().height || 56;
    const tabs = mq.matches && !document.body.classList.contains("cm-learning");
    return nav + (tabs ? 60 : 12);
  }

  function trialsBlock() {
    const el = document.getElementById("hoc-thu");
    return el && !el.hidden && el.querySelector(".cm-trial") ? el : null;
  }

  function landOn(target) {
    const land = (behavior) => {
      const y = target.getBoundingClientRect().top + window.scrollY - headerOffset();
      window.scrollTo({ top: Math.max(0, y), behavior });
    };
    land("smooth");
    /* Layout can still shift while scrolling (lesson swap, thumbnails) — settle once more. */
    window.setTimeout(() => {
      if (Math.abs(target.getBoundingClientRect().top - headerOffset()) > 8) land("auto");
    }, 900);
  }

  /* Tap "Học thử" → land on the trial videos (no login needed). */
  function goTrial(e) {
    if (e) e.preventDefault();
    const trials = trialsBlock();
    if (trials) return landOn(trials);
    if (!enrolled()) {
      const active = document.querySelector("#learner-root .classroom__lesson.is-active");
      const activeIsFree = active && active.querySelector(".badge--free");
      const hasVideo = document.querySelector("#classroom-player iframe, #classroom-player #sa247-yt-player");
      if (!activeIsFree || !hasVideo) freeLessonButton()?.click();
    }
    const target = document.getElementById("classroom-player") || document.getElementById("noi-dung-khoa");
    if (target) landOn(target);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /* "Học thử" is its own section right after the hero — never merged into the course outline. */
  function createTrialSection() {
    const main = document.querySelector("main");
    if (!main || document.getElementById("hoc-thu")) return null;
    const section = document.createElement("section");
    section.id = "hoc-thu";
    section.className = "cm-trial-section";
    section.hidden = true;
    section.innerHTML = '<div class="wrap"></div>';
    main.insertBefore(section, main.firstElementChild);
    return section;
  }

  function trialRegisterButton() {
    const hero = document.querySelector("#top [data-hero-cta]");
    const a = document.createElement("a");
    a.className = "btn btn--amber cm-trials__cta";
    a.href = hero?.getAttribute("href") || "#dang-ky";
    a.textContent = hero?.textContent.trim() || "Đăng ký khóa học";
    return a;
  }

  /* Trial videos = lessons marked hoc_thu in the course curriculum, each with its own video. */
  async function buildTrials(section) {
    const root = document.getElementById("learner-root");
    const url = root?.getAttribute("data-curriculum-url");
    if (!section) return;
    const drop = () => section.remove();
    if (!url) return drop();
    let cur;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return drop();
      cur = await res.json();
    } catch {
      return drop();
    }
    const lessons = [];
    (cur.modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => {
        if (l.access === "hoc_thu" && l.youtube_video_id) lessons.push({ ...l, module: m.module_id || l.module_id || "" });
      });
    });
    if (!lessons.length) return drop();

    const box = document.createElement("div");
    box.className = "cm-trials";
    box.setAttribute("aria-label", "Video học thử miễn phí");
    const head = document.createElement("div");
    head.className = "cm-trials__head";
    head.innerHTML =
      '<p class="kicker">Học thử miễn phí</p>' +
      `<h2 class="title">${lessons.length} video học thử — xem ngay, không cần đăng nhập</h2>`;
    box.appendChild(head);

    let playing = null;
    const reset = (card) => {
      const frame = card.querySelector(".cm-trial__frame");
      frame.innerHTML = frame.dataset.thumb;
      frame.classList.remove("is-playing");
    };

    lessons.forEach((l) => {
      const card = document.createElement("article");
      card.className = "cm-trial";
      const frame = document.createElement("button");
      frame.type = "button";
      frame.className = "cm-trial__frame";
      frame.setAttribute("aria-label", "Phát video: " + (l.display_title || l.lesson_code));
      frame.dataset.thumb =
        `<img src="https://i.ytimg.com/vi/${encodeURIComponent(l.youtube_video_id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async">` +
        '<span class="cm-trial__play" aria-hidden="true">▶</span>';
      frame.innerHTML = frame.dataset.thumb;
      frame.addEventListener("click", () => {
        if (frame.classList.contains("is-playing")) return;
        if (playing && playing !== card) reset(playing);
        frame.classList.add("is-playing");
        frame.innerHTML =
          `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(l.youtube_video_id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" ` +
          'title="Video học thử" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
        playing = card;
      });
      const meta = document.createElement("div");
      meta.className = "cm-trial__meta";
      const m = /M(\d+)-B(\d+)/.exec(l.lesson_code || "");
      const where = m ? `Mô-đun ${pad2(+m[1])} · Bài ${pad2(+m[2])}` : l.lesson_code || "";
      meta.innerHTML = `<span class="cm-trial__where"></span><strong class="cm-trial__name"></strong>`;
      meta.querySelector(".cm-trial__where").textContent = where;
      meta.querySelector(".cm-trial__name").textContent = l.display_title || l.title || l.lesson_code;
      card.appendChild(frame);
      card.appendChild(meta);
      box.appendChild(card);
    });

    box.appendChild(trialRegisterButton());
    section.querySelector(".wrap").appendChild(box);
    section.hidden = false;
    paintTrialLabels();
  }

  function relabelHero() {
    const a = document.querySelector('#top a[href="#noi-dung-khoa"]');
    if (!a || a.dataset.cmBound) return;
    a.dataset.cmBound = "1";
    a.dataset.cmOrig = a.textContent;
    a.addEventListener("click", (e) => {
      if (!enrolled()) goTrial(e);
    });
  }

  function paintTrialLabels() {
    const isIn = enrolled();
    const hero = document.querySelector('#top a[href="#noi-dung-khoa"]');
    if (hero) hero.textContent = isIn ? hero.dataset.cmOrig || "Vào lớp học" : "▶ Học thử miễn phí";
    document.querySelectorAll("[data-cm-trial]").forEach((b) => {
      b.hidden = isIn;
    });
    const trials = document.getElementById("hoc-thu");
    if (trials && trials.querySelector(".cm-trial")) trials.hidden = isIn;
  }

  function addStickyTrial() {
    const inner = document.querySelector("#course-sticky-cta .course-sticky__inner");
    if (!inner || inner.querySelector("[data-cm-trial]")) return;
    const main = inner.querySelector("[data-sticky-btn]");
    const actions = document.createElement("div");
    actions.className = "cm-sticky-actions";
    const trial = document.createElement("a");
    trial.href = "#noi-dung-khoa";
    trial.className = "btn btn--line btn--small cm-sticky-trial";
    trial.setAttribute("data-cm-trial", "");
    trial.textContent = "▶ Học thử";
    trial.addEventListener("click", goTrial);
    if (main) {
      main.parentNode.insertBefore(actions, main);
      actions.appendChild(trial);
      actions.appendChild(main);
    } else {
      actions.appendChild(trial);
      inner.appendChild(actions);
    }
  }

  function buildTabs() {
    if (document.querySelector(".cm-tabs")) return;
    const bar = document.createElement("nav");
    bar.className = "cm-tabs";
    bar.setAttribute("aria-label", "Mục trong trang khóa học");
    bar.hidden = true;
    TABS.forEach(([id, label]) => {
      if (!document.getElementById(id)) return;
      const a = document.createElement("a");
      a.href = "#" + id;
      a.textContent = label;
      a.dataset.cmTab = id;
      a.addEventListener("click", (e) => {
        if (id === "noi-dung-khoa") return goTrial(e);
        e.preventDefault();
        scrollToId(id);
      });
      bar.appendChild(a);
    });
    document.body.appendChild(bar);

    const nav = document.getElementById("nav");
    const place = () => {
      bar.style.top = Math.round(nav?.getBoundingClientRect().height || 56) + "px";
    };
    place();
    window.addEventListener("resize", place);

    const hero = document.getElementById("top");
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => {
          bar.hidden = entry.isIntersecting || !mq.matches;
          place();
        },
        { threshold: 0.05 }
      ).observe(hero);

      const seen = new Map();
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => seen.set(en.target.id, en.isIntersecting));
          const current = TABS.map(([id]) => id).find((id) => seen.get(id));
          bar.querySelectorAll("a").forEach((a) => {
            const on = a.dataset.cmTab === current;
            a.classList.toggle("is-active", on);
            if (on) bar.scrollLeft = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2;
          });
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      TABS.forEach(([id]) => {
        const el = document.getElementById(id);
        if (el) spy.observe(el);
      });
    }
  }

  function collapseCurriculum() {
    if (!mq.matches) return;
    document.querySelectorAll("#lo-trinh .curriculum-acc__item[open]").forEach((d) => {
      d.open = false;
    });
  }

  /* ---- Learning mode (enrolled, mobile): classroom first + learner action bar ---- */

  function scrollToPlayer() {
    if (!mq.matches) return;
    const p = document.getElementById("classroom-player");
    if (p) landOn(p);
  }

  function nextLessonButton() {
    const all = [...document.querySelectorAll("#learner-root .classroom__lesson")];
    const i = all.findIndex((b) => b.classList.contains("is-active"));
    return i >= 0 ? all.slice(i + 1).find((b) => !b.classList.contains("is-locked")) || null : null;
  }

  /* Primary action mirrors the classroom: next-step CTA once completed, else watch status (read-only). */
  function primaryAction() {
    const meta = document.getElementById("classroom-meta");
    const doneCta = meta?.querySelector(".lesson-next__actions .btn--amber, [data-watch-next]:not([hidden]) .btn--amber");
    if (doneCta) return { el: doneCta, label: doneCta.textContent.trim(), strong: true };
    const status = meta?.querySelector("[data-watch-status]");
    if (status) {
      return { el: status, label: status.getAttribute("data-label") || "Đã xem 0%", strong: false, disabled: true };
    }
    return null;
  }

  function buildLearnBar() {
    if (document.querySelector(".cm-learnbar")) return document.querySelector(".cm-learnbar");
    const bar = document.createElement("nav");
    bar.className = "cm-learnbar";
    bar.setAttribute("aria-label", "Điều khiển bài học");
    bar.hidden = true;
    bar.innerHTML =
      '<button type="button" class="cm-learnbar__btn" data-cm-side>☰ Mục lục</button>' +
      '<button type="button" class="cm-learnbar__btn cm-learnbar__main" data-cm-main>Đã xem 0%</button>' +
      '<button type="button" class="cm-learnbar__btn" data-cm-next>Bài tiếp →</button>';
    bar.addEventListener("click", (e) => {
      const classroom = document.querySelector("#learner-root .classroom");
      if (e.target.closest("[data-cm-side]")) {
        classroom?.classList.toggle("is-side-open");
        return;
      }
      if (e.target.closest("[data-cm-main]")) {
        const act = primaryAction();
        if (!act) return;
        if (act.el.tagName === "A") {
          window.location.href = act.el.href;
          return;
        }
        act.el.click();
        window.setTimeout(scrollToPlayer, 400);
        return;
      }
      if (e.target.closest("[data-cm-next]")) {
        const inDone = document.querySelector("#classroom-meta [data-next-lesson]");
        (inDone || nextLessonButton())?.click();
        window.setTimeout(scrollToPlayer, 60);
      }
    });
    document.body.appendChild(bar);
    return bar;
  }

  function paintLearnBar() {
    const bar = document.querySelector(".cm-learnbar");
    if (!bar) return;
    const act = primaryAction();
    const main = bar.querySelector("[data-cm-main]");
    main.textContent = act ? act.label : "Đã xem 0%";
    main.disabled = !act || !!act.disabled;
    main.classList.toggle("is-strong", !!act?.strong);
    const hasNext = !!(document.querySelector("#classroom-meta [data-next-lesson]") || nextLessonButton());
    bar.querySelector("[data-cm-next]").disabled = !hasNext;
    const open = document.querySelector("#learner-root .classroom")?.classList.contains("is-side-open");
    bar.querySelector("[data-cm-side]").classList.toggle("is-on", !!open);
  }

  function ensureSideClose() {
    const side = document.getElementById("classroom-side");
    if (!side || side.querySelector(".cm-side-close")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-side-close";
    btn.textContent = "✕ Đóng mục lục";
    btn.addEventListener("click", () => document.querySelector("#learner-root .classroom")?.classList.remove("is-side-open"));
    side.insertBefore(btn, side.firstChild);
  }

  let learningLanded = false;

  function paintLearningMode() {
    const on = enrolled();
    document.body.classList.toggle("cm-learning", on);
    if (!on) return;
    if (!learningLanded) {
      learningLanded = true;
      const deepLink = /learner-root|noi-dung-khoa/.test(location.hash) || /[?&]lesson(_id)?=/.test(location.search);
      if (deepLink && mq.matches) window.setTimeout(scrollToPlayer, 250);
    }
    const bar = buildLearnBar();
    bar.hidden = !mq.matches;
    ensureSideClose();
    paintLearnBar();
  }

  function watchClassroom() {
    const root = document.getElementById("learner-root");
    if (!root) return;
    root.addEventListener("click", (e) => {
      if (!enrolled()) return;
      if (e.target.closest(".classroom__lesson, [data-next-lesson], [data-resume]")) window.setTimeout(scrollToPlayer, 60);
    });
    const update = () => {
      paintTrialLabels();
      paintLearningMode();
    };
    new MutationObserver(update).observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-enrolled", "class", "disabled"],
    });
    mq.addEventListener?.("change", update);
    window.addEventListener("sa247:watch", paintLearnBar);
    update();
  }

  function init() {
    document.documentElement.classList.add("cm-ready");
    const trialSection = createTrialSection();
    relabelHero();
    addStickyTrial();
    buildTabs();
    collapseCurriculum();
    watchClassroom();
    buildTrials(trialSection);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
