/* Shared paint helpers for learner IA pages (reuse continue-learning snapshots) */
(function () {
  const C = () => window.sa247Continue;

  function orderStatusVi(status) {
    return (
      {
        pending: "Chờ thanh toán",
        paid: "Đã thanh toán · đã cấp quyền",
        cancelled: "Đã hủy",
        expired: "Hết hạn",
        failed: "Thất bại",
      }[status] ||
      status ||
      "—"
    );
  }

  function fmtVnd(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function fmtTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch {
      return iso;
    }
  }

  window.sa247LearnerPanels = {
    orderStatusVi,
    fmtVnd,
    fmtTime,

    paintCourses(hostId, statusId, snapshots) {
      const box = document.getElementById(hostId);
      const status = document.getElementById(statusId);
      if (!box) return;
      const esc = C().esc;
      if (!snapshots?.length) {
        if (status) {
          status.innerHTML =
            'Bạn chưa có khóa nào. <a href="../index.html#career-map">Tìm khóa phù hợp</a>.';
        }
        box.innerHTML = "";
        return;
      }
      if (status) status.textContent = `${snapshots.length} khóa trong tài khoản (enrollment).`;
      box.innerHTML = snapshots
        .map((s) => {
          const c = s.course || {};
          const labels = C().ctaLabels(s.state);
          const href =
            s.state === "completed"
              ? `../${esc(c.slug)}/#learner-root`
              : C().learnHref(c.slug, s.lesson);
          const st =
            s.state === "completed"
              ? "Hoàn thành"
              : s.state === "in_progress"
                ? "Đang học"
                : "Chưa bắt đầu";
          const nextLine = s.lesson
            ? `<p class="continue-next"><span>Bài gần nhất</span><strong>${esc(s.lesson.title)}</strong></p>`
            : s.state === "completed"
              ? `<p class="continue-next is-done"><strong>Đã hoàn thành khóa này.</strong></p>`
              : "";
          return `<article class="program-card program-card--progress">
            <span class="code">${esc(c.code || "")}</span>
            <h3>${esc(c.title || "Khóa học")}</h3>
            <p class="meta progress-meta">${st} · <strong>${s.pct}%</strong> · ${s.done}/${s.total} bài</p>
            ${C().progressBarHtml(s.pct)}
            ${nextLine}
            <div class="continue-hero__actions">
              <a class="btn btn--amber btn--small" href="${href}">${esc(labels.text)}</a>
              <a class="btn btn--line btn--small" href="../kiem-tra/?course=${encodeURIComponent(c.code || "")}">Kiểm tra</a>
            </div>
          </article>`;
        })
        .join("");
    },

    paintProgressTable(hostId, statusId, snapshots) {
      const host = document.getElementById(hostId);
      const status = document.getElementById(statusId);
      if (!host) return;
      const esc = C().esc;
      if (!snapshots?.length) {
        if (status) status.textContent = "Chưa có tiến độ — chưa ghi danh khóa nào.";
        host.innerHTML = "";
        return;
      }
      const n = snapshots.length;
      const done = snapshots.filter((s) => s.pct >= 100).length;
      const inProg = snapshots.filter(
        (s) => s.state === "in_progress" || (s.pct > 0 && s.pct < 100)
      ).length;
      if (status) {
        status.textContent = `Tổng ${n} khóa · Đang học ${inProg} · Hoàn thành ${done}`;
      }
      host.innerHTML = `<table class="learn-table">
        <thead><tr><th>Khóa</th><th>Tiến độ</th><th>Bài gần nhất</th><th></th></tr></thead>
        <tbody>
        ${snapshots
          .map((s) => {
            const c = s.course || {};
            const lesson = s.lesson
              ? `${esc(s.lesson.lesson_code || "")} · ${esc(s.lesson.title || "")}`
              : s.pct >= 100
                ? "Hoàn thành"
                : "—";
            const href =
              s.state === "completed"
                ? `../${esc(c.slug)}/#learner-root`
                : C().learnHref(c.slug, s.lesson);
            return `<tr>
              <td><strong>${esc(c.code || "")}</strong><div class="meta">${esc(c.title || "")}</div></td>
              <td><strong>${s.pct}%</strong><div class="meta">${s.done}/${s.total} bài</div>${C().progressBarHtml(s.pct)}</td>
              <td>${lesson}</td>
              <td><a class="btn btn--line btn--small" href="${href}">Mở</a></td>
            </tr>`;
          })
          .join("")}
        </tbody></table>`;
    },

    paintJourney(hostId, snapshots, nextMap) {
      const ol = document.getElementById(hostId);
      if (!ol) return;
      const esc = C().esc;
      const map = nextMap || { next_courses: {}, programs: {} };
      const owned = new Set((snapshots || []).map((s) => s.course?.code).filter(Boolean));
      const start =
        (snapshots || []).find((s) => s.state === "in_progress")?.course?.code ||
        (snapshots || []).find((s) => s.pct >= 100)?.course?.code ||
        (snapshots || [])[0]?.course?.code ||
        "ATNM-01";
      const chain = [start];
      let cur = start;
      for (let i = 0; i < 4; i++) {
        const tip = (map.next_courses || {})[cur];
        if (!tip?.code || chain.includes(tip.code)) break;
        chain.push(tip.code);
        cur = tip.code;
      }
      ol.innerHTML = chain
        .map((code, idx) => {
          const snap = (snapshots || []).find((s) => s.course?.code === code);
          const meta = (map.programs || {})[code] || {};
          const title = snap?.course?.title || meta.title || code;
          const slug = snap?.course?.slug || meta.slug || code.toLowerCase();
          const ownedHere = owned.has(code);
          const here =
            snap && (snap.state === "in_progress" || (snap.pct > 0 && snap.pct < 100));
          const done = snap && snap.pct >= 100;
          const cls = done ? "is-done" : here ? "is-here" : ownedHere ? "is-owned" : "";
          const badge = done
            ? "Hoàn thành"
            : here
              ? "Bạn đang ở đây"
              : ownedHere
                ? "Đã mở khóa"
                : "Đề xuất";
          const tipWhy =
            idx > 0 ? (map.next_courses || {})[chain[idx - 1]]?.why || "" : "";
          const bar =
            snap != null
              ? C().progressBarHtml(snap.pct)
              : `<div class="progress-bar"><span style="width:0%"></span></div>`;
          return `<li class="journey-item ${cls}">
            <span class="journey-item__badge">${esc(badge)}</span>
            <strong>${esc(code)}</strong>
            <span>${esc(title)}</span>
            ${bar}
            ${tipWhy ? `<p class="meta">${esc(tipWhy)}</p>` : ""}
            <a class="btn btn--line btn--small" href="../${esc(slug)}/">${
              ownedHere ? (done ? "Xem lại" : "Tiếp tục") : "Xem khóa"
            }</a>
          </li>`;
        })
        .join("");
    },

    async paintOrders(sb, hostId, statusId) {
      const box = document.getElementById(hostId);
      const status = document.getElementById(statusId);
      if (!box) return;
      const { data, error } = await sb
        .from("orders")
        .select("order_code,status,amount,created_at,paid_at,course:courses(code,slug,title)")
        .order("created_at", { ascending: false })
        .limit(40);
      const esc = C().esc;
      if (error) {
        if (status) status.textContent = error.message;
        return;
      }
      if (!data?.length) {
        if (status) status.textContent = "Chưa có đơn thanh toán.";
        box.innerHTML = "";
        return;
      }
      if (status) status.textContent = "";
      box.innerHTML = data
        .map((o) => {
          const c = o.course || {};
          const paid = o.status === "paid";
          return `<article class="order-card ${paid ? "is-paid" : "is-pending"}">
            <div>
              <strong>${esc(c.code || "")} · ${esc(o.order_code)}</strong>
              <p>${esc(c.title || "")}</p>
              <p class="meta">${fmtVnd(o.amount)} · ${fmtTime(o.created_at)}</p>
              <p class="meta"><strong>${esc(orderStatusVi(o.status))}</strong>${
                o.paid_at ? " · " + fmtTime(o.paid_at) : ""
              }</p>
            </div>
            <div class="order-card__right">
              <span class="order-badge">${paid ? "Đã thanh toán" : "Chờ CK"}</span>
              ${
                paid
                  ? `<a class="btn btn--line btn--small" href="../${esc(c.slug)}/#learner-root">Vào học</a>`
                  : `<a class="btn btn--amber btn--small" href="../${esc(c.slug)}/#dang-ky">Thanh toán / QR</a>`
              }
            </div>
          </article>`;
        })
        .join("");
    },
  };
})();
