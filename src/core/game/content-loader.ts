import type {
  DropTable,
  EnemiesPack,
  ItemDef,
  PaperDollDef,
  WorldDef,
} from './types';

export interface LoadedWorldContent {
  world: WorldDef;
  dropTable: DropTable;
  enemiesPack: EnemiesPack;
  items: ItemDef[];
  itemsById: Map<string, ItemDef>;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return (await res.json()) as T;
}

/**
 * Load a world pack. Item files are listed by drop_table + enemies + known ids.
 */
export async function loadWorldContent(
  baseUrl: string,
  itemIds: string[],
): Promise<LoadedWorldContent> {
  const root = baseUrl.replace(/\/$/, '');
  const world = await fetchJson<WorldDef>(`${root}/world.json`);
  const dropTable = await fetchJson<DropTable>(`${root}/${world.dropTable}`);
  const enemiesFile = world.enemies ?? 'enemies.json';
  const enemiesPack = await fetchJson<EnemiesPack>(`${root}/${enemiesFile}`);

  const ids = new Set<string>([
    ...itemIds,
    ...dropTable.entries.map((e) => e.itemId),
  ]);
  for (const enemy of enemiesPack.enemies) {
    for (const d of enemy.drops) ids.add(d.itemId);
  }

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
  return { world, dropTable, enemiesPack, items, itemsById };
}

export async function loadPaperDoll(url: string): Promise<PaperDollDef> {
  return fetchJson<PaperDollDef>(url);
}

/**
 * Known space-world item ids (lore-first set).
 * Slot counts are intentionally unequal — no filler pad pieces.
 */
export const SPACE_ITEM_IDS = [
  'scrap_plasteel',
  'power_cell',
  'carapace_torso',
  'greaves_voidwalker',
  'combat_stim',
  'power_gauntlet_l',
  'power_gauntlet_r',
  'pulse_blade',
  'acid_gland',
  'voidbeast_trophy',
  'aegis_helm',
  'starfall_relic',
] as const;
