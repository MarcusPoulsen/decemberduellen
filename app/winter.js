// Keep the scenery mounted between questions so the snow can keep accumulating.
export function createWinter() {
  const scenery = document.createElement('div');
  scenery.className = 'winter-scene';
  scenery.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const frame = document.createElement('canvas');
  const trim = frame.getContext('2d');
  scenery.append(canvas, frame);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const piles = Array(32).fill(0);
  const flakes = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let previous = 0;

  function drawFrame() {
    let seed = 71;
    const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
    const depth = Math.min(46, width * .043, height * .067);
    function sprig(x, y, angle, size) {
      trim.save();
      trim.translate(x, y);
      trim.rotate(angle);
      trim.strokeStyle = '#705e43';
      trim.lineWidth = .85;
      trim.beginPath();
      trim.moveTo(0, 0);
      trim.lineTo(size, 0);
      trim.stroke();
      for (let i = 0; i < 56; i++) {
        const along = (Math.floor(i / 2) + random() * .7) / 28 * size;
        const length = (1 - along / size * .82) * size * (.25 + random() * .25);
        const side = i % 2 ? 1 : -1;
        const tipX = along + length * .84;
        const tipY = side * length;
        const needle = trim.createLinearGradient(along, 0, tipX, tipY);
        needle.addColorStop(0, '#142e23');
        needle.addColorStop(.52, ['#2b6247', '#3b7253', '#24563f', '#48805d'][i % 4]);
        needle.addColorStop(1, '#75987675');
        trim.fillStyle = needle;
        trim.beginPath();
        trim.moveTo(along - .5, 0);
        trim.quadraticCurveTo(along + length * .25, tipY * .58, tipX, tipY);
        trim.quadraticCurveTo(along + length * .37, tipY * .49, along + .55, 0);
        trim.fill();
      }
      trim.restore();
    }
    function garland(length, x, y, angle) {
      trim.save();
      trim.translate(x, y);
      trim.rotate(angle);
      trim.fillStyle = '#09231c';
      trim.fillRect(0, -depth * .28, length, depth * .51);
      for (let n = -depth; n < length; n += depth * .27) {
        sprig(n, depth * .04, .15 + random() * .8, depth * (1 + random() * .45));
        sprig(n + depth, -depth * .13, 2.5 + random() * .85, depth * (1 + random() * .35));
      }
      trim.restore();
    }
    function ornament(x, y, radius, heart, blue) {
      trim.save();
      trim.translate(x, y);
      trim.strokeStyle = '#acb7be';
      trim.lineWidth = 1;
      trim.beginPath();
      trim.moveTo(0, -radius * 1.95);
      trim.lineTo(0, -radius * .75);
      if (!heart) trim.stroke();
      if (heart) {
        trim.scale(radius / 12, radius / 12);
        const red = trim.createLinearGradient(0, -16, 0, 20);
        red.addColorStop(0, '#e03543');
        red.addColorStop(1, '#971527');
        const paper = trim.createLinearGradient(0, -10, 0, 20);
        paper.addColorStop(0, '#fffdf9');
        paper.addColorStop(1, '#d6dce0');
        trim.fillStyle = red;
        trim.fillRect(-1.5, -23, 3, 14);
        trim.beginPath();
        trim.moveTo(0, 20);
        trim.lineTo(-13, 7);
        trim.bezierCurveTo(-25, -5, -12, -20, 0, -10);
        trim.bezierCurveTo(12, -20, 25, -5, 13, 7);
        trim.closePath();
        trim.save();
        trim.clip();
        trim.fillStyle = paper;
        trim.fillRect(-20, -16, 40, 38);
        trim.fillStyle = red;
        trim.beginPath();
        trim.moveTo(-22, -18);
        trim.lineTo(7, -18);
        trim.lineTo(-5, -6);
        trim.lineTo(0, -1);
        trim.lineTo(-15, 14);
        trim.lineTo(-22, 14);
        trim.fill();
        for (const [dx, dy, white] of [[-10, 9, true], [-5, 14, false], [0, 9, true], [5, 4, false], [5, 14, false]]) {
          trim.fillStyle = white ? paper : red;
          trim.beginPath();
          trim.moveTo(dx, dy - 5);
          trim.lineTo(dx + 5, dy);
          trim.lineTo(dx, dy + 5);
          trim.lineTo(dx - 5, dy);
          trim.fill();
        }
        trim.restore();
      } else {
        const sheen = trim.createRadialGradient(-radius * .35, -radius * .42, 0, 0, 0, radius);
        sheen.addColorStop(0, '#f6f6fc');
        sheen.addColorStop(.21, blue ? '#809ccb' : '#f77a86');
        sheen.addColorStop(.58, blue ? '#213b69' : '#ab193a');
        sheen.addColorStop(1, blue ? '#0a142d' : '#450d24');
        trim.fillStyle = sheen;
        trim.beginPath();
        trim.arc(0, 0, radius, 0, Math.PI * 2);
        trim.fill();
        trim.fillStyle = '#aeb8bf';
        trim.fillRect(-radius * .24, -radius * 1.13, radius * .48, radius * .27);
      }
      trim.restore();
    }

    garland(width, 0, depth * .08, 0);
    garland(height, depth * .03, height, -Math.PI / 2);
    garland(height, width - depth * .03, 0, Math.PI / 2);
    garland(width, width, height - depth * .05, Math.PI);
    for (let i = 0; i < 9; i++) {
      ornament(width * (.08 + i * .105), depth * (.48 + random() * .26), depth * (.23 + random() * .11), i % 3 === 1, i % 3 === 2);
    }
    for (let i = 0; i < 4; i++) {
      ornament(depth * .38, height * (.23 + i * .18), depth * .26, i % 2 === 0, i === 3);
      ornament(width - depth * .38, height * (.23 + i * .18), depth * .26, i % 2 === 1, i === 0);
    }
  }

  function resize() {
    const bounds = scenery.getBoundingClientRect();
    const density = devicePixelRatio || 1;
    if (!bounds.width || !bounds.height ||
        (bounds.width === width && bounds.height === height && density === pixelRatio)) return;
    width = bounds.width;
    height = bounds.height;
    pixelRatio = density;
    const snowDensity = Math.min(density, 1.5);
    canvas.width = Math.round(width * snowDensity);
    canvas.height = Math.round(height * snowDensity);
    frame.width = Math.round(width * density);
    frame.height = Math.round(height * density);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    trim.setTransform(frame.width / width, 0, 0, frame.height / height, 0, 0);
    drawFrame();
  }

  function drawSnow(dt) {
    const limit = Math.min(height * .095, 84);
    const drift = i => (Math.sin(i * .53) + 1) * .24 + .42;
    const surface = i => height - limit * drift(i) * (.2 + .8 * piles[i]);
    const step = width / (piles.length - 1);
    ctx.beginPath();
    ctx.moveTo(0, surface(0));
    for (let i = 1; i < piles.length; i++) {
      ctx.quadraticCurveTo((i - 1) * step, surface(i - 1), (i - .5) * step, (surface(i - 1) + surface(i)) / 2);
    }
    ctx.lineTo(width, surface(piles.length - 1));
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, height - limit, 0, height);
    gradient.addColorStop(0, '#f1f7ed');
    gradient.addColorStop(1, '#789caa');
    ctx.fillStyle = gradient;
    ctx.fill();

    while (flakes.length < 37) flakes.push({
      x: Math.random(), y: Math.random(), size: 5 + Math.random() * 10,
      speed: .035 + Math.random() * .10, sway: Math.random() * 6.28
    });
    for (const flake of flakes) {
      flake.y += flake.speed * dt;
      flake.sway += dt;
      const x = flake.x * width + Math.sin(flake.sway) * 15;
      const y = flake.y * height;
      const bin = Math.max(0, Math.min(piles.length - 1, Math.round(x / step)));
      if (y >= surface(bin) && dt) {
        for (let offset = -2; offset <= 2; offset++) {
          const index = bin + offset;
          if (index >= 0 && index < piles.length) piles[index] = Math.min(1, piles[index] + .06 / (1 + Math.abs(offset)));
        }
        flake.y = -.03;
        flake.x = Math.random();
        continue;
      }
      ctx.strokeStyle = flake.size > 10 ? '#e5f7ef75' : '#e5f7ef49';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (let arm = 0; arm < 6; arm++) {
        const angle = flake.sway * .2 + arm * Math.PI / 3;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx * flake.size, y + dy * flake.size);
        for (const direction of [-1, 1]) {
          ctx.moveTo(x + dx * flake.size * .65, y + dy * flake.size * .65);
          ctx.lineTo(x + (dx * .44 - dy * direction * .22) * flake.size, y + (dy * .44 + dx * direction * .22) * flake.size);
        }
      }
      ctx.stroke();
    }
  }

  function render(time) {
    resize();
    const elapsed = previous ? Math.min(.05, (time - previous) / 1000) : 0;
    previous = time;
    if (width && height) {
      ctx.clearRect(0, 0, width, height);
      drawSnow(motion.matches ? 0 : elapsed);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  return scenery;
}
