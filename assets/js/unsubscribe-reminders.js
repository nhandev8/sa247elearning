/* SA247 — hủy nhận email nhắc học từ link trong email (?t=token). */
(function () {
  function paint(root, html) {
    root.innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("unsub-root");
    if (!root) return;
    const token = new URL(location.href).searchParams.get("t") || "";
    if (!token || token.length < 20) {
      paint(
        root,
        `<p class="form-msg">Link hủy nhận không hợp lệ hoặc đã hết hiệu lực.</p>
         <p class="meta">Nếu bạn đã đăng nhập, hãy vào <a href="/cai-dat/">Cài đặt</a> để tắt email nhắc học.</p>`,
      );
      return;
    }
    if (!window.sa247Auth?.ready) {
      paint(root, `<p class="form-msg">Chưa kết nối được hệ thống. Tải lại trang.</p>`);
      return;
    }
    try {
      const sb = await sa247Auth.ensureClient();
      const { data, error } = await sb.rpc("unsubscribe_learning_reminders", { p_token: token });
      if (error) throw error;
      if (data) {
        paint(
          root,
          `<p class="checkout-lead"><b>Đã tắt email nhắc học.</b></p>
           <p class="meta">Bạn sẽ không nhận thêm email nhắc tiếp tục học từ SA247.</p>
           <p class="meta">Muốn bật lại sau này: đăng nhập → <a href="/cai-dat/">Cài đặt</a>.</p>
           <p class="contact__cta" style="margin-top:20px">
             <a class="btn btn--amber" href="/dashboard/">Vào Học tập</a>
             <a class="btn btn--line" href="/">Về trang chủ</a>
           </p>`,
        );
      } else {
        paint(
          root,
          `<p class="form-msg">Không tìm thấy yêu cầu hủy nhận với link này.</p>
           <p class="meta">Thử lại từ email mới nhất, hoặc vào <a href="/cai-dat/">Cài đặt</a> khi đã đăng nhập.</p>`,
        );
      }
    } catch (e) {
      paint(
        root,
        `<p class="form-msg">Không hủy nhận được lúc này. Thử lại sau.</p>
         <p class="meta">${String(e.message || e)}</p>`,
      );
    }
  });
})();
