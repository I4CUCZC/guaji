import type {
  EquipSlot,
  EquipmentMap,
  GearInstance,
  InventoryEntry,
  ItemDef,
} from './types';
import { EQUIP_SLOTS } from './types';
import { clampEnhanceLevel } from './economy';

export function makeGear(itemId: string, enhanceLevel = 0): GearInstance {
  return { itemId, enhanceLevel: clampEnhanceLevel(enhanceLevel) };
}

export function equippedItemId(
  equipment: EquipmentMap,
  slot: EquipSlot,
): string | undefined {
  return equipment[slot]?.itemId;
}

export function addItem(
  inventory: InventoryEntry[],
  item: ItemDef,
  qty = 1,
  enhanceLevel = 0,
): InventoryEntry[] {
  const next = inventory.map((e) => ({ ...e }));
  if (item.stackable) {
    const existing = next.find((e) => e.itemId === item.id);
    if (existing) {
      existing.qty += qty;
      return next;
    }
    next.push({ itemId: item.id, qty });
    return next;
  }
  for (let i = 0; i < qty; i++) {
    next.push({
      itemId: item.id,
      qty: 1,
      enhanceLevel: clampEnhanceLevel(enhanceLevel),
    });
  }
  return next;
}

export function removeOne(
  inventory: InventoryEntry[],
  itemId: string,
  enhanceLevel?: number,
): InventoryEntry[] {
  const idx =
    enhanceLevel === undefined
      ? inventory.findIndex((e) => e.itemId === itemId && e.qty > 0)
      : inventory.findIndex(
          (e) =>
            e.itemId === itemId &&
            e.qty > 0 &&
            clampEnhanceLevel(e.enhanceLevel ?? 0) ===
              clampEnhanceLevel(enhanceLevel),
        );
  if (idx < 0) return inventory;
  return removeAt(inventory, idx);
}

/** Remove a specific inventory row by index (salvage / enhance fodder). */
export function removeAt(
  inventory: InventoryEntry[],
  index: number,
): InventoryEntry[] {
  if (index < 0 || index >= inventory.length) return inventory;
  const next = inventory.map((e) => ({ ...e }));
  const row = next[index]!;
  if (row.qty > 1) {
    row.qty -= 1;
  } else {
    next.splice(index, 1);
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

function addBackGear(
  inventory: InventoryEntry[],
  itemId: string,
  enhanceLevel = 0,
): InventoryEntry[] {
  return [
    ...inventory,
    { itemId, qty: 1, enhanceLevel: clampEnhanceLevel(enhanceLevel) },
  ];
}

/**
 * Equip from inventory.
 * Prefer `inventoryIndex` when provided; else first matching itemId
 * (optionally filtered by enhanceLevel).
 */
export function equipItem(
  inventory: InventoryEntry[],
  equipment: EquipmentMap,
  item: ItemDef,
  opts?: { inventoryIndex?: number; enhanceLevel?: number },
): { inventory: InventoryEntry[]; equipment: EquipmentMap } | null {
  if (!item.slot) return null;

  let idx = opts?.inventoryIndex;
  if (idx === undefined || idx < 0 || idx >= inventory.length) {
    idx = inventory.findIndex((e) => {
      if (e.itemId !== item.id || e.qty <= 0) return false;
      if (opts?.enhanceLevel === undefined) return true;
      return (
        clampEnhanceLevel(e.enhanceLevel ?? 0) ===
        clampEnhanceLevel(opts.enhanceLevel)
      );
    });
  }
  if (idx < 0) return null;
  const row = inventory[idx]!;
  if (row.itemId !== item.id) return null;

  const usedEnhance = clampEnhanceLevel(row.enhanceLevel ?? 0);
  let inv = removeAt(inventory, idx);
  const prev = equipment[item.slot];
  const nextEq: EquipmentMap = {
    ...equipment,
    [item.slot]: makeGear(item.id, usedEnhance),
  };
  if (prev) {
    inv = addBackGear(inv, prev.itemId, prev.enhanceLevel);
  }
  return { inventory: inv, equipment: nextEq };
}

export function unequipSlot(
  inventory: InventoryEntry[],
  equipment: EquipmentMap,
  slot: EquipSlot,
): { inventory: InventoryEntry[]; equipment: EquipmentMap } {
  const gear = equipment[slot];
  if (!gear) return { inventory, equipment };
  const nextEq = { ...equipment };
  delete nextEq[slot];
  return {
    inventory: addBackGear(inventory, gear.itemId, gear.enhanceLevel),
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

export function setEquippedEnhance(
  equipment: EquipmentMap,
  slot: EquipSlot,
  enhanceLevel: number,
): EquipmentMap {
  const gear = equipment[slot];
  if (!gear) return equipment;
  return {
    ...equipment,
    [slot]: makeGear(gear.itemId, enhanceLevel),
  };
}

export function setInventoryEnhance(
  inventory: InventoryEntry[],
  index: number,
  enhanceLevel: number,
): InventoryEntry[] {
  if (index < 0 || index >= inventory.length) return inventory;
  const next = inventory.map((e) => ({ ...e }));
  next[index] = {
    ...next[index]!,
    enhanceLevel: clampEnhanceLevel(enhanceLevel),
  };
  return next;
}
