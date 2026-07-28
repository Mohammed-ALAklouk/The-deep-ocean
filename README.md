# The Deep Ocean

An interactive scroll down through the ocean, from the sunlit surface to the bottom of the Challenger Deep at 10,924 m. 128 real sea creatures are placed at their true depths along the way.

A recreation of [The Deep Sea](https://neal.fun/deep-sea/) by Neal Agarwal ([neal.fun](https://neal.fun/)) — go check out the original.

**Live:** https://mohammed-alaklouk.github.io/The-deep-ocean/

## Features

- **Live depth meter** that tracks how far down you are, computed from real page geometry so it lands exactly on 10,924 m at the bottom.
- **Five ocean zones** — Sunlight, Twilight, Midnight, Abyssal, Hadal — each sized to its real depth range, with titles that fade in, hold on screen, then drift away.
- **128 creatures** loaded from `creatures.json` and positioned on a CSS grid at their actual depths, fading and blurring in and out as they pass.
- **Zone navigation dots** down the right edge that highlight the current zone and smooth-scroll to any other.
- **Auto-scroll tour** — a play button that glides down the whole page at a slow, constant pace (with a gentle ramp-up through the first 500 m). Any manual scroll cancels it.
- **Bioluminescent particles** on a canvas layer, appearing around 200 m, peaking in the deep, and fading out by 8,000 m.
- **Responsive hero waves** — the wave SVG paths are regenerated from real pixel dimensions on load and resize, so the wavelength stays natural on any screen width, and the buoy is anchored to the wave surface it's actually floating on.
- **Reduced-motion support** — respects `prefers-reduced-motion`: smooth scrolling, particles, and the drift/slide animations all switch off.

## Running it

It's a static site with no build step. Any static server works:

```bash
npx --yes serve -l 5173 .
```

Then open http://localhost:5173.

Opening `index.html` directly from the filesystem won't work — `creatures.js` fetches `creatures.json`, and `file://` requests are blocked by CORS.

## Project structure

| File | What it does |
| --- | --- |
| `index.html` | Page skeleton: hero, five zone sections, depth meter, nav dots, footer. |
| `style.css` | All styling — gradients, glass cards, waves, clouds, buoy, creature grid. |
| `script.js` | Main module: Lenis + GSAP setup, zone sizing, depth counter, zone nav, hero and zone animations, auto-scroll, responsive waves. |
| `particles.js` | `Particle` and `ParticleSystem` classes for the bioluminescence canvas. |
| `creatures.js` | Loads `creatures.json`, builds the creature grid, wires up their scroll animations. |
| `creatures.json` | 128 creatures: name, slug, depth in metres, and grid placement. |
| `creatures/images/` | One PNG per creature, named by slug. |

## How the depth layout works

Everything is pinned to one ratio, borrowed from the original: the page is a CSS grid of 50 px rows, each row covering 3 m of depth (`px_per_metter = 50 / 3` in `script.js`). Zone heights come from that same conversion, and each creature's row is just `depth / 3`.

Creature column positions in `creatures.json` are the original hand-placed coordinates rather than something computed at runtime — that's what keeps 128 creatures from overlapping each other.

## Built with

- [GSAP](https://gsap.com/) + ScrollTrigger — scroll-driven animation
- [Lenis](https://lenis.darkroom.engineering/) — smooth scrolling
- Plain HTML, CSS, and JavaScript otherwise — no framework, no bundler

Libraries are loaded from a CDN, so an internet connection is needed even when running locally.

## Credits

Concept, creature data, and layout are from Neal Agarwal's [The Deep Sea](https://neal.fun/deep-sea/). This is a personal recreation built to learn scroll animation.
