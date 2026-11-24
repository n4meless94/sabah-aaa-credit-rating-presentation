(() => {
  const state = { sceneIndex: 0, sceneStarted: Date.now(), timer: null };
  const config = window.TV_CONFIG;
  const scenes = (window.TV_SCENES || []).filter((scene) => !config.presentation.disabledScenes.includes(scene.id));

  const clockFormatter = new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: config.clock.hour12
  });

  const fit = () => {
    const display = document.getElementById('display');
    const widthScale = innerWidth / 1920;
    const heightScale = innerHeight / 1080;
    display.style.setProperty('--display-scale', Math.min(widthScale, heightScale));
    display.classList.add('ready');
    document.dispatchEvent(new Event('dashboard:fit'));
  };

  const updateClock = () => {
    const now = new Date();
    const parts = {};
    for (const part of clockFormatter.formatToParts(now)) parts[part.type] = part.value;
    const hour = parts.hour === '24' ? '00' : parts.hour;
    const time = document.getElementById('clock-time');
    time.textContent = hour + ':' + parts.minute;
    time.dateTime = now.toISOString();
    document.getElementById('clock-seconds').textContent = config.clock.showSeconds ? ':' + parts.second : '';
    document.getElementById('clock-period').textContent = parts.dayPeriod || '';
    document.getElementById('clock-date').textContent = parts.weekday + ', ' + parts.day + ' ' + parts.month + ' ' + parts.year;
  };

  const bar = (label, value, max, colour, suffix) => '<div class="bar-row"><span class="label">' + label + '</span><div class="bar-track"><div class="bar-fill ' + colour + '" style="width:' + Math.min(100, value / max * 100) + '%"></div></div><span class="value">' + value + suffix + '</span></div>';

  const renderFinancials = () => {
    const d = window.CREDIT_DATA;
    document.getElementById('debt-chart').innerHTML = bar('2020', d.funds.coverage[0].value, d.funds.coverageScale, 'cyan', '×') + bar('2024', d.funds.coverage[1].value, d.funds.coverageScale, 'sage', '×');
    document.getElementById('grant-chart').innerHTML = bar('2025', d.grant.amounts[0].value, d.grant.amounts[1].value, 'cyan', 'm') + bar('2026', d.grant.amounts[1].value, d.grant.amounts[1].value, 'sage', 'm');
    document.getElementById('fiscal-years').innerHTML = Array.from({ length: 10 }, (_, index) => {
      const year = d.revenue.firstFiscalYear + index;
      const deficit = d.revenue.deficitYears.includes(year);
      return '<li class="' + (deficit ? 'deficit' : '') + '" aria-label="' + year + ': ' + (deficit ? 'deficit' : 'surplus') + '"><span aria-hidden="true"></span><small aria-hidden="true">' + String(year).slice(-2) + '</small></li>';
    }).join('');
    document.getElementById('benchmarks').innerHTML = d.resources.groups.map((group) => '<div class="benchmark-group"><h3>' + group.name + '</h3>' + group.items.map((item) => '<div class="benchmark ' + group.colour + '"><div class="label">' + item.label + '<span class="meta"> ' + (item.context || '') + '</span></div><span class="value">' + (item.approximate ? '~' : '') + item.value + '%</span><div class="track"><div class="fill" style="width:' + item.value + '%"></div></div></div>').join('') + '</div>').join('');
    renderBrent('forecast');
  };

  const renderBrent = (caseId) => {
    const chart = document.getElementById('brent-chart');
    const d = window.CREDIT_DATA.brent;
    const scale = (value) => ((value - d.axis[0]) / (d.axis[1] - d.axis[0])) * 100;
    const forecast = d.cases.find((item) => item.id === 'forecast');
    const actual = d.cases.find((item) => item.id === 'actual');
    const stress = d.cases.find((item) => item.id === 'stress');
    chart.dataset.active = caseId;
    chart.innerHTML = '<div class="brent-axis"><div class="stress" style="left:0;width:' + scale(stress.below) + '%"></div>' +
      '<div class="forecast" style="left:' + scale(forecast.low) + '%;width:' + (scale(forecast.high) - scale(forecast.low)) + '%"></div>' +
      '<div class="actual" style="left:' + scale(actual.value) + '%"></div></div><div class="brent-ticks">' +
      d.ticks.map((tick) => '<span style="left:' + scale(tick) + '%">' + tick + '</span>').join('') + '</div>';
    document.getElementById('brent-legend').innerHTML =
      '<span class="legend-key">' + actual.label + ' · ' + actual.value + '</span>' +
      '<span class="legend-key amber">' + forecast.label + ' · ' + forecast.low + '–' + forecast.high + '</span>' +
      '<span class="legend-key coral">' + stress.label + ' · below ' + stress.below + '</span>';
    document.getElementById('brent-insight').textContent = caseId === 'stress' ? d.insights.stress : d.insights.forecast;
  };

  const applyScene = (index) => {
    if (!scenes.length) return;
    state.sceneIndex = index % scenes.length;
    state.sceneStarted = Date.now();
    const scene = scenes[state.sceneIndex];
    const display = document.getElementById('display');
    for (const candidate of scenes) display.classList.remove('scene-' + candidate.id);
    display.classList.add('scene-' + scene.id);
    document.getElementById('scene-label').textContent = scene.label;
    document.getElementById('insight-heading').textContent = scene.heading;
    document.getElementById('insight-text').textContent = scene.insight;
    document.getElementById('scene-progress').style.width = '0%';
    renderBrent(scene.brent);
    const insight = document.querySelector('.insight-copy');
    if (config.motion === 'auto' && !matchMedia('(prefers-reduced-motion: reduce)').matches && insight.animate) {
      insight.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 700 });
    }
    document.dispatchEvent(new CustomEvent('dashboard:scene', { detail: scene }));
    scheduleScene();
    updateProgress();
  };

  const scheduleScene = () => {
    clearTimeout(state.timer);
    if (config.presentation.paused || scenes.length < 2) return;
    const scene = scenes[state.sceneIndex];
    state.timer = setTimeout(() => applyScene((state.sceneIndex + 1) % scenes.length), config.presentation.durations[scene.id] * 1000);
  };

  const updateProgress = () => {
    const scene = scenes[state.sceneIndex];
    if (!scene || config.presentation.paused) return;
    const elapsed = Date.now() - state.sceneStarted;
    const duration = config.presentation.durations[scene.id] * 1000;
    document.getElementById('scene-progress').style.width = Math.min(100, elapsed / duration * 100) + '%';
  };

  const checkForUpdate = async () => {
    try {
      const response = await fetch(location.pathname, { cache: 'no-store' });
      if (!response.ok) return;
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const releaseSelector = 'meta[name="display-release"]';
      const current = document.querySelector(releaseSelector).content;
      const latest = page.querySelector(releaseSelector);
      if (!latest || !/^[\d.\-]+$/.test(latest.content) || latest.content === current) return;
      const updated = new URL(location.href);
      if (updated.searchParams.get('display') === latest.content) return;
      updated.searchParams.set('display', latest.content);
      location.replace(updated.href);
    } catch (_) { /* Keep displaying the current release during an outage. */ }
  };

  window.DisplayState = { get: () => ({ scene: scenes[state.sceneIndex], index: state.sceneIndex }) };

  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.dataset.motion = config.motion;
    renderFinancials();
    fit();
    updateClock();
    setInterval(updateClock, 1000);
    addEventListener('resize', fit);
    applyScene(0);
    setInterval(updateProgress, 500);
    setInterval(checkForUpdate, 5 * 60000);
    window.PrayerService.start();
  });
})();
