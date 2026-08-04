import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useGlobalState } from './contexts/GlobalContext';
import {
  Language,
  MenuItem,
  Ingredient,
  Order,
  OrderStatus,
  OrderItem,
  Category,
  TableConfig,
  OperatingHourSlot,
  Reservation,
} from './types';
import {
  getOfflineQueue,
  addRequestToQueue,
  clearOfflineQueue,
  processOfflineQueue,
  QueuedRequest,
} from './lib/offlineQueue';
import { safeStorage } from './lib/safeStorage';
import { apiFetch } from './lib/api';
import { db, isFirebaseSyncEnabled } from './lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { TRANSLATIONS, INITIAL_MENU, INITIAL_CATEGORIES } from './data';
import { LanguageSelector } from './components/LanguageSelector';

const CustomerOrderView = lazy(() => import('./components/CustomerOrderView').then(m => ({ default: m.CustomerOrderView })));
const KitchenDisplaySystem = lazy(() => import('./components/KitchenDisplaySystem').then(m => ({ default: m.KitchenDisplaySystem })));
const ManagerDashboard = lazy(() => import('./components/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));
const StaffLoginGate = lazy(() => import('./components/StaffLoginGate').then(m => ({ default: m.StaffLoginGate })));
import {
  ChefHat,
  Smartphone,
  BarChart3,
  UtensilsCrossed,
  LogOut,
  Lock,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Coins,
  Monitor,
} from 'lucide-react';

interface AnalyticsData {
  totalRevenue: number;
  ordersCount: number;
  categorySales: { category: string; revenue: number }[];
  hourlyDistribution: { timeSlot: string; orders: number }[];
  topDishes: { name: string; qty: number }[];
  stockWarnings: Ingredient[];
}

export default function App() {

  const {
    lang, setLang, menuItems, setMenuItems, ingredients, setIngredients, orders, setOrders,
    categories, setCategories, tables, setTables, reservations, minSpend, setMinSpend, promoCombo, setPromoCombo,
    operatingHours, setOperatingHours, isOpen, setIsOpen, restDays, setRestDays, customerNotice, setCustomerNotice, servicePaused, setServicePaused, popularItemIds, setPopularItemIds,
    memberPointsRatio, setMemberPointsRatio, memberRewards, setMemberRewards, printLogs, setPrintLogs, printerIp, setPrinterIp, pushNotifications, setPushNotifications, analytics, setAnalytics,
    loading, offlineQueue, isSyncing, syncProgressMsg, isNetworkOnline, fetchData, handleForceSync
  } = useGlobalState();
  
  const [localOrderIds, setLocalOrderIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem('sabay-my-submitted-order-ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showContactDetails, setShowContactDetails] = useState(false);
  const activeOrderSubmissionsRef = useRef<Set<string>>(new Set());
  const lastCategoryReorderTimeRef = useRef<number>(0);
  const lastMenuReorderTimeRef = useRef<number>(0);


  const handleLanguageChange = setLang;

  const [activeTab, setActiveTab] = useState<'customer' | 'kitchen' | 'admin' | 'cashier'>(
    'customer',
  );

  const [adminSubTab, setAdminSubTab] = useState<
    | 'stats'
    | 'orders'
    | 'inventory'
    | 'menu'
    | 'members'
    | 'cashier'
    | 'printer'
    | 'options'
    | 'eod'
    | 'terminal'
    | undefined
  >(undefined);

  // Secure staff role gating
  const [isStaff, setIsStaff] = useState<boolean>(false);

  // Path routing states
  const [staffPin, setStaffPin] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const isSuperEntry = currentPath === '/FSY20260606';
  const isAtStaffPath = currentPath === '/888888' || isSuperEntry;

  useEffect(() => {
    if (currentPath === '/FSY20260606') {
      setIsStaff(true);
      setStaffPin('FSY20260606');
    } else if (currentPath === '/888888') {
      setStaffPin('888888');
    }
  }, [currentPath]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Simple keyboard hotkeys for switching staff workspace tabs instantly (Ctrl+1 to Ctrl+5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('cashier');
          setAdminSubTab('cashier');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('kitchen');
          setAdminSubTab(undefined);
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('admin');
          setAdminSubTab('stats');
        } else if (e.key === '4') {
          e.preventDefault();
          navigateTo('/');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('admin');
          setAdminSubTab('eod');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // 🔄 自動連動桌席狀態與訂單/KDS/預約 (Real-time Table Status Auto-Sync)
  useEffect(() => {
    if (!tables || tables.length === 0) return;

    const checkAndSyncTables = () => {
      const nowMs = Date.now();
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const dy = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yr}-${mo}-${dy}`;

      setTables((prevTables) => {
        let hasChanges = false;
        const newTables = prevTables.map((tb) => {
          const tblId = String(tb.id).trim();

          // 1. 該桌目前尚未結帳/取消的有效訂單
          const activeOrders = orders.filter(
            (o) => String(o.tableNumber).trim() === tblId && o.status !== 'cancelled',
          );

          const unpaidActiveOrders = activeOrders.filter(
            (o) => !o.isPaid && o.status !== 'completed' && o.status !== 'paid',
          );

          if (unpaidActiveOrders.length > 0) {
            const targetStatus = tb.status === 'pending_checkout' ? 'pending_checkout' : 'in_use';
            if (tb.status !== targetStatus || tb.preservedFor || tb.cleaningStartedAt) {
              hasChanges = true;
              return { ...tb, status: targetStatus, preservedFor: '', cleaningStartedAt: null };
            }
            return tb;
          }

          // 2. 原本為入座或待結帳，但已無未付款的有效訂單 -> 自動轉為「清潔中」15 分鐘緩衝
          if (tb.status === 'in_use' || tb.status === 'pending_checkout') {
            hasChanges = true;
            return {
              ...tb,
              status: 'cleaning',
              cleaningStartedAt: tb.cleaningStartedAt || new Date().toISOString(),
            };
          }

          // 3. 若處於清潔中，檢查是否已超過 15 分鐘無新訂單
          if (tb.status === 'cleaning') {
            let cleaningStartMs = tb.cleaningStartedAt
              ? new Date(tb.cleaningStartedAt).getTime()
              : 0;
            if (!cleaningStartMs || isNaN(cleaningStartMs)) {
              // Fallback to latest paid order timestamp
              const latestOrder = activeOrders.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              )[0];
              if (latestOrder && latestOrder.createdAt) {
                cleaningStartMs = new Date(latestOrder.createdAt).getTime();
              } else {
                cleaningStartMs = nowMs;
              }
            }

            // 15 分鐘 (900,000 毫秒) 緩衝結束且無新訂單 -> 自動轉為「空桌」或「預約」
            if (nowMs - cleaningStartMs >= 15 * 60 * 1000) {
              // 檢查今日後續是否有預約
              const todayPendingRes = reservations.find(
                (r) =>
                  String(r.tableNumber).trim() === tblId &&
                  (r.status === 'pending' || r.status === 'upcoming' || r.status === 'confirmed') &&
                  r.date.trim() === todayStr,
              );

              hasChanges = true;
              if (todayPendingRes) {
                return {
                  ...tb,
                  status: 'preserved',
                  preservedFor: `${todayPendingRes.customerName} (${todayPendingRes.time})`,
                  cleaningStartedAt: null,
                };
              }
              return {
                ...tb,
                status: 'available',
                preservedFor: '',
                cleaningStartedAt: null,
              };
            }

            // 仍在 15 分鐘清潔緩衝期中
            return tb;
          }

          // 4. 檢查今日是否有預約訂位
          const todayPendingRes = reservations.find(
            (r) =>
              String(r.tableNumber).trim() === tblId &&
              (r.status === 'pending' || r.status === 'upcoming' || r.status === 'confirmed') &&
              r.date.trim() === todayStr,
          );

          if (todayPendingRes) {
            const presText = `${todayPendingRes.customerName} (${todayPendingRes.time})`;
            if (tb.status !== 'preserved' || tb.preservedFor !== presText) {
              hasChanges = true;
              return {
                ...tb,
                status: 'preserved',
                preservedFor: presText,
                cleaningStartedAt: null,
              };
            }
          } else if (tb.status === 'preserved') {
            hasChanges = true;
            return { ...tb, status: 'available', preservedFor: '', cleaningStartedAt: null };
          }

          return tb;
        });

        return hasChanges ? newTables : prevTables;
      });
    };

    checkAndSyncTables();
    const interval = setInterval(checkAndSyncTables, 10000);
    return () => clearInterval(interval);
  }, [orders, reservations]);

  // 1. Submit Online Order
  const handlePlaceOrder = async (orderData: {
    tableNumber: string;
    items: OrderItem[];
    paymentMethod: 'cash' | 'credit' | 'member' | 'twqr';
    guestCount?: number;
    clientOrderId?: string;
    reservationNo?: string;
    reservationDate?: string;
    reservationTime?: string;
  }) => {
    const clientOrderId =
      orderData.clientOrderId ||
      `client_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (activeOrderSubmissionsRef.current.has(clientOrderId)) {
      console.log(
        `[Sabay App] Already submitting order with clientOrderId: ${clientOrderId}. Blocking duplicate call.`,
      );
      return null;
    }
    activeOrderSubmissionsRef.current.add(clientOrderId);

    if (
      orderData.tableNumber &&
      orderData.tableNumber !== '外帶' &&
      orderData.tableNumber !== 'takeout'
    ) {
      handleUpdateTableStatus(orderData.tableNumber, {
        status: 'in_use',
        preservedFor: '',
        cleaningStartedAt: null,
      });
    }

    const orderPayload = {
      ...orderData,
      customerName: undefined,
      customerAvatar: undefined,
      isMember: false,
      clientOrderId,
    };
    const totalAmount = orderData.items.reduce((sum, item) => {
      let unitP = item.price;
      if (item.customization?.spiciness === 3) unitP += 10;
      if (item.customization?.soupBase === 'coconut-milk') unitP += 50;
      if (item.customization?.selectedAddOns && Array.isArray(item.customization.selectedAddOns)) {
        unitP += item.customization.selectedAddOns.reduce((s, a) => s + (Number(a.price) || 0), 0);
      }
      return sum + unitP * item.qty;
    }, 0);
    const tempId = `offline_temp_${Date.now()}`;
    const description = `桌號 🥢 ${orderData.tableNumber || '外帶'} • 點購 ${orderData.items.length} 份餐點 (金額: $${totalAmount})`;

    // Check if offline
    if (!navigator.onLine) {
      console.log('[Sabay Offline] Intercepting order submission offline...');
      addRequestToQueue('/api/orders', 'POST', orderPayload, description);

      const completedOrder: Order = {
        id: tempId,
        tableNumber: orderData.tableNumber,
        items: orderData.items,
        paymentMethod: orderData.paymentMethod,
        status: 'pending',
        createdAt: new Date().toISOString(),
        subtotal: totalAmount,
        serviceCharge: 0,
        total: totalAmount,
        customerName: orderPayload.customerName || '',
        customerAvatar: orderPayload.customerAvatar || '',
        isMember: orderPayload.isMember || false,
        isOfflinePending: true,
      };

      setOrders((prev) => [completedOrder, ...prev]);
      setLocalOrderIds((prev) => {
        const updated = [...prev, tempId];
        safeStorage.setItem('sabay-my-submitted-order-ids', JSON.stringify(updated));
        return updated;
      });
      activeOrderSubmissionsRef.current.delete(clientOrderId);
      return completedOrder;
    }

    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const errorDetail = await res.json();
        console.error('[Sabay Ordering Error]', errorDetail.error);
        activeOrderSubmissionsRef.current.delete(clientOrderId);
        return null;
      }

      const completedOrder = await res.json();
      if (completedOrder && completedOrder.id) {
        setLocalOrderIds((prev) => {
          const updated = [...prev, completedOrder.id];
          safeStorage.setItem('sabay-my-submitted-order-ids', JSON.stringify(updated));
          return updated;
        });
      }
      await fetchData();
      activeOrderSubmissionsRef.current.delete(clientOrderId);
      return completedOrder;
    } catch (err) {
      console.warn('[Sabay Ordering failed, falling back to cache queue]', err);
      addRequestToQueue('/api/orders', 'POST', orderPayload, description);

      const completedOrder: Order = {
        id: tempId,
        tableNumber: orderData.tableNumber,
        items: orderData.items,
        paymentMethod: orderData.paymentMethod,
        status: 'pending',
        createdAt: new Date().toISOString(),
        subtotal: totalAmount,
        serviceCharge: 0,
        total: totalAmount,
        customerName: orderPayload.customerName || '',
        customerAvatar: orderPayload.customerAvatar || '',
        isMember: orderPayload.isMember || false,
        isOfflinePending: true,
      };

      setOrders((prev) => [completedOrder, ...prev]);
      setLocalOrderIds((prev) => {
        const updated = [...prev, tempId];
        safeStorage.setItem('sabay-my-submitted-order-ids', JSON.stringify(updated));
        return updated;
      });
      activeOrderSubmissionsRef.current.delete(clientOrderId);
      return completedOrder;
    }
  };

  // 2. Kitchen Status Updater
  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const description = `更新 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 狀態至「${status}」`;

    // Check if offline
    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      console.log('[Sabay Offline] Intercepting state change offline...');
      addRequestToQueue(`/api/orders/${orderId}/status`, 'PUT', { status }, description);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status, isOfflinePending: true } : o)),
      );
      return;
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        addRequestToQueue(`/api/orders/${orderId}/status`, 'PUT', { status }, description);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status, isOfflinePending: true } : o)),
        );
      }
    } catch (err) {
      console.warn('[Offline Fallback] Update Order Status failed, queued:', err);
      addRequestToQueue(`/api/orders/${orderId}/status`, 'PUT', { status }, description);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status, isOfflinePending: true } : o)),
      );
    }
  };

  // 2.2.5 Toggle Single Order Item Complete / Prepared
  const handleToggleOrderItemComplete = async (
    orderId: string,
    itemId: string,
    isCompleted: boolean,
    isPrepared?: boolean,
  ) => {
    const description = `更新 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 內單一商品狀態`;

    // Optimistically update local orders state
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updatedItems = o.items.map((it) => {
            if (it.id === itemId) {
              const prep =
                typeof isPrepared !== 'undefined'
                  ? isPrepared
                  : isCompleted
                    ? true
                    : it.isPrepared || false;
              return { ...it, isCompleted, isPrepared: prep };
            }
            return it;
          });
          const allCompleted = updatedItems.every((item) => item.isCompleted);
          // Don't auto-complete paid orders — kitchen must explicitly press 出餐完成
          const status =
            allCompleted && o.status !== 'paid'
              ? 'completed'
              : o.status === 'completed'
                ? 'preparing'
                : o.status;
          return { ...o, items: updatedItems, status };
        }
        return o;
      }),
    );

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(
        `/api/orders/${orderId}/items/${itemId}/complete`,
        'PUT',
        { isCompleted, isPrepared },
        description,
      );
      return;
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/items/${itemId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted, isPrepared }),
      });
      if (res.ok) {
        const updatedOrder = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
      } else {
        addRequestToQueue(
          `/api/orders/${orderId}/items/${itemId}/complete`,
          'PUT',
          { isCompleted, isPrepared },
          description,
        );
      }
    } catch (err) {
      console.warn('[Offline Fallback] Toggle order item state failed, queued:', err);
      addRequestToQueue(
        `/api/orders/${orderId}/items/${itemId}/complete`,
        'PUT',
        { isCompleted, isPrepared },
        description,
      );
    }
  };

  // 2.3 Order Table Number / Takeout Modifier (Admin/Cashier View Override)
  const handleUpdateTableNumber = async (orderId: string, tableNumber: string) => {
    const description = `修改 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 的桌號至 ${tableNumber} 桌`;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, tableNumber, isOfflinePending: true } : o)),
    );

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(`/api/orders/${orderId}/table-number`, 'PUT', { tableNumber }, description);
      return { success: true };
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/table-number`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber }),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      }
      addRequestToQueue(`/api/orders/${orderId}/table-number`, 'PUT', { tableNumber }, description);
      return { success: true };
    } catch (err: any) {
      console.warn('[Offline Fallback] Update table number failed, queued:', err);
      addRequestToQueue(`/api/orders/${orderId}/table-number`, 'PUT', { tableNumber }, description);
      return { success: true };
    }
  };

  // 2.3.5 Order Quick Notes Updater (Speech / Audio Text input on KDS)
  const handleUpdateQuickNotes = async (orderId: string, quickNotes: string) => {
    const description = `更新 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 備註: "${quickNotes}"`;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, quickNotes, isOfflinePending: true } : o)),
    );

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(`/api/orders/${orderId}/quick-notes`, 'PUT', { quickNotes }, description);
      return { success: true };
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/quick-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickNotes }),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      }
      addRequestToQueue(`/api/orders/${orderId}/quick-notes`, 'PUT', { quickNotes }, description);
      return { success: true };
    } catch (err: any) {
      console.warn('[Offline Fallback] Update quick notes failed, queued:', err);
      addRequestToQueue(`/api/orders/${orderId}/quick-notes`, 'PUT', { quickNotes }, description);
      return { success: true };
    }
  };

  // 2.3.6 Toggle Attention Flag status & update flagged custom reason on order
  const handleToggleOrderFlag = async (orderId: string, isFlagged: boolean, flagReason: string) => {
    const description = `設定 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 關注旗幟 ${isFlagged ? 'ON' : 'OFF'}`;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, isFlagged, flagReason, isOfflinePending: true } : o,
      ),
    );

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(
        `/api/orders/${orderId}/flag`,
        'PUT',
        { isFlagged, flagReason },
        description,
      );
      return { success: true };
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/flag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFlagged, flagReason }),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      }
      addRequestToQueue(
        `/api/orders/${orderId}/flag`,
        'PUT',
        { isFlagged, flagReason },
        description,
      );
      return { success: true };
    } catch (err: any) {
      console.warn('[Offline Fallback] Toggle order flag failed, queued:', err);
      addRequestToQueue(
        `/api/orders/${orderId}/flag`,
        'PUT',
        { isFlagged, flagReason },
        description,
      );
      return { success: true };
    }
  };

  // 2.4 Update Order Items list (add / remove qty inside order items)
  const handleUpdateOrderItems = async (orderId: string, items: any[], refundLogs?: any[]) => {
    const description = `調整 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 品項數量`;
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * (item.qty || item.quantity || 0),
      0,
    );
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items, subtotal: totalAmount, total: totalAmount, isOfflinePending: true }
          : o,
      ),
    );

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(`/api/orders/${orderId}/items`, 'PUT', { items, refundLogs }, description);
      return;
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, refundLogs }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        addRequestToQueue(
          `/api/orders/${orderId}/items`,
          'PUT',
          { items, refundLogs },
          description,
        );
      }
    } catch (err) {
      console.warn('[Offline Fallback] Update order items failed, queued:', err);
      addRequestToQueue(`/api/orders/${orderId}/items`, 'PUT', { items, refundLogs }, description);
    }
  };

  // 2.5 Order Cashier Register Checkout handler
  const handlePayOrder = async (
    orderId: string,
    checkoutData?: {
      paymentMethod?: string;
      subtotal?: number;
      serviceCharge?: number;
      total?: number;
      discount?: number;
      isPaid?: boolean;
    },
    skipRefresh?: boolean,
  ) => {
    const description = `結帳 🥢 訂單 #${orderId.replace('offline_temp_', '離線')} 完成付款`;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, isPaid: true, status: 'paid' as OrderStatus, isOfflinePending: true }
          : o,
      ),
    );

    // 🔒 結帳完成後一併刪除相對應的「預約訂位點餐專屬通道」
    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetOrder) {
      if (
        targetOrder.tableNumber &&
        targetOrder.tableNumber !== '外帶' &&
        targetOrder.tableNumber !== 'takeout'
      ) {
        const remainingUnpaid = orders.filter(
          (o) =>
            o.tableNumber === targetOrder.tableNumber &&
            o.id !== orderId &&
            !o.isPaid &&
            o.status !== 'cancelled',
        );
        if (remainingUnpaid.length === 0) {
          handleUpdateTableStatus(targetOrder.tableNumber, {
            status: 'cleaning',
            cleaningStartedAt: new Date().toISOString(),
          });
        }
      }
      const resNo = targetOrder.reservationNo;
      const matchingRes = (reservations || []).find(
        (r) =>
          (resNo && (r.id === resNo || (r as any).reservationNo === resNo)) ||
          (r.tableNumber === targetOrder.tableNumber && r.date === targetOrder.reservationDate),
      );
      if (matchingRes) {
        console.log(
          `[Checkout Cleanup] Deleting reservation ${matchingRes.id} associated with paid order ${orderId}`,
        );
        handleDeleteReservation(matchingRes.id);
      }
    }

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(
        `/api/orders/${orderId}/checkout`,
        'PUT',
        checkoutData || { isPaid: true },
        description,
      );
      return;
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}/checkout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData || { isPaid: true }),
      });
      if (res.ok) {
        if (!skipRefresh) {
          await fetchData();
        }
      } else {
        addRequestToQueue(
          `/api/orders/${orderId}/checkout`,
          'PUT',
          checkoutData || { isPaid: true },
          description,
        );
      }
    } catch (err) {
      console.warn('[Offline Fallback] Pay order failed, queued:', err);
      addRequestToQueue(
        `/api/orders/${orderId}/checkout`,
        'PUT',
        checkoutData || { isPaid: true },
        description,
      );
    }
  };

  // 2.4.5 Delete Order
  const handleDeleteOrder = async (orderId: string) => {
    const description = `刪除 🥢 訂單 #${orderId.replace('offline_temp_', '離線')}`;
    setOrders((prev) => prev.filter((o) => o.id !== orderId));

    if (!navigator.onLine || orderId.startsWith('offline_temp_')) {
      addRequestToQueue(`/api/orders/${orderId}`, 'DELETE', {}, description);
      return { success: true };
    }

    try {
      const res = await apiFetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        addRequestToQueue(`/api/orders/${orderId}`, 'DELETE', {}, description);
        return { success: false };
      }
    } catch (err) {
      console.warn('[Offline Fallback] Delete order failed, queued:', err);
      addRequestToQueue(`/api/orders/${orderId}`, 'DELETE', {}, description);
      return { success: true };
    }
  };

  // 3. Manager Raw materials Restock
  const handleRestock = async (id: string, amount: number) => {
    try {
      await apiFetch('/api/ingredients/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, amount }),
      });
      await fetchData();
    } catch (err) {
      console.error('[Sabay Stocking update error]', err);
    }
  };

  const handleAddIngredient = async (
    id: string,
    name: { zh: string; en?: string },
    stock: number,
    minThreshold: number,
    unit: string,
  ) => {
    try {
      const res = await apiFetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, stock, minThreshold, unit }),
      });
      if (!res.ok) {
        const errData = await res.json();
        return { success: false, error: errData.error || 'Failed to add ingredient' };
      }
      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('[Add Ingredient Error]', err);
      return { success: false, error: 'Network error adding ingredient' };
    }
  };

  // 4. Send Promotional Push Notification Coupon
  const handleSendPromoPush = async (notif: { title: string; message: string; badge: string }) => {
    try {
      await apiFetch('/api/send-promo-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notif),
      });
      await fetchData();
    } catch (err) {
      console.error('[Sabay Push delivery failed]', err);
    }
  };

  // 5. Hide / Show out-of-stock items (設為沽清 / 恢復販售)
  const handleToggleMenuItemAvailability = async (id: string) => {
    lastMenuReorderTimeRef.current = Date.now() + 15000;

    // Optimistic UI state update so button toggles instantly
    setMenuItems((prev) => prev.map((m) => (m.id === id ? { ...m, available: !m.available } : m)));

    try {
      const res = await apiFetch('/api/menu/toggle-available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.item) {
          setMenuItems((prev) =>
            prev.map((m) => (m.id === id ? { ...m, available: data.item.available } : m)),
          );
        }
      } else {
        // Revert on HTTP failure
        setMenuItems((prev) =>
          prev.map((m) => (m.id === id ? { ...m, available: !m.available } : m)),
        );
      }
      await fetchData(true, false);
    } catch (err) {
      console.error('[Sabay Menu lock toggle error]', err);
      // Revert on exception
      setMenuItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, available: !m.available } : m)),
      );
    }
  };

  // 5.5 Adjust ingredient stock count manually
  const handleAdjustIngredientStock = async (
    ingredientId: string,
    quantityChanged: number,
    note: string,
  ) => {
    const description = `調整原料庫存 ID:${ingredientId} (${quantityChanged > 0 ? '+' : ''}${quantityChanged})`;
    if (!navigator.onLine) {
      addRequestToQueue(
        '/api/inventory/adjust',
        'POST',
        { ingredientId, quantityChanged, note },
        description,
      );
      setIngredients((prev) =>
        prev.map((i) => (i.id === ingredientId ? { ...i, stock: i.stock + quantityChanged } : i)),
      );
      return;
    }
    try {
      await apiFetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId, quantityChanged, note }),
      });
      await fetchData();
    } catch (err) {
      addRequestToQueue(
        '/api/inventory/adjust',
        'POST',
        { ingredientId, quantityChanged, note },
        description,
      );
    }
  };

  // 6. Virtual Printing Tray Cleared
  const handleClearPrintLogs = async () => {
    try {
      await apiFetch('/api/print-logs/clear', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('[Sabay Printer Clear error]', err);
    }
  };

  // 7. Add Menu Item (Dishes)
  const handleAddMenuItem = async (itemData: any) => {
    lastMenuReorderTimeRef.current = Date.now();
    try {
      const res = await apiFetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        await fetchData(true, true);
      }
    } catch (err) {
      console.error('[Sabay Menu Add error]', err);
    }
  };

  // 8. Edit Menu Item (Dishes)
  const handleEditMenuItem = async (id: string, itemData: any) => {
    lastMenuReorderTimeRef.current = Date.now();
    try {
      const res = await apiFetch(`/api/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
      if (res.ok) {
        await fetchData(true, true);
      }
    } catch (err) {
      console.error('[Sabay Menu Edit error]', err);
    }
  };

  // 8.5 Delete Menu Item
  const handleDeleteMenuItem = async (id: string) => {
    lastMenuReorderTimeRef.current = Date.now();
    try {
      const res = await apiFetch(`/api/menu/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData(true, true);
      }
    } catch (err) {
      console.error('[Sabay Menu Delete error]', err);
    }
  };

  // Category Mutation Handlers
  const handleAddCategory = async (id: string, name: any, showOnCustomerPage?: boolean) => {
    lastCategoryReorderTimeRef.current = Date.now();
    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, showOnCustomerPage }),
      });
      if (res.ok) {
        await fetchData(true, true);
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法新增類別' };
      }
    } catch (err: any) {
      console.error('[Sabay Category Add error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleEditCategory = async (id: string, name: any, showOnCustomerPage?: boolean) => {
    lastCategoryReorderTimeRef.current = Date.now();
    try {
      const res = await apiFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, showOnCustomerPage }),
      });
      if (res.ok) {
        await fetchData(true, true);
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法編輯類別' };
      }
    } catch (err: any) {
      console.error('[Sabay Category Edit error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleDeleteCategory = async (id: string) => {
    lastCategoryReorderTimeRef.current = Date.now();
    try {
      const res = await apiFetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData(true, true);
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法刪除類別' };
      }
    } catch (err: any) {
      console.error('[Sabay Category Delete error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleReorderCategories = async (order: string[]) => {
    lastCategoryReorderTimeRef.current = Date.now() + 15000;
    // Optimistic UI state update to prevent consecutive-click race conditions and latency lag
    const mappedCategories = order
      .map((id) => categories.find((c) => c.id === id))
      .filter((c): c is Category => !!c);
    setCategories(mappedCategories);

    try {
      const res = await apiFetch('/api/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
        // Fetch remaining components but respect the 15-second reorder lock to prevent instant revert
        await fetchData(true, false);
      }
    } catch (err) {
      console.error('[Sabay Categories Reorder error]', err);
    }
  };

  const handleReorderMenuItems = async (order: string[]) => {
    lastMenuReorderTimeRef.current = Date.now() + 15000;
    // Optimistic UI state update to prevent consecutive-click race conditions and latency lag
    const mappedItems = order
      .map((id) => menuItems.find((m) => m.id === id))
      .filter((m): m is any => !!m);
    setMenuItems(mappedItems);

    try {
      const res = await apiFetch('/api/menu/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.menu)) {
          setMenuItems(data.menu);
        }
        // Fetch remaining components but respect the 15-second reorder lock to prevent instant revert
        await fetchData(true, false);
      }
    } catch (err) {
      console.error('[Sabay Menu Reorder error]', err);
    }
  };

  const handleToggleServicePause = async (paused: boolean) => {
    try {
      const res = await apiFetch('/api/settings/service-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicePaused: paused }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('[Sabay Service Pause Toggle Error]', err);
    }
  };

  // Table Mutation Handlers
  const handleAddTable = async (id: string, qrCodeUrl?: string, maxCapacity?: number) => {
    try {
      const res = await apiFetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, qrCodeUrl, maxCapacity }),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法新增桌號' };
      }
    } catch (err: any) {
      console.error('[Add Table error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleEditTable = async (id: string, qrCodeUrl: string, maxCapacity?: number) => {
    try {
      const res = await apiFetch(`/api/tables/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeUrl, maxCapacity }),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法編輯桌號 QR CODE' };
      }
    } catch (err: any) {
      console.error('[Edit Table error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleDeleteTable = async (id: string) => {
    try {
      const res = await apiFetch(`/api/tables/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法刪除桌號' };
      }
    } catch (err: any) {
      console.error('[Delete Table error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleUpdateTableStatus = async (
    id: string,
    updates: Partial<Omit<TableConfig, 'id' | 'qrCodeUrl'>>,
  ) => {
    const description = `變更 🥢 ${id} 桌狀態 -> ${updates.status || '設定項目'}`;
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, isOfflinePending: true } : t)),
    );

    if (!navigator.onLine) {
      addRequestToQueue(`/api/tables/${encodeURIComponent(id)}`, 'PUT', updates, description);
      return { success: true };
    }

    try {
      const res = await apiFetch(`/api/tables/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        addRequestToQueue(`/api/tables/${encodeURIComponent(id)}`, 'PUT', updates, description);
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[Offline Fallback] Update Table Status failed, queued:', err);
      addRequestToQueue(`/api/tables/${encodeURIComponent(id)}`, 'PUT', updates, description);
      return { success: true };
    }
  };

  const handleAddReservation = async (reservation: Omit<Reservation, 'id' | 'createdAt'>) => {
    const maxThreeMonthsDateStr = (() => {
      const now = new Date();
      now.setMonth(now.getMonth() + 3);
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const dy = String(now.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${dy}`;
    })();

    if (reservation.date && reservation.date.trim() > maxThreeMonthsDateStr) {
      return {
        success: false,
        error: `預約日期最多只能提前 3 個月 (最晚至 ${maxThreeMonthsDateStr})！`,
      };
    }

    // 預約時段衝突檢測 (3小時用餐時間，同桌次同日期)
    const parseMins = (t: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const targetMins = parseMins(reservation.time);
    const targetTableStr = String(reservation.tableNumber).trim();
    const targetDateStr = String(reservation.date).trim();

    const conflict = (reservations || []).find((r) => {
      if (r.status === 'cancelled') return false;
      if (String(r.date).trim() !== targetDateStr) return false;
      if (String(r.tableNumber).trim() !== targetTableStr) return false;
      const rMins = parseMins(r.time);
      return Math.abs(rMins - targetMins) < 180;
    });

    if (conflict) {
      return {
        success: false,
        error: `預約時段衝突：【${reservation.tableNumber} 桌】在 ${reservation.date} ${reservation.time} 前後 3 小時內已有預約 (${conflict.time} ${conflict.customerName})，該時段無法重複預約。`,
      };
    }

    try {
      const res = await apiFetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法新增預約' };
      }
    } catch (err: any) {
      console.error('[Add Reservation Error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleUpdateReservation = async (id: string, updates: Partial<Reservation>) => {
    if (updates.date || updates.time || updates.tableNumber) {
      const current = (reservations || []).find((r) => r.id === id);
      const targetDate = (updates.date || current?.date || '').trim();
      const targetTime = (updates.time || current?.time || '').trim();
      const targetTable = String(updates.tableNumber || current?.tableNumber || '').trim();
      const targetStatus = updates.status || current?.status;

      if (targetDate && targetTime && targetTable && targetStatus !== 'cancelled') {
        const parseMins = (t: string) => {
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return (h || 0) * 60 + (m || 0);
        };
        const targetMins = parseMins(targetTime);
        const conflict = (reservations || []).find((r) => {
          if (r.id === id) return false;
          if (r.status === 'cancelled') return false;
          if (String(r.date).trim() !== targetDate) return false;
          if (String(r.tableNumber).trim() !== targetTable) return false;
          const rMins = parseMins(r.time);
          return Math.abs(rMins - targetMins) < 180;
        });

        if (conflict) {
          return {
            success: false,
            error: `預約時段衝突：【${targetTable} 桌】在 ${targetDate} ${targetTime} 前後 3 小時內已有預約 (${conflict.time} ${conflict.customerName})，該時段無法重複預約。`,
          };
        }
      }
    }

    try {
      const res = await apiFetch(`/api/reservations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法更新預約狀態' };
      }
    } catch (err: any) {
      console.error('[Update Reservation Error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  // ⏱️ Auto-check mechanism: Automatically mark pending reservations within 1 hour as "upcoming"
  useEffect(() => {
    if (!reservations || reservations.length === 0) return;
    const checkUpcomingInterval = setInterval(() => {
      const now = new Date();
      reservations.forEach((res) => {
        if (res.status === 'pending') {
          const [year, month, day] = res.date.split('-').map(Number);
          const [hour, minute] = res.time.split(':').map(Number);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
            const resDateTime = new Date(year, month - 1, day, hour, minute);
            const diffMinutes = (resDateTime.getTime() - now.getTime()) / (1000 * 60);
            if (diffMinutes > -120 && diffMinutes <= 60) {
              console.log(
                `[Client Auto-Check] Reservation ${res.id} (${res.customerName}) is within 1 hour, marking as upcoming.`,
              );
              handleUpdateReservation(res.id, { status: 'upcoming' });
            }
          }
        }
      });
    }, 10000);
    return () => clearInterval(checkUpcomingInterval);
  }, [reservations]);

  const handleDeleteReservation = async (id: string) => {
    try {
      const res = await apiFetch(`/api/reservations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error || '無法刪除預約' };
      }
    } catch (err: any) {
      console.error('[Delete Reservation Error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handleSavePromoComboConfig = async (newConfig: any) => {
    try {
      const res = await apiFetch('/api/promo-combo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.config) {
          setPromoCombo(data.config);
          return { success: true };
        }
      }
      return { success: false, error: '無法更新優惠套餐設定' };
    } catch (e: any) {
      console.error('[Save Promo Combo Config Error]', e);
      return { success: false, error: e.message || '連線錯誤' };
    }
  };

  const handleUpdateMinSpend = async (newVal: number) => {
    try {
      const res = await apiFetch('/api/settings/min-spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minSpend: newVal }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.minSpend !== undefined) {
          setMinSpend(data.minSpend);
          return { success: true };
        }
      }
      return { success: false, error: '無法更新低消設定' };
    } catch (e: any) {
      console.error('[Update Min Spend Error]', e);
      return { success: false, error: e.message || '連線錯誤' };
    }
  };

  const handleUpdateOperatingHours = async (slots: OperatingHourSlot[], restDays?: string[]) => {
    try {
      const res = await apiFetch('/api/settings/operating-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, restDays }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.slots) {
          setOperatingHours(data.slots);
          if (data.restDays) {
            setRestDays(data.restDays);
          }
          setIsOpen(data.isOpen ?? true);
          return { success: true };
        }
      }
      return { success: false, error: '無法更新營業時間設定' };
    } catch (e: any) {
      console.error('[Update Operating Hours Error]', e);
      return { success: false, error: e.message || '連線錯誤' };
    }
  };

  const handleUpdateCustomerNotice = async (notice: string) => {
    try {
      const res = await apiFetch('/api/settings/customer-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.notice !== undefined) {
          setCustomerNotice(data.notice);
          return { success: true };
        }
      }
      return { success: false, error: '無法更新顧客注意事項' };
    } catch (e: any) {
      console.error('[Update Customer Notice Error]', e);
      return { success: false, error: e.message || '連線錯誤' };
    }
  };

  const handleUpdatePopularItemIds = async (ids: string[]) => {
    try {
      const res = await apiFetch('/api/settings/popular-item-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popularItemIds: ids }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.popularItemIds) {
          setPopularItemIds(data.popularItemIds);
          return { success: true };
        }
      }
      return { success: false, error: '無法更新今日熱銷品項' };
    } catch (e: any) {
      console.error('[Update Popular Item Ids Error]', e);
      return { success: false, error: e.message || '連線錯誤' };
    }
  };

  const handleUpdatePrinterIp = async (ip: string) => {
    try {
      const res = await apiFetch('/api/printer/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      if (res.ok) {
        const d = await res.json();
        setPrinterIp(d.ip);
        return { success: true };
      } else {
        const d = await res.json();
        return { success: false, error: d.error || '無法更新印表機 IP' };
      }
    } catch (err: any) {
      console.error('[Update printer IP error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  const handlePrintTestPage = async (target?: 'kitchen' | 'bill' | 'all') => {
    try {
      let data: any = null;
      const targetVal = typeof target === 'string' ? target : 'all';
      const res = await apiFetch('/api/printer/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetVal }),
      });
      if (res.ok) {
        data = await res.json();
      }

      // If running on hosted environment, attempt local PC bridge relay if active
      if (
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        try {
          await fetch('http://localhost:3000/api/printer/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: targetVal }),
            signal: AbortSignal.timeout(1000),
          }).catch(() => {});
        } catch (e) {
          // Local bridge offline
        }
      }

      if (data && data.success) {
        await fetchData();

        // Note: Real physical ESC/POS thermal receipt print was handled directly by server
        // (via IP TCP Socket or LPT parallel port).
        // Browser window.print() is intentionally disabled for direct hardware dispatch
        // to prevent OS system default printer hijacking.
        return {
          success: true,
          message: data.message,
          tcpLog: data.hardwareLogs?.kitchen || data.hardwareLogs?.bill,
        };
      } else {
        const text = res ? await res.text() : '';
        let errorMsg = '列印測試頁失敗';
        try {
          const d = JSON.parse(text);
          errorMsg = d.error || d.message || errorMsg;
        } catch {
          if (text) errorMsg = text;
        }
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('[Print test page error]', err);
      return { success: false, error: err.message || '連線錯誤' };
    }
  };

  // Clear a single push notifying coupon on click
  const handleMarkNotificationRead = (notifId: string) => {
    setPushNotifications(pushNotifications.filter((n) => n.id !== notifId));
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white flex flex-col font-sans">
      {/* 1. COMPREHENSIVE NAVBAR */}
      <nav className="bg-[#161616] border-b border-white/10 text-white shrink-0 sticky top-0 z-40 transition-colors shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Logo area */}
            <div className="flex items-center space-x-2 sm:space-x-3 text-left min-w-0 flex-1 sm:flex-none">
              <div className="bg-[#E5B453] text-[#0F0F0F] p-1.5 sm:p-2 rounded-xl flex items-center justify-center shadow-md shadow-[#E5B453]/15 shrink-0">
                <UtensilsCrossed size={15} className="rotate-45 sm:size-[18px]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[10px] min-[360px]:text-[11px] min-[395px]:text-xs sm:text-sm md:text-base font-bold sm:tracking-widest font-serif flex items-center text-[#E5B453]">
                  <span className="block whitespace-normal break-words leading-tight max-w-[120px] min-[360px]:max-w-[150px] min-[395px]:max-w-[180px] sm:max-w-none">
                    {isAtStaffPath
                      ? '沙貝泰式燒烤 經營管理中心'
                      : lang === 'zh'
                        ? '沙貝燒烤'
                        : TRANSLATIONS.sabayBBQ[lang]}
                  </span>
                </h1>
                <span className="text-[10px] text-white/50 hidden sm:block font-sans tracking-wide truncate">
                  {isAtStaffPath
                    ? '🛡️ 員工專屬隔離安全驗證終端 (Autonomous Admin Terminal)'
                    : '桃園市大園區高鐵北路二段198號1樓 · 電話: 0966626408'}
                </span>
              </div>
            </div>

            {/* Viewport switch tabs */}
            <div className="hidden lg:flex items-center space-x-2">
              {isAtStaffPath ? (
                isStaff ? (
                  <div
                    className="flex bg-white/5 p-1 rounded-2xl border border-white/10 space-x-1 overflow-x-hidden shrink-0"
                    id="desktop-tab-selector"
                  >
                    <button
                      id="tab-btn-cashier-main"
                      onClick={() => {
                        setActiveTab('cashier');
                        setAdminSubTab('cashier');
                      }}
                      className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'cashier'
                          ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md shadow-[#E5B453]/15'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Coins size={14} />
                      <span className="whitespace-nowrap">
                        🛎️ 櫃檯收銀台{' '}
                        <kbd className="ml-1 bg-black/30 text-[10px] px-1 py-0.5 rounded border border-white/10">
                          Ctrl+1
                        </kbd>
                      </span>
                    </button>

                    <button
                      id="tab-btn-kitchen"
                      onClick={() => {
                        setActiveTab('kitchen');
                        setAdminSubTab(undefined);
                      }}
                      className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'kitchen'
                          ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md shadow-[#E5B453]/15'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ChefHat size={14} />
                      <span className="whitespace-nowrap">
                        🍳 廚房監控 (KDS){' '}
                        <kbd className="ml-1 bg-black/30 text-[10px] px-1 py-0.5 rounded border border-white/10">
                          Ctrl+2
                        </kbd>
                      </span>
                    </button>

                    <button
                      id="tab-btn-admin"
                      onClick={() => {
                        setActiveTab('admin');
                        setAdminSubTab('stats');
                      }}
                      className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'admin'
                          ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md shadow-[#E5B453]/15'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <BarChart3 size={14} />
                      <span className="whitespace-nowrap">
                        📊 經營分析與上架{' '}
                        <kbd className="ml-1 bg-black/30 text-[10px] px-1 py-0.5 rounded border border-white/10">
                          Ctrl+3
                        </kbd>
                      </span>
                    </button>

                    <button
                      id="tab-btn-customer-from-staff"
                      onClick={() => navigateTo('/')}
                      className="flex items-center space-x-1.5 px-4 py-2 text-white/50 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer transition text-xs font-black whitespace-nowrap"
                    >
                      <Smartphone size={14} />
                      <span className="whitespace-nowrap">
                        📱 返回顧客點餐{' '}
                        <kbd className="ml-1 bg-black/30 text-[10px] px-1 py-0.5 rounded border border-white/10">
                          Ctrl+4
                        </kbd>
                      </span>
                    </button>

                    <button
                      id="tab-btn-eod-main"
                      onClick={() => {
                        setActiveTab('admin');
                        setAdminSubTab('eod');
                      }}
                      className={`flex items-center space-x-1 px-3.5 py-2 font-black text-xs rounded-xl cursor-pointer transition ml-1 shrink-0 whitespace-nowrap ${
                        activeTab === 'admin' && adminSubTab === 'eod'
                          ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md shadow-[#E5B453]/15'
                          : 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25'
                      }`}
                    >
                      <span className="text-sm select-none">🏁</span>
                      <span className="whitespace-nowrap">
                        每日關帳結算{' '}
                        <kbd className="ml-1 bg-black/30 text-[10px] px-1 py-0.5 rounded border border-amber-500/30">
                          Ctrl+5
                        </kbd>
                      </span>
                    </button>

                    <button
                      id="tab-btn-cashier-nav-right"
                      onClick={() => {
                        setActiveTab('cashier');
                        setAdminSubTab('cashier');
                      }}
                      className={`flex items-center space-x-1 px-3.5 py-2 font-black text-xs rounded-xl cursor-pointer transition ml-1 shrink-0 whitespace-nowrap ${
                        activeTab === 'cashier'
                          ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md shadow-[#E5B453]/15'
                          : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 animate-pulse'
                      }`}
                    >
                      <Coins size={13} />
                      <span className="whitespace-nowrap">現正收銀結帳 Terminal</span>
                    </button>

                    <button
                      id="tab-btn-logout-staff"
                      onClick={() => {
                        setIsStaff(false);
                        navigateTo('/');
                      }}
                      className="flex items-center space-x-1 px-3.5 py-2 text-rose-400 hover:text-rose-300 font-bold text-xs hover:bg-white/5 rounded-xl cursor-pointer transition ml-1 whitespace-nowrap"
                    >
                      <LogOut size={13} />
                      <span className="whitespace-nowrap">員工登出</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-xs text-[#E5B453]/80 bg-[#E5B453]/5 border border-[#E5B453]/10 px-3.5 py-1.5 rounded-xl font-bold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>SECURE AUTH PORTAL MODE</span>
                  </div>
                )
              ) : null}
            </div>

            {/* Loyalty LINE login & Multilingual flags selectors */}
            <div className="flex items-center space-x-3">
              <LanguageSelector currentLang={lang} onLanguageChange={handleLanguageChange} />
            </div>
          </div>
        </div>
      </nav>

      {/* Interactive Collapsible Contact Banner (Middle Area between First Column/Navbar and Second Column/Workspace) */}
      {!isAtStaffPath && (
        <div
          className="bg-[#121212] border-b border-white/5 py-1.5 px-4"
          id="contact-info-reveal-bar"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center space-x-2 text-white/35 text-[11px] font-sans font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5B453]/80 animate-pulse" />
              <span>沙貝餐飲聯盟店鋪資訊 Branch & Contact</span>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 flex-1">
              <div className="min-h-6 flex items-center">
                {showContactDetails ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-white/90 text-xs font-medium">
                    <span className="flex items-center space-x-1">
                      <Phone size={12} className="text-[#E5B453]" />
                      <span className="font-mono text-[11px] text-white/85">0966-626408</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <MapPin size={12} className="text-[#E5B453]" />
                      <span className="font-sans text-[11px] text-white/85">
                        桃園市大園區高鐵北路二段198號1樓
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-white/20 italic font-mono tracking-widest bg-black/10 px-2 py-0.5 rounded">
                    •••• 聯絡細節與物理地址已安全隱蔽 ••••
                  </span>
                )}
              </div>

              <button
                type="button"
                id="toggle-contact-reveal-btn"
                onClick={() => setShowContactDetails(!showContactDetails)}
                className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-black uppercase text-[#E5B453] hover:text-[#f3cd78] hover:bg-white/5 bg-white/2 rounded-lg border border-[#E5B453]/25 transition cursor-pointer active:scale-95 shrink-0"
              >
                {showContactDetails ? (
                  <>
                    <EyeOff size={10.5} />
                    <span>隱藏隱私 Hide Info</span>
                  </>
                ) : (
                  <>
                    <Eye size={10.5} />
                    <span>點擊解鎖 Reveal Address</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Tab selectors, only shown to logged-in staff on staff login path */}
      {isAtStaffPath && isStaff && (
        <div
          className="lg:hidden bg-[#121212] border-b border-white/10 p-2 flex justify-around sticky top-18 z-30 shadow-md"
          id="mobile-tab-selector"
        >
          <button
            id="m-tab-btn-terminal"
            onClick={() => {
              setActiveTab('admin');
              setAdminSubTab('terminal');
            }}
            className={`flex-1 py-1.5 text-center text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'admin' && adminSubTab === 'terminal'
                ? 'text-[#E5B453]'
                : 'text-white/40'
            }`}
          >
            <Monitor size={15} />
            <span>點餐終端</span>
          </button>

          <button
            id="m-tab-btn-cashier"
            onClick={() => {
              setActiveTab('cashier');
              setAdminSubTab('cashier');
            }}
            className={`flex-1 py-1.5 text-center text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'cashier' ? 'text-[#E5B453]' : 'text-white/40'
            }`}
          >
            <Coins size={15} />
            <span>櫃檯收銀</span>
          </button>

          <button
            id="m-tab-btn-kitchen"
            onClick={() => {
              setActiveTab('kitchen');
              setAdminSubTab(undefined);
            }}
            className={`flex-1 py-1.5 text-center text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'kitchen' ? 'text-[#E5B453]' : 'text-white/40'
            }`}
          >
            <ChefHat size={15} />
            <span>廚房 KDS</span>
          </button>

          <button
            id="m-tab-btn-admin"
            onClick={() => {
              setActiveTab('admin');
              setAdminSubTab('stats');
            }}
            className={`flex-1 py-1.5 text-center text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'admin' && adminSubTab !== 'eod' ? 'text-[#E5B453]' : 'text-white/40'
            }`}
          >
            <BarChart3 size={15} />
            <span>數據庫存</span>
          </button>

          <button
            id="m-tab-btn-eod"
            onClick={() => {
              setActiveTab('admin');
              setAdminSubTab('eod');
            }}
            className={`flex-1 py-1.5 text-center text-[10px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'admin' && adminSubTab === 'eod' ? 'text-[#E5B453]' : 'text-white/40'
            }`}
          >
            <span className="text-sm select-none leading-none h-[15px] flex items-center">🏁</span>
            <span>每日結帳</span>
          </button>

          <button
            onClick={() => navigateTo('/')}
            className="flex-1 py-1.5 text-center text-[10px] text-white/65 font-bold flex flex-col items-center gap-1 cursor-pointer"
          >
            <Smartphone size={15} />
            <span>顧客前台</span>
          </button>

          <button
            onClick={() => {
              setIsStaff(false);
              navigateTo('/');
            }}
            className="flex-1 py-1.5 text-center text-[10px] text-rose-400 font-bold flex flex-col items-center gap-1 cursor-pointer"
          >
            <LogOut size={15} />
            <span>登出員工</span>
          </button>
        </div>
      )}

      {/* 2. CORE WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative">
        {/* Offline Sync HUD Panel */}
        {(!isNetworkOnline || offlineQueue.length > 0) && (
          <div
            className="mb-6 rounded-2xl bg-zinc-950/90 border border-[#E5B453]/20 shadow-2xl p-4 md:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 backdrop-blur-md"
            id="offline-sync-hud"
          >
            {/* Connection State */}
            <div className="flex items-center space-x-3.5 shrink-0">
              <div className="relative">
                <span
                  className={`block h-4 w-4 rounded-full ${isNetworkOnline ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-pulse'}`}
                />
                <span
                  className={`absolute top-0 left-0 rounded-full h-4 w-4 ${isNetworkOnline ? 'bg-emerald-400' : 'bg-rose-400'}`}
                />
              </div>
              <div>
                <h4 className="text-sm font-sans font-bold text-white tracking-wide">
                  {isNetworkOnline ? '📡 網路連線已恢復 Online' : '📡 離線排隊保護中 Offline Mode'}
                </h4>
                <p className="text-xs text-white/40 mt-1">
                  {isNetworkOnline
                    ? `已自動偵測在線 • 有 ${offlineQueue.length} 筆暫存待上傳`
                    : `無網路狀態下點餐或狀態調整將自動入庫 • ${offlineQueue.length} 筆待同步作業`}
                </p>
              </div>
            </div>

            {/* Queue Item List */}
            {offlineQueue.length > 0 && (
              <div className="flex-1 max-h-24 overflow-y-auto bg-white/5 border border-white/5 rounded-xl p-3 scrollbar-thin scrollbar-thumb-white/10">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono mb-1.5 flex justify-between">
                  <span>待同步離線任務佇列 (FIFO Queue)</span>
                  <span>{offlineQueue.length} 項變更</span>
                </p>
                <div className="space-y-1.5">
                  {offlineQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white/2 border border-white/5 py-1 px-2.5 rounded-lg text-xs hover:border-white/10 transition"
                    >
                      <span className="text-white/85 flex items-center gap-1.5 truncate">
                        <span className="text-[10px] bg-[#E5B453]/10 text-[#E5B453] px-1 py-0.2 rounded font-mono font-bold">
                          {item.method}
                        </span>
                        <span className="truncate">{item.description}</span>
                      </span>
                      <span className="font-mono text-[10px] text-white/30 shrink-0 select-none">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sync Action & Control */}
            <div className="flex items-center gap-2.5 shrink-0 sm:self-end lg:self-center">
              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  id="btn-clear-offline-queue"
                  onClick={() => {
                    if (
                      window.confirm(
                        '確定要清除所有未同步的離線操作與點餐快取嗎？這會清除此視窗目前的未送出變更。',
                      )
                    ) {
                      clearOfflineQueue();
                    }
                  }}
                  className="px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/30 rounded-xl cursor-pointer transition active:scale-95"
                >
                  清除暫存
                </button>
              )}
              <button
                type="button"
                id="btn-trigger-offline-sync"
                disabled={isSyncing || offlineQueue.length === 0}
                onClick={handleForceSync}
                className="px-4 py-2 text-xs font-black bg-[#E5B453] hover:bg-[#ebd59b] disabled:bg-[#343434] disabled:text-white/30 text-[#0F0F0F] rounded-xl flex items-center space-x-1.5 shadow-md shadow-[#E5B453]/5 border border-transparent transition cursor-pointer active:scale-95"
              >
                {isSyncing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0F0F0F] border-t-transparent rounded-full animate-spin shrink-0"></div>
                    <span className="truncate text-[11px]">{syncProgressMsg || '同步中...'}</span>
                  </>
                ) : (
                  <>
                    <span>🔄 立即重試同步</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-[#E5B453] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white/50 font-bold text-sm">沙貝燒烤 雲端主機連線中...</p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-10 h-10 border-4 border-[#E5B453] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/50 font-bold text-sm">Loading Component Modules...</p>
              </div>
            }
          >
            {isAtStaffPath ? (
          !isStaff ? (
            <div className="py-8">
              <div className="max-w-md mx-auto text-center space-y-2 mb-6">
                <span className="text-xs font-bold text-amber-500 bg-[#E5B453]/10 px-3.5 py-1.5 rounded-full border border-[#E5B453]/20 uppercase tracking-widest leading-none my-1 flex items-center justify-center gap-1.5 w-fit mx-auto">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse animate-duration-1000" />
                  🔒 ADMINISTRATIVE CONTROL PORTAL
                </span>
                <h2 className="text-2xl font-serif font-black text-white tracking-wide mt-2">
                  沙貝管理後台獨立驗證門戶
                </h2>
                <p className="text-xs text-white/50 max-w-xs mx-auto">
                  本頁面為管理階層專屬之獨立防護選單。已與顧客共用選單安全防禦硬化，防止任何未授權之側錄、入侵或探測。
                </p>
              </div>
              <StaffLoginGate
                onLoginSuccess={() => {
                  setIsStaff(true);
                  setActiveTab('admin');
                }}
                onCancel={() => {
                  navigateTo('/');
                }}
              />
            </div>
          ) : (
            <div>
              {activeTab === 'kitchen' ? (
                <KitchenDisplaySystem
                  currentLang={lang}
                  orders={orders}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  printLogs={printLogs}
                  onClearPrintLogs={handleClearPrintLogs}
                  printerIp={printerIp}
                  onUpdatePrinterIp={handleUpdatePrinterIp}
                  onPrintTestPage={handlePrintTestPage}
                  onUpdateTableNumber={handleUpdateTableNumber}
                  onUpdateQuickNotes={handleUpdateQuickNotes}
                  onToggleOrderFlag={handleToggleOrderFlag}
                  tables={tables}
                  menuItems={menuItems}
                  categories={categories}
                  onToggleMenuItemAvailability={handleToggleMenuItemAvailability}
                  ingredients={ingredients}
                  onAdjustIngredientStock={handleAdjustIngredientStock}
                  operatingHours={operatingHours}
                  servicePaused={servicePaused}
                  onToggleServicePause={handleToggleServicePause}
                  onToggleOrderItemComplete={handleToggleOrderItemComplete}
                  reservations={reservations}
                />
              ) : (
                <ManagerDashboard
                  currentLang={lang}
                  analytics={analytics}
                  ingredients={ingredients}
                  orders={orders}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onRestock={handleRestock}

                  onToggleMenuItemAvailability={handleToggleMenuItemAvailability}
                  onSendPromoPush={handleSendPromoPush}
                  menuItems={menuItems}
                  onAddMenuItem={handleAddMenuItem}
                  onEditMenuItem={handleEditMenuItem}
                  onDeleteMenuItem={handleDeleteMenuItem}
                  categories={categories}
                  onAddCategory={handleAddCategory}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onReorderCategories={handleReorderCategories}
                  onReorderMenuItems={handleReorderMenuItems}
                  tables={tables}
                  onAddTable={handleAddTable}
                  onEditTable={handleEditTable}
                  onDeleteTable={handleDeleteTable}
                  onUpdateTableStatus={handleUpdateTableStatus}
                  reservations={reservations}
                  onAddReservation={handleAddReservation}
                  onEditReservation={handleUpdateReservation}
                  onDeleteReservation={handleDeleteReservation}
                  onPayOrder={handlePayOrder}
                  onPlaceOrder={handlePlaceOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onUpdateTableNumber={handleUpdateTableNumber}
                  onUpdateOrderItems={handleUpdateOrderItems}
                  defaultSubTab={adminSubTab || (activeTab === 'cashier' ? 'cashier' : 'stats')}
                  onSubTabChange={(subTab) => setAdminSubTab(subTab)}
                  minSpend={minSpend}
                  onUpdateMinSpend={handleUpdateMinSpend}
                  promoCombo={promoCombo}
                  onSavePromoCombo={handleSavePromoComboConfig}
                  operatingHours={operatingHours}
                  restDays={restDays}
                  isOpen={isOpen}
                  onUpdateOperatingHours={handleUpdateOperatingHours}
                  customerNotice={customerNotice}
                  onUpdateCustomerNotice={handleUpdateCustomerNotice}
                  staffPin={staffPin}
                  popularItemIds={popularItemIds}
                  onUpdatePopularItemIds={handleUpdatePopularItemIds}
                  printerIp={printerIp}
                  onPrintTestPage={handlePrintTestPage}
                  onAddIngredient={handleAddIngredient}
                  servicePaused={servicePaused}
                  onToggleServicePause={handleToggleServicePause}
                  memberPointsRatio={memberPointsRatio}
                  memberRewards={memberRewards}
                  onUpdateMemberConfig={fetchData}
                />
              )}
            </div>
          )
        ) : (
          <div>
            <CustomerOrderView
              currentLang={lang}
              menuItems={menuItems}
              categories={categories}
              tables={tables}
              reservations={reservations}
              onAddReservation={handleAddReservation}
              onPlaceOrder={handlePlaceOrder}
              activeOrders={orders}
              pushNotifications={pushNotifications}
              onMarkNotificationRead={handleMarkNotificationRead}
              inventoryWarnings={analytics.stockWarnings}
              minSpend={minSpend}
              isOpen={isOpen}
              customerNotice={customerNotice}
              operatingHours={operatingHours}
              restDays={restDays}
              promoCombo={promoCombo}
              ingredients={ingredients}
              onToggleMenuItemAvailability={handleToggleMenuItemAvailability}
              onAdjustIngredientStock={handleAdjustIngredientStock}
              popularItemIds={popularItemIds}
              servicePaused={servicePaused}
              memberPointsRatio={memberPointsRatio}
              memberRewards={memberRewards}
            />
          </div>
        )}
          </Suspense>
        )}
      </main>

      {/* 3. Humble footer matching design constraints */}
      <footer className="bg-[#0A0A0A] border-t border-white/10 text-white/40 py-6 text-center text-xs space-y-1.5 mt-auto shrink-0">
        <p className="italic font-mono font-light tracking-widest text-[10px] sm:text-xs text-[#E5B453]/90 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent py-2 select-none uppercase flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 px-4 mx-auto w-full">
          <span>Designed by</span>
          <span className="font-extrabold text-white/95 tracking-widest drop-shadow-[0_0_8px_rgba(229,180,83,0.3)]">
            <a
              href="https://www.flyshine.net"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#E5B453] transition-colors cursor-pointer"
            >
              FlyShine A.S.R. System Technology.
            </a>
          </span>
        </p>
        {isAtStaffPath && (
          <div className="flex items-center justify-center space-x-4 pt-1">
            <button
              type="button"
              id="footer-customer-portal-link"
              onClick={() => navigateTo('/')}
              className="text-[#E5B453]/30 hover:text-[#E5B453] text-[9px] font-mono tracking-widest uppercase cursor-pointer transition py-0.5 px-1 rounded flex items-center space-x-1"
            >
              <Smartphone size={11} />
              <span>Customer View</span>
            </button>
          </div>
        )}
        <div className="text-[9px] text-[#E5B453]/20 italic font-mono uppercase tracking-widest pt-1 flex items-center justify-center">
          <span>A.S.R. Cloud Engine v4.2 // Secured Connection Terminal</span>
          <button
            onClick={() => navigateTo('/888888')}
            className="text-[#0A0A0A] hover:text-[#0A0A0A] focus:outline-none cursor-default select-none ml-1 inline-flex items-center"
            title="Secure Portal"
            id="hidden-backend-portal-trigger"
          >
            <Lock size={8} />
          </button>
        </div>
      </footer>
    </div>
  );
}
