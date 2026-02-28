import { get, set, del, keys, entries } from 'idb-keyval';

// ─── Offline ticket queue ───

const TICKET_QUEUE_PREFIX = 'offline-ticket-';

export interface OfflineTicket {
  id: string;
  payload: unknown;
  createdAt: string;
}

export async function queueTicket(payload: unknown): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: OfflineTicket = {
    id,
    payload,
    createdAt: new Date().toISOString(),
  };
  await set(`${TICKET_QUEUE_PREFIX}${id}`, entry);
  return id;
}

export async function getPendingTickets(): Promise<OfflineTicket[]> {
  const allKeys = await keys();
  const ticketKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(TICKET_QUEUE_PREFIX),
  );
  const pending: OfflineTicket[] = [];
  for (const key of ticketKeys) {
    const entry = await get<OfflineTicket>(key);
    if (entry) pending.push(entry);
  }
  return pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedTicket(id: string): Promise<void> {
  await del(`${TICKET_QUEUE_PREFIX}${id}`);
}

export async function getPendingCount(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(TICKET_QUEUE_PREFIX),
  ).length;
}

// ─── Sync pending tickets ───

export async function syncPendingTickets(
  postTicket: (payload: unknown) => Promise<unknown>,
): Promise<number> {
  const pending = await getPendingTickets();
  let synced = 0;

  for (const ticket of pending) {
    try {
      await postTicket(ticket.payload);
      await removeQueuedTicket(ticket.id);
      synced++;
    } catch {
      // Stop on first failure to preserve FIFO order
      break;
    }
  }

  return synced;
}

// ─── Data cache (products, categories, menus) ───

const CACHE_KEYS = {
  products: 'cache-products',
  categories: 'cache-categories',
  menus: 'cache-menus',
} as const;

type CacheKey = keyof typeof CACHE_KEYS;

export async function cacheData<T>(key: CacheKey, data: T): Promise<void> {
  await set(CACHE_KEYS[key], { data, updatedAt: new Date().toISOString() });
}

export async function getCachedData<T>(key: CacheKey): Promise<T | null> {
  const entry = await get<{ data: T; updatedAt: string }>(CACHE_KEYS[key]);
  return entry?.data ?? null;
}
