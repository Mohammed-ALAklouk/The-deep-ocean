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

fetch('creatures.json')
  .then((res) => res.json())
  .then((creatures) => {
    const container = document.querySelector('.ocean-grid');
    const elements = [];

    creatures.forEach(({ name, slug, depth, col, colWidth, rowHeight }) => {
      const row = Math.max(1, Math.round(depth / ROW_HEIGHT_METERS));

      const el = document.createElement('div');
      el.className = 'creature';
      el.style.gridColumn = `${col} / span ${colWidth}`;
      el.style.gridRow = `${row} / span ${rowHeight}`;

      const img = document.createElement('img');
      img.src = `creatures/images/${slug}.png`;
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

    elements.forEach((el) => {
      // Fade + blur in as it scrolls into view
      gsap.fromTo(el,
        { opacity: 0, y: 30, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "top center",
            scrub: true,
          }
        }
      );

      // Fade + blur out as it scrolls past, above the viewport
      gsap.fromTo(el,
        { opacity: 1, filter: "blur(0px)" },
        {
          opacity: 0,
          filter: "blur(6px)",
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: "bottom top",
            end: "bottom top-=300",
            scrub: true,
          }
        }
      );
    });
  });
