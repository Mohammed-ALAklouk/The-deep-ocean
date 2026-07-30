// ---- CREATURES ----
// Data-driven, copied from neal.fun's Deep Sea layout system: each entry in
// creatures.json carries the real depth (meters) plus the exact CSS grid
// col/colWidth/rowHeight neal.fun uses to place it — an 8-column grid with
// 50px rows, one row per 3m of depth. Using their real, hand-placed
// coordinates (instead of computing positions ourselves) is what avoids
// creatures overlapping.
// Depends on the `.ocean-grid` container and `px_per_metter`/zone setup in
// script.js (loaded before this file).

const ROW_HEIGHT_METERS = 3;

// Blur is quantised to whole pixels, 0 (sharp) through BLUR_MAX. The number is
// literally the radius — see the .creature[data-blur] rules in style.css.
const BLUR_MAX = 6;

fetch('creatures.json')
  .then((res) => res.json())
  .then((creatures) => {
    const container = document.querySelector('.ocean-grid');
    const elements = [];

    creatures.forEach(({ name, slug, depth, col, colWidth, rowHeight }) => {
      const row = Math.max(1, Math.round(depth / ROW_HEIGHT_METERS));

      const el = document.createElement('div');
      el.className = 'creature';
      // Fully blurred until it scrolls into view. Set here rather than added later
      // so it's true on the element's very first render.
      el.dataset.blur = BLUR_MAX;
      el.style.gridColumn = `${col} / span ${colWidth}`;
      el.style.gridRow = `${row} / span ${rowHeight}`;


      const imgPath = `creatures/images/${slug}.png`;

      const img = document.createElement('img');
      // The grid cell (.creature) already reserves space via gridColumn/gridRow,
      // so lazy-loading can't cause layout shift here — no per-image dimensions
      // needed. Just defer offscreen images until they're near the viewport.
      img.loading = 'lazy';
      img.decoding = 'async';
      
      img.src = imgPath;
      img.className = 'creature-photo';
      img.alt = name;
      img.onerror = () => { el.style.display = 'none'; };

      const label = document.createElement('span');
      label.className = 'creature-name';
      label.textContent = name;

      el.append(img, label);
      container.appendChild(el);
      elements.push(el);
    });

    // All 128 creatures just got inserted after Lenis/ScrollTrigger already
    // measured the page at its pre-creature (hero-only) height, so their
    // cached scroll limits are stale until told to remeasure — without this,
    // Lenis clamps real scrolling to roughly the hero's height and every
    // scroll-driven animation (like the depth counter's fade) reads the
    // wrong scroll position.
    lenis.resize();
    ScrollTrigger.refresh();

    // These two tweens per creature used to also scrub `filter: blur(6px)` ->
    // `blur(0px)`. That was the single most expensive thing on the page. A scrubbed
    // filter is re-evaluated on every scroll frame, and every distinct blur radius
    // forces a full re-rasterization of the element — here a full-size creature PNG
    // that already carries its own drop-shadow filter (see .creature img in
    // style.css). With 128 creatures × 2 triggers, several of them in range at any
    // moment, that was several large re-rasters per frame for the whole descent.
    //
    // opacity and y are scrubbed directly: the compositor animates both without
    // repainting, so tying them to scroll position costs effectively nothing.
    //
    // Blur is scrubbed too — it has to be, that ramp as the creature rises into view
    // is the entire look — but through a quantised step rather than a raw value. The
    // expensive thing was never "a filter exists", it was *a different blur radius
    // every frame*: each distinct radius is a fresh convolution over a full-size PNG
    // that already carries its own drop-shadow. Rounding progress to whole pixels
    // means a crossing produces 7 rasters instead of ~60, while still tracking the
    // scroll position exactly. applyBlur skips redundant writes, so the DOM is only
    // touched when the step actually changes, not on every one of the ~60 onUpdate
    // calls per crossing.
    const blurSyncs = [];

    elements.forEach((el) => {
      let step = Number(el.dataset.blur);

      const applyBlur = (raw) => {
        const next = Math.max(0, Math.min(BLUR_MAX, Math.round(raw)));
        if (next === step) return;
        step = next;
        // Sharp is the absence of the attribute, so the settled state matches no
        // rule at all and the element carries no `filter` — not even blur(0px).
        if (next === 0) el.removeAttribute("data-blur");
        else el.dataset.blur = next;
      };

      // Fade in and sharpen as it scrolls into view
      const fadeIn = gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "top center",
            scrub: true,
            onUpdate: (self) => applyBlur((1 - self.progress) * BLUR_MAX),
            // onUpdate isn't guaranteed to land exactly on the boundary values, so
            // the ends are pinned explicitly.
            onLeave: () => applyBlur(0),
            onLeaveBack: () => applyBlur(BLUR_MAX),
          }
        }
      );

      // Fade out and blur again as it scrolls past, above the viewport
      const fadeOut = gsap.fromTo(el,
        { opacity: 1 },
        {
          opacity: 0,
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: "top top+=200",
            end: "bottom top",
            scrub: true,
            onUpdate: (self) => applyBlur(self.progress * BLUR_MAX),
            onLeave: () => applyBlur(BLUR_MAX),
            onLeaveBack: () => applyBlur(0),
          }
        }
      );

      // onUpdate only fires while a trigger is actually in range, which leaves every
      // out-of-range creature holding whatever value it last had. That's wrong in two
      // situations: at load, when the page opens partway down (a refresh mid-scroll,
      // or a browser-restored position) and creatures above the fold were born
      // blurred; and after any resize, where every creature moves relative to the
      // viewport while none of them are in range to notice. So resolve it explicitly
      // from whichever phase the creature is actually in.
      const inST = fadeIn.scrollTrigger;
      const outST = fadeOut.scrollTrigger;
      const syncBlur = () => applyBlur(outST.progress > 0
        ? outST.progress * BLUR_MAX
        : (1 - inST.progress) * BLUR_MAX);

      blurSyncs.push(syncBlur);
      syncBlur();
    });

    // Re-sync after every refresh, not just at load. ScrollTrigger re-measures on
    // resize, and it also refreshes once more after this file runs — layout is still
    // settling as images resolve — so a one-shot sync above goes stale immediately.
    // "refresh" fires after the recalculation, so the progress values read here are
    // the fresh ones.
    ScrollTrigger.addEventListener("refresh", () => blurSyncs.forEach((sync) => sync()));
  });
