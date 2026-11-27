(() => {
  let overlay = null;
  let activeSourceVideo = null;
  let activeModalVideo = null;
  let shouldResumeSourceVideo = false;
  let lastTrigger = null;
  let cleanupZoom = null;

  const SCROLL_KEYS = new Set([" ", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

  function preventScroll(event) {
    event.preventDefault();
  }

  function preventScrollKeys(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (SCROLL_KEYS.has(event.key)) {
      if (event.key === " " && document.activeElement?.tagName === "VIDEO") return;
      event.preventDefault();
    }
  }

  function lockScroll() {
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", preventScrollKeys);
  }

  function unlockScroll() {
    window.removeEventListener("wheel", preventScroll);
    window.removeEventListener("touchmove", preventScroll);
    window.removeEventListener("keydown", preventScrollKeys);
  }

  function closeLightbox() {
    if (!overlay) return;
    if (cleanupZoom) {
      cleanupZoom();
      cleanupZoom = null;
    }
    if (activeModalVideo && activeSourceVideo) {
      try {
        activeSourceVideo.currentTime = activeModalVideo.currentTime;
      } catch {}
      activeModalVideo.pause();
      if (shouldResumeSourceVideo || activeSourceVideo.autoplay) {
        activeSourceVideo.play().catch(() => {});
      }
    }
    const closing = overlay;
    overlay = null;
    activeSourceVideo = null;
    activeModalVideo = null;
    shouldResumeSourceVideo = false;
    unlockScroll();
    closing.classList.remove("is-open");
    window.setTimeout(() => closing.remove(), 180);
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function attachImageZoom(dialog, img, controls) {
    const MIN_SCALE = 1;
    const MAX_SCALE = 4;
    const STEP = 1.35;
    const { zoomOutBtn, zoomResetBtn, zoomInBtn } = controls;
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let dragging = false;
    let didDrag = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let originTx = 0;
    let originTy = 0;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let touchPanning = false;

    function clampTranslate(nextScale, nextTx, nextTy) {
      if (nextScale <= 1) return { tx: 0, ty: 0 };
      const rect = img.getBoundingClientRect();
      const baseW = rect.width / scale;
      const baseH = rect.height / scale;
      const maxX = Math.max(0, (baseW * nextScale - window.innerWidth * 0.92) / 2 + 40);
      const maxY = Math.max(0, (baseH * nextScale - window.innerHeight * 0.8) / 2 + 40);
      return {
        tx: Math.max(-maxX, Math.min(maxX, nextTx)),
        ty: Math.max(-maxY, Math.min(maxY, nextTy)),
      };
    }

    function applyTransform(animate) {
      img.style.transition = animate ? "transform 0.16s ease" : "none";
      img.style.transform = scale === 1 && tx === 0 && ty === 0
        ? ""
        : "translate3d(" + tx + "px, " + ty + "px, 0) scale(" + scale + ")";
      img.classList.toggle("is-zoomed", scale > 1);
      img.classList.toggle("is-dragging", dragging);
      zoomResetBtn.textContent = Math.round(scale * 100) + "%";
      zoomOutBtn.disabled = scale <= MIN_SCALE;
      zoomInBtn.disabled = scale >= MAX_SCALE;
      zoomResetBtn.disabled = scale <= MIN_SCALE;
    }

    function zoomAt(nextScale, clientX, clientY, animate) {
      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      if (clampedScale <= 1.02) {
        scale = 1;
        tx = 0;
        ty = 0;
        applyTransform(animate);
        return;
      }
      const rect = img.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const ratio = clampedScale / scale;
      const nextTx = tx + (clientX - cx) * (1 - ratio);
      const nextTy = ty + (clientY - cy) * (1 - ratio);
      const bounded = clampTranslate(clampedScale, nextTx, nextTy);
      scale = clampedScale;
      tx = bounded.tx;
      ty = bounded.ty;
      applyTransform(animate);
    }

    function zoomCenter(nextScale) {
      zoomAt(nextScale, window.innerWidth / 2, window.innerHeight / 2, true);
    }

    function resetZoom() {
      scale = 1;
      tx = 0;
      ty = 0;
      applyTransform(true);
    }

    function onWheel(event) {
      event.preventDefault();
      const sensitivity = event.ctrlKey ? 0.01 : 0.0022;
      const factor = Math.exp(-event.deltaY * sensitivity);
      zoomAt(scale * factor, event.clientX, event.clientY, false);
    }

    function onKeyDown(event) {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomCenter(scale * STEP);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomCenter(scale / STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    }

    function onMouseDown(event) {
      if (event.button !== 0 || scale <= 1) return;
      event.preventDefault();
      dragging = true;
      didDrag = false;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      originTx = tx;
      originTy = ty;
      applyTransform(false);
    }

    function onMouseMove(event) {
      if (!dragging) return;
      const dx = event.clientX - dragStartX;
      const dy = event.clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      const bounded = clampTranslate(scale, originTx + dx, originTy + dy);
      tx = bounded.tx;
      ty = bounded.ty;
      applyTransform(false);
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      applyTransform(false);
    }

    function onTouchStart(event) {
      if (event.touches.length === 2) {
        touchPanning = false;
        const [a, b] = event.touches;
        pinchStartDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        pinchStartScale = scale;
      } else if (event.touches.length === 1 && scale > 1) {
        touchPanning = true;
        didDrag = false;
        dragStartX = event.touches[0].clientX;
        dragStartY = event.touches[0].clientY;
        originTx = tx;
        originTy = ty;
      }
    }

    function onTouchMove(event) {
      if (event.touches.length === 2 && pinchStartDist > 0) {
        event.preventDefault();
        const [a, b] = event.touches;
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        zoomAt(pinchStartScale * (dist / pinchStartDist), midX, midY, false);
      } else if (event.touches.length === 1 && touchPanning && scale > 1) {
        event.preventDefault();
        const dx = event.touches[0].clientX - dragStartX;
        const dy = event.touches[0].clientY - dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
        const bounded = clampTranslate(scale, originTx + dx, originTy + dy);
        tx = bounded.tx;
        ty = bounded.ty;
        applyTransform(false);
      }
    }

    function onTouchEnd(event) {
      if (event.touches.length < 2) pinchStartDist = 0;
      if (event.touches.length === 0) touchPanning = false;
    }

    img.addEventListener("click", (event) => {
      event.stopPropagation();
      if (didDrag) {
        didDrag = false;
        return;
      }
      if (scale > 1) {
        resetZoom();
      } else {
        closeLightbox();
      }
    });

    zoomOutBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      zoomCenter(scale / STEP);
    });

    zoomInBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      zoomCenter(scale * STEP);
    });

    zoomResetBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      resetZoom();
    });

    applyTransform(false);

    dialog.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    img.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dialog.addEventListener("touchstart", onTouchStart, { passive: true });
    dialog.addEventListener("touchmove", onTouchMove, { passive: false });
    dialog.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      dialog.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      img.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dialog.removeEventListener("touchstart", onTouchStart);
      dialog.removeEventListener("touchmove", onTouchMove);
      dialog.removeEventListener("touchend", onTouchEnd);
    };
  }

  function openLightbox(target) {
    if (overlay) closeLightbox();
    lastTrigger = target;

    const dialog = document.createElement("div");
    dialog.className = "media-lightbox";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "미디어 전체화면 미리보기");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "media-lightbox__close";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    closeBtn.addEventListener("click", closeLightbox);

    const frame = document.createElement("div");
    frame.className = "media-lightbox__frame";

    if (target.tagName === "IMG") {
      const img = document.createElement("img");
      img.className = "media-lightbox__media media-lightbox__media--image";
      img.src = target.currentSrc || target.src;
      img.alt = target.alt || "";
      img.draggable = false;
      frame.appendChild(img);

      const controls = document.createElement("div");
      controls.className = "media-lightbox__controls";
      controls.addEventListener("click", (event) => event.stopPropagation());

      const zoomOutBtn = document.createElement("button");
      zoomOutBtn.type = "button";
      zoomOutBtn.className = "media-lightbox__ctrl-btn";
      zoomOutBtn.setAttribute("aria-label", "축소");
      zoomOutBtn.title = "축소 (휠 · 핀치 · -)";
      zoomOutBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>';

      const zoomResetBtn = document.createElement("button");
      zoomResetBtn.type = "button";
      zoomResetBtn.className = "media-lightbox__ctrl-level";
      zoomResetBtn.setAttribute("aria-label", "배율 초기화");
      zoomResetBtn.title = "100%로 초기화 (0)";
      zoomResetBtn.textContent = "100%";

      const zoomInBtn = document.createElement("button");
      zoomInBtn.type = "button";
      zoomInBtn.className = "media-lightbox__ctrl-btn";
      zoomInBtn.setAttribute("aria-label", "확대");
      zoomInBtn.title = "확대 (휠 · 핀치 · +)";
      zoomInBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

      controls.appendChild(zoomOutBtn);
      controls.appendChild(zoomResetBtn);
      controls.appendChild(zoomInBtn);
      dialog.appendChild(controls);

      cleanupZoom = attachImageZoom(dialog, img, { zoomOutBtn, zoomResetBtn, zoomInBtn });

      const figure = target.closest("figure");
      const figcaption = figure ? figure.querySelector("figcaption") : null;
      if (figcaption && figcaption.textContent && figcaption.textContent.trim()) {
        const cap = document.createElement("p");
        cap.className = "media-lightbox__caption";
        cap.textContent = figcaption.textContent.trim();
        frame.appendChild(cap);
      }
    } else if (target.tagName === "VIDEO") {
      const sourceVideo = target;
      const wasPlaying = !sourceVideo.paused && !sourceVideo.ended;
      const currentTime = sourceVideo.currentTime || 0;
      sourceVideo.pause();

      const video = sourceVideo.cloneNode(true);
      video.className = "media-lightbox__media media-lightbox__media--video";
      video.controls = true;
      video.removeAttribute("width");
      video.removeAttribute("height");
      video.addEventListener(
        "loadedmetadata",
        () => {
          try {
            if (currentTime > 0) video.currentTime = currentTime;
          } catch {}
          if (wasPlaying || sourceVideo.autoplay) {
            video.play().catch(() => {});
          }
        },
        { once: true },
      );

      activeSourceVideo = sourceVideo;
      activeModalVideo = video;
      shouldResumeSourceVideo = wasPlaying;
      frame.appendChild(video);
    }

    dialog.appendChild(closeBtn);
    dialog.appendChild(frame);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target === frame) {
        closeLightbox();
      }
    });

    document.body.appendChild(dialog);
    lockScroll();
    overlay = dialog;
    requestAnimationFrame(() => dialog.classList.add("is-open"));
    closeBtn.focus();
  }

  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return;

    const img = el.closest(".sl-markdown-content img");
    if (img && !img.closest("a, .media-lightbox")) {
      event.preventDefault();
      openLightbox(img);
      return;
    }

    const video = el.closest(".sl-markdown-content video");
    if (video && !video.closest("a, .media-lightbox")) {
      if (video.controls) {
        const rect = video.getBoundingClientRect();
        if (event.clientY > rect.bottom - 44) return;
      }
      event.preventDefault();
      openLightbox(video);
    }
  });
})();
