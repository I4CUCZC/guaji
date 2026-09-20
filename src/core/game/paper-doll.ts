import type { EquipmentMap, EquipSlot, ItemDef, PaperDollDef } from './types';

export interface ComposedLayer {
  /** Resolved path relative to paper-doll root (layers/...) or absolute URL later */
  src: string;
  /** Slot this layer came from, or 'base' */
  kind: 'base' | EquipSlotLike;
  itemId?: string;
}

type EquipSlotLike = string;

/** Distinct colored pixel placeholder per slot when art is missing. */
export const SLOT_PLACEHOLDER_LAYER: Record<EquipSlot, string> = {
  head: 'gear/ph_head.svg',
  neck: 'gear/ph_neck.svg',
  shoulder_left: 'gear/ph_shoulder_left.svg',
  shoulder_right: 'gear/ph_shoulder_right.svg',
  arm_left: 'gear/ph_arm_left.svg',
  arm_right: 'gear/ph_arm_right.svg',
  hand_left: 'gear/ph_hand_left.svg',
  hand_right: 'gear/ph_hand_right.svg',
  ring_1: 'gear/ph_ring_1.svg',
  ring_2: 'gear/ph_ring_2.svg',
  waist: 'gear/ph_waist.svg',
  leg_left: 'gear/ph_leg_left.svg',
  leg_right: 'gear/ph_leg_right.svg',
  foot_left: 'gear/ph_foot_left.svg',
  foot_right: 'gear/ph_foot_right.svg',
};

/**
 * Compose draw list from paper-doll definition + current equipment.
 * Equipping an item replaces/adds the corresponding slot layer.
 * Missing item.layer falls back to a distinct colored pixel placeholder
 * so equip/unequip is always visible on the doll.
 */
export function composePaperDoll(
  def: PaperDollDef,
  equipment: EquipmentMap,
  itemsById: Map<string, ItemDef>,
): ComposedLayer[] {
  const layers: ComposedLayer[] = [];

  for (const entry of def.layerOrder) {
    if (entry.startsWith('slot:')) {
      const slot = entry.slice(5) as EquipSlot;
      const itemId = equipment[slot];
      if (!itemId) continue;
      const item = itemsById.get(itemId);
      const rawLayer = item?.layer ?? SLOT_PLACEHOLDER_LAYER[slot];
      const src = normalizeLayerSrc(rawLayer);
      layers.push({
        src,
        kind: String(slot),
        itemId,
      });
    } else {
      // Base path like "base/body.svg"
      const src = entry.startsWith('layers/') ? entry : `layers/${entry}`;
      layers.push({ src, kind: 'base' });
    }
  }

  return layers;
}

function normalizeLayerSrc(layer: string): string {
  if (layer.startsWith('layers/')) return layer;
  if (layer.startsWith('gear/') || layer.startsWith('base/')) return `layers/${layer}`;
  return `layers/gear/${layer}`;
}

/** Normalize item.layer field to path under paper-doll/layers/ */
export function resolveItemLayerPath(layer: string): string {
  return normalizeLayerSrc(layer);
}
