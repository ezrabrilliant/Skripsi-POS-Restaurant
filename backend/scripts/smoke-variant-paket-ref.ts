// Integration smoke: edit a VARIANT menu whose variants are referenced by a PAKET
// (paket_choice_options.target_variant_id, onDelete: Restrict).
//
// Reproduces the bug: upsertMenu replace-children does `menuVariant.deleteMany`,
// which MySQL rejects (FK target_variant_id) → 500. After the in-place reconcile
// fix, a key-stable edit must SUCCEED, preserve variant IDs, and keep paket links.
//
// WAJIB DB *_test. Jalankan:
//   npx tsx --env-file=.env.test scripts/smoke-variant-paket-ref.ts
import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { upsertMenu, getMenuDetail } from '../src/modules/menus/menus.service';
import type { MenuUpsertInput } from '../src/modules/menus/menus.schema';
import { AppError } from '../src/utils/errors';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0;
let fail = 0;
const ok = (c: boolean, m: string) => {
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));
};

const createdMenuIds: number[] = [];
let smokeUserId = 0;
async function makeMenu(input: MenuUpsertInput) {
  const m = await upsertMenu(null, input, smokeUserId);
  createdMenuIds.push(m.id);
  return m;
}

async function cleanup() {
  for (const id of [...createdMenuIds].reverse()) {
    await prisma.menu.deleteMany({ where: { id } }).catch(() => {});
  }
  createdMenuIds.length = 0;
}

// Base payload for the "Teh" variant menu (4 variants: Rasa × Ukuran).
function tehInput(overrides?: Partial<MenuUpsertInput>): MenuUpsertInput {
  return {
    name: 'SMOKE Teh',
    category: 'Minuman',
    price: 5000,
    kind: 'variant',
    posVisible: true,
    stockType: 'nonStock',
    optionGroups: [
      { name: 'Rasa', affectsVariant: true, displayOrder: 0, options: [{ label: 'Tawar', displayOrder: 0 }, { label: 'Manis', displayOrder: 1 }] },
      { name: 'Ukuran', affectsVariant: true, displayOrder: 1, options: [{ label: 'Biasa', displayOrder: 0 }, { label: 'Jumbo', displayOrder: 1 }] },
    ],
    variants: [
      { optionLabels: { Rasa: 'Tawar', Ukuran: 'Biasa' }, label: 'Tawar / Biasa', price: 5000, stockTargetMenuId: null, costSourceMenuId: null, isActive: true, displayOrder: 0 },
      { optionLabels: { Rasa: 'Tawar', Ukuran: 'Jumbo' }, label: 'Tawar / Jumbo', price: 8000, stockTargetMenuId: null, costSourceMenuId: null, isActive: true, displayOrder: 1 },
      { optionLabels: { Rasa: 'Manis', Ukuran: 'Biasa' }, label: 'Manis / Biasa', price: 6000, stockTargetMenuId: null, costSourceMenuId: null, isActive: true, displayOrder: 2 },
      { optionLabels: { Rasa: 'Manis', Ukuran: 'Jumbo' }, label: 'Manis / Jumbo', price: 9000, stockTargetMenuId: null, costSourceMenuId: null, isActive: true, displayOrder: 3 },
    ],
    paketComponents: [],
    ...overrides,
  };
}

async function main() {
  console.log(`[smoke-variant-paket-ref] DB=${process.env.DATABASE_URL?.split('/').pop()}`);

  const existingOwner = await prisma.user.findFirst({ where: { role: 'owner' } });
  smokeUserId = existingOwner
    ? existingOwner.id
    : (await prisma.user.create({ data: { name: 'SMOKE Owner', pin: '000000', role: 'owner' } })).id;

  // [1] Buat variant menu "Teh" + capture variant IDs.
  console.log('\n[1] Buat variant menu Teh (4 varian):');
  const teh = await makeMenu(tehInput());
  ok(teh.variants.length === 4, `4 varian persisted (got ${teh.variants.length})`);
  const idByLabel = new Map(teh.variants.map((v) => [v.label, v.id]));
  const tawarBiasaId = idByLabel.get('Tawar / Biasa')!;
  const manisBiasaId = idByLabel.get('Manis / Biasa')!;
  ok(!!tawarBiasaId && !!manisBiasaId, 'variant IDs captured');

  // [2] Buat paket yang choice-option-nya menunjuk variant Teh (targetVariantId).
  console.log('\n[2] Buat Paket yang refer variant Teh via targetVariantId:');
  const paket = await makeMenu({
    name: 'SMOKE Paket Ref', category: 'Paket', price: 20000, kind: 'paket',
    posVisible: true, stockType: 'nonStock', optionGroups: [], variants: [],
    paketComponents: [
      {
        kind: 'choice', label: 'Minuman', qty: 1, displayOrder: 0, targetMenuId: null, targetVariantId: null,
        choiceOptions: [
          { label: 'Teh Tawar', targetMenuId: teh.id, targetVariantId: tawarBiasaId, upcharge: 0 },
          { label: 'Teh Manis', targetMenuId: teh.id, targetVariantId: manisBiasaId, upcharge: 0 },
        ],
      },
    ],
  });
  const refCount = await prisma.paketChoiceOption.count({ where: { targetVariantId: { in: [tawarBiasaId, manisBiasaId] } } });
  ok(refCount === 2, `2 paket choice options refer Teh variants (got ${refCount})`);

  // [3] CORE: key-stable edit (ubah harga) Teh → harus SUKSES, BUKAN 500.
  console.log('\n[3] Edit harga Teh (key-stable) — harus sukses tanpa FK error:');
  let editOk = false;
  try {
    await upsertMenu(teh.id, tehInput({
      price: 5500,
      variants: tehInput().variants.map((v) => ({ ...v, price: v.price + 500 })),
    }), smokeUserId);
    editOk = true;
  } catch (e) {
    console.log(`  (edit threw: ${(e as Error).message.split('\n')[0]})`);
  }
  ok(editOk, 'Edit variant menu yang dipakai paket TIDAK melempar error');

  // [4] Variant IDs preserved + paket links intact + harga ter-update.
  const tehAfter = await getMenuDetail(teh.id);
  const idByLabelAfter = new Map(tehAfter.variants.map((v) => [v.label, v.id]));
  ok(idByLabelAfter.get('Tawar / Biasa') === tawarBiasaId, `variant "Tawar / Biasa" ID preserved (${tawarBiasaId})`);
  ok(idByLabelAfter.get('Manis / Biasa') === manisBiasaId, `variant "Manis / Biasa" ID preserved (${manisBiasaId})`);
  ok(tehAfter.variants.length === 4, `masih 4 varian (got ${tehAfter.variants.length})`);
  const tawarBiasaAfter = tehAfter.variants.find((v) => v.id === tawarBiasaId);
  ok(Number(tawarBiasaAfter?.price) === 5500, `harga varian ter-update (got ${tawarBiasaAfter?.price})`);
  const refCountAfter = await prisma.paketChoiceOption.count({ where: { targetVariantId: { in: [tawarBiasaId, manisBiasaId] } } });
  ok(refCountAfter === 2, `paket links masih utuh setelah edit (got ${refCountAfter})`);
  // tepat 4 variant row di DB (no orphan/duplikat dari recreate).
  const variantRowCount = await prisma.menuVariant.count({ where: { menuId: teh.id } });
  ok(variantRowCount === 4, `tepat 4 variant row di DB, no duplikat (got ${variantRowCount})`);

  // [5] Tambah varian baru saat ada paket ref → varian lama tetap, varian baru dibuat.
  console.log('\n[5] Tambah varian baru (Hangat) — varian lama ID tetap:');
  const withExtra = tehInput();
  withExtra.optionGroups[1].options.push({ label: 'Hangat', displayOrder: 2 });
  withExtra.variants.push(
    { optionLabels: { Rasa: 'Tawar', Ukuran: 'Hangat' }, label: 'Tawar / Hangat', price: 6000, stockTargetMenuId: null, costSourceMenuId: null, isActive: true, displayOrder: 4 },
  );
  await upsertMenu(teh.id, withExtra, smokeUserId);
  const tehAfter2 = await getMenuDetail(teh.id);
  ok(tehAfter2.variants.length === 5, `5 varian setelah tambah (got ${tehAfter2.variants.length})`);
  ok(new Map(tehAfter2.variants.map((v) => [v.label, v.id])).get('Tawar / Biasa') === tawarBiasaId, 'ID varian lama tetap saat tambah varian baru');

  // [6] Hapus varian yang DIPAKAI paket → AppError 400 ramah (bukan 500 FK).
  console.log('\n[6] Hapus varian yang dipakai paket → 400 ramah:');
  const dropReferenced = tehInput();
  // buang varian "Tawar / Biasa" (dipakai paket) dari payload.
  dropReferenced.variants = dropReferenced.variants.filter((v) => v.label !== 'Tawar / Biasa');
  let got400 = false;
  let errMsg = '';
  try {
    await upsertMenu(teh.id, dropReferenced, smokeUserId);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 400) got400 = true;
    errMsg = (e as Error).message.split('\n')[0];
  }
  ok(got400, `Hapus varian referenced → AppError 400 (got: ${errMsg || 'no error'})`);
  // varian masih ada (rollback transaksi).
  const stillThere = await prisma.menuVariant.count({ where: { id: tawarBiasaId } });
  ok(stillThere === 1, 'Varian referenced TIDAK terhapus (transaksi rollback)');

  console.log(`\n[smoke-variant-paket-ref] HASIL: ${pass} pass, ${fail} fail`);
}

main()
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
    if (fail > 0) process.exit(1);
  })
  .catch(async (e) => {
    console.error('[smoke-variant-paket-ref] ERROR', e);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
