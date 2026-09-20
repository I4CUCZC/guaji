import type { EquipmentMap, ItemDef, PaperDollDef } from './types';

export interface ComposedLayer {
  /** Resolved path relative to paper-doll root (layers/...) or absolute URL later */
  src: string;
  /** Slot this layer came from, or 'base' */
  kind: 'base' | EquipSlotLike;
  itemId?: string;
}

type EquipSlotLike = string;

/**
 * Compose draw list from paper-doll definition + current equipment.
 * Equipping an item replaces/adds the corresponding slot layer.
 */
export function composePaperDoll(
  def: PaperDollDef,
  equipment: EquipmentMap,
  itemsById: Map<string, ItemDef>,
): ComposedLayer[] {
  const layers: ComposedLayer[] = [];

  for (const entry of def.layerOrder) {
    if (entry.startsWith('slot:')) {
      const slot = entry.slice(5) as keyof EquipmentMap;
      const itemId = equipment[slot];
      if (!itemId) continue;
      const item = itemsById.get(itemId);
      if (!item?.layer) continue;
      layers.push({
        src: item.layer.startsWith('gear/') || item.layer.startsWith('base/')
          ? `layers/${item.layer}`
          : item.layer.startsWith('layers/')
            ? item.layer
            : `layers/${item.layer}`,
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

/** Normalize item.layer field to path under paper-doll/layers/ */
export function resolveItemLayerPath(layer: string): string {
  if (layer.startsWith('layers/')) return layer;
  if (layer.startsWith('gear/') || layer.startsWith('base/')) return `layers/${layer}`;
  return `layers/gear/${layer}`;
}
