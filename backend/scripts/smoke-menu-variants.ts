// Integration smoke REV 2.10 — variant/paket CRUD via upsertMenu + listMenus.
// WAJIB DB *_test. Jalankan:
//   npx tsx --env-file=.env.test scripts/smoke-menu-variants.ts
import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { upsertMenu, listMenus, getMenuDetail } from '../src/modules/menus/menus.service';
import type { MenuUpsertInput } from '../src/modules/menus/menus.schema';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0;
let fail = 0;
const ok = (c: boolean, m: string) => {
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));
};

// Track menu ids dibuat agar cleanup re-runnable.
const createdMenuIds: number[] = [];
async function makeMenu(input: MenuUpsertInput) {
  const m = await upsertMenu(null, input);
  createdMenuIds.push(m.id);
  return m;
}

async function cleanup() {
  // Hapus dalam urutan aman: paket dulu (refer menu lain), lalu variant menu, lalu simple.
  // deleteMany cascade akan beresi optionGroups/variants/paketComponents + child-nya.
  // Restrict FK pada stockTargetMenuId / paket targetMenuId → hapus paket/variant
  // sebelum target. Karena kita simpan urutan create, hapus reverse.
  for (const id of [...createdMenuIds].reverse()) {
    await prisma.menu.deleteMany({ where: { id } }).catch(() => {});
  }
  createdMenuIds.length = 0;
}

async function main() {
  console.log(`[smoke-menu-variants] DB=${process.env.DATABASE_URL?.split('/').pop()}`);

  // ----------------------------------------------------------------
  console.log('\n[1] Buat menu varian "Es Teh" (3 grup, 4 varian):');
  const esTeh = await makeMenu({
    name: 'SMOKE Es Teh',
    category: 'Minuman',
    price: 8000,
    kind: 'variant',
    posVisible: true,
    stockType: 'nonStock',
    optionGroups: [
      {
        name: 'Rasa',
        affectsVariant: true,
        displayOrder: 0,
        options: [
          { label: 'Tawar', displayOrder: 0 },
          { label: 'Manis', displayOrder: 1 },
        ],
      },
      {
        name: 'Ukuran',
        affectsVariant: true,
        displayOrder: 1,
        options: [
          { label: 'Biasa', displayOrder: 0 },
          { label: 'Jumbo', displayOrder: 1 },
        ],
      },
      {
        name: 'Suhu',
        affectsVariant: false,
        displayOrder: 2,
        options: [
          { label: 'Dingin', displayOrder: 0 },
          { label: 'Panas', displayOrder: 1 },
        ],
      },
    ],
    variants: [
      { optionLabels: { Rasa: 'Tawar', Ukuran: 'Biasa' }, label: 'Tawar Biasa', price: 8000, stockTargetMenuId: null, isActive: true, displayOrder: 0 },
      { optionLabels: { Rasa: 'Tawar', Ukuran: 'Jumbo' }, label: 'Tawar Jumbo', price: 10000, stockTargetMenuId: null, isActive: true, displayOrder: 1 },
      { optionLabels: { Rasa: 'Manis', Ukuran: 'Biasa' }, label: 'Manis Biasa', price: 12000, stockTargetMenuId: null, isActive: true, displayOrder: 2 },
      { optionLabels: { Rasa: 'Manis', Ukuran: 'Jumbo' }, label: 'Manis Jumbo', price: 15000, stockTargetMenuId: null, isActive: true, displayOrder: 3 },
    ],
    paketComponents: [],
  });
  ok(esTeh.variants.length === 4, `4 varian persisted (got ${esTeh.variants.length})`);
  const suhuGroup = esTeh.optionGroups.find((g) => g.name === 'Suhu');
  ok(!!suhuGroup && suhuGroup.affectsVariant === false, 'Grup Suhu ada dengan affectsVariant=false');
  // Kumpulkan optionId milik grup Suhu, pastikan tidak ada variant yang menautkannya.
  const suhuOptionIds = new Set(suhuGroup?.options.map((o) => o.id) ?? []);
  const anyVariantLinksSuhu = esTeh.variants.some((v) => v.optionIds.some((oid) => suhuOptionIds.has(oid)));
  ok(!anyVariantLinksSuhu, 'TIDAK ada varian yang menautkan opsi Suhu (free-preference tidak membentuk varian)');
  // Tiap varian harus link tepat 2 opsi (Rasa + Ukuran).
  ok(esTeh.variants.every((v) => v.optionIds.length === 2), 'Tiap varian menautkan tepat 2 opsi (Rasa + Ukuran)');

  // ----------------------------------------------------------------
  console.log('\n[2] Varian dengan stockTargetMenuId menunjuk menu porsi:');
  const pahaBakar = await makeMenu({
    name: 'SMOKE Test Paha Bakar',
    category: 'Ayam',
    price: 12000,
    kind: 'simple',
    posVisible: true,
    stockType: 'portion',
    minStock: 5,
    optionGroups: [],
    variants: [],
    paketComponents: [],
  });
  ok(pahaBakar.portionStock !== null && pahaBakar.portionStock.minStock === 5, 'Menu porsi punya PortionStock minStock=5');

  const ayamPotong = await makeMenu({
    name: 'SMOKE Ayam Potong',
    category: 'Ayam',
    price: 12000,
    kind: 'variant',
    posVisible: true,
    stockType: 'nonStock',
    optionGroups: [
      { name: 'Bagian', affectsVariant: true, displayOrder: 0, options: [{ label: 'Paha', displayOrder: 0 }] },
    ],
    variants: [
      { optionLabels: { Bagian: 'Paha' }, label: 'Paha Bakar', price: 12000, stockTargetMenuId: pahaBakar.id, isActive: true, displayOrder: 0 },
    ],
    paketComponents: [],
  });
  ok(ayamPotong.variants[0]?.stockTargetMenuId === pahaBakar.id, `Varian stockTargetMenuId = menu porsi (#${pahaBakar.id})`);

  // ----------------------------------------------------------------
  console.log('\n[3] Buat Paket (1 fixed + 1 choice dengan 2 opsi):');
  const airMineral = await makeMenu({
    name: 'SMOKE Air Mineral',
    category: 'Minuman',
    price: 5000,
    kind: 'simple',
    posVisible: true,
    stockType: 'nonStock',
    optionGroups: [],
    variants: [],
    paketComponents: [],
  });
  const paket = await makeMenu({
    name: 'SMOKE Paket Hemat',
    category: 'Paket',
    price: 25000,
    kind: 'paket',
    posVisible: true,
    stockType: 'nonStock',
    optionGroups: [],
    variants: [],
    paketComponents: [
      { kind: 'fixed', label: 'Nasi + Ayam', qty: 2, displayOrder: 0, targetMenuId: pahaBakar.id, targetVariantId: null, choiceOptions: [] },
      {
        kind: 'choice',
        label: 'Minuman',
        qty: 1,
        displayOrder: 1,
        targetMenuId: null,
        targetVariantId: null,
        choiceOptions: [
          { label: 'Es Teh', targetMenuId: esTeh.id, targetVariantId: null, upcharge: 0 },
          { label: 'Air Mineral', targetMenuId: airMineral.id, targetVariantId: null, upcharge: 0 },
        ],
      },
    ],
  });
  const fixedComps = paket.paketComponents.filter((c) => c.kind === 'fixed');
  const choiceComps = paket.paketComponents.filter((c) => c.kind === 'choice');
  ok(fixedComps.length === 1 && fixedComps[0]?.qty === 2, `1 komponen fixed qty=2 (got ${fixedComps.length})`);
  ok(choiceComps.length === 1 && choiceComps[0]?.choiceOptions.length === 2, `1 komponen choice dengan 2 opsi (got ${choiceComps[0]?.choiceOptions.length})`);

  // ----------------------------------------------------------------
  console.log('\n[4] Update Es Teh: rename grup "Rasa" -> "Rasa Teh" (replace-children):');
  await upsertMenu(esTeh.id, {
    name: 'SMOKE Es Teh',
    category: 'Minuman',
    price: 8000,
    kind: 'variant',
    posVisible: true,
    stockType: 'nonStock',
    optionGroups: [
      { name: 'Rasa Teh', affectsVariant: true, displayOrder: 0, options: [{ label: 'Tawar', displayOrder: 0 }, { label: 'Manis', displayOrder: 1 }] },
      { name: 'Ukuran', affectsVariant: true, displayOrder: 1, options: [{ label: 'Biasa', displayOrder: 0 }, { label: 'Jumbo', displayOrder: 1 }] },
      { name: 'Suhu', affectsVariant: false, displayOrder: 2, options: [{ label: 'Dingin', displayOrder: 0 }, { label: 'Panas', displayOrder: 1 }] },
    ],
    variants: [
      { optionLabels: { 'Rasa Teh': 'Tawar', Ukuran: 'Biasa' }, label: 'Tawar Biasa', price: 8000, stockTargetMenuId: null, isActive: true, displayOrder: 0 },
      { optionLabels: { 'Rasa Teh': 'Tawar', Ukuran: 'Jumbo' }, label: 'Tawar Jumbo', price: 10000, stockTargetMenuId: null, isActive: true, displayOrder: 1 },
      { optionLabels: { 'Rasa Teh': 'Manis', Ukuran: 'Biasa' }, label: 'Manis Biasa', price: 12000, stockTargetMenuId: null, isActive: true, displayOrder: 2 },
      { optionLabels: { 'Rasa Teh': 'Manis', Ukuran: 'Jumbo' }, label: 'Manis Jumbo', price: 15000, stockTargetMenuId: null, isActive: true, displayOrder: 3 },
    ],
    paketComponents: [],
  });
  const esTehAfter = await getMenuDetail(esTeh.id);
  ok(esTehAfter.variants.length === 4, `Masih 4 varian setelah update (got ${esTehAfter.variants.length})`);
  ok(esTehAfter.optionGroups.some((g) => g.name === 'Rasa Teh'), 'Grup di-rename jadi "Rasa Teh"');
  ok(!esTehAfter.optionGroups.some((g) => g.name === 'Rasa'), 'Grup lama "Rasa" tidak tersisa (no orphan)');
  // Verifikasi tidak ada orphan group/option di DB untuk menu ini.
  const groupCount = await prisma.menuOptionGroup.count({ where: { menuId: esTeh.id } });
  ok(groupCount === 3, `Tepat 3 option group di DB (got ${groupCount}, no duplikat dari update)`);

  // ----------------------------------------------------------------
  console.log('\n[5] listMenus POS mode sembunyikan posVisible=false; owner mode include:');
  const hidden = await makeMenu({
    name: 'SMOKE Hidden SKU',
    category: 'Ayam',
    price: 0,
    kind: 'simple',
    posVisible: false,
    stockType: 'portion',
    minStock: 0,
    optionGroups: [],
    variants: [],
    paketComponents: [],
  });
  const posList = await listMenus({ activeOnly: true, includeHidden: false, includePopularity: false } as Parameters<typeof listMenus>[0]);
  ok(!posList.some((m) => m.id === hidden.id), 'POS/public list TIDAK memuat menu posVisible=false');
  const ownerList = await listMenus({ activeOnly: true, includeHidden: true, includePopularity: false } as Parameters<typeof listMenus>[0]);
  ok(ownerList.some((m) => m.id === hidden.id), 'Owner/includeHidden list MEMUAT menu posVisible=false');

  console.log(`\n[smoke-menu-variants] HASIL: ${pass} pass, ${fail} fail`);
}

main()
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
    if (fail > 0) process.exit(1);
  })
  .catch(async (e) => {
    console.error('[smoke-menu-variants] ERROR', e);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
