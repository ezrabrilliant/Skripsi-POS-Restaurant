// Service modul units. CRUD master satuan untuk raw materials (REV 2.5).
// Pre-seeded di seed.ts. Owner dapat add/edit/delete unit baru.
// Delete diblock kalau ada raw_materials yang merefer (FK protection, pesan ramah).

import { OpnameMode, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateUnitInput, UpdateUnitInput } from './units.schema';

// ============================================================
// View shape
// ============================================================

export interface UnitView {
  id: number;
  label: string;
  opnameMode: OpnameMode;
  createdAt: string;
  updatedAt: string;
}

function toUnitView(u: Prisma.UnitGetPayload<{}>): UnitView {
  return {
    id: u.id,
    label: u.label,
    opnameMode: u.opnameMode,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

// ============================================================
// Operations
// ============================================================

export async function listUnits(): Promise<UnitView[]> {
  const units = await prisma.unit.findMany({
    orderBy: [{ opnameMode: 'asc' }, { label: 'asc' }],
  });
  return units.map(toUnitView);
}

export async function getUnitById(id: number): Promise<UnitView> {
  const u = await prisma.unit.findUnique({ where: { id } });
  if (!u) throw notFound('Unit');
  return toUnitView(u);
}

export async function createUnit(input: CreateUnitInput): Promise<UnitView> {
  const existing = await prisma.unit.findUnique({ where: { label: input.label } });
  if (existing) {
    throw new AppError(`Unit "${input.label}" sudah ada`, 409);
  }
  const created = await prisma.unit.create({
    data: { label: input.label, opnameMode: input.opnameMode },
  });
  return toUnitView(created);
}

export async function updateUnit(id: number, input: UpdateUnitInput): Promise<UnitView> {
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw notFound('Unit');

  if (input.label && input.label !== existing.label) {
    const dup = await prisma.unit.findUnique({ where: { label: input.label } });
    if (dup) throw new AppError(`Unit "${input.label}" sudah ada`, 409);
  }

  const data: Prisma.UnitUpdateInput = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.opnameMode !== undefined) data.opnameMode = input.opnameMode;

  const updated = await prisma.unit.update({ where: { id }, data });
  return toUnitView(updated);
}

export async function deleteUnit(id: number): Promise<{ id: number; label: string }> {
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw notFound('Unit');

  const rmCount = await prisma.rawMaterial.count({ where: { unitId: id } });
  if (rmCount > 0) {
    throw new AppError(
      `Unit "${existing.label}" tidak bisa dihapus - dipakai ${rmCount} raw material. Ganti unit di raw material dulu atau hapus raw material yang merefer.`,
      409,
    );
  }
  await prisma.unit.delete({ where: { id } });
  return { id: existing.id, label: existing.label };
}
