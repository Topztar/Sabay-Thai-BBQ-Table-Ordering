import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, onSnapshot, getDocs, setDoc, query, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MenuItem, CartItem, Order, QueueJob, Tenant } from '../types';

interface OfflineQueueContextType {
  isOnline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (sim: boolean) => void;
  queue: QueueJob[];
  orders: Order[];
  menu: MenuItem[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  addOrderToQueue: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status'], tenantId: string) => Promise<void>;
  flagOrder: (orderId: string, isFlagged: boolean, reason: string, tenantId: string) => Promise<void>;
  purgeQueue: () => void;
  forceRetryQueue: () => Promise<void>;
  
  // Multi-tenant properties & methods
  currentTenantId: string;
  setCurrentTenantId: (tenantId: string) => void;
  tenants: Tenant[];
  addTenant: (tenant: Tenant) => Promise<void>;
  updateTenant: (tenant: Tenant) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);

// Initial Rich Mock Menu Items (Sabay Thai BBQ)
const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'bbq-1',
    name: '特級香烤泰式豬肉串',
    nameEn: 'Moo Ping (Thai Grilled Pork Skewers)',
    price: 15,
    category: 'BBQ',
    description: '經典街頭風味，秘製香料醃製，碳火香烤，鮮嫩多汁。',
    descriptionEn: 'Classic street food skewers marinated in lemongrass and sweet soy sauce, grilled to perfection.',
    available: true,
  },
  {
    id: 'bbq-2',
    name: '泰式脆皮烤三層肉',
    nameEn: 'Thai Crispy Pork Belly',
    price: 18,
    category: 'BBQ',
    description: '外皮金黃酥脆，肉質香嫩Q彈，搭配獨家酸辣涼拌醬。',
    descriptionEn: 'Golden crispy skin with tender, layered meat, served with sweet-sour chili dipping sauce.',
    available: true,
  },
  {
    id: 'bbq-3',
    name: '香烤泰式香茅雞翅',
    nameEn: 'Grilled Lemongrass Chicken Wings',
    price: 12,
    category: 'BBQ',
    description: '淡雅香茅芳香，佐以特製羅望子烤肉沾醬。',
    descriptionEn: 'Marinated with fresh lemongrass and herbs, served with homemade tamarind barbecue sauce.',
    available: true,
  },
  {
    id: 'app-1',
    name: '青木瓜沙拉 (泰式涼拌木瓜絲)',
    nameEn: 'Som Tum (Green Papaya Salad)',
    price: 10,
    category: 'Appetizers',
    description: '酸、甜、香、辣完美融合，清脆爽口開胃首選。',
    descriptionEn: 'Fresh, shredded green papaya pounded with garlic, chili, lime, and crushed peanuts.',
    available: true,
  },
  {
    id: 'app-2',
    name: '泰式月亮蝦餅',
    nameEn: 'Thai Moon Shrimp Cake',
    price: 16,
    category: 'Appetizers',
    description: '滿滿蝦仁內餡，酥脆外皮搭配甜梅醬。',
    descriptionEn: 'Thick crispy cakes packed with minced shrimp, served with sweet plum sauce.',
    available: true,
  },
  {
    id: 'app-3',
    name: '冬蔭功酸辣海鮮湯',
    nameEn: 'Tom Yum Goong (Spicy Shrimp Soup)',
    price: 14,
    category: 'Appetizers',
    description: '經典泰式酸辣海鮮湯，含有鮮蝦、蕈菇，充滿香草芬芳。',
    descriptionEn: 'Traditional lemongrass-infused hot and sour broth with juicy shrimp and mushrooms.',
    available: true,
  },
  {
    id: 'bev-1',
    name: '手標手作泰式奶茶',
    nameEn: 'Thai Iced Milk Tea',
    price: 5,
    category: 'Beverages',
    description: '經典泰國手標茶葉現沖，茶香濃郁，奶甜滑順。',
    descriptionEn: 'Authentic brewed ChaTraMue Thai tea mixed with condensed milk and poured over crushed ice.',
    available: true,
  },
  {
    id: 'bev-2',
    name: '鮮椰子汁',
    nameEn: 'Fresh Young Coconut',
    price: 6,
    category: 'Beverages',
    description: '整顆新鮮椰子，清涼解渴，果肉鮮甜。',
    descriptionEn: 'Whole chilled sweet young coconut, full of refreshing natural water and tender coconut meat.',
    available: true,
  }
];

const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'DEFAULT',
    name: 'Sabay Thai BBQ - 總店',
    nameEn: 'Sabay Thai BBQ - Main Branch',
    minSpend: 10,
    currency: '$',
    tables: ['Counter-1', 'Table-1', 'Table-2', 'Table-3', 'Table-5'],
    contactNumber: '02-1234-5678',
    address: '台北市大安區忠孝東路四段 100 號',
    createdAt: '2026-06-27T00:00:00.000Z'
  },
  {
    id: 'EAST_BRANCH',
    name: 'Sabay Thai BBQ - 東區分店',
    nameEn: 'Sabay Thai BBQ - East District Branch',
    minSpend: 15,
    currency: '$',
    tables: ['Table-E1', 'Table-E2', 'Table-E3', 'Table-E4', 'Table-E5'],
    contactNumber: '02-8765-4321',
    address: '台北市信義區松壽路 12 號',
    createdAt: '2026-06-27T01:00:00.000Z'
  },
  {
    id: 'WEST_BRANCH',
    name: 'Sabay Thai BBQ - 西門店',
    nameEn: 'Sabay Thai BBQ - Ximen Branch',
    minSpend: 12,
    currency: '$',
    tables: ['Table-W1', 'Table-W2', 'Table-W3', 'Table-W4', 'Table-W5'],
    contactNumber: '02-2345-6789',
    address: '台北市萬華區武昌街二段 50 號',
    createdAt: '2026-06-27T02:00:00.000Z'
  }
];

export const OfflineQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [simulatedOffline, setSimulatedOfflineState] = useState<boolean>(() => {
    return localStorage.getItem('sim_offline') === 'true';
  });
  const [currentTenantId, setCurrentTenantIdState] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTenant = params.get('tenantId');
    if (urlTenant) return urlTenant;
    return localStorage.getItem('current_tenant_id') || 'DEFAULT';
  });
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem('local_tenants');
    return saved ? JSON.parse(saved) : DEFAULT_TENANTS;
  });
  const [queue, setQueue] = useState<QueueJob[]>(() => {
    const saved = localStorage.getItem('offline_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('local_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [menu] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [activeSyncing, setActiveSyncing] = useState<boolean>(false);

  // Monitor hardware network state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new CustomEvent('network-status-change', { detail: { online: true } }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('network-status-change', { detail: { online: false } }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save state helpers
  const saveQueueToStorage = (newQueue: QueueJob[]) => {
    setQueue(newQueue);
    localStorage.setItem('offline_queue', JSON.stringify(newQueue));
  };

  const saveOrdersToStorage = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('local_orders', JSON.stringify(newOrders));
  };

  const setSimulatedOffline = (sim: boolean) => {
    setSimulatedOfflineState(sim);
    localStorage.setItem('sim_offline', String(sim));
  };

  const setCurrentTenantId = (id: string) => {
    setCurrentTenantIdState(id);
    localStorage.setItem('current_tenant_id', id);
    const url = new URL(window.location.href);
    url.searchParams.set('tenantId', id);
    window.history.pushState({}, '', url.toString());
  };

  const addTenant = async (tenant: Tenant) => {
    const updated = [...tenants, tenant];
    setTenants(updated);
    localStorage.setItem('local_tenants', JSON.stringify(updated));

    if (isOnline && !simulatedOffline) {
      try {
        await setDoc(doc(db, 'tenants', tenant.id), tenant);
      } catch (err) {
        console.error('[Firestore] Failed to add tenant:', err);
      }
    }
  };

  const updateTenant = async (tenant: Tenant) => {
    const updated = tenants.map(t => t.id === tenant.id ? tenant : t);
    setTenants(updated);
    localStorage.setItem('local_tenants', JSON.stringify(updated));

    if (isOnline && !simulatedOffline) {
      try {
        await setDoc(doc(db, 'tenants', tenant.id), tenant);
      } catch (err) {
        console.error('[Firestore] Failed to update tenant:', err);
      }
    }
  };

  const deleteTenant = async (tenantId: string) => {
    const updated = tenants.filter(t => t.id !== tenantId);
    setTenants(updated);
    localStorage.setItem('local_tenants', JSON.stringify(updated));

    if (isOnline && !simulatedOffline) {
      try {
        await deleteDoc(doc(db, 'tenants', tenantId));
      } catch (err) {
        console.error('[Firestore] Failed to delete tenant:', err);
      }
    }
  };

  // Real-time listener for tenants
  useEffect(() => {
    const currentEffectiveOnline = isOnline && !simulatedOffline;
    if (!currentEffectiveOnline) return;

    const unsubscribe = onSnapshot(collection(db, 'tenants'), (snapshot) => {
      if (snapshot.empty) {
        // Bootstrap initial tenants on Firestore if totally empty
        DEFAULT_TENANTS.forEach(async (t) => {
          await setDoc(doc(db, 'tenants', t.id), t);
        });
        return;
      }
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
      const sorted = items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setTenants(sorted);
      localStorage.setItem('local_tenants', JSON.stringify(sorted));
    }, (err) => {
      console.warn('[Firestore] Tenants subscription failed, using local fallback:', err.message);
    });

    return () => unsubscribe();
  }, [isOnline, simulatedOffline]);

  const currentEffectiveOnline = isOnline && !simulatedOffline;

  // Process the queue in FIFO order
  const processQueue = useCallback(async () => {
    if (queue.length === 0 || activeSyncing || !currentEffectiveOnline) return;
    setActiveSyncing(true);

    const tempQueue = [...queue];
    console.log(`[Queue Sync] Starting replay of ${tempQueue.length} jobs...`);

    while (tempQueue.length > 0) {
      const job = tempQueue[0];
      try {
        console.log(`[Queue Sync] Replaying job: ${job.description} (ID: ${job.id})`);
        
        // Match operation type based on job details
        if (job.url.includes('/orders')) {
          const tenantId = job.payload.tenantId || 'DEFAULT';
          const collectionRef = collection(db, 'tenants', tenantId, 'orders');
          
          // Using custom document ID or setting newly generated
          const docRef = doc(collectionRef, job.payload.id);
          await setDoc(docRef, {
            ...job.payload,
            syncedAt: new Date().toISOString()
          });
        } else if (job.url.includes('/update-status')) {
          const { orderId, status, tenantId } = job.payload;
          const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
          await updateDoc(docRef, { status });
        } else if (job.url.includes('/flag-order')) {
          const { orderId, isFlagged, flagReason, tenantId } = job.payload;
          const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
          await updateDoc(docRef, { isFlagged, flagReason });
        }

        // Remove successfully completed job
        tempQueue.shift();
        saveQueueToStorage([...tempQueue]);
        console.log(`[Queue Sync] Job ${job.id} replayed successfully.`);
      } catch (error) {
        console.error(`[Queue Sync] Failed to replay job ${job.id}:`, error);
        // Pause sync queue execution on failure to maintain FIFO sequence
        break;
      }
    }
    setActiveSyncing(false);
  }, [queue, activeSyncing, currentEffectiveOnline]);

  // Handle auto-sync triggers on reconnect
  useEffect(() => {
    if (currentEffectiveOnline && queue.length > 0) {
      processQueue();
    }
  }, [currentEffectiveOnline, queue.length, processQueue]);

  // 1. Submit customer order
  const addOrderToQueue = async (order: Order) => {
    // Optimistic UI update: Immediately add order to local state so the user sees it without lag
    const updatedOrders = [order, ...orders];
    saveOrdersToStorage(updatedOrders);

    if (currentEffectiveOnline) {
      try {
        const collectionRef = collection(db, 'tenants', order.tenantId, 'orders');
        const docRef = doc(collectionRef, order.id);
        await setDoc(docRef, {
          ...order,
          syncedAt: new Date().toISOString()
        });
        console.log(`[Firestore] Order ${order.id} sent successfully.`);
      } catch (error) {
        console.error('[Firestore] Failed to write order, queueing instead:', error);
        // Push to offline queue since network write failed
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: `/tenants/${order.tenantId}/orders`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: order,
          description: `送出桌號 ${order.table_id} 訂單 (總計: $${order.total_amount})`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      // Offline mode: Serialize into FIFO cache
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: `/tenants/${order.tenantId}/orders`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: order,
        description: `離線送出桌號 ${order.table_id} 訂單 (總計: $${order.total_amount})`
      };
      saveQueueToStorage([...queue, job]);
      console.log(`[Offline Queue] Cached order job locally: ${job.id}`);
    }
  };

  // 2. Kitchen or manager status update
  const updateOrderStatus = async (orderId: string, status: Order['status'], tenantId: string) => {
    // Optimistically update locally
    const updated = orders.map(o => o.id === orderId ? { ...o, status } : o);
    saveOrdersToStorage(updated);

    // Fire custom event to trigger Toast notification if status completed
    if (status === 'completed') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        window.dispatchEvent(new CustomEvent('order-completed-toast', { detail: order }));
      }
    }

    if (currentEffectiveOnline) {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
        await updateDoc(docRef, { status });
      } catch (error) {
        console.error('[Firestore] Failed to update status, queueing job:', error);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: `/orders/update-status`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          payload: { orderId, status, tenantId },
          description: `更新訂單 ${orderId.substring(0, 5)}... 狀態至: ${status}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: `/orders/update-status`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        payload: { orderId, status, tenantId },
        description: `離線更新訂單 ${orderId.substring(0, 5)}... 狀態至: ${status}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  // 3. Mark/flag orders with notes
  const flagOrder = async (orderId: string, isFlagged: boolean, reason: string, tenantId: string) => {
    // Optimistic UI
    const updated = orders.map(o => o.id === orderId ? { ...o, isFlagged, flagReason: reason } : o);
    saveOrdersToStorage(updated);

    if (currentEffectiveOnline) {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
        await updateDoc(docRef, { isFlagged, flagReason: reason });
      } catch (error) {
        console.error('[Firestore] Failed to flag order, queueing:', error);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: `/orders/flag-order`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          payload: { orderId, isFlagged, flagReason: reason, tenantId },
          description: `標記優先訂單 ${orderId.substring(0, 5)}...: ${reason}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: `/orders/flag-order`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        payload: { orderId, isFlagged, flagReason: reason, tenantId },
        description: `離線標記優先訂單 ${orderId.substring(0, 5)}...: ${reason}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  // 4. Force Purge Queue (Manual Admin override)
  const purgeQueue = () => {
    saveQueueToStorage([]);
    console.log('[Offline Queue] Queue has been manually purged.');
  };

  // 5. Force Manual retry
  const forceRetryQueue = async () => {
    await processQueue();
  };

  // Firestore Real-time listener when online
  useEffect(() => {
    if (!currentEffectiveOnline) return;

    // Listen to orders collection under the dynamically selected tenant
    const unsubscribe = onSnapshot(collection(db, 'tenants', currentTenantId, 'orders'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Merge live firestore orders with any locally unsynced orders to prevent state flicker
      setOrders(prev => {
        const localOnly = prev.filter(p => !items.some(item => item.id === p.id));
        const merged = [...localOnly, ...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        localStorage.setItem('local_orders', JSON.stringify(merged));
        return merged;
      });
    }, (err) => {
      console.warn(`[Firestore] Real-time stream failed for tenant ${currentTenantId}, using offline fallback. Error:`, err.message);
    });

    return () => unsubscribe();
  }, [currentEffectiveOnline, currentTenantId]);

  return (
    <OfflineQueueContext.Provider value={{
      isOnline,
      simulatedOffline,
      setSimulatedOffline,
      queue,
      orders,
      menu,
      setOrders,
      addOrderToQueue,
      updateOrderStatus,
      flagOrder,
      purgeQueue,
      forceRetryQueue,
      currentTenantId,
      setCurrentTenantId,
      tenants,
      addTenant,
      updateTenant,
      deleteTenant
    }}>
      {children}
    </OfflineQueueContext.Provider>
  );
};

export const useOfflineQueue = () => {
  const context = useContext(OfflineQueueContext);
  if (context === undefined) {
    throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  }
  return context;
};
