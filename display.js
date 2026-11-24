(() => {
  const state = { sceneIndex: -1, rotationStart: 0 };
  const el = (id) => document.getElementById(id);
  const display = el('display');
  const config = window.TV_CONFIG;
  const scenes = window.TV_SCENES.filter((scene) => !config.presentation.disabledScenes.includes(scene.id));
  const durations = scenes.map((scene) => {
    const seconds = Number(config.presentation.durations[scene.id]);
    return seconds > 0 && Number.isFinite(seconds) ? seconds * 1000 : 20000;
  });
  const cycle = durations.reduce((total, duration) => total + duration, 0);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const clockFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: config.clock.hour12
  });
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const malaysiaParts = (now) => clockFormat.formatToParts(new Date(now)).reduce((out, part) => {
    out[part.type] = part.value;
    return out;
  }, {});

  const fit = () => {
    const display = document.getElementById('display');
    const widthScale = innerWidth / 1920;
    const heightScale = innerHeight / 1080;
    display.style.setProperty('--display-scale', Math.min(widthScale, heightScale));
    display.classList.add('ready');
  };

  const updateClock = () => {
    const now = Date.now();
    const parts = malaysiaParts(now);
    const clock = el('clock-time');
    const time = parts.hour + ':' + parts.minute;
    if (clock.textContent !== time) {
      clock.textContent = time;
      clock.dateTime = new Date(now).toISOString();
      if (clock.animate && config.motion === 'auto' && !reducedMotion.matches) {
        clock.animate([{ opacity: .72 }, { opacity: 1 }], { duration: 280 });
      }
    }
    el('clock-seconds').textContent = config.clock.showSeconds ? ':' + parts.second : '';
    el('clock-period').textContent = parts.dayPeriod ? parts.dayPeriod.toUpperCase() : '';
    el('clock-date').textContent = dateFormat.format(new Date(now));
  };

  const bar = (label, value, max, colour, suffix) => '<div class="bar-row"><span class="label">' + label + '</span><div class="bar-track"><div class="bar-fill ' + colour + '" style="width:' + Math.min(100, value / max * 100) + '%"></div></div><span class="value">' + suffix + '</span></div>';

  const renderFinancials = () => {
    const d = window.CREDIT_DATA;
    el('rating-value').textContent = d.rating.grade;
    el('funds-value').textContent = 'RM' + d.funds.value + 'bn';
    el('revenue-value').textContent = 'RM' + d.revenue.value + 'bn';
    el('grant-value').textContent = 'RM' + d.grant.amounts[1].value / 1000 + 'bn';
    el('debt-chart').innerHTML = d.funds.coverage.map(({ year, value }, i) =>
      bar(year, value, d.funds.coverageScale, i ? 'sage' : 'cyan', value + '×')).join('');
    el('grant-chart').innerHTML = d.grant.amounts.map(({ year, value }, i) =>
      bar(year, value, d.grant.amounts[1].value, i ? 'sage' : 'cyan', 'RM' + (i ? value / 1000 + 'bn' : value + 'm'))).join('');
    document.getElementById('fiscal-years').innerHTML = Array.from({ length: 10 }, (_, index) => {
      const year = d.revenue.firstFiscalYear + index;
      const deficit = d.revenue.deficitYears.includes(year);
      const label = year + (deficit ? ' deficit' : ' surplus');
      return '<li class="' + (deficit ? 'deficit' : '') + '" aria-label="' + label + '" title="' + label +
        '"><span></span><small>' + String(year).slice(-2) + '</small></li>';
    }).join('');
    document.getElementById('benchmarks').innerHTML = d.resources.groups.map((group) => '<div class="benchmark-group"><h3>' + group.name + '</h3>' + group.items.map((item) => '<div class="benchmark ' + group.colour + '"><div class="label">' + item.label + '<span class="meta">' + (item.context || '') + '</span></div><span class="value">' + (item.approximate ? '≈' : '') + item.value + '%</span><div class="track"><div class="fill" style="width:' + item.value + '%"></div></div></div>').join('') + '</div>').join('');
    renderBrent();
  };

  const renderBrent = () => {
    const chart = document.getElementById('brent-chart');
    const d = window.CREDIT_DATA.brent;
    const scale = (value) => ((value - d.axis[0]) / (d.axis[1] - d.axis[0])) * 100;
    const forecast = d.cases.find((item) => item.id === 'forecast');
    const actual = d.cases.find((item) => item.id === 'actual');
    const stress = d.cases.find((item) => item.id === 'stress');
    const range = '<div class="stress" style="width:' + scale(stress.below) + '%"></div>' +
      '<div class="forecast" style="left:' + scale(forecast.low) + '%;width:' + (scale(forecast.high) - scale(forecast.low)) + '%"></div>';
    chart.innerHTML = '<div class="brent-axis">' + range + '<div class="actual" style="left:' + scale(actual.value) +
      '%"></div></div><div class="brent-ticks">' + d.ticks.map((tick) => '<span style="left:' + scale(tick) + '%">' + tick + '</span>').join('') + '</div>';
    el('brent-legend').innerHTML =
      '<span class="legend-key">2025 actual · <strong>' + actual.value + '</strong></span>' +
      '<span class="legend-key amber">2026 forecast · <strong>' + forecast.low + '–' + forecast.high + '</strong></span>' +
      '<span class="legend-key coral">Illustrative stress · <strong>&lt;' + stress.below + '</strong></span>';
  };

  async function checkForUpdate() {
    try {
      const response = await fetch(location.pathname, { cache: 'no-store' });
      if (!response.ok) return;
      const remote = new DOMParser().parseFromString(await response.text(), 'text/html');
      const selector = 'meta[name="display-release"]';
      const current = document.querySelector(selector).content;
      const latest = remote.querySelector(selector);
      if (!latest || !/^[\d.\-]+$/.test(latest.content) || latest.content === current) return;
      const url = new URL(location.href);
      if (url.searchParams.get('display') === latest.content) return;
      url.searchParams.set('display', latest.content);
      location.replace(url.href);
    } catch (_) {
      // Retain the current display if GitHub Pages is temporarily unreachable.
    }
  }

  const updateScene = () => {
    const elapsed = cycle && !config.presentation.paused ? Math.max(0, Date.now() - state.rotationStart) % cycle : 0;
    let remaining = elapsed;
    let index = 0;
    while (index < scenes.length - 1 && remaining >= durations[index]) {
      remaining -= durations[index];
      index++;
    }
    const scene = scenes[index] || window.TV_SCENES[0];
    if (state.sceneIndex !== index) {
      state.sceneIndex = index;
      display.querySelectorAll('.scene-focus').forEach((panel) => panel.classList.remove('scene-focus'));
      scene.focus.forEach((id) => el(id).classList.add('scene-focus'));
      el('scene-label').textContent = scene.label;
      el('insight-heading').textContent = scene.heading;
      el('insight-text').textContent = scene.insight;
      el('brent-insight').textContent = window.CREDIT_DATA.brent.insights[scene.brent];
      el('brent-chart').dataset.active = scene.brent;
      const insight = el('insight-copy');
      if (insight.animate && config.motion === 'auto' && !reducedMotion.matches) {
        insight.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 750 });
      }
      document.dispatchEvent(new CustomEvent('dashboard:scene', { detail: scene }));
    }
    el('scene-progress').style.transform = 'scaleX(' + (cycle && !config.presentation.paused ? elapsed / cycle : 0) + ')';
  };

  window.DisplayState = { get: () => ({ scene: scenes[state.sceneIndex] || window.TV_SCENES[0], index: state.sceneIndex }) };

  document.addEventListener('DOMContentLoaded', () => {
    display.dataset.motion = config.motion;
    renderFinancials();
    fit();
    state.rotationStart = Date.now();
    updateClock();
    updateScene();
    setInterval(updateClock, 250);
    setInterval(checkForUpdate, 5 * 60000);
    if (!config.presentation.paused && scenes.length) setInterval(updateScene, 250);
    addEventListener('resize', fit);
    if (window.PrayerService) window.PrayerService.start();
  });
})();
