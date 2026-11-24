window.CREDIT_DATA = {
  source: {
    name: 'MARC Ratings',
    date: '2026-11-20',
    url: 'https://www.marc.com.my/rating-announcements/marc-ratings-affirms-sabahs-sub-sovereign-rating-at-aaa-3/',
    context: 'Sabah Development Corridor Blueprint 2.0',
    lastRefresh: null
  },
  rating: { grade: 'AAA', outlook: 'Stable', status: 'Affirmed', classification: 'published-rating' },
  funds: {
    value: 7.6, unit: 'RM bn', year: 2024, classification: 'actual', rank: 2,
    coverage: [{ year: 2020, value: 1.1 }, { year: 2024, value: 2.4 }], coverageUnit: '×', coverageScale: 3
  },
  revenue: {
    value: 6.8, unit: 'RM bn', year: 2024, classification: 'actual',
    gdpShare: 6, rank: 2, firstFiscalYear: 2015, deficitYears: [2020],
    surplusGdpShare: [{ year: 2023, value: 1 }, { year: 2024, value: 0.4 }]
  },
  grant: {
    unit: 'RM m',
    amounts: [{ year: 2025, value: 600 }, { year: 2026, value: 1500 }],
    classification: 'published-interim-grant', increase: 150,
    parliamentSeats: 25, parliamentTotal: 222, federalProjectCapMillions: 50, revenueEntitlement: 40
  },
  resources: {
    year: 2025, unit: '%', classification: 'actual',
    groups: [
      { name: 'Share of Malaysian production', colour: 'cyan', items: [
        { label: 'Crude oil', value: 40, approximate: true },
        { label: 'Crude palm oil', value: 22, context: '4.4m tonnes · 2nd in Malaysia' }
      ] },
      { name: 'Share of Sabah GDP', colour: 'sage', items: [
        { label: 'Agriculture and mining', value: 35.9 },
        { label: 'Manufacturing', value: 7.2 }
      ] }
    ]
  },
  brent: {
    unit: 'USD/bbl', axis: [50, 110], ticks: [50, 70, 90, 110],
    cases: [
      { id: 'actual', period: 2025, label: '2025 actual', value: 68, classification: 'actual', colour: 'cyan' },
      { id: 'forecast', period: 2026, label: '2026 forecast', low: 90, high: 95, classification: 'published-forecast', colour: 'amber' },
      { id: 'stress', label: 'Illustrative stress', below: 65, classification: 'illustrative', colour: 'coral' }
    ],
    insights: {
      forecast: 'MARC expects higher Brent prices to support energy-linked revenue.',
      stress: 'Over two-thirds of state revenue is tied to commodities, exposing collections to a sustained downturn.'
    }
  }
};

window.TV_SCENES = [
  { id: 'overview', label: 'Executive Overview', focus: ['funds-panel', 'revenue-panel', 'grant-panel'], brent: 'forecast',
    heading: 'AAA affirmed with a stable outlook',
    insight: 'Liquidity, natural resource income and federal support underpin Sabah’s rating.' },
  { id: 'fiscal', label: 'Fiscal Resilience', focus: ['funds-panel', 'revenue-panel'], brent: 'actual',
    heading: 'Reserves cover gross debt 2.4 times',
    insight: 'Gross debt coverage rose from 1.1× in 2020. Sabah recorded a surplus in nine of ten years through 2024.' },
  { id: 'economy', label: 'Economic Strength', focus: ['resources-panel', 'grant-panel'], brent: 'forecast',
    heading: 'Resource income and MA63 support state finances',
    insight: 'Sabah produces about 40% of Malaysia’s crude oil. The 2026 interim grant rose to RM1.5bn.' },
  { id: 'risk', label: 'Risk Intelligence', focus: ['risk-panel'], brent: 'stress',
    heading: 'Commodity weakness could pressure revenue',
    insight: 'A prolonged downturn or weaker state–federal cooperation could strain Sabah’s finances.' }
];
