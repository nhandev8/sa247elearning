window.SA247_ORDER_SCRIPT_URL =
  window.SA247_ORDER_SCRIPT_URL || "PASTE_GOOGLE_APPS_SCRIPT_WEBAPP_URL";

(function () {
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("is-solid", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 5) * 0.06}s`;
      io.observe(el);
    });
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  const form = document.getElementById("order-form");
  const msg = document.getElementById("order-msg");
  const submitBtn = document.getElementById("order-submit");
  const ORDER_SCRIPT_URL = window.SA247_ORDER_SCRIPT_URL;

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      msg.textContent = "";
      msg.className = "form-msg";

      if (!ORDER_SCRIPT_URL || ORDER_SCRIPT_URL.includes("PASTE_")) {
        msg.classList.add("is-err");
        msg.textContent =
          "Form chưa kết nối Apps Script. Nhắn Zalo 08 77 78 79 88 kèm ảnh CK để nhận Drive thủ công.";
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang gửi...";

      try {
        const res = await fetch(ORDER_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Gửi thất bại");
        msg.classList.add("is-ok");
        msg.textContent = json.message || "Đã gửi đăng ký. Kiểm tra email.";
        form.reset();
      } catch (err) {
        msg.classList.add("is-err");
        msg.textContent =
          "Không gửi được form. Hãy nhắn Zalo 08 77 78 79 88 kèm ảnh CK + email nhận Drive.";
        console.error(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Gửi đăng ký";
      }
    });
  }
})();
