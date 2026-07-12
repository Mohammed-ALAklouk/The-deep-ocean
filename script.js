import { ParticleSystem } from './particles.js';
let totalHeight = 10924; // matches neal.fun's Deep Sea (Challenger Deep) max depth

let sunlight_zone_height = 200;
let twilight_zone_height = 800;
let midnight_zone_height = 3000;
let abyssal_zone_height = 2000;
let hadal_zone_height = totalHeight - 6000;

// neal.fun's Deep Sea places every creature on a CSS grid: 50px-tall rows,
// each row spanning 3m of depth. Copying that fixed ratio (instead of a
// viewport-relative vh unit) is what lets creatures.json's real row/col
// data from that site line up correctly here.
const px_per_metter = 50 / 3;

gsap.registerPlugin(ScrollTrigger);
// syncTouch drives touch scrolling through Lenis's own RAF loop instead of
// leaving it to the browser's native (compositor-thread) scroll. The zone text
// is "frozen" by a JS counter-transform applied on scroll (see the manual pin
// below); with native touch scroll that transform lags the page a frame at a
// time and the text visibly jitters on mobile. Routing touch through Lenis puts
// the scroll and the counter-transform on the same clock, as they already are
// for wheel scrolling on desktop.
const lenis = new Lenis({ syncTouch: true });

lenis.on('scroll', ScrollTrigger.update);
let scrollDiv = document.querySelector('.depth-counter');

gsap.ticker.add((time) => {
  lenis.raf(time * 1000); // GSAP counts in seconds, Lenis wants milliseconds
});

gsap.ticker.lagSmoothing(0);

const zonesContainer = document.querySelector('.zones-container');

// Depth = where the counter's own reference line (70vh down the screen) sits
// within the zones-container, mapped to 0..totalHeight. Computed directly from
// live geometry instead of a ScrollTrigger's clamped progress, so it keeps
// counting smoothly all the way to totalHeight exactly when the 70vh line
// reaches the true bottom of the zone — no early freeze, no snap. (The old
// progress-based version ended at "bottom bottom", i.e. when the zone bottom
// hit the viewport bottom, which is 30vh of scroll before the 70vh counter
// line actually reaches the bottom — that gap is what stuck it at 10911.)
function updateDepthCounter() {
  const rect = zonesContainer.getBoundingClientRect();
  if (!rect.height) return;
  const counterRefY = 0.7 * window.innerHeight;        // counter line, in viewport coords
  const progress = (counterRefY - rect.top) / rect.height;
  const depth = Math.round(Math.max(0, Math.min(1, progress)) * totalHeight);
  scrollDiv.textContent = `${depth} m`;
}

lenis.on('scroll', updateDepthCounter);
window.addEventListener('resize', updateDepthCounter);
updateDepthCounter();

let sunlight_element = document.querySelector('#sunlight');
let twilight_element = document.querySelector('#twilight');
let midnight_element = document.querySelector('#midnight');
let abyssal_element = document.querySelector('#abyssal');
let hadal_element = document.querySelector('#hadal');

sunlight_element.style.minHeight = sunlight_zone_height * px_per_metter + 'px';
twilight_element.style.minHeight = twilight_zone_height * px_per_metter + 'px';
midnight_element.style.minHeight = midnight_zone_height * px_per_metter + 'px';
abyssal_element.style.minHeight = abyssal_zone_height * px_per_metter + 'px';
hadal_element.style.minHeight = hadal_zone_height * px_per_metter + 'px';

gsap.fromTo(document.querySelector(".depth-container"),
  { opacity: 0 },
  {
    opacity: 1,
    scrollTrigger: {
      trigger: "#sunlight",
      start: "top top",
      end: "50% top",
      scrub: true,
    }
  }
);

// Unpin the counter right as the footer starts: switch it from `fixed` (always
// on screen) to `absolute` at its exact current on-screen spot, so it freezes
// there and scrolls away naturally with the page instead of floating onto the
// footer or being hidden.
// Trigger point is "top 70%", not "top bottom" — the counter itself sits at
// 70vh down the screen (see offsetPx above), so unpinning at "top bottom"
// (a full viewport-height early) would freeze it before its own reference
// point actually reaches the true bottom of the zone, showing a depth short
// of the real max. "top 70%" lines the unpin up with the counter's own
// position, so it keeps live-tracking until it's genuinely at the bottom.
const depthContainer = document.querySelector(".depth-container");
ScrollTrigger.create({
  trigger: ".site-footer",
  start: "top 70%",
  onEnter: () => {
    const top = depthContainer.getBoundingClientRect().top + window.scrollY;
    gsap.set(depthContainer, { position: "absolute", top, transform: "none" });
  },
  onLeaveBack: () => {
    gsap.set(depthContainer, { position: "fixed", top: "", transform: "" });
  },
});

// ---- ZONE NAV ----
// Five dots down the right edge, one per zone; the dot for the zone currently
// under the viewport's center line is filled. Mirrors the depth meter: fades
// (and slides) in on the same #sunlight trigger, and unpins onto the footer
// so it sticks with the last zone instead of floating over the footer.

const zoneNav = document.querySelector(".zone-nav");
const navDots = Array.from(document.querySelectorAll(".zone-nav-dot"));
const navZones = navDots.map((dot) => document.getElementById(dot.dataset.target));

// Center vertically via GSAP (not CSS transform) so the slide-in x tween below
// can coexist with it — GSAP tracks x / yPercent as separate transform parts.
gsap.set(zoneNav, { yPercent: -50 });

// Fade + slide into place, scrubbed to scroll, on the same trigger as the meter.
gsap.fromTo(zoneNav,
  { opacity: 0, x: 40 },
  {
    opacity: 1,
    x: 0,
    scrollTrigger: {
      trigger: "#sunlight",
      start: "top top",
      end: "50% top",
      scrub: true,
    }
  }
);

// Highlight the dot for whichever zone spans the viewport's vertical center.
function updateActiveZone() {
  const refY = 0.5 * window.innerHeight;
  let activeIndex = 0;
  navZones.forEach((zone, i) => {
    if (zone.getBoundingClientRect().top <= refY) activeIndex = i;
  });
  navDots.forEach((dot, i) => dot.classList.toggle("active", i === activeIndex));
}
lenis.on("scroll", updateActiveZone);
window.addEventListener("resize", updateActiveZone);
updateActiveZone();

// Click a dot → smooth-scroll that zone to the top of the viewport. Lenis's
// scrollTo only reliably takes a numeric offset here, so resolve the zone's
// document-space top ourselves.
navDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const zone = document.getElementById(dot.dataset.target);
    const targetY = zone.getBoundingClientRect().top + window.scrollY;
    lenis.scrollTo(targetY);
  });
});

// Unpin onto the footer, same as the depth meter. Nav sits at the vertical
// center (50vh), so freeze when the footer top reaches center ("top center").
ScrollTrigger.create({
  trigger: ".site-footer",
  start: "top center",
  onEnter: () => {
    const top = zoneNav.getBoundingClientRect().top + window.scrollY;
    gsap.set(zoneNav, { position: "absolute", top, yPercent: 0 });
  },
  onLeaveBack: () => {
    gsap.set(zoneNav, { position: "fixed", top: "", yPercent: -50 });
  },
});

gsap.utils.toArray(".zone-text-container").forEach((textEl) => {
  const parentZone = textEl.closest(".zone");

  // 1. Entrance: fades in as zone scrolls up into view (original animation)
  gsap.fromTo(textEl,
    { opacity: 0, y: 30, filter: "blur(6px)" },
    {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      scrollTrigger: {
        trigger: parentZone,
        start: "top bottom",
        end: "top top+=100px",
        scrub: true,
      }
    }
  );

  // 2. Manual Pin: Instead of GSAP's pin:true (which causes layout jumps when unpinning without pinSpacing),
  // we manually translate the Y position at the exact speed of the user's scroll.
  // This visually freezes it on the screen for 800px.
  gsap.fromTo(textEl,
    { y: 0 },
    {
      y: 800, // Moves down exactly 800px
      ease: "none",
      immediateRender: false, // Prevents killing the entrance animation!
      scrollTrigger: {
        trigger: parentZone,
        start: "top top", // Starts pinning when the zone reaches the top of the viewport
        end: "top top-=800px", // Ends exactly 800px later
        scrub: true,
      }
    }
  );

  // 3. Exit: fades out smoothly WHILE drifting up naturally (original animation, just delayed)
  // The manual pin above stops at `top-=800px`. As the user keeps scrolling, the text now drifts up natively.
  // We fade it out during this drift over 500px.
  gsap.fromTo(textEl,
    { opacity: 1, filter: "blur(0px)" },
    {
      opacity: 0,
      filter: "blur(6px)",
      immediateRender: false,
      scrollTrigger: {
        trigger: parentZone,
        start: "top top-=800px", // Starts fading EXACTLY when the pin unlocks
        end: "top top-=1300px",
        scrub: true,
      }
    }
  );
});

gsap.utils.toArray(".zone-divider").forEach((dividerEl) => {
  const parentZone = dividerEl.closest(".zone");
  gsap.fromTo(dividerEl,
    {
      x: "-100%",
    },
    {
      duration: 2,
      x: "0%",
      scrollTrigger: {
        trigger: parentZone,
        start: "top bottom - 50px",
        end: "top top+=400px",
        scrub: true,
      }
    }

  )
});

// ---- HERO ANIMATIONS ----

const heroSubtitle = document.querySelector('.hero-subtitle');
const heroTitle = document.querySelector('.hero-title');

// Hide initially to prevent flash before animation
gsap.set([heroSubtitle, heroTitle], { opacity: 0, y: 50 });

const heroTl = gsap.timeline();

// Entrance animation
heroTl.fromTo(heroSubtitle, 
  { opacity: 0, y: 30 },
  { opacity: 1, y: 0, duration: 2, ease: "power2.out", delay: 0.2 }
)
.fromTo(heroTitle,
  { opacity: 0, y: 60, scale: 0.95 },
  { opacity: 1, y: 0, scale: 1, duration: 2.5, ease: "power3.out" },
  "-=1.5"
)
// Idle float kicks in perfectly synced, slightly overlapping the entrance so it doesn't feel late
.to([heroSubtitle, heroTitle], {
  y: 25,
  duration: 4,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut"
}, "-=0.5");

// Hero exit animation on scroll — fades and drifts up but doesn't fully disappear
const heroScrollWrapper = document.querySelector('.hero-text-scroll-wrapper');
gsap.to(heroScrollWrapper, {
  yPercent: -150,
  opacity: 0.2,
  scrollTrigger: {
    trigger: ".hero-container",
    start: "top top",
    end: "bottom top",
    scrub: true
  }
});

// ---- BACK TO TOP ----
// Footer button that auto-scrolls back to the surface. Rather than the default
// quick ease-in-out (which reads as a "snap to top"), this glides at a steady,
// constant speed — like the page scrolling itself back up. Linear easing keeps
// it from slowing at the ends.
// Speed is measured in viewport-heights ("screenfuls") per second, NOT pixels
// per second, so the visual pace is identical on every screen size — a fixed
// px/sec would make the same content fly past faster on a shorter viewport.
const BACK_TO_TOP_SCREENS_PER_SEC = 10;   // lower = slower
document.querySelector(".back-to-top").addEventListener("click", () => {
  const screenfuls = window.scrollY / window.innerHeight;
  const duration = screenfuls / BACK_TO_TOP_SCREENS_PER_SEC;
  lenis.scrollTo(0, { duration, easing: (t) => t });
});

// ---- AUTO SCROLL ----
// Toggleable "tour" button: glides down the whole page at a deliberately slow,
// constant pace so creatures have time to register as they pass, instead of
// blurring by. Same screenfuls-per-second + linear-easing approach as
// back-to-top, just much slower. Any manual scroll input (wheel/touch/keys)
// cancels it, same as most auto-scroll tools — fighting the user's own
// scrolling would feel broken.
const AUTO_SCROLL_SCREENS_PER_SEC = 0.7;        // normal cruising pace (lower = slower)
// Sunlight (0-200m) + the first few hundred meters of Twilight (200m+) start
// at a fraction of cruising speed and ramp *linearly in actual speed* (not
// starting from a dead stop) up to full cruising speed by the end of this
// zone — so the instantaneous speed matches the constant cruise that follows
// right at the handoff, instead of a visible jump.
const AUTO_SCROLL_SLOW_ZONE_DEPTH_METERS = 500;
const AUTO_SCROLL_SLOW_START_FACTOR = 0.5;      // starting speed, as a fraction of cruising speed
const autoScrollBtn = document.querySelector(".auto-scroll-btn");
let autoScrollActive = false;

function stopAutoScroll() {
  if (!autoScrollActive) return;
  autoScrollActive = false;
  autoScrollBtn.setAttribute("aria-pressed", "false");
  autoScrollBtn.setAttribute("aria-label", "Start auto-scroll");
  // Retarget to the current position, immediately — this interrupts whatever
  // scrollTo tween is in flight rather than letting it keep gliding.
  lenis.scrollTo(window.scrollY, { immediate: true });
}

// Runs one leg of the tour and calls onDone when it finishes. Bails out
// silently if the tour was cancelled while this leg was running (stopAutoScroll
// already snapped the scroll position back, so starting another leg here
// would fight that and resume scrolling on its own).
function runAutoScrollLeg(fromY, toY, screensPerSec, easing, onDone) {
  const screenfuls = (toY - fromY) / window.innerHeight;
  lenis.scrollTo(toY, {
    duration: screenfuls / screensPerSec,
    easing,
    onComplete: () => { if (autoScrollActive) onDone(); },
  });
}

function startAutoScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const startY = window.scrollY;
  if (maxScroll - startY <= 0) return;

  autoScrollActive = true;
  autoScrollBtn.setAttribute("aria-pressed", "true");
  autoScrollBtn.setAttribute("aria-label", "Stop auto-scroll");

  const zonesTopDoc = zonesContainer.getBoundingClientRect().top + window.scrollY;
  const slowZoneEndY = Math.min(
    zonesTopDoc + AUTO_SCROLL_SLOW_ZONE_DEPTH_METERS * px_per_metter,
    maxScroll
  );

  const cruise = () => runAutoScrollLeg(
    Math.max(startY, slowZoneEndY), maxScroll, AUTO_SCROLL_SCREENS_PER_SEC, (t) => t,
    stopAutoScroll
  );

  if (startY >= slowZoneEndY) {
    cruise();   // already past the slow zone — just the normal constant glide
  } else {
    // Speed ramps linearly from s×cruise (at t=0) to 1×cruise (at t=1) — s is
    // AUTO_SCROLL_SLOW_START_FACTOR. Average speed over that ramp is (s+1)/2
    // ×cruise, which sets the leg's duration; the easing curve below is the
    // position function whose derivative *is* that linear speed ramp (i.e.
    // integrating v(t) = s + (1-s)t and normalizing), so both the average
    // pace and the instantaneous end-speed come out exactly right.
    const s = AUTO_SCROLL_SLOW_START_FACTOR;
    const slowZoneAvgScreensPerSec = (s + 1) / 2 * AUTO_SCROLL_SCREENS_PER_SEC;
    const slowZoneEasing = (t) => (2 * s * t + (1 - s) * t * t) / (s + 1);
    runAutoScrollLeg(startY, slowZoneEndY, slowZoneAvgScreensPerSec, slowZoneEasing, cruise);
  }
}

autoScrollBtn.addEventListener("click", () => {
  if (autoScrollActive) stopAutoScroll();
  else startAutoScroll();
});

// Ignore interactions with the button itself here — otherwise pressing it via
// touch/keyboard fires its own wheel/touchstart/keydown first, which would
// cancel the very toggle the click handler above is about to perform.
["wheel", "touchstart", "keydown"].forEach((type) => {
  window.addEventListener(type, (e) => {
    if (e.target.closest(".auto-scroll-btn")) return;
    stopAutoScroll();
  }, { passive: true });
});

// ---- RESPONSIVE WAVES ----
// The wave paths were fixed at a 1440x180 coordinate system, stretched
// (preserveAspectRatio="none") to fill the full viewport width. That makes
// the same wavelength get squeezed into much less horizontal space on narrow
// screens while the vertical amplitude stays the same — looks fine on wide
// screens, choppy/steep on mobile. Fix: regenerate each wave's viewBox +
// path from real pixel dimensions on load/resize, with the *number* of humps
// scaling to the actual width (fewer, correctly-proportioned humps on a
// phone) instead of squishing a fixed number of them into less space.
const WAVE_PERIOD_PX = 700; // ~1 hump on phones, ~2 on desktop, more on ultrawide

const waveConfigs = [
  { selector: ".wave-back",  baseYFraction: 90 / 180,  heightFraction: 40 / 180 },
  { selector: ".wave-mid",   baseYFraction: 100 / 180, heightFraction: 30 / 180 },
  { selector: ".wave-front", baseYFraction: 110 / 180, heightFraction: 25 / 180 },
];

function buildWavePath(width, height, baseY, waveHeight) {
  const periods = Math.max(1, Math.round(width / WAVE_PERIOD_PX));
  const period = width / periods;
  let d = `M0,${baseY}`;
  for (let i = 0; i < periods; i++) {
    const x0 = i * period;
    d += ` Q${x0 + period * 0.25},${baseY - waveHeight} ${x0 + period * 0.5},${baseY}`;
    d += ` Q${x0 + period * 0.75},${baseY + waveHeight} ${x0 + period},${baseY}`;
  }
  d += ` L${width},${height} L0,${height} Z`;
  return d;
}

function updateWavePaths() {
  const wavesEl = document.querySelector(".hero-waves");
  if (!wavesEl) return;
  // .wave elements are width:110% of .hero-waves and height:calc(100% + 20px)
  // (the overhang buffer from the wave-seam fix) — match those exactly so the
  // viewBox = real rendered size 1:1, with zero stretch/distortion.
  const width = wavesEl.clientWidth * 1.1;
  const height = wavesEl.clientHeight + 20;

  waveConfigs.forEach(({ selector, baseYFraction, heightFraction }) => {
    const svg = document.querySelector(selector);
    const path = svg && svg.querySelector("path");
    if (!svg || !path) return;
    const baseY = height * baseYFraction;
    const waveHeight = height * heightFraction;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    path.setAttribute("d", buildWavePath(width, height, baseY, waveHeight));
  });
}

// The buoy's `bottom` was a fixed 100px, which only happened to line up with
// the wave-front's crest at the screen width the wave was originally designed
// at — since the wave's shape now varies with screen width (see above), a
// fixed offset can't stay correct everywhere (e.g. it ends up floating well
// above the water on narrow phones). Instead, find the wave-front path's
// actual Y position directly under the buoy and anchor to that, so it always
// sits right at (very slightly behind) the water surface regardless of
// screen size.
const BUOY_SUBMERSION_PX = 17; // how far the buoy's bottom sits behind/below the wave-front crest

function updateBuoyPosition() {
  const buoy = document.querySelector(".buoy");
  const wavesEl = document.querySelector(".hero-waves");
  const waveFrontSvg = document.querySelector(".wave-front");
  const path = waveFrontSvg && waveFrontSvg.querySelector("path");
  if (!buoy || !wavesEl || !path) return;

  const wavesRect = wavesEl.getBoundingClientRect();
  const buoyRect = buoy.getBoundingClientRect(); // only its x-center is used below
  const buoyCenterX = buoyRect.left + buoyRect.width / 2;

  const svgRect = waveFrontSvg.getBoundingClientRect();
  const viewBox = waveFrontSvg.viewBox.baseVal;
  const buoyXInSvg = (buoyCenterX - svgRect.left) / svgRect.width * viewBox.width;

  const pathLength = path.getTotalLength();
  let lo = 0, hi = pathLength, y = 0;
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    const pt = path.getPointAtLength(mid);
    if (pt.x < buoyXInSvg) lo = mid; else hi = mid;
    y = pt.y;
  }

  const waveSurfaceYOnScreen = svgRect.top + (y / viewBox.height) * svgRect.height;
  const bottomPx = wavesRect.bottom - waveSurfaceYOnScreen - BUOY_SUBMERSION_PX;
  buoy.style.bottom = `${Math.round(bottomPx)}px`;
}

function updateHeroWaterline() {
  updateWavePaths();
  updateBuoyPosition();
}

updateHeroWaterline();
window.addEventListener("resize", updateHeroWaterline);

// ---- PARTICLES ----

const canvas = document.getElementById('particle-canvas');
const BUFFER = 300;   // spawn zone around viewport
const KILL = BUFFER + 50;  // particles die past the buffer

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const particleSystem = new ParticleSystem(canvas, totalHeight, BUFFER, KILL);

function start() {
  const loop = () => { particleSystem.updateAndRender(); requestAnimationFrame(loop); };
  loop();
}

start();
