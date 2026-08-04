import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  Order,
  OrderStatus,
  Language,
  TableConfig,
  MenuItem,
  Category,
  Ingredient,
  Reservation,
} from '../types';
import { getLocalizedText } from '../utils/i18n';
import { TRANSLATIONS } from '../data';
import { safeStorage } from '../lib/safeStorage';
import {
  ChefHat,
  Printer,
  Trash2,
  Check,
  Ban,
  RefreshCw,
  Volume2,
  Wifi,
  Edit,
  Settings,
  X,
  Clock,
  AlertTriangle,
  Mic,
  Flag,
  Eye,
  Search,
  Timer,
  Download,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

import { KdsHourlyChart } from './KdsHourlyChart';
import { useRetry } from '../hooks/useRetry';
import { InlineRetryMessage } from './InlineRetryMessage';

interface KitchenDisplaySystemProps {
  currentLang: Language;
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  printLogs: any[];
  onClearPrintLogs: () => Promise<void>;
  printerIp: string;
  onUpdatePrinterIp: (ip: string) => Promise<{ success: boolean; error?: string }>;
  onPrintTestPage: (
    target?: 'kitchen' | 'bill' | 'all',
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateTableNumber?: (
    orderId: string,
    tableNumber: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateQuickNotes?: (
    orderId: string,
    quickNotes: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onToggleOrderFlag?: (
    orderId: string,
    isFlagged: boolean,
    flagReason: string,
  ) => Promise<{ success: boolean; error?: string }>;
  tables?: TableConfig[];
  menuItems?: MenuItem[];
  categories?: Category[];
  onToggleMenuItemAvailability?: (id: string) => Promise<void>;
  ingredients?: Ingredient[];
  onAdjustIngredientStock?: (
    ingredientId: string,
    quantityChanged: number,
    note: string,
  ) => Promise<void>;
  operatingHours?: any[];
  servicePaused?: boolean;
  onToggleServicePause?: (paused: boolean) => Promise<void>;

  reservations?: Reservation[];
}

export const KitchenDisplaySystem: React.FC<KitchenDisplaySystemProps> = ({
  currentLang,
  orders,
  onUpdateOrderStatus,
  printLogs,
  onClearPrintLogs,
  printerIp,
  onUpdatePrinterIp,
  onPrintTestPage,
  onUpdateTableNumber,
  onUpdateQuickNotes,
  onToggleOrderFlag,
  tables = [],
  menuItems = [],
  categories = [],
  onToggleMenuItemAvailability,
  ingredients = [],
  onAdjustIngredientStock,
  operatingHours = [],
  servicePaused = false,
  onToggleServicePause,

  reservations = [],
}) => {
  // Translation helper
  const t = (key: string): string => {
    return TRANSLATIONS[key]?.[currentLang] || TRANSLATIONS[key]?.zh || key;
  };

  const [filterStatus, setFilterStatus] = useState<'all' | 'active'>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isMergedView, setIsMergedView] = useState<boolean>(false);
  const [beepSim, setBeepSim] = useState(false);

  // 👥 KDS 登錄角色 State ('kitchen' 廚房 vs 'staff' 店員)
  const [kdsRole, setKdsRole] = useState<'kitchen' | 'staff'>(() => {
    try {
      const saved = safeStorage.getItem('kds-login-role');
      return saved === 'staff' ? 'staff' : 'kitchen';
    } catch {
      return 'kitchen';
    }
  });

  const handleRoleSwitch = (newRole: 'kitchen' | 'staff') => {
    setKdsRole(newRole);
    try {
      safeStorage.setItem('kds-login-role', newRole);
    } catch (e) {
      console.error(e);
    }
  };

  // 🖐️ Touch & Mouse Swipe States for active cards completion (Swipe-to-Complete)
  const [dragStates, setDragStates] = useState<{
    [orderId: string]: { startX: number; currentX: number; isDragging: boolean };
  }>({});

  const handleCardTouchStart = (orderId: string, clientX: number) => {
    setDragStates((prev) => ({
      ...prev,
      [orderId]: { startX: clientX, currentX: clientX, isDragging: true },
    }));
  };

  const handleCardTouchMove = (orderId: string, clientX: number) => {
    setDragStates((prev) => {
      const drag = prev[orderId];
      if (!drag || !drag.isDragging) return prev;
      return {
        ...prev,
        [orderId]: { ...drag, currentX: clientX },
      };
    });
  };

  const handleCardTouchEnd = (orderId: string) => {
    setDragStates((prev) => {
      const drag = prev[orderId];
      if (!drag || !drag.isDragging) return prev;

      const offset = Math.max(0, drag.currentX - drag.startX);
      if (offset >= 150) {
        // Mark as completed
        handleStatusChange(orderId, 'completed');
      }

      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  const [activeChartTab, setActiveChartTab] = useState<'current' | 'predictive'>('current');

  // Real-time stock / menu controls state
  const [kdsSelectedCategory, setKdsSelectedCategory] = useState<string>('all');
  const [kdsMenuSearch, setKdsMenuSearch] = useState<string>('');

  // 📝 訂單摺疊狀態
  const [collapsedOrders, setCollapsedOrders] = useState<Set<string>>(new Set());
  const toggleOrderCollapse = (orderId: string) => {
    setCollapsedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };
  const [kdsActiveTab, setKdsActiveTab] = useState<'menu' | 'ingredients'>('menu');
  const [togglingMenuId, setTogglingMenuId] = useState<string | null>(null);
  const [adjustingIngredientId, setAdjustingIngredientId] = useState<string | null>(null);
  const [ingredientManualQty, setIngredientManualQty] = useState<{ [key: string]: string }>({});

  // Table number editing in KDS modal state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingTableValue, setEditingTableValue] = useState<string>('');

  // Printer configuration states
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [ipInput, setIpInput] = useState(printerIp);
  const [testLoading, setTestLoading] = useState(false);
  const [printerSuccess, setPrinterSuccess] = useState<string | null>(null);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [printConfirmData, setPrintConfirmData] = useState<{
    title: string;
    ip: string;
    onConfirm: () => void;
    receiptType?: string;
    receiptBody?: string;
  } | null>(null);

  // Voice/Speech Dictation States
  const [dictatingOrderId, setDictatingOrderId] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [dictatedText, setDictatedText] = useState<string>('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [speechRecInstance, setSpeechRecInstance] = useState<any>(null);

  // 🔊 語音合成與 Web Audio 提示音服務 (TTS & Web Audio Notification Manager)
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem('kds-tts-enabled');
      return saved !== 'false'; // Default to true so fresh Firebase hosting sessions get audio alerts
    } catch {
      return true;
    }
  });

  const [audioNeedsUnlock, setAudioNeedsUnlock] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cachedVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Get or initialize AudioContext
  const getAudioContext = (): AudioContext | null => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    return audioCtxRef.current;
  };

  // Play Web Audio Chime Sound (Kitchen Order Bell / Alert)
  const playOrderChimeSound = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      // Tone 1: A5 (880 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: D6 (1174.66 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.15);
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('[Web Audio Chime Error]', e);
    }
  };

  // Play single tone status change beep
  const playStatusBeepSound = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('[Web Audio Status Beep Error]', e);
    }
  };

  // Unlock AudioContext and pre-warm SpeechSynthesis on user gesture
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            setAudioNeedsUnlock(false);
          })
          .catch(() => {});
      } else if (ctx && ctx.state === 'running') {
        setAudioNeedsUnlock(false);
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('[Audio Unlock Error]', e);
    }
  };

  // Auto-listen for user gesture to unlock audio & pre-load voices
  useEffect(() => {
    const handleUserGesture = () => {
      unlockAudio();
    };

    window.addEventListener('pointerdown', handleUserGesture, { once: false });
    window.addEventListener('click', handleUserGesture, { once: false });
    window.addEventListener('keydown', handleUserGesture, { once: false });

    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          cachedVoicesRef.current = window.speechSynthesis.getVoices();
        } catch {}
      };
      loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  // 🆙 KDS 自動滾動置頂輔助 (KDS Auto-Scroll to Top Service for new incoming orders)
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem('kds-autoscroll-enabled');
      return saved !== 'false'; // default to true if not specified
    } catch {
      return true;
    }
  });

  // 🧹 舊已完成訂單隱藏輔助 (Hide completed orders > 30 minutes threshold)
  const [hideOlderCompleted, setHideOlderCompleted] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem('kds-hide-completed-30m');
      return saved === 'true'; // default to false
    } catch {
      return false;
    }
  });

  const kdsHeaderRef = useRef<HTMLDivElement>(null);

  const scrollToHeaderTop = () => {
    if (kdsHeaderRef.current) {
      kdsHeaderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef<boolean>(true);

  const speak = (text: string) => {
    // 1. Play Web Audio synthesizer chime sound
    playOrderChimeSound();

    // 2. Speech synthesis readout
    if (!('speechSynthesis' in window)) return;
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';

      const voices =
        cachedVoicesRef.current.length > 0
          ? cachedVoicesRef.current
          : window.speechSynthesis.getVoices();

      const zhVoice = voices.find((v) => {
        const lang = v.lang.toLowerCase();
        return (
          lang.includes('zh-tw') ||
          lang.includes('zh_tw') ||
          lang.includes('cmn-hant') ||
          lang.includes('zh-hk') ||
          lang.includes('zh-cn') ||
          lang.includes('zh_cn') ||
          lang.includes('zh') ||
          lang.includes('zho') ||
          lang.includes('cmn') ||
          lang.includes('chn')
        );
      });

      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      activeUtteranceRef.current = utterance;
      utterance.onend = () => {
        activeUtteranceRef.current = null;
      };
      utterance.onerror = (err) => {
        console.warn('[SpeechSynthesis Utterance Error]', err);
        activeUtteranceRef.current = null;
      };

      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    } catch (e) {
      console.error('[TTS Speech Synthesis Error]', e);
    }
  };

  const handleToggleTts = () => {
    const nextVal = !ttsEnabled;
    setTtsEnabled(nextVal);
    try {
      safeStorage.setItem('kds-tts-enabled', String(nextVal));
    } catch (e) {
      console.error(e);
    }
    unlockAudio();
    if (nextVal) {
      speak('語音合成廣播已開啟，收到新訂單時將自動朗讀');
    } else {
      speak('語音合成廣播已關閉');
    }
  };

  // 🔔 廚房 KDS 新訂單未接單持續語音廣播與自動頂置 (Continuous Looping Voice Alert & Auto-Scroll until "確認接單" clicked)
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    // Track initial mount so we don't auto-scroll on page reload
    if (isInitialMountRef.current) {
      orders.forEach((o) => seenOrderIdsRef.current.add(o.id));
      isInitialMountRef.current = false;
    } else {
      const brandNewOrders = orders.filter((o) => !seenOrderIdsRef.current.has(o.id));
      if (brandNewOrders.length > 0) {
        brandNewOrders.forEach((o) => seenOrderIdsRef.current.add(o.id));
        if (autoScrollEnabled) {
          setTimeout(() => {
            scrollToHeaderTop();
          }, 150);
        }
      }
    }

    const pendingOrders = orders.filter((o) => o.status === 'pending');
    if (pendingOrders.length === 0) {
      if (
        'speechSynthesis' in window &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
      ) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const announcePendingOrders = () => {
      const currentPending = orders.filter((o) => o.status === 'pending');
      if (currentPending.length === 0) return;

      const tableListStr = currentPending
        .map((o) => {
          const tStr = o.tableNumber;
          if (
            !tStr ||
            tStr.trim() === '' ||
            tStr.toLowerCase() === 'takeout' ||
            tStr.toLowerCase() === '外帶'
          ) {
            return '外帶';
          }
          return `${tStr}桌`;
        })
        .join('、');

      const messageText =
        currentPending.length === 1
          ? `新訂單待確認，${tableListStr}，請確認接單！`
          : `您有 ${currentPending.length} 筆新訂單待確認，包含 ${tableListStr}，請確認接單！`;

      if (ttsEnabled) {
        speak(messageText);
      } else {
        playOrderChimeSound();
      }
    };

    // Broadcast immediately when pending orders exist
    announcePendingOrders();

    // Continuously loop broadcast every 5.5 seconds until all pending orders are accepted
    const broadcastTimer = setInterval(() => {
      announcePendingOrders();
    }, 5500);

    return () => {
      clearInterval(broadcastTimer);
      if (
        'speechSynthesis' in window &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [
    orders
      .filter((o) => o.status === 'pending')
      .map((o) => `${o.id}:${o.status}`)
      .join(','),
    ttsEnabled,
    autoScrollEnabled,
  ]);

  // Special Attention Flag States
  const [flaggingOrderId, setFlaggingOrderId] = useState<string | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState<string>('');
  const [flagError, setFlagError] = useState<string | null>(null);

  // Quick View Modal state
  const [quickViewOrder, setQuickViewOrder] = useState<Order | null>(null);

  // Keep quickViewOrder in sync with the live orders list
  useEffect(() => {
    if (quickViewOrder) {
      const liveOrder = orders.find((o) => o.id === quickViewOrder.id);
      if (liveOrder) {
        setQuickViewOrder(liveOrder);
      }
    }
  }, [orders, quickViewOrder?.id]);

  // Search state for active orders filtering (ID or table number)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Printer real-time health indicator state
  const { run: pingRun } = useRetry(
    async () => {
      const res = await apiFetch(`/api/printer/ping?ip=${encodeURIComponent(printerIp)}`);
      if (!res.ok) throw new Error('HTTP error ' + res.status);
      const data = await res.json();
      if (!data.reachable) throw new Error(data.error || 'Printer unreachable');
      return data;
    },
    5,
    500,
  );

  const [pingState, setPingState] = useState<{
    reachable: boolean | null;
    error: string | null;
    loading: boolean;
    lastChecked: string | null;
    skipped: boolean;
  }>({
    reachable: null,
    error: null,
    loading: false,
    lastChecked: null,
    skipped: false,
  });

  const triggerPrinterPing = async (targetIp?: string) => {
    setPingState((prev) => ({ ...prev, loading: true, error: null }));
    const result = await pingRun();
    if (result.result) {
      setPingState({
        reachable: true,
        error: null,
        loading: false,
        lastChecked: new Date().toLocaleTimeString(),
        skipped: false,
      });
    } else if (result.error) {
      setPingState({
        reachable: false,
        error: result.error.message || String(result.error),
        loading: false,
        lastChecked: new Date().toLocaleTimeString(),
        skipped: false,
      });
    } else if (result.skipped) {
      setPingState((prev) => ({ ...prev, skipped: true, loading: false }));
    }
  };

  const handleRetryPing = () => {
    triggerPrinterPing(printerIp);
  };

  const handleSkipPing = () => {
    setPingState((prev) => ({ ...prev, skipped: true }));
  };

  useEffect(() => {
    triggerPrinterPing(printerIp);

    // Auto-ping every 10 seconds
    const interval = setInterval(() => {
      triggerPrinterPing(printerIp);
    }, 10000);

    return () => clearInterval(interval);
  }, [printerIp]);

  useEffect(() => {
    setIpInput(printerIp);
  }, [printerIp]);

  const checkReservationOrderHoldStatus = (order: Order) => {
    if (!order.reservationDate && !order.reservationNo) {
      return { isHold: false, reason: '' };
    }

    const resDateStr = order.reservationDate || '';
    if (!resDateStr) return { isHold: false, reason: '' };

    const dObj = new Date();
    const utcTime = dObj.getTime() + dObj.getTimezoneOffset() * 60000;
    const localDate = new Date(utcTime + 3600000 * 8);
    const yr = localDate.getFullYear();
    const mo = String(localDate.getMonth() + 1).padStart(2, '0');
    const dy = String(localDate.getDate()).padStart(2, '0');
    const todayTaiwanDateStr = `${yr}-${mo}-${dy}`;

    if (todayTaiwanDateStr < resDateStr) {
      return {
        isHold: true,
        reason: `預約日期為 ${resDateStr}，尚未到達預約日期（廚房保留狀態）`,
      };
    }

    if (todayTaiwanDateStr === resDateStr) {
      const activeSlots = (operatingHours || []).filter((s: any) => s && s.isActive);
      if (activeSlots && activeSlots.length > 0) {
        const dayOfWeek = localDate.getDay();
        const currentTotalMins = localDate.getHours() * 60 + localDate.getMinutes();

        let earliestStartMins = 24 * 60;
        let earliestStartText = '';

        for (const slot of activeSlots) {
          if (slot.days && Array.isArray(slot.days) && !slot.days.includes(dayOfWeek)) {
            continue;
          }
          const [startH, startM] = (slot.start || '00:00').split(':').map(Number);
          const startTotal = (startH || 0) * 60 + (startM || 0);
          if (startTotal < earliestStartMins) {
            earliestStartMins = startTotal;
            earliestStartText = slot.start || '00:00';
          }
        }

        if (earliestStartMins < 24 * 60 && currentTotalMins < earliestStartMins) {
          return {
            isHold: true,
            reason: `預約當日 (${resDateStr})，於營業時間 (${earliestStartText}) 開放前保持保留狀態`,
          };
        }
      }
    }

    return { isHold: false, reason: '已達到預約當日營業時間，已自動解除保留開放作業' };
  };

  // Filter orders
  const activeOrders = orders.filter((o) => {
    // 1. Status Filter
    const matchesStatus =
      filterStatus === 'active'
        ? o.status === 'pending' || o.status === 'preparing' || o.status === 'paid'
        : true;

    if (!matchesStatus) return false;

    // 1b. Hiding threshold check: if hideOlderCompleted is enabled, completed orders older than 30 mins are hidden
    if (hideOlderCompleted && o.status === 'completed') {
      try {
        const orderTime = new Date(o.createdAt).getTime();
        const minutesElapsed = (Date.now() - orderTime) / (60 * 1000);
        if (minutesElapsed > 30) {
          return false;
        }
      } catch (e) {
        // Safe fallback in case date isn't parseable: do not hide
      }
    }

    // 2. Search Query Filter (Table number or order ID)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      const orderIdMatch = o.id.toLowerCase().includes(query);
      const tableMatch = o.tableNumber && o.tableNumber.toLowerCase().includes(query);
      if (!(orderIdMatch || tableMatch)) return false;
    }

    // 3. Category Filter
    if (selectedCategory !== 'all') {
      const hasMatchingCategory = o.items.some((item) => {
        const menuItem = menuItems.find((mi) => mi.id === item.menuItemId);
        return menuItem && menuItem.category === selectedCategory;
      });
      if (!hasMatchingCategory) return false;
    }

    return true;
  });

  const getHourlyData = () => {
    const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');
    const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    pendingOrders.forEach((o) => {
      try {
        const h = new Date(o.createdAt).getHours();
        if (!hours.includes(h)) {
          hours.push(h);
        }
      } catch (e) {
        // ignore
      }
    });

    hours.sort((a, b) => a - b);

    return hours.map((h) => {
      const label = `${String(h).padStart(2, '0')}:00`;
      const count = pendingOrders.filter((o) => {
        try {
          const orderHour = new Date(o.createdAt).getHours();
          return orderHour === h;
        } catch (e) {
          return false;
        }
      }).length;

      return {
        hour: h,
        label,
        count,
      };
    });
  };

  const getPredictionData = () => {
    // Standard service hours
    const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    // Parse historical orders from the list of all orders
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const last7DaysOrders = orders.filter((o) => {
      try {
        const t = new Date(o.createdAt).getTime();
        return t >= sevenDaysAgo;
      } catch {
        return false;
      }
    });

    const uniqueDays = new Set(
      last7DaysOrders
        .map((o) => {
          try {
            return new Date(o.createdAt).toDateString();
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    );
    const numDays = Math.max(uniqueDays.size, 1);

    // Standard baseline distribution representing typical rush pattern of Sabay Grill
    // Peak hours around lunch (12:00-13:00) and dinner (18:00-20:00)
    const baseCoefficients: { [key: number]: number } = {
      11: 1.5,
      12: 5.2,
      13: 4.5,
      14: 1.8,
      15: 1.2,
      16: 1.5,
      17: 4.8,
      18: 9.6,
      19: 11.2,
      20: 8.4,
      21: 4.2,
      22: 1.8,
    };

    // Calculate dynamic order velocity scaling
    const averageDailyVolume = orders.length / 3;
    const scaleFactor = Math.min(Math.max(averageDailyVolume / 4, 0.65), 2.2);

    return hours.map((h) => {
      const label = `${String(h).padStart(2, '0')}:00`;

      // Real historical count for this hours
      const historicalOrdersForHour = last7DaysOrders.filter((o) => {
        try {
          return new Date(o.createdAt).getHours() === h;
        } catch {
          return false;
        }
      });

      // Real average in observed historical days
      const realHistoricalAvg = parseFloat((historicalOrdersForHour.length / numDays).toFixed(1));

      // Raw mathematical prediction
      const baselinePredicted = Math.round((baseCoefficients[h] || 1.0) * scaleFactor);

      // Blended mathematical regression
      const finalExpectedVolume =
        realHistoricalAvg > 0
          ? Math.round(realHistoricalAvg * 0.4 + baselinePredicted * 0.6)
          : baselinePredicted;

      // To compare live counts: find actual orders placed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const actualCountToday = orders.filter((o) => {
        try {
          const oTime = new Date(o.createdAt);
          return oTime.getTime() >= todayStart.getTime() && oTime.getHours() === h;
        } catch {
          return false;
        }
      }).length;

      // Confidence bounds
      const margin = Math.max(Math.round(finalExpectedVolume * 0.25), 1);

      return {
        hour: h,
        label,
        historicalAvg:
          realHistoricalAvg > 0
            ? realHistoricalAvg
            : parseFloat((baselinePredicted * 0.75).toFixed(1)),
        expectedVolume: finalExpectedVolume,
        actualToday: actualCountToday,
        upperBound: finalExpectedVolume + margin,
        lowerBound: Math.max(finalExpectedVolume - margin, 0),
      };
    });
  };

  const hourlyData = getHourlyData();
  const maxCount = Math.max(...hourlyData.map((d) => d.count), 5);
  const predictionData = getPredictionData();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1C1C1C] border border-white/10 p-3 rounded-lg shadow-xl text-xs space-y-1.5 text-left font-sans">
          <p className="font-extrabold text-white border-b border-white/5 pb-1 font-mono">
            {data.label} 時段運載
          </p>
          <p className="text-[#00C300] font-bold flex items-center justify-between gap-6">
            <span>🎯 今日實際單量:</span>
            <span className="font-mono text-sm font-black">{data.actualToday} 筆</span>
          </p>
          <p className="text-[#E5B453] font-bold flex items-center justify-between gap-6">
            <span>📈 預期期望單量:</span>
            <span className="font-mono text-sm font-black">{data.expectedVolume} 筆</span>
          </p>
          <p className="text-zinc-405 flex items-center justify-between gap-6">
            <span>🗓️ 7日歷史均值:</span>
            <span className="font-mono">{data.historicalAvg} 筆</span>
          </p>
          <div className="text-[10px] text-zinc-500 border-t border-white/5 pt-1.5 flex justify-between gap-6 font-mono">
            <span>預期波動區間:</span>
            <span>
              {data.lowerBound} - {data.upperBound} 筆
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleStatusChange = async (id: string, nextStatus: OrderStatus) => {
    if (kdsRole !== 'kitchen') {
      alert('【權限不足】僅有「廚房」角色可以更改訂單狀態，店員僅能瀏覽。');
      return;
    }

    // Play sound & Web Audio status beep
    playStatusBeepSound();
    setBeepSim(true);
    setTimeout(() => setBeepSim(false), 800);

    await onUpdateOrderStatus(id, nextStatus);
  };

  const handleItemStatusToggle = (
    orderId: string,
    itemId: string,
    isCompleted: boolean,
    isPrepared?: boolean,
  ) => {
    if (kdsRole !== 'kitchen') {
      alert('【權限不足】僅有「廚房」角色可以更改餐點狀態，店員僅能瀏覽。');
      return;
    }
    if (true) {
      handleItemStatusToggle(orderId, itemId, isCompleted, isPrepared);
    }
  };

  const getUrgencyText = (createdAt: string) => {
    const diffMins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diffMins < 5) {
      const text =
        currentLang === 'zh'
          ? '剛剛下單 Fresh'
          : currentLang === 'en'
            ? 'Just Ordered Fresh'
            : currentLang === 'ko'
              ? '방금 주문 Fresh'
              : currentLang === 'ja'
                ? '注文直後 Fresh'
                : currentLang === 'th'
                  ? 'สั่งซื้อเมื่อครู่ Fresh'
                  : 'Vừa gọi món Fresh';
      return { text, style: 'bg-emerald-500/10 text-[#00C300] border-emerald-500/20' };
    }
    if (diffMins < 15) {
      const text =
        currentLang === 'zh'
          ? `延遲 ${diffMins} 分鐘`
          : currentLang === 'en'
            ? `Delayed ${diffMins} mins`
            : currentLang === 'ko'
              ? `지연 ${diffMins}분`
              : currentLang === 'ja'
                ? `遅延 ${diffMins} 分`
                : currentLang === 'th'
                  ? `ล่าช้า ${diffMins} นาที`
                  : `Trễ ${diffMins} phút`;
      return {
        text,
        style: 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold animate-pulse',
      };
    }
    const text =
      currentLang === 'zh'
        ? `嚴重超時 ${diffMins} 分!`
        : currentLang === 'en'
          ? `Severely Overdue ${diffMins} mins!`
          : currentLang === 'ko'
            ? `심각한 시간 초과 ${diffMins}분!`
            : currentLang === 'ja'
              ? `深刻な超過 ${diffMins} 分!`
              : currentLang === 'th'
                ? `เกินเวลาอย่างมาก ${diffMins} นาที!`
                : `Quá hạn nghiêm trọng ${diffMins} phút!`;
    return {
      text,
      style:
        'bg-red-500/10 text-red-400 border-red-500/20 uppercase font-black tracking-wider animate-bounce',
    };
  };

  const getElapsedTime = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
    const text = `${elapsedMins}m ${elapsedSecs}s`;

    let style = '';
    if (elapsedMins <= 15) {
      style = 'bg-white/5 text-white border-white/20';
    } else if (elapsedMins <= 30) {
      style = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25 font-bold';
    } else {
      style = 'bg-red-500/10 text-red-500 border-red-500/25 uppercase font-black animate-pulse';
    }
    return { mins: elapsedMins, text, style };
  };

  const getOrderItemPrepTimeMinutes = (menuItemId: string): number => {
    const item = menuItems.find((m) => m.id === menuItemId);
    if (!item) return 6; // default average cooking minutes

    const cat = item.category || '';
    if (cat === 'combos') return 12;
    if (cat === 'skewers') return 10;
    if (cat === 'noodles') return 8;
    if (cat === 'sides') return 3;
    if (cat === 'drinks') return 1;
    return 6; // default fallback core cooking average mins
  };

  const getOrderAveragePrepTimeMinutes = (order: Order): number => {
    if (!order.items || order.items.length === 0) return 6;

    let totalPrep = 0;
    let totalQty = 0;

    order.items.forEach((it) => {
      const itemPrep = getOrderItemPrepTimeMinutes(it.menuItemId);
      totalPrep += itemPrep * it.qty;
      totalQty += it.qty;
    });

    return totalQty > 0 ? totalPrep / totalQty : 6;
  };

  const isOrderLateForPrepTime = (
    order: Order,
  ): { isLate: boolean; currentWaitMins: number; avgPrepMins: number; limitMins: number } => {
    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    const currentWaitMins = elapsedMs / 60000;
    const avgPrepMins = getOrderAveragePrepTimeMinutes(order);
    const limitMins = avgPrepMins * 1.5;
    return {
      isLate: currentWaitMins > limitMins,
      currentWaitMins,
      avgPrepMins,
      limitMins,
    };
  };

  const getTableOccupancyElapsedTime = (tableNumber: string) => {
    if (!tableNumber) return null;

    // Get all orders that are active for this table number in the system
    const activeTableOrders = orders.filter((o) => {
      const isThisTable = o.tableNumber === tableNumber;
      const isActive = o.status === 'pending' || o.status === 'preparing' || o.status === 'paid';
      return isThisTable && isActive;
    });

    if (activeTableOrders.length === 0) return null;

    // Find the oldest active order
    const oldestOrder = activeTableOrders.reduce((oldest, current) => {
      return new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest;
    }, activeTableOrders[0]);

    // Calculate time elapsed since that oldest order's createdAt
    const elapsedMs = Date.now() - new Date(oldestOrder.createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);

    let style = 'bg-sky-500/10 text-sky-400 border-sky-500/20'; // Default blue color accent for table occupancy
    if (elapsedMins >= 45) {
      style = 'bg-red-500/20 text-red-400 border-red-500/30 font-black animate-pulse';
    } else if (elapsedMins >= 30) {
      style = 'bg-amber-500/15 text-amber-400 border-amber-500/25 font-bold';
    }

    return {
      minutes: elapsedMins,
      text: `${elapsedMins}m ${elapsedSecs}s`,
      style,
      orderCount: activeTableOrders.length,
      oldestOrderId: oldestOrder.id,
    };
  };

  const isCloseToClosing = (createdAtString: string, operatingHoursList: any[]): boolean => {
    if (!createdAtString || !operatingHoursList || operatingHoursList.length === 0) return false;

    const date = new Date(createdAtString);
    if (isNaN(date.getTime())) return false;

    // Convert to Taiwan Time (UTC+8) consistent with server operating hours estimation
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const localDate = new Date(utc + 3600000 * 8);

    const day = localDate.getDay(); // 0 is Sunday, ..., 6 is Saturday
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    const orderTotalMinutes = hour * 60 + minute;

    for (const slot of operatingHoursList) {
      if (!slot.isActive) continue;
      if (slot.days && !slot.days.includes(day)) continue;

      // Parse times "HH:MM"
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);

      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;

      // Handle overnight end times (e.g., 17:30 to 00:30)
      if (endTotal < startTotal) {
        // If current order time is before end hour (e.g. 00:15 vs slot starting 17:30 and ending 00:30)
        // Then current order is in the early hours of the next calendar day relative to starting slot
        if (orderTotalMinutes <= endTotal) {
          if (orderTotalMinutes >= endTotal - 30) {
            return true;
          }
        }
      } else {
        if (orderTotalMinutes >= startTotal && orderTotalMinutes <= endTotal) {
          if (orderTotalMinutes >= endTotal - 30) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Aggregated dishes data structure and grouping function
  interface MergedOrderBreakdown {
    orderId: string;
    tableNumber: string;
    qty: number;
    customization: any;
    elapsedMins: number;
    createdAt: string;
    originalOrder: Order;
  }

  interface MergedDishItem {
    id: string;
    name: { zh: string; en: string };
    totalQty: number;
    orderItems: MergedOrderBreakdown[];
  }

  const getMergedDishes = (): MergedDishItem[] => {
    const mergedMap: { [key: string]: MergedDishItem } = {};

    activeOrders.forEach((order) => {
      order.items.forEach((item) => {
        const menuItem = menuItems.find((mi) => mi.id === item.menuItemId);
        if (selectedCategory !== 'all') {
          if (!menuItem || menuItem.category !== selectedCategory) {
            return; // skip items not of the selected category
          }
        }

        const key = item.menuItemId || item.id || 'unknown';
        const elapsedMins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);

        if (!mergedMap[key]) {
          mergedMap[key] = {
            id: key,
            name: item.name,
            totalQty: 0,
            orderItems: [],
          };
        }

        mergedMap[key].totalQty += item.qty;
        mergedMap[key].orderItems.push({
          orderId: order.id,
          tableNumber: order.tableNumber,
          qty: item.qty,
          customization: item.customization,
          elapsedMins,
          createdAt: order.createdAt,
          originalOrder: order,
        });
      });
    });

    return Object.values(mergedMap).sort((a, b) => b.totalQty - a.totalQty);
  };

  const getCategoriesList = () => {
    if (categories && categories.length > 0) {
      return categories;
    }
    const uniqueCategoryIds = Array.from(
      new Set(menuItems.map((item) => item.category).filter(Boolean)),
    );
    const categoryMap: { [key: string]: string } = {
      drinks: '飲料',
      skewers: '烤肉',
      sides: '炸物',
      noodles: '特色主食',
      combos: '精選套餐',
    };
    return uniqueCategoryIds.map((id) => ({
      id,
      name: {
        zh: categoryMap[id] || id,
        en: id,
        ja: id,
        ko: id,
        th: id,
      } as { [key in Language]: string },
    }));
  };

  // Voice/Speech Dictation Functions
  const startDictation = (orderId: string) => {
    if (speechRecInstance) {
      try {
        speechRecInstance.stop();
      } catch (e) {}
    }

    setDictatingOrderId(orderId);
    setDictatedText('');
    setNoteError(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNoteError('此瀏覽器或外掛環境暫不支援 Web Speech API。但您可在下方手動輸入快速備註。');
      setIsDictating(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-TW';

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setNoteError('麥克風授權失敗，請確認已核准瀏覽器麥克風使用權限');
        } else if (event.error === 'no-speech') {
          // ignore
        } else {
          setNoteError(`語音處理錯誤: ${event.error}`);
        }
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          setDictatedText(finalTranscript);
        }
      };

      recognition.start();
      setSpeechRecInstance(recognition);
    } catch (e: any) {
      setNoteError(`語音串接失敗: ${e.message}`);
      setIsDictating(false);
    }
  };

  const stopRecordingAndParse = () => {
    if (speechRecInstance) {
      try {
        speechRecInstance.stop();
      } catch (e) {}
    }
    setIsDictating(false);

    // Help parse or beautify common spoken words!
    let parsed = dictatedText.trim();
    if (parsed) {
      const shortcuts: { [key: string]: string } = {
        先出: '⚡ 急：優先出餐 (RUSH!)',
        加湯: '🍲 免費加湯 (Add broth)',
        不要辣: '🌶️ 去辣 (No spicy)',
        小辣: '🌶️ 精確小辣',
        大辣: '🌶️ 泰國大辣',
        外帶: '🥡 外帶打包 (Takeout)',
        不要香菜: '🌿 去除香菜 (No coriander)',
        多菜: '🥗 多配菜 (Extra veggies)',
        加肉: '🥩 加點肉品 (Add extra meat)',
        少糖: '🍬 微糖 (Less sweet)',
        去冰: '🧊 去冰',
      };

      for (const [key, value] of Object.entries(shortcuts)) {
        if (parsed.includes(key)) {
          parsed = `${value} (${parsed})`;
          break;
        }
      }
      setDictatedText(parsed);
    }
  };

  const saveDictatedNote = async (orderId: string) => {
    if (speechRecInstance) {
      try {
        speechRecInstance.stop();
      } catch (e) {}
    }

    if (!dictatedText.trim()) {
      setNoteError('備註內容不可為空白');
      return;
    }

    if (onUpdateQuickNotes) {
      const res = await onUpdateQuickNotes(orderId, dictatedText.trim());
      if (res && res.success) {
        setDictatingOrderId(null);
        setDictatedText('');
      } else {
        setNoteError(res?.error || '儲存失敗，請重試');
      }
    } else {
      setNoteError('系統未啟用 KDS 備註回傳端點');
    }
  };

  const cancelDictation = () => {
    if (speechRecInstance) {
      try {
        speechRecInstance.stop();
      } catch (e) {}
    }
    setDictatingOrderId(null);
    setDictatedText('');
    setNoteError(null);
  };

  const clearQuickNote = async (orderId: string) => {
    if (onUpdateQuickNotes) {
      await onUpdateQuickNotes(orderId, '');
    }
  };

  const toggleFlagState = async (
    orderId: string,
    currentFlagged: boolean,
    currentReason: string,
  ) => {
    if (onToggleOrderFlag) {
      if (currentFlagged) {
        // Unflag immediately
        await onToggleOrderFlag(orderId, false, '');
      } else {
        // Open reason input
        setFlaggingOrderId(orderId);
        setFlagReasonInput(currentReason || '');
        setFlagError(null);
      }
    }
  };

  const submitFlagReason = async (orderId: string) => {
    if (!flagReasonInput.trim()) {
      setFlagError('請輸入需要特別關注的具體原因 / Please enter a reason');
      return;
    }
    if (onToggleOrderFlag) {
      const res = await onToggleOrderFlag(orderId, true, flagReasonInput.trim());
      if (res && res.success) {
        setFlaggingOrderId(null);
        setFlagReasonInput('');
        setFlagError(null);
      } else {
        setFlagError(res?.error || '無法更新關注旗幟');
      }
    }
  };

  const qvOcc = quickViewOrder ? getTableOccupancyElapsedTime(quickViewOrder.tableNumber) : null;

  return (
    <div
      ref={kdsHeaderRef}
      className="grid grid-cols-1 xl:grid-cols-4 gap-6 text-left text-white scroll-mt-6"
      id="kds-panel"
    >
      {/* Sound notification indicator simulation */}
      {beepSim && (
        <div className="fixed top-8 right-8 bg-[#161616] border border-[#E5B453] shadow-2xl text-white px-5 py-3 rounded-xl flex items-center space-x-2 z-50 animate-bounce">
          <Volume2 className="text-[#E5B453] animate-pulse" size={20} />
          <span className="font-bold text-xs text-[#E5B453]">
            🔊 [逼逼！廚房票據機已列印全新工作單]
          </span>
        </div>
      )}

      {/* Main Culinary Tickets Workspace */}
      <div className="xl:col-span-3 space-y-5">
        <div
          className="bg-[#161616] text-white rounded-xl p-5 border border-white/10 space-y-4"
          id="kds-header-main-box"
        >
          {/* Top Row: Brand & Core Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex items-center space-x-3 text-left">
              <div className="bg-[#E5B453] text-[#0F0F0F] p-2.5 rounded-xl">
                <ChefHat size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-bold font-serif tracking-wide text-white">
                  沙貝廚房備餐顯示屏 (KDS Monitor)
                </h2>
                <p className="text-white/40 text-xs">即時同步桌席點單 · 最新 1 秒連線正常</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end">
              {/* Search Input Filter */}
              <div
                className="relative flex items-center w-full sm:w-52"
                id="kds-search-bar-container"
              >
                <Search size={14} className="absolute left-3 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋桌號或訂單編號..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#E5B453] focus:ring-1 focus:ring-[#E5B453] transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-white/40 hover:text-white p-0.5 transition cursor-pointer"
                    title="清除搜尋"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* 👥 KDS 登錄角色選取器 (Role Selector: 廚房 vs 店員) */}
              <div
                className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 shrink-0 select-none font-sans"
                id="kds-role-selector"
              >
                <span className="text-[10px] text-white/50 font-bold px-1 select-none">
                  登錄角色:
                </span>
                <button
                  type="button"
                  id="kds-role-kitchen-btn"
                  onClick={() => handleRoleSwitch('kitchen')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    kdsRole === 'kitchen'
                      ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'text-white/40 hover:text-white'
                  }`}
                  title="廚房角色：獨佔主控寫入權限，資料優先寫入"
                >
                  <ChefHat size={12} />
                  <span>🍳 廚房 (主控權限)</span>
                </button>

                <button
                  type="button"
                  id="kds-role-staff-btn"
                  onClick={() => handleRoleSwitch('staff')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    kdsRole === 'staff'
                      ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)]'
                      : 'text-white/40 hover:text-white'
                  }`}
                  title="店員角色：對齊廚房最新資料，衝突時以廚房為準"
                >
                  <Eye size={12} />
                  <span>👤 店員 (對齊廚房)</span>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 select-none font-sans">
                <button
                  id="kds-filter-active"
                  onClick={() => setFilterStatus('active')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    filterStatus === 'active'
                      ? 'bg-[#E5B453] text-[#0F0F0F]'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {currentLang === 'zh'
                    ? '未完成 (備餐中)'
                    : currentLang === 'en'
                      ? 'Active (Preparing)'
                      : currentLang === 'ko'
                        ? '미완료 (준비 중)'
                        : currentLang === 'ja'
                          ? '未完了 (準備中)'
                          : currentLang === 'th'
                            ? 'ยังไม่เสร็จ (กำลังปรุง)'
                            : 'Chưa xong (Đang chuẩn bị)'}
                </button>
                <button
                  id="kds-filter-all"
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-[#E5B453] text-[#0F0F0F]'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {currentLang === 'zh'
                    ? '全部歷史票'
                    : currentLang === 'en'
                      ? 'All History Tickets'
                      : currentLang === 'ko'
                        ? '전체 내역서'
                        : currentLang === 'ja'
                          ? '全履歴伝票'
                          : currentLang === 'th'
                            ? 'ประวัติทั้งหมด'
                            : 'Tất cả phiếu lịch sử'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Secondary KDS workspace configure helper */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/60 pt-0.5">
            <span className="text-[10px] font-bold text-[#E5B453]/70 uppercase tracking-wider mr-1.5 font-sans">
              {currentLang === 'zh' ? '工作台配置 Panel Config:' : 'Workspace Configuration:'}
            </span>

            {/* View Mode Toggle Tabs */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 select-none font-sans">
              <button
                id="kds-view-standard"
                onClick={() => setIsMergedView(false)}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  !isMergedView ? 'bg-[#E5B453] text-[#0F0F0F]' : 'text-white/40 hover:text-white'
                }`}
                title="時間直欄訂單票長視圖"
              >
                {currentLang === 'zh'
                  ? '標準訂單票卡'
                  : currentLang === 'en'
                    ? 'Standard Tickets'
                    : currentLang === 'ko'
                      ? '일반 주문서'
                      : currentLang === 'ja'
                        ? '標準伝票'
                        : currentLang === 'th'
                          ? 'บัตรออเดอร์ทั่วไป'
                          : 'Phiếu gọi món chuẩn'}
              </button>
              <button
                id="kds-view-merged-toggle"
                onClick={() => setIsMergedView(true)}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                  isMergedView ? 'bg-[#E5B453] text-[#0F0F0F]' : 'text-white/40 hover:text-white'
                }`}
                title="合併相同品項與計量進行批次製作"
              >
                <ChefHat size={11} className={isMergedView ? 'animate-bounce' : ''} />
                <span>
                  {currentLang === 'zh'
                    ? '合併相似菜色'
                    : currentLang === 'en'
                      ? 'Merged View'
                      : currentLang === 'ko'
                        ? '메뉴 병합 보기'
                        : currentLang === 'ja'
                          ? 'メニュー統合表示'
                          : currentLang === 'th'
                            ? 'รวมเมนูที่เหมือนกัน'
                            : 'Gộp món giống nhau'}
                </span>
              </button>
            </div>

            {/* 🆙 自動滾動與置頂切換輔助 (Auto-Scroll To Top Monitor Controls) */}
            <div
              className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 select-none gap-2"
              id="kds-scroll-top-wrapper"
            >
              <button
                id="kds-autoscroll-toggle-btn"
                type="button"
                onClick={() => {
                  const nextVal = !autoScrollEnabled;
                  setAutoScrollEnabled(nextVal);
                  try {
                    safeStorage.setItem('kds-autoscroll-enabled', String(nextVal));
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  autoScrollEnabled
                    ? 'bg-[#E5B453] text-[#0F0F0F]'
                    : 'text-white/40 hover:text-white'
                }`}
                title={
                  autoScrollEnabled ? '關閉新訂單自動滾動置頂輔助' : '開啟新訂單自動滾動置頂輔助'
                }
              >
                <RefreshCw size={11} className={autoScrollEnabled ? 'animate-spin' : ''} />
                <span>
                  {autoScrollEnabled
                    ? currentLang === 'zh'
                      ? '自動滾動: 開'
                      : currentLang === 'en'
                        ? 'Auto-Scroll: ON'
                        : currentLang === 'ko'
                          ? '자동 스크롤: 켜짐'
                          : currentLang === 'ja'
                            ? '自動スクロール: 有効'
                            : currentLang === 'th'
                              ? 'เลื่อนอัตโนมัติ: เปิด'
                              : 'Tự động cuộn: Bật'
                    : currentLang === 'zh'
                      ? '自動滾動: 關'
                      : currentLang === 'en'
                        ? 'Auto-Scroll: OFF'
                        : currentLang === 'ko'
                          ? '자동 스크롤: 꺼짐'
                          : currentLang === 'ja'
                            ? '자동스크ロール: 無効'
                            : currentLang === 'th'
                              ? 'เลื่อนอัตโนมัติ: ปิด'
                              : 'Tự động cuộn: Tắt'}
                </span>
              </button>

              <button
                id="kds-scroll-direct-top"
                type="button"
                onClick={scrollToHeaderTop}
                className="px-2 py-1 hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-[10px] font-extrabold text-[#E5B453] hover:text-amber-300 transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="手動立即滾置頂部 (Manual scroll back to top)"
              >
                <span>
                  {currentLang === 'zh'
                    ? '置頂 ⬆️'
                    : currentLang === 'en'
                      ? 'Top ⬆️'
                      : currentLang === 'ko'
                        ? '맨 위로 ⬆️'
                        : currentLang === 'ja'
                          ? 'トップ ⬆️'
                          : currentLang === 'th'
                            ? 'ขึ้นบนสุด ⬆️'
                            : 'Lên đầu ⬆️'}
                </span>
              </button>
            </div>

            {/* 🧹 已完成訂單超過 30M 自動隱藏 (Auto-Hide Completed Orders > 30mins) */}
            <div
              className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 select-none gap-2"
              id="kds-hide-completed-wrapper"
            >
              <button
                id="kds-hide-completed-toggle-btn"
                type="button"
                onClick={() => {
                  const nextVal = !hideOlderCompleted;
                  setHideOlderCompleted(nextVal);
                  try {
                    safeStorage.setItem('kds-hide-completed-30m', String(nextVal));
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  hideOlderCompleted
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
                title={
                  hideOlderCompleted
                    ? '點擊關閉「隱藏 30 分鐘前已完成訂單」'
                    : '點擊開啟「自動隱藏 30 分鐘前已完成訂單」以維持 KDS 介面清爽'
                }
              >
                <Clock
                  size={11}
                  className={hideOlderCompleted ? 'text-rose-400 animate-pulse' : ''}
                />
                <span>
                  {hideOlderCompleted
                    ? currentLang === 'zh'
                      ? '自動隱藏已完成 >30m'
                      : currentLang === 'en'
                        ? 'Auto-Hide Done >30m'
                        : currentLang === 'ko'
                          ? '완료 건 숨김 >30분'
                          : currentLang === 'ja'
                            ? '30分超の完了件を隠す'
                            : currentLang === 'th'
                              ? 'ซ่อนรายการเสร็จสิ้น >30นาที'
                              : 'Tự động ản đã xong >30ph'
                    : currentLang === 'zh'
                      ? '自動隱藏已完成 >30m (關)'
                      : currentLang === 'en'
                        ? 'Auto-Hide Done >30m (OFF)'
                        : currentLang === 'ko'
                          ? '완료 건 숨김 >30분 (꺼짐)'
                          : currentLang === 'ja'
                            ? '30分超の完了件を隠す (無効)'
                            : currentLang === 'th'
                              ? 'ซ่อนรายการเสร็จสิ้น >30นาที (ปิด)'
                              : 'Tự động ẩn đã xong >30ph (Tắt)'}
                </span>
              </button>
            </div>

            {/* 🔊 語音合成與 Web Audio 提示音服務 Toggle */}
            <div
              className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 shrink-0 select-none gap-2"
              id="kds-speech-synth-toggle-wrapper"
            >
              {audioNeedsUnlock && (
                <button
                  id="kds-audio-unlock-btn"
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    speak('廚房音效與語音已啟用');
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 rounded-lg text-[11px] font-bold animate-pulse transition cursor-pointer"
                  title="點擊以開啟瀏覽器語音與音效播放權限"
                >
                  <Volume2 size={12} className="text-amber-400" />
                  <span>{currentLang === 'zh' ? '點擊啟用廚房音效' : 'Click to Enable Audio'}</span>
                </button>
              )}
              <button
                id="kds-tts-toggle-btn"
                type="button"
                onClick={handleToggleTts}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  ttsEnabled ? 'bg-[#E5B453] text-[#0F0F0F]' : 'text-white/40 hover:text-white'
                }`}
                title={ttsEnabled ? '關閉新訂單語音自動播報' : '開啟新訂單語音自動播報'}
              >
                <Volume2 size={12} className={ttsEnabled ? 'animate-pulse' : ''} />
                <span>
                  {ttsEnabled
                    ? currentLang === 'zh'
                      ? '語音廣播: 開'
                      : currentLang === 'en'
                        ? 'Voice Readout: ON'
                        : currentLang === 'ko'
                          ? '음성 방송: 켜짐'
                          : currentLang === 'ja'
                            ? '音声読み上げ: 有効'
                            : currentLang === 'th'
                              ? 'ประกาศเสียง: เปิด'
                              : 'Phát thanh giọng nói: Bật'
                    : currentLang === 'zh'
                      ? '語音廣播: 關'
                      : currentLang === 'en'
                        ? 'Voice Readout: OFF'
                        : currentLang === 'ko'
                          ? '음성 방송: 꺼짐'
                          : currentLang === 'ja'
                            ? '音声読み上げ: 無効'
                            : currentLang === 'th'
                              ? 'ประกาศเสียง: ปิด'
                              : 'Phát thanh giọng nói: Tắt'}
                </span>
              </button>
              {ttsEnabled && (
                <button
                  id="kds-tts-test-btn"
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    speak('語音測試，沙貝烤肉祝您用餐愉快');
                  }}
                  className="px-2 py-1 hover:bg-white/5 border border-[#E5B453]/20 hover:border-[#E5B453]/40 rounded-lg text-[10px] font-bold text-[#E5B453] hover:text-white transition cursor-pointer"
                  title="測試播放音量與語音廣播"
                >
                  {currentLang === 'zh' ? '測試 (Test)' : 'Test'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Station Filter Bar */}
        <div
          className="bg-[#161616] border border-white/10 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-left gap-4"
          id="kds-category-filter-bar"
        >
          <div className="flex items-center space-x-2">
            <Settings size={16} className="text-[#E5B453]" />
            <h3 className="font-bold text-sm text-white font-serif tracking-wide text-left">
              站點分類篩選 (Kitchen Prep Station Filter)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2" id="kds-category-buttons">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                selectedCategory === 'all'
                  ? 'bg-[#E5B453] text-[#0F0F0F] border-[#E5B453] shadow-[0_2px_8px_rgba(229,180,83,0.35)]'
                  : 'bg-black/40 text-white/50 border-white/5 hover:text-white hover:bg-black/60 hover:border-white/10'
              }`}
            >
              全部品項 (All Stations)
            </button>
            {getCategoriesList().map((cat) => {
              const name = getLocalizedText(cat.name, currentLang) || cat.id;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#E5B453] text-[#0F0F0F] border-[#E5B453] shadow-[0_2px_8px_rgba(229,180,83,0.35)]'
                      : 'bg-black/40 text-white/50 border-white/5 hover:text-white hover:bg-black/60 hover:border-white/10'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────── */}

        {/* ⚠️ 預約即將到來警示 (Upcoming Reservations Alert) */}
        {(() => {
          const now = new Date();
          const isUpcomingReservation = (r: Reservation) => {
            if (r.status === 'upcoming') return true;
            if (r.status === 'pending' && r.date && r.time) {
              const [year, month, day] = r.date.split('-').map(Number);
              const [hour, minute] = r.time.split(':').map(Number);
              if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
                const resDateTime = new Date(year, month - 1, day, hour, minute);
                const diffMinutes = (resDateTime.getTime() - now.getTime()) / (1000 * 60);
                return diffMinutes > -120 && diffMinutes <= 60;
              }
            }
            return false;
          };

          const upcomingRes = (reservations || []).filter(isUpcomingReservation);
          if (upcomingRes.length === 0) return null;
          return (
            <div
              className="bg-amber-500/10 border-2 border-amber-500/30 p-4 rounded-xl space-y-2.5 animate-pulse text-left font-sans mb-5"
              id="kds-upcoming-reservations-warning"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <span className="text-base">⚠️</span>
                  <span className="font-serif tracking-wide">
                    預警：顧客預約即將到來 (1小時內有 {upcomingRes.length} 筆預約抵達)
                  </span>
                </div>
                <span className="bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black px-2 py-0.5 rounded border border-amber-500/30">
                  ⚡ 即將到來 Alert
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingRes.map((res) => (
                  <div
                    key={res.id}
                    className="bg-black/40 border border-amber-500/30 p-3 rounded-xl flex flex-col justify-between space-y-2 shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-white font-bold text-xs block">
                          {res.customerName}
                        </span>
                        <span className="text-zinc-400 text-[10px] block font-mono">
                          {res.phone}
                        </span>
                      </div>
                      <span className="bg-[#E5B453] text-[#0F0F0F] font-mono font-black text-xs px-2 py-0.5 rounded shadow">
                        {res.tableNumber} 桌
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                      <span className="text-[#E5B453] font-black font-mono">
                        ⏰ 時間: {res.time}
                      </span>
                      <span className="text-zinc-200 font-bold">{res.guestCount} 人</span>
                    </div>
                    {res.notes && (
                      <div
                        className="text-[10px] text-zinc-300 bg-white/5 p-1.5 rounded border border-white/5 truncate"
                        title={res.notes}
                      >
                        需求: {res.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ──────────────────────────────────────────────────────── */}

        {activeOrders.length === 0 ? (
          <div className="bg-[#161616] border border-white/10 text-center py-20 rounded-xl space-y-3">
            <ChefHat size={45} className="mx-auto text-white/10" />
            {searchQuery ? (
              <p className="text-white/40 font-bold text-sm">
                找不到符合「{searchQuery}」的待備訂單 🔍
              </p>
            ) : (
              <p className="text-white/40 font-bold text-sm">
                目前沒有任何待備餐點，大家辛苦了！✨
              </p>
            )}
          </div>
        ) : isMergedView ? (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn font-sans"
            id="kds-merged-grid"
          >
            {getMergedDishes().map((dish) => {
              return (
                <div
                  key={dish.id}
                  className="bg-[#161616] border border-zinc-800 rounded-xl overflow-hidden shadow-lg flex flex-col justify-between text-left transition duration-300 hover:border-amber-500/40"
                >
                  {/* Card Header: Dish Name & Total Quantity Badge */}
                  <div className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/60 shrink-0 gap-3">
                    <div className="flex-1">
                      <h4 className="font-extrabold text-[#E5B453] text-[15px] font-serif tracking-wide">
                        {getLocalizedText(dish.name, currentLang)}
                      </h4>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                        {currentLang === 'zh'
                          ? getLocalizedText(dish.name, 'en') || 'Dishes Combo'
                          : getLocalizedText(dish.name, 'zh')}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 text-[#E5B453] border border-amber-500/30 text-xs px-3 py-1 rounded-full font-black shadow-[0_0_10px_rgba(229,180,83,0.15)] select-none">
                        總量 x {dish.totalQty} 份
                      </span>
                    </div>
                  </div>

                  {/* Body: Breakdown of tables */}
                  <div className="p-5 flex-1 min-h-[140px] space-y-4">
                    <div className="text-[11px] text-white/50 uppercase tracking-wider border-b border-white/5 pb-2 flex items-center gap-1.5 font-bold">
                      <ChefHat size={12} className="text-[#E5B453]" />
                      <span>各桌點單分配 (Table Breakdown)</span>
                    </div>

                    <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                      {dish.orderItems.map((oi, idx) => {
                        const elapsed = getElapsedTime(oi.createdAt);

                        return (
                          <div
                            key={idx}
                            className="bg-black/30 border border-white/5 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="bg-[#E5B453] text-black font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                                  {oi.tableNumber} {oi.tableNumber.includes('外帶') ? '' : '桌'}
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">
                                  單號: {oi.orderId}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${elapsed.style}`}
                                >
                                  <Clock
                                    size={8}
                                    className={elapsed.mins > 15 ? 'animate-pulse' : ''}
                                  />
                                  <span>已等 {elapsed.text}</span>
                                </span>
                                {isCloseToClosing(oi.createdAt, operatingHours) && (
                                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-[0_0_6px_rgba(239,68,68,0.2)] animate-pulse">
                                    ⚠️ 即將關店
                                  </span>
                                )}
                              </div>

                              {/* customization specifications */}
                              <div className="flex flex-wrap gap-1">
                                <span className="bg-white/5 text-white/70 border border-white/10 text-[9px] font-medium px-1 rounded">
                                  {t('sweet')}:{' '}
                                  {oi.customization.sweetness === 0
                                    ? t('sugarFree')
                                    : oi.customization.sweetness === 1
                                      ? t('sweet30')
                                      : oi.customization.sweetness === 2
                                        ? t('sweet50')
                                        : t('sweet100')}
                                </span>
                                <span className="bg-[#FF4D4D]/5 text-[#FF4D4D] border border-[#FF4D4D]/10 text-[9px] font-medium px-1 rounded">
                                  {t('spicyPrefix')}:{' '}
                                  {oi.customization.spiciness === 0
                                    ? t('notSpicy')
                                    : oi.customization.spiciness === 1
                                      ? t('mildSpicy')
                                      : oi.customization.spiciness === 2
                                        ? t('mediumSpicy')
                                        : t('thaiSpicy')}
                                </span>
                                {oi.customization.noodleType && (
                                  <span className="bg-[#E5B453]/5 text-[#E5B453] border border-[#E5B453]/10 text-[9px] font-medium px-1 rounded">
                                    {t('noodlePrefix')}:{' '}
                                    {oi.customization.noodleType === 'rice-noodle'
                                      ? t('riceNoodle')
                                      : oi.customization.noodleType === 'vermicelli'
                                        ? t('vermicelli')
                                        : t('noNoodle')}
                                  </span>
                                )}
                                {oi.customization.soupBase === 'coconut-milk' && (
                                  <span className="bg-amber-500/5 text-amber-500 border border-amber-500/10 text-[9px] font-medium px-1 rounded">
                                    {t('coconutMilkAdd')}
                                  </span>
                                )}
                                {oi.customization.selectedAddOns?.map((addOn: any) => (
                                  <span
                                    key={addOn.id}
                                    className="bg-amber-500/5 text-amber-400 border border-amber-500/10 text-[9px] font-medium px-1 rounded"
                                  >
                                    +{getLocalizedText(addOn.name, currentLang)}
                                  </span>
                                ))}
                              </div>

                              {oi.customization.notes && (
                                <p className="text-[10px] text-[#FF4D4D] bg-[#FF4D4D]/5 border border-[#FF4D4D]/10 px-2 py-1.5 rounded mt-1 font-sans">
                                  📌 {t('notesLabel')}：{oi.customization.notes}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <span className="text-white text-sm font-black font-mono">
                                x {oi.qty} 份
                              </span>

                              <button
                                type="button"
                                onClick={() => setQuickViewOrder(oi.originalOrder)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 hover:text-white border border-white/5 hover:border-white/10 text-[10px] p-2 rounded-lg cursor-pointer transition flex items-center gap-1"
                                title="檢視這筆完整訂單及操作出餐狀態 (Quick View Full Ticket)"
                              >
                                <Eye size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card bottom footer summary */}
                  <div className="p-3 bg-black/10 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30 shrink-0">
                    <span>共有 {dish.orderItems.length} 個桌號點購此品項</span>
                    <span className="font-mono">{getLocalizedText(dish.name, currentLang)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="kds-tickets-grid">
            {activeOrders.map((order) => {
              const urg = getUrgencyText(order.createdAt);
              const elapsed = getElapsedTime(order.createdAt);
              const occ = getTableOccupancyElapsedTime(order.tableNumber);
              const drag = dragStates[order.id] || { startX: 0, currentX: 0, isDragging: false };
              const offset = drag.isDragging ? Math.max(0, drag.currentX - drag.startX) : 0;
              const lateCheck = isOrderLateForPrepTime(order);
              const holdCheck = checkReservationOrderHoldStatus(order);
              return (
                <div
                  key={order.id}
                  className="relative overflow-hidden rounded-xl select-none"
                  style={{ touchAction: 'pan-y' }}
                >
                  {/* Swipe-to-Complete Background Indicator */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-[#00C300] via-emerald-500 to-emerald-600 flex items-center justify-between px-6 rounded-xl transition-opacity duration-200"
                    style={{
                      opacity: offset > 10 ? Math.min(1, offset / 120) : 0,
                    }}
                  >
                    <div className="flex items-center space-x-2 text-white">
                      <Check size={18} className="stroke-[3] animate-bounce" />
                      <span className="font-sans font-black text-xs tracking-wider">
                        {offset >= 150
                          ? '🎉 鬆開立即完成出餐！'
                          : '👉 右滑直接出餐 (Swipe to complete)'}
                      </span>
                    </div>
                    {offset >= 150 && (
                      <span className="text-[10px] bg-white/20 border border-white/30 text-white font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                        RELEASE TO DONE
                      </span>
                    )}
                  </div>

                  {/* Order main card content */}
                  <div
                    id={`kds-card-${order.id}`}
                    style={{
                      transform: `translateX(${offset}px)`,
                      transition: drag.isDragging
                        ? 'none'
                        : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: drag.isDragging ? 'grabbing' : 'grab',
                    }}
                    onTouchStart={(e) => handleCardTouchStart(order.id, e.touches[0].clientX)}
                    onTouchMove={(e) => handleCardTouchMove(order.id, e.touches[0].clientX)}
                    onTouchEnd={() => handleCardTouchEnd(order.id)}
                    onMouseDown={(e) => handleCardTouchStart(order.id, e.clientX)}
                    onMouseMove={(e) => {
                      if (dragStates[order.id]?.isDragging) {
                        handleCardTouchMove(order.id, e.clientX);
                      }
                    }}
                    onMouseUp={() => handleCardTouchEnd(order.id)}
                    onMouseLeave={() => {
                      if (dragStates[order.id]?.isDragging) {
                        handleCardTouchEnd(order.id);
                      }
                    }}
                    className={`bg-[#161616] border rounded-xl overflow-hidden shadow-md flex flex-col justify-between text-left transition-colors duration-300 ${
                      holdCheck.isHold
                        ? 'border-purple-500 ring-2 ring-purple-500/50 bg-gradient-to-b from-purple-950/40 via-[#161616] to-[#161616] shadow-[0_0_20px_rgba(168,85,247,0.35)] font-bold'
                        : order.isFlagged
                          ? 'border-red-500 ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                          : lateCheck.isLate
                            ? 'animate-red-breathing-glow border-red-500 ring-2 ring-red-500/35 shadow-[0_0_15px_rgba(239,68,68,0.35)] font-bold'
                            : order.status === 'pending'
                              ? 'border-amber-400 ring-2 ring-amber-400/60 animate-pulse bg-gradient-to-b from-amber-950/40 via-[#161616] to-[#161616] shadow-[0_0_25px_rgba(245,158,11,0.45)] font-bold'
                              : order.status === 'paid'
                                ? 'border-emerald-500/60 ring-2 ring-emerald-500/40 bg-gradient-to-b from-emerald-950/30 via-[#161616] to-[#161616] shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                : order.status === 'preparing'
                                  ? 'border-sky-500/40 hover:border-sky-500'
                                  : 'border-white/10'
                    }`}
                  >
                    {/* Reservation Hold Status Header Banner */}
                    {holdCheck.isHold && (
                      <div className="bg-purple-950/90 border-b border-purple-500/40 px-4 py-2 text-left space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="bg-purple-500 text-white font-mono font-black text-[10.5px] px-2 py-0.5 rounded tracking-wide animate-pulse">
                            🔒 預約單廚房保留中 (HOLD)
                          </span>
                          <span className="text-purple-300 font-mono text-[10.5px] font-bold">
                            {order.reservationNo || '預約單'} | 預約時間: {order.reservationDate}{' '}
                            {order.reservationTime || ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-purple-200 font-sans">
                          💡 {holdCheck.reason}
                        </p>
                      </div>
                    )}

                    {/* ⚠️ 桌席即將到來警示 banner */}
                    {(() => {
                      const now = new Date();
                      const matchingUpcomingRes = (reservations || []).find((r) => {
                        if (String(r.tableNumber).trim() !== String(order.tableNumber).trim())
                          return false;
                        if (r.status === 'upcoming') return true;
                        if (r.status === 'pending' && r.date && r.time) {
                          const [year, month, day] = r.date.split('-').map(Number);
                          const [hour, minute] = r.time.split(':').map(Number);
                          if (
                            !isNaN(year) &&
                            !isNaN(month) &&
                            !isNaN(day) &&
                            !isNaN(hour) &&
                            !isNaN(minute)
                          ) {
                            const resDateTime = new Date(year, month - 1, day, hour, minute);
                            const diffMinutes =
                              (resDateTime.getTime() - now.getTime()) / (1000 * 60);
                            return diffMinutes > -120 && diffMinutes <= 60;
                          }
                        }
                        return false;
                      });
                      if (!matchingUpcomingRes) return null;
                      return (
                        <div className="bg-amber-950/95 border-b-2 border-amber-500/50 px-4 py-2 text-left space-y-1 animate-pulse">
                          <div className="flex items-center justify-between gap-2">
                            <span className="bg-amber-500 text-slate-950 font-sans font-black text-[10px] px-1.5 py-0.5 rounded tracking-wide">
                              ⚠️ 桌位即將到來
                            </span>
                            <span className="text-[#E5B453] font-mono text-[10px] font-black">
                              預約時間: {matchingUpcomingRes.time}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-300 font-sans leading-relaxed">
                            此桌即將有預約顧客{' '}
                            <strong className="text-amber-400 font-black">
                              {matchingUpcomingRes.customerName}
                            </strong>{' '}
                            ({matchingUpcomingRes.guestCount}人) 抵達，請盡速清理與備餐！
                          </p>
                        </div>
                      );
                    })()}

                    {/* Card Header */}
                    <div className="p-3.5 sm:p-4 border-b border-white/5 flex items-center justify-between bg-black/25 shrink-0 gap-2 sm:gap-3">
                      {/* Left Side: Order Identifiers & Collapse Toggle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          {/* 縮小/收合按鈕 (置於左方，避免手機版寬度不足無法點擊) */}
                          <button
                            type="button"
                            onClick={() => toggleOrderCollapse(order.id)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg border border-white/15 text-white/90 hover:text-white transition cursor-pointer shrink-0 flex items-center justify-center shadow-sm"
                            title={
                              collapsedOrders.has(order.id)
                                ? '展開訂單 (Expand)'
                                : '縮小/收合訂單 (Collapse)'
                            }
                            aria-label={
                              collapsedOrders.has(order.id) ? '展開訂單' : '縮小/收合訂單'
                            }
                          >
                            {collapsedOrders.has(order.id) ? (
                              <ChevronDown size={15} />
                            ) : (
                              <ChevronUp size={15} />
                            )}
                          </button>
                          <span className="bg-white/5 border border-white/10 text-[#E5B453] font-mono font-bold text-xs px-2.5 py-0.5 rounded shrink-0">
                            {order.id}
                          </span>
                          {order.isPaid && (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)] shrink-0">
                              💳 櫃檯已結帳 (Paid)
                            </span>
                          )}
                          {collapsedOrders.has(order.id) && (
                            <span className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-bold shrink-0">
                              已收合 ({order.items.reduce((sum, item) => sum + item.qty, 0)} 份)
                            </span>
                          )}
                          {editingOrderId === order.id ? (
                            <div className="flex items-center gap-1 bg-black/40 border border-[#E5B453]/30 px-1.5 py-0.5 rounded-lg">
                              <select
                                value={editingTableValue}
                                onChange={(e) => setEditingTableValue(e.target.value)}
                                className="bg-black text-white font-bold text-xs rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-[#E5B453]"
                              >
                                <optgroup label="客席就座桌號">
                                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                                    (num) => (
                                      <option key={num} value={num}>
                                        🪑 第 {num} 桌
                                      </option>
                                    ),
                                  )}
                                  {tables &&
                                    tables.map(
                                      (t) =>
                                        !Array.from({ length: 12 }, (_, i) =>
                                          String(i + 1),
                                        ).includes(t.id) && (
                                          <option key={t.id} value={t.id}>
                                            🪑 第 {t.id} 桌
                                          </option>
                                        ),
                                    )}
                                </optgroup>
                                <optgroup label="外帶自取佇列">
                                  {Array.from({ length: 15 }, (_, i) => `外帶 #${i + 1}`).map(
                                    (takeoutId) => (
                                      <option key={takeoutId} value={takeoutId}>
                                        🛍️ {takeoutId}
                                      </option>
                                    ),
                                  )}
                                </optgroup>
                              </select>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (onUpdateTableNumber) {
                                    const res = await onUpdateTableNumber(
                                      order.id,
                                      editingTableValue,
                                    );
                                    if (res && !res.success) {
                                      alert(res.error || '無法變更桌號');
                                    } else {
                                      order.tableNumber = editingTableValue;
                                    }
                                  } else {
                                    order.tableNumber = editingTableValue;
                                  }
                                  setEditingOrderId(null);
                                }}
                                className="bg-[#E5B453] hover:bg-amber-400 text-black rounded p-1 cursor-pointer transition flex items-center justify-center font-bold"
                                title="確認 Save"
                              >
                                <Check size={11} className="stroke-[3]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingOrderId(null)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 rounded p-1 cursor-pointer transition flex items-center justify-center font-bold"
                                title="取消 Cancel"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-base text-white font-serif">
                                {order.tableNumber.includes('外帶')
                                  ? `${t('takeoutLabel')}${order.tableNumber.replace('外帶', '')}`
                                  : currentLang === 'en'
                                    ? `${t('tableLabel')} ${order.tableNumber}`
                                    : `${order.tableNumber} ${t('tableLabel')}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOrderId(order.id);
                                  setEditingTableValue(order.tableNumber);
                                }}
                                className="text-white/40 hover:text-[#E5B453] hover:bg-white/5 p-1 rounded transition cursor-pointer"
                                title="變更桌號 (Change Table)"
                              >
                                <Edit size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-white/40 font-mono">
                            {currentLang === 'zh' ? '下單' : 'Order'}:{' '}
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </span>
                          {lateCheck.isLate && (
                            <span
                              className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/35 text-[9px] font-black px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse"
                              title={`等待已有 ${Math.floor(lateCheck.currentWaitMins)}分鐘，大於該單餐點平均客製工時 1.5 倍（平均: ${lateCheck.avgPrepMins.toFixed(1)}m, 超時極限: ${lateCheck.limitMins.toFixed(1)}m`}
                            >
                              <Timer size={10} />
                              <span>
                                🚨 {currentLang === 'zh' ? '製作溢時' : 'Prep Overdue'} (
                                {Math.floor(lateCheck.currentWaitMins)}m /{' '}
                                {currentLang === 'zh' ? '限制' : 'Limit'}{' '}
                                {Math.floor(lateCheck.limitMins)}m)
                              </span>
                            </span>
                          )}
                          {isCloseToClosing(order.createdAt, operatingHours) && (
                            <span
                              className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse"
                              title="訂單於結業前 30 分鐘內進入，請優先且速配餐"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-red-450 animate-ping mr-0.5" />
                              <span>{t('closingSoonRushAlert')}</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setQuickViewOrder(order)}
                            className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/10 hover:border-sky-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                            title="單一訂單細節快速檢視 (Quick View Details)"
                          >
                            <Eye size={10} />
                            <span>{t('quickViewBtn')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const specLines = order.items
                                .map((it) => {
                                  const spec = [
                                    it.customization.spiciness === 0
                                      ? t('notSpicy')
                                      : it.customization.spiciness === 1
                                        ? t('mildSpicy')
                                        : it.customization.spiciness === 2
                                          ? t('mediumSpicy')
                                          : t('thaiSpicy'),
                                    it.customization.sweetness === 0
                                      ? t('sugarFree')
                                      : it.customization.sweetness === 1
                                        ? t('sweet30')
                                        : it.customization.sweetness === 2
                                          ? t('sweet50')
                                          : t('sweet100'),
                                    it.customization.noodleType === 'rice-noodle'
                                      ? t('riceNoodle')
                                      : it.customization.noodleType === 'vermicelli'
                                        ? t('vermicelli')
                                        : '',
                                    it.customization.soupBase === 'coconut-milk'
                                      ? t('coconutMilkAdd')
                                      : '',
                                    it.customization.notes
                                      ? `${t('notesLabel')}: ${it.customization.notes}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join('/');
                                  const itName = getLocalizedText(it.name, currentLang);
                                  return `[ ] ${itName} x ${it.qty} ${t('qtyPortion')}\n    【 ${spec} 】`;
                                })
                                .join('\n');
                              const ticketStr = `
========================================
       沙貝燒烤 (廚房工作即時交代單)
       桌號/標記: ${order.tableNumber}
========================================
單號 ID: ${order.id}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${new Date(order.createdAt).toLocaleTimeString()}
狀態 STATE: ${order.status.toUpperCase()}
----------------------------------------
餐點項目與客製需求 Kitchen Item(s):
${specLines}
----------------------------------------
* KDS TICKET PRINT PREVIEW GENERATED OK *
* 感謝廚房人員辛勞，請於出餐完畢時完成確認 *
========================================`.trim();
                              setPrintConfirmData({
                                title: `驗證列印廚房交代票 #${order.id}`,
                                ip: printerIp,
                                receiptType: 'kitchen',
                                receiptBody: ticketStr,
                                onConfirm: () => {
                                  alert(`🖨️ 虛擬網卡列印指令傳送正常！(單號: ${order.id})`);
                                },
                              });
                            }}
                            className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-[#E5B453]/20 hover:border-[#E5B453]/40 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                            title="熱感出單前預覽虛擬收據 Print Preview and Cue"
                          >
                            <Printer size={10} className="text-[#E5B453]" />
                            <span>{t('printPreviewBtn')}</span>
                          </button>
                        </div>
                      </div>

                      {/* Middle: Live 'Time Elapsed' wait clock & Table Occupancy Timer column (color-coded) */}
                      <div className="flex flex-col items-center justify-center border-x border-white/5 px-2.5 min-w-[110px] gap-2">
                        <div className="text-center w-full">
                          <span
                            className={`text-[9px] font-bold tracking-wider block font-sans uppercase ${
                              order.status === 'pending' ? 'text-[#E5B453]' : 'text-sky-450'
                            }`}
                          >
                            {order.status === 'pending' ? t('pendingWaitState') : t('prepState')}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-black font-mono px-1.5 py-0.5 rounded border mt-0.5 ${elapsed.style}`}
                          >
                            <Clock size={10} className={elapsed.mins > 15 ? 'animate-pulse' : ''} />
                            <span>{elapsed.text}</span>
                          </span>
                          {order.status === 'pending' && elapsed.mins > 15 && (
                            <div className="text-[8px] text-red-500 font-extrabold mt-0.5 animate-pulse uppercase tracking-tight">
                              ⚠️ 待辦超時 Overdue
                            </div>
                          )}
                        </div>

                        {occ && (
                          <div className="text-center w-full border-t border-white/5 pt-1.5">
                            <span
                              className="text-[9px] text-white/35 font-bold tracking-wider block font-sans uppercase"
                              title="該桌自首筆點單起算之累計時間 (Tracks session duration for table turnover)"
                            >
                              {order.tableNumber.includes('外帶')
                                ? '顧客滯留 Live'
                                : '桌況佔用 Seated'}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-black font-mono px-1.5 py-0.5 rounded border mt-0.5 ${occ.style}`}
                              title={`首筆訂單編號: #${occ.oldestOrderId}`}
                            >
                              <Timer
                                size={10}
                                className={
                                  occ.minutes >= 30
                                    ? 'animate-pulse font-bold text-[#E5B453]'
                                    : 'text-sky-450'
                                }
                              />
                              <span>{occ.text}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Side: Urgency Status Badge & Special Attention Flag */}
                      <div className="text-right flex flex-col items-end justify-center gap-1.5 min-w-[70px] shrink-0">
                        <span
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${urg.style}`}
                        >
                          {urg.text}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            toggleFlagState(order.id, !!order.isFlagged, order.flagReason || '')
                          }
                          className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer border ${
                            order.isFlagged
                              ? 'bg-red-500 text-white border-red-600 font-extrabold animate-pulse'
                              : 'bg-white/5 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40'
                          }`}
                          title={
                            order.isFlagged
                              ? '取消特別關注標記 (Clear Flag)'
                              : '將此訂單標記為特別關注 (Flag Order)'
                          }
                        >
                          <Flag size={10} className={order.isFlagged ? 'fill-white' : ''} />
                          <span>{order.isFlagged ? '已標記關注' : '關注標記'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Ingredients detailed tasks in Chinese */}
                    {!collapsedOrders.has(order.id) && (
                      <>
                        <div className="p-5 flex-1 min-h-[140px] space-y-4">
                          <div className="space-y-3.5">
                            {order.items.map((it, idx) => {
                              const menuItem = menuItems.find((mi) => mi.id === it.menuItemId);
                              const isMatch =
                                selectedCategory === 'all' ||
                                (menuItem && menuItem.category === selectedCategory);
                              const canInteract = kdsRole === 'admin' || kdsRole === 'kitchen';
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-between border-b border-dashed border-white/5 pb-2.5 transition-all duration-200 gap-3 ${
                                    isMatch ? 'opacity-100' : 'opacity-20 scale-[0.98]'
                                  } ${it.isCompleted ? 'bg-emerald-950/15 px-2.5 py-1.5 rounded-lg border border-emerald-500/20' : it.isPrepared ? 'bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-500/25' : ''}`}
                                >
                                  <div
                                    className={`text-left flex-1 min-w-0 ${it.isCompleted ? 'opacity-40' : ''}`}
                                  >
                                    <span
                                      className={`font-bold text-white text-sm block ${it.isCompleted ? 'line-through text-zinc-400' : ''}`}
                                    >
                                      {getLocalizedText(it.name, currentLang)}{' '}
                                      <strong className="text-[#E5B453] font-mono text-base">
                                        x {it.qty}
                                      </strong>{' '}
                                      {t('qtyPortion')}
                                      {!isMatch && (
                                        <span className="ml-1.5 inline-block text-[9px] bg-zinc-800 text-zinc-500 font-medium px-1 rounded select-none">
                                          非選定分區
                                        </span>
                                      )}
                                    </span>

                                    {/* customize modifiers indicator */}
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      <span className="bg-white/5 text-white/85 border border-white/15 text-[10px] font-semibold px-1 rounded font-sans">
                                        {t('sweet')}:{' '}
                                        {it.customization.sweetness === 0
                                          ? t('sugarFree')
                                          : it.customization.sweetness === 1
                                            ? t('sweet30')
                                            : it.customization.sweetness === 2
                                              ? t('sweet50')
                                              : t('sweet100')}
                                      </span>
                                      <span className="bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/20 text-[10px] font-semibold px-1 rounded font-mono">
                                        {t('spicyPrefix')}:{' '}
                                        {it.customization.spiciness === 0
                                          ? t('notSpicy')
                                          : it.customization.spiciness === 1
                                            ? t('mildSpicy')
                                            : it.customization.spiciness === 2
                                              ? t('mediumSpicy')
                                              : t('thaiSpicy')}
                                      </span>
                                      {it.customization.noodleType && (
                                        <span className="bg-[#E5B453]/10 text-[#E5B453] border border-[#E5B453]/20 text-[10px] font-semibold px-1 rounded font-sans">
                                          {t('noodlePrefix')}:{' '}
                                          {it.customization.noodleType === 'rice-noodle'
                                            ? t('riceNoodle')
                                            : it.customization.noodleType === 'vermicelli'
                                              ? t('vermicelli')
                                              : t('noNoodle')}
                                        </span>
                                      )}
                                      {it.customization.soupBase === 'coconut-milk' && (
                                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-semibold px-1 rounded font-mono">
                                          {t('coconutMilkAdd')}
                                        </span>
                                      )}
                                      {it.customization.selectedAddOns?.map((addOn) => (
                                        <span
                                          key={addOn.id}
                                          className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold px-1.5 py-0.5 rounded font-sans"
                                        >
                                          +{getLocalizedText(addOn.name, currentLang)}
                                        </span>
                                      ))}
                                    </div>

                                    {it.customization.notes && (
                                      <p className="text-xs text-[#FF4D4D] bg-[#FF4D4D]/5 border border-[#FF4D4D]/15 p-2.5 rounded-xl font-sans mt-2.5">
                                        📌 {t('notesLabel')}：{it.customization.notes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {!it.isCompleted && !it.isPrepared && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (true) {
                                            handleItemStatusToggle(order.id, it.id, false, true);
                                          }
                                        }}
                                        className="h-10 px-3 rounded-xl text-xs font-black transition-all duration-200 shadow-sm flex items-center justify-center gap-1 border cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/10"
                                        title="標示為已備餐 (Mark as Prepared)"
                                      >
                                        <ChefHat size={14} />
                                        <span>{t('itemPreparedBtn')}</span>
                                      </button>
                                    )}

                                    {!it.isCompleted && it.isPrepared && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (true) {
                                              handleItemStatusToggle(order.id, it.id, false, false);
                                            }
                                          }}
                                          className="h-10 px-2 rounded-xl text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1 border cursor-pointer bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                          title="點擊可取消已備餐狀態"
                                        >
                                          <ChefHat size={12} />
                                          <span>{t('itemPreparedBtn')}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (true) {
                                              handleItemStatusToggle(order.id, it.id, true, true);
                                            }
                                          }}
                                          className="h-10 px-3.5 rounded-xl text-xs font-black transition-all duration-200 shadow-sm flex items-center justify-center gap-1 border cursor-pointer bg-[#1e1e1e] hover:bg-[#252525] text-emerald-400 hover:text-emerald-300 border-emerald-500/35 hover:border-emerald-500 shadow-black/20"
                                          title="標示為製作完成 (Mark as Completed)"
                                        >
                                          <span>{t('itemMakeCompleteBtn')}</span>
                                        </button>
                                      </>
                                    )}

                                    {it.isCompleted && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (true) {
                                            handleItemStatusToggle(order.id, it.id, false, false);
                                          }
                                        }}
                                        className="h-10 px-4 rounded-xl text-xs font-black transition-all duration-200 shadow-sm flex items-center justify-center gap-1 border cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-[#0F0F0F] border-emerald-400 shadow-emerald-500/10"
                                        title="標示為未完成 (Mark as Pending)"
                                      >
                                        <Check size={14} className="stroke-[3]" />
                                        <span>{t('itemCompletedBtn')}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Special Attention Flag Section */}
                          {(flaggingOrderId === order.id || order.isFlagged) && (
                            <div className="mt-4 pt-3 border-t border-dashed border-white/5 space-y-2">
                              {flaggingOrderId === order.id && (
                                <div
                                  className="bg-red-950/40 border border-red-500/30 rounded-lg p-2.5 space-y-2 text-left"
                                  id={`flag-editor-${order.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-red-400 font-bold flex items-center gap-1.5 uppercase tracking-wide">
                                      <Flag size={10} className="text-red-500 fill-red-500" />
                                      特別關注原因 (Attention Reason)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFlaggingOrderId(null);
                                        setFlagError(null);
                                      }}
                                      className="text-white/40 hover:text-white p-0.5"
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>

                                  <input
                                    type="text"
                                    value={flagReasonInput}
                                    onChange={(e) => setFlagReasonInput(e.target.value)}
                                    placeholder="請輸入關注原因（例如：餐點特製少鹽、急催出餐、湯少...）"
                                    className="w-full bg-black/60 border border-red-500/20 text-xs text-white px-2 py-1.5 rounded focus:outline-none focus:border-red-500 font-sans"
                                  />

                                  {flagError && (
                                    <p className="text-[9px] text-red-400 font-mono text-left">
                                      {flagError}
                                    </p>
                                  )}

                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFlaggingOrderId(null);
                                        setFlagError(null);
                                      }}
                                      className="bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-[10px] px-2 py-0.5 rounded transition font-bold"
                                    >
                                      取消
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => submitFlagReason(order.id)}
                                      className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-2.5 py-0.5 rounded transition font-black"
                                    >
                                      確定標記
                                    </button>
                                  </div>
                                </div>
                              )}

                              {order.isFlagged && (
                                <div
                                  className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-3 space-y-1 text-left animate-pulse"
                                  id={`active-flag-${order.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-red-500 font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                                      <AlertTriangle size={12} className="text-red-500" />
                                      🛑 特別關注 ORDER FLAGGED
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleFlagState(order.id, true, '')}
                                      className="text-zinc-400 hover:text-red-500 text-[10px] font-bold border border-red-500/20 px-1.5 py-0.2 rounded hover:bg-red-500/10"
                                    >
                                      取消關注
                                    </button>
                                  </div>
                                  <p className="text-xs text-red-400 font-bold bg-black/30 p-2 rounded border border-red-500/15 mt-1 font-sans">
                                    ⚠️ 原因：{order.flagReason || '店員未備註具體原因'}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quick Notes Section */}
                          <div className="mt-4 pt-3 border-t border-dashed border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-white/40 font-bold flex items-center gap-1">
                                <Mic size={10} className="text-[#E5B453]" />
                                KDS 快速備註 (Quick Notes/Dictations)
                              </span>
                              {/* Micro-microphone trigger */}
                              <button
                                type="button"
                                onClick={() => startDictation(order.id)}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 transition-all cursor-pointer ${
                                  dictatingOrderId === order.id && isDictating
                                    ? 'bg-red-500/20 text-red-500 border-red-500/40 animate-pulse font-black'
                                    : 'bg-white/5 text-[#E5B453] border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {dictatingOrderId === order.id && isDictating ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                    <span>正在錄音...</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={10} />
                                    <span>🎙️ 語音語音</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {dictatingOrderId === order.id && (
                              <div className="bg-black/40 border border-[#E5B453]/20 rounded-lg p-2 space-y-2">
                                {/* Listening Wave Simulation */}
                                {isDictating && (
                                  <div className="flex items-center gap-1 justify-center py-1">
                                    <span className="w-1 h-3 bg-red-400 rounded animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1 h-5 bg-red-500 rounded animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1 h-4 bg-red-400 rounded animate-bounce" />
                                    <span className="w-1 h-2 bg-red-300 rounded animate-bounce [animation-delay:-0.45s]" />
                                  </div>
                                )}

                                <textarea
                                  className="w-full bg-black/60 border border-white/10 text-xs text-white p-1.5 rounded focus:outline-none focus:border-[#E5B453] text-left font-sans h-12 resize-none"
                                  placeholder={
                                    isDictating
                                      ? '正在傾聽並將語音轉換成文字...'
                                      : '請按下方按鈕或在此輸入備註/口頭指令...'
                                  }
                                  value={dictatedText}
                                  onChange={(e) => setDictatedText(e.target.value)}
                                />

                                {noteError && (
                                  <p className="text-[9px] text-red-400 text-left font-mono">
                                    {noteError}
                                  </p>
                                )}

                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={cancelDictation}
                                    className="bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-[10px] px-2 py-0.5 rounded transition font-bold"
                                  >
                                    取消
                                  </button>
                                  {isDictating && (
                                    <button
                                      type="button"
                                      onClick={stopRecordingAndParse}
                                      className="bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] text-[10px] px-2 py-0.5 rounded transition font-black"
                                    >
                                      停止/解析
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => saveDictatedNote(order.id)}
                                    className="bg-[#00C300] hover:bg-[#00E500] text-black text-[10px] px-2 py-0.5 rounded transition font-black"
                                  >
                                    儲存備註
                                  </button>
                                </div>
                              </div>
                            )}

                            {order.quickNotes ? (
                              <div className="bg-[#E5B453]/5 border border-[#E5B453]/25 rounded-lg p-2 flex items-start justify-between gap-1.5 text-left">
                                <div className="space-y-1">
                                  <p className="text-[11px] text-[#E5B453] font-bold font-sans">
                                    📝 {order.quickNotes}
                                  </p>
                                  <span className="text-[8px] text-zinc-500 font-mono">
                                    經 KDS Dictate 語音處理
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => clearQuickNote(order.id)}
                                  className="text-zinc-500 hover:text-[#FF4D4D] p-0.5 transition cursor-pointer"
                                  title="清除備註"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              !dictatingOrderId && (
                                <p className="text-[9px] text-zinc-500 italic block text-left">
                                  暫無臨時備註，可使用麥克風錄製或口述
                                </p>
                              )
                            )}
                          </div>
                        </div>

                        {/* Interactive Status updater actions */}
                        <div className="p-4 bg-black/20 border-t border-white/5 flex items-center justify-between shrink-0">
                          <div className="flex flex-col gap-0.5 text-left">
                            <span className="text-white/40 text-[10px] font-bold uppercase font-mono flex items-center gap-1">
                              <span>付費: {order.paymentMethod.toUpperCase()}</span>
                              {order.isPaid && (
                                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.2 rounded">
                                  💳 已結帳
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] text-[#00C300]/75 font-black tracking-wide animate-pulse select-none hidden sm:inline-block">
                              🤝 支援右滑直接出餐 Complete
                            </span>
                          </div>

                          <div className="flex space-x-1.5">
                            {order.status === 'pending' && (
                              <>
                                <button
                                  id={`kds-accept-btn-${order.id}`}
                                  onClick={() => handleStatusChange(order.id, 'preparing')}
                                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-1.5 rounded-lg font-black text-xs flex items-center space-x-1 transition cursor-pointer animate-pulse ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/20"
                                >
                                  <Check size={13} className="stroke-[3]" />
                                  <span>{t('acceptOrderBtn')}</span>
                                </button>

                                <button
                                  id={`kds-decline-btn-${order.id}`}
                                  onClick={() => handleStatusChange(order.id, 'cancelled')}
                                  className="bg-rose-500/10 hover:bg-rose-500/25 text-rose-500 border border-rose-500/20 px-3.5 py-1.5 rounded-lg font-black text-xs flex items-center space-x-1 transition cursor-pointer"
                                >
                                  <X size={13} className="stroke-[3]" />
                                  <span>{t('declineOrderBtn')}</span>
                                </button>
                              </>
                            )}

                            {order.status === 'preparing' && (
                              <>
                                <button
                                  id={`kds-complete-btn-${order.id}`}
                                  onClick={() => handleStatusChange(order.id, 'completed')}
                                  className="bg-[#00C300] hover:bg-emerald-500 text-[#0F0F0F] px-4 py-1.5 rounded-lg font-black text-xs flex items-center space-x-1 transition cursor-pointer animate-pulse"
                                >
                                  <Check size={13} />
                                  <span>出餐完成</span>
                                </button>

                                <button
                                  id={`kds-cancel-btn-${order.id}`}
                                  onClick={() => handleStatusChange(order.id, 'cancelled')}
                                  className="bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/25 text-[#FF4D4D] border border-rose-500/20 px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition cursor-pointer"
                                  title="取消此單"
                                >
                                  <Ban size={12} />
                                  <span>刪除</span>
                                </button>
                              </>
                            )}

                            {order.status === 'paid' && (
                              <>
                                <button
                                  id={`kds-paid-complete-btn-${order.id}`}
                                  onClick={async () => {
                                    playStatusBeepSound();
                                    setBeepSim(true);
                                    setTimeout(() => setBeepSim(false), 800);
                                    try {
                                      const res = await apiFetch(
                                        `/api/orders/${order.id}/complete`,
                                        {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                        },
                                      );
                                      if (res.ok) {
                                        await onUpdateOrderStatus(order.id, 'completed');
                                      }
                                    } catch (err) {
                                      console.warn('[KDS] Complete paid order failed:', err);
                                      await onUpdateOrderStatus(order.id, 'completed');
                                    }
                                  }}
                                  className="bg-[#00C300] hover:bg-emerald-500 text-[#0F0F0F] px-4 py-1.5 rounded-lg font-black text-xs flex items-center space-x-1.5 transition cursor-pointer animate-pulse ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/20"
                                >
                                  <Check size={13} className="stroke-[3]" />
                                  <span>出餐完成</span>
                                </button>

                                <span className="text-emerald-400 text-[10px] font-bold flex items-center space-x-0.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg">
                                  <span>💳 已結帳</span>
                                </span>
                              </>
                            )}

                            {order.status === 'completed' && (
                              <span className="text-[#00C300] text-xs font-bold flex items-center space-x-0.5">
                                <Check size={14} />
                                <span>已順利出餐 Done</span>
                              </span>
                            )}

                            {order.status === 'cancelled' && (
                              <span className="text-white/30 text-xs font-bold line-through">
                                已廢棄 Cancel
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ────────── HORIZONTAL HOURLY PROGRESS BAR CHART & PREDICTIVE ANALYTICS ────────── */}
        <KdsHourlyChart
          activeChartTab={activeChartTab}
          setActiveChartTab={setActiveChartTab}
          orders={orders}
          hourlyData={getHourlyData()}
          maxCount={maxCount}
          predictionData={predictionData}
          CustomTooltip={CustomTooltip}
        />
      </div>

      {/* LAN Receipt Printer Simulator Terminal Sidebar */}
      <div className="space-y-4 font-sans">
        {/* 🛑 Kitchen Service Pause Toggle */}
        <div
          className="bg-[#161616] border border-orange-500/20 rounded-xl p-5 space-y-4 font-sans text-left"
          id="kds-emergency-control"
        >
          <div className="border-b border-orange-500/10 pb-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-orange-400 tracking-widest block uppercase font-sans">
                緊急狀態與客流量控制 Emergency Control
              </span>
              <h4 className="font-bold text-sm mt-0.5 text-white font-serif">
                廚房「暫停接單」機制 Service Pause Toggle
              </h4>
            </div>
            <div
              className={`p-1 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider ${servicePaused ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20 animate-pulse' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}
            >
              {servicePaused ? '🔴 暫停服務中 (Paused)' : '🟢 正常接單中 (Normal)'}
            </div>
          </div>

          <div className="space-y-3.5 text-xs font-sans">
            <p className="text-[11px] text-zinc-400 leading-normal">
              當店內排隊或現場單量過大、廚房人力飽和時，一鍵啟用暫停接單機制。啟用後：
            </p>
            <ul className="list-disc pl-4 text-[10.5px] text-zinc-400 space-y-1.5 leading-relaxed">
              <li>
                顧客點餐首頁將<strong>即時彈出橙紅色警示橫幅</strong>，通知廚房正在全力消化訂單中。
              </li>
              <li>
                <strong>鎖定「送出訂單」功能</strong>，但顧客仍可自由流覽餐點與加點歷史。
              </li>
              <li>
                系統會自動將狀態<strong>推播至前台通知欄</strong>。
              </li>
            </ul>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onToggleServicePause && onToggleServicePause(!servicePaused)}
                className={`w-full py-2.5 rounded-lg font-extrabold text-[12px] shadow-md tracking-wider transition duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                  servicePaused
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/20'
                    : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white shadow-rose-950/20'
                }`}
              >
                <span>
                  {servicePaused
                    ? '⚡ 恢復正常營運接單 (Resume Service)'
                    : '🛑 啟動廚房「暫停接單」 (Pause Service)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* KDS Real-time Menu & Inventory Controller Card */}
        <div
          className="bg-[#161616] border border-white/10 text-white rounded-xl p-5 shadow-lg space-y-4"
          id="kds-quick-controller-card"
        >
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="text-[#E5B453] shrink-0 font-bold animate-spin-slow" size={18} />
              <div className="text-left font-sans">
                <span className="text-[10px] text-[#E5B453] font-bold block uppercase tracking-widest">
                  KDS Operations
                </span>
                <span className="text-xs font-black text-white">即時營運及供應鏈控制</span>
              </div>
            </div>
            <div className="flex bg-black/45 p-0.5 rounded-lg border border-white/5 font-sans">
              <button
                type="button"
                onClick={() => setKdsActiveTab('menu')}
                className={`px-2 py-1 rounded text-[10px] font-black transition cursor-pointer select-none active:scale-95 ${
                  kdsActiveTab === 'menu'
                    ? 'bg-[#E5B453] text-[#0F0F0F]'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                品項沽清
              </button>
              <button
                type="button"
                onClick={() => setKdsActiveTab('ingredients')}
                className={`px-2 py-1 rounded text-[10px] font-black transition cursor-pointer select-none active:scale-95 ${
                  kdsActiveTab === 'ingredients'
                    ? 'bg-[#E5B453] text-[#0F0F0F]'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                即時庫存
              </button>
            </div>
          </div>

          {kdsActiveTab === 'menu' ? (
            <div className="space-y-3.5 font-sans">
              {/* Menu Filter and Search */}
              <div className="flex gap-1.5 flex-col">
                <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
                  <button
                    type="button"
                    onClick={() => setKdsSelectedCategory('all')}
                    className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold transition border cursor-pointer select-none active:scale-95 ${
                      kdsSelectedCategory === 'all'
                        ? 'bg-[#E5B453]/20 text-[#E5B453] border-[#E5B453]/40'
                        : 'bg-transparent text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    全部品項
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setKdsSelectedCategory(cat.id)}
                      className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold transition border cursor-pointer select-none active:scale-95 ${
                        kdsSelectedCategory === cat.id
                          ? 'bg-[#E5B453]/20 text-[#E5B453] border-[#E5B453]/40'
                          : 'bg-transparent text-zinc-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {getLocalizedText(cat.name, currentLang) || cat.id}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={kdsMenuSearch}
                    onChange={(e) => setKdsMenuSearch(e.target.value)}
                    placeholder="搜尋大廚備料 / 菜名..."
                    className="w-full bg-black/45 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#E5B453]/60 pr-7"
                  />
                  {kdsMenuSearch && (
                    <button
                      type="button"
                      onClick={() => setKdsMenuSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Menu Items List */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {menuItems
                  .filter((item) => {
                    const matchesCategory =
                      kdsSelectedCategory === 'all' || item.category === kdsSelectedCategory;
                    const matchesSearch =
                      !kdsMenuSearch ||
                      getLocalizedText(item.name, 'zh')
                        .toLowerCase()
                        .includes(kdsMenuSearch.toLowerCase()) ||
                      (getLocalizedText(item.name, 'en') &&
                        getLocalizedText(item.name, 'en')
                          .toLowerCase()
                          .includes(kdsMenuSearch.toLowerCase()));
                    return matchesCategory && matchesSearch;
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-black/25 hover:bg-black/45 border border-white/5 flex items-center justify-between text-xs transition"
                    >
                      <div className="text-left flex-1 min-w-0 mr-2">
                        <p className="font-bold text-white truncate text-[11px]">
                          {getLocalizedText(item.name, 'zh')}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-mono truncate">ID: {item.id}</p>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                            item.available
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.available ? '販售' : '沽清'}
                        </span>
                        {onToggleMenuItemAvailability && (
                          <button
                            type="button"
                            disabled={togglingMenuId === item.id}
                            onClick={async () => {
                              try {
                                setTogglingMenuId(item.id);
                                await onToggleMenuItemAvailability(item.id);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setTogglingMenuId(null);
                              }
                            }}
                            className={`px-2 py-1 rounded text-[9px] font-bold border transition select-none active:scale-95 disabled:opacity-50 cursor-pointer ${
                              item.available
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/25'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                            }`}
                          >
                            {item.available ? '下架' : '上架'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 font-sans">
              {/* Ingredients Stock list */}
              <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                {ingredients.map((ig) => {
                  const isWarning = ig.stock <= ig.minThreshold;
                  const manualVal = ingredientManualQty[ig.id] ?? '';
                  return (
                    <div
                      key={ig.id}
                      className={`p-2 rounded-lg bg-black/25 border flex flex-col space-y-2 text-xs transition ${
                        isWarning ? 'border-rose-500/20 bg-rose-500/5' : 'border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left min-w-0">
                          <p className="font-bold text-white text-[11px] flex items-center gap-1">
                            <span>{getLocalizedText(ig.name, 'zh')}</span>
                            {isWarning && (
                              <span className="text-[9px] text-rose-400 font-extrabold flex items-center gap-0.5 shrink-0 bg-rose-500/10 px-1 rounded border border-rose-500/15">
                                <AlertTriangle size={9} />
                                告警
                              </span>
                            )}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono">
                            剩餘:{' '}
                            <b
                              className={`font-semibold ${isWarning ? 'text-rose-400' : 'text-zinc-300'}`}
                            >
                              {ig.stock}
                            </b>{' '}
                            {ig.unit} / 門檻: {ig.minThreshold}
                          </p>
                        </div>
                      </div>

                      {/* Adjust buttons */}
                      <div className="flex gap-1 items-center justify-between">
                        <div className="flex items-center space-x-1 shrink-0 font-mono">
                          <button
                            type="button"
                            disabled={adjustingIngredientId === ig.id}
                            onClick={async () => {
                              if (onAdjustIngredientStock) {
                                setAdjustingIngredientId(ig.id);
                                await onAdjustIngredientStock(ig.id, -10, 'KDS螢幕快捷調減 -10');
                                setAdjustingIngredientId(null);
                              }
                            }}
                            className="bg-zinc-800 hover:bg-zinc-750 text-white/90 text-[10px] w-7 h-6 rounded flex items-center justify-center font-bold transition select-none active:scale-90 cursor-pointer disabled:opacity-40"
                          >
                            -10
                          </button>
                          <button
                            type="button"
                            disabled={adjustingIngredientId === ig.id}
                            onClick={async () => {
                              if (onAdjustIngredientStock) {
                                setAdjustingIngredientId(ig.id);
                                await onAdjustIngredientStock(ig.id, -1, 'KDS螢幕快捷調減 -1');
                                setAdjustingIngredientId(null);
                              }
                            }}
                            className="bg-zinc-800 hover:bg-zinc-750 text-white/90 text-[10px] w-6 h-6 rounded flex items-center justify-center font-bold transition select-none active:scale-90 cursor-pointer disabled:opacity-40"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            disabled={adjustingIngredientId === ig.id}
                            onClick={async () => {
                              if (onAdjustIngredientStock) {
                                setAdjustingIngredientId(ig.id);
                                await onAdjustIngredientStock(ig.id, 1, 'KDS螢幕快捷調增 +1');
                                setAdjustingIngredientId(null);
                              }
                            }}
                            className="bg-zinc-850 hover:bg-zinc-800 text-[#E5B453] text-[10px] w-6 h-6 rounded flex items-center justify-center font-bold transition select-none active:scale-90 cursor-pointer disabled:opacity-40"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={adjustingIngredientId === ig.id}
                            onClick={async () => {
                              if (onAdjustIngredientStock) {
                                setAdjustingIngredientId(ig.id);
                                await onAdjustIngredientStock(ig.id, 10, 'KDS螢幕快捷調增 +10');
                                setAdjustingIngredientId(null);
                              }
                            }}
                            className="bg-zinc-850 hover:bg-zinc-800 text-[#E5B453] text-[10px] w-7 h-6 rounded flex items-center justify-center font-bold transition select-none active:scale-90 cursor-pointer disabled:opacity-40"
                          >
                            +10
                          </button>
                        </div>

                        {/* Custom input adjust */}
                        <div className="flex items-center space-x-1 flex-1 max-w-[105px]">
                          <input
                            type="text"
                            value={manualVal}
                            onChange={(e) =>
                              setIngredientManualQty({
                                ...ingredientManualQty,
                                [ig.id]: e.target.value,
                              })
                            }
                            placeholder="自訂"
                            className="bg-black/65 border border-white/10 text-white font-mono text-[10px] rounded px-1.5 py-1 w-full text-center focus:outline-none focus:border-[#E5B453]"
                          />
                          <button
                            type="button"
                            disabled={adjustingIngredientId === ig.id || !manualVal}
                            onClick={async () => {
                              const parsed = parseFloat(manualVal);
                              if (isNaN(parsed)) return;
                              if (onAdjustIngredientStock) {
                                setAdjustingIngredientId(ig.id);
                                await onAdjustIngredientStock(
                                  ig.id,
                                  parsed,
                                  `KDS螢幕自訂異動盤庫 (${parsed > 0 ? '+' : ''}${parsed})`,
                                );
                                setIngredientManualQty({ ...ingredientManualQty, [ig.id]: '' });
                                setAdjustingIngredientId(null);
                              }
                            }}
                            className="bg-[#E5B453] hover:bg-amber-400 text-black font-black text-[9px] w-7 h-6 rounded flex items-center justify-center transition active:scale-[0.85] disabled:opacity-40 cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#161616] border border-white/10 text-white rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2 flex-1 mr-2">
              <Printer className="text-[#E5B453] shrink-0 font-bold" size={18} />
              <div className="text-left w-full">
                <span className="text-[10px] text-white/40 block font-mono">LAN BILL PRINTER</span>
                {isEditingIp ? (
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <input
                      type="text"
                      className="bg-black border border-white/20 text-white font-mono text-[11px] font-bold rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-[#E5B453]"
                      value={ipInput}
                      onChange={(e) => setIpInput(e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        setPrinterError(null);
                        setPrinterSuccess(null);
                        const res = await onUpdatePrinterIp(ipInput);
                        if (res.success) {
                          setPrinterSuccess('位址設定成功！');
                          setIsEditingIp(false);
                        } else {
                          setPrinterError(res.error || '儲存失敗');
                        }
                      }}
                      className="bg-[#E5B453] text-[#0F0F0F] hover:bg-amber-400 font-extrabold text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition active:scale-95"
                    >
                      儲存
                    </button>
                    <button
                      onClick={() => {
                        setIpInput(printerIp);
                        setIsEditingIp(false);
                      }}
                      className="bg-white/15 h-5 text-white/75 hover:bg-white/25 text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition active:scale-95"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-1 mt-0.5">
                      <span className="text-xs font-bold font-mono text-zinc-300">{printerIp}</span>
                      <button
                        onClick={() => setIsEditingIp(true)}
                        className="text-white/40 hover:text-[#E5B453] transition rounded p-0.5 cursor-pointer active:scale-95"
                        title="修改印表機位址"
                      >
                        <Edit size={11} />
                      </button>
                    </div>

                    {/* Printer Connection Status Badge & Helper Actions */}
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 pt-0.5">
                      {pingState.loading ? (
                        <span className="inline-flex items-center gap-1 text-[9px] bg-white/5 text-zinc-400 border border-white/10 px-1.5 py-0.5 rounded font-bold">
                          <RefreshCw size={8} className="animate-spin text-zinc-400" />
                          偵測中...
                        </span>
                      ) : pingState.reachable ? (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-extrabold"
                          title={
                            pingState.lastChecked
                              ? `連線狀態: 本機與實體印表機連線正常 (最後偵測: ${pingState.lastChecked})`
                              : ''
                          }
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          在線 🟢
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-extrabold"
                          title={
                            pingState.error
                              ? `連線錯誤原因: ${pingState.error}`
                              : '無法通訊，請檢查網路配置、實體印表機電源及區域網路插口'
                          }
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          離線 🔴
                        </span>
                      )}

                      {/* Manual Refresh button */}
                      <button
                        onClick={() => triggerPrinterPing(printerIp)}
                        disabled={pingState.loading}
                        className="text-[9px] text-[#E5B453] hover:text-white bg-white/5 border border-white/5 px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer hover:bg-white/10 transition active:scale-95 disabled:opacity-45"
                        title="立即重新測試與印表機的實體網路通訊"
                      >
                        <RefreshCw size={8} />
                        <span>測通</span>
                      </button>
                    </div>
                    {pingState.error && !pingState.skipped && (
                      <div className="w-full mt-1">
                        <InlineRetryMessage
                          message={`印表機連線失敗 (${pingState.error})`}
                          onRetry={handleRetryPing}
                          onSkip={handleSkipPing}
                          isRetrying={pingState.loading}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                id="export-print-logs-csv-btn"
                onClick={() => {
                  if (!printLogs || printLogs.length === 0) {
                    alert(
                      '⚠️ 目前尚無任何虛擬出單記錄可供匯出！ There is no virtual print history to export.',
                    );
                    return;
                  }

                  // CSV Generation logic with headers or content lines
                  const headers = [
                    'Index',
                    'Type',
                    'Timestamp',
                    'Header/Table',
                    'Details Summary',
                    'Raw Ticket Text',
                  ];

                  const rows = printLogs.map((log, index) => {
                    const rawContent = log.content || '';
                    const cleanContent = rawContent.replace(/"/g, '""');
                    const lines = rawContent.split('\n');
                    let tableMark = 'N/A';
                    let descriptionStr = '';

                    lines.forEach((line: string) => {
                      if (line.includes('桌號/標記') || line.includes('Table')) {
                        const parts = line.split(':');
                        tableMark = parts[1] ? parts[1].trim() : '';
                      }
                    });

                    // Summarize items for high level description
                    const itemsArr: string[] = [];
                    lines.forEach((line: string) => {
                      if (
                        line.includes('[ ]') ||
                        line.trim().startsWith('•') ||
                        line.includes('x')
                      ) {
                        const trimmedLine = line.replace(/\[\s*\]/g, '').trim();
                        if (
                          trimmedLine.length > 0 &&
                          !trimmedLine.includes('======') &&
                          !trimmedLine.includes('------')
                        ) {
                          itemsArr.push(trimmedLine);
                        }
                      }
                    });
                    descriptionStr = itemsArr.join(' | ');

                    return [
                      index + 1,
                      log.type === 'kitchen' ? 'KITCHEN_WORK_TICKET' : 'CUSTOMER_CHECKOUT_RECEIPT',
                      log.timestamp || '',
                      tableMark,
                      descriptionStr ? `"${descriptionStr.replace(/"/g, '""')}"` : 'N/A',
                      `"${cleanContent}"`,
                    ];
                  });

                  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join(
                    '\n',
                  );

                  // Force UTF-8 BOM so Excel opens Chinese text correctly
                  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
                    type: 'text/csv;charset=utf-8;',
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute(
                    'download',
                    `Sabay_Thermal_Print_History_${new Date().toISOString().slice(0, 10)}_${new Date().toTimeString().slice(0, 5).replace(':', '')}.csv`,
                  );
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="text-white/45 hover:text-[#E5B453] p-1 rounded hover:bg-white/5 transition flex items-center gap-1 text-[10px] select-none font-bold shrink-0 cursor-pointer"
                title="匯出近期虛擬熱感印表記錄為 CSV 檔案 (Export Print Logs to CSV)"
              >
                <Download size={13} />
                <span className="hidden xl:inline">匯出 CSV</span>
              </button>

              <button
                id="clear-print-logs-btn"
                onClick={onClearPrintLogs}
                className="text-white/45 hover:text-red-400 p-1 rounded hover:bg-white/5 transition shrink-0 cursor-pointer"
                title="清除虛擬管線日誌 Clear Virtual Buffer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Print Test Action Card */}
          <div className="bg-black/25 rounded-lg border border-white/5 p-2.5 flex flex-col space-y-2 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[10px] text-white/50 font-sans flex items-center space-x-1.5">
                <Wifi
                  size={10}
                  className={
                    pingState.reachable ? 'text-emerald-400 animate-pulse' : 'text-rose-400'
                  }
                />
                <span className="font-mono">
                  {pingState.reachable
                    ? `端點 ${printerIp}:9100 在線`
                    : `端點 ${printerIp}:9100 離線`}
                </span>
              </span>
              <button
                id="kitchen-print-test-btn"
                disabled={testLoading}
                onClick={() => {
                  setPrintConfirmData({
                    title: '列印測試頁 Test Page',
                    ip: printerIp,
                    onConfirm: async () => {
                      setTestLoading(true);
                      setPrinterSuccess(null);
                      setPrinterError(null);
                      const res = await onPrintTestPage('kitchen');
                      setTestLoading(false);
                      if (res.success) {
                        setPrinterSuccess('列印測試頁成功發送！');
                      } else {
                        setPrinterError(res.error || '列印失敗');
                      }
                    },
                  });
                }}
                className={`active:scale-95 border text-xs py-1 px-2.5 rounded transition flex items-center space-x-1 cursor-pointer disabled:opacity-45 font-bold ${
                  pingState.reachable
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-300'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 hover:text-orange-400'
                }`}
              >
                {testLoading ? (
                  <RefreshCw size={11} className="animate-spin text-white" />
                ) : (
                  <Printer size={11} />
                )}
                <span>測試紙 Test Page</span>
              </button>
            </div>

            {printerSuccess && (
              <p className="text-[9.5px] text-emerald-400 font-sans font-bold">
                ✓ {printerSuccess}
              </p>
            )}
            {printerError && (
              <p className="text-[9.5px] text-rose-400 font-sans font-bold">⚠️ {printerError}</p>
            )}
          </div>

          <div className="bg-black/40 text-[11px] font-mono p-3.5 rounded-xl overflow-y-auto max-h-[450px] space-y-4 border border-white/5 text-left scrollbar-thin">
            {printLogs.length === 0 ? (
              <div className="text-white/20 text-center py-16 space-y-2">
                <Printer size={25} className="mx-auto text-white/10" />
                <p className="text-xs">列印管線管道閒置中</p>
                <p className="text-[9px] text-white/30 leading-relaxed font-sans max-w-[200px] mx-auto">
                  當點擊加入購物車或完成付款時，系統將模擬 LAN 熱感印表機出單拋送至此。
                </p>
              </div>
            ) : (
              printLogs.map((log, index) => (
                <div
                  key={index}
                  className="bg-[#1C1C1C] text-white p-3.5 rounded-lg border border-white/10 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 bg-[#E5B453] text-[#0F0F0F] text-[8px] font-black px-1.5 py-0.5 rounded-bl uppercase tracking-wider">
                    {log.type === 'kitchen' ? 'KITCHEN_TKT' : 'CLIENT_BILL'}
                  </div>
                  <div className="text-white/40 text-[9px] mb-2 font-sans flex justify-between">
                    <span>時間: {log.timestamp}</span>
                  </div>
                  <pre className="whitespace-pre font-mono leading-relaxed overflow-x-auto text-[9px] text-white/90">
                    {log.content}
                  </pre>
                  {/* Virtual rip paper edge effect */}
                  <div className="mt-3 border-t border-dashed border-white/10 pt-1 flex justify-between text-[8px] text-white/30 font-sans">
                    <span>sabay_boca_v1.2</span>
                    <span className="text-[#00C300]">100% 傳送正常</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* KDS Quick View Modal */}
      {quickViewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          id="kds-quick-view-modal"
        >
          <div className="w-full max-w-2xl bg-[#121212] border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-left">
            {/* Modal Header */}
            <div
              className={`p-5 border-b border-white/10 flex items-center justify-between ${quickViewOrder.isFlagged ? 'bg-red-950/40' : 'bg-black/40'}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="bg-[#E5B453] text-black font-mono font-black text-sm px-3 py-1 rounded-md">
                  #{quickViewOrder.id}
                </span>
                <h3 className="text-lg font-bold text-white font-sans">
                  {quickViewOrder.tableNumber}{' '}
                  {quickViewOrder.tableNumber.includes('外帶') ? '' : '桌'} 餐點明細 (KDS Quick
                  View)
                </h3>
                {quickViewOrder.isFlagged && (
                  <span className="bg-red-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded animate-pulse select-none flex items-center gap-1">
                    <AlertTriangle size={10} />
                    <span>特別關注</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setQuickViewOrder(null)}
                className="text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left scrollbar-thin">
              {/* Order Metadata Box */}
              <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5 text-xs font-mono">
                <div>
                  <p className="text-white/40">下單時間 Order Time</p>
                  <p className="text-white font-bold text-sm mt-0.5">
                    {new Date(quickViewOrder.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-white/40 font-bold">等候時間 Elapsed Time</p>
                  <p
                    className={`font-black text-sm mt-0.5 inline-flex items-center gap-1 ${
                      Math.floor(
                        (Date.now() - new Date(quickViewOrder.createdAt).getTime()) / 60000,
                      ) > 30
                        ? 'text-red-500 font-extrabold animate-pulse'
                        : Math.floor(
                              (Date.now() - new Date(quickViewOrder.createdAt).getTime()) / 60000,
                            ) > 15
                          ? 'text-yellow-400 font-bold animate-pulse'
                          : 'text-white'
                    }`}
                  >
                    <Clock size={12} />
                    {getElapsedTime(quickViewOrder.createdAt).text}
                  </p>
                </div>
                {isCloseToClosing(quickViewOrder.createdAt, operatingHours) && (
                  <div className="col-span-2 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-left text-xs font-sans animate-pulse">
                    <p className="text-red-400 font-extrabold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-ping mr-0.5" />
                      ⚠️ 即將關店，加速出餐 (Store closing soon)
                    </p>
                    <p className="text-red-400/80 font-medium text-[10px] mt-1">
                      此訂單於每日結業關閉前 30 分鐘內進入，請廚房人員縮短備餐流程，儘速完成出餐！
                    </p>
                  </div>
                )}
                {qvOcc && (
                  <div className="col-span-2 bg-sky-500/5 border border-sky-500/15 p-3 rounded-lg text-left text-xs font-mono">
                    <p className="text-sky-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                      <Timer size={12} className="text-sky-450" />
                      {quickViewOrder.tableNumber.includes('外帶')
                        ? '顧客滯留總時間 Guest Wait Session'
                        : '桌況佔用總時間 Table Occupancy'}
                    </p>
                    <p className="text-white font-bold text-xs mt-1 flex flex-wrap items-center gap-1.5 leading-relaxed">
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-black font-mono ${qvOcc.style}`}
                      >
                        {qvOcc.text}
                      </span>
                      <span className="text-zinc-400 font-sans">
                        (自首筆點單於{' '}
                        {new Date(
                          orders.find((o) => o.id === qvOcc.oldestOrderId)?.createdAt || '',
                        ).toLocaleTimeString()}{' '}
                        送出起算，該桌目前共 {qvOcc.orderCount} 筆未完成點單)
                      </span>
                    </p>
                  </div>
                )}
                {quickViewOrder.quickNotes && (
                  <div className="col-span-2 bg-[#E5B453]/5 border border-[#E5B453]/25 p-3 rounded-lg text-left">
                    <p className="text-[#E5B453] font-bold text-[10px] uppercase tracking-wider">
                      KDS 快速備註 Quick Note
                    </p>
                    <p className="text-white font-black text-sm mt-1">
                      📝 {quickViewOrder.quickNotes}
                    </p>
                  </div>
                )}
                {quickViewOrder.isFlagged && quickViewOrder.flagReason && (
                  <div className="col-span-2 bg-red-500/10 border-2 border-red-500/20 p-3 rounded-lg text-left animate-pulse">
                    <p className="text-red-400 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={12} />
                      特別關注 Attention Required
                    </p>
                    <p className="text-white font-bold text-sm mt-1">
                      ⚠️ {quickViewOrder.flagReason}
                    </p>
                  </div>
                )}
              </div>

              {/* Items Breakdown list */}
              <div className="space-y-4">
                <h4 className="text-xs text-white/50 font-bold uppercase tracking-wider">
                  餐點清單 Item Breakdown ({quickViewOrder.items.length})
                </h4>

                <div className="space-y-3">
                  {quickViewOrder.items.map((it, idx) => {
                    const sweetnessText =
                      it.customization.sweetness === 0
                        ? t('sugarFree')
                        : it.customization.sweetness === 1
                          ? t('sweet30')
                          : it.customization.sweetness === 2
                            ? t('sweet50')
                            : t('sweet100');
                    const spicinessText =
                      it.customization.spiciness === 0
                        ? t('notSpicy')
                        : it.customization.spiciness === 1
                          ? t('mildSpicy')
                          : it.customization.spiciness === 2
                            ? t('mediumSpicy')
                            : t('thaiSpicy');

                    return (
                      <div
                        key={idx}
                        className={`border rounded-xl p-4 space-y-3 transition ${
                          it.isCompleted
                            ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/30'
                            : 'bg-black/30 border-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Title and qty */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className={it.isCompleted ? 'opacity-40 line-through' : ''}>
                            <span className="font-extrabold text-lg text-white block">
                              {getLocalizedText(it.name, currentLang)}
                            </span>
                            <span className="text-xs text-zinc-400 font-medium block mt-0.5 font-mono">
                              {getLocalizedText(it.name, currentLang === 'zh' ? 'en' : 'zh')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-[#E5B453] text-[#0F0F0F] rounded-lg px-4 py-1.5 text-lg font-black font-mono">
                              x {it.qty} {t('qtyPortion')}
                            </span>

                            {!it.isCompleted && !it.isPrepared && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (true) {
                                    handleItemStatusToggle(quickViewOrder.id, it.id, false, true);
                                  }
                                }}
                                className="h-10 px-3 rounded-xl text-xs font-black transition-all duration-200 shadow-sm flex items-center justify-center gap-1 border cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/10"
                                title="標示為已備餐 (Mark as Prepared)"
                              >
                                <ChefHat size={14} />
                                <span>{t('itemPreparedBtn')}</span>
                              </button>
                            )}

                            {!it.isCompleted && it.isPrepared && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (true) {
                                      handleItemStatusToggle(
                                        quickViewOrder.id,
                                        it.id,
                                        false,
                                        false,
                                      );
                                    }
                                  }}
                                  className="h-10 px-2 rounded-xl text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1 border cursor-pointer bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  title="點擊可取消已備餐狀態"
                                >
                                  <ChefHat size={12} />
                                  <span>{t('itemPreparedBtn')}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (true) {
                                      handleItemStatusToggle(quickViewOrder.id, it.id, true, true);
                                    }
                                  }}
                                  className="h-10 px-3.5 rounded-xl text-xs font-black transition-all duration-200 shadow-sm flex items-center justify-center gap-1 border cursor-pointer bg-[#1e1e1e] hover:bg-[#252525] text-emerald-400 hover:text-emerald-300 border-emerald-500/35 hover:border-emerald-500 shadow-black/20"
                                  title="標示為製作完成 (Mark as Completed)"
                                >
                                  <span>{t('itemMakeCompleteBtn')}</span>
                                </button>
                              </>
                            )}

                            {it.isCompleted && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (true) {
                                    handleItemStatusToggle(quickViewOrder.id, it.id, false, false);
                                  }
                                }}
                                className="h-10 px-4 rounded-xl text-xs font-black transition-all duration-200 shadow-sm flex items-center justify-center gap-1 border cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-[#0F0F0F] border-emerald-400 shadow-emerald-500/10"
                                title="標示為未完成 (Mark as Pending)"
                              >
                                <Check size={14} className="stroke-[3]" />
                                <span>{t('itemCompletedBtn')}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Customization Details Grid with High Contrast blocks */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                          {/* Sweetness Block */}
                          <div
                            className={`p-2.5 rounded-lg border text-xs ${
                              it.customization.sweetness === 0
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                : 'bg-white/5 border-white/10 text-white'
                            }`}
                          >
                            <span className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">
                              {t('sweetness')} Sweetness
                            </span>
                            <span className="font-extrabold text-xs">{sweetnessText}</span>
                          </div>

                          {/* Spiciness Block - highlight red for high spiciness */}
                          <div
                            className={`p-2.5 rounded-lg border text-xs ${
                              it.customization.spiciness === 0
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                : it.customization.spiciness >= 2
                                  ? 'bg-red-500/10 border-red-500/30 text-red-400 font-black'
                                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400 font-bold'
                            }`}
                          >
                            <span className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">
                              {t('spiciness')} Spiciness
                            </span>
                            <span className="text-xs">{spicinessText}</span>
                          </div>

                          {/* Noodle Type */}
                          {it.customization.noodleType && (
                            <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                              <span className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">
                                {t('noodleOption')} Noodle Type
                              </span>
                              <span className="font-extrabold">
                                {it.customization.noodleType === 'rice-noodle'
                                  ? `🍜 ${t('riceNoodle')} (Rice Noodle)`
                                  : it.customization.noodleType === 'vermicelli'
                                    ? `🍜 ${t('vermicelli')} (Vermicelli)`
                                    : t('noNoodle')}
                              </span>
                            </div>
                          )}

                          {/* Soup Base */}
                          {it.customization.soupBase && (
                            <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                              <span className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">
                                {t('soupBaseLabel')} Soup Base
                              </span>
                              <span className="font-extrabold">
                                {it.customization.soupBase === 'coconut-milk'
                                  ? `🥥 ${t('coconutMilkAdd')}`
                                  : '冬蔭功 Tom Yum'}
                              </span>
                            </div>
                          )}

                          {/* Add-ons List */}
                          {it.customization.selectedAddOns &&
                            it.customization.selectedAddOns.length > 0 && (
                              <div className="col-span-1 sm:col-span-2 p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg text-xs text-amber-300">
                                <span className="text-[10px] text-amber-500/70 font-bold block uppercase mb-1">
                                  {t('addOnsLabel')} Add-ons
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {it.customization.selectedAddOns.map((addOn) => (
                                    <span
                                      key={addOn.id}
                                      className="bg-amber-500/15 text-amber-250 border border-amber-500/30 font-bold px-2 py-0.5 rounded text-xs"
                                    >
                                      ＋ {getLocalizedText(addOn.name, currentLang)} x
                                      {addOn.qty || 1}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Direct Item Notes */}
                          {it.customization.notes && (
                            <div className="col-span-1 sm:col-span-2 p-3 bg-red-500/5 border border-red-500/15 rounded-xl text-xs text-red-400">
                              <span className="text-[10px] text-red-500/60 font-bold block uppercase mb-1">
                                📌 該品項特殊客製備註 Item Notes
                              </span>
                              <p className="font-extrabold text-sm">{it.customization.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/10 bg-black/40 flex justify-between items-center gap-4">
              <span className="text-[10px] text-white/30 font-mono hidden sm:inline">
                Sabay Thai BBQ Kitchen System
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const specLines = quickViewOrder.items
                      .map((it) => {
                        const spec = [
                          it.customization.spiciness === 0
                            ? t('notSpicy')
                            : it.customization.spiciness === 1
                              ? t('mildSpicy')
                              : it.customization.spiciness === 2
                                ? t('mediumSpicy')
                                : t('thaiSpicy'),
                          it.customization.sweetness === 0
                            ? t('sugarFree')
                            : it.customization.sweetness === 1
                              ? t('sweet30')
                              : it.customization.sweetness === 2
                                ? t('sweet50')
                                : t('sweet100'),
                          it.customization.noodleType === 'rice-noodle'
                            ? t('riceNoodle')
                            : it.customization.noodleType === 'vermicelli'
                              ? t('vermicelli')
                              : '',
                          it.customization.soupBase === 'coconut-milk' ? t('coconutMilkAdd') : '',
                          it.customization.notes
                            ? `${t('notesLabel')}: ${it.customization.notes}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join('/');
                        const itName = getLocalizedText(it.name, currentLang);
                        return `[ ] ${itName} x ${it.qty} ${t('qtyPortion')}\n    【 ${spec} 】`;
                      })
                      .join('\n');
                    const ticketStr = `
========================================
       沙貝燒烤 (廚房工作即時交代單)
       桌號/標記: ${quickViewOrder.tableNumber}
========================================
單號 ID: ${quickViewOrder.id}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${new Date(quickViewOrder.createdAt).toLocaleTimeString()}
狀態 STATE: ${quickViewOrder.status.toUpperCase()}
----------------------------------------
餐點項目與客製需求 Kitchen Item(s):
${specLines}
----------------------------------------
* KDS TICKET PRINT PREVIEW GENERATED OK *
* 感謝廚房人員辛勞，請於出餐完畢時完成確認 *
========================================`.trim();
                    setPrintConfirmData({
                      title: `驗證列印廚房交代票 #${quickViewOrder.id}`,
                      ip: printerIp,
                      receiptType: 'kitchen',
                      receiptBody: ticketStr,
                      onConfirm: () => {
                        alert(`🖨️ 虛擬網卡列印指令傳送正常！(單號: ${quickViewOrder.id})`);
                      },
                    });
                  }}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-[#E5B453]/30 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                >
                  <Printer size={13} className="text-[#E5B453]" />
                  <span>列印廚房單 Print Ticket</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickViewOrder(null)}
                  className="bg-zinc-800 hover:bg-zinc-750 text-white/85 border border-zinc-700 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  關閉 Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 列印確認視窗 Printer Selection / Confirmation Dialog */}
      {printConfirmData && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-xs font-sans animate-fadeIn"
          id="print-confirmation-dialog-kds"
          onClick={() => setPrintConfirmData(null)}
        >
          <div
            className={`bg-[#121212] border border-white/10 rounded-2xl w-full ${printConfirmData.receiptBody ? 'max-w-2xl' : 'max-w-sm'} overflow-hidden shadow-2xl text-left transition-all duration-300`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-sm text-amber-400 flex items-center gap-1.5">
                <Printer size={14} className="text-amber-400" />
                <span>
                  {printConfirmData.receiptBody
                    ? '🖨️ 熱感出單預覽 Print Preview'
                    : '確認執行列印任務？'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setPrintConfirmData(null)}
                className="text-white/40 hover:text-white/80 transition text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div
              className={`p-5 ${printConfirmData.receiptBody ? 'grid grid-cols-1 md:grid-cols-2 gap-5' : 'space-y-4'}`}
            >
              <div className="space-y-4">
                <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-zinc-500 text-[10px]">
                    <span>任務名稱 Task</span>
                    <span className="text-white/70 font-bold">{printConfirmData.title}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 text-[10px]">
                    <span>印表機 IP Address</span>
                    <span className="text-amber-400 font-mono font-bold tracking-wider">
                      {printConfirmData.ip}
                    </span>
                  </div>
                </div>
                <p className="text-white/60 text-[11px] leading-relaxed">
                  請確認您已與本機熱熱感印硬體連線至同一區域網路內（WiFi），並確認印表機開機且狀態正常。
                </p>

                {/* Visual Status simulator */}
                <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl text-[10px] space-y-1.5 font-mono text-amber-400/80">
                  <span className="text-[9px] font-black tracking-widest text-[#E5B453] uppercase block">
                    🟢 virtual queue live
                  </span>
                  <p>
                    ✔ 出單格式:{' '}
                    {printConfirmData.receiptType === 'kitchen'
                      ? '餐廳工作交代票 (Kitchen Ticket)'
                      : '前台客戶收據 (Billing Receipt)'}
                  </p>
                  <p>✔ 支援本機熱感寬度 80mm / 58mm</p>
                </div>
              </div>

              {printConfirmData.receiptBody && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 tracking-wider block uppercase">
                    📄 虛擬熱感列印預覽 Thermal Receipt Preview:
                  </span>
                  <div className="relative bg-[#FAF9F5] text-zinc-900 p-5 font-mono border-t-[8px] border-b-[8px] border-dashed border-zinc-300 shadow-inner rounded max-h-[280px] overflow-y-auto text-[9.5px] leading-normal select-text scrollbar-thin">
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-zinc-200"></div>
                    <pre className="whitespace-pre-wrap font-mono uppercase text-zinc-800 tracking-tight font-medium">
                      {printConfirmData.receiptBody}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 p-5 border-t border-white/5 bg-zinc-900/40 text-xs">
              <button
                type="button"
                onClick={() => setPrintConfirmData(null)}
                className="px-4 py-1.5 hover:bg-white/5 border border-white/10 rounded font-bold transition active:scale-95 cursor-pointer text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  printConfirmData.onConfirm();
                  setPrintConfirmData(null);
                }}
                className="px-4 py-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-1"
              >
                <Printer size={12} />
                <span>確定執行列印</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
