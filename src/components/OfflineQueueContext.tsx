import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, onSnapshot, getDocs, setDoc, query, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MenuItem, CartItem, Order, QueueJob, Tenant, SyncLogEntry, UserSession, UserRole, UserAccount } from '../types';

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
  setOrderUrgent: (orderId: string, urgent: boolean, tenantId: string) => Promise<void>;
  clearHistoricalOrders: (tenantId: string) => Promise<void>;
  purgeQueue: () => void;
  forceRetryQueue: () => Promise<void>;
  
  // Synchronization logs of processed jobs
  syncLogs: SyncLogEntry[];
  clearSyncLogs: () => void;
  
  // Multi-tenant properties & methods
  currentTenantId: string;
  setCurrentTenantId: (tenantId: string) => void;
  tenants: Tenant[];
  addTenant: (tenant: Tenant) => Promise<void>;
  updateTenant: (tenant: Tenant) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;

  // Session & User Account Management
  session: UserSession | null;
  loginSession: (role: UserRole, branchId: string, pin: string, username?: string) => Promise<boolean>;
  logoutSession: () => void;
  users: UserAccount[];
  addUserAccount: (user: UserAccount) => Promise<void>;
  deleteUserAccount: (userId: string) => Promise<void>;

  // Centralized Menu Management
  addMenuItem: (item: MenuItem) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;

  // KDS View Preference Mode
  kdsViewMode: 'compact' | 'standard';
  setKdsViewMode: (mode: 'compact' | 'standard') => void;
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
    createdAt: '2026-06-27T00:00:00.000Z',
    pin: '111111'
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
    createdAt: '2026-06-27T01:00:00.000Z',
    pin: '222222'
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
    createdAt: '2026-06-27T02:00:00.000Z',
    pin: '333333'
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
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(() => {
    const saved = localStorage.getItem('offline_sync_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem('sabay_thai_user_session') || localStorage.getItem('sabay_thai_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('local_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [kdsViewMode, setKdsViewModeState] = useState<'compact' | 'standard'>(() => {
    const saved = localStorage.getItem('kds_view_mode');
    return (saved === 'compact' || saved === 'standard') ? saved : 'standard';
  });

  const setKdsViewMode = (mode: 'compact' | 'standard') => {
    setKdsViewModeState(mode);
    localStorage.setItem('kds_view_mode', mode);
  };

  const [menu, setMenu] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('local_menu_items');
    if (saved) return JSON.parse(saved);
    const defaultAssigned = DEFAULT_TENANTS.map(t => t.id);
    return INITIAL_MENU_ITEMS.map(item => ({
      ...item,
      assignedBranches: item.assignedBranches || defaultAssigned
    }));
  });

  const clearSyncLogs = () => {
    setSyncLogs([]);
    localStorage.removeItem('offline_sync_logs');
  };

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

  // Real-time listener for users
  useEffect(() => {
    const currentEffectiveOnline = isOnline && !simulatedOffline;
    if (!currentEffectiveOnline) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAccount));
      setUsers(items);
      localStorage.setItem('local_users', JSON.stringify(items));
    }, (err) => {
      console.warn('[Firestore] Users subscription failed, using local fallback:', err.message);
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
        } else if (job.url.includes('/orders/set-urgent')) {
          const { orderId, urgent, tenantId } = job.payload;
          const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
          await updateDoc(docRef, { urgent });
        } else if (job.url.includes('/menu-items/create')) {
          const item = job.payload;
          await setDoc(doc(db, 'menu_items', item.id), item);
        } else if (job.url.includes('/menu-items/update')) {
          const item = job.payload;
          await setDoc(doc(db, 'menu_items', item.id), item);
        } else if (job.url.includes('/menu-items/delete')) {
          const { id } = job.payload;
          await deleteDoc(doc(db, 'menu_items', id));
        } else if (job.url.includes('/users/create')) {
          const user = job.payload;
          await setDoc(doc(db, 'users', user.id), user);
        } else if (job.url.includes('/users/delete')) {
          const { id } = job.payload;
          await deleteDoc(doc(db, 'users', id));
        }

        // Remove successfully completed job
        tempQueue.shift();
        saveQueueToStorage([...tempQueue]);
        console.log(`[Queue Sync] Job ${job.id} replayed successfully.`);

        // Record successful sync log
        const logEntry: SyncLogEntry = {
          id: job.id,
          timestamp: job.timestamp,
          url: job.url,
          method: job.method,
          description: job.description,
          syncedAt: new Date().toISOString(),
          status: 'success'
        };
        setSyncLogs(prev => {
          const updated = [logEntry, ...prev].slice(0, 100);
          localStorage.setItem('offline_sync_logs', JSON.stringify(updated));
          return updated;
        });
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

  const setOrderUrgent = async (orderId: string, urgent: boolean, tenantId: string) => {
    // Optimistic UI
    const updated = orders.map(o => o.id === orderId ? { ...o, urgent } : o);
    saveOrdersToStorage(updated);

    if (currentEffectiveOnline) {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'orders', orderId);
        await updateDoc(docRef, { urgent });
      } catch (error) {
        console.error('[Firestore] Failed to update urgent state, queueing:', error);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: `/orders/set-urgent`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          payload: { orderId, urgent, tenantId },
          description: `標記緊急訂單 ${orderId.substring(0, 5)}...: ${urgent ? 'Urgent' : 'Normal'}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: `/orders/set-urgent`,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        payload: { orderId, urgent, tenantId },
        description: `離線標記緊急訂單 ${orderId.substring(0, 5)}...: ${urgent ? 'Urgent' : 'Normal'}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  const clearHistoricalOrders = async (tenantId: string) => {
    const completedForTenant = orders.filter(o => o.tenantId === tenantId && o.status === 'completed');
    const remaining = orders.filter(o => o.tenantId !== tenantId || o.status !== 'completed');
    saveOrdersToStorage(remaining);

    if (currentEffectiveOnline && completedForTenant.length > 0) {
      try {
        await Promise.all(
          completedForTenant.map(async (order) => {
            const docRef = doc(db, 'tenants', tenantId, 'orders', order.id);
            await deleteDoc(docRef);
          })
        );
        console.log(`[Firestore] Cleaned up ${completedForTenant.length} completed orders from cloud DB.`);
      } catch (err) {
        console.error('[Firestore] Error cleaning up completed orders from cloud DB:', err);
      }
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

  // Centralized Menu Management
  const addMenuItem = async (item: MenuItem) => {
    const updated = [...menu, item];
    setMenu(updated);
    localStorage.setItem('local_menu_items', JSON.stringify(updated));

    if (currentEffectiveOnline) {
      try {
        await setDoc(doc(db, 'menu_items', item.id), item);
      } catch (err) {
        console.error('[Firestore] Failed to add menu item, queueing:', err);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: '/menu-items/create',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: item,
          description: `新增菜單品項: ${item.name}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: '/menu-items/create',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: item,
        description: `離線新增菜單品項: ${item.name}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  const updateMenuItem = async (item: MenuItem) => {
    const updated = menu.map(m => m.id === item.id ? item : m);
    setMenu(updated);
    localStorage.setItem('local_menu_items', JSON.stringify(updated));

    if (currentEffectiveOnline) {
      try {
        await setDoc(doc(db, 'menu_items', item.id), item);
      } catch (err) {
        console.error('[Firestore] Failed to update menu item, queueing:', err);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: '/menu-items/update',
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          payload: item,
          description: `編輯菜單品項: ${item.name}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: '/menu-items/update',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        payload: item,
        description: `離線編輯菜單品項: ${item.name}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    const updated = menu.filter(m => m.id !== itemId);
    setMenu(updated);
    localStorage.setItem('local_menu_items', JSON.stringify(updated));

    if (currentEffectiveOnline) {
      try {
        await deleteDoc(doc(db, 'menu_items', itemId));
      } catch (err) {
        console.error('[Firestore] Failed to delete menu item, queueing:', err);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: '/menu-items/delete',
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          payload: { id: itemId },
          description: `刪除菜單品項 ID: ${itemId}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: '/menu-items/delete',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        payload: { id: itemId },
        description: `離線刪除菜單品項 ID: ${itemId}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  // Session Management
  const loginSession = async (role: UserRole, branchId: string, pin: string, username?: string): Promise<boolean> => {
    if (role === 'SUPER_ADMIN') {
      const inputUsername = (username || '').trim().toLowerCase();
      // 1. Check custom users list first
      const matchCustom = users.find(u => u.role === 'SUPER_ADMIN' && u.username.toLowerCase() === inputUsername && u.pin === pin);
      if (matchCustom) {
        const adminSession: UserSession = {
          role: 'SUPER_ADMIN',
          branchId: 'ALL',
          branchName: 'Super Admin Master Node'
        };
        setSession(adminSession);
        sessionStorage.setItem('sabay_thai_user_session', JSON.stringify(adminSession));
        localStorage.setItem('sabay_thai_user_session', JSON.stringify(adminSession));
        return true;
      }

      // 2. Fallback to default credentials (username: topztar, pin: saved pin / Eur0pe2266)
      const savedSuperPin = localStorage.getItem('sabay_thai_admin_pin') || 'Eur0pe2266';
      if ((inputUsername === 'topztar' || inputUsername === 'sabay' || inputUsername === 'admin') && pin === savedSuperPin) {
        const adminSession: UserSession = {
          role: 'SUPER_ADMIN',
          branchId: 'ALL',
          branchName: 'Super Admin Master Node'
        };
        setSession(adminSession);
        sessionStorage.setItem('sabay_thai_user_session', JSON.stringify(adminSession));
        localStorage.setItem('sabay_thai_user_session', JSON.stringify(adminSession));
        return true;
      }
      return false;
    }

    // BRANCH_STAFF login using PIN only (maintaining backward compatibility & user expectations)
    // 1. Check custom users list first
    const matchCustom = users.find(u => u.role === 'BRANCH_STAFF' && u.pin === pin && u.tenantId === branchId);
    if (matchCustom) {
      const staffSession: UserSession = {
        role: 'BRANCH_STAFF',
        branchId: matchCustom.tenantId,
        branchName: tenants.find(t => t.id === matchCustom.tenantId)?.name || '分店人員'
      };
      setSession(staffSession);
      sessionStorage.setItem('sabay_thai_user_session', JSON.stringify(staffSession));
      localStorage.setItem('sabay_thai_user_session', JSON.stringify(staffSession));
      setCurrentTenantId(matchCustom.tenantId);
      return true;
    }

    // 2. Fallback to default credentials
    const branch = tenants.find(t => t.id === branchId);
    if (branch) {
      const expectedPin = branch.pin || (branch.id === 'DEFAULT' ? '111111' : branch.id === 'EAST_BRANCH' ? '222222' : '333333');
      if (pin === expectedPin) {
        const staffSession: UserSession = {
          role: 'BRANCH_STAFF',
          branchId: branch.id,
          branchName: branch.name
        };
        setSession(staffSession);
        sessionStorage.setItem('sabay_thai_user_session', JSON.stringify(staffSession));
        localStorage.setItem('sabay_thai_user_session', JSON.stringify(staffSession));
        setCurrentTenantId(branch.id);
        return true;
      }
    }
    return false;
  };

  const logoutSession = () => {
    setSession(null);
    sessionStorage.removeItem('sabay_thai_user_session');
    localStorage.removeItem('sabay_thai_user_session');
  };

  const addUserAccount = async (user: UserAccount) => {
    const updated = [...users, user];
    setUsers(updated);
    localStorage.setItem('local_users', JSON.stringify(updated));

    if (isOnline && !simulatedOffline) {
      try {
        await setDoc(doc(db, 'users', user.id), user);
      } catch (err) {
        console.error('[Firestore] Failed to add user, queueing instead:', err);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: '/users/create',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: user,
          description: `建立使用者帳號: ${user.username} (${user.role})`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: '/users/create',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: user,
        description: `離線建立使用者帳號: ${user.username} (${user.role})`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  const deleteUserAccount = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    const updated = users.filter(u => u.id !== userId);
    setUsers(updated);
    localStorage.setItem('local_users', JSON.stringify(updated));

    if (isOnline && !simulatedOffline) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (err) {
        console.error('[Firestore] Failed to delete user, queueing instead:', err);
        const job: QueueJob = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          url: '/users/delete',
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          payload: { id: userId },
          description: `刪除使用者帳號: ${targetUser?.username || userId}`
        };
        saveQueueToStorage([...queue, job]);
      }
    } else {
      const job: QueueJob = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        url: '/users/delete',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        payload: { id: userId },
        description: `離線刪除使用者帳號: ${targetUser?.username || userId}`
      };
      saveQueueToStorage([...queue, job]);
    }
  };

  // Real-time listener for menu_items when online
  useEffect(() => {
    if (!currentEffectiveOnline) return;

    const unsubscribe = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
      if (snapshot.empty) {
        // Seed menu items if empty on Firestore
        const defaultAssigned = DEFAULT_TENANTS.map(t => t.id);
        INITIAL_MENU_ITEMS.forEach(async (item) => {
          const seededItem = {
            ...item,
            assignedBranches: item.assignedBranches || defaultAssigned
          };
          await setDoc(doc(db, 'menu_items', item.id), seededItem);
        });
        return;
      }

      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          assignedBranches: data.assignedBranches || DEFAULT_TENANTS.map(t => t.id)
        } as MenuItem;
      });
      setMenu(items);
      localStorage.setItem('local_menu_items', JSON.stringify(items));
    }, (err) => {
      console.warn('[Firestore] Menu subscription failed, using local fallback:', err.message);
    });

    return () => unsubscribe();
  }, [currentEffectiveOnline]);

  // Safe filtering: Branch staff can ONLY access orders belonging to their verified branch
  const filteredOrders = React.useMemo(() => {
    if (session?.role === 'BRANCH_STAFF') {
      return orders.filter(o => o.tenantId === session.branchId);
    }
    return orders;
  }, [orders, session]);

  // Firestore Real-time listener when online
  useEffect(() => {
    if (!currentEffectiveOnline) return;

    // Force listener to target authenticated branch if BRANCH_STAFF to guarantee absolute data isolation
    const activeListenerTenantId = session?.role === 'BRANCH_STAFF' ? session.branchId : currentTenantId;

    const unsubscribe = onSnapshot(collection(db, 'tenants', activeListenerTenantId, 'orders'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      setOrders(prev => {
        // Keep unsynced local orders of other tenants untouched, only merge live orders for the active tenant
        const otherTenantsOrders = prev.filter(p => p.tenantId !== activeListenerTenantId);
        const currentTenantLocalOnly = prev.filter(p => p.tenantId === activeListenerTenantId && !items.some(item => item.id === p.id));
        const merged = [...otherTenantsOrders, ...currentTenantLocalOnly, ...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        localStorage.setItem('local_orders', JSON.stringify(merged));
        return merged;
      });
    }, (err) => {
      console.warn(`[Firestore] Real-time stream failed for tenant ${activeListenerTenantId}, using offline fallback. Error:`, err.message);
    });

    return () => unsubscribe();
  }, [currentEffectiveOnline, currentTenantId, session]);

  // Real-time Heartbeat mechanism for tracking Tenant connection status
  useEffect(() => {
    if (!currentEffectiveOnline) return;

    const activeTenantId = session?.role === 'BRANCH_STAFF' ? session.branchId : currentTenantId;
    if (!activeTenantId || activeTenantId === 'DEFAULT') return;

    const updateHeartbeat = async () => {
      const tenant = tenants.find(t => t.id === activeTenantId);
      if (!tenant) return;

      const now = new Date().toISOString();
      if (tenant.lastHeartbeat) {
        const lastTime = new Date(tenant.lastHeartbeat).getTime();
        if (Date.now() - lastTime < 30 * 1000) return;
      }

      const updated = { ...tenant, lastHeartbeat: now };
      try {
        await setDoc(doc(db, 'tenants', activeTenantId), updated);
      } catch (err) {
        console.warn('[Heartbeat] Failed to set heartbeat:', err);
      }
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 45000);

    return () => clearInterval(interval);
  }, [currentEffectiveOnline, currentTenantId, session, tenants]);

  return (
    <OfflineQueueContext.Provider value={{
      isOnline,
      simulatedOffline,
      setSimulatedOffline,
      queue,
      orders: filteredOrders, // Expose isolated orders securely
      menu,
      setOrders,
      addOrderToQueue,
      updateOrderStatus,
      flagOrder,
      setOrderUrgent,
      clearHistoricalOrders,
      purgeQueue,
      forceRetryQueue,
      syncLogs,
      clearSyncLogs,
      currentTenantId,
      setCurrentTenantId,
      tenants,
      addTenant,
      updateTenant,
      deleteTenant,
      session,
      loginSession,
      logoutSession,
      users,
      addUserAccount,
      deleteUserAccount,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      kdsViewMode,
      setKdsViewMode
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
