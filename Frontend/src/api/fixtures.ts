/**
 * AushadhAi Development Fixtures
 * STRICT REQUIREMENT: Only used in development when backend is unreachable.
 * Never presented as live verified server data without dev fixture indicator.
 */

import type {
  CompareRequest,
  CompareResponse,
  PublicCatalogueResponse,
  SearchResponse
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
