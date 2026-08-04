import { safeStorage } from './safeStorage';

export interface QueuedRequest {
  id: string; // Unique request uuid/timestamp
  url: string; // API path
  method: 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body: string; // Stringified request payload
  description: string; // User-facing descriptive title (e.g. "送出 3 桌 5 份餐點" or "變更 2 號訂單為製作中")
  timestamp: number; // Creation time
}

const STORAGE_KEY = 'sabay_offline_sync_queue_v1';

// Get current request queue from safeStorage
export function getOfflineQueue(): QueuedRequest[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error('[OfflineQueue] Failed to parse queue from storage:', error);
    return [];
  }
}

// Persist request queue to safeStorage
export function saveOfflineQueue(queue: QueuedRequest[]) {
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineQueue] Failed to write queue to storage:', error);
  }
}

// Add a new request to the queue
export function addRequestToQueue(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: any,
  description: string,
  headers?: Record<string, string>,
): QueuedRequest {
  const queue = getOfflineQueue();
  const newItem: QueuedRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    url,
    method,
    headers: headers || { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    description,
    timestamp: Date.now(),
  };
  queue.push(newItem);
  saveOfflineQueue(queue);

  // Trigger a custom event so components can listen to changes dynamically
  window.dispatchEvent(new CustomEvent('offline_queue_changed', { detail: queue }));
  return newItem;
}

// Remove specific request from queue by ID
export function removeRequestFromQueue(id: string) {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveOfflineQueue(filtered);
  window.dispatchEvent(new CustomEvent('offline_queue_changed', { detail: filtered }));
}

// Clear entire queue
export function clearOfflineQueue() {
  saveOfflineQueue([]);
  window.dispatchEvent(new CustomEvent('offline_queue_changed', { detail: [] }));
}

// Execute a queued request
async function executeRequest(item: QueuedRequest): Promise<Response> {
  return fetch(item.url, {
    method: item.method,
    headers: item.headers,
    body: item.body,
  });
}

// Process all outstanding items in the queue in chronological order (FIFO)
export async function processOfflineQueue(
  onProgress?: (msg: string) => void,
): Promise<{ successCount: number; failureCount: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  const remaining: QueuedRequest[] = [...queue];

  console.log(`[OfflineQueue] Starting sync for ${queue.length} queued offset transactions...`);

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (onProgress) {
      onProgress(`正在同步 [${i + 1}/${queue.length}]: ${item.description}...`);
    }

    try {
      const response = await executeRequest(item);
      if (response.ok) {
        successCount++;
        // Remove from remaining list
        const idx = remaining.findIndex((r) => r.id === item.id);
        if (idx > -1) remaining.splice(idx, 1);
        saveOfflineQueue([...remaining]);
        window.dispatchEvent(new CustomEvent('offline_queue_changed', { detail: [...remaining] }));

        // If this was an order submission, check if we should add it to local order ID tracker
        if (item.url === '/api/orders' && item.method === 'POST') {
          try {
            const completedOrder = await response.json();
            if (completedOrder && completedOrder.id) {
              const currentOrdersRaw = safeStorage.getItem('sabay-my-submitted-order-ids') || '[]';
              const currentOrders = JSON.parse(currentOrdersRaw);
              if (!currentOrders.includes(completedOrder.id)) {
                currentOrders.push(completedOrder.id);
                safeStorage.setItem('sabay-my-submitted-order-ids', JSON.stringify(currentOrders));
              }
            }
          } catch (err) {
            console.warn(
              '[OfflineQueue] Failed to parse offline order response ID injection:',
              err,
            );
          }
        }
      } else {
        // Server rejected or had internal error (e.g. 400 Bad Request, 500)
        console.error(`[OfflineQueue] Server rejected request for ${item.url}:`, response.status);
        failureCount++;

        // If it is a terminal client error (400-499), remove it from the queue so it doesn't block forever
        if (response.status >= 400 && response.status < 500) {
          console.warn(
            `[OfflineQueue] Terminal 4xx response (${response.status}) received. Discarding request from queue.`,
          );
          const idx = remaining.findIndex((r) => r.id === item.id);
          if (idx > -1) remaining.splice(idx, 1);
          saveOfflineQueue([...remaining]);
          window.dispatchEvent(
            new CustomEvent('offline_queue_changed', { detail: [...remaining] }),
          );
          continue; // Proceed with the next item in the queue
        }

        break; // Stop processing further items for 5xx server errors to maintain sequence integrity
      }
    } catch (error) {
      // Network loss / CORS issue / offline timeout
      console.warn(`[OfflineQueue] Network request failed for ${item.description}:`, error);
      failureCount++;
      break; // Stop synchronization batch immediately upon network failure
    }
  }

  return { successCount, failureCount };
}
