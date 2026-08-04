import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MenuItem,
  Ingredient,
  Order,
  Category,
  TableConfig,
  OperatingHourSlot,
  Reservation,
  Language,
} from '../types';
import { safeStorage } from '../lib/safeStorage';
import { getOfflineQueue, processOfflineQueue, QueuedRequest } from '../lib/offlineQueue';
import { db, isFirebaseSyncEnabled } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { INITIAL_MENU, INITIAL_CATEGORIES } from '../data';

// Define context state types
interface AnalyticsData {
  totalRevenue: number;
  ordersCount: number;
  categorySales: { category: string; revenue: number }[];
  hourlyDistribution: { timeSlot: string; orders: number }[];
  topDishes: { name: string; qty: number }[];
  stockWarnings: Ingredient[];
}

interface GlobalContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  tables: TableConfig[];
  setTables: React.Dispatch<React.SetStateAction<TableConfig[]>>;
  reservations: Reservation[];
  minSpend: number;
  setMinSpend: React.Dispatch<React.SetStateAction<number>>;
  promoCombo: any;
  setPromoCombo: React.Dispatch<React.SetStateAction<any>>;
  operatingHours: OperatingHourSlot[];
  setOperatingHours: React.Dispatch<React.SetStateAction<OperatingHourSlot[]>>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  restDays: string[];
  setRestDays: React.Dispatch<React.SetStateAction<string[]>>;
  customerNotice: string;
  setCustomerNotice: React.Dispatch<React.SetStateAction<string>>;
  servicePaused: boolean;
  setServicePaused: React.Dispatch<React.SetStateAction<boolean>>;
  popularItemIds: string[];
  setPopularItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  memberPointsRatio: number;
  setMemberPointsRatio: React.Dispatch<React.SetStateAction<number>>;
  memberRewards: any[];
  setMemberRewards: React.Dispatch<React.SetStateAction<any[]>>;
  printLogs: any[];
  setPrintLogs: React.Dispatch<React.SetStateAction<any[]>>;
  printerIp: string;
  setPrinterIp: React.Dispatch<React.SetStateAction<string>>;
  pushNotifications: any[];
  setPushNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  analytics: AnalyticsData;
  setAnalytics: React.Dispatch<React.SetStateAction<AnalyticsData>>;
  loading: boolean;
  offlineQueue: QueuedRequest[];
  isSyncing: boolean;
  syncProgressMsg: string;
  isNetworkOnline: boolean;
  fetchData: (forceFull?: boolean, bypassReorderLock?: boolean) => Promise<void>;
  handleForceSync: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const useGlobalState = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalProvider');
  }
  return context;
};

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = safeStorage.getItem('sabay-language');
      return (stored as Language) || 'zh';
    } catch {
      return 'zh';
    }
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    safeStorage.setItem('sabay-language', newLang);
  };

  const enrichMenuItems = (items: MenuItem[]): MenuItem[] => {
    if (!Array.isArray(items)) return [];
    const defaults = INITIAL_MENU || [];
    return items.map((item) => {
      const defaultItem = defaults.find((x) => x.id === item.id);
      if (defaultItem) {
        const cleanName = { ...item.name };
        const cleanDesc = { ...item.description };
        ['ko', 'ja', 'th', 'vi'].forEach((lang) => {
          if (cleanName[lang as Language] === cleanName['zh']) delete cleanName[lang as Language];
          if (cleanDesc[lang as Language] === cleanDesc['zh']) delete cleanDesc[lang as Language];
        });
        const name = { ...defaultItem.name, ...cleanName };
        const description = { ...defaultItem.description, ...cleanDesc };
        return { ...item, name, description };
      }
      return item;
    });
  };

  const enrichCategories = (cats: Category[]): Category[] => {
    if (!Array.isArray(cats)) return [];
    const defaults = INITIAL_CATEGORIES || [];
    return cats.map((cat) => {
      const defaultCat = defaults.find((c) => c.id === cat.id);
      if (defaultCat) {
        const name = { ...defaultCat.name, ...cat.name };
        return { ...cat, name };
      }
      return cat;
    });
  };

  const [menuItems, setMenuItemsRaw] = useState<MenuItem[]>([]);
  const setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>> = (val) => {
    if (typeof val === 'function') {
      setMenuItemsRaw((prev) => enrichMenuItems(val(prev)));
    } else {
      setMenuItemsRaw(enrichMenuItems(val));
    }
  };

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategoriesRaw] = useState<Category[]>([]);
  const setCategories: React.Dispatch<React.SetStateAction<Category[]>> = (val) => {
    if (typeof val === 'function') {
      setCategoriesRaw((prev) => enrichCategories(val(prev)));
    } else {
      setCategoriesRaw(enrichCategories(val));
    }
  };
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [minSpend, setMinSpend] = useState<number>(200);
  const [promoCombo, setPromoCombo] = useState<any>({
    enabled: false,
    requiredQty: 0,
    discountAmount: 0,
    eligibleItemIds: [],
  });
  const [operatingHours, setOperatingHours] = useState<OperatingHourSlot[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [restDays, setRestDays] = useState<string[]>([]);
  const [customerNotice, setCustomerNotice] = useState<string>('');
  const [servicePaused, setServicePaused] = useState<boolean>(false);
  const [popularItemIds, setPopularItemIds] = useState<string[]>(['ty-01', 'nd-01', 'sk-02', 'sk-01']);
  const [memberPointsRatio, setMemberPointsRatio] = useState<number>(20);
  const [memberRewards, setMemberRewards] = useState<any[]>([]);
  
  const lastCategoryReorderTimeRef = useRef<number>(0);
  const lastMenuReorderTimeRef = useRef<number>(0);

  const [printLogs, setPrintLogs] = useState<any[]>([]);
  const [printerIp, setPrinterIp] = useState<string>('192.168.123.100');
  const [pushNotifications, setPushNotifications] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    ordersCount: 0,
    categorySales: [],
    hourlyDistribution: [],
    topDishes: [],
    stockWarnings: [],
  });

  const [loading, setLoading] = useState(true);
  const pollingCycleRef = useRef<number>(0);

  const [offlineQueue, setOfflineQueue] = useState<QueuedRequest[]>(getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string>('');
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateOnlineStatus = () => {
      setIsNetworkOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const handleQueueChange = (e: Event) => {
      const customEvent = e as CustomEvent<QueuedRequest[]>;
      setOfflineQueue(customEvent.detail || getOfflineQueue());
    };
    window.addEventListener('offline_queue_changed', handleQueueChange);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('offline_queue_changed', handleQueueChange);
    };
  }, []);

  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgressMsg('正在準備批次重發...');
    try {
      const result = await processOfflineQueue((progress) => setSyncProgressMsg(progress));
      if (result.successCount > 0) {
        console.log(`[Offline Sync] Successfully synced ${result.successCount} requests!`);
        await fetchData(true);
      }
    } catch (e) {
      console.error('[Offline Sync Error]', e);
    } finally {
      setIsSyncing(false);
      setSyncProgressMsg('');
    }
  };

  useEffect(() => {
    if (isNetworkOnline && offlineQueue.length > 0) {
      handleForceSync();
    }
  }, [isNetworkOnline, offlineQueue.length]);

  const fetchData = async (forceFull: boolean = true, bypassReorderLock: boolean = false) => {
    const fetchStartTime = Date.now();
    try {
      const fallbackAnalytics = {
        totalRevenue: 0,
        ordersCount: 0,
        categorySales: [],
        hourlyDistribution: [],
        topDishes: [],
        stockWarnings: [],
      };

      const safeFetch = async (url: string, fallbackVal: any) => {
        try {
          const res = await fetch(url);
          return res;
        } catch (err) {
          console.warn(`[Sabay Sync] Failed network fetch for ${url}:`, err);
          return {
            ok: false,
            status: 503,
            headers: new Headers(),
            json: async () => fallbackVal,
            text: async () => '',
            clone: function () {
              return this;
            },
          } as unknown as Response;
        }
      };

      const isFullCycle = forceFull || pollingCycleRef.current === 0 || pollingCycleRef.current % 5 === 0;
      pollingCycleRef.current = pollingCycleRef.current + 1;

      const promises: Promise<any>[] = [
        safeFetch('/api/ingredients', []),
        safeFetch('/api/orders', []),
        safeFetch('/api/print-logs', []),
        safeFetch('/api/push-notifications', []),
        safeFetch('/api/analytics', fallbackAnalytics),
        safeFetch('/api/tables', []),
        safeFetch('/api/reservations', []),
        safeFetch('/api/settings/service-pause', { servicePaused: false }),
      ];

      if (isFullCycle) {
        promises.push(
          safeFetch('/api/menu', []),
          safeFetch('/api/categories', []),
          safeFetch('/api/printer/config', {}),
          safeFetch('/api/settings/min-spend', { minSpend: 200 }),
          safeFetch('/api/settings/operating-hours', {}),
          safeFetch('/api/settings/customer-notice', {}),
          safeFetch('/api/promo-combo', {
            enabled: true,
            requiredQty: 10,
            discountAmount: 20,
            eligibleItemIds: [],
          }),
          safeFetch('/api/settings/popular-item-ids', ['ty-01', 'nd-01', 'sk-02', 'sk-01']),
          safeFetch('/api/settings/members-config', { pointsRatio: 20, rewards: [] }),
        );
      }

      const results = await Promise.all(promises);

      const safeJson = async (res: Response, fallback: any, _label: string) => {
        try {
          if (!res.ok) return fallback;
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) return fallback;
          return await res.json();
        } catch (e) {
          return fallback;
        }
      };

      const ingData = await safeJson(results[0], [], 'ingredients');
      const ordData = await safeJson(results[1], [], 'orders');
      const printData = await safeJson(results[2], [], 'print-logs');
      const notifData = await safeJson(results[3], [], 'push-notifications');
      const alyData = await safeJson(results[4], fallbackAnalytics, 'analytics');
      const tablesData = await safeJson(results[5], [], 'tables');
      const resveData = await safeJson(results[6], [], 'reservations');
      const servicePauseData = await safeJson(results[7], { servicePaused: false }, 'service-pause');

      setIngredients(ingData);
      setOrders(ordData);
      setPrintLogs(printData);
      setTables(tablesData);
      setReservations(resveData);
      setAnalytics(alyData);
      if (servicePauseData) setServicePaused(!!servicePauseData.servicePaused);
      if (Array.isArray(notifData)) setPushNotifications(notifData.filter((n: any) => !n.isRead));

      if (isFullCycle && results.length > 8) {
        const menuData = await safeJson(results[8], [], 'menu');
        const catData = await safeJson(results[9], [], 'categories');
        const printerData = await safeJson(results[10], {}, 'printer-config');
        const minSpendData = await safeJson(results[11], { minSpend: 200 }, 'min-spend');
        const opHoursData = await safeJson(results[12], {}, 'operating-hours');
        const noticeData = await safeJson(results[13], {}, 'customer-notice');
        const promoData = await safeJson(
          results[14],
          { enabled: false, requiredQty: 0, discountAmount: 0, eligibleItemIds: [] },
          'promo-combo',
        );
        const popularData = await safeJson(
          results[15],
          ['ty-01', 'nd-01', 'sk-02', 'sk-01'],
          'popular-item-ids',
        );
        const memberConfigData = await safeJson(
          results[16],
          { pointsRatio: 20, rewards: [] },
          'members-config',
        );

        if (bypassReorderLock || fetchStartTime > lastMenuReorderTimeRef.current)
          setMenuItems(menuData);
        setPrinterIp(printerData.ip || '192.168.123.100');
        if (Array.isArray(popularData)) setPopularItemIds(popularData);
        if (memberConfigData) {
          if (memberConfigData.pointsRatio !== undefined)
            setMemberPointsRatio(memberConfigData.pointsRatio);
          if (memberConfigData.rewards) setMemberRewards(memberConfigData.rewards);
        }
        if (promoData) setPromoCombo(promoData);
        if (minSpendData && minSpendData.minSpend !== undefined) setMinSpend(minSpendData.minSpend);
        if (opHoursData) {
          if (opHoursData.slots) setOperatingHours(opHoursData.slots);
          if (opHoursData.restDays) setRestDays(opHoursData.restDays);
          setIsOpen(opHoursData.isOpen ?? true);
        }
        if (noticeData && noticeData.notice !== undefined) setCustomerNotice(noticeData.notice);
        if (bypassReorderLock || fetchStartTime > lastCategoryReorderTimeRef.current)
          setCategories(catData);
      }
    } catch (err: any) {
      console.warn('[Sabay Sync] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useQuery({
    queryKey: ['globalDataPolling'],
    queryFn: async () => {
      await fetchData(false);
      return null;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {

    let unsubscribeOrders = () => {};
    let unsubscribeIngredients = () => {};

    if (isFirebaseSyncEnabled()) {
      try {
        const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        unsubscribeOrders = onSnapshot(
          ordersQuery,
          (snapshot) => {
            const updatedOrders = snapshot.docs.map((doc) => ({ ...doc.data() }) as Order);
            setOrders(updatedOrders);
          },
          (error) => {
            console.warn('[Firebase Sync] Orders listener paused/disabled:', error);
          },
        );

        unsubscribeIngredients = onSnapshot(
          collection(db, 'ingredients'),
          (snapshot) => {
            const updatedIngredients = snapshot.docs.map((doc) => doc.data() as Ingredient);
            setIngredients(updatedIngredients);
          },
          (error) => {
            console.warn('[Firebase Sync] Ingredients listener paused/disabled:', error);
          },
        );
      } catch (e) {
        console.warn('[Firebase Sync] Realtime listener initialization skipped:', e);
      }
    } else {
      console.log('⛔ [Firebase Sync] Firebase disabled, using local polling.');
    }
    return () => {
      unsubscribeOrders();
      unsubscribeIngredients();
    };
  }, []);

  const value = {
    lang,
    setLang,
    menuItems,
    setMenuItems,
    ingredients,
    setIngredients,
    orders,
    setOrders,
    categories,
    setCategories,
    tables,
    setTables,
    reservations,
    minSpend,
    setMinSpend,
    promoCombo,
    setPromoCombo,
    operatingHours,
    setOperatingHours,
    isOpen,
    setIsOpen,
    restDays,
    setRestDays,
    customerNotice,
    setCustomerNotice,
    servicePaused,
    setServicePaused,
    popularItemIds,
    setPopularItemIds,
    memberPointsRatio,
    setMemberPointsRatio,
    memberRewards,
    setMemberRewards,
    printLogs,
    setPrintLogs,
    printerIp,
    setPrinterIp,
    pushNotifications,
    setPushNotifications,
    analytics,
    setAnalytics,
    loading,
    offlineQueue,
    isSyncing,
    syncProgressMsg,
    isNetworkOnline,
    fetchData,
    handleForceSync,
  };

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
};
