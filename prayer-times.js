(() => {
  const config = window.TV_CONFIG.prayer;
  const endpoint = 'https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=';
  const cacheKey = 'tv-esolat-v2-' + config.zone;
  const dayMs = 86400000;
  const malaysiaOffset = 8 * 3600000;
  const fields = [
    ['imsak', 'Imsak', 'dawn', false, config.showImsak],
    ['fajr', 'Subuh', 'dawn', true, true],
    ['syuruk', 'Syuruk', 'sunrise', false, true],
    ['dhuha', 'Dhuha', 'sun', false, config.showDhuha],
    ['dhuhr', 'Zohor', 'sun', true, true],
    ['asr', 'Asar', 'sun', true, true],
    ['maghrib', 'Maghrib', 'sunset', true, true],
    ['isha', 'Isyak', 'moon', true, true]
  ];
  const months = ['Jan', 'Feb', 'Mar Mac', 'Apr', 'May Mei', 'Jun', 'Jul', 'Aug Ogo Ogos', 'Sep', 'Oct Okt', 'Nov', 'Dec Dis'];
  const hijriMonths = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban', 'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijah'];
  const icons = {
    dawn: 'M3 18h18M8 16a4 4 0 0 1 8 0M12 5v4M5 10l2 2m10 0 2-2',
    sunrise: 'M3 18h18M7 16a5 5 0 0 1 10 0M12 3v5m-3-2 3-3 3 3',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    sunset: 'M3 18h18M7 16a5 5 0 0 1 10 0M12 3v5m-3-3 3 3 3-3',
    moon: 'M20 15a8 8 0 0 1-11-11A8.5 8.5 0 1 0 20 15Z'
  };
  const el = (id) => document.getElementById(id);
  const isoDay = (ms) => new Date(ms + malaysiaOffset).toISOString().slice(0, 10);
  const pad = (value) => String(value).padStart(2, '0');
  const statusLine = el('prayer-source');
  const nextName = el('next-name');
  const nextTime = el('next-time');
  const arrival = el('prayer-arrival');
  const obligatory = fields.filter((entry) => entry[3]);
  let schedule = new Map();
  let fetchedAt = 0;
  let displayedDate = '';
  let lastTick;
  let retryAt = 0;
  let retryMs = 30000;
  let loading = false;
  let started = false;
  let cachedOnly = false;
  let arrivalUntil = 0;

  const entries = fields.filter((entry) => entry[4]).map(([key, name, icon]) => {
    const item = document.createElement('li');
    item.className = 'prayer-entry';
    item.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + icons[icon] +
      '"></path></svg><span class="name"></span><time class="time">—</time>';
    item.querySelector('.name').textContent = name;
    if (key === 'syuruk') item.querySelector('.name').title = 'Sunrise reference';
    el('prayer-list').appendChild(item);
    return { key, item, time: item.querySelector('time') };
  });
  el('prayer-list').classList.toggle('extended', entries.length > 6);
  el('next-prayer').parentElement.classList.toggle('no-countdown', !config.showCountdown);
  el('prayer-list').style.gridTemplateColumns = 'repeat(' + entries.length + ', minmax(0, 1fr))';
  el('next-prayer').hidden = !config.showCountdown;
  statusLine.textContent = 'JAKIM e-Solat · ' + config.zone;

  function normalise(payload) {
    if (!payload || payload.zone !== config.zone || payload.periodType !== 'year' || !Array.isArray(payload.prayerTime)) {
      throw new Error('Invalid JAKIM response');
    }
    const days = new Map();
    for (const row of payload.prayerTime) {
      const date = /^(\d{2})-([A-Za-z]{3,4})-(\d{4})$/.exec(row.date);
      const hijri = /^(\d{4})-(\d{2})-(\d{2})$/.exec(row.hijri);
      const month = date && months.findIndex((names) => names.split(' ').includes(date[2])) + 1;
      if (!date || !month || !hijri || !hijriMonths[Number(hijri[2]) - 1] || +hijri[3] < 1 || +hijri[3] > 30) {
        throw new Error('Invalid JAKIM dates');
      }
      const iso = date[3] + '-' + pad(month) + '-' + date[1];
      const start = Date.parse(iso + 'T00:00:00+08:00');
      if (!Number.isFinite(start) || isoDay(start) !== iso || days.has(iso)) throw new Error('Invalid Gregorian day');
      const times = {};
      let previous = start - 1;
      for (const [key] of fields) {
        const time = row[key];
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)) throw new Error('Invalid JAKIM time');
        const at = Date.parse(iso + 'T' + time + '+08:00');
        if (at <= previous) throw new Error('Invalid JAKIM prayer order');
        times[key] = { time, at };
        previous = at;
      }
      days.set(iso, { start, times, hijri: Number(hijri[3]) + ' ' + hijriMonths[Number(hijri[2]) - 1] + ' ' + hijri[1] + ' H' });
    }
    const dates = [...days.values()].map((day) => day.start).sort((a, b) => a - b);
    const first = isoDay(dates[0] || 0);
    const year = Number(first.slice(0, 4));
    const yearLength = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / dayMs;
    if (first.slice(5) !== '01-01' || dates.length !== yearLength || dates.some((date, i) => i && date - dates[i - 1] !== dayMs)) {
      throw new Error('Incomplete annual timetable');
    }
    return days;
  }

  try {
    const record = JSON.parse(localStorage.getItem(cacheKey));
    if (record && Number.isFinite(record.fetchedAt)) {
      schedule = normalise(record.payload);
      fetchedAt = record.fetchedAt;
      cachedOnly = true;
    }
  } catch (_) { /* Ignore invalid or inaccessible cache. */ }

  async function refresh() {
    if (loading) return;
    loading = true;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller && setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint + encodeURIComponent(config.zone), {
        cache: 'no-store', signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error('JAKIM HTTP ' + response.status);
      const payload = await response.json();
      const days = normalise(payload);
      if (!days.has(isoDay(Date.now()))) throw new Error('JAKIM timetable excludes today');
      // Preserve adjacent dates across a year change for the post-Isyak interval.
      schedule = new Map([...schedule, ...days].filter(([, day]) => Math.abs(day.start - Date.now()) <= 367 * dayMs));
      fetchedAt = Date.now();
      cachedOnly = false;
      retryMs = 30000;
      retryAt = fetchedAt + config.refreshMinutes * 60000;
      try { localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt, payload })); } catch (_) { /* Storage may be disabled. */ }
    } catch (_) {
      cachedOnly = schedule.size > 0;
      retryAt = Date.now() + retryMs;
      retryMs = Math.min(retryMs * 2, 30 * 60000);
    } finally {
      if (timeout) clearTimeout(timeout);
      loading = false;
      tick(Date.now(), true);
    }
  }

  function setArrival(name, value, now) {
    arrivalUntil = now + 15000;
    arrival.textContent = 'Masuk waktu ' + name + ' · ' + value.time.slice(0, 5) + ' · ' + config.location;
    arrival.hidden = false;
    if (config.azanUrl) {
      const playback = new Audio(config.azanUrl).play();
      if (playback) playback.catch(() => {});
    }
  }

  function tick(now, fromRefresh) {
    const date = isoDay(now);
    const tomorrowDate = isoDay(now + dayMs);
    const today = schedule.get(date);
    const tomorrow = schedule.get(tomorrowDate);
    const rollover = displayedDate !== date;
    displayedDate = date;
    const nextToday = today && obligatory.find(([key]) => today.times[key].at > now);
    const nextField = nextToday || (tomorrow ? obligatory[0] : null);
    const next = nextField && (nextToday ? today : tomorrow).times[nextField[0]];

    for (const entry of entries) {
      const value = today && today.times[entry.key];
      if (rollover || fromRefresh) {
        entry.time.textContent = value ? value.time.slice(0, 5) : '—';
        if (value) entry.time.dateTime = value.time;
        else entry.time.removeAttribute('datetime');
      }
      entry.item.classList.toggle('past', Boolean(value && value.at <= now));
      entry.item.classList.toggle('next', Boolean(nextToday && nextToday[0] === entry.key));
    }
    if (rollover || fromRefresh) el('hijri-date').textContent = config.showHijri && today ? today.hijri : '';
    statusLine.textContent = (today ? 'JAKIM e-Solat' : loading ? 'Timetable loading' : 'Timetable unavailable') + ' · ' + config.zone + (today && cachedOnly ? ' · Cached' : '');
    nextName.textContent = next ? nextField[1] + (nextToday ? '' : ' · tomorrow') : today ? 'Tomorrow unavailable' : 'Timetable unavailable';
    if (next) {
      const seconds = Math.ceil((next.at - now) / 1000);
      nextTime.textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(pad).join(':');
      nextTime.dateTime = 'PT' + seconds + 'S';
    } else {
      nextTime.textContent = '—';
      nextTime.removeAttribute('datetime');
    }
    if (config.notifyArrival && today && lastTick !== undefined) {
      const arrived = obligatory.find(([key]) => today.times[key].at > lastTick && today.times[key].at <= now && now - today.times[key].at < 15000);
      if (arrived) setArrival(arrived[1], today.times[arrived[0]], now);
    }
    if (now >= arrivalUntil) arrival.hidden = true;
    lastTick = now;
    if (!fromRefresh && (now >= retryAt || (rollover && (!today || !tomorrow)))) refresh();

    const yesterday = schedule.get(isoDay(now - dayMs));
    const previous = today && obligatory.map(([key]) => today.times[key].at).reverse().find((at) => at <= now);
    const intervalStart = previous || (yesterday && yesterday.times.isha.at);
    const progress = config.showCountdown && next && intervalStart ? (now - intervalStart) / (next.at - intervalStart) : 0;
    const detail = { progress: Math.max(0, Math.min(1, progress)), next: next && nextField[0], arrival: !arrival.hidden };
    el('next-prayer').style.setProperty('--prayer-progress', (detail.progress * 100) + '%');
    document.dispatchEvent(new CustomEvent('dashboard:prayer', { detail }));
  }

  window.PrayerService = {
    start() {
      if (started) return;
      started = true;
      tick(Date.now(), true);
      refresh();
      setInterval(() => tick(Date.now(), false), 1000);
      addEventListener('online', refresh);
    }
  };
})();
