window.TV_CONFIG = {
  presentation: {
    paused: false,
    durations: { overview: 25, fiscal: 20, economy: 20, risk: 25 },
    disabledScenes: []
  },
  motion: 'auto', // auto, reduced, or static
  clock: { hour12: false, showSeconds: true },
  prayer: {
    zone: 'SBH07',
    location: 'Kota Kinabalu',
    showHijri: true,
    showCountdown: true,
    notifyArrival: true,
    azanUrl: '', // An optional audio URL. Empty keeps audio off.
    showImsak: false,
    showDhuha: false,
    refreshMinutes: 360
  }
};
