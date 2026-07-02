export const lightboxStyles = `
      .md-image { cursor: zoom-in; }
      .lightbox {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(1rem, 4vw, 2.5rem);
        background: rgba(0, 0, 0, 0.9);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease;
      }
      .lightbox.is-open {
        opacity: 1;
        visibility: visible;
      }
      .lightbox img {
        display: block;
        max-width: min(100%, 1200px);
        max-height: calc(100vh - 5rem);
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      }
      .lightbox-close {
        position: absolute;
        top: clamp(0.75rem, 3vw, 1.25rem);
        right: clamp(0.75rem, 3vw, 1.25rem);
        width: 2.5rem;
        height: 2.5rem;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
      }
      .lightbox-close:hover { background: rgba(255, 255, 255, 0.22); }
      body.lightbox-open { overflow: hidden; }
`;

export const lightboxScriptBody = `
      (function () {
        var lb = null;
        var lbImg = null;
        var lbClose = null;

        function ensureLightbox() {
          if (lb) return;
          lb = document.createElement("div");
          lb.className = "lightbox";
          lb.setAttribute("role", "dialog");
          lb.setAttribute("aria-modal", "true");
          lb.setAttribute("aria-label", "Expanded image");
          lb.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close">&times;</button><img alt="">';
          lbImg = lb.querySelector("img");
          lbClose = lb.querySelector(".lightbox-close");
          lbClose.addEventListener("click", close);
          lb.addEventListener("click", function (e) {
            if (e.target === lb) close();
          });
          document.body.appendChild(lb);
        }

        function open(src, alt) {
          ensureLightbox();
          lbImg.src = src;
          lbImg.alt = alt || "";
          lb.classList.add("is-open");
          document.body.classList.add("lightbox-open");
          document.addEventListener("keydown", onKey);
          lbClose.focus();
        }

        function close() {
          if (!lb) return;
          lb.classList.remove("is-open");
          document.body.classList.remove("lightbox-open");
          document.removeEventListener("keydown", onKey);
          lbImg.removeAttribute("src");
        }

        function onKey(e) {
          if (e.key === "Escape") close();
        }

        document.addEventListener("click", function (e) {
          var img = e.target.closest(".md-image");
          if (!img || !img.src) return;
          e.preventDefault();
          open(img.currentSrc || img.src, img.alt);
        });
      })();`;

export function lightboxScript() {
  return `<script>${lightboxScriptBody}</script>`;
}
