import type { DropTable, ItemDef, PaperDollDef, WorldDef } from './types';

export interface LoadedWorldContent {
  world: WorldDef;
  dropTable: DropTable;
  items: ItemDef[];
  itemsById: Map<string, ItemDef>;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Load a world pack. Item files are listed by drop_table + known starter set;
 * we also accept an explicit itemIds list from the caller.
 */
export async function loadWorldContent(
  baseUrl: string,
  itemIds: string[],
): Promise<LoadedWorldContent> {
  const root = baseUrl.replace(/\/$/, '');
  const world = await fetchJson<WorldDef>(`${root}/world.json`);
  const dropTable = await fetchJson<DropTable>(`${root}/${world.dropTable}`);

  const ids = new Set<string>([
    ...itemIds,
    ...dropTable.entries.map((e) => e.itemId),
  ]);

  const items: ItemDef[] = [];
  for (const id of ids) {
    try {
      const item = await fetchJson<ItemDef>(`${root}/items/${id}.json`);
      items.push(item);
    } catch (err) {
      console.warn(`Missing item ${id}`, err);
    }
  }

  const itemsById = new Map(items.map((i) => [i.id, i]));
  return { world, dropTable, items, itemsById };
}

export async function loadPaperDoll(url: string): Promise<PaperDollDef> {
  return fetchJson<PaperDollDef>(url);
}

/** Known space-world item ids (drop table + extras). Keep in sync with content files. */
export const SPACE_ITEM_IDS = [
  'scrap_plasteel',
  'power_cell',
  'void_goggles',
  'carapace_torso',
  'greaves_voidwalker',
  'power_gauntlet_l',
  'power_gauntlet_r',
  'zealot_blade',
  'xeno_skull',
  'aegis_helm',
  'starfall_relic',
] as const;
