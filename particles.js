// ---- BIOLUMINESCENT PARTICLE SYSTEM ----

export class Particle {
  constructor({ x, y, radius, depth, opacity, vx, vy, hue, saturation, startAge = 0 }) {
    this.x = x;
    this.y = y;
    this.baseRadius = radius;
    this.depth = depth;
    this.opacity = opacity;
    this.vx = vx;
    this.vy = vy;
    this.hue = hue;
    this.saturation = saturation;
    this.age = startAge;

    // For pulsing effect
    this.phase = Math.random() * Math.PI * 2;
    this.pulseSpeed = 0.008 + Math.random() * 0.02;

    // For aging and lifecycle management
    this.maxAge = 400 + Math.random() * 400; // lifespan in frames
  }

  static createRandom(x, y, startAge = 0) {
    return new Particle({
      x: x,
      y: y,
      radius: 0.4 + Math.random() * 1.2,
      depth: 0.5 + Math.random() * 1.0,
      opacity: 0.3 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      hue: 160 + Math.random() * 20,
      saturation: 70 + Math.random() * 25,
      startAge: startAge,
    });
  }

  update(scrollDelta = 0) {
    this.x += this.vx;
    this.y += this.vy - scrollDelta * this.depth;
    this.vx += (Math.random() - 0.5) * 0.015;
    this.vy += (Math.random() - 0.5) * 0.015;
    this.vx *= 0.998;
    this.vy *= 0.998;
    this.phase += this.pulseSpeed;
    this.age++;
  }

  shouldDie(minX, minY, maxX, maxY) {
    return (
      this.x < minX || this.x > maxX ||
      this.y < minY || this.y > maxY ||
      this.age >= this.maxAge
    );
  }

  getAlpha() {
    const pulse = 0.6 + 0.4 * Math.sin(this.phase);
    const fadeIn = Math.min(this.age / 60, 1);
    const remaining = this.maxAge - this.age;
    const fadeOut = Math.min(remaining / 90, 1);
    return this.opacity * fadeIn * fadeOut * pulse;

  }

  getGlowSize() {
    return this.baseRadius * (0.8 + 0.4 * Math.sin(this.phase)) * 3;
  }

  render(ctx) {
    const alpha = this.getAlpha();
    const glowSize = this.getGlowSize();

    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
    grad.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 72%, ${alpha})`);
    grad.addColorStop(0.3, `hsla(${this.hue}, ${this.saturation - 10}%, 55%, ${alpha * 0.4})`);
    grad.addColorStop(1, `hsla(${this.hue}, ${this.saturation - 20}%, 40%, 0)`);

    ctx.beginPath();
    ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

}

export class ParticleSystem {
  // BUFFER: spawn zone around viewport
  // KILL: particles die past the buffer
  constructor(canvas, totalHeight, BUFFER = 300, KILL = BUFFER + 50) {
    this.particles = [];
    this.lastScrollY = window.scrollY;
    this.BUFFER = BUFFER;
    this.KILL = KILL;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.totalHeight = totalHeight;
  }

  getCurrentDepth() {
    const vh = window.innerHeight;
    const container = document.querySelector('.zones-container');
    const containerHeight = container.scrollHeight;
    const scrollRange = containerHeight - vh;
    if (scrollRange <= 0) return 0;

    const distFromTop = window.scrollY + vh * 0.5;
    return Math.max(0, distFromTop * this.totalHeight / containerHeight);
  }

  getTargetCount() {
    const depth = this.getCurrentDepth();

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

  spawnParticle(startAge = 0) {
    this.particles.push(Particle.createRandom(
      -this.BUFFER + Math.random() * (this.canvas.width + this.BUFFER * 2),
      -this.BUFFER + Math.random() * (this.canvas.height + this.BUFFER * 2),
      startAge
    ));
  }
  
  updateAndRender() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'lighter';

    // scroll delta — particles move opposite to scroll direction
    const currentScrollY = window.scrollY;
    const scrollDelta = currentScrollY - this.lastScrollY;
    this.lastScrollY = currentScrollY;

    // spawn the full deficit immediately — particles start pre-aged so they're already visible
    const target = this.getTargetCount();
    const deficit = target - this.particles.length;
    for (let i = 0; i < deficit; i++) {
      this.spawnParticle(60 + Math.random() * 140); // age 60–200: already past fade-in
    }

    // update, draw, and cull
    this.particles = this.particles.filter((p) => {
      p.update(scrollDelta);
      if (p.shouldDie(-this.KILL, -this.KILL, this.canvas.width + this.KILL, this.canvas.height + this.KILL)) {
        return false;
      }
      
      p.render(this.ctx);
      return true;
    });

    this.ctx.globalCompositeOperation = 'source-over';
  }
}