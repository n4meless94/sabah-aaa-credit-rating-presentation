(() => {
  const display = document.getElementById('display');
  const mount = document.getElementById('visuals');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = { cyan: 0x70d9dc, sage: 0x85dda5, amber: 0xeac17b, coral: 0xe18478 };

  function load() {
    // Older Samsung browsers can use the CSS graphics without parsing the PixiJS bundle.
    if (window.TV_CONFIG.motion !== 'auto' || preference.matches || !window.ResizeObserver ||
        !window.WebGL2RenderingContext || !Array.prototype.at || !window.structuredClone) return;
    const script = document.createElement('script');
    script.src = 'assets/pixi-8.22.0.min.js';
    script.addEventListener('load', start, { once: true });
    document.head.appendChild(script);
  }

  async function start() {
    if (!window.PIXI || preference.matches) return;

    let app;
    let canvas;
    let frameId;
    let lastFrame = 0;
    let transitionStart = performance.now();
    let scene = window.DisplayState.get().scene;
    let prayerProgress = 0;
    let disposed = false;
    const onScene = (event) => {
      scene = event.detail;
      transitionStart = performance.now();
    };
    const onPrayer = (event) => { prayerProgress = event.detail.progress; };
    const stop = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frameId);
      display.classList.remove('visuals-active');
      document.removeEventListener('dashboard:scene', onScene);
      document.removeEventListener('dashboard:prayer', onPrayer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (preference.removeEventListener) preference.removeEventListener('change', onMotionChange);
      removeEventListener('pagehide', onPageHide);
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', stop);
        canvas.remove();
      }
      if (app && app.renderer) {
        try { app.destroy(false, { children: true, context: true }); }
        catch (error) { console.warn('PixiJS renderer disposal was interrupted', error); }
      }
    };
    const onMotionChange = () => { if (preference.matches) stop(); };
    // A page held in the browser's history can reuse its original renderer.
    const onPageHide = (event) => { if (!event.persisted) stop(); };
    function onVisibility() {
      cancelAnimationFrame(frameId);
      if (!document.hidden && !disposed) frameId = requestAnimationFrame(frame);
    }

    let ambient;
    let orb;
    let marks = [];
    let countdown;
    let countdownWidth = 0;

    function frame(now) {
      if (disposed || document.hidden) return;
      frameId = requestAnimationFrame(frame);
      const transition = Math.min(1, (now - transitionStart) / 800);
      if (now - lastFrame < (transition < 1 ? 16 : 32)) return;
      lastFrame = now;
      const ease = 1 - Math.pow(1 - transition, 3);
      try {
        orb.rotation = now / 7600;
        ambient.alpha = .16 + Math.sin(now / 8100) * .045;
        for (const mark of marks) {
          const active = mark.scenario ? mark.scenario === scene.brent : scene.focus.includes(mark.panel);
          mark.shape.alpha = mark.scenario && !active ? .72 : 1;
          if (mark.isBar) mark.shape.scale.x = active ? .86 + .14 * ease : 1;
        }
        if (countdown) countdown.scale.x = countdownWidth * prayerProgress;
        app.render();
      } catch (error) {
        stop();
        console.warn('PixiJS display switched to HTML graphics', error);
      }
    }

    try {
      if (document.fonts) await document.fonts.ready;
      const { Application, Container, Graphics } = window.PIXI;
      app = new Application();
      const viewportScale = Math.min(innerWidth / 1920, innerHeight / 1080);
      const resolution = Math.min(1, Math.max(.67, viewportScale * devicePixelRatio));
      await app.init({
        width: 1920, height: 1080, resolution, autoStart: false,
        antialias: true, backgroundAlpha: 0, preference: 'webgl',
        powerPreference: 'low-power'
      });
      scene = window.DisplayState.get().scene;
      canvas = app.canvas;
      canvas.setAttribute('aria-hidden', 'true');
      mount.appendChild(canvas);
      canvas.addEventListener('webglcontextlost', stop);

      ambient = new Graphics();
      for (let i = 0; i < 35; i++) {
        const x = 70 + i * 53;
        const y = 32 + (i * 11) % 10;
        ambient.circle(x, y, i % 3 ? 1 : 2).fill({ color: colors.cyan, alpha: .75 });
      }

      const placement = display.getBoundingClientRect();
      const scale = placement.width / 1920;
      const position = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: (rect.left - placement.left) / scale, y: (rect.top - placement.top) / scale,
          width: rect.width / scale, height: rect.height / scale
        };
      };
      const emblem = new Container();
      const target = position(document.getElementById('rating-emblem'));
      emblem.position.set(target.x + target.width / 2, target.y + target.height / 2);
      const rings = new Graphics();
      [159, 143, 125].forEach((radius, index) => rings.circle(0, 0, radius).stroke({
        color: colors.cyan, width: index === 0 ? 2 : 1, alpha: [.68, .3, .23][index]
      }));
      for (let i = 0; i < 72; i++) {
        const angle = i * Math.PI / 36;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const inner = i % 6 === 0 ? 147 : 151;
        rings.moveTo(cos * inner, sin * inner).lineTo(cos * 155, sin * 155).stroke({
          color: colors.cyan, width: 1, alpha: .34
        });
      }
      orb = new Graphics().circle(156, 0, 3).fill(colors.cyan).circle(-143, 0, 2).fill(colors.sage);
      emblem.addChild(rings, orb);

      const charts = new Container();
      const targets = display.querySelectorAll('.bar-fill, .benchmark .fill, .fiscal-years li span, .brent-axis > div');
      marks = Array.from(targets, (element) => {
        const { x, y, width, height } = position(element);
        const parent = element.parentElement;
        const isBar = element.classList.contains('bar-fill') || element.classList.contains('fill');
        const scenario = parent.classList.contains('brent-axis') ? element.className : '';
        const color = {
          actual: colors.cyan, forecast: colors.amber, stress: colors.coral
        }[scenario] || (element.closest('.sage, .fiscal-years') ? colors.sage : colors.cyan);
        const shape = new Graphics().roundRect(0, 0, width, height, Math.min(height, width) / 2)
          .fill(parent.classList.contains('deficit') ? colors.coral : color);
        shape.position.set(x, y);
        charts.addChild(shape);
        return { shape, scenario, isBar, panel: element.closest('article').id };
      });
      const nextPrayer = document.getElementById('next-prayer');
      if (!nextPrayer.hidden) {
        const next = position(nextPrayer);
        countdownWidth = next.width - 14;
        countdown = new Graphics().rect(0, 0, 1, 2).fill(colors.sage);
        countdown.position.set(next.x + 14, next.y + next.height - 2);
        countdown.scale.x = 0;
        charts.addChild(countdown);
        prayerProgress = parseFloat(nextPrayer.style.getPropertyValue('--prayer-progress')) / 100 || 0;
      }
      app.stage.addChild(ambient, emblem, charts);
      app.render();
      display.classList.add('visuals-active');
      document.addEventListener('dashboard:scene', onScene);
      document.addEventListener('dashboard:prayer', onPrayer);
      document.addEventListener('visibilitychange', onVisibility);
      if (preference.addEventListener) preference.addEventListener('change', onMotionChange);
      addEventListener('pagehide', onPageHide);
      onVisibility();
    } catch (error) {
      stop();
      console.warn('PixiJS display switched to HTML graphics', error);
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
