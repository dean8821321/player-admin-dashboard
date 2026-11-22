/*
 * Iklan demo untuk menguji slot Ads di player.
 *
 * Cara kerja: player menyisipkan
 *   <script>window.atOptions = { key, format, width, height, params }</script>
 *   <script src="ads-demo.js"></script>
 * di dalam <div class="ad-slot">. Script ini membaca window.atOptions lalu
 * menggambar kotak iklan berukuran sesuai konfigurasi.
 *
 * File ini hanya untuk pengujian. Jangan dipakai untuk iklan sungguhan.
 */
(function () {
  "use strict";

  var options = window.atOptions && typeof window.atOptions === "object"
    ? window.atOptions
    : {};

  var toPositiveInt = function (value, fallback) {
    var parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  var width = toPositiveInt(options.width, 300);
  var height = toPositiveInt(options.height, 250);
  var format = typeof options.format === "string" ? options.format : "iframe";
  var key = typeof options.key === "string" && options.key.trim()
    ? options.key.trim()
    : "(key kosong)";

  function createBox() {
    var box = document.createElement("div");
    box.setAttribute("data-ad-demo", "true");
    box.style.boxSizing = "border-box";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.alignItems = "center";
    box.style.justifyContent = "center";
    box.style.gap = "6px";
    box.style.width = "100%";
    box.style.maxWidth = width + "px";
    box.style.height = height + "px";
    box.style.margin = "0 auto";
    box.style.padding = "10px";
    box.style.border = "2px dashed #35d28b";
    box.style.borderRadius = "10px";
    box.style.background =
      "repeating-linear-gradient(45deg, #10251b, #10251b 10px, #0d1f17 10px, #0d1f17 20px)";
    box.style.color = "#7ef0b6";
    box.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
    box.style.textAlign = "center";
    box.style.overflow = "hidden";

    var compact = height < 90;

    var title = document.createElement("div");
    title.textContent = compact
      ? "IKLAN DEMO " + width + " \u00d7 " + height
      : "IKLAN DEMO";
    title.style.fontSize = compact
      ? "12px"
      : Math.max(13, Math.min(22, Math.round(height / 12))) + "px";
    title.style.fontWeight = "800";
    title.style.letterSpacing = compact ? "0.5px" : "1px";
    title.style.whiteSpace = "nowrap";

    box.appendChild(title);

    if (compact) return box;

    var size = document.createElement("div");
    size.textContent = width + " × " + height + " px";
    size.style.fontSize = "12px";
    size.style.color = "#9fb8ad";

    var meta = document.createElement("div");
    meta.textContent = "format: " + format;
    meta.style.fontSize = "11px";
    meta.style.color = "#7d9188";

    var keyLine = document.createElement("div");
    keyLine.textContent = "key: " + key;
    keyLine.style.fontSize = "11px";
    keyLine.style.color = "#7d9188";
    keyLine.style.wordBreak = "break-all";
    keyLine.style.maxWidth = "100%";

    box.appendChild(size);
    box.appendChild(meta);
    box.appendChild(keyLine);

    return box;
  }

  function mount() {
    var box = createBox();
    var script = document.currentScript;

    if (script && script.parentNode) {
      script.parentNode.insertBefore(box, script.nextSibling);
      return;
    }

    var slot = document.querySelector(".ad-slot");
    (slot || document.body).appendChild(box);
  }

  mount();
})();
