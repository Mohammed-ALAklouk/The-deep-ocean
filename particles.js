// ---- BIOLUMINESCENT PARTICLE SYSTEM ----
// Depends on `totalHeight`, defined in script.js (loaded before this file).

const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let particles = [];
let lastScrollY = window.scrollY;

function getCurrentDepth() {
  const vh = window.innerHeight;
  const container = document.querySelector('.zones-container');
  const containerHeight = container.scrollHeight;
  const scrollRange = containerHeight - vh;
  if (scrollRange <= 0) return 0;

  const distFromTop = window.scrollY + vh * 0.5;
  return Math.max(0, distFromTop * totalHeight / containerHeight);
}

function getTargetCount() {
  const depth = getCurrentDepth();

  if (depth < 200 || depth > 8000) return 0;

  // ramp up from 200m to 500m
  const rampUp = Math.min((depth - 200) / 300, 1);

  // Start fading out smoothly from 5000m all the way down to 8000m
  let fadeOut = 1;
  if (depth > 5000) {
      // Use an exponential curve so it tapers off very gently rather than hitting a wall
      const progress = Math.max((8000 - depth) / 3000, 0);
      fadeOut = Math.pow(progress, 1.5);
  }

  // Increased max particles from 200 to 300 so it's impossible to miss
  return Math.round(300 * rampUp * fadeOut);
}

function spawnParticle(startAge = 0) {
  particles.push({
    x: -BUFFER + Math.random() * (canvas.width + BUFFER * 2),
    y: -BUFFER + Math.random() * (canvas.height + BUFFER * 2),
    baseRadius: 0.4 + Math.random() * 1.2,
    depth: 0.5 + Math.random() * 1.0,
    opacity: 0.3 + Math.random() * 0.5,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    hue: 160 + Math.random() * 20,
    saturation: 70 + Math.random() * 25,
    phase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.008 + Math.random() * 0.02,
    age: startAge,
    maxAge: 400 + Math.random() * 400,
  });
}

const BUFFER = 300;   // spawn zone around viewport
const KILL = BUFFER + 50;  // particles die past the buffer

function renderParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'lighter';

  // scroll delta — particles move opposite to scroll direction
  const currentScrollY = window.scrollY;
  const scrollDelta = currentScrollY - lastScrollY;
  lastScrollY = currentScrollY;

  // spawn the full deficit immediately — particles start pre-aged so they're already visible
  const target = getTargetCount();
  const deficit = target - particles.length;
  for (let i = 0; i < deficit; i++) {
    spawnParticle(60 + Math.random() * 140); // age 60–200: already past fade-in
  }

  // update, draw, and cull
  particles = particles.filter((p) => {
    // scroll pushes particles — depth controls parallax speed
    p.y -= scrollDelta * p.depth;

    // ambient drift
    p.x += p.vx;
    p.y += p.vy;
    p.vx += (Math.random() - 0.5) * 0.015;
    p.vy += (Math.random() - 0.5) * 0.015;
    p.vx *= 0.998;
    p.vy *= 0.998;
    p.age++;

    // die if outside viewport + buffer, or too old
    if (p.x < -KILL || p.x > canvas.width + KILL ||
        p.y < -KILL || p.y > canvas.height + KILL) {
      return false;
    }
    if (p.age >= p.maxAge) return false;

    // pulse
    p.phase += p.pulseSpeed;
    const pulse = 0.6 + 0.4 * Math.sin(p.phase);

    // fade in (first 60 frames) and fade out (last 90 frames)
    const fadeIn = Math.min(p.age / 60, 1);
    const remaining = p.maxAge - p.age;
    const fadeOut = Math.min(remaining / 90, 1);

    const r = p.baseRadius * (0.8 + 0.4 * Math.sin(p.phase));
    const alpha = p.opacity * pulse * fadeIn * fadeOut;
    const glowSize = r * 3;

    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
    grad.addColorStop(0, `hsla(${p.hue}, ${p.saturation}%, 72%, ${alpha})`);
    grad.addColorStop(0.3, `hsla(${p.hue}, ${p.saturation - 10}%, 55%, ${alpha * 0.4})`);
    grad.addColorStop(1, `hsla(${p.hue}, ${p.saturation - 20}%, 40%, 0)`);

    ctx.beginPath();
    ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    return true;
  });

  ctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(renderParticles);
}

requestAnimationFrame(renderParticles);
