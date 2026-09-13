/* Quản lý khóa học + chương + bài */
(function () {
  let cache = [];
  let openCourseId = null;

  const STATUS_OPTS = [
    ["ban_nhap", "Bản nháp"],
    ["dang_hoan_thien", "Đang hoàn thiện"],
    ["dang_mo", "Đang mở"],
    ["sap_mo", "Sắp mở"],
    ["tam_dung", "Tạm dừng"],
    ["da_dong", "Đã đóng"],
  ];

  function badge(c) {
    const s = c.status || (c.is_published ? "dang_mo" : "ban_nhap");
    const cls = s === "dang_mo" ? "adm-badge" : "adm-badge adm-badge--draft";
    return `<span class="${cls}">${sa247Admin.courseStatusVi(c)}</span>`;
  }

  function statusSelect(id, val) {
    const opts = STATUS_OPTS.map(
      ([v, l]) => `<option value="${v}"${v === val ? " selected" : ""}>${l}</option>`
    ).join("");
    return `<select id="${id}">${opts}</select>`;
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

  function renderCreateForm() {
    const box = document.getElementById("create-box");
    box.hidden = false;
    box.innerHTML = `<h2>Tạo khóa học mới</h2>
      <form class="adm-form" id="create-form">
        <label>Mã khóa <input name="code" required placeholder="ATNM-03" /></label>
        <label>Slug URL <input name="slug" required placeholder="atnm-03" /></label>
        <label>Tên khóa học <input name="title" required /></label>
        <label>Mô tả ngắn <input name="short_description" /></label>
        <label>Mô tả đầy đủ <textarea name="description" rows="3"></textarea></label>
        <label>Danh mục <input name="category" placeholder="ATVSLĐ" /></label>
        <label>Giá (VND) <input name="price" type="number" value="99000" /></label>
        <label>Trạng thái ${statusSelect("create-status", "ban_nhap")}</label>
        <div>
          <button type="submit" class="adm-btn adm-btn--primary">Lưu khóa học</button>
          <button type="button" class="adm-btn adm-btn--line" id="create-cancel">Hủy</button>
        </div>
      </form>
      <p class="adm-msg" id="create-msg"></p>`;
    document.getElementById("create-cancel").onclick = () => {
      box.hidden = true;
    };
  }

  async function showDetail(sb, courseId) {
    openCourseId = courseId;
    const box = document.getElementById("detail");
    box.hidden = false;
    box.innerHTML = "<p class='adm-msg'>Đang tải chương / bài học…</p>";
    const { data: course } = await sb
      .from("courses")
      .select("id,code,title,slug,status,is_published")
      .eq("id", courseId)
      .maybeSingle();
    const { data: modules, error } = await sb
      .from("modules")
      .select(
        "id,title,sort_order,lessons(id,title,sort_order,is_free,is_published,youtube_video_id,lesson_code)"
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
            const yt = l.youtube_video_id || "";
            return `<div class="adm-lesson" data-lesson="${l.id}">
              <div><strong>${l.title || ""}</strong> ${l.lesson_code ? `<code>${l.lesson_code}</code>` : ""}
                <div>${free}</div>
                <div class="adm-toolbar" style="margin-top:0.4rem">
                  <input type="text" class="adm-yt-input" data-yt="${l.id}" value="${yt}" placeholder="YouTube video ID" />
                  <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-save-yt="${l.id}">Lưu ID</button>
                </div>
              </div>
              <div>
                <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-free="${l.id}" data-isfree="${l.is_free ? "1" : "0"}">
                  ${l.is_free ? "Đặt là mở khóa" : "Đặt học thử"}
                </button>
                <button type="button" class="adm-btn adm-btn--line adm-btn--small" data-del-lesson="${l.id}">Xóa bài</button>
              </div>
            </div>`;
          })
          .join("");
        return `<article class="adm-mod" data-module="${m.id}">
          <div class="adm-mod__head"><span>${m.title}</span><span>${(m.lessons || []).length} bài</span></div>
          ${lessons || "<div class='adm-lesson'>Chưa có bài học</div>"}
          <form class="adm-form adm-lesson-form" data-add-lesson="${m.id}">
            <strong>Thêm bài học</strong>
            <label>Tiêu đề <input name="title" required /></label>
            <label>Mã bài <input name="lesson_code" placeholder="M01-L01" /></label>
            <label>YouTube ID <input name="youtube_video_id" /></label>
            <label><input type="checkbox" name="is_free" /> Học thử miễn phí</label>
            <button type="submit" class="adm-btn adm-btn--primary adm-btn--small">Thêm bài</button>
          </form>
        </article>`;
      })
      .join("");
    box.innerHTML = `<h2>${course?.code || ""} · ${course?.title || ""}</h2>
      <p class="adm-lead">Chương học / bài học · chỉnh sửa YouTube ID, học thử, thêm/xóa bài.</p>
      <form class="adm-form" id="add-module-form" style="margin-bottom:1rem">
        <strong>Thêm chương</strong>
        <label>Tiêu đề chương <input name="title" required /></label>
        <button type="submit" class="adm-btn adm-btn--primary adm-btn--small">Thêm chương</button>
      </form>
      ${mods || "<p>Chưa có chương.</p>"}
      <p class="adm-msg" id="detail-msg"></p>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const ctx = await sa247AdminShell.boot("Tất cả khóa học");
      if (!ctx) return;
      const { sb } = ctx;
      let counts = {};

      async function reload() {
        const { data, error } = await sb
          .from("courses")
          .select("id,code,slug,title,is_published,status,created_at,price")
          .order("code");
        if (error) throw error;
        cache = data || [];
        const { data: enrolls } = await sb
          .from("enrollments")
          .select("course_id,status")
          .eq("status", "active");
        counts = {};
        (enrolls || []).forEach((e) => {
          counts[e.course_id] = (counts[e.course_id] || 0) + 1;
        });
      }

      const paint = () => renderRows(applyFilter(), counts);

      await reload();
      paint();
      document.getElementById("q").addEventListener("input", paint);
      document.getElementById("filter").addEventListener("change", paint);

      document.getElementById("btn-create").addEventListener("click", renderCreateForm);

      document.getElementById("create-box").addEventListener("submit", async (ev) => {
        if (ev.target.id !== "create-form") return;
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const status = document.getElementById("create-status").value;
        const row = {
          code: (fd.get("code") || "").toString().trim(),
          slug: (fd.get("slug") || "").toString().trim().toLowerCase(),
          title: (fd.get("title") || "").toString().trim(),
          short_description: (fd.get("short_description") || "").toString().trim() || null,
          description: (fd.get("description") || "").toString().trim() || null,
          category: (fd.get("category") || "").toString().trim() || null,
          price: Number(fd.get("price")) || 99000,
          status,
          is_published: status === "dang_mo",
        };
        const msg = document.getElementById("create-msg");
        const { error } = await sb.from("courses").insert(row);
        if (error) {
          msg.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          return;
        }
        msg.textContent = "Đã tạo khóa học.";
        document.getElementById("create-box").hidden = true;
        await reload();
        paint();
      });

      document.getElementById("rows").addEventListener("click", async (ev) => {
        const view = ev.target.closest("[data-view]");
        const toggle = ev.target.closest("[data-toggle]");
        if (view) return void (await showDetail(sb, view.getAttribute("data-view")));
        if (toggle) {
          const id = toggle.getAttribute("data-toggle");
          const c = cache.find((x) => x.id === id);
          if (!c) return;
          const next = !c.is_published;
          const { error: upErr } = await sb
            .from("courses")
            .update({
              is_published: next,
              status: next ? "dang_mo" : "tam_dung",
            })
            .eq("id", id);
          if (upErr) return alert(upErr.message);
          c.is_published = next;
          c.status = next ? "dang_mo" : "tam_dung";
          paint();
        }
      });

      document.getElementById("detail").addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-free]");
        const saveYt = ev.target.closest("[data-save-yt]");
        const delBtn = ev.target.closest("[data-del-lesson]");
        const msg = document.getElementById("detail-msg");
        if (btn) {
          const { error: upErr } = await sb
            .from("lessons")
            .update({ is_free: btn.getAttribute("data-isfree") !== "1" })
            .eq("id", btn.getAttribute("data-free"));
          if (upErr) return alert(upErr.message);
          if (openCourseId) await showDetail(sb, openCourseId);
          return;
        }
        if (saveYt) {
          const lid = saveYt.getAttribute("data-save-yt");
          const inp = document.querySelector(`[data-yt="${lid}"]`);
          const { error: upErr } = await sb
            .from("lessons")
            .update({ youtube_video_id: (inp?.value || "").trim() || null })
            .eq("id", lid);
          if (upErr) {
            msg.innerHTML = `<span class="adm-msg--err">${upErr.message}</span>`;
          } else {
            msg.textContent = "Đã lưu YouTube ID.";
          }
          return;
        }
        if (delBtn) {
          const lid = delBtn.getAttribute("data-del-lesson");
          const { error: delErr } = await sb.from("lessons").delete().eq("id", lid);
          if (delErr) {
            msg.innerHTML = `<span class="adm-msg--err">Không thể xóa: ${delErr.message} (có thể đã có tiến độ học).</span>`;
          } else {
            msg.textContent = "Đã xóa bài học.";
            if (openCourseId) await showDetail(sb, openCourseId);
          }
        }
      });

      document.getElementById("detail").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const msg = document.getElementById("detail-msg");
        if (ev.target.id === "add-module-form") {
          const title = new FormData(ev.target).get("title")?.toString().trim();
          if (!title || !openCourseId) return;
          const { data: existing } = await sb
            .from("modules")
            .select("sort_order")
            .eq("course_id", openCourseId)
            .order("sort_order", { ascending: false })
            .limit(1);
          const sort = ((existing && existing[0]?.sort_order) || 0) + 1;
          const { error } = await sb
            .from("modules")
            .insert({ course_id: openCourseId, title, sort_order: sort });
          if (error) {
            msg.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          } else {
            ev.target.reset();
            await showDetail(sb, openCourseId);
          }
          return;
        }
        const modForm = ev.target.closest("[data-add-lesson]");
        if (modForm) {
          const modId = modForm.getAttribute("data-add-lesson");
          const fd = new FormData(modForm);
          const { data: existing } = await sb
            .from("lessons")
            .select("sort_order")
            .eq("module_id", modId)
            .order("sort_order", { ascending: false })
            .limit(1);
          const sort = ((existing && existing[0]?.sort_order) || 0) + 1;
          const { error } = await sb.from("lessons").insert({
            module_id: modId,
            title: fd.get("title")?.toString().trim(),
            lesson_code: fd.get("lesson_code")?.toString().trim() || null,
            youtube_video_id: fd.get("youtube_video_id")?.toString().trim() || null,
            is_free: !!fd.get("is_free"),
            sort_order: sort,
          });
          if (error) {
            msg.innerHTML = `<span class="adm-msg--err">${error.message}</span>`;
          } else {
            modForm.reset();
            await showDetail(sb, openCourseId);
          }
        }
      });

      document.getElementById("adm-status").textContent =
        `${cache.length} khóa học · giá mặc định 99.000đ`;
    } catch (e) {
      document.getElementById("adm-status").innerHTML =
        `<span class="adm-msg--err">${e.message || e}</span>`;
    }
  });
})();
