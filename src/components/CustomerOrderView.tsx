import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MenuItem,
  OrderItem,
  Order,
  Language,
  Category,
  TableConfig,
  CustomAddOn,
  OrderHistoryUserStatus,
  OrderHistoryBillStatus,
  Reservation,
} from '../types';
import { getLocalizedText } from '../utils/i18n';
import { TRANSLATIONS } from '../data';
import {
  ShoppingCart,
  Clock,
  Check,
  AlertTriangle,
  ChevronRight,
  X,
  Sparkles,
  BellRing,
  QrCode,
  Coins,
  Star,
  Flame,
  ArrowUp,
  Loader2,
  Calendar,
} from 'lucide-react';
import { useSimplifiedMode } from '../contexts/SimplifiedModeContext';
import { safeStorage, safeSessionStorage } from '../lib/safeStorage';

const localStorage = safeStorage;
const sessionStorage = safeSessionStorage;

export function isValidTableFormat(str: string | null): boolean {
  if (!str) return false;
  const clean = str.trim().toLowerCase();

  // Special takeout values are valid login table identifiers
  if (clean === 'takeout' || clean === 'take-out') {
    return true;
  }

  // Check if it is a standard table format:
  // e.g., contains at least one digit and is not too long (e.g., <= 8 characters)
  const hasDigit = /\d/.test(clean);
  const isTooLong = clean.length > 8;
  const hasInvalidWords = ['guest', 'browse', 'admin', 'hack', 'test', 'null', 'undefined'].some(
    (word) => clean.includes(word),
  );

  return hasDigit && !isTooLong && !hasInvalidWords;
}

export function getMappedTableId(
  inputTableId: string,
  availableTables: Array<{ id: string }>,
): string {
  if (!availableTables || availableTables.length === 0) {
    return inputTableId;
  }
  // If the table already exists, use it directly
  if (availableTables.some((t) => t.id === inputTableId)) {
    return inputTableId;
  }
  if (inputTableId.includes('外帶')) {
    return inputTableId;
  }

  // Extract digits
  const matchDigits = inputTableId.match(/\d+/);
  if (matchDigits) {
    const tableNum = parseInt(matchDigits[0], 10);
    const numericTables = availableTables
      .map((t) => ({ id: t.id, num: parseInt(t.id.match(/\d+/)?.[0] || '', 10) }))
      .filter((t) => !isNaN(t.num));

    if (numericTables.length > 0) {
      // Find closest
      let closestTable = numericTables[0];
      let minDiff = Math.abs(numericTables[0].num - tableNum);
      for (const nt of numericTables) {
        const diff = Math.abs(nt.num - tableNum);
        if (diff < minDiff) {
          minDiff = diff;
          closestTable = nt;
        }
      }
      return closestTable.id;
    }
  }

  // Fallback to string hashing or first table
  let hash = 0;
  for (let i = 0; i < inputTableId.length; i++) {
    hash = inputTableId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % availableTables.length;
  return availableTables[idx].id;
}

export function shouldShowOrderHistory(
  userStatus: OrderHistoryUserStatus | null | undefined,
  billStatus: OrderHistoryBillStatus | null | undefined,
): boolean {
  if (!userStatus && !billStatus) return false;

  // 1. Active Table Session: outstanding (unpaid) bill on that specific table number
  const hasActiveTableSession = !!(billStatus?.tableNumber && billStatus?.hasUnpaidBillOnTable);

  // 2. Member Authentication: logged in as a member AND has at least one previous order
  const hasMemberAuthHistory = !!(userStatus?.isMember && userStatus?.hasPastOrders);

  return hasActiveTableSession || hasMemberAuthHistory;
}

interface CustomerOrderViewProps {
  currentLang: Language;
  menuItems: MenuItem[];
  categories: Category[];
  tables: TableConfig[];
  reservations?: Reservation[];
  onAddReservation?: (
    reservation: Omit<Reservation, 'id' | 'createdAt'>,
  ) => Promise<{ success: boolean; error?: string }>;
  onPlaceOrder: (orderData: {
    tableNumber: string;
    items: OrderItem[];
    paymentMethod: 'cash' | 'credit' | 'member' | 'twqr';
    guestCount?: number;
    clientOrderId?: string;
  }) => Promise<Order | null>;
  activeOrders: Order[];
  pushNotifications: any[];
  onMarkNotificationRead: (id: string) => void;
  inventoryWarnings: any[];
  minSpend?: number;
  isOpen?: boolean;
  customerNotice?: string;
  operatingHours?: any[];
  restDays?: string[];
  promoCombo?: any;
  ingredients?: any[];
  onToggleMenuItemAvailability?: (id: string) => Promise<void>;
  onAdjustIngredientStock?: (
    ingredientId: string,
    quantityChanged: number,
    note: string,
  ) => Promise<void>;
  popularItemIds?: string[];
  servicePaused?: boolean;
  memberPointsRatio?: number;
  memberRewards?: any[];
}

export const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({
  currentLang,
  menuItems,
  categories,
  tables,
  reservations = [],
  onAddReservation,
  onPlaceOrder,
  activeOrders,
  pushNotifications,
  onMarkNotificationRead,
  inventoryWarnings,
  minSpend = 200,
  isOpen = true,
  customerNotice = '',
  operatingHours = [],
  restDays = [],
  promoCombo = {
    enabled: true,
    requiredQty: 10,
    discountAmount: 20,
    eligibleItemIds: [],
    combos: [],
  } as any,
  ingredients = [],
  onToggleMenuItemAvailability,
  onAdjustIngredientStock,
  popularItemIds = ['ty-01', 'nd-01', 'sk-02', 'sk-01'],
  servicePaused = false,
  memberPointsRatio = 20,
  memberRewards = [],
}) => {
  const t = (key: string) => TRANSLATIONS[key]?.[currentLang] || TRANSLATIONS[key]?.['zh'] || key;

  const getItemUnitPrice = (item: any) => {
    let base = Number(item.price) || 0;
    if (item.customization) {
      if (item.customization.spiciness === 3) base += 10;
      if (item.customization.soupBase === 'coconut-milk') base += 50;
      if (item.customization.selectedAddOns && Array.isArray(item.customization.selectedAddOns)) {
        base += item.customization.selectedAddOns.reduce(
          (s: number, a: any) => s + (Number(a.price) || 0),
          0,
        );
      }
    }
    return base;
  };

  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now());
  const lineProfile: any = null;

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const isTaiwanRestDay = useMemo(() => {
    const dObj = new Date(nowTimestamp);
    const utcTime = dObj.getTime() + dObj.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    const yr = localDate.getFullYear();
    const mo = String(localDate.getMonth() + 1).padStart(2, '0');
    const dy = String(localDate.getDate()).padStart(2, '0');
    const taiwanDateStr = `${yr}-${mo}-${dy}`;
    return restDays.includes(taiwanDateStr);
  }, [restDays, nowTimestamp]);

  const urlReservationParams = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const resNo = params.get('reservationNo') || params.get('resNo');
    if (!resNo) return null;
    return {
      reservationNo: resNo,
      tableNumber: params.get('tableNumber') || params.get('table') || '',
      resName: params.get('resName') || params.get('customerName') || '',
      resDate: params.get('resDate') || '',
      resTime: params.get('resTime') || '',
    };
  }, []);

  const todayDateStr = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const dy = String(now.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }, []);

  const maxNinetyDaysDateStr = useMemo(() => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    localDate.setDate(localDate.getDate() + 90);
    const yr = localDate.getFullYear();
    const mo = String(localDate.getMonth() + 1).padStart(2, '0');
    const dy = String(localDate.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }, []);

  // 🔒 驗證「預約訂位點餐專屬通道」是否有效 (若後台取消預約或已結帳完成，通道自動作廢與刪除)
  const validUrlReservationParams = useMemo(() => {
    if (!urlReservationParams?.reservationNo) return null;
    const resNo = urlReservationParams.reservationNo;
    const matchingRes = (reservations || []).find(
      (r: any) =>
        (r.id === resNo || (r as any).reservationNo === resNo) &&
        r.status !== 'cancelled' &&
        r.status !== 'completed',
    );
    if (!matchingRes) return null;
    return urlReservationParams;
  }, [urlReservationParams, reservations]);

  const [selectedTable, setSelectedTable] = useState('5');
  const [activeCustomerReservation, setActiveCustomerReservation] = useState<Reservation | null>(
    null,
  );

  const isHasReservation = useMemo(() => {
    if (validUrlReservationParams?.reservationNo) return true;
    if (activeCustomerReservation) return true;
    const currentTable = (tables || []).find((t: any) => t.id === selectedTable);
    if (currentTable && (currentTable.status === 'preserved' || currentTable.status === 'reserved'))
      return true;

    const dObj = new Date(nowTimestamp);
    const utcTime = dObj.getTime() + dObj.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    const yr = localDate.getFullYear();
    const mo = String(localDate.getMonth() + 1).padStart(2, '0');
    const dy = String(localDate.getDate()).padStart(2, '0');
    const todayStr = `${yr}-${mo}-${dy}`;

    const matchingRes = (reservations || []).find(
      (r: any) =>
        (r.tableNumber === selectedTable || (r as any).table === selectedTable) &&
        r.date === todayStr &&
        r.status !== 'cancelled',
    );
    return !!matchingRes;
  }, [
    validUrlReservationParams,
    activeCustomerReservation,
    selectedTable,
    tables,
    reservations,
    nowTimestamp,
  ]);

  const isCurrentSlotReservableOnly = useMemo(() => {
    if (servicePaused || !isOpen) return false;
    const dObj = new Date(nowTimestamp);
    const utcTime = dObj.getTime() + dObj.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    const dayOfWeek = localDate.getDay();
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    const currentTotalMinutes = hour * 60 + minute;

    const activeSlots = (operatingHours || []).filter((s: any) => s && s.isActive);
    for (const slot of activeSlots) {
      if (slot.days && Array.isArray(slot.days) && !slot.days.includes(dayOfWeek)) continue;
      const [startH, startM] = (slot.start || '00:00').split(':').map(Number);
      const [endH, endM] = (slot.end || '23:59').split(':').map(Number);
      const startTotal = (startH || 0) * 60 + (startM || 0);
      const endTotal = (endH || 0) * 60 + (endM || 0);

      let match = false;
      if (startTotal <= endTotal) {
        match = currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
      } else {
        match = currentTotalMinutes >= startTotal || currentTotalMinutes <= endTotal;
      }
      if (match && slot.isReservableOnly) return true;
    }
    return false;
  }, [isOpen, servicePaused, operatingHours, nowTimestamp]);

  const isStoreCurrentlyOpen = useMemo(() => {
    // 預約專屬連結特權：不受營業時間或暫停服務限制，可自由點餐與瀏覽（需專屬通道有效）
    if (validUrlReservationParams?.reservationNo) return true;

    if (servicePaused || !isOpen) return false;

    const dObj = new Date(nowTimestamp);
    const utcTime = dObj.getTime() + dObj.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    const yr = localDate.getFullYear();
    const mo = String(localDate.getMonth() + 1).padStart(2, '0');
    const dy = String(localDate.getDate()).padStart(2, '0');
    const taiwanDateStr = `${yr}-${mo}-${dy}`;

    if (restDays && restDays.includes(taiwanDateStr)) {
      return false;
    }

    const activeSlots = (operatingHours || []).filter((s: any) => s && s.isActive);
    if (activeSlots.length === 0) {
      return true;
    }

    const dayOfWeek = localDate.getDay();
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    const currentTotalMinutes = hour * 60 + minute;

    for (const slot of activeSlots) {
      if (slot.days && Array.isArray(slot.days) && !slot.days.includes(dayOfWeek)) {
        continue;
      }
      const [startH, startM] = (slot.start || '00:00').split(':').map(Number);
      const [endH, endM] = (slot.end || '23:59').split(':').map(Number);

      const startTotal = (startH || 0) * 60 + (startM || 0);
      const endTotal = (endH || 0) * 60 + (endM || 0);

      let inTimeRange = false;
      if (startTotal <= endTotal) {
        inTimeRange = currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
      } else {
        inTimeRange = currentTotalMinutes >= startTotal || currentTotalMinutes <= endTotal;
      }

      if (inTimeRange) {
        if (slot.isReservableOnly) {
          if (isHasReservation) return true;
        } else {
          return true;
        }
      }
    }

    return false;
  }, [
    isOpen,
    servicePaused,
    restDays,
    operatingHours,
    nowTimestamp,
    urlReservationParams,
    isHasReservation,
  ]);
  const isTakeoutMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const hasTakeoutParam = params.has('takeout');
    const tableClean = (selectedTable || '').toLowerCase();
    return (
      hasTakeoutParam ||
      tableClean.includes('takeout') ||
      tableClean.includes('外帶') ||
      tableClean.includes('take-out')
    );
  }, [selectedTable]);
  const [selectedCategory, setSelectedCategory] = useState('tomyum');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [hoverCartItem, setHoverCartItem] = useState<OrderItem | null>(null);
  const [isHoverCartOpen, setIsHoverCartOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<MenuItem | null>(null);
  const [guestCount, setGuestCount] = useState<number>(2);
  const [qrScannedInfo, setQrScannedInfo] = useState<string | null>(null);
  const [urlProcessed, setUrlProcessed] = useState(false);
  const [isTableFixed, setIsTableFixed] = useState(false);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  const displayedMenuItems = useMemo(() => {
    return menuItems;
  }, [menuItems]);

  const [loginCount, setLoginCount] = useState<number>(0);
  const [isMerchantMode, setIsMerchantMode] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [pincodeInput, setPincodeInput] = useState('');
  const [pincodeError, setPincodeError] = useState(false);
  const [activeSegmentTab, setActiveSegmentTab] = useState<'bestsellers' | 'history'>(
    'bestsellers',
  );
  const [ratingStates, setRatingStates] = useState<
    Record<string, { rating: number; feedback: string; isSubmitted: boolean; isEditing: boolean }>
  >({});
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false);
  const isCheckoutSubmittingRef = useRef(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<Record<string, boolean>>({});

  // 📅 預約訂位點餐 (Reservation & Pre-order) modal states
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [resCustomerName, setResCustomerName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resPhoneError, setResPhoneError] = useState(false);
  const [resDate, setResDate] = useState(() => {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    localDate.setDate(localDate.getDate() + 1);
    const yr = localDate.getFullYear();
    const mo = String(localDate.getMonth() + 1).padStart(2, '0');
    const dy = String(localDate.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  });
  const [resTime, setResTime] = useState('18:00');
  const [resGuests, setResGuests] = useState(2);
  const [resTableNumbers, setResTableNumbers] = useState<string[]>([]);
  const [isManualTableSelection, setIsManualTableSelection] = useState(false);
  const [resNotes, setResNotes] = useState('');
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resFeedback, setResFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null,
  );

  // Takeout Form State
  const [showTakeoutFormModal, setShowTakeoutFormModal] = useState(false);
  const [takeoutCustomerName, setTakeoutCustomerName] = useState('');
  const [takeoutPhone, setTakeoutPhone] = useState('');
  const [takeoutPickupTime, setTakeoutPickupTime] = useState('18:00');

  const isResDateValid = useMemo(() => {
    if (!resDate) return true;
    if (restDays && restDays.includes(resDate)) return false;
    return resDate <= maxNinetyDaysDateStr;
  }, [resDate, maxNinetyDaysDateStr, restDays]);

  // ⏱️ Helper to parse "HH:MM" into total minutes from 00:00
  const parseTimeToMinutes = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const generateCandidateSlots = useCallback(
    (dateStr: string) => {
      const slots: string[] = [];
      if (!dateStr) return slots;
      if (restDays && restDays.includes(dateStr)) return slots;
      if (!operatingHours || operatingHours.length === 0) {
        return [
          '11:00',
          '11:30',
          '12:00',
          '12:30',
          '13:00',
          '13:30',
          '14:00',
          '17:00',
          '17:30',
          '18:00',
          '18:30',
          '19:00',
          '19:30',
          '20:00',
          '20:30',
          '21:00',
          '21:30',
        ];
      }

      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return slots;
      const localDate = new Date(y, m - 1, d);
      const dayOfWeek = localDate.getDay();

      const activeSlots = operatingHours.filter((s) => s && s.isActive);
      activeSlots.forEach((slot) => {
        if (slot.days && Array.isArray(slot.days) && !slot.days.includes(dayOfWeek)) return;
        const [startH, startM] = (slot.start || '00:00').split(':').map(Number);
        const [endH, endM] = (slot.end || '23:59').split(':').map(Number);
        const startTotal = startH * 60 + startM;
        let endTotal = endH * 60 + endM;

        if (endTotal < startTotal) {
          endTotal += 24 * 60;
        }

        for (let mins = startTotal; mins <= endTotal; mins += 30) {
          const h = Math.floor(mins / 60) % 24;
          const min = mins % 60;
          const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
          if (!slots.includes(timeStr)) slots.push(timeStr);
        }
      });

      return slots.sort();
    },
    [operatingHours, restDays],
  );

  const handleResDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setResDate(newDate);
    if (!newDate) return;

    if (restDays?.includes(newDate)) {
      alert('很抱歉，這天是公休日，請重新選擇日期！');
      setResDate('');
      return;
    }

    // Check if the entire day is fully booked
    const dayReservations = (reservations || []).filter(
      (r) => r.date === newDate && r.status !== 'cancelled',
    );

    const candidateSlots = generateCandidateSlots(newDate);
    if (candidateSlots.length > 0 && !candidateSlots.includes(resTime)) {
      setResTime(candidateSlots[0]);
    }

    let anySlotAvailable = false;
    for (const slotTime of candidateSlots) {
      const slotMins = parseTimeToMinutes(slotTime);
      const slotOccupiedIds = new Set<string>();
      dayReservations.forEach((r) => {
        const rMins = parseTimeToMinutes(r.time);
        if (Math.abs(rMins - slotMins) < 180) {
          const rTables = String(r.tableNumber || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          rTables.forEach((tId) => slotOccupiedIds.add(tId));
        }
      });
      const freeForSlot = tables.filter((t) => !slotOccupiedIds.has(t.id));
      if (freeForSlot.length > 0) {
        anySlotAvailable = true;
        break;
      }
    }

    if (!anySlotAvailable && tables.length > 0) {
      alert('很抱歉，該日期預約已滿，請重新選擇日期！');
      setResDate('');
    }
  };

  // 3-Hour Reservation Window checking & Fully Booked slot detection
  const reservationAvailabilityInfo = useMemo(() => {
    if (!resDate || !resTime || !tables || tables.length === 0) {
      return {
        isFullyBooked: false,
        availableTables: tables || [],
        occupiedTableIds: new Set<string>(),
        isCurrentTableOccupied: false,
        suggestedTimes: [] as { time: string; freeCount: number; firstFreeTableId: string }[],
      };
    }

    const targetMins = parseTimeToMinutes(resTime);
    const dayReservations = (reservations || []).filter(
      (r) => r.date === resDate && r.status !== 'cancelled',
    );

    // Find occupied tables within 3 hours (180 minutes)
    const occupiedTableIds = new Set<string>();
    dayReservations.forEach((r) => {
      const rMins = parseTimeToMinutes(r.time);
      if (Math.abs(rMins - targetMins) < 180) {
        const rTables = String(r.tableNumber || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        rTables.forEach((tId) => occupiedTableIds.add(tId));
      }
    });

    const availableTables = tables.filter((t) => !occupiedTableIds.has(t.id));
    const isFullyBooked = availableTables.length === 0;

    // Calculate suggested alternative time slots for this date where at least one table is free
    const candidateSlots = generateCandidateSlots(resDate);

    const suggestedTimes: { time: string; freeCount: number; firstFreeTableId: string }[] = [];

    candidateSlots.forEach((slotTime) => {
      if (slotTime === resTime) return; // skip currently selected time
      const slotMins = parseTimeToMinutes(slotTime);
      const slotOccupiedIds = new Set<string>();

      dayReservations.forEach((r) => {
        const rMins = parseTimeToMinutes(r.time);
        if (Math.abs(rMins - slotMins) < 180) {
          const rTables = String(r.tableNumber || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          rTables.forEach((tId) => slotOccupiedIds.add(tId));
        }
      });

      const freeForSlot = tables.filter((t) => !slotOccupiedIds.has(t.id));
      if (freeForSlot.length > 0) {
        suggestedTimes.push({
          time: slotTime,
          freeCount: freeForSlot.length,
          firstFreeTableId: freeForSlot[0].id,
        });
      }
    });

    return {
      isFullyBooked,
      availableTables,
      occupiedTableIds,
      suggestedTimes: suggestedTimes.slice(0, 6),
    };
  }, [resDate, resTime, tables, reservations, generateCandidateSlots]);

  const isResTimeValid = useMemo(() => {
    if (restDays && restDays.includes(resDate)) return false;
    const slots = generateCandidateSlots(resDate);
    if (slots.length === 0) return false;
    if (!operatingHours || operatingHours.length === 0) return true;
    return slots.includes(resTime);
  }, [resDate, resTime, generateCandidateSlots, restDays, operatingHours]);

  useEffect(() => {
    setIsManualTableSelection(false);
  }, [resGuests, resDate, resTime]);

  useEffect(() => {
    if (!showReservationModal || !resDate || !resTime || !tables || tables.length === 0) return;
    if (isTableFixed && urlReservationParams?.tableNumber) return; // Don't auto-assign if table is fixed by QR
    if (isManualTableSelection) return; // Skip auto-assign if user has manually selected tables

    const availableTables = [...reservationAvailabilityInfo.availableTables];

    // Sort tables by capacity ascending to find the best fit (closest to remaining guests)
    availableTables.sort((a, b) => (a.maxCapacity || 4) - (b.maxCapacity || 4));

    let remainingGuests = resGuests;
    const selectedIds: string[] = [];

    while (remainingGuests > 0 && availableTables.length > 0) {
      // Find the smallest table that can fit the remaining guests
      const selectedIndex = availableTables.findIndex(
        (t) => (t.maxCapacity || 4) >= remainingGuests,
      );

      if (selectedIndex !== -1) {
        // Found a single table that can fit everyone remaining
        selectedIds.push(availableTables[selectedIndex].id);
        availableTables.splice(selectedIndex, 1);
        remainingGuests = 0;
      } else {
        // No single table can fit them. Pick the LARGEST available table to reduce remaining guests most efficiently.
        const largestTable = availableTables.pop()!;
        selectedIds.push(largestTable.id);
        remainingGuests -= largestTable.maxCapacity || 4;
      }
    }

    setResTableNumbers(selectedIds);
  }, [
    resGuests,
    resDate,
    resTime,
    tables,
    showReservationModal,
    isTableFixed,
    urlReservationParams,
    reservationAvailabilityInfo.availableTables,
    isManualTableSelection,
  ]);

  useEffect(() => {
    if (urlReservationParams?.tableNumber) {
      setSelectedTable(urlReservationParams.tableNumber);
      setIsTableFixed(true);
    }
  }, [urlReservationParams]);

  useEffect(() => {
    if (activeCustomerReservation) {
      const isStillInList = reservations.some(
        (r) =>
          r.id === activeCustomerReservation.id ||
          (activeCustomerReservation.reservationNo &&
            (r as any).reservationNo === activeCustomerReservation.reservationNo) ||
          (r.customerName === activeCustomerReservation.customerName &&
            r.phone === activeCustomerReservation.phone &&
            r.date === activeCustomerReservation.date),
      );
      if (!isStillInList) {
        setActiveCustomerReservation(null);
      }
    }
  }, [reservations]);

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResFeedback(null);

    if (!resCustomerName.trim() || !resPhone.trim() || resTableNumbers.length === 0) {
      setResFeedback({ type: 'error', msg: '請完整填寫顧客姓名、電話與指定桌號！' });
      return;
    }

    if (!isResDateValid) {
      setResFeedback({
        type: 'error',
        msg: `⚠️ 預訂日期最多只能提前 90 天 (最晚至 ${maxNinetyDaysDateStr})！`,
      });
      return;
    }

    if (!isResTimeValid) {
      setResFeedback({ type: 'error', msg: '⚠️ 預訂時間不在營業時間內，請重新選擇！' });
      return;
    }

    if (reservationAvailabilityInfo.isFullyBooked) {
      setResFeedback({
        type: 'error',
        msg: '⚠️ 該時段已額滿！預約用餐時間為 3 小時，此時段內全店客席皆已有預約。請點擊下方建議的其他可用時段。',
      });
      return;
    }

    if (resTableNumbers.length === 0) {
      setResFeedback({ type: 'error', msg: '請指定預約桌號或確認該時段是否有足夠空桌！' });
      return;
    }

    // 驗證電話格式對齊後台預約規則 (市話 9-10位 02~08，手機 10位 09xx)
    const rawPhone = resPhone.trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const isMobile = /^09\d{8}$/.test(cleanDigits);
    const isLandline = /^0[2-8]\d{7,8}$/.test(cleanDigits);

    if (!isMobile && !isLandline) {
      setResPhoneError(true);
      setResFeedback({
        type: 'error',
        msg: '⚠️ 聯絡電話格式不正確！手機號碼需為10位數（以09開頭），市話需為9至10位數（以02~08開頭），例如：0912-345-678 或 02-2345-6789。',
      });
      return;
    }

    setResPhoneError(false);
    setResSubmitting(true);

    const payload = {
      customerName: resCustomerName.trim(),
      phone: resPhone.trim(),
      guestCount: Number(resGuests) || 1,
      tableNumber: resTableNumbers.join(', '),
      date: resDate,
      time: resTime,
      notes: resNotes.trim(),
      status: 'pending' as const,
    };

    try {
      let success = false;
      let errorMsg = '';

      if (onAddReservation) {
        const res = await onAddReservation(payload);
        success = res.success;
        if (!res.success) errorMsg = res.error || '新增預約失敗';
      } else {
        const resp = await apiFetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          success = true;
        } else {
          const data = await resp.json();
          errorMsg = data.error || '無法新增預約';
        }
      }

      if (success) {
        setSelectedTable(resTableNumbers.join(', '));
        setGuestCount(Number(resGuests) || 2);
        setActiveCustomerReservation({
          id: 'res-' + Date.now(),
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setResFeedback({
          type: 'success',
          msg: `🎉 預約成功！資料已同步至櫃檯【餐廳預約訂位與客席保留管理系統】，並已為您自動切換至【${resTableNumbers.join(', ')} 桌】開始點餐！`,
        });

        setTimeout(() => {
          setShowReservationModal(false);
          setResFeedback(null);
        }, 1800);
      } else {
        setResFeedback({ type: 'error', msg: `⚠️ 預約失敗: ${errorMsg}` });
      }
    } catch (err: any) {
      setResFeedback({ type: 'error', msg: `⚠️ 連線異常: ${err.message || '請稍後再試'}` });
    } finally {
      setResSubmitting(false);
    }
  };

  // Real-time toast notifications for order status changes (preparing -> completed)
  interface ToastNotify {
    id: string;
    orderId: string;
    tableNumber: string;
    message: string;
    timestamp: number;
    type: 'ready';
  }

  const [toasts, setToasts] = useState<ToastNotify[]>([]);
  const prevStatusesRef = React.useRef<
    Record<string, 'pending' | 'preparing' | 'completed' | 'cancelled'>
  >({});

  const [historyCheckResult, setHistoryCheckResult] = useState<{
    hasUnpaidBillOnTable: boolean;
    hasPastOrders: boolean;
  } | null>(null);

  // Filter activeOrders down to what is relevant to the current client/selectedTable
  const clientActiveOrders = useMemo(() => {
    if (!activeOrders) return [];

    // Get submitted order ids from localStorage
    const localOrderIds = (() => {
      try {
        const stored = localStorage.getItem('sabay-my-submitted-order-ids');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })();

    return activeOrders.filter((o) => {
      // 1. Unpaid orders under the same table
      if (o.tableNumber === selectedTable && !o.isPaid) {
        return true;
      }
      // 2. Orders placed directly on this device
      if (localOrderIds.includes(o.id)) {
        return true;
      }
      // 3. Logged in member orders
      if (lineProfile && o.customerName === lineProfile.displayName) {
        return true;
      }
      return false;
    });
  }, [activeOrders, selectedTable, lineProfile]);

  useEffect(() => {
    let active = true;
    const checkHistory = async (retries = 3, delay = 1500) => {
      try {
        const tableParam = selectedTable || '';
        const memberNameParam = lineProfile ? encodeURIComponent(lineProfile.displayName) : '';
        const res = await apiFetch(
          `/api/orders/history-check?tableNumber=${encodeURIComponent(tableParam)}&memberName=${memberNameParam}`,
        );
        if (res.ok && active) {
          const data = await res.json();
          setHistoryCheckResult(data);
        } else if (!res.ok && retries > 0 && active) {
          console.warn(`History check failed with status ${res.status}. Retrying in ${delay}ms...`);
          setTimeout(() => checkHistory(retries - 1, delay * 1.5), delay);
        }
      } catch (err) {
        if (retries > 0 && active) {
          console.warn(
            `History check network error: ${err instanceof Error ? err.message : String(err)}. Retrying in ${delay}ms...`,
          );
          setTimeout(() => checkHistory(retries - 1, delay * 1.5), delay);
        } else {
          console.error('History check error after maximum retries:', err);
        }
      }
    };
    checkHistory();
    return () => {
      active = false;
    };
  }, [selectedTable, lineProfile]);

  const orderHistoryUserStatus = useMemo<OrderHistoryUserStatus>(() => {
    const isMember = !!lineProfile;
    const hasPastOrders = historyCheckResult
      ? historyCheckResult.hasPastOrders
      : isMember &&
        (clientActiveOrders.some((o) => o.status === 'completed' || o.status === 'cancelled') ||
          getSimulatedPastOrders().length > 0);
    return {
      isMember,
      hasPastOrders,
    };
  }, [historyCheckResult, clientActiveOrders]);

  const orderHistoryBillStatus = useMemo<OrderHistoryBillStatus>(() => {
    const clientHasUnpaid = clientActiveOrders.some(
      (o) => o.tableNumber === selectedTable && !o.isPaid,
    );
    const hasUnpaidBillOnTable = historyCheckResult
      ? historyCheckResult.hasUnpaidBillOnTable
      : clientHasUnpaid;
    return {
      hasUnpaidBillOnTable,
      tableNumber: selectedTable,
    };
  }, [selectedTable, historyCheckResult, clientActiveOrders]);

  const isOrderHistoryVisible = useMemo(() => {
    return shouldShowOrderHistory(orderHistoryUserStatus, orderHistoryBillStatus);
  }, [orderHistoryUserStatus, orderHistoryBillStatus]);

  useEffect(() => {
    if (!isOrderHistoryVisible) {
      setActiveSegmentTab('bestsellers');
    }
  }, [isOrderHistoryVisible]);

  // Floating 'Back to Top' visibility tracking
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // ScrollSpy observer to automatically highlight the current visible category section
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-100px 0px -60% 0px', // Matches top height offset when scrolling
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const categoryId = entry.target.getAttribute('data-category-id');
          if (categoryId) {
            setSelectedCategory(categoryId);

            // Center the active category tab in the carousel
            const activeTab = document.getElementById(`cat-tab-${categoryId}`);
            const carousel = document.getElementById('categories-tabs-carousel');
            if (activeTab && carousel) {
              const carouselRect = carousel.getBoundingClientRect();
              const tabRect = activeTab.getBoundingClientRect();

              if (tabRect.left < carouselRect.left || tabRect.right > carouselRect.right) {
                carousel.scrollTo({
                  left: activeTab.offsetLeft - carousel.offsetWidth / 2 + activeTab.offsetWidth / 2,
                  behavior: 'smooth',
                });
              }
            }
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const sections = document.querySelectorAll('.category-section');
    sections.forEach((sec) => observer.observe(sec));

    return () => {
      sections.forEach((sec) => observer.unobserve(sec));
    };
  }, [displayedMenuItems, categories]);

  // Audio synthesizer chime for modern guest alert
  const playNotifySound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const now = audioCtx.currentTime;

      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.12); // A5
      gain2.gain.setValueAtTime(0.08, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn('Synthesized chime could not play:', e);
    }
  };

  useEffect(() => {
    if (!clientActiveOrders || clientActiveOrders.length === 0) {
      prevStatusesRef.current = {};
      return;
    }

    // Check status changes on customer's active orders
    clientActiveOrders.forEach((o) => {
      const prevStatus = prevStatusesRef.current[o.id];
      const currentStatus = o.status;

      // Status transitioned from 'preparing' to 'completed' (Meaning Ready / Served)
      if (prevStatus === 'preparing' && currentStatus === 'completed') {
        playNotifySound();

        const toastId = `${o.id}-${Date.now()}`;
        const newToast: ToastNotify = {
          id: toastId,
          orderId: o.id,
          tableNumber: o.tableNumber,
          message: `您的餐點已熱騰騰上桌！您的桌號是【${o.tableNumber}】，餐點新鮮出餐，請慢用！🍴`,
          timestamp: Date.now(),
          type: 'ready',
        };

        setToasts((prev) => {
          // Prevent duplicates
          if (prev.some((t) => t.orderId === o.id && t.type === 'ready')) {
            return prev;
          }
          return [...prev, newToast];
        });

        // Auto remove toast notification after 12 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 12000);
      }
    });

    // Record correct state statuses for comparison
    const newStatuses: Record<string, 'pending' | 'preparing' | 'completed' | 'cancelled'> = {};
    clientActiveOrders.forEach((o) => {
      newStatuses[o.id] = o.status;
    });
    prevStatusesRef.current = newStatuses;
  }, [clientActiveOrders]);

  // Scan detection on URL load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (urlProcessed) return;

    const tableParam = params.get('table');
    if (tableParam) {
      setUrlProcessed(true);

      // Guest Mode Fallback check:
      if (!isValidTableFormat(tableParam)) {
        setIsTableFixed(false); // Switch to Guest Browsing Mode

        // Remove the invalid query parameter from the URL to "redirect"
        const cleanUrl =
          window.location.protocol + '//' + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

        setQrScannedInfo(
          `⚠️ [無效桌號，自動切換為訪客模式] 偵測到無效的桌號登入標識「${tableParam}」，系統已將您切換至【訪客瀏覽模式 Guest Browsing Mode】。您仍可自由瀏覽菜單，並於右上角手動選取正確桌號進行點餐！`,
        );

        if (tables && tables.length > 0) {
          setSelectedTable(tables[0].id);
        }
      } else {
        // Valid table number format
        setIsTableFixed(true);
        if (
          tableParam === 'takeout' ||
          tableParam === 'take-out' ||
          tableParam.toLowerCase() === 'takeout'
        ) {
          const triggerTakeoutScan = async () => {
            try {
              const res = await apiFetch('/api/takeout/scan', { method: 'POST' });
              if (res.ok) {
                const data = await res.json();
                setSelectedTable(data.tableNumber);
                setQrScannedInfo(
                  `[QR Code 掃描外帶點餐成功] 系統已自動幫您遞增預配外帶號碼：【${data.tableNumber}】`,
                );
              }
            } catch (err) {
              console.warn('Takeout scan API error:', err);
              setSelectedTable('外帶 #1');
            }
          };
          triggerTakeoutScan();
        } else {
          setSelectedTable(tableParam);

          // Check if tableParam exists in pre-configured tables
          const tableExists = tables?.some((t) => t.id === tableParam);
          if (tables && tables.length > 0 && !tableExists) {
            const mappedId = getMappedTableId(tableParam, tables);
            setQrScannedInfo(
              `ℹ️ [自訂桌號映射成功] 您登入的桌號「${tableParam}」為未配置桌位。系統已為您建立就座並在結帳收銀時對應映射至實體【${mappedId} 桌】進行合併管理。`,
            );
          } else {
            setQrScannedInfo(
              `[QR Code 掃描桌號 ${tableParam} 點餐成功] 您目前正於 ${tableParam} 桌內用就座中。`,
            );
          }
        }
      }
    } else {
      // Default table fallback from table schema
      if (tables && tables.length > 0) {
        setUrlProcessed(true);
        if (!tables.some((t) => t.id === selectedTable) && !selectedTable.includes('外帶')) {
          setSelectedTable(tables[0].id);
        }
      }
    }
  }, [tables, urlProcessed, selectedTable]);

  // Handle mock scan trigger manually in UI
  const handleSimulateScan = async (tableId: string) => {
    setIsTableFixed(true);
    if (tableId === 'takeout') {
      try {
        const res = await apiFetch('/api/takeout/scan', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setSelectedTable(data.tableNumber);
          setQrScannedInfo(
            `[模擬 QR Code 掃描外帶點餐成功] 系統已自動遞增並配發外帶號碼：【${data.tableNumber}】`,
          );
        }
      } catch (err) {
        console.warn('Takeout scan simulation API error:', err);
        setSelectedTable('外帶 #1');
      }
    } else {
      setSelectedTable(tableId);
      setQrScannedInfo(`[模擬 QR Code 掃描 ${tableId} 桌成功] 桌號欄已同步切換為內用桌號！`);
    }
    // Scroll to panel top to let users see the table header
    const topPanel = document.getElementById('customer-order-panel');
    if (topPanel) {
      topPanel.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Customization selection state
  const { isSimplifiedMode, toggleSimplifiedMode } = useSimplifiedMode();
  const [sweetness, setSweetness] = useState<number>(2); // regular
  const [spiciness, setSpiciness] = useState<number>(1); // mild/小辣
  const [noodleType, setNoodleType] = useState<'rice-noodle' | 'vermicelli' | 'none'>(
    'rice-noodle',
  );
  const [soupBase, setSoupBase] = useState<'plain' | 'coconut-milk'>('plain');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<CustomAddOn[]>([]);
  const [qty, setQty] = useState<number>(1);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'member' | 'twqr'>('cash');
  const [orderSentSuccess, setOrderSentSuccess] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Google Member Points and Balance state and redemption helpers
  const [userPoints, setUserPoints] = useState<number>(0);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);

  const [customToast, setCustomToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setCustomToast({ message, type });
  };

  useEffect(() => {
    if (customToast) {
      const timer = setTimeout(() => setCustomToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [customToast]);

  const REWARD_ITEMS = useMemo(() => {
    // Basic definition of rewards with their menuItemId and fallback configs
    const defaultRewards = [
      {
        id: 'rew-01',
        menuItemId: 'sk-02',
        fallbackName: {
          zh: '爆汁金針菇豬肉 / 串',
          en: 'Enoki Mushroom & Pork Wrap',
          ko: '팽이버섯 삼겹살 꼬치',
          ja: '金針菇えのき豚肉巻き',
          th: 'หมูสามชั้นพันเห็ดเข็มทองย่างสะเด็ด',
        },
        fallbackPrice: 90,
        cost: 900,
      },
      {
        id: 'rew-02',
        menuItemId: 'vg-01',
        fallbackName: {
          zh: '脆脆高麗菜 / 份',
          en: 'Crispy Cabbage',
          ko: '아삭 양배추 구い',
          ja: 'あつあつキャベツ焼き',
          th: 'กะหล่ำปลีย่างน้ำปลาหอม',
        },
        fallbackPrice: 80,
        cost: 800,
      },
      {
        id: 'rew-03',
        menuItemId: 'dr-01',
        fallbackName: {
          zh: '泰式奶茶 1L 桶裝 (限定)',
          en: 'Signature Street Thai Milk Tea 1L (Bucket)',
          ko: '길거리 타이 밀크티 1L 점보 通 (限定)',
          ja: '極旨本場タイミルクティー1Lバケツ入り (テイクアウト・店内人気)',
          th: 'ชาเย็นไทยสตรีท 1 ลิตรถังยักษ์',
        },
        fallbackPrice: 180,
        cost: 1800,
      },
      {
        id: 'rew-04',
        menuItemId: 'sw-01',
        fallbackName: {
          zh: '南洋香蘭手作奶酪 / 份',
          en: 'South Seas Pandan Handmade Pudding',
          ko: '남양 판단 허브 수제 푸딩',
          ja: '本格手摘みパンダンリーフ自家製ココナッツプリン',
          th: 'พุดดิ้งพานาคอตต้าใบเตยนมสด',
        },
        fallbackPrice: 90,
        cost: 900,
      },
      {
        id: 'rew-05',
        menuItemId: 'ty-01',
        fallbackName: {
          zh: '曼谷冬蔭功海鮮湯',
          en: 'Bangkok Tom Yum Seafood Soup',
          ko: '방콕 똠얌꿍 해물탕',
          ja: 'バンコトトムヤムクン海鮮スープ',
          th: 'ต้มยำกุ้งทะเลบางกอก',
        },
        fallbackPrice: 260,
        cost: 2600,
      },
    ];

    const activeList =
      memberRewards && memberRewards.length > 0
        ? memberRewards.filter((r) => r.enabled !== false)
        : defaultRewards;

    return activeList.map((reward) => {
      const match = displayedMenuItems.find((m) => m.id === reward.menuItemId);
      const originalPrice = match ? match.price : reward.fallbackPrice || 100;
      const name = match
        ? match.name
        : reward.fallbackName || { zh: '贈送餐用', en: 'Complimentary Item' };
      const cost = reward.cost !== undefined ? reward.cost : originalPrice * 10;
      return {
        id: reward.id,
        menuItemId: reward.menuItemId,
        name: name,
        originalPrice: originalPrice,
        cost: cost,
      };
    });
  }, [menuItems, memberRewards]);

  const getCleanMembersDatabase = (): any[] => {
    const dbStr = localStorage.getItem('google-members-database');
    if (!dbStr) return [];
    try {
      const db = JSON.parse(dbStr);
      if (!Array.isArray(db)) return [];
      return db.filter((m: any) => {
        const emailLower = m && m.email ? m.email.toLowerCase().trim() : '';
        return (
          emailLower !== 'topztar@gmail.com' &&
          emailLower !== 'thai_foodie@gmail.com' &&
          emailLower !== 'vegan_sabay@gmail.com' &&
          emailLower !== 'bbq_lover@gmail.com'
        );
      });
    } catch (e) {
      return [];
    }
  };

  const saveCleanMembersDatabase = (db: any[]) => {
    const cleanDb = db.filter((m: any) => {
      const emailLower = m && m.email ? m.email.toLowerCase().trim() : '';
      return (
        emailLower !== 'topztar@gmail.com' &&
        emailLower !== 'thai_foodie@gmail.com' &&
        emailLower !== 'vegan_sabay@gmail.com' &&
        emailLower !== 'bbq_lover@gmail.com'
      );
    });
    localStorage.setItem('google-members-database', JSON.stringify(cleanDb));
  };

  useEffect(() => {
    const updatePoints = () => {
      if (lineProfile && lineProfile.email) {
        const db = getCleanMembersDatabase();
        let points = 1500;
        let balance = 2000;
        const userIndex = db.findIndex((m: any) => m.email === lineProfile.email);
        if (userIndex >= 0) {
          const member = db[userIndex];
          points = member.points;
          if (member.balance === undefined) {
            member.balance = 2000;
          }
          balance = member.balance;
          saveCleanMembersDatabase(db);
        } else {
          const defaultMembers = [...db];
          defaultMembers.push({
            email: lineProfile.email,
            name: lineProfile.displayName,
            avatar: lineProfile.pictureUrl,
            points: 1500,
            balance: 2000,
            joinedAt: new Date().toISOString().split('T')[0],
          });
          saveCleanMembersDatabase(defaultMembers);
          points = 1500;
          balance = 2000;
        }
        setUserPoints(points);
        setUserBalance(balance);
        localStorage.setItem(`google-points-${lineProfile.email}`, String(points));
        localStorage.setItem(`google-balance-${lineProfile.email}`, String(balance));
      } else {
        setUserPoints(0);
        setUserBalance(0);
      }
    };

    updatePoints();
    window.addEventListener('storage', updatePoints);
    window.addEventListener('local-points-updated', updatePoints);
    return () => {
      window.removeEventListener('storage', updatePoints);
      window.removeEventListener('local-points-updated', updatePoints);
    };
  }, [lineProfile]);

  // Synchronically track logged-in count for multiple visits detection
  useEffect(() => {
    if (lineProfile && lineProfile.email) {
      const email = lineProfile.email;
      const key = `login-count-${email}`;
      const stored = localStorage.getItem(key);
      let count = stored ? parseInt(stored, 10) : 0;

      const sessionKey = `login-session-recorded-${email}`;
      const isSessionRecorded = sessionStorage.getItem(sessionKey);

      if (!isSessionRecorded) {
        count += 1;
        localStorage.setItem(key, String(count));
        sessionStorage.setItem(sessionKey, 'true');
      }
      setLoginCount(count);

      if (count >= 2) {
        setActiveSegmentTab('history');
      } else {
        setActiveSegmentTab('bestsellers');
      }
    } else {
      setLoginCount(0);
      setActiveSegmentTab('bestsellers');
    }
  }, [lineProfile]);

  const getSimulatedPastOrders = () => {
    return [];
  };

  const handleReorderOrder = (orderItems: any[]) => {
    const newItemsToAdd = orderItems.map((oldItem: any) => {
      const cartId = `cart-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const menuItem = displayedMenuItems.find((m) => m.id === oldItem.menuItemId);
      return {
        id: cartId,
        menuItemId: oldItem.menuItemId,
        name: menuItem ? menuItem.name : oldItem.name,
        price: menuItem ? menuItem.price : oldItem.price,
        qty: oldItem.qty,
        customization: {
          sweetness: 2,
          spiciness: 1,
          notes: '由歷史訂單一鍵加點 (Quick reordered from past orders)',
        },
      };
    });
    setCart((prev) => [...prev, ...newItemsToAdd]);
    if (newItemsToAdd.length > 0) {
      setHoverCartItem(newItemsToAdd[0]);
      setIsHoverCartOpen(true);
    }
    setIsCartOpen(false);
  };

  const handleRedeemReward = (reward: any) => {
    if (!lineProfile) {
      showToast('抱歉，此功能僅限登入會員使用，請先登入帳號。', 'error');
      return;
    }

    const userEmail = lineProfile.email || '';

    // Fetch latest points directly from local storage to avoid state delay or stale closure
    let freshPoints = 0;
    const dbStr = localStorage.getItem('google-members-database');
    if (dbStr) {
      try {
        const db = JSON.parse(dbStr);
        const userIndex = db.findIndex((m: any) => m.email === userEmail);
        if (userIndex >= 0) {
          freshPoints = Number(db[userIndex].points || 0);
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (freshPoints === 0 && userPoints > 0) {
      freshPoints = Number(userPoints);
    }

    if (freshPoints < Number(reward.cost)) {
      showToast(
        `您的會員累積點數不足！(目前點數為 ${freshPoints} 點，兌換此餐點需要 ${reward.cost} 點)`,
        'error',
      );
      return;
    }

    const newPoints = freshPoints - Number(reward.cost);
    if (dbStr) {
      try {
        const db = JSON.parse(dbStr);
        const userIndex = db.findIndex((m: any) => m.email === userEmail);
        if (userIndex >= 0) {
          db[userIndex].points = newPoints;
          localStorage.setItem('google-members-database', JSON.stringify(db));
        }
      } catch (e) {
        console.error(e);
      }
    }

    localStorage.setItem(`google-points-${userEmail}`, String(newPoints));
    setUserPoints(newPoints);
    window.dispatchEvent(new Event('local-points-updated'));

    const cartId = `reward-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const redeemedOrderItem: OrderItem = {
      id: cartId,
      menuItemId: reward.menuItemId,
      name: {
        zh: `🎁 點數兌換：${getLocalizedText(reward.name, 'zh') || '免費餐點'}`,
        en: `🎁 Points Redeemed: ${getLocalizedText(reward.name, 'en') || 'Complimentary Item'}`,
        ko: `🎁 포인트 교환: ${getLocalizedText(reward.name, 'ko') || getLocalizedText(reward.name, 'en') || '컴플리멘터리'}`,
        ja: `🎁 ポイント引き換え: ${getLocalizedText(reward.name, 'ja') || getLocalizedText(reward.name, 'zh') || '無料メニュー'}`,
        th: `🎁 แลกคะแนน: ${getLocalizedText(reward.name, 'th') || getLocalizedText(reward.name, 'en') || 'เมนูฟรี'}`,
      },
      price: 0,
      qty: 1,
      customization: {
        sweetness: 2,
        spiciness: 0,
        noodleType: undefined,
        soupBase: undefined,
        notes: '🎁 點數免費兌換禮遇 (Loyalty Reward)',
        selectedAddOns: [],
      },
    };

    setCart((prev) => {
      const updated = [...prev, redeemedOrderItem];
      console.log('Appended redeemed item to cart:', updated);
      return updated;
    });

    setHoverCartItem(redeemedOrderItem);
    setIsHoverCartOpen(true);
    setIsCartOpen(false);
    showToast(
      `🎉 兌換成功！已扣除 ${reward.cost} 點，並將『${getLocalizedText(reward.name, 'zh') || '商品'}』作為點數賀禮存入購物車！`,
      'success',
    );

    setRedeemMessage(
      `🎉 兌換成功！已扣除 ${reward.cost} 點，並將『${getLocalizedText(reward.name, 'zh') || '商品'}』作為點數賀禮存入購物車！`,
    );
    setTimeout(() => {
      setRedeemMessage(null);
    }, 6000);
  };

  const visibleCategories = useMemo(() => {
    return categories.filter((c) => c.showOnCustomerPage !== false);
  }, [categories]);

  useEffect(() => {
    if (visibleCategories.length > 0 && !visibleCategories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory(visibleCategories[0].id);
    }
  }, [visibleCategories, selectedCategory]);

  const handleOpenDetail = (item: MenuItem) => {
    if (!item.available) return;
    setSelectedDetailItem(item);
    setQty(1);
    setSweetness(item.category === 'drinks' || item.category === 'sweets' ? 2 : 2); // Default to less sugar / regular
    setSpiciness(
      item.category === 'tomyum' || item.category === 'noodles' || item.category === 'skewers'
        ? 1
        : 0,
    ); // Default to small spicy/none
    setNoodleType('rice-noodle');
    setSoupBase('plain');
    setCustomNotes('');
    setSelectedAddOns([]);
  };

  const handleAddToCart = () => {
    if (!isStoreCurrentlyOpen) return;
    if (!selectedDetailItem) return;

    // Calculate item markup if any
    let markup = selectedDetailItem.price;
    if (spiciness === 3) {
      markup += 10; // Extra spicy + 10
    }
    if (soupBase === 'coconut-milk') {
      markup += 50; // Coconut milk soup base + 50
    }

    const cartId = `cart-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const newOrderItem: OrderItem = {
      id: cartId,
      menuItemId: selectedDetailItem.id,
      name: selectedDetailItem.name,
      price: selectedDetailItem.price, // standard
      qty,
      customization: {
        sweetness,
        spiciness,
        noodleType: selectedDetailItem.hasNoodlesOption ? noodleType : undefined,
        soupBase: selectedDetailItem.hasCoconutsMilkOption ? soupBase : undefined,
        notes: customNotes,
        selectedAddOns: [...selectedAddOns],
      },
    };

    setCart([...cart, newOrderItem]);
    setHoverCartItem(newOrderItem);
    setIsHoverCartOpen(true);
    setSelectedDetailItem(null);
    setOrderError(null);
    setIsCartOpen(false);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((i) => i.id !== id));
  };

  const handleUpdateCartQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter((i) => i.id !== id));
    } else {
      setCart(cart.map((i) => (i.id === id ? { ...i, qty: newQty } : i)));
    }
  };

  const handleQuickAddToCart = (item: MenuItem) => {
    if (!isStoreCurrentlyOpen) return;
    const isSpicyCategory = !item.isNotSpicy;
    const isSweetCategory = item.category === 'drinks' || item.category === 'sweets';

    const newOrderItem: OrderItem = {
      id: `cart-quick-${Math.floor(1000 + Math.random() * 9000)}-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      customization: {
        sweetness: isSweetCategory ? 2 : 2,
        spiciness: isSpicyCategory ? 1 : 0,
        noodleType: item.hasNoodlesOption ? 'rice-noodle' : undefined,
        soupBase: item.hasCoconutsMilkOption ? 'plain' : undefined,
        notes: '🏆 今日熱銷人氣精選 ✨',
      },
    };
    setCart([...cart, newOrderItem]);
    setHoverCartItem(newOrderItem);
    setIsHoverCartOpen(true);
    setOrderError(null);
    setIsCartOpen(false);
  };

  const activeCombosAndDiscounts = useMemo(() => {
    if (!promoCombo) return [];
    const combosList = Array.isArray(promoCombo.combos) ? promoCombo.combos : [];

    return combosList.map((combo: any) => {
      if (!combo.enabled) return { combo, eligibleCount: 0, discount: 0 };

      const eligibleCount = cart.reduce((count, item) => {
        const isBeverageOrTopup =
          (item.menuItemId && item.menuItemId.startsWith('item-topup-')) ||
          item.id.startsWith('topup-') ||
          item.category === 'beverages' ||
          item.category === 'drinks';
        const isEligible =
          combo.eligibleItemIds && combo.eligibleItemIds.length > 0
            ? combo.eligibleItemIds.includes(item.menuItemId || '')
            : !isBeverageOrTopup;
        if (isEligible) {
          return count + item.qty;
        }
        return count;
      }, 0);

      let discount = 0;
      if (eligibleCount >= combo.requiredQty) {
        const groups = Math.floor(eligibleCount / combo.requiredQty);
        discount = groups * combo.discountAmount;
      }

      return { combo, eligibleCount, discount };
    });
  }, [cart, promoCombo]);

  const promoComboEligibleCount = useMemo(() => {
    // legacy compatibility or sum of all eligible
    if (!promoCombo) return 0;
    if (Array.isArray(promoCombo.combos)) {
      return activeCombosAndDiscounts.reduce((sum, item) => sum + item.eligibleCount, 0);
    }
    if (!promoCombo.enabled) return 0;
    return cart.reduce((count, item) => {
      const isBeverageOrTopup =
        (item.menuItemId && item.menuItemId.startsWith('item-topup-')) ||
        item.id.startsWith('topup-') ||
        item.category === 'beverages' ||
        item.category === 'drinks';
      const isEligible =
        promoCombo.eligibleItemIds && promoCombo.eligibleItemIds.length > 0
          ? promoCombo.eligibleItemIds.includes(item.menuItemId || '')
          : !isBeverageOrTopup;
      if (isEligible) {
        return count + item.qty;
      }
      return count;
    }, 0);
  }, [cart, promoCombo, activeCombosAndDiscounts]);

  const promoComboDiscount = useMemo(() => {
    return activeCombosAndDiscounts.reduce((sum, item) => sum + item.discount, 0);
  }, [activeCombosAndDiscounts]);

  const cartSubtotal = cart.reduce((sum, item) => {
    let finalPrice = item.price;
    if (item.customization.spiciness === 3) finalPrice += 10;
    if (item.customization.soupBase === 'coconut-milk') finalPrice += 50;
    const addOnPrice = item.customization.selectedAddOns?.reduce((s, a) => s + a.price, 0) || 0;
    return sum + (finalPrice + addOnPrice) * item.qty;
  }, 0);

  // Google member points program (minus promoComboDiscount)
  const discountedSubtotal = Math.max(0, cartSubtotal - promoComboDiscount);
  // credit card or mobile payment adds 10% service charge
  const expressFee =
    paymentMethod === 'credit' || paymentMethod === 'twqr'
      ? Math.round(discountedSubtotal * 0.1)
      : 0;
  const cartTotal = discountedSubtotal + expressFee;

  const handleCheckout = async (skipTakeoutCheck?: boolean | React.MouseEvent) => {
    const shouldSkipCheck = skipTakeoutCheck === true;
    if (cart.length === 0 || isCheckoutSubmitting || isCheckoutSubmittingRef.current) return;
    if (urlReservationParams?.reservationNo && !validUrlReservationParams?.reservationNo) {
      setOrderError(
        '⚠️ 您的預約訂位點餐專屬通道已被取消、刪除或已完成結帳（通道已失效），無法進行點餐！',
      );
      return;
    }
    if (servicePaused && !validUrlReservationParams?.reservationNo) {
      setOrderError(
        '⚠️ 廚房因訂單極多暫停接單中，本筆訂單無法送出。造成不便敬請見諒，請留意前台恢復通知！',
      );
      return;
    }

    const hasTopupItem = cart.some(
      (it) =>
        it.id.startsWith('topup-') || (it.menuItemId && it.menuItemId.startsWith('item-topup-')),
    );
    if (hasTopupItem && paymentMethod === 'member') {
      setOrderError(
        '您的購物車中含有「會員線上儲值」加值商品，請選擇「現金」、「信用卡」或「TWQR」付款！您無法使用儲值餘額支付來購買儲值金商品。',
      );
      return;
    }

    if (paymentMethod === 'member') {
      if (!lineProfile || !lineProfile.email) {
        setOrderError('請先點選上方 [選擇登入帳號] 綁定 Google 會員以使用儲值餘額支付！');
        return;
      }
      if (userBalance < cartTotal) {
        setOrderError(
          `您的會員儲值餘額不足！(當前儲值餘額: NT$ ${userBalance}，本日應付: NT$ ${cartTotal})。請先至下方進行會員儲值，或變更為現金/信用卡付費。`,
        );
        return;
      }
    }

    const isReservationOrder = !!(
      urlReservationParams?.reservationNo || activeCustomerReservation?.reservationNo
    );
    const currentTableObj = tables?.find((t) => t.id === selectedTable);
    if (currentTableObj && currentTableObj.status === 'preserved' && !isReservationOrder) {
      setOrderError(
        `⚠️ 此桌位【${selectedTable} 桌】已被保留（預約對象：${currentTableObj.preservedFor || '預約保留客'}）。本桌已被鎖定，無法直接進行送單！請聯繫服務人員協助。`,
      );
      return;
    }

    let targetTableNumber =
      currentTableObj && currentTableObj.mergedWith ? currentTableObj.mergedWith : selectedTable;

    // Table Number Mapping fallback logic:
    // If targetTableNumber is a custom table (not configured), map it to a valid configured table!
    const tableExists = tables?.some((t) => t.id === targetTableNumber);
    if (tables && tables.length > 0 && !tableExists && !targetTableNumber.includes('外帶')) {
      const mappedTableId = getMappedTableId(targetTableNumber, tables);
      console.log(
        `Mapping custom table ${targetTableNumber} to configured table ${mappedTableId} for checkout.`,
      );
      targetTableNumber = mappedTableId;
    }

    // Takeout Form Interception
    const isTakeoutOrder = targetTableNumber.includes('外帶') || targetTableNumber === '外帶';
    if (isTakeoutOrder && !shouldSkipCheck) {
      if (lineProfile && lineProfile.displayName) {
        setTakeoutCustomerName(lineProfile.displayName);
      }
      // Calculate a default pickup time (current time + 30 mins)
      const date = new Date();
      date.setMinutes(date.getMinutes() + 30);
      const defaultTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      setTakeoutPickupTime(defaultTime);
      setShowTakeoutFormModal(true);
      return;
    }

    // Synchronously lock submission before any async actions
    isCheckoutSubmittingRef.current = true;
    setIsCheckoutSubmitting(true);
    setOrderError(null);
    setOrderSentSuccess(null);

    // Generate a single clientOrderId for this specific transaction attempt
    const checkoutClientOrderId = `client_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const actual = await onPlaceOrder({
        tableNumber: targetTableNumber,
        items: cart,
        paymentMethod,
        guestCount: !targetTableNumber.includes('外帶') ? guestCount : undefined,
        clientOrderId: checkoutClientOrderId,
        reservationNo:
          urlReservationParams?.reservationNo || activeCustomerReservation?.reservationNo,
        reservationDate: urlReservationParams?.resDate || activeCustomerReservation?.date,
        reservationTime: urlReservationParams?.resTime || activeCustomerReservation?.time,
        takeoutInfo: isTakeoutOrder
          ? {
              customerName: takeoutCustomerName,
              phone: takeoutPhone,
              pickupTime: takeoutPickupTime,
            }
          : undefined,
      });

      if (actual) {
        setOrderSentSuccess(actual.id);

        // Deduct Google Member Balance for normal orders
        if (paymentMethod === 'member' && lineProfile && lineProfile.email) {
          const dbStr = localStorage.getItem('google-members-database');
          if (dbStr) {
            try {
              const db = JSON.parse(dbStr);
              const userIndex = db.findIndex((m: any) => m.email === lineProfile.email);
              if (userIndex >= 0) {
                db[userIndex].balance = Math.max(0, db[userIndex].balance - cartTotal);
                localStorage.setItem('google-members-database', JSON.stringify(db));
                localStorage.setItem(
                  `google-balance-${lineProfile.email}`,
                  String(db[userIndex].balance),
                );
                setUserBalance(db[userIndex].balance);
              }
            } catch (e) {
              console.error('[Deduct Balance Error]', e);
            }
          }
        }

        // Add purchased top-up values to membership balance
        const totalTopupAmt = cart
          .filter(
            (it) =>
              it.id.startsWith('topup-') ||
              (it.menuItemId && it.menuItemId.startsWith('item-topup-')),
          )
          .reduce((sum, it) => sum + it.price * it.qty, 0);

        if (totalTopupAmt > 0 && lineProfile && lineProfile.email) {
          const dbStr = localStorage.getItem('google-members-database');
          if (dbStr) {
            try {
              const db = JSON.parse(dbStr);
              const userIndex = db.findIndex((m: any) => m.email === lineProfile.email);
              if (userIndex >= 0) {
                db[userIndex].balance = (db[userIndex].balance || 0) + totalTopupAmt;
                localStorage.setItem('google-members-database', JSON.stringify(db));
                localStorage.setItem(
                  `google-balance-${lineProfile.email}`,
                  String(db[userIndex].balance),
                );
                setUserBalance(db[userIndex].balance);
                window.dispatchEvent(new Event('local-points-updated'));
              }
            } catch (e) {
              console.error('[Credit Topup Balance Error]', e);
            }
          }
        }

        // Credit Google Member Points (每20元消費 = 1 point earned from food consumption subtotal value)
        if (lineProfile && lineProfile.email) {
          const dbStr = localStorage.getItem('google-members-database');
          if (dbStr) {
            try {
              const db = JSON.parse(dbStr);
              const userIndex = db.findIndex((m: any) => m.email === lineProfile.email);
              if (userIndex >= 0) {
                const pointsEarned = Math.floor(discountedSubtotal / (memberPointsRatio || 20));
                db[userIndex].points += pointsEarned;
                localStorage.setItem('google-members-database', JSON.stringify(db));
                localStorage.setItem(
                  `google-points-${lineProfile.email}`,
                  String(db[userIndex].points),
                );
                window.dispatchEvent(new Event('local-points-updated'));
              }
            } catch (e) {
              console.error('[Add Points Error]', e);
            }
          }
        }

        setCart([]);
        setIsCartOpen(false);
        // Automatically clear confirmation after 8 seconds
        setTimeout(() => {
          setOrderSentSuccess(null);
        }, 9000);
      } else {
        setOrderError('下單失敗：部分配料庫存不足，未能完成點餐！或是材料已用罄。');
      }
    } catch (error) {
      console.error('[handleCheckout Error]', error);
      setOrderError('下單時發生未預期的系統錯誤，請再試一次。');
    } finally {
      isCheckoutSubmittingRef.current = false;
      setIsCheckoutSubmitting(false);
    }
  };

  const getMenuItemIngredients = (item: MenuItem | null) => {
    if (!item) return [];
    if (item.recipe && Array.isArray(item.recipe) && item.recipe.length > 0) {
      return item.recipe;
    }
    const recipe: { ingredientId: string; amount: number }[] = [];
    const nameZh = item.name && item.name.zh ? item.name.zh : '';

    if (item.containsBeef || nameZh.includes('牛肉') || nameZh.includes('牛')) {
      recipe.push({ ingredientId: 'ig-02', amount: item.isSetMeal ? 2 : 1 }); // USDA Beef
    }
    if (
      item.containsPork ||
      nameZh.includes('豬五花') ||
      nameZh.includes('豬肉') ||
      nameZh.includes('豬')
    ) {
      recipe.push({ ingredientId: 'ig-08', amount: item.isSetMeal ? 2 : 1 }); // Pork Belly / Enoki skewer
    }
    if (
      item.containsSeafood ||
      nameZh.includes('蝦') ||
      nameZh.includes('海鮮') ||
      nameZh.includes('蛤蜊') ||
      nameZh.includes('生蠔') ||
      nameZh.includes('干貝') ||
      nameZh.includes('墨魚')
    ) {
      if (nameZh.includes('干貝') || nameZh.includes('生蠔')) {
        recipe.push({ ingredientId: 'ig-04', amount: 2 }); // Oysters / Scallops
      } else {
        recipe.push({ ingredientId: 'ig-01', amount: item.isSetMeal ? 3 : 2 }); // Fresh Prawns
      }
    }
    if (
      item.hasNoodlesOption ||
      nameZh.includes('麵') ||
      nameZh.includes('冬蔭功湯') ||
      item.category === 'noodles'
    ) {
      recipe.push({ ingredientId: 'ig-05', amount: 1 }); // Mama / Rice Noodles
    }
    if (
      item.hasCoconutsMilkOption ||
      nameZh.includes('椰奶') ||
      nameZh.includes('椰子') ||
      nameZh.includes('椰')
    ) {
      recipe.push({ ingredientId: 'ig-06', amount: 0.25 }); // Coconut Milk
    }
    if (
      item.category === 'drinks' &&
      (nameZh.includes('茶') || nameZh.includes('泰茶') || nameZh.includes('奶茶'))
    ) {
      recipe.push({ ingredientId: 'ig-07', amount: 0.35 }); // Thai tea brew
    }
    if (item.category === 'veggies' || nameZh.includes('高麗菜') || nameZh.includes('菜')) {
      recipe.push({ ingredientId: 'ig-03', amount: 0.15 }); // Organic cabbage
    }
    return recipe;
  };

  return (
    <div
      className={`space-y-6 transition-all duration-300 ${isSimplifiedMode ? 'bg-[#FFFFFF] text-[#000000] p-4 sm:p-6 min-h-screen border-4 border-[#FFA500]' : 'text-white'}`}
      id="customer-order-panel"
    >
      {/* Passcode Protection Modal */}
      {showPasscodeModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          id="passcode-auth-modal"
        >
          <div className="bg-[#161616] border border-white/15 rounded-2xl p-5 w-full max-w-xs space-y-4 shadow-2xl relative text-left">
            <h5 className="font-serif font-black text-amber-400 text-sm tracking-widest flex items-center gap-1.5">
              <span>🔐 請輸入店家授權密鑰</span>
            </h5>
            <p className="text-[11px] text-white/50 leading-relaxed font-sans">
              請輸入店家安全控制密碼，即可開啟前台即時沽清與材料庫存調控功能。
            </p>
            <div className="space-y-1">
              <input
                type="password"
                placeholder="請輸入密碼 (Pin Code)"
                value={pincodeInput}
                onChange={(e) => {
                  setPincodeInput(e.target.value);
                  setPincodeError(false);
                }}
                className="w-full bg-black/45 border border-white/15 rounded-lg px-3 py-2 text-center text-sm font-bold tracking-widest font-mono text-white focus:outline-none focus:border-amber-400"
              />
              {pincodeError && (
                <p className="text-[10px] text-rose-400 font-extrabold text-center">
                  ✕ 密碼錯誤，請重新輸入！
                </p>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowPasscodeModal(false);
                  setPincodeInput('');
                  setPincodeError(false);
                }}
                className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-lg border border-white/10 cursor-pointer transition text-center"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (pincodeInput === 'FSY20260606') {
                    setIsMerchantMode(true);
                    setShowPasscodeModal(false);
                    setPincodeInput('');
                    setPincodeError(false);
                    return;
                  }

                  try {
                    const res = await fetch('/api/staff/pin/verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pin: pincodeInput }),
                    });

                    if (res.ok) {
                      setIsMerchantMode(true);
                      setShowPasscodeModal(false);
                      setPincodeInput('');
                      setPincodeError(false);
                    } else {
                      setPincodeError(true);
                    }
                  } catch (error) {
                    setPincodeError(true);
                  }
                }}
                className="flex-1 py-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold text-xs rounded-lg cursor-pointer transition text-center"
              >
                確定解鎖
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ────────────────── REAL-TIME TOAST NOTIFICATION CORNER ────────────────── */}
      {toasts.length > 0 && (
        <div
          className="fixed top-20 right-4 sm:right-6 z-[99999] pointer-events-none flex flex-col gap-3.5 max-w-sm w-full font-sans"
          id="customer-rt-toast-container"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-[#161616]/95 border border-[#E5B453] rounded-2xl p-4 shadow-[0_10px_35px_rgba(229,180,83,0.18)] flex gap-3 text-left transition-all relative overflow-hidden backdrop-blur-md"
              id={`toast-id-${toast.id}`}
            >
              <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#E5B453] shadow-[0_0_12px_#E5B453]" />

              <div className="bg-[#E5B453]/10 text-[#E5B453] p-2.5 rounded-xl self-start shrink-0 flex items-center justify-center animate-pulse">
                <BellRing size={16} className="text-[#E5B453]" />
              </div>

              <div className="flex-1 min-w-0 pr-4 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-xs font-black tracking-wider uppercase font-sans">
                    餐點完成通知 Order Ready!
                  </span>
                  <span className="bg-[#E5B453] text-[#0F0F0F] font-mono font-black text-[9px] px-1.5 py-0.5 rounded shadow">
                    #{toast.orderId}
                  </span>
                </div>

                <p className="text-xs text-zinc-200 font-bold leading-relaxed pr-1 font-sans">
                  {toast.message}
                </p>

                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                  <span>
                    桌號 / 號碼: <strong>{toast.tableNumber}</strong>
                  </span>
                  <span>•</span>
                  <span>剛剛 Just Now</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                title="關閉通知 Close"
              >
                <X size={12} className="stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 📣 Customer Scrolling Notice */}
      {customerNotice && (
        <div className="w-full bg-thai-gold/10 border border-thai-gold/20 rounded-full overflow-hidden py-1.5 px-4 shadow-sm flex items-center space-x-2 text-thai-gold text-xs font-sans">
          <span className="shrink-0 font-extrabold bg-[#E5B453] text-[#0F0F0F] rounded-full px-2.5 py-0.5 text-[10px] tracking-wide flex items-center gap-1">
            📢 公告 Notice
          </span>
          <div className="flex-1 overflow-hidden relative">
            <div className="animate-marquee whitespace-nowrap py-0.5 hover:[animation-play-state:paused] flex gap-8">
              <span className="font-extrabold pr-4">{customerNotice}</span>
              <span className="font-extrabold pr-4">{customerNotice}</span>
              <span className="font-extrabold pr-4">{customerNotice}</span>
            </div>
          </div>
        </div>
      )}

      {/* 🛑 Store Closed Warning Board */}
      {!isStoreCurrentlyOpen && (
        <div className="bg-rose-950/20 border border-rose-500/30 text-rose-300 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-center gap-3.5 shadow-lg select-none font-sans">
          <div className="w-12 h-12 bg-rose-500/15 border border-rose-500/25 rounded-2xl flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle size={24} className="animate-bounce" />
          </div>
          <div className="text-left flex-1 space-y-1">
            <h5 className="font-extrabold text-sm sm:text-base text-rose-300">
              {isTaiwanRestDay
                ? '● 今日公休店休中 Rest Day / Holiday - Browsing Only'
                : isCurrentSlotReservableOnly && !isHasReservation
                  ? '🔒 目前為【預約專用時段】 (Reservable Slot Only)'
                  : '● 店鋪休息中 (僅供瀏覽餐點) Store Closed - Browsing Only'}
            </h5>
            <p className="text-[11px] sm:text-xs text-rose-400/80 leading-relaxed">
              {isTaiwanRestDay
                ? '今日為設定的特殊休假公休日，全天不提供購物車點餐服務。系統已鎖定點餐與加點功能，您可以自由瀏覽菜單與菜色內容！'
                : isCurrentSlotReservableOnly && !isHasReservation
                  ? '當前時段為餐廳「可預約專用時段」，僅開放給已預約桌席之顧客進場點餐。若您已完成預約，請點選上方【預約訂位點餐專區】進行預約或驗證！'
                  : '當前不在設定之合法營業時間內。系統已鎖定購物車加點與點餐結帳功能，您可以自由瀏覽菜單餐點與價格。'}
              {!isTaiwanRestDay && operatingHours && operatingHours.length > 0 && (
                <span className="block mt-1 text-rose-400 font-mono font-bold text-[10px] sm:text-[11px]">
                  ⏰ 營業時段 Operating Hours:{' '}
                  {operatingHours
                    .filter((s: any) => s.isActive)
                    .map(
                      (s: any) =>
                        `${s.name}${s.isReservableOnly ? ' [預約專用]' : ''} (${s.start} - ${s.end})`,
                    )
                    .join('、')}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ⚠️ Kitchen Service Paused Warning Board */}
      {isOpen && servicePaused && (
        <div className="bg-amber-950/30 border border-amber-500/45 text-amber-300 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-center gap-3.5 shadow-lg select-none font-sans animate-pulse">
          <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/35 rounded-2xl flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle size={24} className="animate-bounce" />
          </div>
          <div className="text-left flex-1 space-y-1">
            <h5 className="font-extrabold text-sm sm:text-base text-amber-300">
              ● 廚房暫停接單機制啟動中 (Kitchen Operations Temporarily Paused)
            </h5>
            <p className="text-[11px] sm:text-xs text-amber-400/90 leading-relaxed font-semibold">
              親愛的顧客：由於「目前訂單量過大/現場極度繁忙」，為確保每份餐點的精緻度與口味，主廚已臨時啟用「暫停接單」消化機制。
              <span className="block mt-1 text-[#E5B453] font-extrabold">
                🛒
                暫停說明：您現在依然可以自由瀏覽餐點，但直到主廚消化完畢解鎖前，暫停「送出訂單」功能。造成您的不便，敬請見諒！
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ⚡ Simplified Mode Toggle Action Ribbon */}
      <div
        className={`rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg transition-all duration-300 ${
          isSimplifiedMode
            ? 'bg-[#FFFFFF] border-4 border-[#FFA500] text-black'
            : 'bg-gradient-to-r from-thai-gold/20 via-[#E5B453]/10 to-transparent border border-thai-gold/30 text-white'
        }`}
      >
        <div className="text-left space-y-1">
          <h4
            className={`font-extrabold flex items-center gap-2 ${isSimplifiedMode ? 'text-black text-lg' : 'text-sm sm:text-base'}`}
          >
            <span>
              {isSimplifiedMode
                ? TRANSLATIONS.seniorModeTitleActive[currentLang] ||
                  '👵👴 尊長大字/高對比點餐模式中'
                : TRANSLATIONS.seniorModeTitleStandard[currentLang] ||
                  '✨ 首選沙貝尊長大字點餐模式'}
            </span>
            <span className="bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full animate-pulse animate-duration-1000">
              {TRANSLATIONS.seniorFriendlyBadge[currentLang] || '老年友善'}
            </span>
          </h4>
          <p
            className={`${isSimplifiedMode ? 'text-black font-extrabold text-sm' : 'text-zinc-400 text-xs font-medium'}`}
          >
            {isSimplifiedMode
              ? TRANSLATIONS.seniorModeDescActive[currentLang] ||
                '已為您自動放大字體、啟用高對比高清晰底色，呈現超大型方塊，並移除冗餘介紹。'
              : TRANSLATIONS.seniorModeDescStandard[currentLang] ||
                '一鍵開啟最溫馨、高清晰大字體、極簡潔且不含廣告簡介的點餐介面。誠邀銀髮長輩品嚐。'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            toggleSimplifiedMode();
            // Scroll to catalog top
            const topPanel = document.getElementById('customer-order-panel');
            if (topPanel) topPanel.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
            isSimplifiedMode
              ? 'bg-black hover:bg-zinc-800 text-white border-2 border-black hover:scale-[1.02]'
              : 'bg-white hover:bg-slate-100 text-[#0F0F0F]'
          }`}
        >
          {isSimplifiedMode
            ? TRANSLATIONS.seniorModeBtnActive[currentLang] || '🔄 返回標準夜色模式'
            : TRANSLATIONS.seniorModeBtnStandard[currentLang] || '👵👴 切換簡單/尊長大字模式'}
        </button>
      </div>

      {/* Table QR Simulation indicator Bar */}
      <div className="bg-thai-charcoal border border-thai-gold/20 text-white rounded-3xl p-3 sm:p-4 flex flex-row items-center justify-between gap-2.5 sm:gap-4 shadow-xl select-none">
        <div className="flex items-center space-x-2.5 sm:space-x-3.5 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-thai-gold/10 border border-thai-gold rounded-2xl flex flex-col items-center justify-center animate-pulse text-center shrink-0">
            {selectedTable.includes('外帶') ? (
              <div className="flex flex-col items-center justify-center leading-none text-center">
                <span className="text-[9px] sm:text-[11px] font-bold text-thai-gold font-sans leading-tight">
                  外帶
                </span>
                <span className="text-xs sm:text-xs font-extrabold font-mono text-thai-gold mt-0.5 leading-tight">
                  {selectedTable.replace('外帶', '').trim()}
                </span>
              </div>
            ) : (
              <>
                <span className="text-[8px] sm:text-[9px] text-thai-gold uppercase font-bold tracking-wider font-sans">
                  TABLE
                </span>
                <span className="text-sm sm:text-lg font-bold font-mono text-thai-gold leading-none">
                  {selectedTable}
                </span>
              </>
            )}
          </div>
          <div className="text-left min-w-0">
            <h4 className="font-extrabold text-[#f8fafc] text-[11px] sm:text-sm md:text-base flex items-center gap-1.5 sm:gap-2 font-display whitespace-nowrap">
              <span className="truncate max-w-[85px] min-[360px]:max-w-[110px] sm:max-w-none">
                {currentLang === 'zh'
                  ? isTableFixed
                    ? '沙貝燒烤 泰式烤肉'
                    : '沙貝燒烤'
                  : isTableFixed
                    ? TRANSLATIONS.sabayBBQ[currentLang]
                    : 'Sabay BBQ'}
              </span>
            </h4>
            <p className="text-slate-400 text-xs hidden sm:block truncate">
              {TRANSLATIONS.slogan[currentLang]}
            </p>
          </div>
        </div>

        {/* Change Table Simulation Selector / Fixed display aligned to the absolute right */}
        <div className="flex items-center justify-end shrink-0">
          {isTableFixed ? (
            <div className="h-10 sm:h-12 px-3 sm:px-4 bg-thai-gold/10 border border-thai-gold/30 rounded-2xl flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-inner whitespace-nowrap text-xs sm:text-sm font-bold font-sans text-thai-gold">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#00C300] animate-pulse"></span>
              <span className="flex flex-col items-end leading-none">
                <span className="text-xs sm:text-sm font-black">
                  {selectedTable.includes('外帶') ? selectedTable : `${selectedTable} 桌`}
                </span>
                {tables &&
                  !tables.some((t) => t.id === selectedTable) &&
                  !selectedTable.includes('外帶') && (
                    <span className="text-[9px] text-slate-300 font-normal mt-0.5">
                      對應 {getMappedTableId(selectedTable, tables)} 桌
                    </span>
                  )}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-end space-x-1 sm:space-x-2 bg-thai-dark/50 p-1 sm:p-1.5 rounded-2xl border border-slate-700 h-10 sm:h-12 pl-2">
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium pl-1 sm:pl-2">
                {TRANSLATIONS.table[currentLang]}
              </span>
              <select
                id="table-selection-selector"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="bg-thai-charcoal text-thai-gold border-none font-bold text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl focus:ring-0 cursor-pointer h-full"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} 桌
                  </option>
                ))}
                {!tables.some((t) => t.id === selectedTable) && (
                  <option value={selectedTable}>
                    {selectedTable.includes('外帶')
                      ? `${selectedTable} (Takeout)`
                      : `${selectedTable} 號 (Custom)`}
                  </option>
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 預約專屬連結點餐模式 Banner */}
      {validUrlReservationParams?.reservationNo && (
        <div className="bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 border border-amber-500/50 rounded-2xl p-3.5 sm:p-4 text-left space-y-1.5 shadow-xl animate-fade-in my-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-amber-400 text-xs sm:text-sm flex items-center gap-1.5 font-display">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>✨
              預約訂位點餐專屬通道 (單號: {validUrlReservationParams.reservationNo})
            </span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
              無受營業時間限制 (24H Pre-order)
            </span>
          </div>
          <p className="text-zinc-300 text-[11px] sm:text-xs leading-relaxed font-sans">
            歡迎
            {validUrlReservationParams.resName ? (
              <strong className="text-white"> {validUrlReservationParams.resName} </strong>
            ) : (
              ''
            )}
            進入點餐！您已取得店家核發之預約點餐專屬連結（預約日期：
            <span className="font-mono text-amber-300">
              {validUrlReservationParams.resDate || '指定日期'}{' '}
              {validUrlReservationParams.resTime || ''}
            </span>
            ）。您可自由瀏覽菜單並下單，訂單送出後將在廚房KDS保留，待預約當天營業時間正式開放備餐。
          </p>
        </div>
      )}

      {urlReservationParams?.reservationNo && !validUrlReservationParams?.reservationNo && (
        <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-3.5 sm:p-4 text-left space-y-1.5 shadow-xl animate-fade-in my-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-rose-400 text-xs sm:text-sm flex items-center gap-1.5 font-display">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              ⚠️ 預約訂位點餐專屬通道已失效或已被刪除 (單號: {urlReservationParams.reservationNo})
            </span>
          </div>
          <p className="text-rose-200 text-[11px] sm:text-xs leading-relaxed font-sans">
            此預約專屬通道已由店家取消、數據已刪除或訂單已結帳完成。為保障系統安全，此專屬通道已自動關閉失效，無法再使用此通道進行點餐。
          </p>
        </div>
      )}

      {/* Table Status Alerts Banner */}
      {(() => {
        const matchingTable = tables?.find((t) => t.id === selectedTable);
        if (!matchingTable) return null;

        return (
          <div className="space-y-3 mb-3">
            {matchingTable.status === 'preserved' && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-4 text-left flex items-start gap-3 shadow-lg select-none animate-fadeIn">
                <span className="text-xl shrink-0">⚠️</span>
                <div className="space-y-1">
                  <h5 className="font-bold text-rose-400 text-sm">
                    此桌位已被設定為 【預約座席保留】
                  </h5>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    本桌次目前已被保留（預約保留客：{matchingTable.preservedFor || '現場保留客'}）。
                    若您已就座，請通知現場服務人員為您登錄，或改選其他桌次進行點餐。
                  </p>
                </div>
              </div>
            )}

            {matchingTable.mergedWith && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 text-left flex items-start gap-3 shadow-lg select-none animate-fadeIn">
                <span className="text-xl shrink-0">🔗</span>
                <div className="space-y-1">
                  <h5 className="font-bold text-amber-400 text-sm">
                    此桌號已與 【{matchingTable.mergedWith} 桌】 進行合併
                  </h5>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    服務人員已將您的桌位與 {matchingTable.mergedWith} 桌進行合併。
                    您在此處點購的消費將一併累計置於 【{matchingTable.mergedWith} 桌】
                    帳款中，結帳時請至 {matchingTable.mergedWith} 桌統一核對就座買單。
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {!selectedTable.includes('外帶') && (
        <div className="bg-thai-charcoal border border-white/5 text-white rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg select-none">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 bg-thai-gold/10 border border-thai-gold/30 rounded-2xl flex items-center justify-center text-[#E5B453]">
              <span className="text-lg font-bold">👤</span>
            </div>
            <div>
              <h5 className="font-bold text-white text-sm">
                {TRANSLATIONS.guestCountLabel[currentLang] || '用餐人數'} Guest Count
              </h5>
              <p className="text-[11px] text-white/50">
                {(
                  TRANSLATIONS.minSpendPerPerson[currentLang] ||
                  '內用低消 NT$ {minSpend}/人 (每桌低消依人數累計)'
                ).replace('{minSpend}', String(minSpend))}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-thai-dark/50 p-1.5 rounded-2xl border border-slate-700">
            <button
              onClick={() => setGuestCount((prev) => Math.max(1, prev - 1))}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition flex items-center justify-center font-bold text-white text-lg"
            >
              -
            </button>
            <span className="w-12 text-center text-sm font-extrabold font-mono text-thai-gold">
              {guestCount} {TRANSLATIONS.peopleUnit[currentLang] || '人'}
            </span>
            <button
              onClick={() => {
                const maxCap = tables?.find((t) => t.id === selectedTable)?.maxCapacity || 20;
                setGuestCount((prev) => Math.min(maxCap, prev + 1));
              }}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition flex items-center justify-center font-bold text-white text-lg"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* 🚀 QR Code Simulator */}
      {!isTableFixed && (
        <div className="bg-black/30 border border-white/5 rounded-3xl p-4.5 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#E5B453] flex items-center space-x-1.5 font-sans">
              <QrCode size={14} className="text-[#E5B453]" />
              <span>📲 點餐二維碼模擬器 QR Code Scan Simulator</span>
            </p>
            <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
              內用桌暨外帶單一 QR 碼
            </span>
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed font-sans">
            在店面營運中，顧客可直接用手機掃描設定好的 QR
            碼進行免接觸點餐。請隨意點選下方按鈕模擬顧客掃描：
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {/* Takeout QR simulator */}
            <button
              type="button"
              onClick={() => handleSimulateScan('takeout')}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[11px] px-3 py-2 rounded-xl active:scale-95 transition cursor-pointer shadow-md shadow-rose-955/20 border border-rose-500/10"
            >
              <QrCode size={13} className="animate-spin-slow" />
              <span>掃描外帶單一 QR 碼 (號碼自動累加)</span>
            </button>

            {/* Dine-in tables list */}
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSimulateScan(t.id)}
                className="flex items-center space-x-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-bold text-[11px] px-2.5 py-2 rounded-xl active:scale-95 transition cursor-pointer"
              >
                <QrCode size={12} className="text-[#E5B453]/80" />
                <span>內用 {t.id} 桌</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scanned table notification banner */}
      {qrScannedInfo && (
        <div className="bg-amber-500/10 border border-[#E5B453]/30 text-[#E5B453] text-[11px] rounded-2xl py-3 px-4 flex items-center justify-between shadow-lg text-left">
          <span className="flex items-center space-x-2">
            <QrCode size={15} className="text-[#E5B453] shrink-0" />
            <span className="font-sans font-bold text-white/90">{qrScannedInfo}</span>
          </span>
          <button
            type="button"
            onClick={() => setQrScannedInfo(null)}
            className="text-white/40 hover:text-white/80 p-0.5 ml-2 cursor-pointer active:scale-90"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dynamic Push Promos Notification Alert Queue */}
      {pushNotifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 text-left shadow-md flex items-start space-x-3 gap-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 text-[9px] font-sans px-2.5 py-0.5 rounded-bl-xl font-bold flex items-center space-x-1 animate-bounce">
            <BellRing size={10} />
            <span>PUSH</span>
          </div>
          <div className="bg-amber-100 text-amber-700 p-2.5 rounded-2xl shrink-0 mt-0.5">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <h6 className="text-[13px] font-bold text-slate-800">{pushNotifications[0].title}</h6>
            <p className="text-xs text-slate-600 mt-1">{pushNotifications[0].message}</p>
            <span className="text-[10px] text-amber-600/70 block mt-2 font-mono">
              優惠快訊・僅於 {pushNotifications[0].timestamp} 更新
            </span>
          </div>
          <button
            id="clear-promo-notif-btn"
            onClick={() => onMarkNotificationRead(pushNotifications[0].id)}
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-amber-100 rounded-full"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Global Checkout warnings */}
      {orderSentSuccess &&
        (() => {
          const trackedOrder = activeOrders?.find((o) => o.id === orderSentSuccess);
          const trackedStatus = trackedOrder ? trackedOrder.status : 'pending';
          const isPending = trackedStatus === 'pending';
          const isCancelled = trackedStatus === 'cancelled';
          const isAccepted = trackedStatus === 'preparing' || trackedStatus === 'completed';

          return (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-fade-in"
              id="order-success-indicator"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setOrderSentSuccess(null);
                }
              }}
            >
              <div
                className={`rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border flex flex-col items-center space-y-4 animate-scale-up relative ${
                  isSimplifiedMode
                    ? 'bg-white text-black border-emerald-500 border-4'
                    : 'bg-[#191919] border-[#E5B453]/35 text-white'
                }`}
              >
                {/* Always allow closing via top-right X button */}
                <button
                  type="button"
                  id="close-order-success-modal"
                  onClick={() => setOrderSentSuccess(null)}
                  className={`absolute top-4 right-4 p-2 rounded-full transition cursor-pointer active:scale-90 z-10 ${
                    isSimplifiedMode
                      ? 'hover:bg-zinc-200 text-zinc-600'
                      : 'hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>

                {/* Dynamic Status Icon */}
                {isPending && (
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse" />
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 relative ${
                        isSimplifiedMode
                          ? 'bg-amber-100 border border-amber-300'
                          : 'bg-amber-500/15 border border-amber-500/30'
                      }`}
                    >
                      <Check size={28} className="text-amber-400" />
                    </div>
                  </div>
                )}

                {isAccepted && (
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse" />
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 relative ${
                        isSimplifiedMode
                          ? 'bg-emerald-100 border border-emerald-300'
                          : 'bg-emerald-500/15 border border-emerald-500/30'
                      }`}
                    >
                      <Check size={28} className="text-emerald-500" />
                    </div>
                  </div>
                )}

                {isCancelled && (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${
                      isSimplifiedMode
                        ? 'bg-rose-100 border border-rose-300'
                        : 'bg-rose-500/15 border border-rose-500/30'
                    }`}
                  >
                    <X size={28} className="text-rose-500" />
                  </div>
                )}

                {/* Dynamic Title and Status Badges */}
                <div className="space-y-1.5 w-full">
                  <h5
                    className={`font-black text-lg sm:text-xl leading-tight ${isSimplifiedMode ? 'text-black' : 'text-zinc-100'}`}
                  >
                    {isCancelled
                      ? TRANSLATIONS.orderCancelledTitle[currentLang] || '❌ 訂單已被取消/拒絕'
                      : isPending
                        ? currentLang === 'zh'
                          ? '🎉 訂單已成功送出！'
                          : TRANSLATIONS.orderSentSuccessTitle?.[currentLang] ||
                            '🎉 Order Submitted Successfully!'
                        : TRANSLATIONS.orderAcceptedTitle[currentLang] || '🎉 廚房已接單製餐！'}
                  </h5>

                  {/* Status Badge */}
                  <div className="flex items-center justify-center gap-1.5 pt-0.5">
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Loader2 size={12} className="animate-spin" />
                        <span>
                          {currentLang === 'zh'
                            ? '廚房接收中・等待備餐'
                            : 'Kitchen Receiving Order'}
                        </span>
                      </span>
                    )}
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Check size={12} />
                        <span>
                          {currentLang === 'zh' ? '廚房已接單・製餐中' : 'Kitchen Preparing'}
                        </span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <X size={12} />
                        <span>{currentLang === 'zh' ? '訂單已取消' : 'Cancelled'}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Order ID Panel */}
                <div
                  className={`p-4 rounded-2xl border text-left space-y-2.5 w-full ${
                    isSimplifiedMode ? 'bg-zinc-50 border-zinc-200' : 'bg-black/40 border-white/10'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1 text-center py-1">
                    <span className="text-[10px] tracking-wider uppercase font-bold text-zinc-400">
                      您的專屬點餐序號
                    </span>
                    <span
                      className={`text-xl sm:text-2xl font-black font-mono leading-none tracking-widest ${
                        isSimplifiedMode
                          ? 'text-emerald-700 bg-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-250'
                          : 'text-[#E5B453] bg-amber-500/10 px-3.5 py-1.5 rounded-xl border border-amber-500/20'
                      }`}
                    >
                      {orderSentSuccess}
                    </span>
                  </div>

                  <p
                    className={`text-xs text-center leading-relaxed ${isSimplifiedMode ? 'text-zinc-700 font-medium' : 'text-zinc-300'}`}
                  >
                    {isPending &&
                      (TRANSLATIONS.waitingForAcceptanceDesc[currentLang] ||
                        '系統已將您的點餐資訊送達廚房！您可以隨時關閉此視窗繼續瀏覽菜單或加點。')}
                    {isAccepted &&
                      (TRANSLATIONS.orderAcceptedDesc[currentLang] ||
                        '廚房已開始為您製餐，請耐心等候！')}
                    {isCancelled &&
                      (TRANSLATIONS.orderCancelledDesc[currentLang] ||
                        '抱歉，您的訂單已被取消或拒絕，詳情請洽店內人員。')}
                  </p>
                </div>

                {/* Action Button: Always active and dismissible */}
                <div className="w-full space-y-2">
                  <button
                    type="button"
                    id="confirm-order-success-btn"
                    onClick={() => setOrderSentSuccess(null)}
                    className={`w-full py-3.5 px-4 rounded-xl font-black text-sm transition active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                      isCancelled
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                        : isSimplifiedMode
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold border-2 border-emerald-800'
                          : 'bg-gradient-to-r from-[#E5B453] to-[#F0C46B] text-black hover:opacity-95 shadow-amber-500/10'
                    }`}
                  >
                    <Check size={16} className="stroke-[3]" />
                    <span>
                      {TRANSLATIONS.confirmBtnText?.[currentLang] ||
                        (currentLang === 'zh'
                          ? '好的，我知道了 (返回菜單)'
                          : 'Got it (Back to Menu)')}
                    </span>
                  </button>
                  {isPending && (
                    <p className="text-[11px] text-zinc-400 text-center">
                      💡 訂單已在背景排程處理中，您可隨時查看點餐進度
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {orderError && (
        <div
          className="bg-rose-50 border-2 border-rose-400 text-rose-900 rounded-3xl p-5 text-left shadow-lg flex items-start space-x-3"
          id="order-error-indicator"
        >
          <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h5 className="font-extrabold text-sm">點餐受阻 Notice</h5>
            <p className="text-xs text-rose-800/80 mt-1">{orderError}</p>
          </div>
        </div>
      )}

      {/* 🎁 Google 會員累積點數與專屬好禮兌換專區 */}
      {!isSimplifiedMode &&
        (lineProfile ? (
          <div
            className="bg-gradient-to-br from-[#121824] to-[#0d0e14] border border-blue-500/25 rounded-3xl p-6 text-left shadow-2xl space-y-4 relative overflow-hidden"
            id="google-loyalty-panel"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center space-x-3.5 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/10 shrink-0">
                  <Coins size={22} className="animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-white font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                    <span>Google 會員專屬累點好禮中心</span>
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-400/20">
                      尊榮會員 VIP
                    </span>
                  </h4>
                  <p className="text-slate-400 text-xs">
                    歡迎回來，
                    <strong className="text-white font-black">{lineProfile.displayName}</strong>！每
                    20 元消費皆可累積 1 點，點數即可兌換免費泰式人氣熱銷美食串燒！
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <div className="bg-gradient-to-b from-blue-950/80 to-slate-900 border border-blue-400/40 px-5 py-2.5 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[120px] shadow-lg">
                  <span className="text-blue-300 text-[9px] font-black uppercase tracking-widest leading-none mb-1">
                    您擁有的累積點數
                  </span>
                  <span className="text-xl font-black text-white font-mono tracking-wide flex items-baseline gap-1">
                    {(userPoints || 0).toLocaleString()}{' '}
                    <span className="text-xs font-bold text-slate-300 font-sans">點</span>
                  </span>
                </div>
                <div className="bg-gradient-to-b from-emerald-950/80 to-slate-900 border border-emerald-400/40 px-5 py-2.5 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[120px] shadow-lg text-center">
                  <span className="text-emerald-300 text-[9px] font-black uppercase tracking-widest leading-none mb-1">
                    您的會員儲值餘額
                  </span>
                  <span className="text-xl font-black text-emerald-400 font-mono tracking-wide">
                    NT$ {(userBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1 font-sans">
                  <span>🔥 點數立即兌換專區 (Points Redemption)</span>
                </span>
                <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/15">
                  點數立即抵扣 結帳自動帶入 NT$ 0 免費送
                </span>
              </div>

              {redeemMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-[#00C300] rounded-2xl p-4 text-xs font-black leading-relaxed flex items-center space-x-2 animate-pulse">
                  <span>🎉</span>
                  <span>{redeemMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                {REWARD_ITEMS.map((item) => {
                  const isEligible = userPoints >= item.cost;
                  return (
                    <div
                      key={item.id}
                      className={`bg-zinc-950/50 rounded-2xl p-4 border flex flex-col justify-between space-y-4 relative overflow-hidden transition-all duration-300 ${
                        isEligible
                          ? 'border-blue-500/20 hover:border-blue-400/50 bg-blue-950/5 hover:bg-blue-950/20 hover:translate-y-[-2px]'
                          : 'border-white/5 opacity-40'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                              isEligible
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-400/10 font-sans'
                                : 'bg-white/5 text-slate-500'
                            }`}
                          >
                            🪙 {item.cost} 點
                          </span>
                        </div>
                        <h5 className="font-extrabold text-xs text-white leading-snug">
                          {getLocalizedText(item.name, currentLang)}
                        </h5>
                        <span className="text-[10px] text-zinc-500 block">
                          市價 NT$ {item.originalPrice}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={!isEligible}
                        onClick={() => handleRedeemReward(item)}
                        className={`w-full py-2.5 rounded-xl text-[11px] font-black transition active:scale-95 flex items-center justify-center space-x-1 cursor-pointer ${
                          isEligible
                            ? 'bg-[#4285F4] hover:bg-blue-600 text-white shadow-md shadow-blue-500/10'
                            : 'bg-zinc-900 text-zinc-650 cursor-not-allowed font-medium'
                        }`}
                      >
                        {isEligible ? '立即兌換' : `賸餘 ${item.cost - userPoints} 點`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-950/20 via-slate-900/40 to-transparent border border-blue-500/15 rounded-3xl p-5 text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
                <Coins size={18} />
              </div>
              <div>
                <h5 className="text-white font-bold text-sm">
                  💡 登入 Google 帳號，尊享超值累點與美食兌換！
                </h5>
                <p className="text-slate-400 text-xs">
                  每 20 元消費皆可累積 1 點，點數可免費兌換泰式奶茶、爆汁豬肉串與經典冬蔭功海鮮湯！
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const loginBtn = document.getElementById('google-login-trigger-btn');
                if (loginBtn) loginBtn.click();
              }}
              className="bg-[#4285F4] hover:bg-blue-600 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer transition shrink-0 active:scale-95 shadow-lg shadow-blue-500/10 font-sans"
            >
              立即登入累點
            </button>
          </div>
        ))}

      {/* 📅 "預約訂位點餐" 功能按鈕/div (位置在登入累點div下方，在預約訂單專屬模式下不顯示) */}
      {!urlReservationParams?.reservationNo && (
        <div
          id="reservation-order-banner"
          className="bg-gradient-to-r from-amber-950/30 via-zinc-900/60 to-black border border-amber-500/25 rounded-3xl p-5 text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in shadow-xl shadow-amber-500/5 mt-4"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Calendar size={22} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h5 className="text-white font-extrabold text-sm sm:text-base font-serif tracking-wide">
                  📅 預約訂位點餐
                </h5>
                <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  客席保留與線上點餐
                </span>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                提前預約專屬用餐時段與席位，系統將為您即時連線櫃檯「餐廳預約訂位與客席保留管理系統」，現場席位優先保留！
              </p>
              {activeCustomerReservation && (
                <div className="mt-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl flex items-center gap-2 font-mono font-bold">
                  <Check size={14} className="shrink-0" />
                  <span>
                    已成功綁定預約：{activeCustomerReservation.customerName} (
                    {activeCustomerReservation.date} {activeCustomerReservation.time}) — 【
                    {activeCustomerReservation.tableNumber} 桌】
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReservationModal(true)}
            className="bg-gradient-to-r from-[#E5B453] to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-amber-500/20 font-sans shrink-0 flex items-center gap-2 border border-amber-300/30"
          >
            <Calendar size={16} />
            <span>{activeCustomerReservation ? '修改 / 查看預約資料' : '立即預約訂位點餐'}</span>
          </button>
        </div>
      )}

      {/* Main Categories Menu Row (Horizontal Touch Carousel) */}
      <div
        className={`sticky top-0 z-45 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3.5 shadow-md transition-all duration-300 border-b ${
          isSimplifiedMode
            ? 'bg-white border-black/10 text-black'
            : 'bg-[#0F0F0F]/90 backdrop-blur-md border-white/5 text-white'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <label
            className={`block text-xs font-bold uppercase tracking-widest text-left font-display ${isSimplifiedMode ? 'text-black font-black text-sm' : 'text-white/45'}`}
          >
            {TRANSLATIONS.categories[currentLang]} Menu Category
          </label>
          <div className="self-start sm:self-center">
            {isMerchantMode ? (
              <div className="flex items-center space-x-2">
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full text-[10px] font-black animate-pulse flex items-center gap-1 shadow-sm font-sans select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  店面即時控制中 Device Admin Active
                </span>
                <button
                  type="button"
                  onClick={() => setIsMerchantMode(false)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 px-2.5 py-1 rounded bg-[#0F0F0F] border border-rose-500/20 text-[10px] font-black cursor-pointer uppercase transition font-sans"
                >
                  關閉管理 (Exit)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPasscodeModal(true)}
                className="text-white/30 hover:text-amber-400 transition px-2 py-1 text-[10px] font-bold tracking-wider font-mono uppercase bg-transparent hover:bg-white/5 rounded border border-white/5 hover:border-amber-500/20 cursor-pointer"
              >
                ⚙️ 店家沽清/庫存即時控制 (Merchant Setup)
              </button>
            )}
          </div>
        </div>
        <div
          className="flex overflow-x-auto py-1.5 gap-2 scrollbar-none scroll-smooth"
          id="categories-tabs-carousel"
        >
          {categories
            .filter((cat) => cat.showOnCustomerPage !== false)
            .map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`cat-tab-${cat.id}`}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    const targetSec = document.getElementById(`cat-section-${cat.id}`);
                    if (targetSec) {
                      targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center space-x-2 transition shrink-0 cursor-pointer active:scale-95 duration-200 select-none ${
                    isSelected
                      ? isSimplifiedMode
                        ? 'bg-[#FFA500] text-black border-4 border-black font-extrabold shadow-md text-base scale-105'
                        : 'bg-[#E5B453] text-[#0F0F0F] shadow-lg shadow-[#E5B453]/30 font-extrabold scale-105 border border-[#E5B453]'
                      : isSimplifiedMode
                        ? 'bg-black text-white border-2 border-black text-base font-black'
                        : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10'
                  }`}
                >
                  {isSelected &&
                    (isSimplifiedMode ? (
                      <span className="text-sm font-black mr-0.5" id={`indicator-symbol-${cat.id}`}>
                        👉
                      </span>
                    ) : (
                      <span
                        className="relative flex h-2.5 w-2.5 shrink-0"
                        id={`indicator-glowing-dot-${cat.id}`}
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0F0F0F] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0F0F0F]"></span>
                      </span>
                    ))}
                  <span>{getLocalizedText(cat.name, currentLang) || cat.id}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Catalog Menu sections grouped by Category */}
      <div className="space-y-12" id="dish-catalog-sections-container">
        {categories
          .filter((cat) => cat.showOnCustomerPage !== false)
          .map((cat) => {
            const itemsInCat = displayedMenuItems.filter((item) => item.category === cat.id);
            if (itemsInCat.length === 0) return null;

            const sortedItemsInCat =
              !popularItemIds || popularItemIds.length === 0
                ? itemsInCat
                : [...itemsInCat].sort((a, b) => {
                    const idxA = popularItemIds.indexOf(a.id);
                    const idxB = popularItemIds.indexOf(b.id);

                    const isPopA = idxA !== -1;
                    const isPopB = idxB !== -1;

                    if (isPopA && isPopB) {
                      return idxA - idxB;
                    }
                    if (isPopA) return -1;
                    if (isPopB) return 1;
                    return 0;
                  });

            return (
              <div
                key={cat.id}
                id={`cat-section-${cat.id}`}
                className="space-y-4 pt-10 -mt-10 scroll-mt-28 category-section"
                data-category-id={cat.id}
              >
                {/* Category Section Header */}
                <div className="flex items-center space-x-3 border-b border-white/5 pb-2">
                  <h3
                    className={`text-sm sm:text-base font-black font-display tracking-widest ${
                      isSimplifiedMode ? 'text-black' : 'text-[#E5B453]'
                    }`}
                  >
                    {getLocalizedText(cat.name, currentLang) || cat.id}
                  </h3>
                  <span
                    className={`text-[10px] font-mono ${isSimplifiedMode ? 'text-zinc-500' : 'text-white/45'}`}
                  >
                    ({sortedItemsInCat.length})
                  </span>
                </div>

                <div
                  className={
                    isSimplifiedMode
                      ? 'grid grid-cols-1 lg:grid-cols-2 gap-4'
                      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
                  }
                >
                  {sortedItemsInCat.map((item) => {
                    const isTakeoutDisabled = isTakeoutMode && item.isTakeoutAvailable === false;
                    if (isSimplifiedMode) {
                      return (
                        <div
                          key={item.id}
                          id={`dish-card-${item.id}`}
                          onClick={() => {
                            if (item.available && !isTakeoutDisabled) handleOpenDetail(item);
                          }}
                          className={`bg-white text-black rounded-2xl overflow-hidden shadow-lg border-2 ${
                            item.available && !isTakeoutDisabled
                              ? 'border-[#FFA500] hover:border-amber-500 cursor-pointer active:scale-[1.01] transition-all'
                              : 'border-zinc-300 opacity-60 cursor-not-allowed'
                          } flex flex-row items-stretch text-left relative`}
                        >
                          {popularItemIds.includes(item.id) && (
                            <div className="absolute top-1 right-2 bg-red-650 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md z-10 flex items-center space-x-0.5 border border-red-700 animate-pulse">
                              <span>🔥 熱銷推薦</span>
                            </div>
                          )}
                          {/* Left: Shrunk photo */}
                          <div
                            onClick={(e) => {
                              if (item.image) {
                                e.stopPropagation();
                                setActiveLightboxImg(item.image);
                              }
                            }}
                            className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex-shrink-0 relative bg-zinc-100 border-r border-zinc-200 overflow-hidden ${item.image ? 'cursor-zoom-in' : ''}`}
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={getLocalizedText(item.name, currentLang) || 'dish'}
                                className="w-full h-full object-cover hover:scale-105 transition duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center text-zinc-400">
                                <span className="text-xl sm:text-2xl">🍲</span>
                                <span className="text-[9px] text-zinc-500 font-bold mt-0.5">
                                  無圖
                                </span>
                              </div>
                            )}
                            {!item.available && (
                              <div className="absolute inset-0 bg-red-650/90 flex items-center justify-center">
                                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                  售完
                                </span>
                              </div>
                            )}
                            {item.available && item.image && (
                              <div className="absolute top-1 left-1 bg-amber-500 text-black text-[8px] font-black px-1 rounded border border-black uppercase">
                                配圖
                              </div>
                            )}
                          </div>

                          {/* Middle: Food Name & Indication */}
                          <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-black text-sm sm:text-base md:text-lg leading-tight font-sans whitespace-normal break-words">
                                {getLocalizedText(item.name, currentLang) || ''}
                              </h4>

                              <div className="flex items-center space-x-1.5 flex-wrap">
                                {item.isNotSpicy ? (
                                  <span className="bg-emerald-600 text-white text-[9px] font-black px-1 rounded border border-emerald-700">
                                    🍃 不辣
                                  </span>
                                ) : (
                                  <span className="bg-red-600 text-white text-[9px] font-black px-1 rounded border border-red-700">
                                    🌶️ 辣
                                  </span>
                                )}
                                {isTakeoutDisabled && (
                                  <span className="bg-rose-600 text-white text-[9px] font-black px-1 rounded border border-rose-700">
                                    僅接受內用
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Price & Quick Action */}
                          <div className="w-20 sm:w-24 flex-shrink-0 p-2 border-l border-zinc-100 bg-amber-50/50 flex flex-col items-center justify-center gap-1.5">
                            <span className="bg-[#FFA500] text-black text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-lg border border-black shadow-sm leading-none whitespace-normal break-words text-center">
                              NT$ {item.price}
                            </span>

                            {item.available ? (
                              isTakeoutDisabled ? (
                                <button
                                  disabled
                                  className="w-full py-1 bg-rose-100 text-rose-700 font-black text-center text-[10px] rounded border border-rose-200 cursor-not-allowed dish-order"
                                >
                                  僅接受內用
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  id={`add-to-cart-btn-${item.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetail(item);
                                  }}
                                  className="w-full py-1 bg-[#FFA500] hover:bg-amber-400 text-black font-black text-[10px] sm:text-xs rounded-lg border border-black transition active:scale-95 cursor-pointer shadow flex items-center justify-center gap-0.5 dish-order"
                                >
                                  <span>點選</span>
                                  <ChevronRight size={12} className="stroke-[2.5]" />
                                </button>
                              )
                            ) : (
                              <div className="w-full py-1 bg-zinc-200 text-zinc-500 font-black text-center text-[10px] rounded border border-zinc-300">
                                售罄
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Standard Mode: High-density Horizontal Row Card
                    return (
                      <div
                        key={item.id}
                        id={`dish-card-${item.id}`}
                        onClick={() => {
                          if (item.available && !isTakeoutDisabled) handleOpenDetail(item);
                        }}
                        className={`bg-[#161616] rounded-xl overflow-hidden shadow-md hover:shadow-2xl border border-white/10 hover:border-[#E5B453]/30 transition-all duration-300 flex flex-row items-stretch text-left relative ${
                          item.available && !isTakeoutDisabled
                            ? 'cursor-pointer active:scale-[1.01]'
                            : 'opacity-65 cursor-not-allowed'
                        }`}
                      >
                        {popularItemIds.includes(item.id) && (
                          <div className="absolute top-1 right-2 bg-red-650 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md z-10 flex items-center space-x-0.5 border border-red-700 animate-pulse">
                            <span>🔥 熱銷推薦</span>
                          </div>
                        )}
                        {/* Leftmost: Shrunk food image */}
                        <div
                          onClick={(e) => {
                            if (item.image) {
                              e.stopPropagation();
                              setActiveLightboxImg(item.image);
                            }
                          }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex-shrink-0 relative bg-neutral-950 border-r border-white/5 overflow-hidden ${item.image ? 'cursor-zoom-in' : ''}`}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={getLocalizedText(item.name, currentLang) || 'dish'}
                              className="w-full h-full object-cover hover:scale-105 transition duration-500"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                              <span className="text-xl sm:text-2xl">🍲</span>
                              <span className="text-[9px] text-zinc-400 font-bold mt-0.5">
                                無圖
                              </span>
                            </div>
                          )}

                          {/* Out of stock label inside photo */}
                          {!item.available && (
                            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                              <span className="bg-red-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded shadow-md uppercase tracking-wide">
                                完售
                              </span>
                            </div>
                          )}

                          {item.available && isTakeoutDisabled && (
                            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                              <span className="bg-rose-600 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded shadow-md uppercase tracking-wide">
                                僅接受內用
                              </span>
                            </div>
                          )}

                          {item.isSetMeal && (
                            <span className="absolute top-1 left-1 bg-red-500 text-white text-[8px] sm:text-[9px] font-bold px-1 rounded">
                              {t('combo')}
                            </span>
                          )}
                        </div>

                        {/* Middle: Name & Spicy indicators */}
                        <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                              <h5 className="font-bold text-white text-xs sm:text-sm leading-tight font-serif tracking-wide truncate">
                                {getLocalizedText(item.name, currentLang) || ''}
                              </h5>
                              {item.isNotSpicy ? (
                                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 text-[8px] font-black px-1 rounded-sm leading-none shrink-0 py-0.5">
                                  {t('notSpicy')}
                                </span>
                              ) : (
                                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/35 text-[8px] font-black px-1 rounded-sm leading-none shrink-0 py-0.5">
                                  {t('spicy')}
                                </span>
                              )}
                              {isTakeoutDisabled && (
                                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/35 text-[8px] font-black px-1 rounded-sm leading-none shrink-0 py-0.5">
                                  僅接受內用
                                </span>
                              )}
                            </div>
                            <p className="text-white/45 text-[9px] sm:text-xs leading-snug line-clamp-2">
                              {getLocalizedText(item.description, currentLang)}
                            </p>
                          </div>

                          <div className="flex items-center text-white/30 text-[9px]">
                            <Clock size={9} className="mr-0.5 text-white/30" />
                            <span>{t('approxTime')}</span>
                          </div>
                        </div>

                        {/* Rightmost: Price & Action */}
                        <div className="w-20 sm:w-24 flex-shrink-0 p-2 border-l border-white/5 flex flex-col items-center justify-center bg-white/2 gap-1.5">
                          <span className="text-[#E5B453] text-[11px] sm:text-xs md:text-sm font-black font-sans leading-none">
                            NT$ {item.price}
                          </span>

                          {item.available ? (
                            isTakeoutDisabled ? (
                              <button
                                id={`add-to-cart-btn-${item.id}`}
                                disabled
                                className="w-full py-1 bg-rose-500/10 text-rose-500 text-[9px] sm:text-[10px] font-bold rounded border border-rose-500/20 cursor-not-allowed flex items-center justify-center dish-order"
                              >
                                <span>僅接受內用</span>
                              </button>
                            ) : (
                              <button
                                id={`add-to-cart-btn-${item.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(item);
                                }}
                                className="w-full py-1 bg-white/5 hover:bg-[#E5B453] hover:text-[#0F0F0F] text-white/95 text-[9px] sm:text-[10px] font-bold rounded border border-white/10 transition active:scale-95 cursor-pointer flex items-center justify-center gap-0.5 dish-order"
                              >
                                <span>{t('orderDish')}</span>
                                <ChevronRight size={10} />
                              </button>
                            )
                          ) : (
                            <span className="text-white/40 text-[9px] font-bold font-sans">
                              {t('soldOut')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Floating View Shopping Cart Bar Trigger (if items present) */}
      {cart.length > 0 && isStoreCurrentlyOpen && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-40 animate-slide-up"
          id="floating-cart-bar"
        >
          <button
            id="view-cart-trigger"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-[#161616] hover:bg-[#1E1E1E] text-white p-4 flex items-center justify-between border border-white/15 rounded-full shadow-2xl transition transform active:scale-95 cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="relative bg-[#E5B453] text-[#0F0F0F] w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shadow-md">
                <ShoppingCart size={15} />
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF4D4D] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#161616] font-sans font-bold">
                  {cart.reduce((s, o) => s + o.qty, 0)}
                </span>
              </div>
              <div className="text-left leading-none">
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                  {TRANSLATIONS.cartList[currentLang] || '購物車清單'}
                </span>
                <p className="text-sm font-extrabold text-[#E5B453] mt-1 font-mono">
                  NT$ {cartTotal}
                </p>
              </div>
            </div>
            <span className="bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] text-xs font-black px-4 py-2 rounded-full cursor-pointer flex items-center space-x-1 shadow-sm font-sans">
              <span>{TRANSLATIONS.checkoutNow[currentLang] || '立即結帳下單'}</span>
              <ChevronRight size={14} />
            </span>
          </button>
        </div>
      )}

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`fixed bottom-24 right-4 sm:right-6 z-40 p-3 sm:p-3.5 rounded-full shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer transform hover:scale-110 flex items-center justify-center border-2 animate-fade-in ${
            isSimplifiedMode
              ? 'bg-[#FFA500] text-black border-4 border-black font-extrabold hover:bg-amber-400'
              : 'bg-[#161616]/95 backdrop-blur-md text-[#E5B453] border-[#E5B453]/40 hover:border-[#E5B453] hover:text-[#0F0F0F] hover:bg-[#E5B453]'
          }`}
          id="back-to-top-floating-btn"
          title="回到最頂端 Back to Top"
        >
          <ArrowUp size={20} className="stroke-[2.5]" />
        </button>
      )}

      {/* Mini Hover Cart Dialog Popup / 購物車懸浮對話框 */}
      {isHoverCartOpen && hoverCartItem && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
          id="hover-cart-dialog"
        >
          <div
            className={`rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border flex flex-col p-5 space-y-4 animate-slide-up transition-all ${
              isSimplifiedMode
                ? 'bg-[#FFFFFF] text-black border-[#FFA500] border-4'
                : 'bg-[#191919] border-[#E5B453]/35 text-white shadow-[#E5B453]/5'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isSimplifiedMode
                    ? 'bg-[#FFA500]/10'
                    : 'bg-[#E5B453]/15 border border-[#E5B453]/30'
                }`}
              >
                <Sparkles
                  className={`size-5 ${isSimplifiedMode ? 'text-[#FFA500]' : 'text-[#E5B453]'}`}
                />
              </div>
              <div className="text-left">
                <h4
                  className={`font-black text-sm sm:text-base ${isSimplifiedMode ? 'text-black' : 'text-zinc-100'}`}
                >
                  {currentLang === 'zh'
                    ? '🎉 餐點已加入購物車'
                    : currentLang === 'en'
                      ? '🎉 Added to Cart'
                      : currentLang === 'th'
                        ? '🎉 เพิ่มลงตะกร้าแล้ว'
                        : currentLang === 'ja'
                          ? '🎉 カートに追加しました'
                          : currentLang === 'ko'
                            ? '🎉 장바구니에 추가됨'
                            : '🎉 Đã thêm vào giỏ hàng'}
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono">Successfully Added to Cart</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border text-left space-y-1.5 ${
                isSimplifiedMode ? 'bg-[#FFF9EE] border-zinc-300' : 'bg-black/35 border-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <span
                  className={`font-black text-sm sm:text-base ${isSimplifiedMode ? 'text-black' : 'text-zinc-100'}`}
                >
                  {getLocalizedText(hoverCartItem.name, currentLang) || ''}
                </span>
                <span
                  className={`font-mono text-xs font-bold leading-none px-2.5 py-1 rounded shrink-0 ${
                    isSimplifiedMode
                      ? 'bg-[#FFA500] text-black font-extrabold border border-black'
                      : 'bg-[#E5B453]/20 text-[#E5B453]'
                  }`}
                >
                  {hoverCartItem.qty}{' '}
                  {currentLang === 'zh'
                    ? '份'
                    : currentLang === 'en'
                      ? 'portion(s)'
                      : currentLang === 'th'
                        ? 'ที่'
                        : currentLang === 'ja'
                          ? '点'
                          : currentLang === 'ko'
                            ? '개'
                            : 'phần'}
                </span>
              </div>

              {/* Added customizations summary */}
              <div className="flex flex-wrap gap-1 mt-1">
                {hoverCartItem.customization.noodleType && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${isSimplifiedMode ? 'bg-zinc-200 text-black border border-zinc-300 font-bold' : 'bg-white/5 border border-white/10 text-zinc-400'}`}
                  >
                    🍝{' '}
                    {hoverCartItem.customization.noodleType === 'rice-noodle'
                      ? TRANSLATIONS.riceNoodle[currentLang] || '河粉'
                      : TRANSLATIONS.vermicelli[currentLang] || '米線'}
                  </span>
                )}
                {hoverCartItem.customization.soupBase === 'coconut-milk' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${isSimplifiedMode ? 'bg-zinc-200 text-black border border-zinc-300 font-bold' : 'bg-white/5 border border-white/10 text-zinc-400'}`}
                  >
                    🥥{' '}
                    {currentLang === 'zh'
                      ? '加椰奶'
                      : currentLang === 'en'
                        ? 'Add Coconut'
                        : currentLang === 'th'
                          ? 'ใส่กะทิ'
                          : currentLang === 'ja'
                            ? 'ココナッツ加'
                            : currentLang === 'ko'
                              ? '코코넛 추가'
                              : 'Thêm cốt dừa'}
                  </span>
                )}
                {hoverCartItem.customization.spiciness > 1 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${isSimplifiedMode ? 'bg-zinc-200 text-black border border-zinc-300 font-bold' : 'bg-white/5 border border-white/10 text-zinc-400'}`}
                  >
                    🌶️{' '}
                    {hoverCartItem.customization.spiciness === 2
                      ? TRANSLATIONS.spicyMild[currentLang] || '小辣'
                      : TRANSLATIONS.spicyHot[currentLang] || '大辣'}
                  </span>
                )}
                {hoverCartItem.customization.notes && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${isSimplifiedMode ? 'bg-zinc-200 text-black border border-zinc-300 font-bold' : 'bg-white/5 border border-white/10 text-[#E5B453] italic'}`}
                  >
                    📝 {hoverCartItem.customization.notes}
                  </span>
                )}
                {hoverCartItem.customization.selectedAddOns &&
                  hoverCartItem.customization.selectedAddOns.map((addOn, index) => (
                    <span
                      key={index}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${isSimplifiedMode ? 'bg-[#FFA500]/10 text-black font-bold' : 'bg-[#E5B453]/10 border border-[#E5B453]/15 text-[#E5B453]'}`}
                    >
                      ＋{getLocalizedText(addOn.name, currentLang)}
                    </span>
                  ))}
              </div>
            </div>

            <div
              className={`text-center text-xs py-1 font-sans ${isSimplifiedMode ? 'text-zinc-600' : 'text-zinc-400'}`}
            >
              {currentLang === 'zh' ? (
                <>
                  目前購物車共{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-white'}`}
                  >
                    {cart.reduce((s, o) => s + o.qty, 0)}
                  </strong>{' '}
                  份餐點，總計{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-amber-800 text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    NT$ {cartTotal}
                  </strong>{' '}
                  元
                </>
              ) : currentLang === 'en' ? (
                <>
                  Total{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-white'}`}
                  >
                    {cart.reduce((s, o) => s + o.qty, 0)}
                  </strong>{' '}
                  item(s) in cart, total{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-amber-800 text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    NT$ {cartTotal}
                  </strong>
                </>
              ) : currentLang === 'th' ? (
                <>
                  มีทั้งหมด{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-white'}`}
                  >
                    {cart.reduce((s, o) => s + o.qty, 0)}
                  </strong>{' '}
                  รายการในตะกร้า รวม{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-amber-800 text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    NT$ {cartTotal}
                  </strong>
                </>
              ) : currentLang === 'ja' ? (
                <>
                  現在カートに計{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-white'}`}
                  >
                    {cart.reduce((s, o) => s + o.qty, 0)}
                  </strong>{' '}
                  点、合計{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-amber-800 text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    NT$ {cartTotal}
                  </strong>
                </>
              ) : currentLang === 'ko' ? (
                <>
                  장바구니에 총{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-white'}`}
                  >
                    {cart.reduce((s, o) => s + o.qty, 0)}
                  </strong>
                  개의 상품, 합계{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-amber-800 text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    NT$ {cartTotal}
                  </strong>
                </>
              ) : (
                <>
                  Tổng cộng{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-white'}`}
                  >
                    {cart.reduce((s, o) => s + o.qty, 0)}
                  </strong>{' '}
                  món trong giỏ hàng, tổng tiền{' '}
                  <strong
                    className={`font-mono ${isSimplifiedMode ? 'text-amber-800 text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    NT$ {cartTotal}
                  </strong>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                id="btn-continue-dining"
                onClick={() => setIsHoverCartOpen(false)}
                className={`flex items-center justify-center h-10 px-3 rounded-xl transition active:scale-95 font-bold text-xs cursor-pointer ${
                  isSimplifiedMode
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-black border border-zinc-400 font-extrabold'
                    : 'bg-white/5 hover:bg-white/10 text-white/90 border border-white/10'
                }`}
              >
                {currentLang === 'zh'
                  ? '繼續點餐'
                  : currentLang === 'en'
                    ? 'Continue'
                    : currentLang === 'th'
                      ? 'เลือกเมนูต่อ'
                      : currentLang === 'ja'
                        ? '注文を続ける'
                        : currentLang === 'ko'
                          ? '계속 주문'
                          : 'Tiếp tục'}
              </button>
              <button
                type="button"
                id="btn-goto-checkout"
                onClick={() => {
                  setIsHoverCartOpen(false);
                  setIsCartOpen(true);
                }}
                className={`flex items-center justify-center h-10 px-3 rounded-xl transition active:scale-95 font-bold text-xs cursor-pointer ${
                  isSimplifiedMode
                    ? 'bg-[#FFA500] hover:bg-[#E5B453] text-black border-2 border-black font-extrabold shadow-md'
                    : 'bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] font-black shadow-md shadow-[#E5B453]/10'
                }`}
              >
                💳 {TRANSLATIONS.cartLobby[currentLang] || '結帳大廳'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Options Side Sheet / Modal popup */}
      {selectedDetailItem && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          id="item-customizer-modal"
        >
          <div
            className={`rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border-4 transition-all duration-300 ${isSimplifiedMode ? 'bg-[#FFFFFF] text-black border-[#FFA500]' : 'bg-[#161616] border-white/10 text-white'}`}
          >
            {/* Pic & Name */}
            <div
              onClick={() => {
                if (selectedDetailItem.image) {
                  setActiveLightboxImg(selectedDetailItem.image);
                }
              }}
              className={`relative w-full aspect-[16/10] sm:aspect-[16/9] bg-neutral-950 shrink-0 overflow-hidden ${selectedDetailItem.image ? 'cursor-zoom-in group' : ''}`}
            >
              {selectedDetailItem.image ? (
                <>
                  <img
                    src={selectedDetailItem.image}
                    alt={getLocalizedText(selectedDetailItem?.name, currentLang) || 'dish'}
                    className="w-full h-full object-cover opacity-90 group-hover:scale-102 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition">
                    🔍 點擊放大縮放 Click to Zoom
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                  <span className="text-4xl">🍲</span>
                  <span className="text-xs text-zinc-400 font-bold mt-1.5">
                    無餐點照片 No Image Assigned
                  </span>
                </div>
              )}
              <button
                id="close-customizer-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDetailItem(null);
                }}
                className="absolute top-4 right-4 bg-black/60 text-white hover:text-[#E5B453] p-1.5 rounded-full backdrop-blur-sm transition cursor-pointer z-10"
              >
                <X size={18} />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-5 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4
                    className={`font-serif tracking-wide ${isSimplifiedMode ? 'text-white text-xl font-black' : 'text-white text-lg font-bold'}`}
                  >
                    {getLocalizedText(selectedDetailItem?.name, currentLang) || ''}
                  </h4>
                  {selectedDetailItem.isNotSpicy ? (
                    <span className="bg-emerald-500/95 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 select-none shrink-0">
                      🍃 {TRANSLATIONS.notSpicy[currentLang] || '完全不辣'}
                    </span>
                  ) : (
                    <span className="bg-rose-600/95 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 select-none shrink-0">
                      🌶️ {TRANSLATIONS.classicSpicy[currentLang] || '經典手作香辣'}
                    </span>
                  )}
                </div>
                {!isSimplifiedMode && (
                  <p className="text-xs text-white/60 line-clamp-1 mt-1 font-sans">
                    {getLocalizedText(selectedDetailItem?.description, currentLang)}
                  </p>
                )}
              </div>
            </div>

            {/* Adjusters scroll area */}
            <div
              className={`p-5 overflow-y-auto space-y-4 text-left ${isSimplifiedMode ? 'bg-[#FFFFFF]' : ''}`}
            >
              {/* Portion Control */}
              <div
                className={`flex items-center justify-between p-3.5 rounded-xl ${
                  isSimplifiedMode
                    ? 'bg-amber-500/15 border-2 border-[#FFA500]'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                <span
                  className={`font-black ${isSimplifiedMode ? 'text-black text-base' : 'text-xs text-white/90 font-bold'}`}
                >
                  {TRANSLATIONS.quantityPortion[currentLang] || '點餐份數'} Quantity
                </span>
                <div
                  className={`flex items-center space-x-3 px-3 py-1.5 rounded-lg ${
                    isSimplifiedMode
                      ? 'bg-[#FFA500] border-2 border-black'
                      : 'bg-black/40 border border-white/10'
                  }`}
                >
                  <button
                    id="qty-decrement"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className={`w-8 h-8 font-extrabold rounded flex items-center justify-center cursor-pointer transition ${isSimplifiedMode ? 'text-black bg-white hover:bg-zinc-200 border border-black' : 'text-white/75 hover:bg-white/10'}`}
                  >
                    -
                  </button>
                  <span
                    className={`font-mono font-black ${isSimplifiedMode ? 'text-black text-xl' : 'text-[#E5B453]'}`}
                  >
                    {qty}
                  </span>
                  <button
                    id="qty-increment"
                    onClick={() => setQty(qty + 1)}
                    className={`w-8 h-8 font-extrabold rounded flex items-center justify-center cursor-pointer transition ${isSimplifiedMode ? 'text-black bg-white hover:bg-zinc-200 border border-black' : 'text-white/75 hover:bg-white/10'}`}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Customization adjusters were removed for simplified ordering */}

              {/* Noodle options - e.g. for Mama items */}
              {selectedDetailItem.hasNoodlesOption && (
                <div className="space-y-2">
                  <label
                    className={`block text-xs font-bold uppercase tracking-widest ${isSimplifiedMode ? 'text-zinc-800 text-sm font-black' : 'text-white/40'}`}
                  >
                    {TRANSLATIONS.noodleOption[currentLang]} Select noodle types
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        code: 'rice-noodle',
                        label: TRANSLATIONS.riceNoodle[currentLang] || '河粉',
                        spec: 'Rice Noodle',
                      },
                      {
                        code: 'vermicelli',
                        label: TRANSLATIONS.vermicelli[currentLang] || '米線',
                        spec: 'Vermicelli',
                      },
                      {
                        code: 'none',
                        label: TRANSLATIONS.plainSoup[currentLang] || '不加麵',
                        spec: 'Plain Soup',
                      },
                    ].map((nd) => (
                      <button
                        key={nd.code}
                        id={`noodle-opt-${nd.code}`}
                        type="button"
                        onClick={() => setNoodleType(nd.code as any)}
                        className={`p-2 rounded-xl text-center border-2 transition cursor-pointer flex flex-col items-center justify-center ${
                          noodleType === nd.code
                            ? isSimplifiedMode
                              ? 'border-amber-500 bg-amber-100 text-black font-extrabold'
                              : 'border-[#E5B453] bg-[#E5B453]/15 text-[#E5B453] font-bold'
                            : isSimplifiedMode
                              ? 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                              : 'border-white/10 text-white/80 hover:bg-[#1C1C1C]'
                        }`}
                      >
                        <span
                          className={`text-sm ${isSimplifiedMode ? 'text-base font-black' : ''}`}
                        >
                          {nd.label}
                        </span>
                        <span
                          className={`text-[9px] uppercase mt-0.5 ${isSimplifiedMode ? 'text-zinc-500 font-extrabold' : 'text-white/40'}`}
                        >
                          {nd.spec}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Soup Base coconut milk modifier */}
              {selectedDetailItem.hasCoconutsMilkOption && (
                <div
                  className={`p-3.5 rounded-xl flex items-center justify-between border ${
                    isSimplifiedMode
                      ? 'bg-amber-100 border-2 border-[#FFA500] text-black'
                      : 'bg-[#E5B453]/10 border-[#E5B453]/25 p-3.5 text-white'
                  }`}
                >
                  <div className="text-left">
                    <span
                      className={`font-bold block ${isSimplifiedMode ? 'text-black text-base font-black' : 'text-[#E5B453] text-xs'}`}
                    >
                      {TRANSLATIONS.upgradeCoconutSoup[currentLang] || '升級奶香冬蔭功 (+NT$50)'}
                    </span>
                    <span
                      className={`text-[10px] ${isSimplifiedMode ? 'text-zinc-600 font-extrabold' : 'text-white/60'} leading-none`}
                    >
                      {TRANSLATIONS.upgradeCoconutSoupDesc[currentLang] ||
                        '加入大罐頂級泰國椰奶，香濃誘人'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="coconut-soup-base-checkbox"
                    checked={soupBase === 'coconut-milk'}
                    onChange={(e) => setSoupBase(e.target.checked ? 'coconut-milk' : 'plain')}
                    className="w-6 h-6 rounded border-zinc-350 text-[#E5B453] focus:ring-[#E5B453] bg-black/40 cursor-pointer"
                  />
                </div>
              )}

              {/* Custom Add-Ons list selection */}
              {selectedDetailItem.customAddOns && selectedDetailItem.customAddOns.length > 0 && (
                <div
                  className={`space-y-2 border-t pt-3.5 mt-3.5 ${isSimplifiedMode ? 'border-zinc-200' : 'border-white/10'}`}
                >
                  <label
                    className={`block text-xs font-bold uppercase tracking-widest ${isSimplifiedMode ? 'text-black text-sm font-black' : 'text-[#E5B453]'}`}
                  >
                    {TRANSLATIONS.customAddOnsLabel[currentLang] || '加選附加選項'} Custom Options &
                    Add-Ons
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {selectedDetailItem.customAddOns.map((addOn) => {
                      const isSelected = selectedAddOns.some((a) => a.id === addOn.id);
                      return (
                        <button
                          key={addOn.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAddOns(selectedAddOns.filter((a) => a.id !== addOn.id));
                            } else {
                              setSelectedAddOns([...selectedAddOns, addOn]);
                            }
                          }}
                          className={`p-3 rounded-xl border-2 flex items-center justify-between text-left transition cursor-pointer ${
                            isSelected
                              ? isSimplifiedMode
                                ? 'border-amber-500 bg-amber-100 text-black font-black'
                                : 'border-[#E5B453] bg-[#E5B453]/15 text-[#E5B453] font-bold shadow-md'
                              : isSimplifiedMode
                                ? 'border-zinc-300 text-zinc-800 bg-white hover:bg-zinc-150'
                                : 'border-white/10 text-white/80 hover:bg-[#1C1C1C]'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-amber-500 border-transparent' : 'border-zinc-305'
                              }`}
                            >
                              {isSelected && <Check size={11} className="text-black stroke-[4]" />}
                            </div>
                            <span
                              className={`text-xs leading-tight ${isSimplifiedMode ? 'font-black' : ''}`}
                            >
                              {getLocalizedText(addOn.name, currentLang)}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[11px] font-bold shrink-0 ml-1 ${isSimplifiedMode ? 'text-amber-800 font-black' : 'text-amber-400'}`}
                          >
                            +${addOn.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alert Warning for Ingredients if too low */}
              {inventoryWarnings.length > 0 && (
                <p className="text-[10px] text-amber-400 bg-amber-500/10 rounded-lg p-2.5 flex items-center space-x-1 font-semibold border border-amber-500/20 leading-relaxed">
                  <AlertTriangle size={15} className="shrink-0 text-amber-500 mr-1" />
                  <span>
                    {TRANSLATIONS.lowStockWarning[currentLang] ||
                      '部分手作食材及海鮮數量吃緊，請儘速在下方完成下單。'}
                  </span>
                </p>
              )}

              {/* Live Merchant Stock & Availability Adjustments */}
              {isMerchantMode && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-3 mt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-500 flex items-center gap-1">
                      <span>🛡️ 店家管理控制 (Instant Controls)</span>
                    </span>
                    <span className="bg-amber-500 text-black text-[9px] px-1 rounded font-black font-sans leading-none uppercase select-none">
                      LIVE ADJUST
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (onToggleMenuItemAvailability) {
                          await onToggleMenuItemAvailability(selectedDetailItem.id);
                          selectedDetailItem.available = !selectedDetailItem.available;
                          // Trigger rerender of the selectedDetailItem
                          setSelectedDetailItem({ ...selectedDetailItem });
                        }
                      }}
                      className={`py-1.5 rounded font-black border text-center transition cursor-pointer select-none active:scale-95 ${
                        selectedDetailItem.available
                          ? 'bg-rose-500/25 text-rose-300 border-rose-500/40 hover:bg-rose-500/35 animate-pulse'
                          : 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35'
                      }`}
                    >
                      {selectedDetailItem.available ? '✕ 設為沽清 (Close)' : '● 開放供應 (Open)'}
                    </button>

                    <span className="text-[10px] text-white/50 flex items-center justify-center text-center font-bold">
                      狀態：
                      {selectedDetailItem.available ? '🟢 供應中 Supply' : '🔴 沽清中 Sold Out'}
                    </span>
                  </div>

                  {/* Raw Ingredients stock adjustment section */}
                  <div className="space-y-1.5 border-t border-white/10 pt-2 text-left">
                    <span className="font-bold text-white/95 block text-[11px] font-sans">
                      📦 關聯原料庫存即時微調 (Ingredient Stock):
                    </span>
                    {(() => {
                      const itemRecipe = getMenuItemIngredients(selectedDetailItem);
                      if (itemRecipe.length === 0) {
                        return (
                          <span className="text-white/40 italic text-[10px]">
                            此品項無分配原料對應
                          </span>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {itemRecipe.map((recipeItem) => {
                            const ing = ingredients.find((i) => i.id === recipeItem.ingredientId);
                            if (!ing) return null;
                            return (
                              <div
                                key={ing.id}
                                className="flex items-center justify-between bg-black/45 p-2 rounded border border-white/5"
                              >
                                <div className="text-white/80 shrink-0">
                                  <span className="font-bold">
                                    {getLocalizedText(ing.name, 'zh')}
                                  </span>
                                  <span className="text-[10px] text-zinc-500 ml-1">
                                    ({ing.stock} {ing.unit})
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1.5 ml-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (onAdjustIngredientStock) {
                                        await onAdjustIngredientStock(
                                          ing.id,
                                          -5,
                                          '顧客前台即時微調',
                                        );
                                      }
                                    }}
                                    className="w-7 h-6 rounded bg-white/5 hover:bg-rose-500/20 font-bold font-mono text-[10px] flex items-center justify-center border border-white/10 text-white cursor-pointer active:scale-90"
                                  >
                                    -5
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (onAdjustIngredientStock) {
                                        await onAdjustIngredientStock(
                                          ing.id,
                                          -1,
                                          '顧客前台即時微調',
                                        );
                                      }
                                    }}
                                    className="w-7 h-6 rounded bg-white/5 hover:bg-rose-500/20 font-bold font-mono text-[10px] flex items-center justify-center border border-white/10 text-white cursor-pointer active:scale-95"
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (onAdjustIngredientStock) {
                                        await onAdjustIngredientStock(
                                          ing.id,
                                          1,
                                          '顧客前台即時微調',
                                        );
                                      }
                                    }}
                                    className="w-7 h-6 rounded bg-white/5 hover:bg-emerald-500/20 font-bold font-mono text-[10px] flex items-center justify-center border border-white/10 text-white cursor-pointer active:scale-95"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (onAdjustIngredientStock) {
                                        await onAdjustIngredientStock(
                                          ing.id,
                                          5,
                                          '顧客前台即時微調',
                                        );
                                      }
                                    }}
                                    className="w-7 h-6 rounded bg-white/5 hover:bg-emerald-500/20 font-bold font-mono text-[10px] flex items-center justify-center border border-white/10 text-white cursor-pointer active:scale-90"
                                  >
                                    +5
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom confirmation Bar */}
            <div
              className={`p-4 border-t flex items-center justify-between shrink-0 ${
                isSimplifiedMode
                  ? 'bg-amber-50 border-t-2 border-zinc-200'
                  : 'bg-black/30 border-t border-white/10'
              }`}
            >
              <div className="text-left leading-none">
                <span
                  className={`text-[10px] uppercase font-bold ${isSimplifiedMode ? 'text-black font-black' : 'text-white/40'}`}
                >
                  {TRANSLATIONS.totalAmountLabel[currentLang] || '總計算額金額'}
                </span>
                <p
                  className={`text-lg font-bold mt-1 font-serif ${isSimplifiedMode ? 'text-amber-800 text-xl font-black' : 'text-[#E5B453]'}`}
                >
                  NT${' '}
                  {(selectedDetailItem.price +
                    (spiciness === 3 ? 10 : 0) +
                    (soupBase === 'coconut-milk' ? 50 : 0) +
                    selectedAddOns.reduce((sum, a) => sum + a.price, 0)) *
                    qty}
                </p>
              </div>

              {isStoreCurrentlyOpen ? (
                <button
                  id="add-to-cart-confirm"
                  onClick={handleAddToCart}
                  className={`font-black px-4 sm:px-8 py-3.5 sm:py-4 rounded-2xl transition flex items-center space-x-2 active:scale-95 cursor-pointer text-xs min-[360px]:text-sm sm:text-base whitespace-nowrap ${
                    isSimplifiedMode
                      ? 'bg-[#FFA500] hover:bg-amber-400 text-black border-2 border-black font-extrabold shadow-lg'
                      : 'bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F]'
                  }`}
                >
                  <ShoppingCart size={15} className="shrink-0" />
                  <span>{TRANSLATIONS.addToCartConfirm[currentLang] || '確定加入點餐單'}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="bg-zinc-850 text-zinc-500 font-bold px-3 min-[360px]:px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center space-x-1.5 sm:space-x-2 text-[10px] min-[360px]:text-xs sm:text-sm whitespace-nowrap border border-white/5 cursor-not-allowed"
                >
                  <Clock size={12} />
                  <span>{TRANSLATIONS.closedLabel[currentLang] || '休息中 Closed'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shopping Cart Drawer Modal Sheet */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          id="cart-drawer-overlay"
        >
          <div
            className={`rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border flex flex-col max-h-[85vh] animate-slide-up transition-all ${
              isSimplifiedMode
                ? 'bg-[#FFFFFF] text-black border-[#FFA500] border-4'
                : 'bg-[#161616] border-white/10 text-white'
            }`}
          >
            {/* Header */}
            <div
              className={`p-4 border-b flex items-center justify-between shrink-0 ${
                isSimplifiedMode ? 'bg-amber-100/40 border-zinc-200' : 'bg-black/30 border-white/10'
              }`}
            >
              <h4
                className={`font-serif tracking-wide ${
                  isSimplifiedMode ? 'text-black' : 'text-white'
                }`}
              >
                <ShoppingCart
                  size={18}
                  className={isSimplifiedMode ? 'text-black' : 'text-[#E5B453]'}
                />
                <span>{TRANSLATIONS.cartLobby[currentLang] || '購物車結帳大廳'}</span>
              </h4>
              <button
                id="close-cart-btn"
                onClick={() => setIsCartOpen(false)}
                className={`p-1.5 rounded-full transition ${
                  isSimplifiedMode
                    ? 'text-black hover:bg-zinc-200'
                    : 'text-white/40 hover:text-[#E5B453]'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Line Items */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-left">
              {cart.length === 0 ? (
                <div
                  className={`py-12 text-center space-y-2 ${isSimplifiedMode ? 'text-black/50' : 'text-white/40'}`}
                >
                  <ShoppingCart
                    size={36}
                    className={`mx-auto ${isSimplifiedMode ? 'text-black/30' : 'text-white/20'}`}
                  />
                  <p className="text-sm font-semibold">
                    {TRANSLATIONS.emptyCartWarning[currentLang] || '購物車空空如也，馬上點餐吧！'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      id={`cart-item-${item.id}`}
                      className={`flex items-start justify-between p-3.5 rounded-xl border shadow-inner ${
                        isSimplifiedMode
                          ? 'bg-[#FFF9EE] border-zinc-300 text-black'
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="text-left space-y-1">
                        <h6
                          className={`font-bold text-sm leading-snug ${isSimplifiedMode ? 'text-black text-base font-black' : 'text-white'}`}
                        >
                          {getLocalizedText(item.name, currentLang) || ''}
                        </h6>
                        <div className="flex flex-wrap gap-1">
                          {item.customization.noodleType && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                isSimplifiedMode
                                  ? 'bg-[#FFA500] text-black border-black font-extrabold'
                                  : 'bg-[#E5B453]/15 text-[#E5B453] border-[#E5B453]/15'
                              }`}
                            >
                              {item.customization.noodleType === 'rice-noodle'
                                ? TRANSLATIONS.riceNoodle[currentLang] || '河粉'
                                : TRANSLATIONS.vermicelli[currentLang] || '米線'}
                            </span>
                          )}
                          {item.customization.soupBase === 'coconut-milk' && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                isSimplifiedMode
                                  ? 'bg-amber-200 text-amber-950 border-amber-400 font-extrabold'
                                  : 'bg-amber-500/10 text-amber-500 border-amber-500/15'
                              }`}
                            >
                              {currentLang === 'zh'
                                ? '加椰奶(+50)'
                                : currentLang === 'en'
                                  ? 'Add Coconut (+50)'
                                  : currentLang === 'th'
                                    ? 'ใส่กะทิ (+50)'
                                    : currentLang === 'ja'
                                      ? 'ココナッツ加 (+50)'
                                      : currentLang === 'ko'
                                        ? '코코넛 추가 (+50)'
                                        : 'Thêm cốt dừa (+50)'}
                            </span>
                          )}
                          {item.customization.spiciness > 1 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                isSimplifiedMode
                                  ? 'bg-red-200 text-red-950 border-red-300 font-extrabold'
                                  : 'bg-red-500/10 text-red-400 border-red-500/15'
                              }`}
                            >
                              {item.customization.spiciness === 2
                                ? TRANSLATIONS.spicyMild[currentLang] || '小辣'
                                : `${TRANSLATIONS.spicyHot[currentLang] || '大辣'}(+10)`}
                            </span>
                          )}
                          {item.customization.selectedAddOns?.map((addOn) => (
                            <span
                              key={addOn.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                isSimplifiedMode
                                  ? 'bg-[#FFA500]/15 text-black border-[#FFA500] font-extrabold'
                                  : 'bg-[#E5B453]/15 text-[#E5B453] border-[#E5B453]/15'
                              }`}
                            >
                              +{getLocalizedText(addOn.name, currentLang)}(+${addOn.price})
                            </span>
                          ))}
                        </div>
                        {item.customization.notes && (
                          <p
                            className={`text-xs font-sans italic ${isSimplifiedMode ? 'text-zinc-700 font-black' : 'text-[#E5B453]'}`}
                          >
                            “{item.customization.notes}”
                          </p>
                        )}
                        <div className="flex items-center space-x-1.5 pt-1.5">
                          <button
                            type="button"
                            id={`dec-qty-${item.id}`}
                            onClick={() => handleUpdateCartQty(item.id, item.qty - 1)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition active:scale-90 cursor-pointer border ${
                              isSimplifiedMode
                                ? 'text-black bg-zinc-100 hover:bg-zinc-200 border-zinc-400'
                                : 'bg-white/5 hover:bg-white/15 hover:text-white text-white/60 border-white/10'
                            }`}
                          >
                            <span className="text-sm font-bold leading-none">-</span>
                          </button>
                          <span
                            className={`font-mono text-xs font-black min-w-[22px] text-center rounded border ${
                              isSimplifiedMode
                                ? 'text-black bg-white border-zinc-400'
                                : 'text-white bg-black/20 border-white/5'
                            }`}
                          >
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            id={`inc-qty-${item.id}`}
                            onClick={() => handleUpdateCartQty(item.id, item.qty + 1)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition active:scale-90 cursor-pointer border ${
                              isSimplifiedMode
                                ? 'text-black bg-[#FFA500] hover:bg-[#E5B453] border-black font-extrabold'
                                : 'bg-white/5 hover:bg-white/15 hover:text-white text-[#E5B453]/90 border-[#E5B453]/20'
                            }`}
                          >
                            <span className="text-sm font-bold leading-none">+</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-right space-y-2 shrink-0 ml-4 font-sans">
                        <span
                          className={`font-mono text-sm font-bold block ${isSimplifiedMode ? 'text-black text-base font-black' : 'text-white/95'}`}
                        >
                          NT${' '}
                          {(item.price +
                            (item.customization.spiciness === 3 ? 10 : 0) +
                            (item.customization.soupBase === 'coconut-milk' ? 50 : 0) +
                            (item.customization.selectedAddOns?.reduce(
                              (sum, a) => sum + a.price,
                              0,
                            ) || 0)) *
                            item.qty}
                        </span>
                        <button
                          id={`delete-cart-item-${item.id}`}
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-xs text-[#FF4D4D] hover:text-white bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/35 px-2.5 py-1 rounded transition cursor-pointer whitespace-nowrap"
                        >
                          {TRANSLATIONS.removeBtn[currentLang] || '移除'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Payment Method selector */}
                  <div
                    className={`space-y-2 pt-4 border-t ${isSimplifiedMode ? 'border-zinc-200' : 'border-white/10'}`}
                  >
                    <label
                      className={`block text-xs font-bold uppercase tracking-widest ${isSimplifiedMode ? 'text-black font-black' : 'text-white/40'}`}
                    >
                      {TRANSLATIONS.payMethod[currentLang] || '支付方式 Payment Method'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { code: 'cash', label: t('payCash'), spec: t('payCashDesc') },
                        { code: 'credit', label: t('payCredit'), spec: t('payCreditDesc') },
                        { code: 'twqr', label: t('payTwqr'), spec: t('payTwqrDesc') },
                        { code: 'member', label: t('payMember'), spec: t('payMemberDesc') },
                      ].map((pm) => {
                        const isSelected = paymentMethod === pm.code;
                        return (
                          <button
                            key={pm.code}
                            id={`pay-method-${pm.code}`}
                            type="button"
                            onClick={() => setPaymentMethod(pm.code as any)}
                            className={`p-2 rounded-xl text-center border-2 transition cursor-pointer flex flex-col items-center justify-center ${
                              isSimplifiedMode
                                ? isSelected
                                  ? 'border-black bg-black text-white font-black scale-[1.02] shadow-md'
                                  : 'border-zinc-300 text-black bg-white hover:bg-zinc-100'
                                : isSelected
                                  ? 'border-[#E5B453] bg-[#E5B453]/15 text-[#E5B453] font-extrabold shadow-md shadow-[#E5B453]/5 scale-[1.02]'
                                  : 'border-white/10 hover:border-white/25 text-white/70 hover:bg-[#1C1C1C]'
                            }`}
                          >
                            <span
                              className={`text-[11px] font-bold ${isSimplifiedMode ? 'text-sm font-black' : ''}`}
                            >
                              {pm.label}
                            </span>
                            <span
                              className={`text-[9px] mt-0.5 leading-tight ${isSimplifiedMode ? 'text-zinc-650 font-bold' : 'opacity-50'}`}
                            >
                              {pm.spec}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price calculation list */}
                  <div
                    className={`p-4 rounded-xl text-xs font-medium border ${
                      isSimplifiedMode
                        ? 'bg-amber-50/50 border-zinc-250 text-black border-2'
                        : 'bg-black/20 border-white/5 text-white/60'
                    }`}
                  >
                    <div
                      className={`flex justify-between ${isSimplifiedMode ? 'text-black font-extrabold' : 'text-white/60'}`}
                    >
                      <span>{TRANSLATIONS.cartSubtotalLabel[currentLang] || '餐點小計'}</span>
                      <span className="font-mono">NT$ {cartSubtotal}</span>
                    </div>

                    {promoCombo && promoComboDiscount > 0 && (
                      <div className="flex justify-between text-[#E5B453] font-bold py-0.5">
                        <span className="flex items-center gap-1">
                          🎁{' '}
                          {currentLang === 'zh'
                            ? '優惠套餐自動折抵'
                            : currentLang === 'en'
                              ? 'Promo Combo Auto-Discount'
                              : currentLang === 'th'
                                ? 'ส่วนลดชุดโปรโมชั่นอัตโนมัติ'
                                : currentLang === 'ja'
                                  ? 'お得セット自動割引'
                                  : currentLang === 'ko'
                                    ? '우대 콤보 자동 할인'
                                    : 'Ưu đãi combo tự động giảm'}
                        </span>
                        <span className="font-mono">- NT$ {promoComboDiscount}</span>
                      </div>
                    )}

                    {lineProfile && (
                      <div className="flex justify-between text-[#4285F4] font-bold">
                        <span>
                          {currentLang === 'zh'
                            ? 'Google 會員可累積點數'
                            : currentLang === 'en'
                              ? 'Google Member point accruable'
                              : currentLang === 'th'
                                ? 'สมาชิก Google สะสมคะแนนได้'
                                : currentLang === 'ja'
                                  ? 'Google会員ポイント貯まります'
                                  : currentLang === 'ko'
                                    ? '구글 회원 포인트 적립 가능'
                                    : 'Thành viên Google tích điểm'}
                        </span>
                        <span className="font-mono">+{Math.round(cartSubtotal * 0.1)} 點</span>
                      </div>
                    )}

                    {(paymentMethod === 'credit' || paymentMethod === 'twqr') && (
                      <div
                        className={`flex justify-between ${isSimplifiedMode ? 'text-black font-extrabold' : 'text-white/60'}`}
                      >
                        <span>
                          {paymentMethod === 'twqr'
                            ? currentLang === 'zh'
                              ? 'TWQR支付預設服務費 (10%)'
                              : 'TWQR Payment Fee (10%)'
                            : currentLang === 'zh'
                              ? '信用卡服務加成 (10%)'
                              : 'Credit Card Surcharge (10%)'}
                        </span>
                        <span className="font-mono">+ NT$ {expressFee}</span>
                      </div>
                    )}

                    {paymentMethod === 'member' && (
                      <div
                        className={`flex justify-between items-center rounded-lg p-2.5 my-1 font-sans border-2 ${
                          isSimplifiedMode
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        <span>
                          👤{' '}
                          {TRANSLATIONS.cartWalletBalance[currentLang] ||
                            '當前會員餘額 Account Wallet'}
                        </span>
                        <span className="font-mono font-bold text-sm">
                          NT$ {(userBalance || 0).toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex justify-between pt-1.5 border-t ${
                        isSimplifiedMode
                          ? 'text-base font-black text-black border-t-2 border-black'
                          : 'text-sm font-extrabold text-white border-white/10'
                      }`}
                    >
                      <span>{TRANSLATIONS.netPayableToday[currentLang] || '本日總應付額'}</span>
                      <span
                        className={`font-mono font-bold ${isSimplifiedMode ? 'text-xl text-amber-800 font-serif' : 'text-base text-[#E5B453]'}`}
                      >
                        NT$ {cartTotal}
                      </span>
                    </div>

                    {/* Promo Combo Info / Progress Banner */}
                    {promoCombo && (
                      <>
                        {Array.isArray(promoCombo.combos)
                          ? promoCombo.combos.map((combo: any, idx: number) => {
                              if (!combo.enabled) return null;
                              const itemDiscountDetail = activeCombosAndDiscounts.find(
                                (d) => d.combo.id === combo.id,
                              );
                              const count = itemDiscountDetail
                                ? itemDiscountDetail.eligibleCount
                                : 0;
                              const discount = itemDiscountDetail ? itemDiscountDetail.discount : 0;
                              if (count === 0) return null;

                              return (
                                <div key={combo.id || idx}>
                                  {count < combo.requiredQty ? (
                                    <div
                                      className={`text-[10px] border rounded-lg p-2.5 mt-2 flex flex-col space-y-1 ${
                                        isSimplifiedMode
                                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                                          : 'bg-[#E5B453]/5 border-[#E5B453]/15 text-[#E5B453]/90'
                                      }`}
                                    >
                                      <div className="font-bold flex items-center justify-between text-[11px] text-[#E5B453]">
                                        <span>🌟 【{combo.name}】活動累計中</span>
                                        <span className="text-[10px] opacity-75 font-mono">
                                          {count}/{combo.requiredQty}件
                                        </span>
                                      </div>
                                      <p className="leading-tight opacity-80 font-sans">
                                        目前已點選此套餐餐品 {count} 件，再點{' '}
                                        <span className="underline font-bold font-mono text-[#E5B453] text-xs">
                                          {combo.requiredQty - count}
                                        </span>{' '}
                                        件即可自動折扣{' '}
                                        <span className="font-extrabold text-[#E5B453] font-mono text-xs">
                                          {combo.discountAmount}元
                                        </span>
                                        ！
                                      </p>
                                    </div>
                                  ) : (
                                    <div
                                      className={`text-[10px] border rounded-lg p-2.5 mt-2 flex flex-col space-y-1 ${
                                        isSimplifiedMode
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                          : 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400 font-bold'
                                      }`}
                                    >
                                      <div className="font-bold flex items-center justify-between text-[11px] text-emerald-400">
                                        <span>
                                          🎉 【{combo.name}】
                                          {currentLang === 'zh'
                                            ? '已享有優惠折扣！'
                                            : currentLang === 'en'
                                              ? 'Discount Applied!'
                                              : currentLang === 'th'
                                                ? 'ได้รับส่วนลดแล้ว!'
                                                : currentLang === 'ja'
                                                  ? '割引が適用されました！'
                                                  : currentLang === 'ko'
                                                    ? '할인이 적용되었습니다!'
                                                    : 'Đã áp dụng giảm giá!'}
                                        </span>
                                        <span className="font-mono text-xs">
                                          {currentLang === 'zh'
                                            ? `符合 ${Math.floor(count / combo.requiredQty)} 組`
                                            : `${Math.floor(count / combo.requiredQty)} Set(s) Matched`}
                                        </span>
                                      </div>
                                      <p className="leading-tight opacity-85 font-sans">
                                        {currentLang === 'zh' ? (
                                          <>
                                            已累計指定商品 {count} 件，為您自動扣除 NT$ {discount}{' '}
                                            元！
                                          </>
                                        ) : (
                                          <>
                                            Accumulated {count} specified item(s), automatically
                                            saved NT$ {discount}!
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          : promoCombo.enabled && (
                              <>
                                {promoComboEligibleCount > 0 &&
                                promoComboEligibleCount < promoCombo.requiredQty ? (
                                  <div
                                    className={`text-[10px] border rounded-lg p-2.5 mt-2 flex flex-col space-y-1 ${
                                      isSimplifiedMode
                                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                                        : 'bg-[#E5B453]/5 border-[#E5B453]/15 text-[#E5B453]/90'
                                    }`}
                                  >
                                    <div className="font-bold flex items-center justify-between text-[11px] text-[#E5B453]">
                                      <span>
                                        🌟{' '}
                                        {currentLang === 'zh'
                                          ? '超值優惠套餐折抵中'
                                          : currentLang === 'en'
                                            ? 'Promo Combo in Progress'
                                            : currentLang === 'th'
                                              ? 'กำลังคำนวณเซตโปรโมชั่น'
                                              : currentLang === 'ja'
                                                ? 'お得セット割引計算中'
                                                : currentLang === 'ko'
                                                  ? '혜택 세트 적용 중'
                                                  : 'Đang tính combo khuyến mãi'}
                                      </span>
                                      <span className="text-[10px] opacity-75 font-mono">
                                        {promoComboEligibleCount}/{promoCombo.requiredQty}
                                        {currentLang === 'zh' ? '件' : ' item(s)'}
                                      </span>
                                    </div>
                                    <p className="leading-tight opacity-80 font-sans">
                                      {currentLang === 'zh' ? (
                                        <>
                                          目前已選擇限定品項 {promoComboEligibleCount} 件，再點{' '}
                                          <span className="underline font-bold font-mono text-white text-xs">
                                            {promoCombo.requiredQty - promoComboEligibleCount}
                                          </span>{' '}
                                          件即可自動折扣{' '}
                                          <span className="font-extrabold text-white font-mono text-xs">
                                            {promoCombo.discountAmount}元
                                          </span>{' '}
                                          ── 快去選購限定炭烤吧！
                                        </>
                                      ) : (
                                        <>
                                          Selected {promoComboEligibleCount} promo item(s). Add{' '}
                                          <span className="underline font-bold font-mono text-white text-xs">
                                            {promoCombo.requiredQty - promoComboEligibleCount}
                                          </span>{' '}
                                          more to get a{' '}
                                          <span className="font-extrabold text-white font-mono text-xs">
                                            NT$ {promoCombo.discountAmount}
                                          </span>{' '}
                                          discount!
                                        </>
                                      )}
                                    </p>
                                  </div>
                                ) : promoComboEligibleCount >= promoCombo.requiredQty ? (
                                  <div
                                    className={`text-[10px] border rounded-lg p-2.5 mt-2 flex flex-col space-y-1 ${
                                      isSimplifiedMode
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                        : 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400 font-bold'
                                    }`}
                                  >
                                    <div className="font-bold flex items-center justify-between text-[11px] text-emerald-400">
                                      <span>
                                        🎉{' '}
                                        {currentLang === 'zh'
                                          ? '已享超值優惠套餐折扣！'
                                          : currentLang === 'en'
                                            ? 'Promo Combo Discount Applied!'
                                            : currentLang === 'th'
                                              ? 'ได้รับส่วนลดเซตโปรโมชั่นแล้ว!'
                                              : currentLang === 'ja'
                                                ? 'お得セット割引適用済み！'
                                                : currentLang === 'ko'
                                                  ? '혜택 세트 적용 완료!'
                                                  : 'Đã nhận chiết khấu combo!'}
                                      </span>
                                      <span className="font-mono text-xs">
                                        {currentLang === 'zh'
                                          ? `符合 ${Math.floor(promoComboEligibleCount / promoCombo.requiredQty)} 組`
                                          : `${Math.floor(promoComboEligibleCount / promoCombo.requiredQty)} Set(s) Matched`}
                                      </span>
                                    </div>
                                    <p className="leading-tight opacity-85 font-sans">
                                      {currentLang === 'zh' ? (
                                        <>
                                          已累計限定餐飲商品 {promoComboEligibleCount}{' '}
                                          件，為您全自動節省 NT$ {promoComboDiscount} 元！
                                        </>
                                      ) : (
                                        <>
                                          Accumulated {promoComboEligibleCount} specified promo
                                          item(s), automatically saved NT$ {promoComboDiscount}!
                                        </>
                                      )}
                                    </p>
                                  </div>
                                ) : null}
                              </>
                            )}
                      </>
                    )}

                    {/* Google Member Promo Banner */}
                    {!lineProfile && (
                      <div
                        className={`text-[10px] border rounded-lg p-2.5 mt-2 flex items-center justify-between ${
                          isSimplifiedMode
                            ? 'bg-zinc-100 border-zinc-250 text-black'
                            : 'bg-white/5 border-white/10 text-white/50'
                        }`}
                      >
                        <span>
                          {TRANSLATIONS.googleLoginPromo[currentLang] ||
                            '💡 綁定 Google 帳戶可累積點數！'}
                        </span>
                        <span className="text-[#4285F4] font-black cursor-pointer">
                          {TRANSLATIONS.loginNow[currentLang] || '手刀登入'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            {cart.length > 0 && (
              <div
                className={`p-3 sm:p-4 border-t shrink-0 ${isSimplifiedMode ? 'bg-amber-50 border-t-2 border-zinc-200' : 'bg-black/30 border-white/10'}`}
              >
                <button
                  id="checkout-confirm-btn"
                  disabled={
                    (servicePaused && !urlReservationParams?.reservationNo) || isCheckoutSubmitting
                  }
                  onClick={handleCheckout}
                  className={`w-full font-black px-2 min-[360px]:px-4 rounded-xl transition text-center flex items-center justify-center space-x-1 sm:space-x-1.5 whitespace-nowrap ${
                    (servicePaused && !urlReservationParams?.reservationNo) || isCheckoutSubmitting
                      ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed py-3 text-xs opacity-60'
                      : isSimplifiedMode
                        ? 'bg-[#FFA500] hover:bg-amber-400 text-black border-2 border-black font-extrabold text-base py-4 sm:py-4.5 shadow-lg active:scale-95 cursor-pointer'
                        : 'bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] py-2.5 sm:py-3.5 text-[10px] min-[360px]:text-[11px] min-[395px]:text-xs sm:text-sm active:scale-95 cursor-pointer'
                  }`}
                >
                  {isCheckoutSubmitting ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <ShoppingCart
                      size={isSimplifiedMode ? 18 : 12}
                      className={isSimplifiedMode ? 'mr-1' : 'sm:size-[15px]'}
                    />
                  )}
                  <span>
                    {isCheckoutSubmitting
                      ? TRANSLATIONS.placingOrder[currentLang] ||
                        '正在傳送訂單中 (Placing Order...)'
                      : servicePaused && !urlReservationParams?.reservationNo
                        ? TRANSLATIONS.kitchenPaused[currentLang] ||
                          '⚠️ 廚房暫停接單中，暫時停用下單 (Kitchen Paused)'
                        : currentLang === 'zh'
                          ? `確認 ${selectedTable.includes('外帶') ? selectedTable : `${selectedTable} 桌`} 並下單 (請至櫃台結帳)`
                          : currentLang === 'en'
                            ? `Confirm ${selectedTable} & Order (Pay at Counter)`
                            : currentLang === 'th'
                              ? `ยืนยัน ${selectedTable} และสั่งอาหาร (ชำระเงินที่เคาน์เตอร์)`
                              : currentLang === 'ja'
                                ? `${selectedTable} で注文を確定する (レジで決済)`
                                : currentLang === 'ko'
                                  ? `${selectedTable} 주문 확인 (카운터에서 결제)`
                                  : `Xác nhận ${selectedTable} và đặt món (Thanh toán tại quầy)`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Switchable Section: Order History / Live Queue vs. Today's Best Sellers */}
      <div
        className="pt-6 border-t border-white/10 text-left space-y-4 font-sans"
        id="switchable-orders-segment"
      >
        {isOrderHistoryVisible ? (
          <div className="space-y-4">
            {/* Tabs Navigation */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveSegmentTab('history')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeSegmentTab === 'history'
                    ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {t('myOrdersTab')}
              </button>
              <button
                type="button"
                onClick={() => setActiveSegmentTab('bestsellers')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeSegmentTab === 'bestsellers'
                    ? 'bg-[#E5B453] text-[#0F0F0F] shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {t('bestSellersTab')}
              </button>
            </div>

            {activeSegmentTab === 'history' ? (
              <div className="space-y-6">
                {/* 1. Live Active Queue Orders (unpaid orders) */}
                {(() => {
                  const liveQueueOrders = clientActiveOrders.filter((o) => !o.isPaid);
                  if (liveQueueOrders.length === 0) return null;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h6 className="text-xs font-black text-[#E5B453] flex items-center gap-1.5 uppercase tracking-wider">
                          <Clock size={12} className="text-[#E5B453] animate-pulse" />
                          <span>
                            {t('liveActiveQueue')} ({liveQueueOrders.length})
                          </span>
                        </h6>
                        <span className="text-[10px] text-white/40">{t('autoUpdate')}</span>
                      </div>

                      <div className="space-y-3">
                        {liveQueueOrders.map((order) => {
                          const statusColors = {
                            pending: 'text-amber-400 border-amber-400/20 bg-amber-400/5',
                            preparing: 'text-blue-400 border-blue-400/20 bg-blue-400/5',
                            completed: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5',
                            cancelled: 'text-rose-400 border-rose-400/20 bg-rose-400/5',
                          };

                          const statusLabels = {
                            pending: {
                              zh: '⏳ 候餐排隊中',
                              en: 'Pending',
                              ko: 'Pending',
                              ja: 'Pending',
                              th: 'Pending',
                              vi: '⏳ Đang chờ xếp món',
                            },
                            preparing: {
                              zh: '🍳 師傅大火製餐中',
                              en: 'Cooking',
                              ko: 'Cooking',
                              ja: 'Cooking',
                              th: 'Cooking',
                              vi: '🍳 Đầu bếp đang chế biến',
                            },
                            completed: {
                              zh: '✅ 餐點已上齊 (待結帳)',
                              en: 'Dished Up',
                              ko: 'Dished Up',
                              ja: 'Dished Up',
                              th: 'Dished Up',
                              vi: '✅ Món ăn đã sẵn sàng (Chờ thanh toán)',
                            },
                            cancelled: {
                              zh: '❌ 訂單已撤銷',
                              en: 'Cancelled',
                              ko: 'Cancelled',
                              ja: 'Cancelled',
                              th: 'Cancelled',
                              vi: '❌ Đơn hàng đã hủy',
                            },
                          };

                          return (
                            <div
                              key={order.id}
                              id={`history-order-${order.id}`}
                              className="bg-[#161616] border border-white/5 rounded-xl p-4 space-y-3 shadow-md"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-left space-y-0.5">
                                  <span className="text-xs font-mono font-bold text-[#E5B453] bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                                    {order.id}
                                  </span>
                                  <span className="text-xs text-white/40 pl-2">
                                    {new Date(order.createdAt).toLocaleTimeString()} ·{' '}
                                    {currentLang === 'vi' ? 'Bàn' : '桌次'}: {order.tableNumber}{' '}
                                    {currentLang === 'vi' ? '' : '桌'}
                                  </span>
                                </div>

                                <span
                                  className={`text-[11px] font-bold px-3 py-1 rounded-full border ${statusColors[order.status] || ''}`}
                                >
                                  {statusLabels[order.status]?.[currentLang] || order.status}
                                </span>
                              </div>

                              {/* mini listing */}
                              <div className="space-y-1.5 py-1 text-white/70 text-xs text-left">
                                {order.items.map((it, idx) => {
                                  const unitPrice = getItemUnitPrice(it);
                                  return (
                                    <div
                                      key={idx}
                                      className="flex flex-col mb-1.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                                    >
                                      <div className="flex justify-between font-medium">
                                        <span>
                                          {getLocalizedText(it.name, currentLang) || ''}{' '}
                                          <strong className="text-[#E5B453] bg-white/5 px-1 rounded text-[11px] ml-1">
                                            x {it.qty}
                                          </strong>
                                        </span>
                                        <span className="font-mono text-white/40">
                                          NT$ {unitPrice * it.qty}
                                        </span>
                                      </div>
                                      {it.customization && (
                                        <div className="text-[11px] text-white/40 mt-0.5 space-y-0.5 pl-2">
                                          {it.customization.sweetness !== undefined && (
                                            <div>
                                              • {t('sweetness') || '甜度'}:{' '}
                                              {
                                                ['無糖', '微糖', '正常糖', '多糖'][
                                                  it.customization.sweetness
                                                ]
                                              }
                                            </div>
                                          )}
                                          {it.customization.spiciness !== undefined && (
                                            <div>
                                              • {t('spiciness') || '辣度'}:{' '}
                                              {
                                                ['不辣', '微辣', '中辣', '大辣(+10)'][
                                                  it.customization.spiciness
                                                ]
                                              }
                                            </div>
                                          )}
                                          {it.customization.soupBase && (
                                            <div>
                                              • {t('soupBase') || '湯底'}:{' '}
                                              {it.customization.soupBase === 'coconut-milk'
                                                ? '椰奶(+50)'
                                                : '清湯'}
                                            </div>
                                          )}
                                          {it.customization.noodleType && (
                                            <div>
                                              • {t('noodleType') || '麵體'}:{' '}
                                              {it.customization.noodleType === 'rice-noodle'
                                                ? '米線'
                                                : it.customization.noodleType === 'vermicelli'
                                                  ? '冬粉'
                                                  : '不加麵'}
                                            </div>
                                          )}
                                          {it.customization.selectedAddOns &&
                                            it.customization.selectedAddOns.map((addon, aIdx) => (
                                              <div
                                                key={aIdx}
                                                className="flex justify-between text-white/50"
                                              >
                                                <span>
                                                  +{' '}
                                                  {typeof addon.name === 'object'
                                                    ? addon.name[
                                                        currentLang as keyof typeof addon.name
                                                      ] ||
                                                      addon.name['zh'] ||
                                                      ''
                                                    : addon.name}
                                                </span>
                                                <span>(NT$ {addon.price})</span>
                                              </div>
                                            ))}
                                          {it.customization.notes && (
                                            <div className="text-[#E5B453]/80 italic border-l-2 border-[#E5B453]/30 pl-1.5 mt-1">
                                              {t('notes') || '備註'}: {it.customization.notes}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex justify-between items-center pt-2.5 border-t border-white/5 text-xs">
                                <span className="text-white/45 font-semibold uppercase">
                                  {t('payMethod')}: {order.paymentMethod.toUpperCase()}
                                </span>
                                <span className="text-white/80 font-bold text-sm">
                                  {t('payableTotal')}:{' '}
                                  <strong className="text-[#E5B453] font-mono text-base font-bold">
                                    NT${' '}
                                    {order.total ||
                                      order.items.reduce(
                                        (sum, it) => sum + getItemUnitPrice(it) * it.qty,
                                        0,
                                      )}
                                  </strong>
                                </span>
                              </div>

                              {order.status === 'completed' && (
                                <div className="pt-3.5 border-t border-white/5 mt-2 space-y-3 text-left">
                                  {(() => {
                                    const hasRatedBackend =
                                      order.rating !== undefined && order.rating > 0;
                                    const rState = ratingStates[order.id];
                                    const isSubmitted = rState?.isSubmitted || hasRatedBackend;
                                    const currentRating = rState
                                      ? rState.rating
                                      : order.rating || 5;
                                    const currentFeedback = rState
                                      ? rState.feedback
                                      : order.feedback || '';
                                    const isEditing = rState ? rState.isEditing : !hasRatedBackend;

                                    const handleStarClick = (starVal) => {
                                      if (isSubmitted && !isEditing) return;
                                      setRatingStates((prev) => ({
                                        ...prev,
                                        [order.id]: {
                                          rating: starVal,
                                          feedback: prev[order.id]?.feedback || '',
                                          isSubmitted: false,
                                          isEditing: true,
                                        },
                                      }));
                                    };

                                    const handleFeedbackChange = (text) => {
                                      setRatingStates((prev) => ({
                                        ...prev,
                                        [order.id]: {
                                          rating: prev[order.id]?.rating || 5,
                                          feedback: text,
                                          isSubmitted: false,
                                          isEditing: true,
                                        },
                                      }));
                                    };

                                    const handleSubmitRating = async () => {
                                      if (ratingSubmitting[order.id]) return;
                                      setRatingSubmitting((prev) => ({
                                        ...prev,
                                        [order.id]: true,
                                      }));
                                      try {
                                        const res = await apiFetch(`/api/orders/${order.id}/rate`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            rating: currentRating,
                                            feedback: currentFeedback,
                                          }),
                                        });
                                        if (res.ok) {
                                          setRatingStates((prev) => ({
                                            ...prev,
                                            [order.id]: {
                                              rating: currentRating,
                                              feedback: currentFeedback,
                                              isSubmitted: true,
                                              isEditing: false,
                                            },
                                          }));
                                        } else {
                                          const errData = await res.json();
                                          showToast(
                                            `評價失敗: ${errData.error || '未知的錯誤'}`,
                                            'error',
                                          );
                                        }
                                      } catch (err) {
                                        console.error('Error submitting rating:', err);
                                        showToast('評價傳送失敗，請確認網路連線！', 'error');
                                      } finally {
                                        setRatingSubmitting((prev) => ({
                                          ...prev,
                                          [order.id]: false,
                                        }));
                                      }
                                    };

                                    if (isSubmitted) {
                                      return (
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-[#00C300] flex items-center gap-1.5">
                                              <Check size={11} className="text-[#00C300]" />
                                              <span>{t('thankYouRating')}</span>
                                            </span>
                                            <button
                                              onClick={() => {
                                                setRatingStates((prev) => ({
                                                  ...prev,
                                                  [order.id]: {
                                                    ...prev[order.id],
                                                    isEditing: true,
                                                    isSubmitted: false,
                                                  },
                                                }));
                                              }}
                                              className="text-[10px] text-[#E5B453] hover:underline cursor-pointer"
                                            >
                                              {t('editRatingBtn')}
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                              <Star
                                                key={star}
                                                size={14}
                                                className={
                                                  star <= currentRating
                                                    ? 'fill-amber-400 text-amber-400'
                                                    : 'text-zinc-650'
                                                }
                                              />
                                            ))}
                                            <span className="text-xs font-mono font-bold text-white pl-1.5">
                                              {currentRating} {t('pointsStarCount')}
                                            </span>
                                          </div>
                                          {currentFeedback && (
                                            <p className="text-xs text-zinc-400 bg-white/5 px-2 py-1.5 rounded italic">
                                              「{currentFeedback}」
                                            </p>
                                          )}
                                        </div>
                                      );
                                    }

                                    if (isEditing) {
                                      return (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-[#E5B453] font-bold uppercase tracking-wider">
                                              {t('rateExperience')}
                                            </span>
                                          </div>

                                          <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-zinc-400">
                                              {t('selectStars')}
                                            </span>
                                            <div className="flex items-center gap-1.5 pt-0.5">
                                              {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                  type="button"
                                                  key={star}
                                                  onClick={() => handleStarClick(star)}
                                                  className="transition transform active:scale-125 focus:outline-none cursor-pointer"
                                                >
                                                  <Star
                                                    size={20}
                                                    className={
                                                      star <= currentRating
                                                        ? 'fill-amber-400 text-amber-400'
                                                        : 'text-zinc-650 hover:text-amber-400/80'
                                                    }
                                                  />
                                                </button>
                                              ))}
                                              <span className="text-xs font-mono font-bold text-thai-gold pl-2">
                                                {(() => {
                                                  const ratingDesc = {
                                                    5: {
                                                      zh: '🤩 完美超棒',
                                                      en: 'Perfect',
                                                      ko: '완벽함',
                                                      ja: '最高',
                                                      th: 'ยอดเยี่ยม',
                                                      vi: 'Tuyệt vời',
                                                    },
                                                    4: {
                                                      zh: '很滿意',
                                                      en: 'Very Satisfied',
                                                      ko: '매우 만족',
                                                      ja: '大満足',
                                                      th: 'พึงพอใจมาก',
                                                      vi: 'Rất hài lòng',
                                                    },
                                                    3: {
                                                      zh: '普通',
                                                      en: 'Average',
                                                      ko: '보통',
                                                      ja: '普通',
                                                      th: 'ปานกลาง',
                                                      vi: 'Bình thường',
                                                    },
                                                    2: {
                                                      zh: '待加強',
                                                      en: 'Could Be Better',
                                                      ko: '개선 필요',
                                                      ja: '改善希望',
                                                      th: 'ควรปรับปรุง',
                                                      vi: 'Cần cải thiện',
                                                    },
                                                    1: {
                                                      zh: '極差',
                                                      en: 'Very Bad',
                                                      ko: '매우 불만족',
                                                      ja: '非常に不満',
                                                      th: 'แย่มาก',
                                                      vi: 'Rất tệ',
                                                    },
                                                  };
                                                  return (
                                                    (ratingDesc[currentRating]?.[currentLang] ||
                                                      ratingDesc[currentRating]?.['zh'] ||
                                                      '') +
                                                    ' (' +
                                                    currentRating +
                                                    ' / 5)'
                                                  );
                                                })()}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="space-y-1 bg-transparent">
                                            <span className="text-[10px] text-zinc-400">
                                              {t('feedbackOptional')}
                                            </span>
                                            <textarea
                                              value={currentFeedback}
                                              onChange={(e) => handleFeedbackChange(e.target.value)}
                                              placeholder={t('feedbackPlaceholder')}
                                              rows={2}
                                              className="w-full bg-black/40 text-xs border border-white/10 rounded-lg p-2 focus:border-[#E5B453] focus:ring-1 focus:ring-[#E5B453] outline-none text-white resize-none"
                                            />
                                          </div>

                                          <button
                                            type="button"
                                            disabled={ratingSubmitting[order.id]}
                                            onClick={handleSubmitRating}
                                            className={`w-full py-1.5 rounded-lg text-xs font-black transition shadow cursor-pointer flex items-center justify-center space-x-1.5 ${
                                              ratingSubmitting[order.id]
                                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                                                : 'bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] active:scale-95'
                                            }`}
                                          >
                                            {ratingSubmitting[order.id] ? (
                                              <>
                                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                                <span>傳送中...</span>
                                              </>
                                            ) : (
                                              <span>{t('submitRating')}</span>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRatingStates((prev) => ({
                                            ...prev,
                                            [order.id]: {
                                              rating: 5,
                                              feedback: '',
                                              isSubmitted: false,
                                              isEditing: true,
                                            },
                                          }));
                                        }}
                                        className="w-full py-2 bg-[#E5B453]/10 hover:bg-[#E5B453]/20 border border-[#E5B453]/20 text-[#E5B453] rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                        <Star size={12} className="fill-current animate-pulse" />
                                        <span>{t('rateOrderBtn')}</span>
                                      </button>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Past Orders and Member Return Welcome */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h6 className="text-xs font-black text-[#E5B453] flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles size={12} className="text-[#E5B453]" />
                      <span>📜 已完成之歷史訂單 Past Orders</span>
                    </h6>
                  </div>

                  {!!lineProfile && (
                    <div className="bg-[#E5B453]/10 border border-[#E5B453]/20 rounded-xl p-4 text-left space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <span className="text-xs font-black text-[#E5B453] bg-[#E5B453]/15 border border-[#E5B453]/30 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 self-start">
                          <Sparkles size={11} className="text-[#E5B453] animate-pulse" />✨
                          尊榮多次登入老饕會員 Exclusive Diner ✨
                        </span>
                        <span className="text-[10px] text-white/55 font-mono">
                          累計安全驗證登入：
                          <strong className="text-[#E5B453] text-xs font-bold font-mono">
                            {loginCount}
                          </strong>{' '}
                          次
                        </span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed font-sans">
                        {t('welcomeBackNotice')}
                      </p>
                    </div>
                  )}

                  {/* Past Orders List */}
                  {(() => {
                    const pastOrdersList = [
                      ...clientActiveOrders.filter(
                        (o) => o.status === 'completed' || o.status === 'cancelled',
                      ),
                      ...getSimulatedPastOrders(),
                    ];

                    if (pastOrdersList.length === 0) {
                      return (
                        <p className="text-xs text-white/40 text-center py-6 font-sans">
                          {t('noPastRecords')}
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-3.5">
                        {pastOrdersList.map((pastOrder, idx) => (
                          <div
                            key={pastOrder.id || idx}
                            className="bg-[#161616] border border-white/5 rounded-2xl p-4 flex flex-col justify-between shadow-md hover:border-white/10 transition space-y-3.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono font-bold text-[#E5B453] bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                                  {pastOrder.id}
                                </span>
                                <span className="text-[11px] text-white/40 font-mono">
                                  {pastOrder.createdAt.includes('T')
                                    ? pastOrder.createdAt.split('T')[0]
                                    : pastOrder.createdAt}{' '}
                                  • {currentLang === 'vi' ? 'Bàn' : '桌號'}: {pastOrder.tableNumber}{' '}
                                  {currentLang === 'vi' ? '' : '桌'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E5B453]/10 border border-[#E5B453]/25 text-[#E5B453]">
                                {t('pastRecordLabel')}
                              </span>
                            </div>

                            {/* List items */}
                            <div className="space-y-1.5 pl-1">
                              {pastOrder.items.map((it, iIdx) => {
                                const unitPrice = getItemUnitPrice(it);
                                return (
                                  <div
                                    key={iIdx}
                                    className="flex flex-col mb-1.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                                  >
                                    <div className="flex justify-between text-xs text-white/80 font-sans">
                                      <span className="flex items-center space-x-1">
                                        <span className="text-[#E5B453]">•</span>
                                        <span>{getLocalizedText(it.name, currentLang) || ''}</span>
                                        <strong className="text-[#E5B453] bg-white/5 px-1.5 py-0.2 rounded text-[10px]">
                                          x {it.qty}
                                        </strong>
                                      </span>
                                      <span className="font-mono text-white/40">
                                        NT$ {unitPrice * it.qty}
                                      </span>
                                    </div>
                                    {it.customization && (
                                      <div className="text-[11px] text-white/40 mt-0.5 space-y-0.5 pl-3">
                                        {it.customization.sweetness !== undefined && (
                                          <div>
                                            • {t('sweetness') || '甜度'}:{' '}
                                            {
                                              ['無糖', '微糖', '正常糖', '多糖'][
                                                it.customization.sweetness
                                              ]
                                            }
                                          </div>
                                        )}
                                        {it.customization.spiciness !== undefined && (
                                          <div>
                                            • {t('spiciness') || '辣度'}:{' '}
                                            {
                                              ['不辣', '微辣', '中辣', '大辣(+10)'][
                                                it.customization.spiciness
                                              ]
                                            }
                                          </div>
                                        )}
                                        {it.customization.soupBase && (
                                          <div>
                                            • {t('soupBase') || '湯底'}:{' '}
                                            {it.customization.soupBase === 'coconut-milk'
                                              ? '椰奶(+50)'
                                              : '清湯'}
                                          </div>
                                        )}
                                        {it.customization.noodleType && (
                                          <div>
                                            • {t('noodleType') || '麵體'}:{' '}
                                            {it.customization.noodleType === 'rice-noodle'
                                              ? '米線'
                                              : it.customization.noodleType === 'vermicelli'
                                                ? '冬粉'
                                                : '不加麵'}
                                          </div>
                                        )}
                                        {it.customization.selectedAddOns &&
                                          it.customization.selectedAddOns.map((addon, aIdx) => (
                                            <div
                                              key={aIdx}
                                              className="flex justify-between text-white/50"
                                            >
                                              <span>
                                                +{' '}
                                                {typeof addon.name === 'object'
                                                  ? addon.name[
                                                      currentLang as keyof typeof addon.name
                                                    ] ||
                                                    addon.name['zh'] ||
                                                    ''
                                                  : addon.name}
                                              </span>
                                              <span>(NT$ {addon.price})</span>
                                            </div>
                                          ))}
                                        {it.customization.notes && (
                                          <div className="text-[#E5B453]/80 italic border-l-2 border-[#E5B453]/30 pl-1.5 mt-1">
                                            {t('notes') || '備註'}: {it.customization.notes}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pricing & Reorder */}
                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                              <div className="text-xs text-white/55">
                                {t('totalPastSpend')}{' '}
                                <strong className="text-[#E5B453] text-[13px] font-mono font-bold">
                                  NT${' '}
                                  {pastOrder.total ||
                                    pastOrder.items.reduce(
                                      (sum, it) => sum + getItemUnitPrice(it) * it.qty,
                                      0,
                                    )}
                                </strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleReorderOrder(pastOrder.items)}
                                className="flex items-center space-x-1.5 bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] text-xs font-black px-3.5 py-2 rounded-xl cursor-pointer transition active:scale-95 shadow-md shadow-[#E5B453]/10"
                              >
                                <ShoppingCart size={12} />
                                <span>{t('reorderBtn')}</span>
                              </button>
                            </div>

                            {pastOrder.status === 'completed' && (
                              <div className="pt-3 border-t border-white/5 space-y-3 mt-1 text-left">
                                {(() => {
                                  const hasRatedBackend =
                                    pastOrder.rating !== undefined && pastOrder.rating > 0;
                                  const rState = ratingStates[pastOrder.id];
                                  const isSubmitted = rState?.isSubmitted || hasRatedBackend;
                                  const currentRating = rState
                                    ? rState.rating
                                    : pastOrder.rating || 5;
                                  const currentFeedback = rState
                                    ? rState.feedback
                                    : pastOrder.feedback || '';
                                  const isEditing = rState ? rState.isEditing : !hasRatedBackend;

                                  const handleStarClick = (starVal) => {
                                    if (isSubmitted && !isEditing) return;
                                    setRatingStates((prev) => ({
                                      ...prev,
                                      [pastOrder.id]: {
                                        rating: starVal,
                                        feedback: prev[pastOrder.id]?.feedback || '',
                                        isSubmitted: false,
                                        isEditing: true,
                                      },
                                    }));
                                  };

                                  const handleFeedbackChange = (text) => {
                                    setRatingStates((prev) => ({
                                      ...prev,
                                      [pastOrder.id]: {
                                        rating: prev[pastOrder.id]?.rating || 5,
                                        feedback: text,
                                        isSubmitted: false,
                                        isEditing: true,
                                      },
                                    }));
                                  };

                                  const handleSubmitRating = async () => {
                                    if (ratingSubmitting[pastOrder.id]) return;
                                    setRatingSubmitting((prev) => ({
                                      ...prev,
                                      [pastOrder.id]: true,
                                    }));
                                    try {
                                      const res = await apiFetch(
                                        `/api/orders/&{pastOrder.id}/rate`,
                                        {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            rating: currentRating,
                                            feedback: currentFeedback,
                                          }),
                                        },
                                      );
                                      if (res.ok || res.status === 404) {
                                        setRatingStates((prev) => ({
                                          ...prev,
                                          [pastOrder.id]: {
                                            rating: currentRating,
                                            feedback: currentFeedback,
                                            isSubmitted: true,
                                            isEditing: false,
                                          },
                                        }));
                                      } else {
                                        const errData = await res.json();
                                        showToast(
                                          `評價失敗: ${errData.error || '未知的錯誤'}`,
                                          'error',
                                        );
                                      }
                                    } catch (err) {
                                      console.warn(
                                        'Backend rate API not available, saving locally:',
                                        err,
                                      );
                                      setRatingStates((prev) => ({
                                        ...prev,
                                        [pastOrder.id]: {
                                          rating: currentRating,
                                          feedback: currentFeedback,
                                          isSubmitted: true,
                                          isEditing: false,
                                        },
                                      }));
                                    } finally {
                                      setRatingSubmitting((prev) => ({
                                        ...prev,
                                        [pastOrder.id]: false,
                                      }));
                                    }
                                  };

                                  if (isSubmitted) {
                                    return (
                                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 text-left space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[11px] font-bold text-[#00C300] flex items-center gap-1.5">
                                            <Check size={11} className="text-[#00C300]" />
                                            <span>{t('thankYouRating')}</span>
                                          </span>
                                          <button
                                            onClick={() => {
                                              setRatingStates((prev) => ({
                                                ...prev,
                                                [pastOrder.id]: {
                                                  ...prev[pastOrder.id],
                                                  isEditing: true,
                                                  isSubmitted: false,
                                                },
                                              }));
                                            }}
                                            className="text-[10px] text-[#E5B453] hover:underline cursor-pointer"
                                          >
                                            {t('editRatingBtn')}
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                              key={star}
                                              size={14}
                                              className={
                                                star <= currentRating
                                                  ? 'fill-amber-400 text-amber-400'
                                                  : 'text-zinc-650'
                                              }
                                            />
                                          ))}
                                          <span className="text-xs font-mono font-bold text-white pl-1.5">
                                            {currentRating} {t('pointsStarCount')}
                                          </span>
                                        </div>
                                        {currentFeedback && (
                                          <p className="text-xs text-zinc-400 bg-white/5 px-2 py-1.5 rounded italic">
                                            「{currentFeedback}」
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (isEditing) {
                                    return (
                                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[11px] text-[#E5B453] font-bold uppercase tracking-wider">
                                            {t('rateExperience')}
                                          </span>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                          <span className="text-[10px] text-zinc-400">
                                            {t('selectStars')}
                                          </span>
                                          <div className="flex items-center gap-1.5 pt-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                              <button
                                                type="button"
                                                key={star}
                                                onClick={() => handleStarClick(star)}
                                                className="transition transform active:scale-125 focus:outline-none cursor-pointer"
                                              >
                                                <Star
                                                  size={18}
                                                  className={
                                                    star <= currentRating
                                                      ? 'fill-amber-400 text-amber-400'
                                                      : 'text-zinc-650 hover:text-amber-400/80'
                                                  }
                                                />
                                              </button>
                                            ))}
                                            <span className="text-xs font-mono font-bold text-[#E5B453] pl-2">
                                              {currentRating === 5
                                                ? '🤩 完美超棒'
                                                : currentRating === 4
                                                  ? '😊 很滿意'
                                                  : currentRating === 3
                                                    ? '😐 普通'
                                                    : currentRating === 2
                                                      ? '☹️ 待加強'
                                                      : '😡 極差'}{' '}
                                              ({currentRating} / 5)
                                            </span>
                                          </div>
                                        </div>

                                        <div className="space-y-1 bg-transparent">
                                          <span className="text-[10px] text-zinc-400">
                                            {t('feedbackOptional')}
                                          </span>
                                          <textarea
                                            value={currentFeedback}
                                            onChange={(e) => handleFeedbackChange(e.target.value)}
                                            placeholder={t('feedbackPlaceholder')}
                                            rows={2}
                                            className="w-full bg-black/40 text-xs border border-white/10 rounded-lg p-2 focus:border-[#E5B453] focus:ring-1 focus:ring-[#E5B453] outline-none text-white resize-none"
                                          />
                                        </div>

                                        <button
                                          type="button"
                                          disabled={ratingSubmitting[pastOrder.id]}
                                          onClick={handleSubmitRating}
                                          className={`w-full py-1.5 rounded-lg text-xs font-black transition shadow cursor-pointer flex items-center justify-center space-x-1.5 ${
                                            ratingSubmitting[pastOrder.id]
                                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                                              : 'bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] active:scale-95'
                                          }`}
                                        >
                                          {ratingSubmitting[pastOrder.id] ? (
                                            <>
                                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                              <span>傳送中...</span>
                                            </>
                                          ) : (
                                            <span>{t('submitRating')}</span>
                                          )}
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRatingStates((prev) => ({
                                          ...prev,
                                          [pastOrder.id]: {
                                            rating: 5,
                                            feedback: '',
                                            isSubmitted: false,
                                            isEditing: true,
                                          },
                                        }));
                                      }}
                                      className="w-full py-2 bg-[#E5B453]/10 hover:bg-[#E5B453]/20 border border-[#E5B453]/20 text-[#E5B453] rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Star size={12} className="fill-current animate-pulse" />
                                      <span>{t('rateOrderBtn')}</span>
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* Best Sellers Inside Tabs Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h6 className="text-xs font-black text-[#E5B453] flex items-center gap-1.5 uppercase tracking-wider">
                    <Flame size={14} className="text-[#E5B453] fill-amber-500 shrink-0" />
                    <span>{t('bestSellersTab')}</span>
                  </h6>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const isVisibleItem = (item) => {
                      const cat = categories.find((c) => c.id === item.category);
                      return !cat || cat.showOnCustomerPage !== false;
                    };
                    let popularItems = popularItemIds
                      .map((id) => displayedMenuItems.find((item) => item.id === id))
                      .filter(
                        (item): item is (typeof displayedMenuItems)[0] =>
                          !!item && isVisibleItem(item),
                      );
                    if (popularItems.length === 0) {
                      popularItems = displayedMenuItems.filter(isVisibleItem).slice(0, 4);
                    }

                    const badges = {
                      zh: ['🔥 點食率最高', '🌟 鎮店招牌', '👍 大受好評', '🍺 宵夜首選'],
                      en: [
                        '🔥 Top Choice',
                        '🌟 Chef Special',
                        '👍 Highly Rated',
                        '🍺 Midnight Best',
                      ],
                      ja: ['🔥 一番人気', '🌟 看板メニュー', '👍 大好評', '🍺 夜食定番'],
                      ko: ['🔥 최고 인기', '🌟 시그니처', '👍 극찬 요리', '🍺 야식 추천'],
                      th: ['🔥 เมนูฮิต', '🌟 จานเด็ด', '👍 แนะนำ', '🍺 ยอดนิยม'],
                    };

                    return popularItems.map((item, idx) => {
                      const badgeText = badges[currentLang]
                        ? badges[currentLang][idx % 4]
                        : badges['zh'][idx % 4];
                      return (
                        <div
                          key={item.id}
                          className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden shadow-md hover:border-[#E5B453]/50 transition duration-300 flex flex-row items-stretch text-left relative group hover:scale-[1.02] active:scale-[1.01]"
                        >
                          <div
                            onClick={() => {
                              if (item.available) setSelectedDetailItem(item);
                            }}
                            className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative bg-zinc-950 border-r border-[#E5B453]/10 overflow-hidden cursor-pointer"
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={getLocalizedText(item.name, currentLang) || 'dish'}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                                <span className="text-xl">🍲</span>
                              </div>
                            )}
                            <span className="absolute top-1 left-1 bg-black/75 backdrop-blur-xs text-[#E5B453] text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm border border-[#E5B453]/15">
                              {badgeText}
                            </span>
                          </div>

                          <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
                            <div className="space-y-1">
                              <h6
                                onClick={() => {
                                  if (item.available) setSelectedDetailItem(item);
                                }}
                                className="font-bold text-white text-xs sm:text-sm hover:text-[#E5B453] cursor-pointer transition truncate flex items-center gap-1"
                              >
                                <Flame
                                  size={12}
                                  className="text-[#E5B453] fill-amber-500 shrink-0"
                                />
                                <span>{getLocalizedText(item.name, currentLang) || ''}</span>
                              </h6>
                              <div className="flex items-center gap-1.5 py-0.5">
                                <span className="bg-amber-500/10 text-[#E5B453] text-[9px] px-1.5 py-0.5 rounded border border-[#E5B453]/20 font-sans font-black select-none">
                                  📈{' '}
                                  {idx === 0
                                    ? '98%'
                                    : idx === 1
                                      ? '94%'
                                      : idx === 2
                                        ? '91%'
                                        : '88%'}{' '}
                                  {currentLang === 'vi' ? 'Tỷ lệ đặt' : '點購率 (Order Rate)'}
                                </span>
                              </div>
                              <p className="text-white/45 text-[9px] sm:text-xs leading-snug line-clamp-1">
                                {getLocalizedText(item.description, currentLang)}
                              </p>
                            </div>
                            <div className="flex items-center text-white/30 text-[9px]">
                              <Clock size={9} className="mr-0.5 text-white/30" />
                              <span>約 10-15 分鐘</span>
                            </div>
                          </div>

                          <div className="w-20 sm:w-24 flex-shrink-0 p-2 border-l border-white/5 flex flex-col items-center justify-center bg-white/2 gap-1 pb-1">
                            <span className="text-[#E5B453] text-[11px] sm:text-xs font-black font-sans leading-none mb-1">
                              NT$ {item.price}
                            </span>

                            <div className="flex flex-col gap-1 w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.available) setSelectedDetailItem(item);
                                }}
                                className="w-full py-0.5 bg-white/5 hover:bg-white/10 text-white/80 font-black text-[9px] sm:text-[10px] rounded border border-white/10 cursor-pointer transition active:scale-95 text-center"
                              >
                                {isStoreCurrentlyOpen ? '詳情' : '瀏覽'}
                              </button>
                              {isStoreCurrentlyOpen && item.available && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAddToCart(item);
                                  }}
                                  className="w-full py-1 bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] font-black text-[9px] sm:text-[10px] rounded cursor-pointer transition active:scale-95 shadow-md shadow-[#E5B453]/10 text-center"
                                >
                                  點餐
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Normal Best Sellers when isOrderHistoryVisible is false (e.g., Guest Browsing Mode) */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-white flex items-center space-x-1.5 font-serif tracking-wide text-sm sm:text-base">
                <Sparkles size={16} className="text-[#E5B453]" />
                <span>{t('todayBestSellersHeader')}</span>
              </h5>
              <span className="text-xs text-[#E5B453] bg-[#E5B453]/10 border border-[#E5B453]/20 px-2 py-0.5 rounded font-bold animate-pulse">
                HOT 🔥
              </span>
            </div>

            <p className="text-xs text-white/50">{t('todayBestSellersDesc')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const isVisibleItem = (item) => {
                  const cat = categories.find((c) => c.id === item.category);
                  return !cat || cat.showOnCustomerPage !== false;
                };
                let popularItems = popularItemIds
                  .map((id) => displayedMenuItems.find((item) => item.id === id))
                  .filter(
                    (item): item is (typeof displayedMenuItems)[0] => !!item && isVisibleItem(item),
                  );
                if (popularItems.length === 0) {
                  popularItems = displayedMenuItems.filter(isVisibleItem).slice(0, 4);
                }

                const badges = {
                  zh: ['🔥 點食率最高', '🌟 鎮店招牌', '👍 大受好評', '🍺 宵夜首選'],
                  en: ['🔥 Top Choice', '🌟 Chef Special', '👍 Highly Rated', '🍺 Midnight Best'],
                  ja: ['🔥 一番人気', '🌟 看板メニュー', '👍 大好評', '🍺 夜食定番'],
                  ko: ['🔥 최고 인기', '🌟 시그니처', '👍 극찬 요리', '🍺 야식 추천'],
                  th: ['🔥 เมนูฮิต', '🌟 จานเด็ด', '👍 แนะนำ', '🍺 ยอดนิยม'],
                  vi: [
                    '🔥 Yêu thích nhất',
                    '🌟 Đặc sản của quán',
                    '👍 Đánh giá cao',
                    '🍺 Đồ nhắm đêm tuyệt vời',
                  ],
                };

                return popularItems.map((item, idx) => {
                  const badgeText = badges[currentLang]
                    ? badges[currentLang][idx % 4]
                    : badges['zh'][idx % 4];
                  return (
                    <div
                      key={item.id}
                      className="bg-[#161616] border border-white/5 rounded-2xl p-3.5 flex flex-col md:flex-row gap-3 shadow-md hover:border-[#E5B453]/50 transition group hover:scale-[1.02] active:scale-[1.01] duration-300"
                    >
                      <div
                        onClick={() => setSelectedDetailItem(item)}
                        className="w-full md:w-28 h-28 rounded-xl overflow-hidden relative shrink-0 cursor-pointer bg-neutral-950"
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={getLocalizedText(item.name, currentLang) || 'dish'}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                            <span className="text-3xl">🍲</span>
                          </div>
                        )}
                        <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm text-[#E5B453] text-[9px] font-black px-2 py-0.5 rounded-full border border-[#E5B453]/20">
                          {badgeText}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col justify-between text-left space-y-2">
                        <div className="space-y-1">
                          <h6
                            onClick={() => setSelectedDetailItem(item)}
                            className="font-bold text-white text-sm hover:text-[#E5B453] cursor-pointer transition line-clamp-1 flex items-center gap-1"
                          >
                            <Flame size={14} className="text-[#E5B453] fill-amber-500 shrink-0" />
                            <span>{getLocalizedText(item.name, currentLang) || ''}</span>
                          </h6>
                          <div className="flex items-center gap-1.5 py-0.5">
                            <span className="bg-amber-500/10 text-[#E5B453] text-[9px] px-1.5 py-0.5 rounded border border-[#E5B453]/20 font-sans font-black select-none">
                              📈 {idx === 0 ? '98%' : idx === 1 ? '94%' : idx === 2 ? '91%' : '88%'}{' '}
                              點購率 (Order Rate)
                            </span>
                          </div>
                          <p className="text-[11px] text-white/50 line-clamp-2 md:line-clamp-1">
                            {getLocalizedText(item.description, currentLang)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-bold text-[#E5B453] font-mono">
                            NT$ {item.price}
                          </span>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailItem(item)}
                              className="bg-white/5 hover:bg-white/10 text-white/80 font-black text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition active:scale-95 border border-white/10"
                            >
                              {isStoreCurrentlyOpen ? t('detailsOrAdjust') : t('clickToBrowse')}
                            </button>
                            {isStoreCurrentlyOpen && (
                              <button
                                type="button"
                                onClick={() => handleQuickAddToCart(item)}
                                className="bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] font-black text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition active:scale-95 shadow-md shadow-[#E5B453]/10"
                              >
                                {t('quickAddCart')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
      {/* Lightbox component for full-screen adaptive photo zoom scaling */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 transition-all duration-300 animate-fade-in"
          onClick={() => setActiveLightboxImg(null)}
          style={{ contentVisibility: 'auto' }}
        >
          {/* Top Info Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-50 text-white font-sans pointer-events-none">
            <div className="bg-black/60 px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-1.5 border border-white/5 shadow-lg">
              <span>🖼️ 智能自適應視窗縮放 (Auto-Scaled View)</span>
            </div>
            <button
              onClick={() => setActiveLightboxImg(null)}
              className="pointer-events-auto bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-1.5 rounded-full text-xs font-black shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              ✕ 關閉 Close
            </button>
          </div>

          {/* Centered Image Container */}
          <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
            <img
              src={activeLightboxImg}
              alt="Dish Auto Scaled View"
              className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain rounded-2xl shadow-2xl border-4 border-white/10"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Bottom Info text */}
          <p className="text-zinc-400 text-[11px] font-sans mt-4 text-center select-none bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs border border-white/5">
            💡
            本照片已自動進行向量與點陣雙重高畫質等比例縮放，完美適應您目前的螢幕尺寸及視窗解析度。
          </p>
        </div>
      )}

      {/* 📅 預約訂位點餐 懸浮視窗 Modal */}
      {showReservationModal && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 text-xs font-sans animate-fade-in"
          onClick={() => setShowReservationModal(false)}
        >
          <div
            className="bg-[#121212] border border-amber-500/30 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 pb-4 border-b border-white/10 flex-shrink-0 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-zinc-900 to-black">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="font-black text-base text-amber-400 font-serif tracking-wide">
                    📅 餐廳預約訂位與客席保留
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    填寫線上預約資料，直通櫃檯「餐廳預約訂位與客席保留管理系統」
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReservationModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center font-mono text-base transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleReservationSubmit}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {resFeedback && (
                  <div
                    className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
                      resFeedback.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {resFeedback.type === 'success' ? (
                      <Check size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                    <span>{resFeedback.msg}</span>
                  </div>
                )}

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Customer Name */}
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-bold text-xs flex items-center gap-1">
                        <span>👤 顧客姓名 Customer Name *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={resCustomerName}
                        onChange={(e) => setResCustomerName(e.target.value)}
                        placeholder="例如：王小明 先生/小姐"
                        className="w-full bg-[#1c1c1c] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none font-medium transition"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-bold text-xs flex items-center justify-between">
                        <span>📞 連絡電話 Phone *</span>
                        {resPhoneError && (
                          <span className="text-[10px] text-rose-400 font-bold">
                            格式不符合長度或規則
                          </span>
                        )}
                      </label>
                      <input
                        type="tel"
                        required
                        value={resPhone}
                        onChange={(e) => {
                          setResPhone(e.target.value);
                          if (resPhoneError) setResPhoneError(false);
                        }}
                        placeholder="例如：0912-345-678 或 02-2345-6789"
                        className={`w-full bg-[#1c1c1c] border ${
                          resPhoneError
                            ? 'border-rose-500 focus:border-rose-400'
                            : 'border-white/15 focus:border-amber-400'
                        } rounded-xl px-3 py-2 text-white outline-none font-medium transition font-mono`}
                      />
                      <span className="text-[10px] text-zinc-400 block leading-tight">
                        手機需 10 位 (09xx) / 市話需 9~10 位 (02~08)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Date */}
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-bold text-xs flex items-center justify-between">
                        <span>📆 預定日期 Date *</span>
                        {resDate && resDate > maxNinetyDaysDateStr && (
                          <span className="text-[10px] text-rose-500 font-bold">最多提前90天</span>
                        )}
                      </label>
                      <input
                        type="date"
                        required
                        min={todayDateStr}
                        max={maxNinetyDaysDateStr}
                        value={resDate}
                        onChange={handleResDateChange}
                        className={`w-full bg-[#1c1c1c] border ${resDate && resDate > maxNinetyDaysDateStr ? 'border-rose-500 text-rose-500 focus:border-rose-400' : 'border-white/15 focus:border-amber-400 text-white'} rounded-xl px-3 py-2 outline-none font-mono transition`}
                      />
                    </div>

                    {/* Time */}
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-bold text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1">⏰ 預訂時間 Time *</span>
                        {!isResTimeValid && (
                          <span className="text-[10px] text-rose-500 font-bold">
                            無有效時段 / 公休日
                          </span>
                        )}
                      </label>
                      <select
                        required
                        value={resTime}
                        onChange={(e) => setResTime(e.target.value)}
                        disabled={!resDate || (restDays && restDays.includes(resDate))}
                        className={`w-full bg-[#1c1c1c] border ${
                          !isResTimeValid
                            ? 'border-rose-500 focus:border-rose-400 text-rose-500'
                            : 'border-white/15 focus:border-amber-400 text-white'
                        } rounded-xl px-3 py-2 outline-none font-mono transition`}
                      >
                        {!resDate || (restDays && restDays.includes(resDate)) ? (
                          <option value="">-- 請先選擇有效的預定日期 --</option>
                        ) : (
                          generateCandidateSlots(resDate).map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Guest Count */}
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-bold text-xs flex items-center gap-1">
                        <span>👥 用餐人數 Guest Count *</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        required
                        value={resGuests}
                        onChange={(e) => setResGuests(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#1c1c1c] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none font-mono transition"
                      />
                    </div>

                    {/* Table Selection */}
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-bold text-xs flex items-center gap-1">
                        <span>🪑 指定預約桌號 Designated Table *</span>
                      </label>
                      <div className="w-full bg-[#1c1c1c] border border-white/15 rounded-xl p-2 text-white max-h-32 overflow-y-auto space-y-1">
                        {(() => {
                          const currentSelectedCapacity = tables
                            .filter((t) => resTableNumbers.includes(t.id))
                            .reduce((sum, t) => sum + (t.maxCapacity || 0), 0);

                          return tables.map((t) => {
                            const isChecked = resTableNumbers.includes(t.id);
                            const isDisabled = !isChecked && currentSelectedCapacity >= resGuests;

                            return (
                              <label
                                key={t.id}
                                className={`flex items-center gap-2 p-1 rounded transition-opacity ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={(e) => {
                                    setIsManualTableSelection(true);
                                    if (e.target.checked) {
                                      setResTableNumbers((prev) => [...prev, t.id]);
                                    } else {
                                      setResTableNumbers((prev) =>
                                        prev.filter((id) => id !== t.id),
                                      );
                                    }
                                  }}
                                  className="accent-amber-500"
                                />
                                <span className="text-xs">
                                  {t.id} 號桌位 {t.maxCapacity ? `(上限 ${t.maxCapacity}人)` : ''}
                                  <span className="text-zinc-400 ml-1 text-[10px]">
                                    (現狀:{' '}
                                    {t.status === 'preserved'
                                      ? '保留中'
                                      : t.status === 'in_use'
                                        ? '用餐中'
                                        : '空閒'}
                                    )
                                  </span>
                                </span>
                              </label>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Special Notes */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold text-xs flex items-center gap-1">
                      <span>📝 備註與特別需求 Notes (選填)</span>
                    </label>
                    <textarea
                      value={resNotes}
                      onChange={(e) => setResNotes(e.target.value)}
                      placeholder="如需兒童椅子、慶生特別佈置、不辣需求等..."
                      rows={2}
                      className="w-full bg-[#1c1c1c] border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none resize-none transition"
                    />
                  </div>

                  {/* ⏱️ 3-Hour Reservation Duration & Availability Warning Banner */}
                  <div className="pt-2 space-y-2">
                    {/* Default Notice */}
                    <div className="p-2.5 bg-black/40 border border-white/10 rounded-xl text-[11px] text-zinc-400 flex items-center justify-between">
                      <span>
                        💡 預約用餐時間默認為 <strong className="text-amber-300">3 小時</strong>
                        ，3小時內該座位不開放其他顧客預約。
                      </span>
                      <span className="font-mono text-zinc-500 text-[10px]">180 mins</span>
                    </div>

                    {/* FULLY BOOKED Banner */}
                    {reservationAvailabilityInfo.isFullyBooked ? (
                      <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-2xl space-y-2 text-left animate-fadeIn">
                        <div className="flex items-center gap-2 text-rose-300 font-extrabold text-xs">
                          <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                          <span>⚠️ 該時段已額滿 (This time slot is fully booked)</span>
                        </div>
                        <p className="text-[11px] text-rose-200/90 leading-relaxed">
                          您選擇的{' '}
                          <strong className="text-white font-mono">
                            {resDate} {resTime}
                          </strong>{' '}
                          (含前後 3 小時用餐時間)，本店所有客席皆已被預約滿額。
                        </p>

                        {/* Suggested Alternative Time Slots */}
                        {reservationAvailabilityInfo.suggestedTimes.length > 0 ? (
                          <div className="pt-2 border-t border-rose-500/20 space-y-1.5">
                            <span className="text-[11px] text-amber-300 font-bold block">
                              💡 為您建議當日其他可預約時段 (點擊即可自動切換):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {reservationAvailabilityInfo.suggestedTimes.map((item) => (
                                <button
                                  key={item.time}
                                  type="button"
                                  onClick={() => {
                                    setResTime(item.time);
                                    if (item.firstFreeTableId)
                                      setResTableNumbers([item.firstFreeTableId]);
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-xs font-mono font-extrabold transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-sm"
                                >
                                  <span>⏰ {item.time}</span>
                                  <span className="text-[10px] opacity-80">
                                    ({item.freeCount}桌空位)
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-300/80 italic pt-1">
                            當日熱門時段客席較滿，您可以嘗試選擇其他日期預約！
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Normal Available status */
                      <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 flex items-center gap-1.5">
                        <Check size={14} className="text-emerald-400" />
                        <span>
                          所選時段 ({resTime}) 尚有{' '}
                          <strong className="font-mono text-emerald-200">
                            {reservationAvailabilityInfo.availableTables.length}
                          </strong>{' '}
                          個客席可供順暢預約！
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-zinc-950 flex justify-end items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReservationModal(false)}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition cursor-pointer"
                >
                  取消 Cancel
                </button>
                <button
                  type="submit"
                  disabled={resSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#E5B453] to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl transition cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                >
                  {resSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>處理中...</span>
                    </>
                  ) : (
                    <span>確認送出預約並點餐</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🎒 Takeout Form Modal */}
      {showTakeoutFormModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#121824] border border-blue-500/25 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-blue-500/20 bg-black/20 shrink-0">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span className="text-xl">🥡</span> 外帶訂單資料填寫
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                為了提供您最好的餐點品質，請留下聯絡資訊與預計取餐時間。
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!takeoutCustomerName || !takeoutPhone || !takeoutPickupTime) {
                  return;
                }
                setShowTakeoutFormModal(false);
                handleCheckout(true);
              }}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* 顧客姓名 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-300 block">
                    顧客姓名 Customer Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={takeoutCustomerName}
                    onChange={(e) => setTakeoutCustomerName(e.target.value)}
                    placeholder="請輸入您的姓名 (Name)"
                    className="w-full bg-black/40 border border-blue-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  {lineProfile && (
                    <p className="text-[10px] text-zinc-500">已為您自動帶入 Google 帳戶名稱</p>
                  )}
                </div>

                {/* 聯絡電話 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-300 block">
                    聯絡電話 Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={takeoutPhone}
                    onChange={(e) => setTakeoutPhone(e.target.value)}
                    placeholder="例如: 0912345678"
                    className="w-full bg-black/40 border border-blue-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
                  />
                </div>

                {/* 預計取餐時間 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-blue-300 block">
                    預計取餐時間 Pickup Time <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={takeoutPickupTime}
                    onChange={(e) => setTakeoutPickupTime(e.target.value)}
                    className="w-full bg-black/40 border border-blue-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
                  />
                  <p className="text-[10px] text-amber-300/80 italic mt-1">
                    ※ 餐點製作約需 20~30 分鐘，敬請稍候。
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-zinc-950 flex justify-end items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTakeoutFormModal(false)}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition cursor-pointer text-xs"
                >
                  返回修改訂單
                </button>
                <button
                  type="submit"
                  disabled={isCheckoutSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2 text-xs"
                >
                  {isCheckoutSubmitting ? '傳送中...' : '確認並送出訂單'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom elegant non-blocking Toast/Popup notification */}
      {customToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] max-w-sm w-[90%] sm:w-full px-4 pointer-events-none animate-bounce-in">
          <div
            className={`p-4 rounded-2xl shadow-2xl flex items-start space-x-3 border pointer-events-auto backdrop-blur-md transition-all duration-300 ${
              customToast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-300 shadow-emerald-950/30'
                : customToast.type === 'error'
                  ? 'bg-rose-950/95 border-rose-500/30 text-rose-300 shadow-rose-950/30'
                  : 'bg-zinc-900/95 border-amber-500/30 text-amber-300 shadow-amber-950/30'
            }`}
          >
            <span className="text-base select-none">
              {customToast.type === 'success' ? '🎉' : customToast.type === 'error' ? '❌' : '💡'}
            </span>
            <div className="flex-1 text-xs font-bold leading-relaxed">{customToast.message}</div>
            <button
              type="button"
              onClick={() => setCustomToast(null)}
              className="text-white/40 hover:text-white/80 transition cursor-pointer select-none text-[10px] pl-1 font-mono"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
