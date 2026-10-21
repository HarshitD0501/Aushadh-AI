/**
 * AushadhAi Development Fixtures
 * STRICT REQUIREMENT: Only used in development when backend is unreachable.
 * Never presented as live verified server data without dev fixture indicator.
 */

import type {
  CityRecord,
  CompareRequest,
  CompareResponse,
  OcrResponse,
  PublicCatalogueResponse,
  RouteResponse,
  SearchResponse,
  StoreRecord
} from './types';

export const DEV_FIXTURE_CATALOGUE: PublicCatalogueResponse = {
  version: '2026.03-dev-fixtures',
  checked_on: '2026-03-01',
  records: [
    {
      medicine_id: 'pmbjp-001-paracetamol-500',
      name: 'Paracetamol Tablets IP 500mg',
      molecule_label: 'Paracetamol',
      strength_label: '500 mg',
      form: 'Tablet'
    },
    {
      medicine_id: 'pmbjp-023-metformin-500',
      name: 'Metformin Hydrochloride Tablets IP 500mg',
      molecule_label: 'Metformin HCl',
      strength_label: '500 mg',
      form: 'Tablet'
    },
    {
      medicine_id: 'pmbjp-045-atorvastatin-10',
      name: 'Atorvastatin Tablets IP 10mg',
      molecule_label: 'Atorvastatin',
      strength_label: '10 mg',
      form: 'Tablet'
    },
    {
      medicine_id: 'pmbjp-012-amlodipine-5',
      name: 'Amlodipine Tablets IP 5mg',
      molecule_label: 'Amlodipine Besylate',
      strength_label: '5 mg',
      form: 'Tablet'
    },
    {
      medicine_id: 'pmbjp-089-azithromycin-500',
      name: 'Azithromycin Tablets IP 500mg',
      molecule_label: 'Azithromycin',
      strength_label: '500 mg',
      form: 'Tablet'
    },
    {
      medicine_id: 'pmbjp-999-rare-generic',
      name: 'Specialty Orphan Formulation 100mg',
      molecule_label: 'Specialty Compound',
      strength_label: '100 mg',
      form: 'Tablet'
    }
  ]
};

const DEV_FIXTURE_ITEMS = [
  {
    medicine_id: 'pmbjp-001-paracetamol-500',
    matched_text: 'Paracetamol Tablets IP 500mg',
    molecule_label: 'Paracetamol',
    strength_label: '500 mg',
    form: 'Tablet',
    release_type: 'Immediate Release',
    pack_label: '10 Tablets Strip',
    pmbjp_product_code: 'PMBJP-001',
    brands: [
      { brand_id: 'brand-dolo-500', name: 'Dolo 500' },
      { brand_id: 'brand-calpol-500', name: 'Calpol 500' }
    ],
    market_prices: {
      'brand-dolo-500': {
        amount_paise: 1650,
        currency: 'INR',
        unit: '10 tablets',
        source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
        checked_on: '2026-03-01'
      },
      'brand-calpol-500': {
        amount_paise: 1720,
        currency: 'INR',
        unit: '10 tablets',
        source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
        checked_on: '2026-03-01'
      }
    },
    pmbjp_price: {
      amount_paise: 980,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://janaushadhi.gov.in/product-portfolio/product-view-list',
      checked_on: '2026-03-01'
    },
    nppa_ceiling_price: {
      amount_paise: 1950,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
      checked_on: '2026-03-01'
    }
  },
  {
    medicine_id: 'pmbjp-023-metformin-500',
    matched_text: 'Metformin Hydrochloride Tablets IP 500mg',
    molecule_label: 'Metformin HCl',
    strength_label: '500 mg',
    form: 'Tablet',
    release_type: 'Immediate Release',
    pack_label: '10 Tablets Strip',
    pmbjp_product_code: 'PMBJP-023',
    brands: [
      { brand_id: 'brand-glycomet-500', name: 'Glycomet 500' }
    ],
    market_prices: {
      'brand-glycomet-500': {
        amount_paise: 2850,
        currency: 'INR',
        unit: '10 tablets',
        source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
        checked_on: '2026-03-01'
      }
    },
    pmbjp_price: {
      amount_paise: 1420,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://janaushadhi.gov.in/product-portfolio/product-view-list',
      checked_on: '2026-03-01'
    },
    nppa_ceiling_price: {
      amount_paise: 3100,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
      checked_on: '2026-03-01'
    }
  },
  {
    medicine_id: 'pmbjp-045-atorvastatin-10',
    matched_text: 'Atorvastatin Tablets IP 10mg',
    molecule_label: 'Atorvastatin',
    strength_label: '10 mg',
    form: 'Tablet',
    release_type: 'Immediate Release',
    pack_label: '10 Tablets Strip',
    pmbjp_product_code: 'PMBJP-045',
    brands: [
      { brand_id: 'brand-atorva-10', name: 'Atorva 10' }
    ],
    market_prices: {
      'brand-atorva-10': {
        amount_paise: 11000,
        currency: 'INR',
        unit: '10 tablets',
        source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
        checked_on: '2026-03-01'
      }
    },
    pmbjp_price: {
      amount_paise: 1850,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://janaushadhi.gov.in/product-portfolio/product-view-list',
      checked_on: '2026-03-01'
    },
    nppa_ceiling_price: {
      amount_paise: 9500,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://nppaipdms.gov.in/NPPA/PharmaSahiDaam/searchMedicine',
      checked_on: '2026-03-01'
    }
  },
  {
    medicine_id: 'pmbjp-999-rare-generic',
    matched_text: 'Specialty Orphan Formulation 100mg',
    molecule_label: 'Specialty Compound',
    strength_label: '100 mg',
    form: 'Tablet',
    release_type: null,
    pack_label: '10 Tablets Strip',
    pmbjp_product_code: 'PMBJP-999',
    brands: [],
    market_prices: {},
    pmbjp_price: {
      amount_paise: 4500,
      currency: 'INR',
      unit: '10 tablets',
      source_url: 'https://janaushadhi.gov.in/product-portfolio/product-view-list',
      checked_on: '2026-03-01'
    },
    nppa_ceiling_price: null
  }
];

export function getFixtureSearch(query: string): SearchResponse {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { query, candidates: [] };
  }

  const matches = DEV_FIXTURE_ITEMS.filter((item) => {
    return (
      item.matched_text.toLowerCase().includes(q) ||
      item.molecule_label.toLowerCase().includes(q) ||
      item.brands.some((b) => b.name.toLowerCase().includes(q))
    );
  });

  return {
    query,
    candidates: matches.map((item) => ({
      medicine_id: item.medicine_id,
      matched_text: item.matched_text,
      molecule_label: item.molecule_label,
      strength_label: item.strength_label,
      form: item.form,
      release_type: item.release_type,
      pack_label: item.pack_label,
      brands: item.brands,
      match_score: 92,
      requires_confirmation: true
    }))
  };
}

export function getFixtureCompare(request: CompareRequest): CompareResponse {
  const items = request.items.map((reqItem) => {
    const fixture = DEV_FIXTURE_ITEMS.find((f) => f.medicine_id === reqItem.medicine_id);
    if (!fixture) {
      return {
        medicine_id: reqItem.medicine_id,
        pmbjp_product_code: null,
        matched_text: 'Unknown Medicine',
        molecule_label: 'Unknown',
        strength_label: 'Unknown',
        form: 'Unknown',
        release_type: null,
        pack_label: 'Unknown',
        brand_name: null,
        market_price: null,
        nppa_ceiling_price: null,
        pmbjp_price: null,
        saving_paise: null,
        saving_percent: null,
        comparison_basis: null,
        excluded_reason: 'Medicine ID not found in verified catalogue'
      };
    }

    const brandName = reqItem.brand_id
      ? fixture.brands.find((b) => b.brand_id === reqItem.brand_id)?.name || null
      : null;

    const marketPrice = reqItem.brand_id
      ? (fixture.market_prices as Record<string, typeof fixture.pmbjp_price>)[reqItem.brand_id] || null
      : null;

    const pmbjpPrice = fixture.pmbjp_price;
    const packCount = Math.max(1, reqItem.pack_count || 1);

    const hasBoth = marketPrice !== null && pmbjpPrice !== null;

    let savingPaise: number | null = null;
    let savingPercent: number | null = null;
    let excludedReason: string | null = null;

    if (hasBoth) {
      const marketTotal = marketPrice.amount_paise * packCount;
      const pmbjpTotal = pmbjpPrice.amount_paise * packCount;
      savingPaise = marketTotal - pmbjpTotal;
      savingPercent = marketTotal > 0 ? Math.round((savingPaise / marketTotal) * 100) : null;
    } else if (!marketPrice) {
      excludedReason = 'No verified branded market price record for comparison';
    } else {
      excludedReason = 'No verified PMBJP generic price record available';
    }

    return {
      medicine_id: fixture.medicine_id,
      pmbjp_product_code: fixture.pmbjp_product_code,
      matched_text: fixture.matched_text,
      molecule_label: fixture.molecule_label,
      strength_label: fixture.strength_label,
      form: fixture.form,
      release_type: fixture.release_type,
      pack_label: fixture.pack_label,
      brand_name: brandName,
      market_price: marketPrice,
      nppa_ceiling_price: fixture.nppa_ceiling_price,
      pmbjp_price: pmbjpPrice,
      saving_paise: savingPaise,
      saving_percent: savingPercent,
      comparison_basis: `${fixture.pack_label} (${packCount} pack${packCount > 1 ? 's' : ''})`,
      excluded_reason: excludedReason
    };
  });

  const comparable = items.filter((i) => i.saving_paise !== null);
  const incomplete = items.filter((i) => i.saving_paise === null);

  const marketTotalPaise = comparable.reduce(
    (acc, cur) => acc + (cur.market_price ? cur.market_price.amount_paise : 0),
    0
  );
  const pmbjpTotalPaise = comparable.reduce(
    (acc, cur) => acc + (cur.pmbjp_price ? cur.pmbjp_price.amount_paise : 0),
    0
  );
  const savingTotalPaise = marketTotalPaise - pmbjpTotalPaise;
  const savingPercent =
    marketTotalPaise > 0 ? Math.round((savingTotalPaise / marketTotalPaise) * 100) : null;

  return {
    items,
    totals: {
      comparable_item_count: comparable.length,
      incomplete_item_count: incomplete.length,
      market_total_paise: comparable.length > 0 ? marketTotalPaise : null,
      pmbjp_total_paise: comparable.length > 0 ? pmbjpTotalPaise : null,
      saving_total_paise: comparable.length > 0 ? savingTotalPaise : null,
      saving_percent: comparable.length > 0 ? savingPercent : null
    }
  };
}

export function getFixtureOcr(fileName?: string): OcrResponse {
  const name = fileName?.toLowerCase() || '';
  if (name.includes('blur') || name.includes('handwritten')) {
    return {
      raw_text: 'Px ... tab ... 500 ... daily ... morning',
      normalization_provider: 'none',
      suggestions: [
        {
          observed_text: 'tab 500',
          query_tokens: ['tab', '500'],
          candidate_medicine_ids: ['pmbjp-001-paracetamol-500', 'pmbjp-023-metformin-500'],
          status: 'unconfirmed'
        }
      ],
      warnings: [
        'Low contrast or handwriting detected. Raw OCR text may contain transcription errors. Please verify and correct manually.'
      ]
    };
  }

  return {
    raw_text: 'DOLO 500 PARACETAMOL TABLETS IP 500mg Batch: DL8921 Exp: 12/28 Micro Labs Ltd',
    normalization_provider: 'gemma',
    suggestions: [
      {
        observed_text: 'DOLO 500 PARACETAMOL TABLETS IP 500mg',
        query_tokens: ['Dolo', 'Paracetamol', '500mg', 'Tablet'],
        candidate_medicine_ids: ['pmbjp-001-paracetamol-500'],
        status: 'unconfirmed'
      }
    ],
    warnings: [
      'Extracted medicine names are candidate suggestions only. Confirm exact formulation before proceeding.'
    ]
  };
}

export const DEV_FIXTURE_CITIES: CityRecord[] = [
  { city_id: 'delhi', name: 'New Delhi', state: 'Delhi' },
  { city_id: 'jaipur', name: 'Jaipur', state: 'Rajasthan' },
  { city_id: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
  { city_id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka' }
];

export const DEV_FIXTURE_STORES: StoreRecord[] = [
  {
    kind: 'kendra',
    name: 'Jan Aushadhi Kendra - AIIMS Ansari Nagar',
    address: 'Near Gate No. 2, AIIMS Campus, Ansari Nagar, New Delhi',
    lat: 28.5672,
    lng: 77.2100,
    distance_m: 1200,
    contact: '+91 11 2658 8500',
    hours: '08:00 - 20:00 (Mon-Sat)',
    source: 'Official PMBI Jan Aushadhi Kendra Directory'
  },
  {
    kind: 'kendra',
    name: 'Jan Aushadhi Kendra - Connaught Place',
    address: 'Block P, Connaught Circus, Central Delhi',
    lat: 28.6315,
    lng: 77.2167,
    distance_m: 3400,
    contact: '+91 11 2334 1122',
    hours: '09:00 - 21:00 (Daily)',
    source: 'Official PMBI Jan Aushadhi Kendra Directory'
  },
  {
    kind: 'kendra',
    name: 'Jan Aushadhi Kendra - SMS Hospital Road',
    address: 'Near Gate 3, Sawai Man Singh Hospital, JLN Marg, Jaipur',
    lat: 26.8920,
    lng: 75.8150,
    distance_m: 1500,
    contact: '+91 141 2560 291',
    hours: '08:00 - 22:00 (Daily)',
    source: 'Official PMBI Jan Aushadhi Kendra Directory'
  },
  {
    kind: 'pharmacy',
    name: 'Apollo Pharmacy - Green Park',
    address: 'Main Market, Green Park, New Delhi',
    lat: 28.5580,
    lng: 77.2060,
    distance_m: 2100,
    contact: '+91 11 4165 2200',
    hours: '24 Hours',
    source: 'OpenStreetMap Community Records'
  },
  {
    kind: 'hospital',
    name: 'Safdarjung Hospital OPD Dispensary',
    address: 'Ring Road, Opposite AIIMS, New Delhi',
    lat: 28.5680,
    lng: 77.2070,
    distance_m: 1400,
    contact: '+91 11 2616 5060',
    hours: '08:00 - 16:00 (Mon-Sat)',
    source: 'Government Health Facility Directory'
  }
];

export function getFixtureCities(): CityRecord[] {
  return DEV_FIXTURE_CITIES;
}

export function getFixtureStores(params: { city_id?: string; lat?: number; lng?: number }): StoreRecord[] {
  if (params.city_id === 'jaipur') {
    return DEV_FIXTURE_STORES.filter((s) => s.address?.includes('Jaipur'));
  }
  return DEV_FIXTURE_STORES;
}

export function getFixtureRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): RouteResponse {
  // Approximate midpoints for realistic polyline
  const midLat = (fromLat + toLat) / 2 + 0.002;
  const midLng = (fromLng + toLng) / 2 + 0.003;

  return {
    distance_m: 2450,
    duration_s: 480,
    profile: 'driving',
    provider: 'osrm',
    geometry_geojson: {
      type: 'LineString',
      coordinates: [
        [fromLng, fromLat],
        [midLng, midLat],
        [toLng, toLat]
      ]
    },
    steps: [
      { instruction: 'Head north on current road', distance_m: 450, duration_s: 90 },
      { instruction: 'Turn right onto Mahatma Gandhi Marg', distance_m: 1200, duration_s: 240 },
      { instruction: 'Turn left toward Jan Aushadhi Kendra entrance', distance_m: 800, duration_s: 150 }
    ]
  };
}
