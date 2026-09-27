/**
 * SA247 · Course Detail Mobile (See → Try → Understand → Buy → Learn).
 * Presentation only: section order (CSS), trial entry points, sticky tabs, collapsed curriculum.
 * Does not touch checkout, auth, enrollment or course data — course-page.js / learn-player.js own those.
 */
(function () {
  if (!document.body.classList.contains("course-page")) return;
  const mq = window.matchMedia("(max-width: 760px)");

  const TABS = [
    ["noi-dung-khoa", "Học thử"],
    ["sau-khoa-hoc", "Kết quả"],
    ["lo-trinh", "Nội dung"],
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
    return nav + (mq.matches ? 60 : 12);
  }

  function trialsBlock() {
    const el = document.querySelector(".cm-trials");
    return el && !el.hidden ? el : null;
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

  /* Trial videos = lessons marked hoc_thu in the course curriculum, each with its own video. */
  async function buildTrials() {
    const root = document.getElementById("learner-root");
    const url = root?.getAttribute("data-curriculum-url");
    if (!root || !url || document.querySelector(".cm-trials")) return;
    let cur;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      cur = await res.json();
    } catch {
      return;
    }
    const lessons = [];
    (cur.modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => {
        if (l.access === "hoc_thu" && l.youtube_video_id) lessons.push({ ...l, module: m.module_id || l.module_id || "" });
      });
    });
    if (!lessons.length) return;

    const box = document.createElement("div");
    box.className = "cm-trials";
    box.setAttribute("aria-label", "Video học thử miễn phí");
    const head = document.createElement("div");
    head.className = "cm-trials__head";
    head.innerHTML =
      '<p class="cm-trials__kicker">Học thử miễn phí</p>' +
      `<h3 class="cm-trials__title">${lessons.length} bài học thật của khóa — xem ngay, không cần đăng nhập</h3>`;
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

    root.parentNode.insertBefore(box, root);
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
    const trials = document.querySelector(".cm-trials");
    if (trials) trials.hidden = isIn;
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

  function watchClassroom() {
    const root = document.getElementById("learner-root");
    if (!root) return;
    const update = () => paintTrialLabels();
    new MutationObserver(update).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-enrolled"] });
    update();
  }

  function init() {
    document.documentElement.classList.add("cm-ready");
    relabelHero();
    addStickyTrial();
    buildTabs();
    collapseCurriculum();
    watchClassroom();
    buildTrials();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
