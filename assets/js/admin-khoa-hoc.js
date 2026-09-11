/* Quản lý khóa học + chương + bài */
(function () {
  let cache = [];
  let openCourseId = null;

  function badge(c) {
    if (c.is_published) return '<span class="adm-badge">Đang mở</span>';
    return '<span class="adm-badge adm-badge--draft">Bản nháp</span>';
  }

  function renderRows(list, counts) {
    document.getElementById("rows").innerHTML = list
      .map((c) => {
        const n = counts[c.id] || 0;
        return `<tr>
          <td><strong>${c.title || ""}</strong></td>
          <td>${c.code || ""}</td>
          <td>${badge(c)}</td>
          <td>${n}</td>
          <td>${sa247Admin.fmtTime(c.created_at)}</td>
          <td>
            <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-view="${c.id}">Xem cấu trúc</button>
            <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-toggle="${c.id}">${c.is_published ? "Tạm dừng" : "Xuất bản"}</button>
            <a class="adm-btn adm-btn--line adm-btn--small" href="../../${c.slug}/" target="_blank" rel="noopener">Xem trước</a>
          </td>
        </tr>`;
      })
      .join("");
  }

  function applyFilter() {
    const q = (document.getElementById("q").value || "").trim().toLowerCase();
    const f = document.getElementById("filter").value;
    return cache.filter((c) => {
      if (f === "open" && !c.is_published) return false;
      if (f === "draft" && c.is_published) return false;
      if (!q) return true;
      return (
        (c.title || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q)
      );
    });
  }

  async function showDetail(sb, courseId) {
    openCourseId = courseId;
    const box = document.getElementById("detail");
    box.hidden = false;
    box.innerHTML = "<p class='adm-msg'>Đang tải chương / bài học…</p>";
    const { data: course } = await sb
      .from("courses")
      .select("id,code,title,slug")
      .eq("id", courseId)
      .maybeSingle();
    const { data: modules, error } = await sb
      .from("modules")
      .select(
        "id,title,sort_order,lessons(id,title,sort_order,is_free,is_published,youtube_video_id)"
      )
      .eq("course_id", courseId)
      .order("sort_order");
    if (error) {
      box.innerHTML = `<p class="adm-msg--err">${error.message}</p>`;
      return;
    }
    const mods = (modules || [])
      .map((m) => {
        const lessons = (m.lessons || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((l) => {
            const free = l.is_free
              ? '<span class="adm-badge">Học thử miễn phí</span>'
              : '<span class="adm-badge adm-badge--draft">Chỉ học viên đã mở khóa</span>';
            return `<div class="adm-lesson">
              <div><strong>${l.title || ""}</strong><div>${free}</div></div>
              <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-free="${l.id}" data-isfree="${l.is_free ? "1" : "0"}">
                ${l.is_free ? "Đặt là mở khóa" : "Đặt học thử"}
              </button>
            </div>`;
          })
          .join("");
        return `<article class="adm-mod">
          <div class="adm-mod__head"><span>${m.title}</span><span>${(m.lessons || []).length} bài</span></div>
          ${lessons || "<div class='adm-lesson'>Chưa có bài học</div>"}
        </article>`;
      })
      .join("");
    box.innerHTML = `<h2>${course?.code || ""} · ${course?.title || ""}</h2>
      <p class="adm-lead">Chương học / bài học · đổi trạng thái học thử bằng một thao tác.</p>
      ${mods || "<p>Chưa có chương.</p>"}`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tất cả khóa học");
      if (!ctx) return;
      const { sb } = ctx;
      const { data, error } = await sb
        .from("courses")
        .select("id,code,slug,title,is_published,created_at,price")
        .order("code");
      if (error) throw error;
      cache = data || [];
      const { data: enrolls } = await sb
        .from("enrollments")
        .select("course_id,status")
        .eq("status", "active");
      const counts = {};
      (enrolls || []).forEach((e) => {
        counts[e.course_id] = (counts[e.course_id] || 0) + 1;
      });
      const paint = () => renderRows(applyFilter(), counts);
      paint();
      document.getElementById("q").addEventListener("input", paint);
      document.getElementById("filter").addEventListener("change", paint);
      document.getElementById("rows").addEventListener("click", async (ev) => {
        const view = ev.target.closest("[data-view]");
        const toggle = ev.target.closest("[data-toggle]");
        if (view) return void (await showDetail(sb, view.getAttribute("data-view")));
        if (toggle) {
          const id = toggle.getAttribute("data-toggle");
          const c = cache.find((x) => x.id === id);
          if (!c) return;
          const { error: upErr } = await sb
            .from("courses")
            .update({ is_published: !c.is_published })
            .eq("id", id);
          if (upErr) return alert(upErr.message);
          c.is_published = !c.is_published;
          paint();
        }
      });
      document.getElementById("detail").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-free]");
        if (!btn) return;
        const { error: upErr } = await sb
          .from("lessons")
          .update({ is_free: btn.getAttribute("data-isfree") !== "1" })
          .eq("id", btn.getAttribute("data-free"));
        if (upErr) return alert(upErr.message);
        if (openCourseId) await showDetail(sb, openCourseId);
      });
      document.getElementById("adm-status").textContent =
        `${cache.length} khóa học · giá mặc định 199.000đ`;
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
