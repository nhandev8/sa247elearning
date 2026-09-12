/* Catalog hub: giữ layout nhóm tĩnh từ build (ATVSLĐ / xây dựng / …).
 * Không inject lưới phẳng từ Supabase vào #catalog-live-root —
 * trước đây tạo bản trùng + class .reveal không được site.js observe
 * → ~1400px khoảng trống sau đoạn lead.
 * Xuất bản khóa vẫn qua Admin/Supabase; card hub sync qua build_landings khi cần.
 */
(function () {
  /* reserved for future: hydrate metadata on [data-live-catalog] cards without duplicating grid */
})();
