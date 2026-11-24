(() => {
  const display = document.getElementById('display');
  const mount = document.getElementById('visuals');
  const motion = window.TV_CONFIG.motion;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  async function start() {
    // Keep the HTML and CSS graphics on browsers older than the Pixi bundle.
    if (motion !== 'auto' || reducedMotion.matches ||
        !window.ResizeObserver || !window.WebGL2RenderingContext ||
        !Array.prototype.at || !window.structuredClone) return;

    const script = document.createElement('script');
    script.src = 'assets/pixi-8.22.0.min.js';
    script.addEventListener('load', initialise, { once: true });
    document.head.appendChild(script);
  }

  async function initialise() {
    const pixi = window.PIXI;
    if (!pixi) return;
    const app = new pixi.Application();
    let canvas;
    let request;
    let started = performance.now();
    let lastRender = 0;
    let geometry;

    const colours = { cyan: 0x70d9dc, sage: 0x85dda5, amber: 0xeac17b, coral: 0xe18478 };
    const measure = () => {
      const bounds = display.getBoundingClientRect();
      const scale = bounds.width / 1920;
      const box = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: (rect.left - bounds.left) / scale,
          y: (rect.top - bounds.top) / scale,
          width: rect.width / scale,
          height: rect.height / scale
        };
      };
      const emblem = box(document.getElementById('rating-emblem'));
      geometry = {
        emblem: { x: emblem.x + emblem.width / 2, y: emblem.y + emblem.height / 2 },
        bars: Array.from(display.querySelectorAll('.bar-fill, .benchmark .fill'), (fill) => {
          const track = box(fill.parentElement);
          const panel = fill.closest('article');
          return {
            x: track.x + 1, y: track.y + 1, height: track.height - 2,
            width: (track.width - 2) * parseFloat(fill.style.width) / 100,
            colour: fill.classList.contains('sage') || panel.id === 'resources-panel' &&
              fill.closest('.benchmark').classList.contains('sage') ? colours.sage : colours.cyan,
            panel: panel.id
          };
        }),
        brent: Array.from(display.querySelectorAll('.brent-axis > div'), (marker) => ({
          ...box(marker),
          type: marker.className
        }))
      };
    };

    const stop = () => {
      cancelAnimationFrame(request);
      document.removeEventListener('dashboard:fit', measure);
      document.removeEventListener('dashboard:scene', changeScene);
      document.removeEventListener('visibilitychange', visibilityChanged);
      display.classList.remove('pixi-active');
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', stop);
        mount.removeChild(canvas);
      }
      if (app.renderer) app.destroy(false, { children: true, context: true });
    };

    const changeScene = () => {
      started = performance.now();
      measure();
    };

    const visibilityChanged = () => {
      cancelAnimationFrame(request);
      if (!document.hidden) request = requestAnimationFrame(render);
    };

    let graphics;
    const render = (now) => {
      if (document.hidden) return;
      const elapsed = (now - started) / 1000;
      const transitioning = elapsed < .85;
      if (now - lastRender >= (transitioning ? 15 : 32)) {
        try {
          const reveal = 1 - Math.pow(1 - Math.min(1, elapsed / .85), 3);
          const scene = window.DisplayState.get().scene;
          const { x, y } = geometry.emblem;
          graphics.clear();
          for (const [radius, width, alpha] of [[158, 2, .68], [142, 1, .42], [124, 1, .26]]) {
            graphics.circle(x, y, radius).stroke({ color: colours.cyan, width, alpha });
          }
          for (let i = 0; i < 48; i += 1) {
            const angle = i * Math.PI / 24;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            graphics.moveTo(x + dx * 149, y + dy * 149).lineTo(x + dx * 153, y + dy * 153);
          }
          graphics.stroke({ color: colours.cyan, width: 1, alpha: .25 });
          const orbit = now / 3200;
          graphics.circle(x + Math.cos(orbit) * 142, y + Math.sin(orbit) * 142, 3)
            .fill({ color: colours.cyan, alpha: .72 });
          for (const bar of geometry.bars) {
            const active = scene && scene.focus.includes(bar.panel);
            const width = bar.width * (active ? .78 + .22 * reveal : 1);
            graphics.roundRect(bar.x, bar.y, width, bar.height, bar.height / 2).fill(bar.colour);
          }
          if (scene) {
            const active = geometry.brent.find((marker) => marker.type === scene.brent);
            if (active) {
              const colour = { actual: colours.cyan, forecast: colours.amber, stress: colours.coral }[active.type];
              graphics.roundRect(active.x - 2, active.y - 2, active.width + 4, active.height + 4, 4)
                .stroke({ color: colour, alpha: .4 * reveal, width: 1 });
            }
          }
          app.render();
          lastRender = now;
        } catch (_) {
          stop();
          return;
        }
      }
      request = requestAnimationFrame(render);
    };

    try {
      await app.init({
        width: 1920, height: 1080, autoStart: false, antialias: true,
        resolution: innerWidth < 1600 ? .75 : 1, backgroundAlpha: 0, preference: ['webgl']
      });
      canvas = app.canvas;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.addEventListener('webglcontextlost', stop, { once: true });
      mount.appendChild(canvas);
      graphics = new pixi.Graphics();
      app.stage.addChild(graphics);
      measure();
      document.addEventListener('dashboard:fit', measure);
      document.addEventListener('dashboard:scene', changeScene);
      document.addEventListener('visibilitychange', visibilityChanged);
      if (document.fonts) document.fonts.ready.then(() => { if (app.renderer) measure(); });
      display.classList.add('pixi-active');
      visibilityChanged();
    } catch (_) {
      stop();
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
