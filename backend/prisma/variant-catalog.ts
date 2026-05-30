// REV 2.10 collapse spec — single source of truth for the menu-variant redesign.
// Consumed by BOTH `scripts/backfill-menu-variants.ts` (existing dev/prod DB) and
// `seed.ts` (fresh DB), so the variant catalog is identical either way.
//
// Concept (see docs/superpowers/specs/2026-05-30-menu-variants-stock-linkage-design.md):
//   - A VARIANT MENU is a display menu (kind=variant, posVisible=true, nonStock itself).
//     Its variants carry the exact price + a stockTarget (the existing portion SKU that
//     actually holds the count). Drinks have stockTarget=null (not tracked).
//   - The collapsed granular SKUs (e.g. "Paha Ayam Bakar") STAY in the DB as the stock
//     holders but get posVisible=false (hidden from the POS grid). History is preserved
//     (old transactions still reference them by id).
//   - A PAKET (kind=paket) is normalized from the legacy subOptions JSON into FK
//     components. Paket choice options reference a SPECIFIC menu (leaf) — drinks are
//     info-only (nonStock → no decrement), ayam/kuah point at the stock-holding SKU.
//
// Owner decisions locked 2026-05-30 (chat): Kecap/Merah NO LONGER share stock; Semur
// split by protein; Es Jeruk per-variant price; Tahu Tempe Goreng/Penyet collapsed.

export interface VariantOptionGroupSpec {
  name: string
  affectsVariant: boolean
  options: string[]
}

export interface VariantSpec {
  /** group name -> chosen option label, for affectsVariant=true groups only. */
  optionLabels: Record<string, string>
  price: number
  /** Existing menu name that holds the stock (portion SKU), or null for nonStock. */
  stockTargetName: string | null
  /**
   * REV 2.11 COGS: for nonStock variants whose modal genuinely differs per variant
   * (Es Teh per Rasa×Ukuran, Es Jeruk per Jenis, Tahu Tempe per Jenis), the existing
   * hidden leaf SKU whose `Menu.cost` represents this variant's cost. Resolved to
   * `costSourceMenuId` during backfill. Omit for stock-bearing variants (backend falls
   * back to `stockTargetMenuId`) and for uniform-modal variants (Telur/Sambal).
   */
  costSourceName?: string
}

export interface VariantMenuSpec {
  name: string
  category: string
  basePrice: number
  imageUrl?: string
  groups: VariantOptionGroupSpec[]
  variants: VariantSpec[]
  /** Existing menu names to hide from POS (posVisible=false) — the collapsed SKUs. */
  hides: string[]
}

export interface PaketComponentSpec {
  kind: 'fixed' | 'choice'
  label: string
  qty?: number // fixed only
  /** fixed: the menu it always includes. */
  targetName?: string
  /** choice: allowed options, each referencing a specific existing menu (leaf). */
  options?: { label: string; targetName: string }[]
}

export interface PaketSpec {
  /** Existing paket menu name to convert in place (kind -> paket). */
  name: string
  /** Optional price correction (Paket D -> 38000 per owner doc edit). */
  price?: number
  components: PaketComponentSpec[]
}

/**
 * Menus whose stockType must become `portion` with a fresh PortionStock created
 * during backfill (they previously had no own stock). Merah/Kecap split.
 * initialQty=0 → owner sets the real count via opname/restock.
 */
export const NEW_PORTION_SKUS: { name: string; minStock: number; initialQty: number }[] = [
  { name: '1 Ekor Ayam Bakar Kecap', minStock: 2, initialQty: 0 },
]

export const VARIANT_MENUS: VariantMenuSpec[] = [
  // ---- Minuman: Es Teh (Rasa × Ukuran; Suhu free) — non-additive grid 8/10/12/15 ----
  {
    name: 'Es Teh',
    category: 'Minuman',
    basePrice: 8000,
    imageUrl: '/menu/es-teh.webp',
    groups: [
      { name: 'Rasa', affectsVariant: true, options: ['Tawar', 'Manis'] },
      { name: 'Ukuran', affectsVariant: true, options: ['Biasa', 'Jumbo'] },
      { name: 'Suhu', affectsVariant: false, options: ['Dingin', 'Panas'] },
    ],
    variants: [
      { optionLabels: { Rasa: 'Tawar', Ukuran: 'Biasa' }, price: 8000, stockTargetName: null, costSourceName: 'Teh Tawar Biasa' },
      { optionLabels: { Rasa: 'Manis', Ukuran: 'Biasa' }, price: 10000, stockTargetName: null, costSourceName: 'Teh Manis Biasa' },
      { optionLabels: { Rasa: 'Tawar', Ukuran: 'Jumbo' }, price: 12000, stockTargetName: null, costSourceName: 'Teh Tawar Jumbo' },
      { optionLabels: { Rasa: 'Manis', Ukuran: 'Jumbo' }, price: 15000, stockTargetName: null, costSourceName: 'Teh Manis Jumbo' },
    ],
    hides: ['Teh Tawar Biasa', 'Teh Manis Biasa', 'Teh Tawar Jumbo', 'Teh Manis Jumbo'],
  },
  // ---- Es Jeruk (Jenis) — per-variant price ----
  {
    name: 'Es Jeruk',
    category: 'Minuman',
    basePrice: 10000,
    imageUrl: '/menu/es-jeruk-peras.webp',
    groups: [{ name: 'Jenis', affectsVariant: true, options: ['Nipis', 'Peras', 'Murni'] }],
    variants: [
      { optionLabels: { Jenis: 'Nipis' }, price: 10000, stockTargetName: null, costSourceName: 'Jeruk Nipis' },
      { optionLabels: { Jenis: 'Peras' }, price: 15000, stockTargetName: null, costSourceName: 'Jeruk Peras' },
      { optionLabels: { Jenis: 'Murni' }, price: 25000, stockTargetName: null, costSourceName: 'Jeruk Murni' },
    ],
    hides: ['Jeruk Nipis', 'Jeruk Peras', 'Jeruk Murni'],
  },
  // ---- Ayam Potong (Bagian × Cara Masak), flat 30k, 4 portion targets ----
  {
    name: 'Ayam Potong',
    category: 'Signature Ayam Bakar',
    basePrice: 30000,
    imageUrl: '/menu/paha-bakar.webp',
    groups: [
      { name: 'Bagian', affectsVariant: true, options: ['Paha', 'Dada'] },
      { name: 'Cara Masak', affectsVariant: true, options: ['Bakar', 'Goreng'] },
    ],
    variants: [
      { optionLabels: { Bagian: 'Paha', 'Cara Masak': 'Bakar' }, price: 30000, stockTargetName: 'Paha Ayam Bakar' },
      { optionLabels: { Bagian: 'Paha', 'Cara Masak': 'Goreng' }, price: 30000, stockTargetName: 'Paha Ayam Goreng' },
      { optionLabels: { Bagian: 'Dada', 'Cara Masak': 'Bakar' }, price: 30000, stockTargetName: 'Dada Ayam Bakar' },
      { optionLabels: { Bagian: 'Dada', 'Cara Masak': 'Goreng' }, price: 30000, stockTargetName: 'Dada Ayam Goreng' },
    ],
    hides: ['Paha Ayam Bakar', 'Paha Ayam Goreng', 'Dada Ayam Bakar', 'Dada Ayam Goreng'],
  },
  // ---- 1 Ekor Ayam (Cara Masak), flat 120k, 3 SEPARATE portion targets (Kecap own stock) ----
  {
    name: '1 Ekor Ayam',
    category: 'Signature Ayam Bakar',
    basePrice: 120000,
    imageUrl: '/menu/ayam-bakar-1-ekor.webp',
    groups: [{ name: 'Cara Masak', affectsVariant: true, options: ['Bakar Merah', 'Bakar Kecap', 'Goreng'] }],
    variants: [
      { optionLabels: { 'Cara Masak': 'Bakar Merah' }, price: 120000, stockTargetName: '1 Ekor Ayam Bakar Merah' },
      { optionLabels: { 'Cara Masak': 'Bakar Kecap' }, price: 120000, stockTargetName: '1 Ekor Ayam Bakar Kecap' },
      { optionLabels: { 'Cara Masak': 'Goreng' }, price: 120000, stockTargetName: '1 Ekor Ayam Goreng' },
    ],
    hides: ['1 Ekor Ayam Bakar Merah', '1 Ekor Ayam Bakar Kecap', '1 Ekor Ayam Goreng'],
  },
  // ---- Gurame (Cara Masak), 100k ----
  {
    name: 'Gurame',
    category: 'Seafood',
    basePrice: 100000,
    imageUrl: '/menu/gurami-bakar.webp',
    groups: [{ name: 'Cara Masak', affectsVariant: true, options: ['Bakar', 'Goreng'] }],
    variants: [
      { optionLabels: { 'Cara Masak': 'Bakar' }, price: 100000, stockTargetName: 'Gurame Bakar' },
      { optionLabels: { 'Cara Masak': 'Goreng' }, price: 100000, stockTargetName: 'Gurame Goreng' },
    ],
    hides: ['Gurame Bakar', 'Gurame Goreng'],
  },
  // ---- Udang Windu (Cara Masak), 150k ----
  {
    name: 'Udang Windu (isi 7)',
    category: 'Seafood',
    basePrice: 150000,
    imageUrl: '/menu/udang-bakar.webp',
    groups: [{ name: 'Cara Masak', affectsVariant: true, options: ['Bakar', 'Goreng'] }],
    variants: [
      { optionLabels: { 'Cara Masak': 'Bakar' }, price: 150000, stockTargetName: 'Udang Windu Bakar (isi 7)' },
      { optionLabels: { 'Cara Masak': 'Goreng' }, price: 150000, stockTargetName: 'Udang Windu Goreng (isi 7)' },
    ],
    hides: ['Udang Windu Bakar (isi 7)', 'Udang Windu Goreng (isi 7)'],
  },
  // ---- Garang Asem (Protein), 30k, separate stock per protein ----
  {
    name: 'Garang Asem',
    category: 'Sayur & Sup',
    basePrice: 30000,
    imageUrl: '/menu/garang-asem.webp',
    groups: [{ name: 'Protein', affectsVariant: true, options: ['Ayam', 'Daging'] }],
    variants: [
      { optionLabels: { Protein: 'Ayam' }, price: 30000, stockTargetName: 'Garang Asem Ayam' },
      { optionLabels: { Protein: 'Daging' }, price: 30000, stockTargetName: 'Garang Asem Daging' },
    ],
    hides: ['Garang Asem Ayam', 'Garang Asem Daging'],
  },
  // ---- Gulai (Isi), 30k ----
  {
    name: 'Gulai',
    category: 'Sayur & Sup',
    basePrice: 30000,
    imageUrl: '/menu/gulai.webp',
    groups: [{ name: 'Isi', affectsVariant: true, options: ['Daging', 'Babat'] }],
    variants: [
      { optionLabels: { Isi: 'Daging' }, price: 30000, stockTargetName: 'Gulai Daging' },
      { optionLabels: { Isi: 'Babat' }, price: 30000, stockTargetName: 'Gulai Babat' },
    ],
    hides: ['Gulai Daging', 'Gulai Babat'],
  },
  // ---- Semur (Protein), 30k, separate stock per protein ----
  {
    name: 'Semur',
    category: 'Sayur & Sup',
    basePrice: 30000,
    imageUrl: '/menu/semur-daging.webp',
    groups: [{ name: 'Protein', affectsVariant: true, options: ['Daging', 'Ayam'] }],
    variants: [
      { optionLabels: { Protein: 'Daging' }, price: 30000, stockTargetName: 'Semur Daging' },
      { optionLabels: { Protein: 'Ayam' }, price: 30000, stockTargetName: 'Semur Ayam' },
    ],
    hides: ['Semur Daging', 'Semur Ayam'],
  },
  // ---- Tahu Tempe (Jenis), per-variant 12k/20k, nonStock ----
  {
    name: 'Tahu Tempe',
    category: 'Side Dish',
    basePrice: 12000,
    imageUrl: '/menu/tahu-tempe.webp',
    groups: [{ name: 'Jenis', affectsVariant: true, options: ['Goreng', 'Penyet'] }],
    variants: [
      { optionLabels: { Jenis: 'Goreng' }, price: 12000, stockTargetName: null, costSourceName: 'Tahu Tempe Goreng' },
      { optionLabels: { Jenis: 'Penyet' }, price: 20000, stockTargetName: null, costSourceName: 'Tahu Tempe Penyet' },
    ],
    hides: ['Tahu Tempe Goreng', 'Tahu Tempe Penyet'],
  },
  // ---- Telur (Jenis), 10k, nonStock ----
  {
    name: 'Telur',
    category: 'Side Dish',
    basePrice: 10000,
    imageUrl: '/menu/telur.webp',
    groups: [{ name: 'Jenis', affectsVariant: true, options: ['Mata Sapi', 'Dadar'] }],
    variants: [
      { optionLabels: { Jenis: 'Mata Sapi' }, price: 10000, stockTargetName: null },
      { optionLabels: { Jenis: 'Dadar' }, price: 10000, stockTargetName: null },
    ],
    hides: ['Telur Mata Sapi', 'Telur Dadar'],
  },
  // ---- Sambal (Jenis), 5k, nonStock ----
  {
    name: 'Sambal',
    category: 'Side Dish',
    basePrice: 5000,
    imageUrl: '/menu/sambal.webp',
    groups: [{ name: 'Jenis', affectsVariant: true, options: ['Terasi', 'Tomat'] }],
    variants: [
      { optionLabels: { Jenis: 'Terasi' }, price: 5000, stockTargetName: null },
      { optionLabels: { Jenis: 'Tomat' }, price: 5000, stockTargetName: null },
    ],
    hides: ['Sambal Terasi', 'Sambal Tomat'],
  },
  // ---- Kerupuk (Jenis), per-variant 7k/15k, portion ----
  // NOTE: display name "Kerupuk" clashes with the hidden Biasa SKU "Kerupuk". The
  // backfill MUST resolve the stock-target ids by name BEFORE creating this display
  // menu (so the lookup is unambiguous), then hide the old SKUs.
  {
    name: 'Kerupuk',
    category: 'Side Dish',
    basePrice: 7000,
    imageUrl: '/menu/sambal.webp',
    groups: [{ name: 'Jenis', affectsVariant: true, options: ['Biasa', 'Udang'] }],
    variants: [
      { optionLabels: { Jenis: 'Biasa' }, price: 7000, stockTargetName: 'Kerupuk' },
      { optionLabels: { Jenis: 'Udang' }, price: 15000, stockTargetName: 'Kerupuk Udang' },
    ],
    hides: ['Kerupuk', 'Kerupuk Udang'],
  },
]

// Drink label -> existing (now-hidden) menu name, for paket info-only drink choices.
const TEH_TAWAR = 'Teh Tawar Biasa'
const TEH_MANIS = 'Teh Manis Biasa'
const AIR = 'Air Mineral'

export const PAKET_SPECS: PaketSpec[] = [
  {
    name: 'Paket Keluarga (3-4 org)',
    components: [
      { kind: 'fixed', label: 'Nasi Putih', qty: 4, targetName: 'Nasi Putih' },
      {
        kind: 'choice',
        label: 'Pilih Ayam',
        options: [
          { label: 'Bakar', targetName: '1 Ekor Ayam Bakar Merah' },
          { label: 'Goreng', targetName: '1 Ekor Ayam Goreng' },
        ],
      },
      {
        kind: 'choice',
        label: 'Pilih Minuman',
        options: [
          { label: 'Teh Tawar', targetName: TEH_TAWAR },
          { label: 'Teh Manis', targetName: TEH_MANIS },
          { label: 'Air Mineral', targetName: AIR },
        ],
      },
    ],
  },
  {
    name: 'Paket A (1 org)',
    components: [
      { kind: 'fixed', label: 'Nasi Putih', qty: 1, targetName: 'Nasi Putih' },
      { kind: 'fixed', label: 'Tahu Tempe', qty: 1, targetName: 'Tahu Tempe Goreng' },
      { kind: 'fixed', label: 'Sayur Asem', qty: 1, targetName: 'Sayur Asem' },
      {
        kind: 'choice',
        label: 'Pilih Ayam',
        options: [
          { label: 'Paha Bakar', targetName: 'Paha Ayam Bakar' },
          { label: 'Paha Goreng', targetName: 'Paha Ayam Goreng' },
          { label: 'Dada Bakar', targetName: 'Dada Ayam Bakar' },
          { label: 'Dada Goreng', targetName: 'Dada Ayam Goreng' },
        ],
      },
      {
        kind: 'choice',
        label: 'Pilih Minuman',
        options: [
          { label: 'Teh Tawar', targetName: TEH_TAWAR },
          { label: 'Teh Manis', targetName: TEH_MANIS },
        ],
      },
    ],
  },
  {
    name: 'Paket B (1 org)',
    components: [
      { kind: 'fixed', label: 'Nasi Putih', qty: 1, targetName: 'Nasi Putih' },
      { kind: 'fixed', label: 'Tahu Tempe', qty: 1, targetName: 'Tahu Tempe Goreng' },
      {
        kind: 'choice',
        label: 'Pilih Ayam',
        options: [
          { label: 'Paha Bakar', targetName: 'Paha Ayam Bakar' },
          { label: 'Paha Goreng', targetName: 'Paha Ayam Goreng' },
          { label: 'Dada Bakar', targetName: 'Dada Ayam Bakar' },
          { label: 'Dada Goreng', targetName: 'Dada Ayam Goreng' },
        ],
      },
    ],
  },
  {
    name: 'Paket C (1 org)',
    components: [
      { kind: 'fixed', label: 'Nasi Putih', qty: 1, targetName: 'Nasi Putih' },
      {
        kind: 'choice',
        label: 'Pilih Kuah',
        options: [
          { label: 'Rawon', targetName: 'Rawon Daging' },
          { label: 'Gulai', targetName: 'Gulai Daging' },
          { label: 'Garang Asem', targetName: 'Garang Asem Ayam' },
          { label: 'Bakwan Penyet', targetName: 'Bakwan Penyet' },
          { label: 'Semur', targetName: 'Semur Daging' },
        ],
      },
      {
        kind: 'choice',
        label: 'Pilih Minuman',
        options: [
          { label: 'Teh Tawar', targetName: TEH_TAWAR },
          { label: 'Teh Manis', targetName: TEH_MANIS },
          { label: 'Air Mineral', targetName: AIR },
        ],
      },
    ],
  },
  {
    name: 'Paket D (1 org)',
    price: 38000, // owner doc correction
    components: [
      { kind: 'fixed', label: 'Nasi Putih', qty: 1, targetName: 'Nasi Putih' },
      { kind: 'fixed', label: 'Empal Penyet', qty: 1, targetName: 'Empal Penyet' },
      {
        kind: 'choice',
        label: 'Pilih Minuman',
        options: [
          { label: 'Teh Tawar', targetName: TEH_TAWAR },
          { label: 'Teh Manis', targetName: TEH_MANIS },
          { label: 'Air Mineral', targetName: AIR },
        ],
      },
    ],
  },
]
