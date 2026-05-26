// Service modul vendors. CRUD master toko/pasar tempat kasir belanja.
// Permission (per matrix REV 2.3): owner+kasir untuk CRUD dan view.
// Hard delete dilindungi FK ke purchases - kalau vendor sudah pernah dipakai,
// tolak dengan pesan ramah supaya owner/kasir bisa edit saja.

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  CreateVendorInput,
  UpdateVendorInput,
  ListVendorsQuery,
} from './vendors.schema';

// ============================================================
// View shape
// ============================================================

export interface VendorView {
  id: number;
  name: string;
  type: string;
  phone: string | null;
  note: string | null;
  purchaseCount: number; // jumlah purchase yang refer vendor ini (info untuk UI)
  createdAt: string;
  updatedAt: string;
}

type VendorWithPurchaseCount = Prisma.VendorGetPayload<{
  include: { _count: { select: { purchases: true } } };
}>;

function toVendorView(v: VendorWithPurchaseCount): VendorView {
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    phone: v.phone,
    note: v.note,
    purchaseCount: v._count.purchases,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

// ============================================================
// Operations
// ============================================================

export async function listVendors(query: ListVendorsQuery): Promise<VendorView[]> {
  const where: Prisma.VendorWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.search) where.name = { contains: query.search };

  const vendors = await prisma.vendor.findMany({
    where,
    include: { _count: { select: { purchases: true } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  return vendors.map(toVendorView);
}

export async function getVendorById(id: number): Promise<VendorView> {
  const v = await prisma.vendor.findUnique({
    where: { id },
    include: { _count: { select: { purchases: true } } },
  });
  if (!v) throw notFound('Vendor');
  return toVendorView(v);
}

export async function createVendor(input: CreateVendorInput): Promise<VendorView> {
  // Dedup name (sama strategi dengan RawMaterial - MySQL collation case-insensitive).
  const existing = await prisma.vendor.findFirst({ where: { name: input.name } });
  if (existing) {
    throw new AppError(`Vendor "${input.name}" sudah ada`, 409);
  }

  const created = await prisma.vendor.create({
    data: {
      name: input.name,
      type: input.type,
      phone: input.phone ?? null,
      note: input.note ?? null,
    },
    include: { _count: { select: { purchases: true } } },
  });
  return toVendorView(created);
}

export async function updateVendor(id: number, input: UpdateVendorInput): Promise<VendorView> {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw notFound('Vendor');

  const data: Prisma.VendorUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.type = input.type;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.note !== undefined) data.note = input.note;

  const updated = await prisma.vendor.update({
    where: { id },
    data,
    include: { _count: { select: { purchases: true } } },
  });
  return toVendorView(updated);
}

export async function deleteVendor(id: number): Promise<{ id: number; name: string }> {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) throw notFound('Vendor');

  const purchaseCount = await prisma.purchase.count({ where: { vendorId: id } });
  if (purchaseCount > 0) {
    throw new AppError(
      `Vendor "${existing.name}" tidak bisa dihapus - sudah dipakai di ${purchaseCount} purchase. Edit saja datanya.`,
      409,
    );
  }

  await prisma.vendor.delete({ where: { id } });
  return { id: existing.id, name: existing.name };
}
