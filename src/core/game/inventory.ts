import type { EquipSlot, EquipmentMap, InventoryEntry, ItemDef } from './types';
import { EQUIP_SLOTS } from './types';

export function addItem(
  inventory: InventoryEntry[],
  item: ItemDef,
  qty = 1,
): InventoryEntry[] {
  const next = inventory.map((e) => ({ ...e }));
  if (item.stackable) {
    const existing = next.find((e) => e.itemId === item.id);
    if (existing) {
      existing.qty += qty;
      return next;
    }
  }
  // Non-stackable: each unit is its own row OR we still allow qty>1 as distinct copies counted
  if (!item.stackable) {
    for (let i = 0; i < qty; i++) {
      next.push({ itemId: item.id, qty: 1 });
    }
    return next;
  }
  next.push({ itemId: item.id, qty });
  return next;
}

export function removeOne(
  inventory: InventoryEntry[],
  itemId: string,
): InventoryEntry[] {
  const idx = inventory.findIndex((e) => e.itemId === itemId && e.qty > 0);
  if (idx < 0) return inventory;
  const next = inventory.map((e) => ({ ...e }));
  const row = next[idx]!;
  if (row.qty > 1) {
    row.qty -= 1;
  } else {
    next.splice(idx, 1);
  }
  return next;
}

export function countOf(inventory: InventoryEntry[], itemId: string): number {
  return inventory
    .filter((e) => e.itemId === itemId)
    .reduce((s, e) => s + e.qty, 0);
}

export function hasItem(inventory: InventoryEntry[], itemId: string): boolean {
  return countOf(inventory, itemId) > 0;
}

/**
 * Equip itemId into its slot. Returns new inventory + equipment.
 * Previous equipped item (if any) returns to inventory.
 */
export function equipItem(
  inventory: InventoryEntry[],
  equipment: EquipmentMap,
  item: ItemDef,
): { inventory: InventoryEntry[]; equipment: EquipmentMap } | null {
  if (!item.slot) return null;
  if (!hasItem(inventory, item.id)) return null;

  let inv = removeOne(inventory, item.id);
  const prevId = equipment[item.slot];
  const nextEq: EquipmentMap = { ...equipment, [item.slot]: item.id };

  if (prevId) {
    // Put previous gear back — look up stackable from same id pattern: always qty 1 gear
    inv = addBackGear(inv, prevId);
  }
  return { inventory: inv, equipment: nextEq };
}

function addBackGear(inventory: InventoryEntry[], itemId: string): InventoryEntry[] {
  // Gear is non-stackable rows of qty 1
  return [...inventory, { itemId, qty: 1 }];
}

export function unequipSlot(
  inventory: InventoryEntry[],
  equipment: EquipmentMap,
  slot: EquipSlot,
): { inventory: InventoryEntry[]; equipment: EquipmentMap } {
  const id = equipment[slot];
  if (!id) return { inventory, equipment };
  const nextEq = { ...equipment };
  delete nextEq[slot];
  return {
    inventory: addBackGear(inventory, id),
    equipment: nextEq,
  };
}

export function emptyEquipment(): EquipmentMap {
  const eq: EquipmentMap = {};
  for (const s of EQUIP_SLOTS) {
    void s;
  }
  return eq;
}
