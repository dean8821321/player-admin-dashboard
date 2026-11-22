/*
 * Iklan demo untuk menguji slot Ads di player.
 *
 * Cara kerja: player menyisipkan
 *   <script>window.atOptions = { key, format, width, height, params }</script>
 *   <script src="ads-demo.js"></script>
 * di dalam <div class="ad-slot">. Script ini membaca window.atOptions lalu
 * menggambar kotak iklan berukuran sesuai konfigurasi.
 *
 * format "iframe" -> dirender sebagai <iframe> (terisolasi dari CSS halaman)
 * format "script" -> dirender sebagai <div> biasa
 *
 * File ini hanya untuk pengujian. Jangan dipakai untuk iklan sungguhan.
 */
(function () {
  "use strict";

  var options =
    window.atOptions && typeof window.atOptions === "object"
      ? window.atOptions
      : {};

  function toPositiveInt(value, fallback) {
    var parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  var width = toPositiveInt(options.width, 300);
  var height = toPositiveInt(options.height, 250);
  var format = typeof options.format === "string" ? options.format : "iframe";
  var key =
    typeof options.key === "string" && options.key.trim()
      ? options.key.trim()
      : "(key kosong)";

  function buildMarkup() {
    var compact = height < 90;
    var large = height >= 200;
    var titleSize = compact ? 12 : Math.max(13, Math.min(24, Math.round(height / 12)));

    var lines = [
      '<div style="font-size:' + titleSize + 'px;font-weight:800;' +
        'letter-spacing:' + (compact ? "0.5px" : "1px") + ';white-space:nowrap">' +
        "IKLAN DEMO" + (compact ? " " + width + " \u00d7 " + height : "") +
        "</div>",
    ];

    if (!compact) {
      lines.push(
        '<div style="font-size:12px;color:#9fb8ad">' + width + " \u00d7 " + height + " px</div>"
      );
      lines.push(
        '<div style="font-size:11px;color:#7d9188">format: ' + escapeHtml(format) + "</div>"
      );
      if (large) {
        lines.push(
          '<div style="font-size:11px;color:#7d9188;max-width:100%;word-break:break-all">key: ' +
            escapeHtml(key) +
            "</div>"
        );
      }
    }

    return (
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<style>html,body{margin:0;height:100%;overflow:hidden;}' +
      "body{display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "gap:6px;box-sizing:border-box;padding:6px;text-align:center;" +
      "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#7ef0b6;" +
      "border:2px dashed #35d28b;border-radius:10px;" +
      "background:repeating-linear-gradient(45deg,#10251b,#10251b 10px,#0d1f17 10px,#0d1f17 20px);" +
      "}</style></head><body>" +
      lines.join("") +
      "</body></html>"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createNode() {
    var markup = buildMarkup();
    var node;

    if (format === "iframe") {
      node = document.createElement("iframe");
      node.title = "Iklan demo";
      node.setAttribute("data-ad-demo", "true");
      node.setAttribute("scrolling", "no");
      node.setAttribute("frameborder", "0");
      node.srcdoc = markup;
    } else {
      node = document.createElement("div");
      node.setAttribute("data-ad-demo", "true");
      node.innerHTML = markup
        .replace(/^[\s\S]*?<body>/, "")
        .replace(/<\/body>[\s\S]*$/, "");
    }

    node.style.boxSizing = "border-box";
    node.style.display = "block";
    node.style.width = width + "px";
    node.style.maxWidth = "100%";
    node.style.height = height + "px";
    node.style.margin = "0 auto";
    node.style.border = "0";
    node.style.overflow = "hidden";

    return node;
  }

  function mount() {
    var node = createNode();
    var script = document.currentScript;

    if (script && script.parentNode) {
      script.parentNode.insertBefore(node, script.nextSibling);
      return;
    }

    var slot = document.querySelector(".ad-slot");
    (slot || document.body).appendChild(node);
  }

  mount();
})();
