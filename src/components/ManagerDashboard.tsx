import { apiFetch } from '../lib/api';
import React, { Component, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Ingredient,
  Language,
  Category,
  TableConfig,
  Order,
  OrderStatus,
  Reservation,
} from '../types';
import { getLocalizedText } from '../utils/i18n';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Layers,
  Sparkles,
  Coins,
  Lock,
  Unlock,
  QrCode,
  Trash2,
  Plus,
  Edit,
  Download,
  Calendar,
  FileText,
  ShoppingBag,
  ShoppingCart,
  Copy,
  Check,
  ExternalLink,
  Minus,
  Flame,
  Printer,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { db, isFirebaseSyncEnabled } from '../lib/firebase';
import { safeStorage } from '../lib/safeStorage';
import { doc, setDoc } from 'firebase/firestore';
import PrintLogsD3Chart from './PrintLogsD3Chart';

const localStorage = safeStorage;

interface ModalErrorBoundaryProps {
  children: React.ReactNode;
  onClose: () => void;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  state: ModalErrorBoundaryState = { hasError: false, error: null };
  constructor(props: ModalErrorBoundaryProps) {
    super(props);
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('Modal Render Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs font-sans">
          <div className="bg-zinc-900 border border-rose-500/50 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-base font-bold text-rose-400">
              彈出視窗載入發生異常 (Modal Error)
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              此項目的部分數據結構與預期不符，系統已自動防護避免頁面崩潰黑屏。
            </p>
            <div className="bg-black/60 p-2.5 rounded border border-white/10 text-left text-[10px] font-mono text-rose-300 overflow-x-auto max-h-24">
              {String((this as any).state?.error?.message || (this as any).state?.error)}
            </div>
            <button
              type="button"
              onClick={() => {
                (this as any).setState({ hasError: false, error: null });
                (this as any).props.onClose();
              }}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition active:scale-95 cursor-pointer"
            >
              關閉視窗 (Close)
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// Helper to mask sensitive email topztar@gmail.com and other personal emails to show only a custom Member Code / Masked ID
export const getMaskedEmail = (email: string | null | undefined): string => {
  if (!email) return '';
  const emailLower = email.toLowerCase().trim();
  if (emailLower === 'topztar@gmail.com') {
    return 'VIP-001 (topz****@gmail.com)';
  }
  if (emailLower === 'thai_foodie@gmail.com') {
    return 'VIP-002 (thai_****@gmail.com)';
  }
  if (emailLower === 'vegan_sabay@gmail.com') {
    return 'VIP-003 (vega_****@gmail.com)';
  }
  const parts = emailLower.split('@');
  const user = parts[0] || '';
  const domain = parts[1] || 'gmail.com';
  if (user.length <= 3) {
    return `VIP-USR (${user[0]}***@${domain})`;
  }
  return `VIP-USR (${user.slice(0, 3)}****@${domain})`;
};

export const computeOrderItemUnitPrice = (it: any, menuItemsList: any[] = []): number => {
  if (!it) return 0;
  const baseP = Number(it.price) || 0;
  let addOnsTotal = 0;
  if (it.customization?.selectedAddOns && Array.isArray(it.customization.selectedAddOns)) {
    addOnsTotal = it.customization.selectedAddOns.reduce(
      (s: number, a: any) => s + (Number(a.price) || 0),
      0,
    );
  }
  const spicinessAdd = it.customization?.spiciness === 3 ? 10 : 0;
  const soupBaseAdd = it.customization?.soupBase === 'coconut-milk' ? 50 : 0;

  const dish = menuItemsList.find((m: any) => m.id === it.menuItemId);
  if (dish && baseP === dish.price) {
    return dish.price + spicinessAdd + soupBaseAdd + addOnsTotal;
  }
  if (addOnsTotal > 0 && dish && baseP < dish.price + addOnsTotal) {
    return baseP + addOnsTotal;
  }
  if (addOnsTotal > 0 && !dish && baseP <= (it.originalPrice || baseP)) {
    return baseP + addOnsTotal;
  }
  return baseP;
};

export const computeOrderItemsSubtotal = (items: any[], menuItemsList: any[] = []): number => {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum: number, it: any) => {
    return sum + computeOrderItemUnitPrice(it, menuItemsList) * (Number(it.qty) || 1);
  }, 0);
};

interface ManagerDashboardProps {
  currentLang: Language;
  analytics: {
    totalRevenue: number;
    ordersCount: number;
    categorySales: { category: string; revenue: number }[];
    hourlyDistribution: { timeSlot: string; orders: number }[];
    topDishes: { name: string; qty: number }[];
    stockWarnings: Ingredient[];
  };
  ingredients: Ingredient[];
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onRestock: (id: string, amount: number) => Promise<void>;

  onSendPromoPush: (notif: { title: string; message: string; badge: string }) => Promise<void>;
  onToggleMenuItemAvailability: (id: string) => Promise<void>;
  menuItems: any[];
  onAddMenuItem?: (item: any) => Promise<void>;
  onEditMenuItem?: (id: string, item: any) => Promise<void>;
  onDeleteMenuItem?: (id: string) => Promise<void>;
  categories: Category[];
  onAddCategory?: (
    id: string,
    name: any,
    showOnCustomerPage?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  onEditCategory?: (
    id: string,
    name: any,
    showOnCustomerPage?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteCategory?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onReorderCategories?: (order: string[]) => Promise<void>;
  onReorderMenuItems?: (order: string[]) => Promise<void>;
  tables: TableConfig[];
  onAddTable: (id: string, qrCodeUrl?: string) => Promise<{ success: boolean; error?: string }>;
  onEditTable: (id: string, qrCodeUrl: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteTable: (id: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateOrderItems?: (orderId: string, items: any[]) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  onPayOrder?: (
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
  ) => Promise<void>;
  defaultSubTab?:
    | 'stats'
    | 'orders'
    | 'inventory'
    | 'menu'
    | 'members'
    | 'cashier'
    | 'printer'
    | 'options'
    | 'eod';
  onSubTabChange?: (
    subTab:
      | 'stats'
      | 'orders'
      | 'inventory'
      | 'menu'
      | 'members'
      | 'cashier'
      | 'printer'
      | 'options'
      | 'eod'
      | 'terminal',
  ) => void;
  minSpend?: number;
  onUpdateMinSpend?: (newVal: number) => Promise<{ success: boolean; error?: string }>;
  operatingHours?: any[];
  restDays?: string[];
  onUpdateOperatingHours?: (
    slots: any[],
    restDays?: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  customerNotice?: string;
  onUpdateCustomerNotice?: (notice: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateTableNumber?: (
    orderId: string,
    tableNumber: string,
  ) => Promise<{ success: boolean; error?: string }>;
  staffPin?: string;
  promoCombo?: any;
  onSavePromoCombo?: (newConfig: any) => Promise<{ success: boolean; error?: string }>;
  popularItemIds?: string[];
  onUpdatePopularItemIds?: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
  printerIp?: string;
  onPrintTestPage?: (
    target?: 'kitchen' | 'bill' | 'all',
  ) => Promise<{ success: boolean; error?: string }>;
  onAddIngredient?: (
    id: string,
    name: { zh: string; en?: string },
    stock: number,
    minThreshold: number,
    unit: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateTableStatus?: (
    id: string,
    updates: Partial<Omit<TableConfig, 'id' | 'qrCodeUrl'>>,
  ) => Promise<{ success: boolean; error?: string }>;
  reservations?: Reservation[];
  onAddReservation?: (
    reservation: Omit<Reservation, 'id' | 'createdAt'>,
  ) => Promise<{ success: boolean; error?: string }>;
  onEditReservation?: (
    id: string,
    updates: Partial<Reservation>,
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteReservation?: (id: string) => Promise<{ success: boolean; error?: string }>;
  isOpen?: boolean;
  servicePaused?: boolean;
  onToggleServicePause?: (paused: boolean) => Promise<void>;
  memberPointsRatio?: number;
  onPlaceOrder?: (orderData: any) => Promise<any>;
  memberRewards?: any[];
  onUpdateMemberConfig?: () => Promise<void>;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  currentLang,
  analytics,
  ingredients,
  orders,
  onUpdateOrderStatus,
  onRestock,

  onToggleMenuItemAvailability,
  menuItems,
  onAddMenuItem,
  onEditMenuItem,
  onDeleteMenuItem,
  categories,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onReorderCategories,
  onReorderMenuItems,
  tables,
  onAddTable,
  onEditTable,
  onDeleteTable,
  onUpdateTableStatus,
  reservations = [],
  onAddReservation,
  onEditReservation,
  onDeleteReservation,
  onUpdateOrderItems,
  onDeleteOrder,
  onPayOrder,
  onPlaceOrder,
  onUpdateTableNumber,
  defaultSubTab,
  onSubTabChange,
  minSpend = 200,
  onUpdateMinSpend,
  operatingHours = [],
  restDays = [],
  isOpen = true,
  onUpdateOperatingHours,
  customerNotice = '',
  onUpdateCustomerNotice,
  staffPin,
  promoCombo = {
    enabled: false,
    requiredQty: 0,
    discountAmount: 0,
    eligibleItemIds: [],
    combos: [],
  } as any,
  onSavePromoCombo,
  popularItemIds = [],
  onUpdatePopularItemIds,
  printerIp = '192.168.123.100',
  onPrintTestPage,
  onAddIngredient,
  memberPointsRatio = 20,
  memberRewards = [],
  onUpdateMemberConfig,
}) => {
  // Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<
    | 'stats'
    | 'orders'
    | 'inventory'
    | 'menu'
    | 'members'
    | 'cashier'
    | 'printer'
    | 'options'
    | 'eod'
  >(defaultSubTab || 'stats');

  const prevMemberPointsRatioRef = React.useRef<number>(memberPointsRatio);
  const prevMemberRewardsRef = React.useRef<string>(JSON.stringify(memberRewards));

  const [terminalCart, setTerminalCart] = useState<any[]>([]);
  const [terminalTable, setTerminalTable] = useState('1');
  const [terminalCategory, setTerminalCategory] = useState<string>('all');
  const [isTerminalFullScreen, setIsTerminalFullScreen] = useState(false);
  const [terminalPage, setTerminalPage] = useState(1);
  const [terminalCartPage, setTerminalCartPage] = useState(1);

  // Reservation Status Filter State
  const [selectedCalendarStatusFilter, setSelectedCalendarStatusFilter] = useState<string>('all');
  const [selectedResIds, setSelectedResIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setTerminalPage(1);
  }, [terminalCategory]);

  useEffect(() => {
    const totalCartPages = Math.max(1, Math.ceil(terminalCart.length / 5));
    if (terminalCartPage > totalCartPages) {
      setTerminalCartPage(totalCartPages);
    }
  }, [terminalCart.length, terminalCartPage]);
  useEffect(() => {
    if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  useEffect(() => {
    if (memberPointsRatio !== prevMemberPointsRatioRef.current) {
      setTempPointsRatio(memberPointsRatio);
      prevMemberPointsRatioRef.current = memberPointsRatio;
    }
  }, [memberPointsRatio]);

  useEffect(() => {
    const rewardsStr = JSON.stringify(memberRewards);
    if (rewardsStr !== prevMemberRewardsRef.current) {
      if (memberRewards && memberRewards.length > 0) {
        setTempRewards(memberRewards);
      }
      prevMemberRewardsRef.current = rewardsStr;
    }
  }, [memberRewards]);

  // Table Config States
  const [isTableFormOpen, setIsTableFormOpen] = useState(false);
  const [editingTableObj, setEditingTableObj] = useState<TableConfig | null>(null);
  const [tableIdInput, setTableIdInput] = useState('');
  const [tableQrUrlInput, setTableQrUrlInput] = useState('');
  const [tableMaxCapacityInput, setTableMaxCapacityInput] = useState('');
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableSuccess, setTableSuccess] = useState<string | null>(null);
  const [takeoutStatus, setTakeoutStatus] = useState({ sequence: 0, lastResetDate: '' });
  const [selectedQrPreviewId, setSelectedQrPreviewId] = useState<string>('1');
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);
  const [tableToDeleteId, setTableToDeleteId] = useState<string | null>(null);
  const [reservationToDeleteId, setReservationToDeleteId] = useState<string | null>(null);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);

  // Table Layout and Floor Map States
  const [tableLayoutMode, setTableLayoutMode] = useState<'grid' | 'floormap'>('floormap');
  const [localTablePositions, setLocalTablePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(5); // Default grid size is 5%

  // Local reordering states with confirmation buttons to prevent accidental clicks
  const [localCategoryOrder, setLocalCategoryOrder] = useState<Category[]>([]);
  const [localMenuItemOrder, setLocalMenuItemOrder] = useState<any[]>([]);
  const [hasUnsavedCategoryOrder, setHasUnsavedCategoryOrder] = useState(false);
  const [hasUnsavedMenuItemOrder, setHasUnsavedMenuItemOrder] = useState(false);
  const [isCategorySortingMode, setIsCategorySortingMode] = useState(false);
  const [isMenuItemSortingMode, setIsMenuItemSortingMode] = useState(false);

  useEffect(() => {
    if (!hasUnsavedCategoryOrder) {
      setLocalCategoryOrder(categories);
    }
  }, [categories, hasUnsavedCategoryOrder]);

  useEffect(() => {
    if (!hasUnsavedMenuItemOrder) {
      setLocalMenuItemOrder(menuItems);
    }
  }, [menuItems, hasUnsavedMenuItemOrder]);

  // Custom reusable confirmation dialog modal state
  const [confirmActionModal, setConfirmActionModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState<boolean>(false);

  // Points Adjustment Modal details
  const [adjustPointsModal, setAdjustPointsModal] = useState<{
    isOpen: boolean;
    email: string;
    name: string;
    currentPoints: number;
  } | null>(null);
  const [adjustPointsValue, setAdjustPointsValue] = useState<string>('');
  const [adjustPointsError, setAdjustPointsError] = useState<string | null>(null);

  // Add Member Modal State
  const [addMemberModalOpen, setAddMemberModalOpen] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberEmail, setNewMemberEmail] = useState<string>('');
  const [newMemberBalance, setNewMemberBalance] = useState<string>('0');
  const [newMemberPoints, setNewMemberPoints] = useState<string>('0');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // Lock state for guest table slots positioning to prevent unintentional mouse drags / touch moves
  const [isTableLayoutLocked, setIsTableLayoutLocked] = useState<boolean>(() => {
    return localStorage.getItem('table-layout-locked') !== 'false'; // Default to true (locked) for safety
  });

  // Tablet selection for map drag helper
  const [selectedFineTuneTableId, setSelectedFineTuneTableId] = useState<string | null>(null);

  // Drag and drop mouse event handler
  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (isTableLayoutLocked) return;
    e.preventDefault();
    const mapElement = document.getElementById('floor-map-container');
    if (!mapElement) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Query bounding rect dynamically on move for precise coordinates even during/after tablet orientation/rotation flips
      const currentRect = mapElement.getBoundingClientRect();
      const rawX = moveEvent.clientX - currentRect.left;
      const rawY = moveEvent.clientY - currentRect.top;

      let xPercent = Math.max(0, Math.min(100, Math.round((rawX / currentRect.width) * 100)));
      let yPercent = Math.max(0, Math.min(100, Math.round((rawY / currentRect.height) * 100)));

      if (snapToGrid) {
        xPercent = Math.round(xPercent / gridSize) * gridSize;
        yPercent = Math.round(yPercent / gridSize) * gridSize;
        xPercent = Math.max(0, Math.min(100, xPercent));
        yPercent = Math.max(0, Math.min(100, yPercent));
      }

      setLocalTablePositions((prev) => ({
        ...prev,
        [tableId]: { x: xPercent, y: yPercent },
      }));
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const currentRect = mapElement.getBoundingClientRect();
      const rawX = upEvent.clientX - currentRect.left;
      const rawY = upEvent.clientY - currentRect.top;
      let finalX = Math.max(0, Math.min(100, Math.round((rawX / currentRect.width) * 100)));
      let finalY = Math.max(0, Math.min(100, Math.round((rawY / currentRect.height) * 100)));

      if (snapToGrid) {
        finalX = Math.round(finalX / gridSize) * gridSize;
        finalY = Math.round(finalY / gridSize) * gridSize;
        finalX = Math.max(0, Math.min(100, finalX));
        finalY = Math.max(0, Math.min(100, finalY));
      }

      if (onUpdateTableStatus) {
        await onUpdateTableStatus(tableId, { positionX: finalX, positionY: finalY } as any);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Drag and drop touch event handler for tablet/mobile devices
  const handleTableTouchStart = (e: React.TouchEvent, tableId: string) => {
    if (isTableLayoutLocked) return;
    e.stopPropagation();
    const mapElement = document.getElementById('floor-map-container');
    if (!mapElement) return;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const touch = moveEvent.touches[0];

      // Query bounding rect dynamically on move for precise coordinates even during/after tablet orientation/rotation flips
      const currentRect = mapElement.getBoundingClientRect();
      const rawX = touch.clientX - currentRect.left;
      const rawY = touch.clientY - currentRect.top;

      let xPercent = Math.max(0, Math.min(100, Math.round((rawX / currentRect.width) * 100)));
      let yPercent = Math.max(0, Math.min(100, Math.round((rawY / currentRect.height) * 100)));

      if (snapToGrid) {
        xPercent = Math.round(xPercent / gridSize) * gridSize;
        yPercent = Math.round(yPercent / gridSize) * gridSize;
        xPercent = Math.max(0, Math.min(100, xPercent));
        yPercent = Math.max(0, Math.min(100, yPercent));
      }

      setLocalTablePositions((prev) => ({
        ...prev,
        [tableId]: { x: xPercent, y: yPercent },
      }));
    };

    const handleTouchEnd = async (endEvent: TouchEvent) => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      const endedTouch = endEvent.changedTouches[0];
      if (!endedTouch) return;

      const currentRect = mapElement.getBoundingClientRect();
      const rawX = endedTouch.clientX - currentRect.left;
      const rawY = endedTouch.clientY - currentRect.top;
      let finalX = Math.max(0, Math.min(100, Math.round((rawX / currentRect.width) * 100)));
      let finalY = Math.max(0, Math.min(100, Math.round((rawY / currentRect.height) * 100)));

      if (snapToGrid) {
        finalX = Math.round(finalX / gridSize) * gridSize;
        finalY = Math.round(finalY / gridSize) * gridSize;
        finalX = Math.max(0, Math.min(100, finalX));
        finalY = Math.max(0, Math.min(100, finalY));
      }

      if (onUpdateTableStatus) {
        await onUpdateTableStatus(tableId, { positionX: finalX, positionY: finalY } as any);
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Fine tune coordinate modifier
  const handleFineTunePosition = async (dx: number, dy: number) => {
    if (isTableLayoutLocked) return;
    if (!selectedFineTuneTableId) return;
    const tbl = tables.find((t) => t.id === selectedFineTuneTableId);
    if (!tbl) return;

    const currentX =
      localTablePositions[tbl.id]?.x !== undefined
        ? localTablePositions[tbl.id].x
        : tbl.positionX || 10;
    const currentY =
      localTablePositions[tbl.id]?.y !== undefined
        ? localTablePositions[tbl.id].y
        : tbl.positionY || 10;

    const stepX = snapToGrid ? (dx > 0 ? gridSize : dx < 0 ? -gridSize : 0) : dx;
    const stepY = snapToGrid ? (dy > 0 ? gridSize : dy < 0 ? -gridSize : 0) : dy;

    let nextX = Math.max(0, Math.min(100, currentX + stepX));
    let nextY = Math.max(0, Math.min(100, currentY + stepY));

    if (snapToGrid) {
      nextX = Math.round(nextX / gridSize) * gridSize;
      nextY = Math.round(nextY / gridSize) * gridSize;
      nextX = Math.max(0, Math.min(100, nextX));
      nextY = Math.max(0, Math.min(100, nextY));
    }

    setLocalTablePositions((prev) => ({
      ...prev,
      [tbl.id]: { x: nextX, y: nextY },
    }));

    if (onUpdateTableStatus) {
      await onUpdateTableStatus(tbl.id, { positionX: nextX, positionY: nextY } as any);
    }
  };

  // Reorder sorting action handlers
  const handleMoveMenuItem = (id: string, direction: 'up' | 'down') => {
    const index = localMenuItemOrder.findIndex((m) => m.id === id);
    if (index === -1) return;

    const newItems = [...localMenuItemOrder];
    if (direction === 'up' && index > 0) {
      const temp = newItems[index];
      newItems[index] = newItems[index - 1];
      newItems[index - 1] = temp;
    } else if (direction === 'down' && index < newItems.length - 1) {
      const temp = newItems[index];
      newItems[index] = newItems[index + 1];
      newItems[index + 1] = temp;
    } else {
      return;
    }

    setLocalMenuItemOrder(newItems);
    setHasUnsavedMenuItemOrder(true);
  };

  const handleSaveMenuItemOrder = async () => {
    if (!onReorderMenuItems) return;
    const orderIds = localMenuItemOrder.map((item) => item.id);
    await onReorderMenuItems(orderIds);
    setHasUnsavedMenuItemOrder(false);
    setIsMenuItemSortingMode(false);
  };

  const handleCancelMenuItemOrder = () => {
    setLocalMenuItemOrder(menuItems);
    setHasUnsavedMenuItemOrder(false);
    setIsMenuItemSortingMode(false);
  };

  const handleMoveCategory = (id: string, direction: 'up' | 'down') => {
    const index = localCategoryOrder.findIndex((c) => c.id === id);
    if (index === -1) return;

    const newCategories = [...localCategoryOrder];
    if (direction === 'up' && index > 0) {
      const temp = newCategories[index];
      newCategories[index] = newCategories[index - 1];
      newCategories[index - 1] = temp;
    } else if (direction === 'down' && index < newCategories.length - 1) {
      const temp = newCategories[index];
      newCategories[index] = newCategories[index + 1];
      newCategories[index + 1] = temp;
    } else {
      return;
    }

    setLocalCategoryOrder(newCategories);
    setHasUnsavedCategoryOrder(true);
  };

  const handleSaveCategoryOrder = async () => {
    if (!onReorderCategories) return;
    const orderIds = localCategoryOrder.map((cat) => cat.id);
    await onReorderCategories(orderIds);
    setHasUnsavedCategoryOrder(false);
    setIsCategorySortingMode(false);
  };

  const handleCancelCategoryOrder = () => {
    setLocalCategoryOrder(categories);
    setHasUnsavedCategoryOrder(false);
    setIsCategorySortingMode(false);
  };

  // Reservation Config States
  const [isResFormOpen, setIsResFormOpen] = useState(false);
  const [editingResObj, setEditingResObj] = useState<Reservation | null>(null);
  const [resNameInput, setResNameInput] = useState('');
  const [resPhoneInput, setResPhoneInput] = useState('');
  const [resPhoneError, setResPhoneError] = useState(false);
  const [resGuestsInput, setResGuestsInput] = useState(2);
  const [resTableInputs, setResTableInputs] = useState<string[]>([]);
  const [resDateInput, setResDateInput] = useState('');
  const [resTimeInput, setResTimeInput] = useState('');
  const [resNotesInput, setResNotesInput] = useState('');
  const [resNoInput, setResNoInput] = useState('');
  const [generatedResLink, setGeneratedResLink] = useState('');
  const [copiedLinkNotice, setCopiedLinkNotice] = useState(false);
  const [resError, setResError] = useState<string | null>(null);
  const [resSuccess, setResSuccess] = useState<string | null>(null);

  const todayDateStr = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const dy = String(now.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }, []);

  const maxThreeMonthsDateStr = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + 3);
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const dy = String(now.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  }, []);

  const isResDateValid = useMemo(() => {
    if (!resDateInput) return true;
    if (restDays && restDays.includes(resDateInput)) return false;
    return resDateInput <= maxThreeMonthsDateStr;
  }, [resDateInput, maxThreeMonthsDateStr, restDays]);

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

  const isResTimeValid = useMemo(() => {
    if (restDays && restDays.includes(resDateInput)) return false;
    const slots = generateCandidateSlots(resDateInput);
    if (slots.length === 0) return false;
    if (!operatingHours || operatingHours.length === 0) return true;
    return slots.includes(resTimeInput);
  }, [resDateInput, resTimeInput, generateCandidateSlots, restDays, operatingHours]);

  const generateReservationNo = (dateStr: string, existingRes: Reservation[]) => {
    const cleanDate = (dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const count = (existingRes || []).filter((r) => r.date === dateStr).length;
    const seq = String(count + 1).padStart(3, '0');
    return `RES-${cleanDate}-${seq}`;
  };

  // PIN security states
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState<string | null>(null);
  const [pinChangeLoading, setPinChangeLoading] = useState(false);

  // Min spend states
  const [tempMinSpend, setTempMinSpend] = useState<number>(minSpend);
  const [minSpendSaveError, setMinSpendSaveError] = useState<string | null>(null);
  const [minSpendSaveSuccess, setMinSpendSaveSuccess] = useState<string | null>(null);
  const [simulatedElapsedOrders, setSimulatedElapsedOrders] = useState<string[]>([]);

  // Member system state variables
  const [tempPointsRatio, setTempPointsRatio] = useState<number>(memberPointsRatio);
  const [tempRewards, setTempRewards] = useState<any[]>(() => {
    return memberRewards && memberRewards.length > 0
      ? memberRewards
      : [
          { id: 'rew-01', menuItemId: 'sk-02', cost: 900, enabled: true },
          { id: 'rew-02', menuItemId: 'vg-01', cost: 800, enabled: true },
          { id: 'rew-03', menuItemId: 'dr-01', cost: 1800, enabled: true },
          { id: 'rew-04', menuItemId: 'sw-01', cost: 900, enabled: true },
          { id: 'rew-05', menuItemId: 'ty-01', cost: 2600, enabled: true },
        ];
  });
  const [memberConfigSaveError, setMemberConfigSaveError] = useState<string | null>(null);
  const [memberConfigSaveSuccess, setMemberConfigSaveSuccess] = useState<string | null>(null);
  const [isSavingMemberConfig, setIsSavingMemberConfig] = useState<boolean>(false);

  // Operating hours states
  const [tempOperatingHours, setTempOperatingHours] = useState<any[]>(operatingHours);
  const [tempRestDays, setTempRestDays] = useState<string[]>(restDays);
  const [opHoursError, setOpHoursError] = useState<string | null>(null);
  const [opHoursSuccess, setOpHoursSuccess] = useState<string | null>(null);

  // Customer notice states
  const [tempCustomerNotice, setTempCustomerNotice] = useState<string>(customerNotice);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);

  // Sanitize states
  const [sanitizePin, setSanitizePin] = useState('');
  const [clearLocalMembers, setClearLocalMembers] = useState(false);
  const [sanitizeError, setSanitizeError] = useState<string | null>(null);
  const [sanitizeSuccess, setSanitizeSuccess] = useState<string | null>(null);
  const [sanitizeLoading, setSanitizeLoading] = useState(false);

  // Refs to prevent periodic polling from disrupting active inputs
  const prevOperatingHoursRef = React.useRef<string>(JSON.stringify(operatingHours));
  const prevRestDaysRef = React.useRef<string>(JSON.stringify(restDays));
  const prevCustomerNoticeRef = React.useRef<string>(customerNotice);
  const prevMinSpendRef = React.useRef<number>(minSpend);

  // Active Order Table/Takeout editing states
  const [editingOrderTableId, setEditingOrderTableId] = useState<string | null>(null);
  const [editingOrderTableValue, setEditingOrderTableValue] = useState<string>('');

  // Promo combo staging states
  const [, setTempPromoCombo] = useState<any>(promoCombo);
  const [tempPromoCombos, setTempPromoCombos] = useState<any[]>([]);
  const [promoComboSaveError, setPromoComboSaveError] = useState<string | null>(null);
  const [promoComboSaveSuccess, setPromoComboSaveSuccess] = useState<string | null>(null);
  const prevPromoComboRef = React.useRef<string>(JSON.stringify(promoCombo));
  const [addComboToMenuId, setAddComboToMenuId] = useState<string | null>(null);
  const [addComboPrice, setAddComboPrice] = useState<number>(0);
  const [addComboCategory, setAddComboCategory] = useState<string>('');
  const [addComboDesc, setAddComboDesc] = useState<string>('');
  const [deleteConfirmComboId, setDeleteConfirmComboId] = useState<string | null>(null);

  // CSV Export states
  const [csvExportSuccess, setCsvExportSuccess] = useState<string | null>(null);
  const [csvExportError, setCsvExportError] = useState<string | null>(null);

  // New checkout success popup states with receipt print option
  const [checkoutSuccessData, setCheckoutSuccessData] = useState<{
    id: string;
    tableNumber: string;
    subtotal: number;
    discount: number;
    serviceCharge: number;
    total: number;
    amountPaid: number;
    changeProvided: number;
    paymentMethod: string;
    isCashier: boolean;
  } | null>(null);
  const [checkoutPrintLoading, setCheckoutPrintLoading] = useState(false);
  const [checkoutPrintSuccess, setCheckoutPrintSuccess] = useState<string | null>(null);

  const handleExportLast30DaysOrdersCSV = () => {
    try {
      setCsvExportError(null);
      setCsvExportSuccess(null);

      // Filter completed orders from the last 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.createdAt).getTime();
        return order.status === 'completed' && orderDate >= thirtyDaysAgo;
      });

      if (filteredOrders.length === 0) {
        setCsvExportError(
          '在過去 30 天內沒有找到已完成的訂單。 No completed orders found in the last 30 days.',
        );
        return;
      }

      // Sort chronological (oldest to newest)
      const sortedOrders = [...filteredOrders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      // Define CSV columns & header
      const headers = [
        'Order ID / 訂單編號',
        'Table Number / 桌號外帶號',
        'Order Status / 訂單狀態',
        'Is Paid / 是否已結帳',
        'Payment Method / 付款方式',
        'Subtotal / 小計',
        'Service Charge (10%) / 服務費',
        'Discount / 折扣',
        'Total Revenue / 總計金額',
        'Created Time / 成立時間',
        'Items Detail / 餐點客製明細',
      ];

      // Format a helper to escape and quote values for safety
      const escapeCSVField = (val: string | number | boolean | null | undefined) => {
        if (val === undefined || val === null) return '""';
        const str = String(val);
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      // Formulate rows
      const rows = sortedOrders.map((order) => {
        const itemSummaries = order.items
          .map((it) => {
            const customizationDetails: string[] = [];

            // Sweetness
            if (it.customization?.sweetness !== undefined) {
              const sweet =
                it.customization.sweetness === 0
                  ? '無糖'
                  : it.customization.sweetness === 1
                    ? '三分甜'
                    : it.customization.sweetness === 2
                      ? '半糖'
                      : '正常甜';
              customizationDetails.push(`甜：${sweet}`);
            }
            // Spiciness
            if (it.customization?.spiciness !== undefined) {
              const spice =
                it.customization.spiciness === 0
                  ? '不辣'
                  : it.customization.spiciness === 1
                    ? '小辣'
                    : it.customization.spiciness === 2
                      ? '中辣'
                      : '泰大辣';
              customizationDetails.push(`辣：${spice}`);
            }
            // Noodle Type
            if (it.customization?.noodleType) {
              const noodle =
                it.customization.noodleType === 'rice-noodle'
                  ? '河粉'
                  : it.customization.noodleType === 'vermicelli'
                    ? '米線'
                    : '無';
              customizationDetails.push(`麵：${noodle}`);
            }
            // Soup Base
            if (it.customization?.soupBase === 'coconut-milk') {
              customizationDetails.push('湯：椰奶');
            }
            // Add-ons
            if (it.customization?.selectedAddOns && it.customization.selectedAddOns.length > 0) {
              const addOnsText = it.customization.selectedAddOns
                .map((addon: any) => `+${getLocalizedText(addon.name, 'zh')} x${addon.qty || 1}`)
                .join(',');
              customizationDetails.push(`加購配料：${addOnsText}`);
            }
            // Notes
            if (it.customization?.notes) {
              customizationDetails.push(`備註：${it.customization.notes}`);
            }

            const customizationStr =
              customizationDetails.length > 0 ? ` [${customizationDetails.join('; ')}]` : '';
            return `${getLocalizedText(it.name, 'zh')} x${it.qty}${customizationStr}`;
          })
          .join(' | ');

        return [
          escapeCSVField(order.id),
          escapeCSVField(order.tableNumber),
          escapeCSVField(order.status),
          escapeCSVField(order.isPaid ? 'YES' : 'NO'),
          escapeCSVField(order.paymentMethod || '未填/未指定'),
          escapeCSVField(order.subtotal),
          escapeCSVField(order.serviceCharge),
          escapeCSVField(order.discount || 0),
          escapeCSVField(order.total),
          escapeCSVField(new Date(order.createdAt).toISOString()),
          escapeCSVField(itemSummaries),
        ];
      });

      // Prepare file contents (with BOM for Excel compatibility)
      const csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Sabay_Accounting_Orders_30Days_${new Date().toISOString().split('T')[0]}.csv`,
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setCsvExportSuccess(`已成功儲存 30 天內已完成餐點對帳明細 (共 ${sortedOrders.length} 筆)！`);
      setTimeout(() => {
        setCsvExportSuccess(null);
      }, 5000);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      setCsvExportError(`匯出 CSV 失敗: ${err.message || '未知錯誤'}`);
    }
  };

  useEffect(() => {
    const currentStr = JSON.stringify(operatingHours);
    if (currentStr !== prevOperatingHoursRef.current) {
      setTempOperatingHours(operatingHours);
      prevOperatingHoursRef.current = currentStr;
    }
  }, [operatingHours]);

  useEffect(() => {
    const currentStr = JSON.stringify(restDays);
    if (currentStr !== prevRestDaysRef.current) {
      setTempRestDays(restDays);
      prevRestDaysRef.current = currentStr;
    }
  }, [restDays]);

  useEffect(() => {
    if (customerNotice !== prevCustomerNoticeRef.current) {
      setTempCustomerNotice(customerNotice);
      prevCustomerNoticeRef.current = customerNotice;
    }
  }, [customerNotice]);

  const handleSaveOperatingHoursLocal = async (updatedSlots: any[], updatedRestDays: string[]) => {
    setOpHoursError(null);
    setOpHoursSuccess(null);
    if (onUpdateOperatingHours) {
      const res = await onUpdateOperatingHours(updatedSlots, updatedRestDays);
      if (res.success) {
        setOpHoursSuccess('營業時間與公休日排程配置已成功儲存！');
        prevOperatingHoursRef.current = JSON.stringify(updatedSlots);
        prevRestDaysRef.current = JSON.stringify(updatedRestDays);
      } else {
        setOpHoursError(res.error || '儲存營業時間及公休設定失敗');
      }
    }
  };

  const handleSaveCustomerNotice = async () => {
    setNoticeError(null);
    setNoticeSuccess(null);
    if (onUpdateCustomerNotice) {
      const res = await onUpdateCustomerNotice(tempCustomerNotice);
      if (res.success) {
        setNoticeSuccess('顧客注意事項已成功更新！');
        prevCustomerNoticeRef.current = tempCustomerNotice;
      } else {
        setNoticeError(res.error || '更新注意事項失敗');
      }
    }
  };

  useEffect(() => {
    const promoStr = JSON.stringify(promoCombo);
    if (promoStr !== prevPromoComboRef.current) {
      setTempPromoCombo(promoCombo);
      if (promoCombo) {
        setTempPromoCombos(promoCombo.combos || []);
      }
      prevPromoComboRef.current = promoStr;
    }
  }, [promoCombo]);

  const handleSavePromoCombo = async () => {
    setPromoComboSaveError(null);
    setPromoComboSaveSuccess(null);
    if (onSavePromoCombo) {
      const payload = {
        enabled: tempPromoCombos.some((c) => c.enabled),
        requiredQty: tempPromoCombos[0]?.requiredQty || 10,
        discountAmount: tempPromoCombos[0]?.discountAmount || 20,
        eligibleItemIds: tempPromoCombos[0]?.eligibleItemIds || [],
        combos: tempPromoCombos,
      };
      const res = await onSavePromoCombo(payload);
      if (res.success || (res as any).success !== false) {
        setPromoComboSaveSuccess('所有自動套餐組合折抵設定已成功儲存並生效！');
        prevPromoComboRef.current = JSON.stringify(payload);
      } else {
        setPromoComboSaveError(res.error || '儲存設定失敗');
      }
    }
  };

  const handleCreateComboMenuItem = async (
    combo: any,
    price: number,
    category: string,
    desc: string,
  ) => {
    if (!onAddMenuItem) {
      alert('系統尚未準備完成，請稍後再試！');
      return;
    }
    const payload = {
      name: {
        zh: combo.name,
        en: combo.name,
        ko: combo.name,
        ja: combo.name,
        th: combo.name,
      },
      price: price,
      image: '',
      description: {
        zh:
          desc ||
          `超值自動套餐：選購達 ${combo.requiredQty} 件適用單品即可自動扣除 NT$ ${combo.discountAmount} 元！`,
        en: `Automatic discount set`,
        ko: `Automatic discount set`,
        ja: `Automatic discount set`,
        th: `Automatic discount set`,
      },
      category: category,
      available: true,
      hasNoodlesOption: false,
      isNotSpicy: true,
      customAddOns: [],
      recipe: [],
    };
    try {
      await onAddMenuItem(payload);
      alert(
        `🎉 套餐組合【${combo.name}】已成功新增為【${category}】分類之餐點！金額為 NT$ ${price} 元。顧客在前台可以直接點選該品項，且累計後仍會自動進行金額折抵！`,
      );
    } catch (err: any) {
      alert('新增餐點失敗: ' + (err.message || err));
    }
  };

  useEffect(() => {
    if (minSpend !== prevMinSpendRef.current) {
      setTempMinSpend(minSpend);
      prevMinSpendRef.current = minSpend;
    }
  }, [minSpend]);

  const handleSaveMinSpend = async () => {
    setMinSpendSaveError(null);
    setMinSpendSaveSuccess(null);
    if (onUpdateMinSpend) {
      const res = await onUpdateMinSpend(tempMinSpend);
      if (res.success) {
        setMinSpendSaveSuccess('低消門檻已成功更新！');
        prevMinSpendRef.current = tempMinSpend;
      } else {
        setMinSpendSaveError(res.error || '無法更新狀態');
      }
    }
  };

  const handleSaveMemberConfig = async () => {
    setIsSavingMemberConfig(true);
    setMemberConfigSaveError(null);
    setMemberConfigSaveSuccess(null);
    try {
      const response = await apiFetch('/api/settings/members-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointsRatio: tempPointsRatio,
          rewards: tempRewards,
        }),
      });
      if (response.ok) {
        setMemberConfigSaveSuccess('成功儲存會員點數級距與贈送品項設定！');
        prevMemberPointsRatioRef.current = tempPointsRatio;
        prevMemberRewardsRef.current = JSON.stringify(tempRewards);
        if (onUpdateMemberConfig) {
          await onUpdateMemberConfig();
        }
      } else {
        const errText = await response.text();
        setMemberConfigSaveError(`儲存失敗: ${errText}`);
      }
    } catch (err: any) {
      setMemberConfigSaveError(`發生錯誤: ${err?.message || err}`);
    } finally {
      setIsSavingMemberConfig(false);
    }
  };

  const handleSanitizeSystemData = async () => {
    setSanitizeError(null);
    setSanitizeSuccess(null);
    setSanitizeLoading(true);
    try {
      const pinToVerify = sanitizePin.trim();
      if (!pinToVerify) {
        setSanitizeError('請輸入員工解鎖 PIN 碼以確認執行安全簽核。');
        setSanitizeLoading(false);
        return;
      }

      const response = await apiFetch('/api/admin/clear-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify }),
      });

      const resData = await response.json();
      if (!response.ok) {
        setSanitizeError(resData.error || '清除測試數據失敗，請檢查安全 PIN 碼是否正確。');
        setSanitizeLoading(false);
        return;
      }

      if (clearLocalMembers) {
        localStorage.removeItem('google-members-database');
      }

      setSanitizeSuccess(
        '🎯 ' + (resData.message || '已成功清除系統內所有測試用歷史單據及暫存日誌！'),
      );
      setSanitizePin('');

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1500);
    } catch (err: any) {
      setSanitizeError('系統清洗失敗: ' + (err.message || err));
    } finally {
      setSanitizeLoading(false);
    }
  };

  // Sales Query states
  const [dateRangeFilter, setDateRangeFilter] = useState<
    'all' | 'today' | 'week' | 'month' | 'custom'
  >('all');
  const [orderQueryStartDate, setOrderQueryStartDate] = useState('');
  const [orderQueryEndDate, setOrderQueryEndDate] = useState('');
  const [orderQueryStatus, setOrderQueryStatus] = useState<string>('all');
  const [orderQueryKeyword, setOrderQueryKeyword] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cashReceivedInput, setCashReceivedInput] = useState<number>(0);

  // Synchronize cashReceivedInput with order total
  useEffect(() => {
    if (selectedOrder) {
      setCashReceivedInput(selectedOrder.total);
    }
  }, [selectedOrder]);

  // Paid Order Modifications (Return & Refund workflow)
  const [paidModDetails, setPaidModDetails] = useState<{
    item?: any;
    menuItemId?: string;
    delta: number;
    isAddingNew: boolean;
  } | null>(null);
  const [modReason, setModReason] = useState('input_error');
  const [modNotes, setModNotes] = useState('');
  const [modPin, setModPin] = useState('');

  const handleSavePaidModification = async () => {
    if (!selectedOrder || !onUpdateOrderItems || !paidModDetails) return;

    // Validate PIN with backend
    try {
      const pinRes = await apiFetch('/api/staff/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: modPin.trim() }),
      });
      if (!pinRes.ok) {
        const errData = await pinRes.json().catch(() => ({}));
        alert(`❌ 簽核失敗：${errData.error || '員工授權 PIN 碼不正確！請重新輸入。'}`);
        return;
      }
    } catch (e) {
      alert('❌ 網路連線或伺服器驗證失敗，請稍後再試。');
      return;
    }

    let updatedItems = [...selectedOrder.items];
    const originalPrice = selectedOrder.total;
    const qtyChange = paidModDetails.delta;
    let itemName = '';
    let unitPrice = 0;

    if (paidModDetails.isAddingNew) {
      // Step 1: Manual item adding
      const dish = menuItems.find((m: any) => m.id === paidModDetails.menuItemId);
      if (!dish) {
        alert('❌ 找不到該餐點資料！');
        return;
      }
      itemName = getLocalizedText(dish.name, 'zh') || dish.name;
      unitPrice = dish.price;

      const existing = updatedItems.find((it: any) => it.menuItemId === dish.id);
      if (existing) {
        updatedItems = updatedItems.map((it: any) => {
          if (it.menuItemId === dish.id) {
            return { ...it, qty: it.qty + 1 };
          }
          return it;
        });
      } else {
        const newItem = {
          id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          menuItemId: dish.id,
          name: typeof dish.name === 'object' ? dish.name : { zh: dish.name, en: dish.name }, // keep consistent
          price: dish.price,
          qty: 1,
          customization: {
            sweetness: 2,
            spiciness: 1,
            notes: '已結帳後台手動補加 / Post-payment added',
          },
        };
        updatedItems = [...updatedItems, newItem];
      }
    } else {
      // Step 2: Modifying existing quantity
      const targetItem = updatedItems.find((it: any) => it.id === paidModDetails.item.id);
      if (!targetItem) {
        alert('❌ 點單中查無此餐點！');
        return;
      }
      itemName = targetItem.name?.zh || targetItem.name;
      unitPrice = targetItem.price;

      updatedItems = updatedItems
        .map((it: any) => {
          if (it.id === paidModDetails.item.id) {
            return { ...it, qty: it.qty + qtyChange };
          }
          return it;
        })
        .filter((it: any) => it.qty > 0);
    }

    // Recompute total & diff
    const subtotal = computeOrderItemsSubtotal(updatedItems, menuItems);
    const serviceCharge =
      selectedOrder.paymentMethod === 'credit' || selectedOrder.paymentMethod === 'twqr'
        ? Math.round(subtotal * 0.1)
        : 0;
    const total = subtotal + serviceCharge;
    const totalDiff = total - originalPrice;

    // Create unique log item
    const REASONS_MAP: Record<string, string> = {
      kitchen_prep_error: '🍳 廚房製餐瑕疵 / 食安事件',
      wrong_delivery: '🚶‍♂️ 員工送錯桌席 / 漏做重出',
      customer_cancel: '⏳ 餐期延誤 / 顧客臨時取消',
      input_error: '收銀點錯帳目更正 / 系統修正',
      sold_out: '🚫 食材告罄 / 沽清被迫退餐',
      vip_promo: '🎁 VIP 招待 / 自主促銷補償',
      customer_addon: '➕ 客人追加現場點餐',
    };

    const newLog = {
      id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      type: totalDiff < 0 ? 'refund' : 'addon',
      itemName: itemName,
      pricePerUnit: unitPrice,
      qtyChange: qtyChange,
      totalDiff: totalDiff,
      reason: REASONS_MAP[modReason] || modReason,
      notes: modNotes.trim() || '無特別備註',
      authorizedByPin: `Staff PIN: ****${modPin.slice(-2)}`,
    };

    // If payment method is member, sync membership database
    if (selectedOrder.paymentMethod === 'member') {
      const dbStr = localStorage.getItem('google-members-database');
      if (dbStr) {
        try {
          const db = JSON.parse(dbStr);
          let vipEmail = '';
          if (selectedOrder.customerName) {
            const matched = db.find((m: any) => m.name === selectedOrder.customerName);
            if (matched) vipEmail = matched.email;
          }
          const userIndex = vipEmail ? db.findIndex((m: any) => m.email === vipEmail) : -1;
          if (userIndex !== -1) {
            const currentBal = db[userIndex].balance || 0;
            const finalBal = currentBal - totalDiff; // Negative totalDiff means refund, which increases balance (+ absolute totalDiff)

            if (finalBal < 0) {
              alert(
                `⚠️ 警告：此會員儲值卡餘額不足（剩餘: NT$ ${currentBal}）！自動扣減使餘額透支，請現場向顧客索取差額 ${Math.abs(finalBal)} 元！`,
              );
            }
            db[userIndex].balance = Math.max(0, finalBal);
            localStorage.setItem('google-members-database', JSON.stringify(db));
            alert(
              `💳 因應本次退貨/加點核銷：會員額度已自動變更，原額: NT$ ${currentBal} ➔ 現額: NT$ ${db[userIndex].balance}`,
            );
          }
        } catch (e) {
          console.error(e);
        }
      }
    } else if (selectedOrder.paymentMethod === 'cash') {
      if (totalDiff < 0) {
        alert(
          `💵 現金退款核銷通知：本更動完成後，請現場從收銀機退還顧客現金 NT$ ${Math.abs(totalDiff)} 元！`,
        );
      } else if (totalDiff > 0) {
        alert(
          `💵 現金補款稽核通知：本更動完成後，請向顧客加收額外現金 NT$ ${totalDiff} 元，並確認投入收銀機中！`,
        );
      }
    } else {
      // Credit/TWQR
      alert(
        `💳 電子款項金流調帳通知：此單採線上電子支付。差額 NT$ ${totalDiff} 元，已對應記為店家記帳退補核對項。`,
      );
    }

    // Save and sync with backend
    const logs = selectedOrder.refundLogs ? [...selectedOrder.refundLogs, newLog] : [newLog];
    await onUpdateOrderItems(selectedOrder.id, updatedItems, logs);

    // Update selectedOrder modal state to sync UI
    setSelectedOrder({
      ...selectedOrder,
      items: updatedItems,
      subtotal,
      serviceCharge,
      total,
      refundLogs: logs,
    });

    // Reset state & close modal
    setPaidModDetails(null);
    setModReason('input_error');
    setModNotes('');
    setModPin('');
    alert('✅ 已結帳點單帳目異動稽查記錄，已與 Cloud Firestore 資料庫安全核算並同步更新！');
  };

  // Cashier Subsystem States
  const [selectedCashierOrderId, setSelectedCashierOrderId] = useState<string | null>(null);
  const [cashierDiscountRate, setCashierDiscountRate] = useState<number>(0); // percentage, e.g. 10 for 10% off
  const [cashierDiscountFlat, setCashierDiscountFlat] = useState<number>(0); // flat NT$ off
  const [cashierDiscountType, setCashierDiscountType] = useState<'percent' | 'flat'>('percent');
  const [cashierSurchargeRate, setCashierSurchargeRate] = useState<number>(0); // percentage surcharge, e.g. 10 for +10% service charge
  const [cashierSurchargeFlat, setCashierSurchargeFlat] = useState<number>(0); // flat NT$ surcharge
  const [cashierSurchargeType, setCashierSurchargeType] = useState<'percent' | 'flat'>('percent');
  const [cashierPaymentMethod, setCashierPaymentMethod] = useState<
    'cash' | 'credit' | 'member' | 'twqr'
  >('cash');
  const [cashierCashChannel, setCashierCashChannel] = useState<'counter' | 'kiosk' | 'delivery'>(
    'counter',
  );
  const [cashierCashReceived, setCashierCashReceived] = useState<number>(0);
  const [cashierListFilter, setCashierListFilter] = useState<
    'all' | 'completed' | 'dinein' | 'takeout'
  >('all');
  const [isAdjustingDiscount, setIsAdjustingDiscount] = useState<boolean>(false);
  const [isAdjustingSurcharge, setIsAdjustingSurcharge] = useState<boolean>(false);

  // Auto-scaling width and fit screen boundary state & logic
  const [cashierPanelWidth, setCashierPanelWidth] = useState<number>(48);
  const [isCashierWidthAuto, setIsCashierWidthAuto] = useState<boolean>(true);

  useEffect(() => {
    if (!isCashierWidthAuto) return;
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 1280) {
        setCashierPanelWidth(100);
      } else if (w < 1600) {
        setCashierPanelWidth(48);
      } else if (w < 1920) {
        setCashierPanelWidth(46);
      } else {
        setCashierPanelWidth(40);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCashierWidthAuto]);

  const getPanelWidthClass = (w: number) => {
    if (w <= 35) return 'xl:w-[35%]';
    if (w <= 40) return 'xl:w-[40%]';
    if (w <= 45) return 'xl:w-[45%]';
    if (w <= 48) return 'xl:w-[48%]';
    if (w <= 50) return 'xl:w-[50%]';
    if (w <= 55) return 'xl:w-[55%]';
    if (w <= 60) return 'xl:w-[60%]';
    if (w <= 65) return 'xl:w-[65%]';
    if (w <= 70) return 'xl:w-[70%]';
    if (w <= 75) return 'xl:w-[75%]';
    if (w <= 80) return 'xl:w-[80%]';
    if (w <= 85) return 'xl:w-[85%]';
    if (w <= 90) return 'xl:w-[90%]';
    if (w <= 95) return 'xl:w-[95%]';
    return 'xl:w-[100%]';
  };

  const filteredCashierOrders = useMemo(() => {
    switch (cashierListFilter) {
      case 'completed':
        return orders.filter((o) => !o.isPaid && o.status === 'completed');
      case 'dinein':
        return orders.filter((o) => !o.isPaid && o.tableNumber && !o.tableNumber.includes('外帶'));
      case 'takeout':
        return orders.filter((o) => !o.isPaid && o.tableNumber && o.tableNumber.includes('外帶'));
      case 'all':
      default:
        return orders.filter((o) => !o.isPaid);
    }
  }, [orders, cashierListFilter]);

  const cashierSelectedOrder = useMemo(() => {
    if (!selectedCashierOrderId) return null;
    return orders.find((o) => o.id === selectedCashierOrderId) || null;
  }, [orders, selectedCashierOrderId]);

  // Cashier item addition dropdown state
  const [cashierNewItemInput, setCashierNewItemInput] = useState<string>('');

  const handleCashierAddMenuItem = async (menuItemId: string) => {
    if (!cashierSelectedOrder || !onUpdateOrderItems) return;
    const dish = menuItems.find((m: any) => m.id === menuItemId);
    if (!dish) return;

    const existing = cashierSelectedOrder.items.find((it: any) => it.menuItemId === menuItemId);
    let updatedItems;
    if (existing) {
      updatedItems = cashierSelectedOrder.items.map((it: any) => {
        if (it.menuItemId === menuItemId) {
          return { ...it, qty: it.qty + 1 };
        }
        return it;
      });
    } else {
      const newItem = {
        id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        menuItemId: dish.id,
        name: dish.name,
        price: dish.price,
        qty: 1,
        customization: {
          sweetness: 2,
          spiciness: 1,
          notes: '櫃檯收銀加點',
        },
      };
      updatedItems = [...cashierSelectedOrder.items, newItem];
    }

    await onUpdateOrderItems(cashierSelectedOrder.id, updatedItems);
    setCashierNewItemInput('');
  };

  useEffect(() => {
    if (cashierSelectedOrder) {
      setCashierDiscountRate(0);
      setCashierDiscountFlat(0);
      setCashierDiscountType('percent');
      setIsAdjustingDiscount(false);
      setIsAdjustingSurcharge(false);

      const method =
        cashierSelectedOrder.paymentMethod === 'credit'
          ? 'credit'
          : cashierSelectedOrder.paymentMethod === 'member'
            ? 'member'
            : cashierSelectedOrder.paymentMethod === 'twqr'
              ? 'twqr'
              : 'cash';
      setCashierPaymentMethod(method);

      if (method === 'credit' || method === 'twqr') {
        setCashierSurchargeRate(10);
        setCashierSurchargeFlat(0);
        setCashierSurchargeType('percent');
      } else {
        setCashierSurchargeRate(0);
        setCashierSurchargeFlat(0);
        setCashierSurchargeType('percent');
      }
    }
  }, [selectedCashierOrderId]);

  const cashierMergedOrders = useMemo(() => {
    if (!cashierSelectedOrder) return [];

    const curTableId = cashierSelectedOrder.tableNumber;
    if (!curTableId || curTableId.includes('外帶')) {
      return [cashierSelectedOrder];
    }

    const curTableObj = tables.find((t) => t.id === curTableId);
    const leadTableId = curTableObj?.mergedWith || curTableId;

    const mergedTableIds = tables
      .filter((t) => t.id === leadTableId || t.mergedWith === leadTableId)
      .map((t) => t.id);

    const unpaidMerged = orders.filter((o) => !o.isPaid && mergedTableIds.includes(o.tableNumber));

    if (unpaidMerged.length === 0 || !unpaidMerged.find((o) => o.id === cashierSelectedOrder.id)) {
      return [cashierSelectedOrder];
    }
    return unpaidMerged;
  }, [cashierSelectedOrder, orders, tables]);

  const handleCombinedQtyChange = async (orderId: string, itemId: string, delta: number) => {
    if (!onUpdateOrderItems) return;
    const ordObj = orders.find((o) => o.id === orderId);
    if (!ordObj) return;
    const updatedItems = ordObj.items
      .map((it: any) => {
        if (it.id === itemId) {
          return { ...it, qty: it.qty + delta };
        }
        return it;
      })
      .filter((it: any) => it.qty > 0);

    if (updatedItems.length === 0) {
      setConfirmActionModal({
        isOpen: true,
        title: '⚠️ 訂單已無菜品',
        message: `訂單 [${orderId}] 的菜品已被清空。是否直接刪除此訂單？`,
        actionLabel: '確定刪除 Delete',
        onConfirm: async () => {
          if (onDeleteOrder) {
            await onDeleteOrder(orderId);
          }
          if (selectedCashierOrderId === orderId) {
            setSelectedCashierOrderId(null);
          }
        },
      });
      return;
    }

    await onUpdateOrderItems(orderId, updatedItems);
  };

  const handleCombinedRemoveItem = async (orderId: string, itemId: string) => {
    if (!onUpdateOrderItems) return;
    const ordObj = orders.find((o) => o.id === orderId);
    if (!ordObj) return;
    const updatedItems = ordObj.items.filter((it: any) => it.id !== itemId);

    if (updatedItems.length === 0) {
      setConfirmActionModal({
        isOpen: true,
        title: '⚠️ 訂單已無菜品',
        message: `移除此品項後，訂單 [${orderId}] 將無任何菜品。是否直接刪除此訂單？`,
        actionLabel: '確定刪除 Delete',
        onConfirm: async () => {
          if (onDeleteOrder) {
            await onDeleteOrder(orderId);
          }
          if (selectedCashierOrderId === orderId) {
            setSelectedCashierOrderId(null);
          }
        },
      });
      return;
    }

    await onUpdateOrderItems(orderId, updatedItems);
  };

  const cashierCalculatedTotals = useMemo(() => {
    if (!cashierSelectedOrder) return { subtotal: 0, discount: 0, surcharge: 0, total: 0 };

    const sub = cashierMergedOrders.reduce((sum, o) => {
      const itemsSub = computeOrderItemsSubtotal(o.items || [], menuItems);
      return sum + (itemsSub > 0 ? itemsSub : o.subtotal || 0);
    }, 0);

    // Both Surcharge and Discount are calculated using the original Subtotal (sub) as the reference base
    let manualDiscount = 0;
    if (cashierDiscountType === 'percent') {
      manualDiscount = Math.round(sub * (cashierDiscountRate / 100));
    } else {
      manualDiscount = Math.round(cashierDiscountFlat);
    }

    let surcharge = 0;
    if (cashierSurchargeType === 'percent') {
      surcharge = Math.round(sub * (cashierSurchargeRate / 100));
    } else {
      surcharge = Math.round(cashierSurchargeFlat);
    }
    if (surcharge < 0) surcharge = 0;

    // Auto-combo promo and other pre-existing discounts linked to the orders (優惠規則)
    const autoDiscount = cashierMergedOrders.reduce((sum, o) => sum + (o.discount || 0), 0);

    let totalDiscount = manualDiscount + autoDiscount;
    if (totalDiscount > sub) totalDiscount = sub;
    if (totalDiscount < 0) totalDiscount = 0;

    const finalTotal = Math.max(0, sub - totalDiscount + surcharge);

    return {
      subtotal: sub,
      discount: totalDiscount,
      surcharge,
      total: finalTotal,
    };
  }, [
    cashierSelectedOrder,
    cashierMergedOrders,
    cashierDiscountType,
    cashierDiscountRate,
    cashierDiscountFlat,
    cashierSurchargeType,
    cashierSurchargeRate,
    cashierSurchargeFlat,
  ]);

  useEffect(() => {
    if (cashierCalculatedTotals) {
      setCashierCashReceived(cashierCalculatedTotals.total);
    }
  }, [cashierCalculatedTotals.total]);

  const handleCashierCheckoutSubmit = async () => {
    if (!cashierSelectedOrder || !onPayOrder) return;
    if (isCheckoutSubmitting) return;

    if (cashierPaymentMethod === 'cash' && cashierCashReceived < cashierCalculatedTotals.total) {
      alert(
        `⚠️ 實收現金金額不足！實收 (NT$ ${cashierCashReceived}) 需大於或等於應收總額 (NT$ ${cashierCalculatedTotals.total})。`,
      );
      return;
    }

    if (cashierPaymentMethod === 'member') {
      const dbStr = localStorage.getItem('google-members-database');
      if (dbStr) {
        try {
          const db = JSON.parse(dbStr);
          let vipEmail = '';
          if (cashierSelectedOrder?.customerName) {
            const matched = db.find((m: any) => m.name === cashierSelectedOrder.customerName);
            if (matched) {
              vipEmail = matched.email;
            }
          }
          const userIndex = vipEmail ? db.findIndex((m: any) => m.email === vipEmail) : -1;
          if (userIndex >= 0) {
            const currentBal = db[userIndex].balance || 0;
            if (currentBal < cashierCalculatedTotals.total) {
              alert(
                `⚠️ 會員餘額不足 (剩餘: NT$ ${currentBal})！無法進行扣底結帳，請先在右側點選【儲值增額】。`,
              );
              return;
            }
            // Deduct
            db[userIndex].balance = currentBal - cashierCalculatedTotals.total;
            localStorage.setItem('google-members-database', JSON.stringify(db));
            window.dispatchEvent(new Event('local-points-updated'));
          } else {
            alert(`⚠️ 找不到匹配此結帳單的會員，無法使用會員餘額付款！`);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    setIsCheckoutSubmitting(true);
    try {
      const change =
        cashierPaymentMethod === 'cash' ? cashierCashReceived - cashierCalculatedTotals.total : 0;

      const mergedTableIds = cashierMergedOrders.map((o) => o.tableNumber);
      const mergedOrderIds = cashierMergedOrders.map((o) => o.id);

      const checkoutRecord = {
        id: `TX-${Date.now()}`,
        orderId: cashierSelectedOrder.id,
        tableNumber: cashierSelectedOrder.tableNumber,
        mergedTableNumbers: mergedTableIds,
        mergedOrderIds: mergedOrderIds,
        subtotal: cashierCalculatedTotals.subtotal,
        discount: cashierCalculatedTotals.discount,
        serviceCharge: cashierCalculatedTotals.surcharge,
        total: cashierCalculatedTotals.total,
        amountPaid:
          cashierPaymentMethod === 'cash' ? cashierCashReceived : cashierCalculatedTotals.total,
        changeProvided: change,
        paymentMethod: cashierPaymentMethod,
        staffPin: staffPin || '070718',
        checkoutTime: new Date().toISOString(),
      };

      // Create a filtered record for Cloud Firestore to comply with rigid security rules/schemas
      const dbPostRecord = {
        id: checkoutRecord.id,
        orderId: checkoutRecord.orderId,
        tableNumber: checkoutRecord.tableNumber,
        subtotal: checkoutRecord.subtotal,
        discount: checkoutRecord.discount,
        serviceCharge: checkoutRecord.serviceCharge,
        total: checkoutRecord.total,
        amountPaid: checkoutRecord.amountPaid,
        changeProvided: checkoutRecord.changeProvided,
        paymentMethod: checkoutRecord.paymentMethod,
        staffPin: checkoutRecord.staffPin,
        checkoutTime: checkoutRecord.checkoutTime,
      };

      try {
        if (isFirebaseSyncEnabled()) {
          await setDoc(doc(db, 'checkouts', dbPostRecord.id), dbPostRecord);
          console.log(
            '✓ Successfully uploaded cashier checkout record to Cloud Firestore. Doc ID:',
            dbPostRecord.id,
          );
        }
      } catch (err: any) {
        console.warn(
          '⚠️ Firestore upload failed or sync disabled, continuing with local POS checkout flow gracefully:',
          err,
        );
      }

      // Make a static copy of the merged orders array to prevent recalculated useMemo states mid-loop
      const staticMergedOrders = [...cashierMergedOrders];

      // Update all merged orders as paid!
      for (let i = 0; i < staticMergedOrders.length; i++) {
        const ord = staticMergedOrders[i];
        // We only trigger fetchData() (re-rendering) on the very last order in the loop
        const skipRefresh = i < staticMergedOrders.length - 1;

        if (ord.id === cashierSelectedOrder.id) {
          await onPayOrder(
            cashierSelectedOrder.id,
            {
              paymentMethod: cashierPaymentMethod,
              subtotal: cashierCalculatedTotals.subtotal,
              serviceCharge: cashierCalculatedTotals.surcharge,
              discount: cashierCalculatedTotals.discount,
              total: cashierCalculatedTotals.total,
              isPaid: true,
            },
            skipRefresh,
          );
        } else {
          await onPayOrder(
            ord.id,
            {
              paymentMethod: cashierPaymentMethod,
              subtotal: 0,
              serviceCharge: 0,
              discount: 0,
              total: 0,
              isPaid: true,
            },
            skipRefresh,
          );
        }
      }

      // Releases all merged tables
      if (onUpdateTableStatus) {
        for (const tid of mergedTableIds) {
          if (tid && !tid.includes('外帶')) {
            await onUpdateTableStatus(tid, {
              status: 'cleaning',
              preservedFor: '',
              mergedWith: '',
              cleaningStartedAt: new Date().toISOString(),
            });
          }
        }
      }

      setSelectedCashierOrderId(null);

      setCheckoutSuccessData({
        id: cashierSelectedOrder.id,
        tableNumber: cashierSelectedOrder.tableNumber,
        subtotal: checkoutRecord.subtotal,
        discount: checkoutRecord.discount,
        serviceCharge: checkoutRecord.serviceCharge,
        total: checkoutRecord.total,
        amountPaid: checkoutRecord.amountPaid,
        changeProvided: checkoutRecord.changeProvided,
        paymentMethod: checkoutRecord.paymentMethod,
        isCashier: true,
      });

      // Cash drawer interlock linkage
      if (billPrinter.cashDrawerEnabled) {
        apiFetch('/api/printer/open-drawer', { method: 'POST' })
          .then((res) => res.json())
          .then((data) => {
            console.log('[Cash Drawer Interlock Cloud Log]', data.log);
          })
          .catch((e) => console.error('[Cash Drawer Interlock Error]', e));

        // Hosted Firebase environment local PC bridge relay
        if (
          typeof window !== 'undefined' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1'
        ) {
          fetch('http://localhost:3000/api/printer/open-drawer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(1000),
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('[Cashier Checkout processing error]', err);
      alert(`❌ 收銀失敗: ${err?.message || String(err)}`);
    } finally {
      setIsCheckoutSubmitting(false);
    }
  };

  const handleManualOpenDrawer = async () => {
    try {
      let data: any = null;
      const res = await apiFetch('/api/printer/open-drawer', {
        method: 'POST',
      });
      if (res.ok) {
        data = await res.json();
      }

      // Hosted Firebase environment local PC bridge relay fallback
      let bridgeSuccess = false;
      let bridgeLog = '';
      if (
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        try {
          const bRes = await fetch('http://localhost:3000/api/printer/open-drawer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(1200),
          });
          if (bRes.ok) {
            const bData = await bRes.json();
            bridgeSuccess = bData.success;
            bridgeLog = bData.log;
          }
        } catch {
          // Local bridge not running or unreachable
        }
      }

      if ((data && data.success) || bridgeSuccess) {
        const logMsg = bridgeLog || (data ? data.log : '') || 'ESC/POS 脈衝指令觸發成功';
        alert(`✓ 🔓 實體收銀箱抽屜已成功彈開！\n\n【硬體通訊日誌】:\n${logMsg}`);
      } else {
        const errDetail = (data && data.log) || '請確認 58mm 印表機線路與系統通訊埠設定';
        alert(`⚠️ 開啟收銀箱結果回應:\n${errDetail}`);
      }
    } catch (e: any) {
      console.error('[Manual open cash drawer error]', e);
      alert(`❌ 連線或操作錯誤: ${e?.message || String(e)}`);
    }
  };

  const handleLocalQtyChange = async (itemId: string, delta: number) => {
    if (!selectedOrder || !onUpdateOrderItems) return;
    const updatedItems = selectedOrder.items
      .map((it: any) => {
        if (it.id === itemId) {
          return { ...it, qty: it.qty + delta };
        }
        return it;
      })
      .filter((it: any) => it.qty > 0);

    if (updatedItems.length === 0) {
      setConfirmActionModal({
        isOpen: true,
        title: '⚠️ 訂單已無菜品',
        message: `訂單 [${selectedOrder.id}] 的菜品已被清空。是否直接刪除此訂單？`,
        actionLabel: '確定刪除 Delete',
        onConfirm: async () => {
          if (onDeleteOrder) {
            await onDeleteOrder(selectedOrder.id);
          }
          setSelectedOrder(null);
        },
      });
      return;
    }

    // Call callback to sync with backend
    await onUpdateOrderItems(selectedOrder.id, updatedItems);

    // Also update selectedOrder local modal state to prevent lag
    const subtotal = computeOrderItemsSubtotal(updatedItems, menuItems);
    const discount = selectedOrder.discount || 0;
    const serviceCharge =
      selectedOrder.paymentMethod === 'credit' || selectedOrder.paymentMethod === 'twqr'
        ? Math.round(subtotal * 0.1)
        : 0;
    const total = Math.max(0, subtotal - discount + serviceCharge);

    setSelectedOrder({
      ...selectedOrder,
      items: updatedItems,
      subtotal,
      serviceCharge,
      total,
    });
  };

  const handleAddLocalItem = async (menuItemId: string) => {
    if (!selectedOrder || !onUpdateOrderItems) return;
    const dish = menuItems.find((m: any) => m.id === menuItemId);
    if (!dish) return;

    const existing = selectedOrder.items.find((it: any) => it.menuItemId === menuItemId);
    let updatedItems;
    if (existing) {
      updatedItems = selectedOrder.items.map((it: any) => {
        if (it.menuItemId === menuItemId) {
          return { ...it, qty: it.qty + 1 };
        }
        return it;
      });
    } else {
      const newItem = {
        id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        menuItemId: dish.id,
        name: dish.name,
        price: dish.price,
        qty: 1,
        customization: {
          sweetness: 2,
          spiciness: 1,
          notes: '後台手動加點 / Added by admin',
        },
      };
      updatedItems = [...selectedOrder.items, newItem];
    }

    // Sync with backend
    await onUpdateOrderItems(selectedOrder.id, updatedItems);

    const subtotal = computeOrderItemsSubtotal(updatedItems, menuItems);
    const discount = selectedOrder.discount || 0;
    const serviceCharge =
      selectedOrder.paymentMethod === 'credit' || selectedOrder.paymentMethod === 'twqr'
        ? Math.round(subtotal * 0.1)
        : 0;
    const total = Math.max(0, subtotal - discount + serviceCharge);

    setSelectedOrder({
      ...selectedOrder,
      items: updatedItems,
      subtotal,
      serviceCharge,
      total,
    });
  };

  const handleProcessCheckout = async () => {
    if (!selectedOrder || !onPayOrder) return;
    if (isCheckoutSubmitting) return;

    if (selectedOrder.paymentMethod === 'cash' && cashReceivedInput < selectedOrder.total) {
      alert(
        `⚠️ 實收金額不足！實收 (NT$ ${cashReceivedInput}) 需大於或等於總額 (NT$ ${selectedOrder.total})。`,
      );
      return;
    }

    if (selectedOrder.paymentMethod === 'member') {
      const dbStr = localStorage.getItem('google-members-database');
      if (dbStr) {
        try {
          const db = JSON.parse(dbStr);
          let vipEmail = '';
          if (selectedOrder.customerName) {
            const matched = db.find((m: any) => m.name === selectedOrder.customerName);
            if (matched) {
              vipEmail = matched.email;
            }
          }
          const userIndex = vipEmail ? db.findIndex((m: any) => m.email === vipEmail) : -1;
          if (userIndex >= 0) {
            const currentBal = db[userIndex].balance || 0;
            if (currentBal < selectedOrder.total) {
              alert(
                `⚠️ 會員餘額不足 (剩餘: NT$ ${currentBal})！無法進行扣抵結帳，請先至收銀台點選【儲值增額】。`,
              );
              return;
            }
            // Deduct
            db[userIndex].balance = currentBal - selectedOrder.total;
            localStorage.setItem('google-members-database', JSON.stringify(db));
            window.dispatchEvent(new Event('local-points-updated'));
          } else {
            alert(`⚠️ 找不到匹配此結帳單的會員，無法使用會員餘額付款！`);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        alert(`⚠️ 未能獲取會員資料庫，請確認會員數據已初始化。`);
        return;
      }
    }

    setIsCheckoutSubmitting(true);
    try {
      const change =
        selectedOrder.paymentMethod === 'cash' ? cashReceivedInput - selectedOrder.total : 0;

      const checkoutRecord = {
        id: `TX-${Date.now()}`,
        orderId: selectedOrder.id,
        tableNumber: selectedOrder.tableNumber,
        subtotal: selectedOrder.subtotal,
        serviceCharge: selectedOrder.serviceCharge,
        total: selectedOrder.total,
        amountPaid:
          selectedOrder.paymentMethod === 'cash' ? cashReceivedInput : selectedOrder.total,
        changeProvided: change,
        paymentMethod: selectedOrder.paymentMethod,
        staffPin: staffPin || '070718',
        checkoutTime: new Date().toISOString(),
      };

      try {
        if (isFirebaseSyncEnabled()) {
          await setDoc(doc(db, 'checkouts', checkoutRecord.id), checkoutRecord);
          console.log(
            '✓ Successfully uploaded checkout record to Cloud Firestore. Doc ID:',
            checkoutRecord.id,
          );
        }
      } catch (error: any) {
        console.warn(
          '⚠️ Firestore upload failed or sync disabled, continuing with local checkout flow:',
          error,
        );
      }

      await onPayOrder(selectedOrder.id);

      setSelectedOrder({
        ...selectedOrder,
        isPaid: true,
        status: selectedOrder.status,
      });

      setCheckoutSuccessData({
        id: selectedOrder.id,
        tableNumber: selectedOrder.tableNumber,
        subtotal: selectedOrder.subtotal,
        discount: selectedOrder.discount || 0,
        serviceCharge: selectedOrder.serviceCharge,
        total: selectedOrder.total,
        amountPaid: checkoutRecord.amountPaid,
        changeProvided: checkoutRecord.changeProvided,
        paymentMethod: selectedOrder.paymentMethod,
        isCashier: false,
      });
    } catch (error: any) {
      console.error('Failed to processed checkout to database:', error);
      alert(`⚠️ 資料庫寫入失敗！請確認 Firebase 設定。錯誤: ${error.message || error}`);
    } finally {
      setIsCheckoutSubmitting(false);
    }
  };

  // Inventory transaction ledger logs
  const [dbInventoryLogs, setDbInventoryLogs] = useState<any[]>([]);
  const [manualAdjustId, setManualAdjustId] = useState('');
  const [manualAdjustQty, setManualAdjustQty] = useState('');
  const [manualAdjustNote, setManualAdjustNote] = useState('');
  const [inventoryLogSearch, setInventoryLogSearch] = useState('');
  const [restockAmount, setRestockAmount] = useState<{ [key: string]: number }>({});
  const [quickRestockItem, setQuickRestockItem] = useState<Ingredient | null>(null);
  const [quickRestockQty, setQuickRestockQty] = useState('');

  // Add Ingredient states
  const [newIngId, setNewIngId] = useState('');
  const [newIngNameZh, setNewIngNameZh] = useState('');
  const [newIngNameEn, setNewIngNameEn] = useState('');
  const [newIngStock, setNewIngStock] = useState('');
  const [newIngMinThreshold, setNewIngMinThreshold] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');

  // Today's Bestsellers Management States
  const [localPopularIds, setLocalPopularIds] = useState<string[]>(popularItemIds);
  const [isSavingPopular, setIsSavingPopular] = useState(false);
  const [popularItemToRemoveId, setPopularItemToRemoveId] = useState<string | null>(null);
  const [showClearAllPopularConfirm, setShowClearAllPopularConfirm] = useState(false);
  const [popularSaveStatus, setPopularSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [printConfirmData, setPrintConfirmData] = useState<{
    title: string;
    ip: string;
    onConfirm: () => void;
    receiptType?: string;
    receiptBody?: string;
  } | null>(null);

  // Synchronized Print Logs for Manager Exporting
  const [printLogs, setPrintLogs] = useState<any[]>([]);
  const fetchPrintLogs = async () => {
    try {
      const res = await apiFetch('/api/print-logs');
      if (res.ok) {
        const data = await res.json();
        setPrintLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const prevPopularItemIdsRef = React.useRef<string>(JSON.stringify(popularItemIds));

  useEffect(() => {
    const currentSerialized = JSON.stringify(popularItemIds);
    if (currentSerialized !== prevPopularItemIdsRef.current) {
      setLocalPopularIds(popularItemIds);
      prevPopularItemIdsRef.current = currentSerialized;
    }
  }, [popularItemIds]);

  // Menu Creation/Editing states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemNameZh, setItemNameZh] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemCategory, setItemCategory] = useState('skewers');
  const [itemPrice, setItemPrice] = useState(100);
  const [itemImage, setItemImage] = useState(
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400',
  );
  const [itemDescZh, setItemDescZh] = useState('');
  const [itemDescEn, setItemDescEn] = useState('');
  const [hasNoodles, setHasNoodles] = useState(false);
  const [isNotSpicy, setIsNotSpicy] = useState(false);
  const [isTakeoutAvailable, setIsTakeoutAvailable] = useState(false);
  const [customAddOns, setCustomAddOns] = useState<any[]>([]);
  const [itemRecipe, setItemRecipe] = useState<{ ingredientId: string; amount: number }[]>([]);
  const [newRecipeIngId, setNewRecipeIngId] = useState('');
  const [newRecipeAmount, setNewRecipeAmount] = useState('1');

  // Category Creation/Editing states
  const [isCatFormOpen, setIsCatFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catId, setCatId] = useState('');
  const [catNameZh, setCatNameZh] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameTh, setCatNameTh] = useState('');
  const [catNameJa, setCatNameJa] = useState('');
  const [catNameKo, setCatNameKo] = useState('');
  const [catNameVi, setCatNameVi] = useState('');
  const [catError, setCatError] = useState<string | null>(null);
  const [catShowOnCustomer, setCatShowOnCustomer] = useState<boolean>(true);

  // Google Members state and points database
  const [membersList, setMembersList] = useState<any[]>([]);

  // Option Rules States
  const [globalRules, setGlobalRules] = useState<any[]>([]);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('加配料');
  const [newRulePrice, setNewRulePrice] = useState<number | ''>(20);

  // Printer Configuration States
  const [kitchenPrinter, setKitchenPrinter] = useState({
    connectionType: 'IP',
    ip: '192.168.1.101',
    usbPort: 'USB001',
    width: '80mm',
    fontSizeFactor: 1.0,
    restaurantName: '沙貝燒烤 泰式廚房',
    printTelephone: '02-1234-5678',
    printAddress: '台北市信義區泰式一番街8號',
    printTimeEnabled: true,
    headerPrefix: '★★★ 廚房工作備餐單 ★★★',
    footerSuffix: '請主廚盡速配餐出餐！',
  });
  const [billPrinter, setBillPrinter] = useState({
    connectionType: 'USB',
    ip: '192.168.1.102',
    usbPort: 'USB002',
    width: '58mm',
    fontSizeFactor: 0.8,
    restaurantName: '沙貝燒烤 SABAY BBQ',
    printTelephone: '02-1234-5678',
    printAddress: '台北市信義區泰式一番街8號',
    printTimeEnabled: true,
    headerPrefix: '★★★ 顧客結帳明細單 ★★★',
    footerSuffix: '謝謝光臨，歡迎再度光臨！',
    cashDrawerEnabled: true,
    cashDrawerDriver: 'ESC_POS_RAW', // 'OPOS' | 'POS_NET' | 'ESC_POS_RAW'
    cashDrawerOposName: 'CashDrawer1',
    cashDrawerEscPosCommand: '1B700019FA',
  });

  const [printerSaveSuccess, setPrinterSaveSuccess] = useState<string | null>(null);

  const fetchGlobalRules = async () => {
    try {
      const res = await apiFetch('/api/option-rules');
      if (res.ok) {
        const data = await res.json();
        setGlobalRules(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPrinterSettings = async () => {
    try {
      const res = await apiFetch('/api/printer/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.kitchen) setKitchenPrinter(data.kitchen);
        if (data.bill) setBillPrinter(data.bill);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePrinters = async () => {
    try {
      const res = await apiFetch('/api/printer/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen: kitchenPrinter, bill: billPrinter }),
      });
      if (res.ok) {
        setPrinterSaveSuccess('✅ 印表機與硬體設定儲存成功！');
        setTimeout(() => setPrinterSaveSuccess(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddGlobalRule = async () => {
    if (!newRuleName.trim()) {
      alert('請輸入客製選項名稱！');
      return;
    }
    try {
      const parsedPrice =
        typeof newRulePrice === 'number' ? newRulePrice : parseInt(newRulePrice, 10);
      const finalPrice = isNaN(parsedPrice) ? 0 : parsedPrice;

      const res = await apiFetch('/api/option-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRuleName.trim(),
          category: newRuleCategory,
          price: finalPrice,
        }),
      });
      if (res.ok) {
        setNewRuleName('');
        setNewRulePrice(0);
        await fetchGlobalRules();
        alert('✅ 新增客製附加選項規則成功！');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`❌ 新增失敗：${errData.error || '伺服器錯誤'}`);
      }
    } catch (e) {
      console.error(e);
      alert('❌ 發生連線錯誤，請稍後再試！');
    }
  };

  const handleDeleteGlobalRule = async (id: string) => {
    try {
      const res = await apiFetch(`/api/option-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchGlobalRules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchGlobalRules();
    fetchPrinterSettings();
    if (activeSubTab === 'printer' || activeSubTab === 'stats') {
      fetchPrintLogs();
    }
  }, [activeSubTab]);

  // Polling servers
  useEffect(() => {
    const fetchTakeoutStatus = async () => {
      try {
        const res = await apiFetch('/api/takeout/status');
        if (res.ok) {
          const d = await res.json();
          setTakeoutStatus(d);
        }
      } catch (e) {
        console.warn('[Takeout Polling Warning]:', e);
      }
    };
    fetchTakeoutStatus();
    const interval = setInterval(fetchTakeoutStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Inventory Logs
  const fetchInventoryLogs = async () => {
    try {
      const res = await apiFetch('/api/inventory/logs');
      if (res.ok) {
        const data = await res.json();
        setDbInventoryLogs(data);
      }
    } catch (e) {
      console.warn('[Inventory logs load error]:', e);
    }
  };

  useEffect(() => {
    fetchInventoryLogs();
  }, [ingredients, orders]);

  // Load Google members statistics
  const loadMembers = () => {
    const dbStr = localStorage.getItem('google-members-database');
    if (dbStr) {
      try {
        let db = JSON.parse(dbStr);
        if (!Array.isArray(db)) {
          db = [];
        }
        // Filter out the built-in test members
        const filtered = db.filter((m: any) => {
          const emailLower = m && m.email ? m.email.toLowerCase().trim() : '';
          return (
            emailLower !== 'topztar@gmail.com' &&
            emailLower !== 'thai_foodie@gmail.com' &&
            emailLower !== 'vegan_sabay@gmail.com' &&
            emailLower !== 'bbq_lover@gmail.com'
          );
        });
        if (filtered.length !== db.length) {
          localStorage.setItem('google-members-database', JSON.stringify(filtered));
        }
        setMembersList(filtered);
      } catch (e) {
        setMembersList([]);
      }
    } else {
      const defaultMembers: any[] = [];
      localStorage.setItem('google-members-database', JSON.stringify(defaultMembers));
      setMembersList(defaultMembers);
    }
  };

  useEffect(() => {
    loadMembers();
    window.addEventListener('storage', loadMembers);
    window.addEventListener('local-points-updated', loadMembers);
    return () => {
      window.removeEventListener('storage', loadMembers);
      window.removeEventListener('local-points-updated', loadMembers);
    };
  }, []);

  // Members points modification rules
  const handleAdjustPoints = (email: string) => {
    const member = membersList.find((m) => m.email === email);
    if (!member) return;
    setAdjustPointsModal({
      isOpen: true,
      email: member.email,
      name: member.name,
      currentPoints: member.points || 0,
    });
    setAdjustPointsValue('');
    setAdjustPointsError(null);
  };

  const handleSavePointsAdjustment = () => {
    if (!adjustPointsModal) return;
    const amount = parseInt(adjustPointsValue, 10);
    if (isNaN(amount)) {
      setAdjustPointsError('❌ 請輸入有效的整數點數！');
      return;
    }
    const { email } = adjustPointsModal;
    const dbStr = localStorage.getItem('google-members-database');
    if (dbStr) {
      try {
        const db = JSON.parse(dbStr);
        const updated = db.map((m: any) => {
          if (m.email === email) {
            const finalPoints = Math.max(0, (m.points || 0) + amount);
            localStorage.setItem(`google-points-${email}`, String(finalPoints));
            return { ...m, points: finalPoints };
          }
          return m;
        });
        localStorage.setItem('google-members-database', JSON.stringify(updated));
        setMembersList(updated);
        window.dispatchEvent(new Event('local-points-updated'));
        setAdjustPointsModal(null);
      } catch (e) {
        console.error(e);
        setAdjustPointsError('儲存點數時發生資料處理錯誤！');
      }
    } else {
      setAdjustPointsError('找不到會員資料庫！');
    }
  };

  const handleDeleteMember = (email: string) => {
    const masked = getMaskedEmail(email);
    setConfirmActionModal({
      isOpen: true,
      title: '🚨 會員資料永久刪除確認',
      message: `您確定要永久刪除會員帳戶 [${masked}] 嗎？此操作將同時清空其全部點數與儲值紀錄，且無法復原。`,
      actionLabel: '確定刪除 Delete',
      onConfirm: () => {
        const dbStr = localStorage.getItem('google-members-database');
        if (dbStr) {
          try {
            const db = JSON.parse(dbStr);
            const updated = db.filter((m: any) => m.email !== email);
            localStorage.setItem('google-members-database', JSON.stringify(updated));
            setMembersList(updated);
            localStorage.removeItem(`google-points-${email}`);
            window.dispatchEvent(new Event('local-points-updated'));
          } catch (e) {
            console.error(e);
          }
        }
      },
    });
  };

  // Change PIN Security Rule
  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    setPinChangeSuccess(null);
    if (newPinInput !== confirmPinInput) {
      setPinChangeError('兩次輸入的新金鑰不一致！');
      return;
    }
    if (!/^\d{6}$/.test(newPinInput)) {
      setPinChangeError('新金鑰必須為 6 位半形數字！');
      return;
    }
    setPinChangeLoading(true);
    try {
      const res = await apiFetch('/api/printer/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: currentPinInput, newPin: newPinInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setPinChangeSuccess('🎉 員工解鎖金鑰變更成功！');
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
      } else {
        setPinChangeError(data.error || '金鑰更新失敗');
      }
    } catch (err) {
      setPinChangeError('與伺服器連線或程序異常！');
    } finally {
      setPinChangeLoading(false);
    }
  };

  // Restock trigger
  const handleRestockClick = async (id: string) => {
    const qty = restockAmount[id] || 20;
    await onRestock(id, qty);
    setRestockAmount({ ...restockAmount, [id]: 0 });
    alert('🎉 材料進貨完成！原料總水位已更新。');
  };

  const handleManualAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAdjustId || !manualAdjustQty) {
      alert('❌ 請選擇原料並輸入異動數量！');
      return;
    }
    const qty = Number(manualAdjustQty);
    if (isNaN(qty) || qty === 0) {
      alert('❌ 數量必須為非零有效實數！');
      return;
    }
    try {
      const res = await apiFetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: manualAdjustId,
          quantityChanged: qty,
          note: manualAdjustNote.trim() || '大後台管理員手動盤存調整',
        }),
      });
      if (res.ok) {
        alert('🎉 耗損調整登記登入成功！進銷存日記帳已重算。');
        setManualAdjustQty('');
        setManualAdjustNote('');
        await fetchInventoryLogs();
        await onRestock(manualAdjustId, 0); // Sync parent
      } else {
        const d = await res.json();
        alert(`❌ 手動調整失敗：${d.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNewIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngId || !newIngNameZh) {
      alert('❌ 請填寫原料識別碼與中文名稱！');
      return;
    }
    const idPattern = /^[a-zA-Z0-9_.-]+$/;
    if (!idPattern.test(newIngId)) {
      alert('❌ 原料識別碼只能包含英文字母、數字、底線、連字號或句點！');
      return;
    }
    if (ingredients.some((ig) => ig.id.toLowerCase() === newIngId.trim().toLowerCase())) {
      alert('❌ 此原料識別碼已存在，請使用其它的庫存識別代號！');
      return;
    }

    try {
      if (onAddIngredient) {
        const res = await onAddIngredient(
          newIngId.trim(),
          { zh: newIngNameZh.trim(), en: newIngNameEn.trim() || undefined },
          Number(newIngStock) || 0,
          Number(newIngMinThreshold) || 0,
          newIngUnit.trim() || 'kg',
        );
        if (res.success) {
          alert('🎉 成功新增原料項目！');
          setNewIngId('');
          setNewIngNameZh('');
          setNewIngNameEn('');
          setNewIngStock('');
          setNewIngMinThreshold('');
          setNewIngUnit('kg');
        } else {
          alert(`❌ 新增原料失敗: ${res.error}`);
        }
      } else {
        alert('❌ 系統尚未配置新增原料的功能介面！');
      }
    } catch (err: any) {
      alert(`❌ 發生異常錯誤: ${err.message || err}`);
    }
  };

  // Helper utility to write out an Excel-friendly CSV with UTF-8 BOM
  const exportToCSV = (data: any[], headersMap: { [key: string]: string }, filename: string) => {
    if (!data || data.length === 0) {
      alert('❌ 無明細數據可供匯出！');
      return;
    }
    const rawKeys = Object.keys(data[0]);
    const headersLine = rawKeys.map((k) => headersMap[k] || k).join(',');
    const rows = data.map((item) => {
      return rawKeys
        .map((k) => {
          const val = item[k];
          let str =
            typeof val === 'object'
              ? JSON.stringify(val)
              : String(val === undefined || val === null ? '' : val);
          str = str.replace(/"/g, '""');
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str}"`;
          }
          return str;
        })
        .join(',');
    });
    const csvContent = '\uFEFF' + [headersLine, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Order Filtering Engine
  const filteredOrders = useMemo(() => {
    let list = [...orders];
    const todayStr = new Date().toISOString().split('T')[0];

    if (dateRangeFilter === 'today') {
      list = list.filter((o) => o.createdAt.startsWith(todayStr));
    } else if (dateRangeFilter === 'week') {
      const sevenDays = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      list = list.filter((o) => new Date(o.createdAt) >= sevenDays);
    } else if (dateRangeFilter === 'month') {
      const thirtyDays = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      list = list.filter((o) => new Date(o.createdAt) >= thirtyDays);
    } else if (dateRangeFilter === 'custom') {
      if (orderQueryStartDate) {
        const start = new Date(orderQueryStartDate + 'T00:00:00');
        list = list.filter((o) => new Date(o.createdAt) >= start);
      }
      if (orderQueryEndDate) {
        const end = new Date(orderQueryEndDate + 'T23:59:59');
        list = list.filter((o) => new Date(o.createdAt) <= end);
      }
    }

    if (orderQueryStatus !== 'all') {
      list = list.filter((o) => o.status === orderQueryStatus);
    }

    if (orderQueryKeyword.trim()) {
      const k = orderQueryKeyword.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(k) ||
          o.customerName.toLowerCase().includes(k) ||
          (o.tableNumber && o.tableNumber.includes(k)),
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    orders,
    dateRangeFilter,
    orderQueryStartDate,
    orderQueryEndDate,
    orderQueryStatus,
    orderQueryKeyword,
  ]);

  // Aggregate stats in the filtered interval:
  const filteredStats = useMemo(() => {
    const activeOrders = filteredOrders.filter((o) => o && o.status !== 'cancelled');
    const totalRev = activeOrders.reduce((sum, o) => sum + (o?.total || 0), 0);
    const count = filteredOrders.length;
    const aov = count > 0 ? Math.round(totalRev / count) : 0;

    const memberSales = activeOrders
      .filter((o) => o?.isMember)
      .reduce((sum, o) => sum + (o?.total || 0), 0);
    const memberShare = totalRev > 0 ? (memberSales / totalRev) * 100 : 0;

    return { revenue: totalRev, count, aov, memberShare };
  }, [filteredOrders]);

  // Export Orders CSV Report
  const handleExportOrdersReport = () => {
    const flatData = filteredOrders.map((o) => ({
      id: o.id || '',
      createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A',
      tableNumber: o.tableNumber || 'N/A',
      customerName: o.customerName || 'N/A',
      paymentMethod:
        o.paymentMethod === 'twqr'
          ? 'TWQR支付'
          : o.paymentMethod === 'credit'
            ? '信用卡'
            : o.paymentMethod === 'member'
              ? '會員儲值'
              : '現金',
      subtotal: o.subtotal || 0,
      serviceCharge: o.serviceCharge || 0,
      total: o.total || 0,
      status:
        o.status === 'completed'
          ? '已出餐完成'
          : o.status === 'pending'
            ? '未處置待理'
            : o.status === 'preparing'
              ? '配餐準備中'
              : '已取消復歸',
      isMember: o.isMember ? 'Google會員' : '非會員一般餐客',
    }));
    const map = {
      id: '訂單單號',
      createdAt: '銷售日期時間',
      tableNumber: '桌位號碼',
      customerName: '客戶名稱',
      paymentMethod: '付清途徑',
      subtotal: '餐點小計金額',
      serviceCharge: '服務費',
      total: '結賬實付總金額',
      status: '點單狀態',
      isMember: '是否已綁載Google會員',
    };
    exportToCSV(
      flatData,
      map,
      `沙貝燒烤-銷售財務報表-${new Date().toISOString().split('T')[0]}.csv`,
    );
  };

  // Export Inventory CSV Report
  const handleExportInventoryReport = () => {
    const flatData = dbInventoryLogs.map((l) => ({
      timestamp: new Date(l.timestamp).toLocaleString(),
      ingredientName: l.ingredientName,
      type:
        l.type === 'incoming'
          ? '大批入採進貨'
          : l.type === 'outgoing'
            ? '顧客消費抵消'
            : '手控盤核壞報',
      quantityChanged: `${l.quantityChanged > 0 ? '+' : ''}${l.quantityChanged}`,
      remainingStock: l.remainingStock,
      note: l.note,
    }));
    const map = {
      timestamp: '交易過帳時間',
      ingredientName: '原料名稱',
      type: '交易屬性型態',
      quantityChanged: '異動數量增減',
      remainingStock: '期末殘存現有庫量',
      note: '盤損事件錄記備註',
    };
    exportToCSV(
      flatData,
      map,
      `沙貝燒烤-進銷存流帳報表-${new Date().toISOString().split('T')[0]}.csv`,
    );
  };

  // Recharts calculations
  const chartCategoryData = useMemo(() => {
    return analytics.categorySales.map((item) => {
      const foundCat = categories.find((c) => c.id === item.category);
      return {
        name: foundCat ? getLocalizedText(foundCat.name, currentLang) : item.category,
        '營業額 NT$': item.revenue,
      };
    });
  }, [analytics.categorySales, categories, currentLang]);

  const chartHourlyData = useMemo(() => {
    return analytics.hourlyDistribution.map((item) => ({
      用餐時段: item.timeSlot,
      下單數量: item.orders,
    }));
  }, [analytics.hourlyDistribution]);

  // Categories forms triggers
  const triggerAddCatMode = () => {
    setEditingCategory(null);
    setCatId('');
    setCatNameZh('');
    setCatNameEn('');
    setCatNameTh('');
    setCatNameJa('');
    setCatNameKo('');
    setCatNameVi('');
    setCatError(null);
    setCatShowOnCustomer(true);
    setIsCatFormOpen(true);
  };

  const triggerEditCatMode = (cat: Category) => {
    setEditingCategory(cat);
    setCatId(cat.id);
    setCatNameZh(getLocalizedText(cat.name, 'zh') || '');
    setCatNameEn(cat.name?.en || '');
    setCatNameTh(cat.name?.th || '');
    setCatNameJa(cat.name?.ja || '');
    setCatNameKo(cat.name?.ko || '');
    setCatNameVi(cat.name?.vi || '');
    setCatError(null);
    setCatShowOnCustomer(cat.showOnCustomerPage !== false);
    setIsCatFormOpen(true);
  };

  const handleSaveCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    let cleanId = catId
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '');
    if (!cleanId && !editingCategory) {
      cleanId = 'cat-' + Math.random().toString(36).substring(2, 8);
    }
    if (!cleanId || !catNameZh) {
      setCatError('中文正體標題為必選填寫欄位！');
      return;
    }
    const payloadName = {
      zh: catNameZh,
      en: catNameEn || catNameZh,
      th: catNameTh || catNameZh,
      ja: catNameJa || catNameZh,
      ko: catNameKo || catNameZh,
      vi: catNameVi || catNameZh,
    };
    if (editingCategory) {
      if (onEditCategory) {
        const r = await onEditCategory(editingCategory.id, payloadName, catShowOnCustomer);
        if (r.success) setIsCatFormOpen(false);
        else setCatError(r.error || '保存出錯');
      }
    } else {
      if (onAddCategory) {
        const r = await onAddCategory(cleanId, payloadName, catShowOnCustomer);
        if (r.success) setIsCatFormOpen(false);
        else setCatError(r.error || '新增出錯');
      }
    }
  };

  // Table form triggers
  const triggerEditTableMode = (tb: TableConfig) => {
    setEditingTableObj(tb);
    setTableIdInput(tb.id);
    setTableQrUrlInput(tb.qrCodeUrl);
    setTableMaxCapacityInput(tb.maxCapacity ? tb.maxCapacity.toString() : '');
    setTableError(null);
    setTableSuccess(null);
    setIsTableFormOpen(true);
  };

  const handleTableSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTableError(null);
    setTableSuccess(null);
    const cleanId = tableIdInput.trim();
    if (!cleanId) {
      setTableError('請填載桌位號碼！');
      return;
    }
    const maxCapacity = tableMaxCapacityInput.trim() ? parseInt(tableMaxCapacityInput) : undefined;
    if (editingTableObj) {
      const r = await onEditTable(editingTableObj.id, tableQrUrlInput, maxCapacity);
      if (r.success) {
        setTableSuccess('桌次資訊儲存更新成功！');
        setTimeout(() => setIsTableFormOpen(false), 1200);
      } else {
        setTableError(r.error || '儲存更新失敗');
      }
    } else {
      const r = await onAddTable(cleanId, tableQrUrlInput, maxCapacity);
      if (r.success) {
        setTableSuccess('成功新增全店桌席與 QR 點餐定位元件！');
        setTableIdInput('');
        setTableQrUrlInput('');
        setTableMaxCapacityInput('');
        setTimeout(() => setIsTableFormOpen(false), 1500);
      } else {
        setTableError(r.error || '此桌號已存在');
      }
    }
  };

  // Reservation form triggers & helpers
  const triggerAddReservationMode = () => {
    setEditingResObj(null);
    setResNameInput('');
    setResPhoneInput('');
    setResPhoneError(false);
    setResGuestsInput(2);
    setResTableInputs([]);
    const d = new Date();
    d.setDate(d.getDate() + 1); // Default to tomorrow
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const tomorrowStr = `${yr}-${mo}-${dy}`;

    setResDateInput(tomorrowStr);

    if (restDays && restDays.includes(tomorrowStr)) {
      setTimeout(
        () => window.alert('⚠️ 預設預定日期 (明日) 為公休日無法訂位，請重新選擇日期！'),
        100,
      );
    }

    const hr = String(new Date().getHours() + 1).padStart(2, '0');
    setResTimeInput(`${hr}:00`);
    setResNotesInput('');
    const autoNo = generateReservationNo(tomorrowStr, reservations);
    setResNoInput(autoNo);
    setGeneratedResLink('');
    setCopiedLinkNotice(false);
    setResError(null);
    setResSuccess(null);
    setIsResFormOpen(true);
  };

  const triggerEditReservationMode = (res: Reservation) => {
    setEditingResObj(res);
    setResNameInput(res.customerName);
    setResPhoneInput(res.phone || '');
    setResPhoneError(false);
    setResGuestsInput(res.guestCount || 2);
    setResTableInputs(
      res.tableNumber
        ? res.tableNumber
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    );
    setResDateInput(res.date);
    setResTimeInput(res.time);
    setResNotesInput(res.notes || '');
    setResNoInput(res.reservationNo || generateReservationNo(res.date, reservations));
    setGeneratedResLink('');
    setCopiedLinkNotice(false);
    setResError(null);
    setResSuccess(null);
    setIsResFormOpen(true);
  };

  // Auto-assign tables based on guest count and availability
  useEffect(() => {
    if (!isResFormOpen || !resDateInput || !resTimeInput || tables.length === 0 || editingResObj)
      return;

    const parseMins = (t: string) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const targetMins = parseMins(resTimeInput);

    // Find overlapping reservations
    const overlapping = reservations.filter((r) => {
      if (r.status === 'cancelled') return false;
      if (r.date !== resDateInput.trim()) return false;
      const rMins = parseMins(r.time);
      return Math.abs(rMins - targetMins) < 180;
    });

    const unavailableTableIds = new Set<string>();
    overlapping.forEach((r) => {
      const rTables = String(r.tableNumber || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      rTables.forEach((tId) => unavailableTableIds.add(tId));
    });

    const availableTables = tables.filter((t) => !unavailableTableIds.has(t.id));
    availableTables.sort((a, b) => (b.maxCapacity || 4) - (a.maxCapacity || 4));

    let currentCapacity = 0;
    const selectedIds: string[] = [];

    for (const t of availableTables) {
      if (currentCapacity >= resGuestsInput) break;
      selectedIds.push(t.id);
      currentCapacity += t.maxCapacity || 4;
    }

    setResTableInputs(selectedIds);
  }, [
    resGuestsInput,
    resDateInput,
    resTimeInput,
    tables,
    reservations,
    isResFormOpen,
    editingResObj,
  ]);

  const handleReservationSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResError(null);
    setResSuccess(null);
    if (!resNameInput.trim()) {
      setResError('請填寫預約顧客姓名！');
      return;
    }
    const rawPhone = resPhoneInput.trim();
    if (!rawPhone) {
      setResError('請填寫連絡電話！');
      setResPhoneError(true);
      return;
    }
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const isMobile = /^09\d{8}$/.test(cleanDigits);
    const isLandline = /^0[2-8]\d{7,8}$/.test(cleanDigits);
    if (!isMobile && !isLandline) {
      setResPhoneError(true);
      const errMsg =
        '聯絡電話格式不正確！手機號碼需為10位數（以09開頭），市話需為9至10位數（以02~08開頭），例如：0912-345-678 或 02-2345-6789，請確認並重新輸入。';
      setResError(errMsg);
      window.alert(`⚠️ 格式錯誤 / Invalid Format\n\n${errMsg}`);
      return;
    }
    setResPhoneError(false);

    if (!isResDateValid) {
      setResError(`⚠️ 預約日期最多只能提前 3 個月 (最晚至 ${maxThreeMonthsDateStr})！`);
      return;
    }

    if (!isResTimeValid) {
      setResError('⚠️ 預訂時間不在營業時間內，請重新選擇！');
      return;
    }

    if (resTableInputs.length === 0) {
      setResError('請指定預約桌號或確認該時段是否有足夠空桌！');
      return;
    }

    const currentResNo = resNoInput || generateReservationNo(resDateInput, reservations);
    const payload = {
      customerName: resNameInput.trim(),
      phone: rawPhone,
      guestCount: Number(resGuestsInput) || 1,
      tableNumber: resTableInputs.join(', '),
      date: resDateInput,
      time: resTimeInput,
      notes: resNotesInput.trim(),
      reservationNo: currentResNo,
      status: editingResObj ? editingResObj.status : ('pending' as any),
    };
    if (editingResObj) {
      if (onEditReservation) {
        const r = await onEditReservation(editingResObj.id, payload);
        if (r.success) {
          setResSuccess('預約資訊儲存更新成功！');
          setTimeout(() => setIsResFormOpen(false), 1200);
        } else {
          setResError(r.error || '儲存更新失敗');
        }
      }
    } else {
      if (onAddReservation) {
        const r = await onAddReservation(payload);
        if (r.success) {
          setResSuccess('成功新增預約定位！');
          setTimeout(() => setIsResFormOpen(false), 1200);
        } else {
          setResError(r.error || '新增預約失敗');
        }
      }
    }
  };

  // Menu Items form triggers
  const triggerAddMenuItemMode = () => {
    setEditingItem(null);
    setItemNameZh('');
    setItemNameEn('');
    setItemCategory(categories[0]?.id || 'skewers');
    setItemPrice(100);
    setItemImage(
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400',
    );
    setItemDescZh('');
    setItemDescEn('');
    setHasNoodles(false);
    setIsNotSpicy(false);
    setIsTakeoutAvailable(true);
    setCustomAddOns([]);
    setItemRecipe([]);
    setNewRecipeIngId('');
    setNewRecipeAmount('1');
    setIsFormOpen(true);
  };

  const triggerEditMenuItemMode = (item: any) => {
    if (!item) return;
    setEditingItem(item);
    setItemNameZh(item.name ? getLocalizedText(item.name, 'zh') : '');
    setItemNameEn(typeof item.name === 'object' && item.name !== null ? item.name.en || '' : '');
    setItemCategory(
      typeof item.category === 'string' && item.category
        ? item.category
        : categories?.[0]?.id || 'skewers',
    );
    const priceNum =
      typeof item.price === 'number'
        ? item.price
        : typeof item.price === 'string'
          ? parseFloat(item.price) || 0
          : 100;
    setItemPrice(priceNum);
    setItemImage(typeof item.image === 'string' ? item.image : '');
    setItemDescZh(item.description ? getLocalizedText(item.description, 'zh') : '');
    setItemDescEn(
      typeof item.description === 'object' && item.description !== null
        ? item.description.en || ''
        : '',
    );
    setHasNoodles(!!item.hasNoodlesOption);
    setIsNotSpicy(!!item.isNotSpicy);
    setIsTakeoutAvailable(item.isTakeoutAvailable !== false);
    setCustomAddOns(Array.isArray(item.customAddOns) ? item.customAddOns.filter(Boolean) : []);
    setItemRecipe(Array.isArray(item.recipe) ? item.recipe.filter(Boolean) : []);
    setNewRecipeIngId('');
    setNewRecipeAmount('1');
    setIsFormOpen(true);
  };

  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameZh || isNaN(Number(itemPrice))) {
      alert('請填載正確餐點名稱及有效金額！');
      return;
    }
    const cleanImage = typeof itemImage === 'string' ? itemImage.trim() : itemImage || '';
    const payload = {
      name: {
        ...(typeof editingItem?.name === 'object' ? editingItem.name : {}),
        zh: itemNameZh,
        ...(itemNameEn ? { en: itemNameEn } : {}),
      },
      price: Number(itemPrice),
      image: cleanImage,
      description: {
        ...(typeof editingItem?.description === 'object' ? editingItem.description : {}),
        zh: itemDescZh,
        ...(itemDescEn ? { en: itemDescEn } : {}),
      },
      category: itemCategory,
      available: editingItem
        ? editingItem.available !== undefined
          ? editingItem.available
          : true
        : true,
      hasNoodlesOption: hasNoodles,
      isNotSpicy: isNotSpicy,
      isTakeoutAvailable: isTakeoutAvailable,
      customAddOns: customAddOns,
      recipe: itemRecipe,
    };
    if (editingItem) {
      if (onEditMenuItem) {
        await onEditMenuItem(editingItem.id, payload);
      }
    } else {
      if (onAddMenuItem) {
        await onAddMenuItem(payload);
      }
    }
    setIsFormOpen(false);
    setEditingItem(null);
    alert('🎉 餐點設定資訊儲存成功！');
  };

  // Ingredient Recipe Maps definition for local recipe cards auditing
  const recipeCompositionMap: { [key: string]: { name: string; qty: string }[] } = {
    'ty-01': [
      { name: '大鮮蝦', qty: '3 只 / pcs' },
      { name: '頂級椰奶罐', qty: '0.1 罐 / can' },
    ],
    'ty-02': [
      { name: '大鮮蝦', qty: '2 只 / pcs' },
      { name: '頂級牛肉串面料', qty: '1 串 / skewer' },
      { name: '頂級椰奶罐', qty: '0.1 罐' },
    ],
    'nd-01': [
      { name: '大鮮蝦', qty: '4 只' },
      { name: '冬蔭功泡麵 / 米線', qty: '1 包 / pack' },
    ],
    'nd-02': [
      { name: '大鮮蝦', qty: '2 只' },
      { name: '冬蔭功泡麵 / 米線', qty: '1 包' },
    ],
    'cb-01': [
      { name: '頂級牛肉串', qty: '1 串' },
      { name: '爆香豬五花 / 金針', qty: '1 份' },
      { name: '泰手標紅茶原料', qty: '0.35 升' },
    ],
  };

  return (
    <div className="space-y-6 text-white" id="manager-dashboard-container">
      {/* 1. Dynamic Tab Switcher */}
      {activeSubTab !== 'eod' && activeSubTab !== 'cashier' && activeSubTab !== 'terminal' && (
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4" id="admin-subtabs-nav">
          {[
            {
              id: 'stats',
              label: '📊 營運數據分析',
              desc: '全店每日銷售分析、客流量時段與菜品排行',
            },
            {
              id: 'orders',
              label: '💳 帳務核數與細單',
              desc: '日/周/月、自訂區間銷售合算，明細登錄核對',
            },
            {
              id: 'inventory',
              label: '📦 進銷存與耗損',
              desc: '原料庫存流動日誌、安全警量、盤損核對調整',
            },
            {
              id: 'menu',
              label: '🍜 菜品與類別編輯',
              desc: '菜單單品與可售狀態、客製選項、全店類別更新',
            },
            {
              id: 'members',
              label: '⚙️ 會員、桌席與系統',
              desc: 'Google 會員統計、桌席二維碼、員工PIN變更',
            },
            {
              id: 'printer',
              label: '🖨️ 印表機與硬體',
              desc: '分離雙機：廚房印表機、帳單印表機寬度與連線',
            },
            {
              id: 'options',
              label: '🧩 客製選項管理器',
              desc: '設定全店客製選項規則 (例如：加河粉、熟度、辣度)',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => {
                setActiveSubTab(tab.id as any);
                if (onSubTabChange) {
                  onSubTabChange(tab.id as any);
                }
              }}
              className={`flex flex-col items-start px-5 py-3 rounded-lg border text-left transition-all outline-none ${
                activeSubTab === tab.id
                  ? 'bg-[#E5B453] border-[#E5B453] text-black shadow-md font-black scale-[1.01]'
                  : 'bg-[#121212] border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="font-bold text-sm tracking-wide">{tab.label}</span>
              <span className="text-[10px] opacity-80 mt-1 font-normal line-clamp-1">
                {tab.desc}
              </span>
            </button>
          ))}
        </div>
      )}
      {/* ==================== TAB 1: OPERATIONAL ANALYTICS ==================== */}
      {activeSubTab === 'stats' && (
        <div className="space-y-6 animate-fadeIn" id="subtab-section-stats">
          {/* Offline Accounting & Export Header Banner */}
          <div
            className="bg-[#121212] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl"
            id="stats-accounting-banner"
          >
            <div className="space-y-1 text-left">
              <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                <FileText size={18} className="text-[#E5B453]" />
                營運數據分析與離線對帳管理 (Business Analytics & Offline Accounting)
              </h3>
              <p className="text-xs text-white/40">
                將過去 30 天內已完成 (Status: Completed) 的所有顧客交易訂單明細匯出為完整的 CSV
                檔格式，方便執行會計記帳或損益試算。
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportLast30DaysOrdersCSV}
              className="bg-[#E5B453] hover:bg-amber-400 active:scale-95 text-[#0F0F0F] font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2 shrink-0 border border-[#E5B453]/25 shadow-lg shadow-amber-500/5"
            >
              <Download size={14} className="stroke-[3]" />
              <span>匯出 30 天已完成交易 CSV</span>
            </button>
          </div>

          {/* Toast / Status messages inside Stats Tab */}
          {(csvExportSuccess || csvExportError) && (
            <div className="animate-slideIn" id="csv-export-alerts">
              {csvExportSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
                  <Check size={14} className="stroke-[3]" />
                  <span>{csvExportSuccess}</span>
                </div>
              )}
              {csvExportError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} className="stroke-[3]" />
                  <span>{csvExportError}</span>
                </div>
              )}
            </div>
          )}

          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="stats-kpi-grid">
            <div className="bg-[#161616] rounded-xl p-5 border border-white/10 shadow-sm flex items-center space-x-4">
              <div className="bg-amber-500/10 text-[#E5B453] p-3 rounded-lg">
                <Coins size={22} className="text-[#E5B453]" />
              </div>
              <div className="text-left font-sans">
                <span className="text-xs text-white/45 font-black uppercase tracking-wider block">
                  累計點餐營業額
                </span>
                <p className="text-xl font-black text-white font-mono mt-0.5">
                  NT$ {(analytics.totalRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="bg-[#161616] rounded-xl p-5 border border-white/10 shadow-sm flex items-center space-x-4">
              <div className="bg-blue-500/10 text-blue-400 p-3 rounded-lg">
                <TrendingUp size={22} className="text-blue-400" />
              </div>
              <div className="text-left font-sans">
                <span className="text-xs text-white/45 font-black uppercase tracking-wider block">
                  完成出單交易量
                </span>
                <p className="text-xl font-black text-white font-mono mt-0.5">
                  {analytics.ordersCount} 筆交易
                </p>
              </div>
            </div>
            <div className="bg-[#161616] rounded-xl p-5 border border-white/10 shadow-sm flex items-center space-x-4">
              <div className="bg-rose-500/10 text-rose-400 p-3 rounded-lg">
                <AlertTriangle size={22} className="text-rose-400" />
              </div>
              <div className="text-left font-sans">
                <span className="text-xs text-white/45 font-black uppercase tracking-wider block">
                  食材庫存水位警報
                </span>
                <p className="text-xl font-black text-white font-mono mt-0.5">
                  {analytics.stockWarnings.length > 0 ? (
                    <span className="text-rose-400 animate-pulse">
                      {analytics.stockWarnings.length} 個料件告警
                    </span>
                  ) : (
                    <span className="text-emerald-400 text-sm font-semibold">健康安全 ok</span>
                  )}
                </p>
              </div>
            </div>
            <div className="bg-[#161616] rounded-xl p-5 border border-white/10 shadow-sm flex items-center space-x-4">
              <div className="bg-[#E5B453]/10 text-[#E5B453] p-3 rounded-lg">
                <ShoppingBag size={22} className="text-[#E5B453]" />
              </div>
              <div className="text-left font-sans">
                <span className="text-xs text-white/45 font-black uppercase tracking-wider block">
                  外帶編號取餐序列
                </span>
                <p className="text-sm font-bold text-white mt-0.5">
                  目前外帶累計:{' '}
                  <span className="font-mono text-base font-extrabold text-[#E5B453]">
                    #{takeoutStatus.sequence}
                  </span>{' '}
                  號
                </p>
              </div>
            </div>
          </div>

          {/* Business Charts with Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="manager-charts-workspace">
            {/* Category breakdown sales BarChart */}
            <div className="bg-[#161616] border border-white/10 rounded-xl p-5 shadow-sm space-y-2 text-left">
              <h4 className="font-bold text-sm text-white font-serif tracking-wide">
                📊 各類別銷售營業額分析 Sales Breakdown by Categories
              </h4>
              <p className="text-white/40 text-xs text-sans">用以分析哪些料理為沙貝之金雞母類別</p>
              <div className="h-64 pt-3" id="revenue-barchart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartCategoryData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      tickFormatter={(formattedValue) => `NT$ ${formattedValue}`}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161616',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: '#fff',
                      }}
                      formatter={(value) => [`NT$ ${value}`, '營業額']}
                    />
                    <Bar dataKey="營業額 NT$" fill="#E5B453" radius={[5, 5, 0, 0]} barSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 今日各類別商品銷售佔比 Pie Chart */}
            <div
              className="bg-[#161616] border border-white/10 rounded-xl p-5 shadow-sm space-y-2 text-left"
              id="category-sales-piechart-card"
            >
              <h4 className="font-bold text-sm text-white font-serif tracking-wide">
                🍰 今日各類別銷售佔比 Category Sales Share (Pie Chart)
              </h4>
              <p className="text-white/40 text-xs text-sans">
                視覺化分析今日不同餐點類別之營業額佔比份額
              </p>
              <div
                className="h-64 pt-3 flex flex-col md:flex-row items-center justify-center gap-2"
                id="piechart-container"
              >
                <div className="w-1/2 h-full min-h-[160px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="營業額 NT$"
                        nameKey="name"
                      >
                        {chartCategoryData.map((_entry, index) => {
                          const colors = [
                            '#E5B453',
                            '#FFA500',
                            '#F3CD78',
                            '#D4AF37',
                            '#FF8C00',
                            '#FFD700',
                            '#CD7F32',
                          ];
                          return (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#161616',
                          borderColor: 'rgba(255,255,255,0.15)',
                          color: '#fff',
                        }}
                        formatter={(value, name) => [`NT$ ${value}`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom list of categories on the side so the user reads values and colors clearly */}
                <div className="w-1/2 flex flex-col space-y-1.5 max-h-[220px] overflow-y-auto px-1 pr-2">
                  {chartCategoryData.map((entry, index) => {
                    const colors = [
                      '#E5B453',
                      '#FFA500',
                      '#F3CD78',
                      '#D4AF37',
                      '#FF8C00',
                      '#FFD700',
                      '#CD7F32',
                    ];
                    const totalRevenue = chartCategoryData.reduce(
                      (sum, item) => sum + (item['營業額 NT$'] || 0),
                      0,
                    );
                    const percentage =
                      totalRevenue > 0
                        ? ((entry['營業額 NT$'] / totalRevenue) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <div
                        key={index}
                        className="flex flex-col text-[10px] text-zinc-300 font-sans border-b border-white/5 pb-1"
                      >
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: colors[index % colors.length] }}
                          />
                          <span className="truncate font-semibold text-white/90">{entry.name}</span>
                        </div>
                        <div className="pl-3.5 flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-0.5">
                          <span>{percentage}%</span>
                          <span className="text-zinc-500 text-[9px]">
                            NT$ {entry['營業額 NT$']}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Hourly busy dining line graph */}
            <div className="bg-[#161616] border border-white/10 rounded-xl p-5 shadow-sm space-y-2 text-left">
              <h4 className="font-bold text-sm text-white font-serif tracking-wide">
                📈 宵夜尖峰點餐時段趨勢 Hourly Dining Orders Trends
              </h4>
              <p className="text-white/40 text-xs text-sans">
                營業時間 17:30 - 00:30。有助於適當調度內外場人力。
              </p>
              <div className="h-64 pt-3" id="busy-hours-linechart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartHourlyData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="用餐時段"
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161616',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: '#fff',
                      }}
                    />
                    <Legend iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="下單數量"
                      stroke="#00C300"
                      strokeWidth={3}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 📊 D3-powered hourly revenue and peak order times analytics chart */}
          <PrintLogsD3Chart printLogs={printLogs} onRefresh={fetchPrintLogs} />

          {/* Top selling food rankings */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 text-left">
            <div className="flex items-center space-x-2 border-b border-white/5 pb-3 mb-4">
              <Sparkles size={16} className="text-[#E5B453]" />
              <h4 className="font-bold text-sm">🔥 本店熱門人氣銷售排行 (銷量排行 Top Dishes)</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3.5">
              {analytics.topDishes.map((dish, i) => (
                <div
                  key={dish.name}
                  className="bg-black/30 border border-white/5 p-3 rounded-lg text-center relative overflow-hidden"
                >
                  <span className="absolute top-0 left-0 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-br">
                    NO.{i + 1}
                  </span>
                  <p className="font-bold text-xs text-white truncate mt-2">{dish.name}</p>
                  <p className="font-mono text-xs text-blue-400 font-extrabold mt-1">
                    {dish.qty} 份
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 今日熱銷設定 Today's Bestsellers Configuration */}
          <div
            className="bg-[#161616] border border-white/10 rounded-xl p-5 text-left space-y-4"
            id="stats-popular-settings-card"
          >
            <div className="flex items-center space-x-2 border-b border-white/5 pb-3">
              <Flame size={18} className="text-[#E5B453] fill-amber-500 animate-pulse" />
              <div>
                <h4 className="font-bold text-sm text-white">
                  🔥 今日熱銷設定 Today's Bestsellers Configuration
                </h4>
                <p className="text-[11px] text-white/40 font-sans">
                  手動編輯與自訂消費者點餐首頁頂端顯示的「今日今日熱銷」人氣商品清單，引導導購成效。
                </p>
              </div>
            </div>

            {popularSaveStatus.type && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between border animate-fadeIn transition-all duration-300 ${
                  popularSaveStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-455 text-rose-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {popularSaveStatus.type === 'success' ? '✨' : '⚠️'}
                  {popularSaveStatus.message}
                </span>
                <button
                  type="button"
                  onClick={() => setPopularSaveStatus({ type: null, message: '' })}
                  className="text-white/50 hover:text-white px-2 py-0.5 hover:bg-white/5 rounded cursor-pointer transition font-mono border-0 bg-transparent text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
              {/* Left Column: Active Bestsellers */}
              <div className="bg-black/25 border border-white/5 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-400">
                    當前今日熱銷品項 ({localPopularIds.length})
                  </span>
                  {showClearAllPopularConfirm ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">
                      <span className="text-rose-455 font-bold text-[9px] text-rose-400 shrink-0">
                        確定清空？
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLocalPopularIds([]);
                          setShowClearAllPopularConfirm(false);
                        }}
                        className="px-1.5 py-0.5 text-[9px] bg-rose-600 hover:bg-rose-500 text-white font-bold rounded cursor-pointer transition active:scale-90"
                      >
                        確定
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearAllPopularConfirm(false)}
                        className="px-1.5 py-0.5 text-[9px] bg-zinc-700 hover:bg-zinc-650 text-zinc-300 rounded cursor-pointer transition active:scale-90"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearAllPopularConfirm(true)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-mono transition cursor-pointer bg-transparent border-0"
                    >
                      🗑️ 全部清空
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {localPopularIds.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-xs">
                      目前未選擇任何品項，點餐頁將預設顯示前 4 項上架商品。
                    </div>
                  ) : (
                    localPopularIds.map((itemId) => {
                      const item = menuItems.find((m) => m.id === itemId);
                      if (!item) return null;
                      return (
                        <div
                          key={itemId}
                          className="flex items-center justify-between bg-[#1f1f1f] p-2 border border-white/5 rounded-lg text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <img
                              src={
                                item.image ||
                                'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=150'
                              }
                              alt={getLocalizedText(item.name, currentLang)}
                              className="w-8 h-8 object-cover rounded bg-black flex-shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="truncate">
                              <p className="font-bold text-white truncate">
                                {getLocalizedText(item.name, currentLang)}
                              </p>
                              <p className="text-[9px] text-zinc-400 font-mono">
                                ID: {item.id} • NT$ {item.price}
                              </p>
                            </div>
                          </div>

                          {popularItemToRemoveId === itemId ? (
                            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-1 rounded-lg">
                              <span className="text-rose-455 font-bold text-[9px] text-rose-400 shrink-0">
                                移除？
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalPopularIds((prev) => prev.filter((id) => id !== itemId));
                                  setPopularItemToRemoveId(null);
                                }}
                                className="px-1.5 py-0.5 text-[9px] bg-rose-600 hover:bg-rose-500 text-white font-bold rounded cursor-pointer transition active:scale-90"
                              >
                                確定
                              </button>
                              <button
                                type="button"
                                onClick={() => setPopularItemToRemoveId(null)}
                                className="px-1.5 py-0.5 text-[9px] bg-zinc-700 hover:bg-zinc-650 text-zinc-300 rounded cursor-pointer transition active:scale-90"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPopularItemToRemoveId(itemId)}
                              className="p-1 px-2 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/35 rounded transition cursor-pointer font-bold active:scale-95"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Add New Bestseller */}
              <div className="bg-black/25 border border-white/5 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-zinc-300">
                    可選餐點清單 (點按餐點快速加入)
                  </span>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {menuItems.map((item) => {
                    const isSelected = localPopularIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isSelected) {
                            setLocalPopularIds((prev) => prev.filter((id) => id !== item.id));
                          } else {
                            if (localPopularIds.length >= 8) {
                              alert(
                                '💡 為了點餐頁之最佳版面與體驗，今日熱銷品項上限為 8 項，請先移除現有品項。',
                              );
                              return;
                            }
                            setLocalPopularIds((prev) =>
                              prev.includes(item.id) ? prev : [...prev, item.id],
                            );
                          }
                        }}
                        className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer text-xs transition-all select-none ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <img
                            src={
                              item.image ||
                              'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=150'
                            }
                            alt={getLocalizedText(item.name, currentLang)}
                            className="w-8 h-8 object-cover rounded bg-black flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="truncate">
                            <p className="font-bold text-white truncate">
                              {getLocalizedText(item.name, currentLang)}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-mono">
                              Category: {item.category}
                            </p>
                          </div>
                        </div>

                        <div>
                          {isSelected ? (
                            <span className="text-[10px] font-black text-[#E5B453] bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                              ✓ 已選中
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                              + 點選
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Button Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-white/5 font-sans">
              <span className="text-[11px] text-zinc-500 font-medium">
                變更將即時儲存並同步至前台顧客手機點餐首頁。
              </span>
              <button
                type="button"
                disabled={isSavingPopular}
                onClick={async () => {
                  setIsSavingPopular(true);
                  setPopularSaveStatus({ type: null, message: '' });
                  try {
                    if (onUpdatePopularItemIds) {
                      const res = await onUpdatePopularItemIds(localPopularIds);
                      if (res && res.success) {
                        setPopularSaveStatus({
                          type: 'success',
                          message: '🎉 今日熱銷設定完成，已成功同步上雲端並更新前台點餐系統！',
                        });
                        try {
                          alert('🎉 今日熱銷設定完成，已成功同步上雲端並更新前台點餐系統！');
                        } catch (e) {
                          console.warn('Alert blocked in iframe sandbox', e);
                        }
                      } else {
                        const errorMsg = res?.error || '未知錯誤';
                        setPopularSaveStatus({
                          type: 'error',
                          message: `⚠️ 儲存失敗: ${errorMsg}`,
                        });
                        try {
                          alert(`⚠️ 儲存失敗: ${errorMsg}`);
                        } catch (e) {
                          console.warn('Alert blocked in iframe sandbox', e);
                        }
                      }
                    } else {
                      setPopularSaveStatus({
                        type: 'error',
                        message: '⚠️ 系統異常：點購率 API 連結未就緒！',
                      });
                      try {
                        alert('⚠️ 系統異常：點購率 API 連結未就緒！');
                      } catch (e) {
                        console.warn('Alert blocked', e);
                      }
                    }
                  } catch (err: any) {
                    console.error('[Save Popular Error]', err);
                    const errMsg = err?.message || '連線錯誤';
                    setPopularSaveStatus({
                      type: 'error',
                      message: `❌ 連線伺服器失敗: ${errMsg}，請確認網路！`,
                    });
                    try {
                      alert('❌ 連線伺服器失敗，請確認網路！');
                    } catch (e) {
                      console.warn('Alert blocked', e);
                    }
                  } finally {
                    setIsSavingPopular(false);
                  }
                }}
                className="bg-[#E5B453] hover:bg-amber-400 disabled:bg-amber-500/40 text-[#0F0F0F] font-black text-xs px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-2 border border-[#E5B453]/20 shadow-md shadow-amber-500/5 active:scale-95 text-center min-w-[150px] justify-center h-9"
              >
                {isSavingPopular ? '正在儲存同步...' : '確認儲存今日熱銷設定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB: CASHIER REGISTRY SYSTEM ==================== */}
      {activeSubTab === 'cashier' && (
        <div className="space-y-6 animate-fadeIn" id="subtab-section-cashier">
          {/* Top Banner Alert */}
          <div className="bg-gradient-to-r from-[#E5B453]/15 via-transparent to-transparent border-l-4 border-[#E5B453] p-4 rounded-r-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-sm text-[#E5B453] flex items-center gap-1.5">
                <Coins size={18} />
                <span>櫃檯收銀結帳系統 (Cashier Registry Console)</span>
              </h4>
              <p className="text-xs text-white/60 mt-1 max-w-3xl font-sans">
                此功能為櫃檯員工專用，在此操作已出餐之桌席或外帶單進行收銀結帳。支援員工手動設定「折扣減折」與「加成服務費」，設定完畢後可點擊確認完成結帳，變更將同步更新於系統銷售帳目，並即時自動備份至
                Cloud Firestore 雲端資料庫。
              </p>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                id="cashier-trigger-drawer-btn"
                onClick={handleManualOpenDrawer}
                className="w-full md:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 text-xs tracking-wider"
              >
                <Unlock size={14} className="animate-pulse" />
                <span>⚡ 開啟現金抽屜 Open Cash Drawer</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="cashier-workspace-grid">
            {/* LEFT COLUMN: ACTIVE UNPAID ORDER QUEUE (Spans full width now for a beautiful dashboard grid list) */}
            <div className="lg:col-span-12 flex flex-col space-y-4" id="cashier-queue-panel">
              <div className="bg-[#121212] border border-white/10 rounded-2xl p-4.5 flex flex-col min-h-[500px] overflow-hidden">
                <div className="border-b border-white/5 pb-3">
                  <h5 className="font-black text-sm tracking-wide flex items-center justify-between">
                    <span>⏳ 待結帳帳單佇列 (點擊任一項目進行結帳)</span>
                    <span className="font-mono text-xs bg-amber-500/10 border border-amber-500/25 text-[#E5B453] px-2 py-0.5 rounded-full">
                      {orders.filter((o) => !o.isPaid).length} 筆未結
                    </span>
                  </h5>
                </div>

                {/* Sub-Queue Filter Tabs */}
                <div className="flex flex-wrap gap-1 mt-3 mb-3">
                  {[
                    {
                      id: 'all',
                      label: '🗂️ 全部未結',
                      count: orders.filter((o) => !o.isPaid).length,
                    },
                    {
                      id: 'completed',
                      label: '✅ 廚房出餐完成',
                      count: orders.filter((o) => !o.isPaid && o.status === 'completed').length,
                    },
                    {
                      id: 'dinein',
                      label: '🪑 客席桌出席',
                      count: orders.filter(
                        (o) => !o.isPaid && o.tableNumber && !o.tableNumber.includes('外帶'),
                      ).length,
                    },
                    {
                      id: 'takeout',
                      label: '🛍️ 外帶佇列',
                      count: orders.filter(
                        (o) => !o.isPaid && o.tableNumber && o.tableNumber.includes('外帶'),
                      ).length,
                    },
                  ].map((subT) => {
                    const subCount = subT.count;
                    const isActive = cashierListFilter === subT.id;
                    return (
                      <button
                        key={subT.id}
                        type="button"
                        onClick={() => {
                          setCashierListFilter(subT.id as any);
                        }}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-bold h-8 flex items-center gap-1 cursor-pointer transition active:scale-95 ${
                          isActive
                            ? 'bg-[#E5B453] text-zinc-950 border-[#E5B453] font-black'
                            : 'bg-[#181818] text-white/50 border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <span>{subT.label}</span>
                        {subCount > 0 && (
                          <span
                            className={`font-mono text-[9px] px-1 rounded ${isActive ? 'bg-zinc-950 text-[#E5B453]' : 'bg-white/10 text-white/70'}`}
                          >
                            {subCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Grid Scroll Queue */}
                <div className="flex-1 overflow-y-auto pr-1 font-sans mt-2">
                  {orders.filter((o) => !o.isPaid).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 space-y-2 py-32">
                      <Check className="text-emerald-500 mx-auto" size={32} />
                      <p className="text-xs font-bold text-white/80">
                        目前全店暫無已出餐或未結帳訂單！
                      </p>
                      <p className="text-[10px]">所有客人的帳目均已收銀完成。</p>
                    </div>
                  ) : filteredCashierOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 py-32">
                      <p className="text-xs font-bold">此篩選條件下無待結帳帳單</p>
                      <p className="text-[10px] mt-1">請切換其他佇列類別</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCashierOrders.map((order) => {
                        const isSelected = selectedCashierOrderId === order.id;
                        const isCompletedInKitchen = order.status === 'completed';

                        // Calculate minimum spend warning criteria & order total fallback
                        const isDineIn = !(order.tableNumber && order.tableNumber.includes('外帶'));
                        const orderGuests = order.guestCount || 1;
                        const itemsSubtotal = computeOrderItemsSubtotal(
                          order.items || [],
                          menuItems,
                        );
                        const rawComputedTotal =
                          (order.subtotal !== undefined && order.subtotal !== null
                            ? order.subtotal
                            : itemsSubtotal) +
                          (order.serviceCharge || 0) -
                          (order.discount || 0);
                        const orderDisplayTotal =
                          typeof order.total === 'number' &&
                          !isNaN(order.total) &&
                          order.total >= 0 &&
                          order.total !== null
                            ? order.total
                            : Math.max(0, rawComputedTotal);
                        const avgAmt = orderDisplayTotal / orderGuests;
                        const orderCreatedAtTime = new Date(order.createdAt).getTime();
                        const timeElapsedMs = Date.now() - orderCreatedAtTime;
                        const isSimulated = simulatedElapsedOrders.includes(order.id);

                        const orderIsHourElapsed = timeElapsedMs >= 3600000 || isSimulated;
                        const orderBelowMinSpend = avgAmt < minSpend;
                        const showDineInAlert =
                          isDineIn && orderBelowMinSpend && orderIsHourElapsed;

                        return (
                          <div
                            key={order.id}
                            id={`cashier-queue-item-${order.id}`}
                            onClick={() => setSelectedCashierOrderId(order.id)}
                            className={`border rounded-xl p-4 text-left cursor-pointer transition duration-150 relative overflow-hidden group flex flex-col justify-between ${
                              isSelected
                                ? !isOpen
                                  ? 'bg-zinc-950 border-rose-500 shadow-md shadow-rose-500/20 animate-pulse'
                                  : 'bg-zinc-950 border-[#E5B453] shadow-md shadow-[#E5B453]/10'
                                : !isOpen
                                  ? 'bg-rose-950/40 border-rose-500/60 text-rose-100 animate-pulse'
                                  : showDineInAlert
                                    ? 'bg-rose-950/20 border-rose-500/50 hover:bg-rose-950/30'
                                    : 'bg-[#181818] border-white/5 hover:border-[#E5B453]/40 hover:bg-zinc-900 shadow-sm'
                            }`}
                          >
                            {/* Corner accent if kitchen is completed / closed */}
                            {!isOpen ? (
                              <span className="absolute top-0 right-0 text-[9px] font-black bg-rose-600 text-white border-l border-b border-rose-500/30 px-2 py-0.5 rounded-bl animate-pulse">
                                ⚠️ 營業結束未結帳
                              </span>
                            ) : isCompletedInKitchen ? (
                              <span className="absolute top-0 right-0 text-[9px] font-black bg-emerald-500/10 text-emerald-400 border-l border-b border-emerald-500/20 px-2 py-0.5 rounded-bl">
                                ✨ 廚房已出餐
                              </span>
                            ) : null}

                            <div>
                              <div className="flex justify-between items-start">
                                <div className="space-y-1 font-sans">
                                  <div className="flex items-center gap-1.55">
                                    <span className="font-mono text-xs font-extrabold text-white/40 group-hover:text-white/60">
                                      #{order.id}
                                    </span>
                                    <span
                                      className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded font-mono ${
                                        order.tableNumber && order.tableNumber.includes('外帶')
                                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      }`}
                                    >
                                      {order.tableNumber && order.tableNumber.includes('外帶')
                                        ? '🛍️ 外帶'
                                        : `🪑 客出席`}
                                    </span>
                                  </div>
                                  <h6 className="font-bold text-sm text-white/95 mt-1">
                                    桌次: {order.tableNumber || 'N/A'} 桌{' '}
                                    {isDineIn && (
                                      <span className="text-zinc-400 font-normal text-xs">
                                        ({orderGuests} 人)
                                      </span>
                                    )}
                                  </h6>
                                </div>
                                <div className="text-right space-y-1">
                                  <p className="font-mono text-sm font-extrabold text-[#E5B453]">
                                    NT$ {orderDisplayTotal.toLocaleString()}
                                  </p>
                                  <p className="text-[10px] text-zinc-500">
                                    {new Date(order.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>

                              {isDineIn && (
                                <div className="mt-2 text-[10px] text-zinc-400 space-y-1 bg-black/30 p-2 rounded-lg border border-white/5">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">均消限額:</span>
                                    <span className="font-bold text-white">
                                      NT$ {Math.round(avgAmt)} /人
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-500">內用低消:</span>
                                    <span className="font-bold text-amber-500">
                                      NT$ {minSpend} /人
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[9px] text-zinc-500 pt-1 border-t border-white/5">
                                    <span>用時: {Math.floor(timeElapsedMs / 60000)} 分鐘</span>
                                    {!orderIsHourElapsed ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSimulatedElapsedOrders((prev) => [...prev, order.id]);
                                        }}
                                        className="text-[9px] hover:text-[#E5B453] bg-white/5 hover:bg-[#E5B453]/10 border border-white/10 px-1.5 py-0.5 rounded transition cursor-pointer"
                                      >
                                        ⏱️ 模擬 +1hr
                                      </button>
                                    ) : (
                                      <span className="text-amber-500 font-bold">
                                        ⚠️ 用餐超時已解鎖
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {showDineInAlert && (
                                <div className="mt-2.5 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-extrabold rounded-lg animate-pulse text-center leading-normal">
                                  🚨 未達到低消，用餐時間結束
                                </div>
                              )}

                              <div className="mt-3 text-[11px] text-zinc-400 border-t border-white/5 pt-2.5">
                                <p className="truncate text-left text-zinc-300">
                                  {(order.items || [])
                                    .map((it) => {
                                      const pName = it.name
                                        ? typeof it.name === 'object'
                                          ? getLocalizedText(it.name, currentLang) || '未命名'
                                          : it.name
                                        : '未命名';
                                      return `${pName} x${it.qty || 0}`;
                                    })
                                    .join(', ')}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3.5 pt-2 border-t border-dashed border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                              <span className="text-[10px] text-zinc-500">
                                支付: {(order.paymentMethod || 'cash').toUpperCase()}
                              </span>
                              <span className="font-bold text-[#E5B453] bg-[#E5B453]/10 border border-[#E5B453]/20 px-3 py-1 rounded-lg group-hover:bg-[#E5B453] group-hover:text-black transition whitespace-nowrap">
                                {isSelected ? '收銀中' : '現正結帳 ➔'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FLOATING CASHIER MODAL DIALOG OVERLAY (Pops up when an order is selected) */}
            {cashierSelectedOrder && (
              <div
                className="fixed inset-0 z-50 flex flex-col xl:flex-row items-center justify-center p-4 xl:p-6 bg-black/90 backdrop-blur-md gap-6 overflow-y-auto"
                id="cashier-checkout-details-panel"
              >
                {/* SELECTOR 1: LEFT SUB-PANEL (Order Details & Ticket Items) */}
                <div
                  className={`bg-[#121212] border border-white/15 rounded-2xl p-6 w-full ${getPanelWidthClass(cashierPanelWidth)} max-h-[92vh] flex flex-col relative shadow-2xl animate-scaleUp overflow-y-auto min-w-0`}
                  id="cashier-checkout-left-subpanel"
                >
                  {/* Top Close button icon */}
                  <button
                    type="button"
                    onClick={() => setSelectedCashierOrderId(null)}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition p-2.5 hover:bg-white/5 rounded-full cursor-pointer z-10"
                    title="關閉視窗 Close Dialog"
                  >
                    ✕
                  </button>

                  {/* Width Auto-Scaling Controls (div:nth-of-type(1)) */}
                  <div
                    className="bg-[#181818] border border-white/10 rounded-xl p-4 mb-4 space-y-3 text-left"
                    id="cashier-width-scaler-control"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#E5B453] flex items-center gap-1.5">
                        <Maximize2 size={14} className="text-[#E5B453]" />
                        <span>🖥️ 收銀視窗寬度自適應 / 縮放功能 Panel Width Customizer</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        當前寬度: {cashierPanelWidth}%{' '}
                        {isCashierWidthAuto ? '(自動適應中)' : '(手動微調中)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      {/* Left: Auto Mode and Slider */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsCashierWidthAuto(!isCashierWidthAuto)}
                          className={`text-[11px] px-3 py-1.5 rounded-lg border font-bold h-8 flex items-center gap-1 cursor-pointer transition active:scale-95 ${
                            isCashierWidthAuto
                              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-300 border-white/5 hover:bg-white/5'
                          }`}
                        >
                          {isCashierWidthAuto ? '🟢 自動適應邊界 ON' : '⚪ 手動微調模式'}
                        </button>

                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="range"
                            min="35"
                            max="100"
                            step="1"
                            disabled={isCashierWidthAuto}
                            value={cashierPanelWidth}
                            onChange={(e) => setCashierPanelWidth(Number(e.target.value))}
                            className={`w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#E5B453] ${isCashierWidthAuto ? 'opacity-40 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Right: Quick Preset Buttons */}
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        <span className="text-[10px] text-zinc-500 shrink-0">快速比例:</span>
                        {[
                          { val: 40, label: '窄版' },
                          { val: 48, label: '標準' },
                          { val: 65, label: '寬版' },
                          { val: 80, label: '極寬' },
                          { val: 95, label: '全螢幕' },
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => {
                              setIsCashierWidthAuto(false);
                              setCashierPanelWidth(btn.val);
                            }}
                            className={`text-[10px] px-2 py-1 rounded border transition active:scale-95 cursor-pointer ${
                              !isCashierWidthAuto && cashierPanelWidth === btn.val
                                ? 'bg-[#E5B453] text-zinc-950 font-black border-[#E5B453]'
                                : 'bg-black/20 text-zinc-400 border-transparent hover:border-white/10'
                            }`}
                          >
                            {btn.label} ({btn.val}%)
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex-1 flex flex-col justify-between min-h-0"
                    id="cashier-active-register-area"
                  >
                    {/* Upper content scrollable */}
                    <div className="flex-1 overflow-y-auto space-y-4 text-left pr-2">
                      {/* Active Order Header */}
                      <div className="border-b border-white/5 pb-3.5 flex justify-between items-start">
                        <div className="space-y-1 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-[#E5B453] bg-[#E5B453]/10 border border-[#E5B453]/35 px-2 py-0.5 rounded font-black">
                              {cashierSelectedOrder.id}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              {new Date(cashierSelectedOrder.createdAt).toLocaleTimeString()} ·
                              下單時間
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap mt-1">
                            <h4 className="font-extrabold text-base text-white flex items-center gap-1.5">
                              <ShoppingBag size={18} className="text-[#E5B453]" />
                              <span>
                                櫃檯收銀中： 第 {cashierSelectedOrder.tableNumber || ''}{' '}
                                {cashierSelectedOrder.tableNumber &&
                                cashierSelectedOrder.tableNumber.includes('外帶')
                                  ? ''
                                  : '桌'}
                              </span>
                            </h4>
                            {editingOrderTableId === cashierSelectedOrder.id ? (
                              <div
                                className="flex items-center gap-1.5 bg-black/40 border border-white/15 rounded-lg px-2 py-1"
                                id="editing-order-table-section-cashier"
                              >
                                <select
                                  value={editingOrderTableValue}
                                  onChange={(e) => setEditingOrderTableValue(e.target.value)}
                                  className="bg-[#1c1c1c] border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#E5B453]"
                                >
                                  <optgroup label="客席就座桌號">
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                                      (num) => (
                                        <option key={num} value={num}>
                                          🪑 第 {num} 桌 (Dine-in)
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
                                          🛍️ {takeoutId} (Takeout)
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
                                        cashierSelectedOrder.id,
                                        editingOrderTableValue,
                                      );
                                      if (res.success) {
                                        cashierSelectedOrder.tableNumber = editingOrderTableValue;
                                        setEditingOrderTableId(null);
                                      } else {
                                        alert(res.error || '變更桌號失敗');
                                      }
                                    } else {
                                      cashierSelectedOrder.tableNumber = editingOrderTableValue;
                                      setEditingOrderTableId(null);
                                    }
                                  }}
                                  className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                                >
                                  儲存
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOrderTableId(null)}
                                  className="text-[10px] bg-zinc-700 hover:bg-zinc-650 text-zinc-300 font-extrabold px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOrderTableId(cashierSelectedOrder.id);
                                  setEditingOrderTableValue(cashierSelectedOrder.tableNumber);
                                }}
                                className="text-[10px] text-[#E5B453] hover:text-amber-300 bg-white/5 border border-white/5 hover:border-[#E5B453]/20 px-2 py-1 rounded cursor-pointer transition font-bold"
                              >
                                ✎ 更改桌號/外帶
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 mr-8">
                          {onDeleteOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmActionModal({
                                  isOpen: true,
                                  title: '🚨 永久刪除此訂單',
                                  message: `您確定要永久刪除訂單 [${cashierSelectedOrder.id}] 嗎？此操作將永久刪除此訂單，且無法復原。`,
                                  actionLabel: '確定刪除 Delete',
                                  onConfirm: async () => {
                                    await onDeleteOrder(cashierSelectedOrder.id);
                                    setSelectedCashierOrderId(null);
                                  },
                                });
                              }}
                              className="text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white transition active:scale-95 border border-rose-500/30 px-3 py-1.5 rounded-lg cursor-pointer font-bold"
                            >
                              🗑️ 刪除訂單 Delete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedCashierOrderId(null)}
                            className="text-zinc-400 hover:text-white transition active:scale-95 text-xs border border-white/10 px-3 py-1.5 rounded-lg bg-white/5 cursor-pointer font-bold"
                          >
                            關閉帳單 Exit
                          </button>
                        </div>
                      </div>

                      {/* Dine-In Minimum Spend Reminder Alert (Flashing/Flashing) */}
                      {(() => {
                        const isDineIn = !(
                          cashierSelectedOrder.tableNumber &&
                          cashierSelectedOrder.tableNumber.includes('外帶')
                        );
                        const orderGuests = cashierSelectedOrder.guestCount || 1;
                        const selOrderItemsSub = computeOrderItemsSubtotal(
                          cashierSelectedOrder.items || [],
                          menuItems,
                        );
                        const selOrderRawTot =
                          (cashierSelectedOrder.subtotal !== undefined &&
                          cashierSelectedOrder.subtotal !== null
                            ? cashierSelectedOrder.subtotal
                            : selOrderItemsSub) +
                          (cashierSelectedOrder.serviceCharge || 0) -
                          (cashierSelectedOrder.discount || 0);
                        const selOrderDisplayTotal =
                          typeof cashierSelectedOrder.total === 'number' &&
                          !isNaN(cashierSelectedOrder.total) &&
                          cashierSelectedOrder.total >= 0 &&
                          cashierSelectedOrder.total !== null
                            ? cashierSelectedOrder.total
                            : Math.max(0, selOrderRawTot);
                        const avgAmt = selOrderDisplayTotal / orderGuests;
                        const orderCreatedAtTime = new Date(
                          cashierSelectedOrder.createdAt,
                        ).getTime();
                        const timeElapsedMs = Date.now() - orderCreatedAtTime;
                        const isSimulated = simulatedElapsedOrders.includes(
                          cashierSelectedOrder.id,
                        );

                        const orderIsHourElapsed = timeElapsedMs >= 3600000 || isSimulated;
                        const orderBelowMinSpend = avgAmt < minSpend;
                        const showDineInAlert =
                          isDineIn && orderBelowMinSpend && orderIsHourElapsed;

                        if (showDineInAlert) {
                          return (
                            <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-4 rounded-xl text-center font-extrabold text-xs sm:text-sm animate-pulse tracking-wide font-sans leading-relaxed">
                              🚨 未達到低消，用餐時間結束
                              <div className="text-[11px] font-medium text-rose-400 mt-1">
                                每桌內用低消人數限制: {orderGuests} 人 · 應達最低總額:{' '}
                                {orderGuests * minSpend} 元 (目前僅有 NT${' '}
                                {selOrderDisplayTotal.toLocaleString()}，人均餐額 NT${' '}
                                {Math.round(avgAmt)})
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Table Status & Merging Control panel */}
                      {(() => {
                        const isDineIn = !(
                          cashierSelectedOrder.tableNumber &&
                          cashierSelectedOrder.tableNumber.includes('外帶')
                        );
                        if (!isDineIn) return null;

                        const tbId = cashierSelectedOrder.tableNumber;
                        const tbObj = tables.find((t) => t.id === tbId);

                        return (
                          <div className="bg-[#161616] border border-white/10 rounded-xl p-4 space-y-4 font-sans text-left">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-xs font-bold text-[#E5B453] flex items-center gap-1.5">
                                <span>🥢 第 {tbId} 桌客席及併桌管理 Table Management</span>
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                狀態:{' '}
                                {tbObj?.status === 'preserved'
                                  ? '🟣 預約預訂'
                                  : tbObj?.status === 'in_use'
                                    ? '🔵 已入座用餐'
                                    : tbObj?.status === 'pending_checkout'
                                      ? '🟡 已出單待結'
                                      : tbObj?.status === 'cleaning'
                                        ? '🔴 收拾清潔中'
                                        : '🟢 乾淨空桌'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left: Occupancy Status and Name */}
                              <div className="space-y-2.5">
                                <label className="text-[11px] text-zinc-400 font-bold block">
                                  1. 更改客席狀態 Switch Status
                                </label>
                                <select
                                  value={tbObj?.status || 'available'}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    let newPresName = tbObj?.preservedFor || '';
                                    if (newStatus === 'preserved' && !newPresName) {
                                      const ans = prompt(
                                        '請輸入預約保留顧客姓名 (Preserved Name)：',
                                      );
                                      if (ans !== null && ans.trim()) {
                                        newPresName = ans.trim();
                                      }
                                    }
                                    if (onUpdateTableStatus) {
                                      await onUpdateTableStatus(tbId, {
                                        status: newStatus,
                                        preservedFor: newStatus === 'preserved' ? newPresName : '',
                                      });
                                    }
                                  }}
                                  className="w-full bg-[#121212] border border-white/10 rounded-xl text-white text-xs h-9 px-3 cursor-pointer outline-none focus:border-amber-400"
                                >
                                  <option value="available">🟢 空桌 Available (空閒可帶位)</option>
                                  <option value="in_use">🔵 入座 Occupied (已帶位/用餐中)</option>
                                  <option value="pending_checkout">
                                    🟡 待結帳 Pending (尚未付款)
                                  </option>
                                  <option value="cleaning">🔴 清潔中 Cleaning (清潔收拾中)</option>
                                  <option value="preserved">
                                    🟣 預約保留 Preserved (座席保留)
                                  </option>
                                </select>

                                {tbObj?.status === 'preserved' && (
                                  <div className="space-y-1 bg-[#1c1c1c] p-2.5 border border-white/5 rounded-xl">
                                    <span className="text-[10px] text-rose-400 font-bold block">
                                      保留姓名 / 持有者 Reservation Name:
                                    </span>
                                    <input
                                      type="text"
                                      value={tbObj?.preservedFor || ''}
                                      placeholder="請修改保留人姓名"
                                      onChange={async (e) => {
                                        if (onUpdateTableStatus) {
                                          await onUpdateTableStatus(tbId, {
                                            preservedFor: e.target.value,
                                          });
                                        }
                                      }}
                                      className="bg-black/45 border border-white/10 focus:border-rose-400 rounded-lg text-white text-xs py-1 px-2.5 w-full font-sans"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Right: Merging Table Select */}
                              <div className="space-y-2.5">
                                <label className="text-[11px] text-zinc-400 font-bold block">
                                  2. 合併併桌設定 Merge with Table
                                </label>
                                <select
                                  value={tbObj?.mergedWith || ''}
                                  onChange={async (e) => {
                                    const targetMerge = e.target.value;
                                    if (onUpdateTableStatus) {
                                      await onUpdateTableStatus(tbId, { mergedWith: targetMerge });
                                    }
                                  }}
                                  className="w-full bg-[#121212] border border-white/10 rounded-xl text-white text-xs h-9 px-3 cursor-pointer outline-none focus:border-amber-400"
                                >
                                  <option value="">🔗 獨立（不與他桌合併）</option>
                                  {tables
                                    .filter((other) => other.id !== tbId)
                                    .map((other) => (
                                      <option key={other.id} value={other.id}>
                                        併帳至 ➔ 第 {other.id} 桌
                                      </option>
                                    ))}
                                </select>

                                {/* Merged info banner */}
                                {tbObj?.mergedWith && (
                                  <div className="bg-sky-500/10 border border-sky-500/20 text-sky-400 p-2 rounded-xl text-[10px] leading-relaxed">
                                    ℹ️ 本桌 (第 {tbId} 桌) 已設定併入{' '}
                                    <strong>第 {tbObj.mergedWith} 桌</strong>。在 checkout
                                    結帳時，兩桌的帳單會自動合併計算，店員僅需以此 lead
                                    帳單進行款項清收。
                                  </div>
                                )}

                                {tables.some((t) => t.mergedWith === tbId) && (
                                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2 rounded-xl text-[10px] leading-relaxed">
                                    ℹ️ 偵測到有其他客桌併入本桌：
                                    <strong>
                                      {tables
                                        .filter((t) => t.mergedWith === tbId)
                                        .map((t) => `${t.id}桌`)
                                        .join(', ')}
                                    </strong>
                                    。系統已將該等客席之未結帳訂單內容動態合併，點餐明細已完成自動彙整。
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Items Brief */}
                      <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-3">
                        <span className="text-[10px] text-zinc-500 block font-bold tracking-wider uppercase">
                          🍽️ 點餐菜品明細 (合併計{' '}
                          {cashierMergedOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0)}{' '}
                          項)
                        </span>
                        <div className="space-y-4 divide-y divide-white/5 text-xs">
                          {cashierMergedOrders.map((ord, oidx) => (
                            <div key={ord.id} className={oidx > 0 ? 'pt-3.5' : ''}>
                              {cashierMergedOrders.length > 1 && (
                                <div className="flex justify-between items-center bg-white/5 px-2.5 py-1 rounded-lg mb-2 font-mono text-[10px] text-[#E5B453] font-bold">
                                  <span>🥢 第 {ord.tableNumber} 桌之點單</span>
                                  <span className="opacity-60">
                                    {ord.id.slice(-6).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="space-y-3">
                                {(ord.items || []).map((it) => {
                                  const pName = it.name
                                    ? typeof it.name === 'object'
                                      ? getLocalizedText(it.name, currentLang) || '未命名'
                                      : it.name
                                    : '未命名';
                                  const dish = menuItems.find((m: any) => m.id === it.menuItemId);
                                  const baseUnitPrice = dish ? dish.price : it.price || 0;
                                  const effectiveUnitPrice = computeOrderItemUnitPrice(
                                    it,
                                    menuItems,
                                  );
                                  const itemRowTotal = effectiveUnitPrice * (it.qty || 0);

                                  const spicinessName = [
                                    '不辣',
                                    '微辣',
                                    '中辣',
                                    '泰式大辣 (+NT$ 10)',
                                  ][it.customization?.spiciness || 0];
                                  const sweetnessName = ['無糖', '減糖', '標準', '多糖'][
                                    it.customization?.sweetness || 0
                                  ];
                                  const noodleName =
                                    it.customization?.noodleType === 'rice-noodle'
                                      ? '河粉'
                                      : it.customization?.noodleType === 'vermicelli'
                                        ? '米線'
                                        : null;
                                  const soupBaseName =
                                    it.customization?.soupBase === 'coconut-milk'
                                      ? '升級奶香冬蔭 (+NT$ 50)'
                                      : null;
                                  const addOns = it.customization?.selectedAddOns || [];
                                  const notes = it.customization?.notes || '';

                                  return (
                                    <div
                                      key={it.id}
                                      className="pt-2.5 pb-2.5 border-b border-white/10 flex flex-col gap-2 text-zinc-300 font-sans"
                                    >
                                      {/* Top Row: Item Header, Base Unit Price, Qty, Subtotal & Action Controls */}
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="text-left space-y-1 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-extrabold text-white text-sm">
                                              {pName}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                              主餐原價 NT$ {baseUnitPrice}
                                            </span>
                                            <span className="font-mono text-[#E5B453] font-black text-xs bg-[#E5B453]/10 border border-[#E5B453]/30 px-1.5 py-0.5 rounded">
                                              x{it.qty || 0}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center space-x-2 shrink-0">
                                          {/* Qty adjustments */}
                                          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleCombinedQtyChange(ord.id, it.id, -1)
                                              }
                                              className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                                              title="減少數量"
                                            >
                                              <Minus size={11} />
                                            </button>
                                            <span className="px-1.5 text-xs font-black text-white min-w-[16px] text-center">
                                              {it.qty || 0}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleCombinedQtyChange(ord.id, it.id, 1)
                                              }
                                              className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                                              title="增加數量"
                                            >
                                              <Plus size={11} />
                                            </button>
                                          </div>
                                          {/* Remove button */}
                                          <button
                                            type="button"
                                            onClick={() => handleCombinedRemoveItem(ord.id, it.id)}
                                            className="p-1.5 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition cursor-pointer border border-red-500/20"
                                            title="移除品項"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                          <div className="text-right min-w-[70px]">
                                            <span className="font-mono text-amber-300 font-extrabold text-sm block">
                                              NT$ {itemRowTotal.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 font-mono block">
                                              (單價 NT$ {effectiveUnitPrice})
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Customization & Add-on Detailed Breakdown (櫃台送餐確認細項與金額) */}
                                      {it.customization && (
                                        <div className="bg-[#181818] border border-white/10 rounded-lg p-2.5 space-y-2 text-left">
                                          {/* Base Options (Noodle / Soup Base / Spiciness / Sweetness) */}
                                          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-300">
                                            {noodleName && (
                                              <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold">
                                                🍝 麵條: {noodleName}
                                              </span>
                                            )}
                                            {soupBaseName && (
                                              <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded font-bold">
                                                🥥 {soupBaseName}
                                              </span>
                                            )}
                                            <span className="bg-zinc-800 border border-white/10 text-zinc-300 px-2 py-0.5 rounded font-medium">
                                              🌶️ {spicinessName}
                                            </span>
                                            <span className="bg-zinc-800 border border-white/10 text-zinc-300 px-2 py-0.5 rounded font-medium">
                                              🍬 {sweetnessName}
                                            </span>
                                          </div>

                                          {/* Individual Add-ons Details and Amounts (加點細項與金額) */}
                                          {addOns.length > 0 && (
                                            <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                                              <span className="text-[11px] font-extrabold text-[#E5B453] flex items-center gap-1">
                                                <span>➕ 加購/加點細項明細 Add-ons Detail:</span>
                                              </span>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {addOns.map((addOn: any, aidx: number) => {
                                                  const addOnName =
                                                    getLocalizedText(addOn.name, currentLang) ||
                                                    (typeof addOn.name === 'string'
                                                      ? addOn.name
                                                      : '加點項目');
                                                  const addOnPrice = Number(addOn.price) || 0;
                                                  return (
                                                    <div
                                                      key={aidx}
                                                      className="flex justify-between items-center bg-black/50 border border-amber-500/20 rounded px-2.5 py-1 text-[11px]"
                                                    >
                                                      <span className="text-zinc-200 font-bold">
                                                        • {addOnName}
                                                      </span>
                                                      <span className="font-mono font-black text-amber-300">
                                                        +NT$ {addOnPrice}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}

                                          {/* Special Notes */}
                                          {notes && (
                                            <div className="text-[11px] text-amber-200/90 font-medium bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded">
                                              📝 廚房特調備註: {notes}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Dropdown to add custom new item */}
                        <div className="pt-2 border-t border-white/5 flex gap-2 items-center">
                          <label className="text-[10px] text-zinc-400 shrink-0 font-bold">
                            加點餐點：
                          </label>
                          <select
                            value={cashierNewItemInput}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleCashierAddMenuItem(e.target.value);
                              }
                            }}
                            className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#E5B453]"
                          >
                            <option value="">-- 🔎 選擇加點品項 (Add Dish) --</option>
                            {menuItems &&
                              menuItems
                                .filter((item) => item.isAvailable !== false)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {getLocalizedText(item.name, 'zh')} (+NT$ {item.price})
                                  </option>
                                ))}
                          </select>
                        </div>
                      </div>

                      {/* Cashier Adjustments (Discount & Surcharge) Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Discount Card */}
                        <div className="bg-[#181818] border border-white/5 rounded-xl p-4 space-y-3">
                          <h6 className="text-[11px] font-bold text-white/90 flex justify-between items-center">
                            <span>🏷️ 手動折扣 (Discount Modifier)</span>
                            <span className="text-[10px] text-[#E5B453] font-mono font-bold">
                              {cashierDiscountType === 'percent'
                                ? `${cashierDiscountRate}% OFF`
                                : `折 NT$ ${cashierDiscountFlat}`}
                            </span>
                          </h6>

                          {/* Percent vs Flat toggle */}
                          <div className="grid grid-cols-2 bg-black/40 p-0.5 rounded-lg border border-white/5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setCashierDiscountType('percent')}
                              className={`py-1 rounded font-bold transition cursor-pointer ${
                                cashierDiscountType === 'percent'
                                  ? 'bg-[#E5B453] text-zinc-950 font-black'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              % 百分比例
                            </button>
                            <button
                              type="button"
                              onClick={() => setCashierDiscountType('flat')}
                              className={`py-1 rounded font-bold transition cursor-pointer ${
                                cashierDiscountType === 'flat'
                                  ? 'bg-[#E5B453] text-zinc-950 font-black'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              $ 固定折價
                            </button>
                          </div>

                          {/* Quick Value Selectors */}
                          {cashierDiscountType === 'percent' ? (
                            <div className="grid grid-cols-5 gap-1.5 text-[9px] font-bold font-sans">
                              {[
                                { val: 0, lbl: '無' },
                                { val: 5, lbl: '95折' },
                                { val: 10, lbl: '9折' },
                                { val: 15, lbl: '85折' },
                                { val: 20, lbl: '8折' },
                              ].map((btn) => (
                                <button
                                  key={btn.val}
                                  type="button"
                                  onClick={() => setCashierDiscountRate(btn.val)}
                                  className={`py-1 rounded-md border text-center transition cursor-pointer ${
                                    cashierDiscountRate === btn.val
                                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/40 font-black'
                                      : 'bg-black/20 text-zinc-400 border-transparent hover:border-white/10'
                                  }`}
                                >
                                  {btn.lbl}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-5 gap-1.5 text-[9px] font-bold font-sans">
                              {[
                                { val: 0, lbl: '無' },
                                { val: 50, lbl: '$50' },
                                { val: 100, lbl: '$100' },
                                { val: 200, lbl: '$200' },
                                { val: 300, lbl: '$300' },
                              ].map((btn) => (
                                <button
                                  key={btn.val}
                                  type="button"
                                  onClick={() => setCashierDiscountFlat(btn.val)}
                                  className={`py-1 rounded-md border text-center transition cursor-pointer ${
                                    cashierDiscountFlat === btn.val
                                      ? 'bg-amber-400/10 text-amber-400 border-amber-400/40 font-black'
                                      : 'bg-black/20 text-zinc-400 border-transparent hover:border-white/10'
                                  }`}
                                >
                                  {btn.lbl}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Manual Input field */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block">自訂調整數值</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max={
                                  cashierDiscountType === 'percent'
                                    ? 100
                                    : cashierSelectedOrder.subtotal
                                }
                                value={
                                  cashierDiscountType === 'percent'
                                    ? cashierDiscountRate || ''
                                    : cashierDiscountFlat || ''
                                }
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  if (cashierDiscountType === 'percent') {
                                    setCashierDiscountRate(Math.min(100, val));
                                  } else {
                                    setCashierDiscountFlat(
                                      Math.min(cashierSelectedOrder.subtotal, val),
                                    );
                                  }
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs font-bold focus:outline-none focus:border-[#E5B453]"
                              />
                              <span className="absolute right-2 top-1 text-[10px] font-bold text-zinc-500 font-mono">
                                {cashierDiscountType === 'percent' ? '%' : '元'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Surcharge Fee Card */}
                        <div className="bg-[#181818] border border-white/5 rounded-xl p-4 space-y-3">
                          <h6 className="text-[11px] font-bold text-white/90 flex justify-between items-center">
                            <span>📈 手動加成 (Surcharge Modifier)</span>
                            <span className="text-[10px] text-blue-400 font-mono font-bold">
                              {cashierSurchargeType === 'percent'
                                ? `+ ${cashierSurchargeRate}%`
                                : `+ NT$ ${cashierSurchargeFlat}`}
                            </span>
                          </h6>

                          {/* Percent vs Flat toggle */}
                          <div className="grid grid-cols-2 bg-black/40 p-0.5 rounded-lg border border-white/5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setCashierSurchargeType('percent')}
                              className={`py-1 rounded font-bold transition cursor-pointer ${
                                cashierSurchargeType === 'percent'
                                  ? 'bg-blue-500 text-white font-black'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              % 百分比例
                            </button>
                            <button
                              type="button"
                              onClick={() => setCashierSurchargeType('flat')}
                              className={`py-1 rounded font-bold transition cursor-pointer ${
                                cashierSurchargeType === 'flat'
                                  ? 'bg-blue-500 text-white font-black'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              $ 固定加成
                            </button>
                          </div>

                          {/* Quick Value Selectors */}
                          {cashierSurchargeType === 'percent' ? (
                            <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold font-sans">
                              {[
                                { val: 0, lbl: '無' },
                                { val: 5, lbl: '5% 服務' },
                                { val: 10, lbl: '10% 標準' },
                                { val: 15, lbl: '15% 加值' },
                              ].map((btn) => (
                                <button
                                  key={btn.val}
                                  type="button"
                                  onClick={() => setCashierSurchargeRate(btn.val)}
                                  className={`py-1 rounded-md border text-center transition cursor-pointer ${
                                    cashierSurchargeRate === btn.val
                                      ? 'bg-blue-400/10 text-blue-400 border-blue-400/40 font-black'
                                      : 'bg-black/20 text-zinc-400 border-transparent hover:border-white/10'
                                  }`}
                                >
                                  {btn.lbl}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold font-sans">
                              {[
                                { val: 0, lbl: '無' },
                                { val: 30, lbl: '$30' },
                                { val: 50, lbl: '$50' },
                                { val: 100, lbl: '$100' },
                              ].map((btn) => (
                                <button
                                  key={btn.val}
                                  type="button"
                                  onClick={() => setCashierSurchargeFlat(btn.val)}
                                  className={`py-1 rounded-md border text-center transition cursor-pointer ${
                                    cashierSurchargeFlat === btn.val
                                      ? 'bg-blue-400/10 text-blue-400 border-blue-400/40 font-black'
                                      : 'bg-black/20 text-zinc-400 border-transparent hover:border-white/10'
                                  }`}
                                >
                                  {btn.lbl}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Manual Input field */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block">自訂調整數值</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max={
                                  cashierSurchargeType === 'percent'
                                    ? 100
                                    : cashierSelectedOrder.subtotal
                                }
                                value={
                                  cashierSurchargeType === 'percent'
                                    ? cashierSurchargeRate || ''
                                    : cashierSurchargeFlat || ''
                                }
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  if (cashierSurchargeType === 'percent') {
                                    setCashierSurchargeRate(Math.min(100, val));
                                  } else {
                                    setCashierSurchargeFlat(
                                      Math.min(cashierSelectedOrder.subtotal, val),
                                    );
                                  }
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs font-bold focus:outline-none focus:border-blue-500"
                              />
                              <span className="absolute right-2 top-1 text-[10px] font-bold text-zinc-500 font-mono">
                                {cashierSurchargeType === 'percent' ? '%' : '元'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SELECTOR 2: RIGHT SUB-PANEL (Payment Gate, Touch Keyboard & Action Trigger) */}
                <div
                  className={`bg-[#121212] border border-white/15 rounded-2xl p-6 w-full ${getPanelWidthClass(cashierPanelWidth)} max-h-[92vh] flex flex-col relative shadow-2xl animate-scaleUp overflow-y-auto min-w-0`}
                  id="cashier-checkout-right-subpanel"
                >
                  <div
                    className="flex-1 flex flex-col justify-between min-h-0"
                    id="cashier-active-payment-area"
                  >
                    <div className="flex-1 overflow-y-auto space-y-4 text-left pr-2">
                      {/* Payment Method Selector Grid */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block">
                          💳 選擇收銀支付管道 (Payment Method Selector)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'cash', label: '💵 現金收銀', desc: '實收大鈔與選管道' },
                            { id: 'credit', label: '💳 信用卡結', desc: '預設 10% 服務加成' },
                            { id: 'member', label: '⭐️ 會員儲值', desc: '扣抵會員與儲值管理' },
                            { id: 'twqr', label: '📱 TWQR支付', desc: '預設 10% 服務加成' },
                          ].map((pay) => {
                            const isAct = cashierPaymentMethod === pay.id;
                            return (
                              <button
                                key={pay.id}
                                type="button"
                                onClick={() => {
                                  const method = pay.id as any;
                                  setCashierPaymentMethod(method);
                                  if (method === 'credit' || method === 'twqr') {
                                    setCashierSurchargeRate(10);
                                    setCashierSurchargeFlat(0);
                                    setCashierSurchargeType('percent');
                                    setCashierDiscountRate(0);
                                    setCashierDiscountFlat(0);
                                  } else {
                                    setCashierSurchargeRate(0);
                                    setCashierSurchargeFlat(0);
                                    setCashierDiscountRate(0);
                                    setCashierDiscountFlat(0);
                                  }
                                }}
                                className={`text-left rounded-xl p-2.5 border cursor-pointer flex flex-col justify-between transition-all active:scale-95 duration-100 ${
                                  isAct
                                    ? pay.id === 'member'
                                      ? 'bg-amber-400/10 border-amber-400 text-white shadow shadow-amber-400/10'
                                      : 'bg-[#E5B453]/10 border-[#E5B453] text-white shadow shadow-[#E5B453]/10'
                                    : 'bg-[#161616] border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                                }`}
                              >
                                <span
                                  className={`font-bold text-xs ${isAct ? 'text-[#E5B453]' : 'text-zinc-300'}`}
                                >
                                  {pay.label}
                                </span>
                                <span className="text-[9px] opacity-60 mt-0.5 block leading-tight">
                                  {pay.desc}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Cash handling drawer if cash is chosen */}
                      {cashierPaymentMethod === 'cash' && (
                        <div className="bg-black/40 border border-white/12 p-3.5 rounded-xl flex flex-col lg:flex-row gap-4 font-sans mt-2 justify-between">
                          {/* Left Panel: Received Cash Calculations */}
                          <div className="flex-1 flex flex-col justify-between space-y-3 min-w-0">
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-[#E5B453] font-bold block tracking-wider uppercase">
                                💶 實收大鈔 (Cash Received Option)
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-2.5 top-2 font-bold font-mono text-[#E5B453] text-[13px]">
                                    NT$
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    id="cashier-received-amt-input"
                                    value={cashierCashReceived === 0 ? '' : cashierCashReceived}
                                    onChange={(e) =>
                                      setCashierCashReceived(
                                        parseFloat(e.target.value.replace(/\D/g, '')) || 0,
                                      )
                                    }
                                    className="w-full bg-[#161616] border border-white/10 rounded-lg py-1.5 px-2.5 pl-10 text-white font-mono text-sm font-extrabold focus:outline-none focus:border-[#E5B453] transition"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCashierCashReceived(cashierCalculatedTotals.total)
                                  }
                                  className="px-2.5 py-2 text-xs font-sans bg-amber-500/10 border border-amber-500/30 text-[#E5B453] hover:bg-[#E5B453] hover:text-black rounded-lg transition font-black cursor-pointer whitespace-nowrap active:scale-95"
                                >
                                  剛好 Total: NT$ {cashierCalculatedTotals.total}
                                </button>
                              </div>
                            </div>

                            {/* 2. 現金收銀管道選擇 */}
                            <div className="space-y-1.5 bg-black/30 p-2 rounded-lg border border-white/5">
                              <span className="text-[9px] text-zinc-400 block font-bold uppercase tracking-wide">
                                📦 選擇現金收銀管道 (Cash Channel)
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  { id: 'counter', title: '🏢 櫃檯現金', desc: 'Counter' },
                                  { id: 'kiosk', title: '🏪 自助收銀', desc: 'Self Kiosk' },
                                  { id: 'delivery', title: '🛵 外送代收', desc: 'Delivery' },
                                ].map((chan) => (
                                  <button
                                    key={`cash-chan-${chan.id}`}
                                    type="button"
                                    onClick={() => setCashierCashChannel(chan.id as any)}
                                    className={`py-1 px-1 rounded-lg border text-left cursor-pointer transition flex flex-col justify-center items-center ${
                                      cashierCashChannel === chan.id
                                        ? 'bg-[#E5B453]/20 border-[#E5B453] text-[#E5B453] font-black'
                                        : 'bg-[#121212]/90 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                                    }`}
                                  >
                                    <span className="text-[9px] font-extrabold block leading-none">
                                      {chan.title}
                                    </span>
                                    <span className="text-[8px] opacity-60 mt-0.5 block leading-none">
                                      {chan.desc}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 1. 實收大鈔可選1000、500、100 */}
                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-500 block font-bold">
                                單張面額付鈔 Set Denomination
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[1000, 500, 100].map((note) => (
                                  <button
                                    key={`note-set-${note}`}
                                    type="button"
                                    onClick={() => setCashierCashReceived(note)}
                                    className="py-1.5 text-xs font-mono font-black border border-white/10 hover:border-[#E5B453] hover:bg-[#E5B453]/10 bg-zinc-900 rounded-lg text-white transition cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95"
                                  >
                                    <span>NT$ {note}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-zinc-500 block font-bold">
                                累加點鈔 Add Bill Notes
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[1000, 500, 100].map((note) => (
                                  <button
                                    key={`note-add-${note}`}
                                    type="button"
                                    onClick={() =>
                                      setCashierCashReceived((prev) => (prev || 0) + note)
                                    }
                                    className="py-1 text-xs font-mono font-bold border border-white/5 hover:border-[#E5B453]/40 hover:bg-[#E5B453]/10 bg-zinc-950 rounded-lg text-zinc-300 transition cursor-pointer flex items-center justify-center gap-0.5 active:scale-95"
                                  >
                                    <span>＋{note}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 💳 現金結帳確認欄 (Cash Checkout Confirmation Summary Panel) */}
                            <div className="bg-amber-500/5 border border-amber-500/30 p-2.5 rounded-xl space-y-1.5 mt-1 text-[11px] font-sans">
                              <div className="flex items-center justify-between border-b border-white/5 pb-1 flex-wrap">
                                <span className="text-[#E5B453] font-black uppercase text-xs">
                                  📝 櫃檯現金付款確認 (Cashier Checkout Confirmation)
                                </span>
                                <span className="bg-amber-500/10 text-amber-500 text-[9px] px-1.5 py-0.5 rounded font-black font-mono">
                                  核收核對
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                                <div className="space-y-0.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">應收總額 Total Due:</span>
                                    <span className="font-mono text-sm font-black text-white">
                                      NT$ {cashierCalculatedTotals.total}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">實收現鈔 Cash Paid:</span>
                                    <span className="font-mono text-sm font-black text-amber-400">
                                      NT$ {cashierCashReceived}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-0.5 border-l border-white/5 pl-2.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">應找零錢 Change:</span>
                                    <span className="font-mono text-base font-black text-emerald-400 animate-pulse">
                                      NT${' '}
                                      {Math.max(
                                        0,
                                        cashierCashReceived - cashierCalculatedTotals.total,
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">收銀管道 Channel:</span>
                                    <span className="font-bold text-blue-400">
                                      {cashierCashChannel === 'counter'
                                        ? '🏢 櫃檯現金'
                                        : cashierCashChannel === 'kiosk'
                                          ? '🏪 自助收銀'
                                          : '🛵 外送代收'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {cashierCashReceived < cashierCalculatedTotals.total ? (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 py-1 px-2 rounded text-[10px] text-center font-bold">
                                  ⚠️ 實收金額不足！尚差 NT${' '}
                                  {cashierCalculatedTotals.total - cashierCashReceived} 元
                                </div>
                              ) : (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-1 px-2 rounded text-[10px] text-center font-bold">
                                  ⚡ 現金經現場核對無誤，可安全核可付款並上傳 Firestore 資料庫
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Panel: Compact, touchscreen numeric keypad */}
                          <div className="w-full lg:w-48 bg-black/20 p-2 border border-white/5 rounded-xl flex flex-col gap-1.5 self-start">
                            <span className="text-[9px] text-zinc-500 font-extrabold block text-center uppercase tracking-wider">
                              🎯 觸控快速鍵盤 Touch Keypad
                            </span>
                            <div className="grid grid-cols-3 gap-1">
                              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                                <button
                                  key={`keypad-${num}`}
                                  type="button"
                                  onClick={() => {
                                    setCashierCashReceived((prev) => {
                                      const s = String(prev);
                                      if (prev === 0 || prev === cashierCalculatedTotals.total) {
                                        return parseFloat(num) || 0;
                                      } else {
                                        return parseFloat(s + num) || 0;
                                      }
                                    });
                                  }}
                                  className="w-full h-8 flex items-center justify-center font-mono text-xs font-bold text-white hover:text-black bg-[#1c1c1c] hover:bg-[#E5B453] border border-white/5 hover:border-transparent rounded-lg transition active:scale-95 cursor-pointer"
                                >
                                  {num}
                                </button>
                              ))}
                              {/* Bottom row: Clear, 0, Backspace */}
                              <button
                                type="button"
                                onClick={() => setCashierCashReceived(0)}
                                className="w-full h-8 flex items-center justify-center font-bold text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition active:scale-95 cursor-pointer"
                                title="清除 Clear"
                              >
                                C
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCashierCashReceived((prev) => {
                                    const s = String(prev);
                                    if (prev === 0 || prev === cashierCalculatedTotals.total) {
                                      return 0;
                                    } else {
                                      return parseFloat(s + '0') || 0;
                                    }
                                  });
                                }}
                                className="w-full h-8 flex items-center justify-center font-mono text-xs font-bold text-white bg-[#1c1c1c] hover:bg-[#E5B453] hover:text-black border border-white/5 rounded-lg transition active:scale-95 cursor-pointer"
                              >
                                0
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCashierCashReceived((prev) => {
                                    const s = String(prev);
                                    if (s.length <= 1) return 0;
                                    return parseFloat(s.slice(0, -1)) || 0;
                                  });
                                }}
                                className="w-full h-8 flex items-center justify-center font-mono text-xs font-bold text-zinc-400 hover:text-white bg-[#1a1a1a] hover:bg-zinc-800 border border-white/5 rounded-lg transition active:scale-95 cursor-pointer"
                                title="倒退 Backspace"
                              >
                                ⌫
                              </button>
                            </div>

                            {/* Extra touch helpers: +00 */}
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCashierCashReceived((prev) => {
                                    const s = String(prev);
                                    if (prev === 0 || prev === cashierCalculatedTotals.total) {
                                      return 0;
                                    } else {
                                      return parseFloat(s + '00') || 0;
                                    }
                                  });
                                }}
                                className="py-1 flex items-center justify-center font-mono text-[10px] bg-[#1c1c1c] border border-white/5 hover:border-zinc-700 rounded-lg transition active:scale-95 cursor-pointer text-zinc-300 font-bold"
                              >
                                00
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCashierCashReceived((prev) => {
                                    const s = String(prev);
                                    if (prev === 0 || prev === cashierCalculatedTotals.total) {
                                      return 0;
                                    } else {
                                      return parseFloat(s + '000') || 0;
                                    }
                                  });
                                }}
                                className="py-1 flex items-center justify-center font-mono text-[10px] bg-[#1c1c1c] border border-white/5 hover:border-zinc-700 rounded-lg transition active:scale-95 cursor-pointer text-zinc-300 font-bold"
                              >
                                000
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Member management drawer if member is chosen */}
                      {cashierPaymentMethod === 'member' && (
                        <div className="bg-[#121824]/80 border border-blue-500/20 p-3.5 rounded-xl flex flex-col gap-3 font-sans mt-2 text-left">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-2">
                            <div className="space-y-0.5 bg-transparent">
                              <span className="text-[11px] text-blue-400 font-bold block tracking-wider uppercase">
                                ⭐️ 儲值卡結帳與快捷儲值 (Cashier Member Admin)
                              </span>
                              <p className="text-zinc-400 text-[10px]">
                                {cashierSelectedOrder?.isMember
                                  ? `結帳單已綁定會員：${cashierSelectedOrder.customerName}`
                                  : '本結帳單尚未在點餐時綁定會員。'}
                              </p>
                            </div>
                          </div>

                          {(() => {
                            const dbStr = localStorage.getItem('google-members-database');
                            let matchedMember = null;
                            let db: any[] = [];
                            if (dbStr) {
                              try {
                                db = JSON.parse(dbStr);
                                if (cashierSelectedOrder?.customerName) {
                                  matchedMember = db.find(
                                    (m: any) => m.name === cashierSelectedOrder.customerName,
                                  );
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }

                            if (matchedMember) {
                              const member = matchedMember;
                              const hasEnough = member.balance >= cashierCalculatedTotals.total;
                              return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Left part: Member Balance Deduction Details */}
                                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl space-y-2.5">
                                    <span className="text-[10px] text-blue-400 font-extrabold block uppercase tracking-wider">
                                      💳 餘額扣抵狀態
                                    </span>
                                    <div className="space-y-2.5">
                                      <div className="flex items-center space-x-2.5 bg-white/5 p-2 rounded-lg border border-white/5">
                                        <img
                                          referrerPolicy="no-referrer"
                                          src={
                                            member.avatar ||
                                            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=150'
                                          }
                                          className="w-8 h-8 rounded-full object-cover border border-white/10"
                                          alt=""
                                        />
                                        <div>
                                          <p className="text-xs font-black text-white">
                                            {member.name}
                                          </p>
                                          <p className="text-[9px] text-zinc-500 font-mono leading-none mt-0.5">
                                            {getMaskedEmail(member.email)}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-1.5 text-center">
                                        <div className="bg-zinc-900 px-1.5 py-1 rounded border border-white/5">
                                          <span className="text-[8px] text-zinc-500 block leading-none">
                                            當前帳存餘額
                                          </span>
                                          <span className="text-xs font-mono font-bold text-emerald-400">
                                            NT$ {member.balance || 0}
                                          </span>
                                        </div>
                                        <div className="bg-zinc-900 px-1.5 py-1 rounded border border-white/5">
                                          <span className="text-[8px] text-zinc-500 block leading-none">
                                            本次扣除金額
                                          </span>
                                          <span className="text-xs font-mono font-bold text-rose-400">
                                            NT$ {cashierCalculatedTotals.total}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] pt-1">
                                        <span className="text-zinc-400">扣抵後剩餘：</span>
                                        <span className="font-mono font-bold text-zinc-200">
                                          NT${' '}
                                          {Math.max(
                                            0,
                                            (member.balance || 0) - cashierCalculatedTotals.total,
                                          )}
                                        </span>
                                      </div>

                                      {!hasEnough && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded text-[9px] font-bold">
                                          ⚠️
                                          顧客儲值餘額不足！請先點擊右側進行【快捷現金增值】以補足差額扣抵。
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right part: Top up management */}
                                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl space-y-2.5">
                                    <span className="text-[10px] text-zinc-300 font-extrabold block uppercase tracking-wider">
                                      💸 收銀台即時儲值 (Top-Up Engine)
                                    </span>
                                    <p className="text-[9px] text-zinc-400 leading-normal">
                                      顧客提供現場代收現金時，收銀員在此一鍵寫入儲值額：
                                    </p>

                                    <div className="grid grid-cols-2 gap-1.5">
                                      {[
                                        { amt: 500, lbl: '＋儲值 $500' },
                                        { amt: 1000, lbl: '＋儲值 $1000' },
                                        { amt: 2000, lbl: '＋儲值 $2000' },
                                        { amt: 3000, lbl: '＋儲值 $3000' },
                                      ].map((choice) => (
                                        <button
                                          key={`cashier-top-${choice.amt}`}
                                          type="button"
                                          onClick={() => {
                                            const userIndex = db.findIndex(
                                              (m: any) => m.email === member.email,
                                            );
                                            if (userIndex >= 0) {
                                              db[userIndex].balance =
                                                (db[userIndex].balance || 0) + choice.amt;
                                              localStorage.setItem(
                                                'google-members-database',
                                                JSON.stringify(db),
                                              );
                                              window.dispatchEvent(
                                                new Event('local-points-updated'),
                                              );
                                              // Force state refresh
                                              setCashierCashReceived((prev) => prev + 1);
                                              setTimeout(
                                                () => setCashierCashReceived((prev) => prev - 1),
                                                50,
                                              );
                                            }
                                          }}
                                          className="py-1.5 text-[10px] font-sans font-black border border-[#E5B453]/20 hover:border-[#E5B453] hover:bg-[#E5B453]/10 bg-zinc-900 text-white rounded-lg transition active:scale-95 cursor-pointer text-center"
                                        >
                                          {choice.lbl}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="bg-zinc-900/60 p-4 rounded-xl border border-white/5 text-center text-zinc-500 text-xs py-6">
                                  ⚠️ 本點餐單尚未與任何 Google
                                  會員帳戶綁定，無法使用儲值卡餘額付款。
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Bottom Area: Calculation & Submit */}
                    <div className="bg-[#161616] border-t border-white/10 p-4 rounded-xl space-y-3 font-sans mt-2.5">
                      {/* Detailed billing list */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs text-zinc-400">
                        <div className="text-left bg-black/20 p-2 border border-white/5 rounded-lg">
                          <span className="text-[9px] text-zinc-500 font-sans">
                            原小計 Subtotal
                          </span>
                          <p className="font-mono text-xs text-white font-bold mt-0.5">
                            NT$ {cashierCalculatedTotals.subtotal}
                          </p>
                        </div>
                        <div
                          onClick={() => {
                            setIsAdjustingDiscount(!isAdjustingDiscount);
                            setIsAdjustingSurcharge(false);
                          }}
                          className={`text-left bg-black/20 p-2 border rounded-lg cursor-pointer transition active:scale-95 duration-100 group ${
                            isAdjustingDiscount
                              ? 'border-[#E5B453] bg-zinc-900 shadow-lg'
                              : 'border-white/5 hover:border-[#E5B453] hover:bg-zinc-900'
                          }`}
                          title="點擊此處可快速調整折扣 (Discount Modifier)"
                        >
                          <span className="text-[9px] text-[#E5B453]/80 group-hover:text-[#E5B453] font-bold flex items-center justify-between font-sans">
                            <span>割引折扣 Discount ⚙️</span>
                            <span className="text-[8px] opacity-65">
                              {isAdjustingDiscount ? '調整中' : '點擊調整'}
                            </span>
                          </span>
                          <p className="font-mono text-xs text-rose-400 font-bold mt-0.5">
                            {cashierCalculatedTotals.discount > 0
                              ? `- NT$ ${cashierCalculatedTotals.discount}`
                              : 'NT$ 0'}
                          </p>
                        </div>
                        <div
                          onClick={() => {
                            setIsAdjustingSurcharge(!isAdjustingSurcharge);
                            setIsAdjustingDiscount(false);
                          }}
                          className={`text-left bg-black/20 p-2 border rounded-lg cursor-pointer transition active:scale-95 duration-100 group ${
                            isAdjustingSurcharge
                              ? 'border-blue-500 bg-zinc-900 shadow-lg'
                              : 'border-white/5 hover:border-blue-500 hover:bg-zinc-900'
                          }`}
                          title="點擊此處可快速調整加成 (Surcharge Modifier)"
                        >
                          <span className="text-[9px] text-[#4b9eff]/80 group-hover:text-blue-400 font-bold flex items-center justify-between font-sans">
                            <span>服務成加 Surcharge ⚙️</span>
                            <span className="text-[8px] opacity-65">
                              {isAdjustingSurcharge ? '調整中' : '點擊調整'}
                            </span>
                          </span>
                          <p className="font-mono text-xs text-blue-400 font-bold mt-0.5">
                            {cashierCalculatedTotals.surcharge > 0
                              ? `+ NT$ ${cashierCalculatedTotals.surcharge}`
                              : 'NT$ 0'}
                          </p>
                        </div>
                        <div className="text-left bg-[#1f1e1b] p-2 border border-amber-500/20 rounded-lg">
                          <span className="text-[9px] text-amber-500 font-bold">
                            總實收 Pay Total
                          </span>
                          <p className="font-mono text-sm text-[#E5B453] font-black mt-0.5">
                            NT$ {cashierCalculatedTotals.total}
                          </p>
                        </div>
                      </div>

                      {/* Interactive Drawer for Adjusting Discount or Surcharge */}
                      {(isAdjustingDiscount || isAdjustingSurcharge) && (
                        <div className="bg-zinc-950 border border-white/10 p-3.5 rounded-xl space-y-3.5 animate-fadeIn">
                          {isAdjustingDiscount && (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[#E5B453] flex items-center gap-1.5 font-sans">
                                  <span>🏷️ 調整折扣 Discount Modifier</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-[#E5B453]/25">
                                    {cashierDiscountType === 'percent'
                                      ? `${cashierDiscountRate}% OFF`
                                      : `折抵 NT$ ${cashierDiscountFlat}`}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsAdjustingDiscount(false)}
                                  className="text-[11px] font-bold text-zinc-400 hover:text-white px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 transition active:scale-95 cursor-pointer font-sans"
                                >
                                  確認帶入 Apply & Close
                                </button>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex bg-black p-0.5 rounded-xl border border-white/10 text-[11px] font-sans">
                                  <button
                                    type="button"
                                    onClick={() => setCashierDiscountType('percent')}
                                    className={`px-3.5 py-1.5 rounded-lg font-bold transition duration-150 cursor-pointer ${
                                      cashierDiscountType === 'percent'
                                        ? 'bg-[#E5B453] text-zinc-950 font-black'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    % 比例折扣
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCashierDiscountType('flat')}
                                    className={`px-3.5 py-1.5 rounded-lg font-bold transition duration-150 cursor-pointer ${
                                      cashierDiscountType === 'flat'
                                        ? 'bg-[#E5B453] text-zinc-950 font-black'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    $ 固定金額
                                  </button>
                                </div>

                                <div className="flex-1 relative flex items-center">
                                  <span className="absolute left-3 font-mono font-bold text-zinc-500 text-xs">
                                    {cashierDiscountType === 'percent' ? '%' : 'NT$'}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={
                                      cashierDiscountType === 'percent'
                                        ? 100
                                        : cashierSelectedOrder.subtotal
                                    }
                                    value={
                                      cashierDiscountType === 'percent'
                                        ? cashierDiscountRate || ''
                                        : cashierDiscountFlat || ''
                                    }
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      if (cashierDiscountType === 'percent') {
                                        setCashierDiscountRate(Math.min(100, val));
                                      } else {
                                        setCashierDiscountFlat(
                                          Math.min(cashierSelectedOrder.subtotal, val),
                                        );
                                      }
                                    }}
                                    className="w-full bg-[#121212] border border-white/10 focus:border-[#E5B453] rounded-xl py-1.5 px-3 pl-10 text-white font-mono text-sm font-black focus:outline-none transition"
                                    placeholder="輸入折扣 Enter value"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5 font-sans">
                                {cashierDiscountType === 'percent'
                                  ? [
                                      { val: 0, lbl: '免折 (0%)' },
                                      { val: 5, lbl: '95折 (5% OFF)' },
                                      { val: 10, lbl: '9折 (10% OFF)' },
                                      { val: 15, lbl: '85折 (15% OFF)' },
                                      { val: 20, lbl: '8折 (20% OFF)' },
                                      { val: 50, lbl: '半價 (50% OFF)' },
                                    ].map((btn) => (
                                      <button
                                        key={`summary-disc-${btn.val}`}
                                        type="button"
                                        onClick={() => setCashierDiscountRate(btn.val)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition cursor-pointer font-bold ${
                                          cashierDiscountRate === btn.val
                                            ? 'bg-[#E5B453]/20 text-[#E5B453] border-[#E5B453]/60 font-black scale-105 shadow-md shadow-amber-500/5'
                                            : 'bg-black/40 text-zinc-400 border-white/5 hover:border-white/25 hover:text-white'
                                        }`}
                                      >
                                        {btn.lbl}
                                      </button>
                                    ))
                                  : [
                                      { val: 0, lbl: '無 $0' },
                                      { val: 50, lbl: '折 $50' },
                                      { val: 100, lbl: '折 $100' },
                                      { val: 150, lbl: '折 $150' },
                                      { val: 200, lbl: '折 $200' },
                                      { val: 300, lbl: '折 $300' },
                                    ].map((btn) => (
                                      <button
                                        key={`summary-disc-flat-${btn.val}`}
                                        type="button"
                                        onClick={() => setCashierDiscountFlat(btn.val)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition cursor-pointer font-bold ${
                                          cashierDiscountFlat === btn.val
                                            ? 'bg-[#E5B453]/20 text-[#E5B453] border-[#E5B453]/60 font-black scale-105 shadow-md shadow-amber-500/5'
                                            : 'bg-black/40 text-zinc-400 border-white/5 hover:border-white/25 hover:text-white'
                                        }`}
                                      >
                                        {btn.lbl}
                                      </button>
                                    ))}
                              </div>
                            </div>
                          )}

                          {isAdjustingSurcharge && (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 font-sans">
                                  <span>📈 調整加成 Surcharge Modifier</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/25">
                                    {cashierSurchargeType === 'percent'
                                      ? `+ ${cashierSurchargeRate}%`
                                      : `加 NT$ ${cashierSurchargeFlat}`}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsAdjustingSurcharge(false)}
                                  className="text-[11px] font-bold text-zinc-400 hover:text-white px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 transition active:scale-95 cursor-pointer font-sans"
                                >
                                  確認帶入 Apply & Close
                                </button>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex bg-black p-0.5 rounded-xl border border-white/10 text-[11px] font-sans">
                                  <button
                                    type="button"
                                    onClick={() => setCashierSurchargeType('percent')}
                                    className={`px-3.5 py-1.5 rounded-lg font-bold transition duration-150 cursor-pointer ${
                                      cashierSurchargeType === 'percent'
                                        ? 'bg-blue-500 text-white font-black'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    % 比例加成
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCashierSurchargeType('flat')}
                                    className={`px-3.5 py-1.5 rounded-lg font-bold transition duration-150 cursor-pointer ${
                                      cashierSurchargeType === 'flat'
                                        ? 'bg-blue-500 text-white font-black'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    $ 固定加成
                                  </button>
                                </div>

                                <div className="flex-1 relative flex items-center">
                                  <span className="absolute left-3 font-mono font-bold text-zinc-500 text-xs">
                                    {cashierSurchargeType === 'percent' ? '%' : 'NT$'}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={
                                      cashierSurchargeType === 'percent'
                                        ? cashierSurchargeRate || ''
                                        : cashierSurchargeFlat || ''
                                    }
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      if (cashierSurchargeType === 'percent') {
                                        setCashierSurchargeRate(val);
                                      } else {
                                        setCashierSurchargeFlat(val);
                                      }
                                    }}
                                    className="w-full bg-[#121212] border border-white/10 focus:border-blue-500 rounded-xl py-1.5 px-3 pl-10 text-white font-mono text-sm font-black focus:outline-none transition"
                                    placeholder="輸入加成數值 Surcharge amt"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5 font-sans">
                                {cashierSurchargeType === 'percent'
                                  ? [
                                      { val: 0, lbl: '無加成 (0%)' },
                                      { val: 5, lbl: '5% 服務費' },
                                      { val: 10, lbl: '10% 服務費' },
                                      { val: 15, lbl: '15% 服務費' },
                                    ].map((btn) => (
                                      <button
                                        key={`summary-sur-${btn.val}`}
                                        type="button"
                                        onClick={() => setCashierSurchargeRate(btn.val)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition cursor-pointer font-bold ${
                                          cashierSurchargeRate === btn.val
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/60 font-black scale-105 shadow-md shadow-blue-500/5'
                                            : 'bg-black/40 text-zinc-400 border-white/5 hover:border-white/25 hover:text-white'
                                        }`}
                                      >
                                        {btn.lbl}
                                      </button>
                                    ))
                                  : [
                                      { val: 0, lbl: '無加值 $0' },
                                      { val: 10, lbl: '清潔費 $10' },
                                      { val: 30, lbl: '服務費 $30' },
                                      { val: 50, lbl: '包廂費 $50' },
                                      { val: 100, lbl: '特別加值 $100' },
                                    ].map((btn) => (
                                      <button
                                        key={`summary-sur-flat-${btn.val}`}
                                        type="button"
                                        onClick={() => setCashierSurchargeFlat(btn.val)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition cursor-pointer font-bold ${
                                          cashierSurchargeFlat === btn.val
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/60 font-black scale-105 shadow-md shadow-blue-500/5'
                                            : 'bg-black/40 text-zinc-400 border-white/5 hover:border-white/25 hover:text-white'
                                        }`}
                                      >
                                        {btn.lbl}
                                      </button>
                                    ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Giant Checkout Action Button */}
                      <div className="flex items-center space-x-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedCashierOrderId(null)}
                          className="px-4 py-2 border border-white/5 hover:bg-white/5 rounded-lg font-bold text-xs text-zinc-400 transition cursor-pointer active:scale-95"
                        >
                          放棄本單
                        </button>
                        <button
                          type="button"
                          id="cashier-submit-checkout-btn"
                          onClick={() => {
                            if (!cashierSelectedOrder) return;

                            // Perform validations before showing confirmation dialog
                            if (
                              cashierPaymentMethod === 'cash' &&
                              cashierCashReceived < cashierCalculatedTotals.total
                            ) {
                              alert(
                                `⚠️ 實收現金金額不足！實收 (NT$ ${cashierCashReceived}) 需大於或等於應收總額 (NT$ ${cashierCalculatedTotals.total})。`,
                              );
                              return;
                            }

                            if (cashierPaymentMethod === 'member') {
                              const dbStr = localStorage.getItem('google-members-database');
                              if (dbStr) {
                                try {
                                  const db = JSON.parse(dbStr);
                                  let vipEmail = '';
                                  if (cashierSelectedOrder?.customerName) {
                                    const matched = db.find(
                                      (m: any) => m.name === cashierSelectedOrder.customerName,
                                    );
                                    if (matched) {
                                      vipEmail = matched.email;
                                    }
                                  }
                                  const userIndex = db.findIndex((m: any) => m.email === vipEmail);
                                  if (userIndex >= 0) {
                                    const currentBal = db[userIndex].balance || 0;
                                    if (currentBal < cashierCalculatedTotals.total) {
                                      alert(
                                        `⚠️ 會員餘額不足 (剩餘: NT$ ${currentBal})！無法進行扣底結帳，請先在右側點選【儲值增額】。`,
                                      );
                                      return;
                                    }
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                            }

                            setShowCheckoutConfirm(true);
                          }}
                          className="flex-1 py-2 text-xs font-black text-slate-900 bg-[#E5B453] hover:bg-amber-400 active:scale-[0.98] transition shadow-md shadow-[#E5B453]/10 cursor-pointer rounded-lg flex items-center justify-center gap-1.5"
                        >
                          <Coins size={14} />
                          <span>
                            🎯 確認收銀並將桌號設為「已付清」 (NT$ {cashierCalculatedTotals.total})
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== MOVED RESERVATIONS & TABLE MANAGEMENT SECTION ==================== */}
            <div className="space-y-6 mt-6 border-t border-white/10 pt-6">
              {/* ==================== RESERVATIONS MANAGEMENT PANEL ==================== */}
              <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 text-left font-sans">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Calendar size={16} className="text-[#E5B453]" />
                    <h4 className="font-bold text-sm text-white font-serif tracking-wide">
                      🗓️ 餐廳預約訂位與客席保留管理系統
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={triggerAddReservationMode}
                    className="bg-[#E5B453] hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded text-xs transition font-extrabold cursor-pointer active:scale-95"
                  >
                    + 新增預約訂位 Add Reservation
                  </button>
                </div>

                <p className="text-white/40 text-[11px] leading-relaxed">
                  在此登錄顧客預訂之席次與日期。點選「帶位就座」後將自動與桌面狀態連動，將該客座設置為「用餐中（In
                  Use）」，以便服務流程追蹤與防範衝突。
                </p>

                {/* 🔍 預約狀態快速篩選 (Reservation Status Filter) */}
                <div className="bg-zinc-900/40 border border-white/5 p-3.5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[#E5B453] font-extrabold text-xs flex items-center gap-1.5">
                      <span>🔍 預約狀態快速篩選 (Status Filter):</span>
                    </span>
                    <p className="text-zinc-500 text-[10px]">
                      快速切換檢視「已確認 / 已就座」、「待確認」、「已完成」與「已取消」的預約
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { key: 'all', label: '🔍 全部預約 All' },
                      { key: 'pending', label: '⏳ 待確認' },
                      { key: 'upcoming', label: '⚡ 即將到來' },
                      { key: 'confirmed', label: '🟢 已確認' },
                      { key: 'seated', label: '🔵 已就座' },
                      { key: 'completed', label: '✅ 已完成 / 已結帳' },
                      { key: 'cancelled', label: '🔴 已取消' },
                    ].map((filter) => {
                      const count = (reservations || []).filter(
                        (r) => filter.key === 'all' || r.status === filter.key,
                      ).length;
                      return (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => setSelectedCalendarStatusFilter(filter.key)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                            selectedCalendarStatusFilter === filter.key
                              ? 'bg-[#E5B453] text-slate-950 border-[#E5B453] font-black shadow-md shadow-[#E5B453]/10'
                              : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>{filter.label}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                              selectedCalendarStatusFilter === filter.key
                                ? 'bg-slate-950/20 text-slate-950'
                                : 'bg-white/10 text-zinc-500'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const filteredListForBatch = (reservations || []).filter(
                    (r) =>
                      selectedCalendarStatusFilter === 'all' ||
                      r.status === selectedCalendarStatusFilter,
                  );
                  const filteredPendingList = filteredListForBatch.filter(
                    (r) => r.status === 'pending',
                  );
                  const isAllPendingSelected =
                    filteredPendingList.length > 0 &&
                    filteredPendingList.every((r) => selectedResIds.includes(r.id));
                  const isSomePendingSelected =
                    filteredPendingList.length > 0 &&
                    filteredPendingList.some((r) => selectedResIds.includes(r.id)) &&
                    !isAllPendingSelected;

                  return (
                    <div className="space-y-4">
                      {/* Batch Action Banner */}
                      {selectedResIds.length > 0 && (
                        <div className="bg-[#E5B453]/10 border border-[#E5B453]/30 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-fadeIn">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#E5B453] text-slate-950 text-[10px] font-black">
                              {selectedResIds.length}
                            </span>
                            <span className="text-xs text-[#E5B453] font-extrabold">
                              已選取 {selectedResIds.length} 筆「待確認」預約
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedResIds([])}
                              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded border border-white/10 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                            >
                              取消選擇 Deselect
                            </button>
                            <button
                              type="button"
                              disabled={isBatchProcessing}
                              onClick={async () => {
                                setIsBatchProcessing(true);
                                try {
                                  const selectedPendingRes = filteredPendingList.filter((r) =>
                                    selectedResIds.includes(r.id),
                                  );
                                  const promises = selectedPendingRes.map(async (res) => {
                                    if (onEditReservation) {
                                      await onEditReservation(res.id, { status: 'confirmed' });
                                    }
                                  });
                                  await Promise.all(promises);
                                  setSelectedResIds([]);
                                  setBatchSuccessMessage(
                                    `⚡ 成功批次預約確認 ${selectedPendingRes.length} 筆預約！`,
                                  );
                                  setTimeout(() => setBatchSuccessMessage(null), 4000);
                                } catch (err) {
                                  console.error(err);
                                } finally {
                                  setIsBatchProcessing(false);
                                }
                              }}
                              className="px-3.5 py-1.5 bg-[#E5B453] hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded font-black text-[11px] transition active:scale-95 cursor-pointer shadow-lg shadow-[#E5B453]/10 flex items-center gap-1.5"
                            >
                              {isBatchProcessing ? (
                                <>
                                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full" />
                                  <span>批次更新中...</span>
                                </>
                              ) : (
                                <>
                                  <span>⚡ 批次確認 (改為已就座) Batch Confirm</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Success Notification Alert */}
                      {batchSuccessMessage && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-emerald-400 font-bold text-xs flex items-center gap-2 animate-slideIn">
                          <span>✅</span>
                          <span>{batchSuccessMessage}</span>
                        </div>
                      )}

                      <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/15">
                        <table className="w-full text-xs text-zinc-300">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/5 text-zinc-400 font-bold text-[11px]">
                              <th className="p-3 text-center w-[50px] whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={isAllPendingSelected}
                                  ref={(el) => {
                                    if (el) {
                                      el.indeterminate = isSomePendingSelected;
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const newIds = [...selectedResIds];
                                      filteredPendingList.forEach((r) => {
                                        if (!newIds.includes(r.id)) {
                                          newIds.push(r.id);
                                        }
                                      });
                                      setSelectedResIds(newIds);
                                    } else {
                                      const pendingIds = filteredPendingList.map((r) => r.id);
                                      setSelectedResIds((prev) =>
                                        prev.filter((id) => !pendingIds.includes(id)),
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-zinc-700 bg-black/40 text-[#E5B453] focus:ring-[#E5B453] cursor-pointer"
                                  title="全選待確認預約 (Select All Pending)"
                                />
                              </th>
                              <th className="p-3 text-left min-w-[140px]">預約顧客</th>
                              <th className="p-3 text-left min-w-[120px] whitespace-nowrap">
                                預約時間
                              </th>
                              <th className="p-3 text-left min-w-[100px] whitespace-nowrap">
                                指定桌號
                              </th>
                              <th className="p-3 text-left min-w-[100px] whitespace-nowrap">
                                用餐人數
                              </th>
                              <th className="p-3 text-left min-w-[160px]">備註 / 需求</th>
                              <th className="p-3 text-left min-w-[120px] whitespace-nowrap">
                                狀態
                              </th>
                              <th className="p-3 text-center min-w-[160px] whitespace-nowrap">
                                操作面板
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {(() => {
                              if (filteredListForBatch.length === 0) {
                                return (
                                  <tr>
                                    <td
                                      colSpan={8}
                                      className="p-6 text-center text-zinc-500 font-medium font-sans animate-fadeIn"
                                    >
                                      {selectedCalendarStatusFilter === 'all'
                                        ? '目前尚無存檔之顧客預訂記錄。您可以點選上方按鈕新增第一筆預訂！'
                                        : `目前尚無符合「${
                                            selectedCalendarStatusFilter === 'pending'
                                              ? '待確認'
                                              : selectedCalendarStatusFilter === 'upcoming'
                                                ? '即將到來'
                                                : selectedCalendarStatusFilter === 'seated'
                                                  ? '已確認/已就座'
                                                  : selectedCalendarStatusFilter === 'completed'
                                                    ? '已完成/已結帳'
                                                    : '已取消'
                                          }」狀態的預約。`}
                                    </td>
                                  </tr>
                                );
                              }
                              return filteredListForBatch
                                .sort((a, b) => {
                                  const dateCompare = a.date.localeCompare(b.date);
                                  if (dateCompare !== 0) return dateCompare;
                                  return a.time.localeCompare(b.time);
                                })
                                .map((res) => (
                                  <tr key={res.id} className="hover:bg-white/5 transition">
                                    <td className="p-3 text-center w-[50px] whitespace-nowrap">
                                      {res.status === 'pending' ? (
                                        <input
                                          type="checkbox"
                                          checked={selectedResIds.includes(res.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedResIds((prev) => [...prev, res.id]);
                                            } else {
                                              setSelectedResIds((prev) =>
                                                prev.filter((id) => id !== res.id),
                                              );
                                            }
                                          }}
                                          className="w-4 h-4 rounded border-zinc-700 bg-black/40 text-[#E5B453] focus:ring-[#E5B453] cursor-pointer"
                                        />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          disabled
                                          checked={false}
                                          className="w-4 h-4 rounded border-zinc-800 bg-zinc-900/20 text-zinc-650 opacity-20 cursor-not-allowed"
                                          title="此預約已確認或已結帳/取消，無法批次選取"
                                        />
                                      )}
                                    </td>
                                    <td className="p-3 min-w-[140px]">
                                      <span className="font-bold text-white block">
                                        {res.customerName}
                                      </span>
                                      <span className="text-[10px] text-zinc-500 font-mono">
                                        {res.phone}
                                      </span>
                                    </td>
                                    <td className="p-3 min-w-[120px] whitespace-nowrap">
                                      <span className="text-white block font-semibold">
                                        {res.date}
                                      </span>
                                      <span className="text-[10px] text-[#E5B453] font-mono font-bold bg-[#E5B453]/10 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                                        {res.time}
                                      </span>
                                    </td>
                                    <td className="p-3 min-w-[100px] whitespace-nowrap">
                                      <span className="font-bold text-white bg-slate-800 border border-slate-700 px-2 py-0.5 rounded font-mono">
                                        {res.tableNumber} 桌
                                      </span>
                                    </td>
                                    <td className="p-3 min-w-[100px] whitespace-nowrap">
                                      <span className="font-extrabold font-mono text-white text-sm">
                                        {res.guestCount}{' '}
                                      </span>
                                      人
                                    </td>
                                    <td
                                      className="p-3 min-w-[160px] max-w-xs truncate"
                                      title={res.notes}
                                    >
                                      <span className="text-zinc-400">
                                        {res.notes || '無特殊需求'}
                                      </span>
                                    </td>
                                    <td className="p-3 min-w-[120px] whitespace-nowrap">
                                      {res.status === 'pending' && (
                                        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-sans font-bold text-[10px] inline-block">
                                          ⏳ 待確認 Pending
                                        </span>
                                      )}
                                      {res.status === 'confirmed' && (
                                        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-sans font-bold text-[10px] inline-block">
                                          🟢 已確認 Confirmed
                                        </span>
                                      )}
                                      {res.status === 'upcoming' && (
                                        <span className="bg-rose-500/15 border border-rose-550/30 text-rose-400 px-2 py-0.5 rounded-md font-sans font-extrabold text-[10px] inline-block animate-pulse">
                                          ⚡ 即將到來 Upcoming
                                        </span>
                                      )}
                                      {res.status === 'seated' && (
                                        <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md font-sans font-bold text-[10px] inline-block">
                                          🔵 已就座 Seated
                                        </span>
                                      )}
                                      {res.status === 'completed' && (
                                        <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-md font-sans font-bold text-[10px] inline-block">
                                          ✅ 已結帳 Completed
                                        </span>
                                      )}
                                      {res.status === 'cancelled' && (
                                        <span className="bg-rose-500/10 border border-rose-500/20 text-rose-450 px-2 py-0.5 rounded-md font-sans font-bold text-[10px] inline-block">
                                          🔴 已取消 Cancelled
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 min-w-[160px] text-center">
                                      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
                                        {(res.status === 'pending' ||
                                          res.status === 'confirmed' ||
                                          res.status === 'upcoming') && (
                                          <>
                                            {res.status === 'pending' && (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  if (onEditReservation) {
                                                    await onEditReservation(res.id, {
                                                      status: 'confirmed',
                                                    });
                                                  }
                                                }}
                                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded transition active:scale-90 cursor-pointer"
                                              >
                                                ✔ 預約確認
                                              </button>
                                            )}
                                            {(() => {
                                              if (
                                                res.status !== 'confirmed' &&
                                                res.status !== 'upcoming'
                                              )
                                                return null;
                                              const [year, month, day] = res.date
                                                .split('-')
                                                .map(Number);
                                              const [hour, minute] = res.time
                                                .split(':')
                                                .map(Number);
                                              const resDateTime = new Date(
                                                year,
                                                month - 1,
                                                day,
                                                hour,
                                                minute,
                                              );
                                              const diffMinutes =
                                                (resDateTime.getTime() - Date.now()) / (1000 * 60);

                                              if (diffMinutes <= 20) {
                                                return (
                                                  <button
                                                    type="button"
                                                    onClick={async () => {
                                                      if (onEditReservation) {
                                                        await onEditReservation(res.id, {
                                                          status: 'seated',
                                                        });
                                                      }
                                                      if (onUpdateTableStatus) {
                                                        await onUpdateTableStatus(res.tableNumber, {
                                                          status: 'in_use',
                                                          preservedFor: '',
                                                        });
                                                      }
                                                    }}
                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded transition active:scale-90 cursor-pointer"
                                                  >
                                                    💡 帶位就座
                                                  </button>
                                                );
                                              }
                                              return null;
                                            })()}
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                if (onEditReservation) {
                                                  await onEditReservation(res.id, {
                                                    status: 'cancelled',
                                                  });
                                                }
                                                const targetTableObj = tables.find(
                                                  (t) => t.id === res.tableNumber,
                                                );
                                                if (
                                                  targetTableObj &&
                                                  targetTableObj.status === 'preserved' &&
                                                  onUpdateTableStatus
                                                ) {
                                                  await onUpdateTableStatus(res.tableNumber, {
                                                    status: 'available',
                                                    preservedFor: '',
                                                  });
                                                }
                                              }}
                                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition active:scale-90 cursor-pointer"
                                            >
                                              取消預約
                                            </button>
                                          </>
                                        )}
                                        {res.status === 'seated' && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (onEditReservation) {
                                                await onEditReservation(res.id, {
                                                  status: 'completed',
                                                });
                                              }
                                              if (onUpdateTableStatus && res.tableNumber) {
                                                await onUpdateTableStatus(res.tableNumber, {
                                                  status: 'available',
                                                  preservedFor: '',
                                                });
                                              }
                                            }}
                                            className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded transition active:scale-90 cursor-pointer"
                                          >
                                            ✅ 完成結帳
                                          </button>
                                        )}
                                        {reservationToDeleteId === res.id ? (
                                          <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 p-1.5 rounded-lg shrink-0">
                                            <span className="text-rose-455 font-bold block shrink-0 text-[10px]">
                                              確認刪除？
                                            </span>
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const targetTable = res.tableNumber;
                                                if (onDeleteReservation) {
                                                  await onDeleteReservation(res.id);
                                                }
                                                if (targetTable && onUpdateTableStatus) {
                                                  await onUpdateTableStatus(targetTable, {
                                                    status: 'available',
                                                    preservedFor: '',
                                                  });
                                                }
                                                setReservationToDeleteId(null);
                                              }}
                                              className="text-white bg-rose-600 hover:bg-rose-500 font-bold font-sans text-[10px] px-2 py-0.5 rounded cursor-pointer leading-tight active:scale-90 transition"
                                            >
                                              確定
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setReservationToDeleteId(null)}
                                              className="text-zinc-300 hover:text-white bg-white/10 font-sans text-[10px] px-2 py-0.5 rounded cursor-pointer leading-tight active:scale-90 transition"
                                            >
                                              取消
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => triggerEditReservationMode(res)}
                                              className="px-1.5 py-1 bg-[#E5B453]/10 hover:bg-[#E5B453] hover:text-[#0C0C0C] text-[#E5B453] rounded border border-[#E5B453]/20 transition active:scale-90 cursor-pointer"
                                            >
                                              編輯
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setReservationToDeleteId(res.id)}
                                              className="px-1.5 py-1 bg-rose-600/10 hover:bg-rose-600 text-rose-450 hover:text-white rounded border border-rose-500/20 transition active:scale-90 cursor-pointer"
                                            >
                                              刪除
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ==================== TABLE CONFIGURATION PANEL ==================== */}
              <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 text-left">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <QrCode size={15} className="text-[#E5B453]" />
                    <h4 className="font-bold text-sm">🥢 餐廳客用桌席與 QR Code 連結設定</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTableObj(null);
                      setTableIdInput('');
                      setTableQrUrlInput('');
                      setTableMaxCapacityInput('');
                      setTableError(null);
                      setTableSuccess(null);
                      setIsTableFormOpen(true);
                    }}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-2.5 py-1.5 rounded text-xs transition font-extrabold cursor-pointer"
                  >
                    新增桌次定位 Add
                  </button>
                </div>

                {/* Table View Layout Mode Selector */}
                <div className="flex items-center justify-between bg-black/45 border border-white/5 p-1 rounded-xl max-w-md">
                  <button
                    type="button"
                    onClick={() => setTableLayoutMode('floormap')}
                    className={`flex-1 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      tableLayoutMode === 'floormap'
                        ? 'bg-[#E5B453] text-[#0C0C0C] font-extrabold shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>🗺️ 餐廳平面排桌圖 Floor Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableLayoutMode('grid')}
                    className={`flex-1 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      tableLayoutMode === 'grid'
                        ? 'bg-[#E5B453] text-[#0C0C0C] font-extrabold shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>📋 傳統卡片列表 Grid View</span>
                  </button>
                </div>

                {/* 1. Floor Map Graphical Visualizer */}
                {tableLayoutMode === 'floormap' && (
                  <div className="space-y-4 animate-fadeIn">
                    <p className="text-[11px] text-zinc-400 leading-relaxed bg-[#202020]/40 p-3 rounded-lg border border-white/5">
                      💡 <strong>直覺拖曳排桌模式 (Drag & Drop Floor Map)</strong>：您可以直接
                      <strong>游標拖曳</strong>
                      任一客桌至理想位置，來模擬餐廳實際的室內格局。若是行動觸控裝置，可先點選欲調整的客桌，再直接在平面圖下方使用「微調定位方向鈕」進行精確對位。系統將會即時自動保存配置。
                    </p>

                    {/* 🔒 桌席位置鎖定與確認調整狀態欄 */}
                    <div
                      className="flex flex-col sm:flex-row items-center gap-4 bg-[#1b1a16] border border-[#E5B453]/25 p-4 rounded-xl justify-between"
                      id="table-layout-lock-bar"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${isTableLayoutLocked ? 'bg-zinc-800 text-zinc-400' : 'bg-[#E5B453]/10 text-[#E5B453] animate-pulse'}`}
                        >
                          {isTableLayoutLocked ? <Lock size={18} /> : <Unlock size={18} />}
                        </div>
                        <div className="text-left font-sans">
                          <span className="text-[10px] font-bold text-[#E5B453] tracking-wider block uppercase">
                            桌席排列位置安全保護 Table Placement Security
                          </span>
                          <span className="text-xs font-extrabold text-white">
                            {isTableLayoutLocked
                              ? '🔒 桌席位置已確認鎖定 (Locked)'
                              : '🔓 啟用桌席編排與位置調整中 (Adjusting)'}
                          </span>
                          <span className="text-[10.5px] text-zinc-400 block mt-0.5">
                            {isTableLayoutLocked
                              ? '系統已鎖定位置，無法移動桌席。防止前台日常或收銀操作及點餐時誤觸。'
                              : '系統處於解鎖狀態，您可以直接拖曳任何桌子，或利用下方方向鍵精細微調定位。'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                        {isTableLayoutLocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTableLayoutLocked(false);
                              localStorage.setItem('table-layout-locked', 'false');
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold rounded-lg text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border border-white/10"
                          >
                            <Unlock size={13} className="text-[#E5B453]" />
                            <span>⚙️ 啟動調整 (Unlock Layout)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTableLayoutLocked(true);
                              localStorage.setItem('table-layout-locked', 'true');
                              setSelectedFineTuneTableId(null);
                              alert(
                                '✅ 桌席位置已確認儲存，並安全鎖定！日常操作中將防誤觸、不可再隨意拖曳更改。',
                              );
                            }}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-lg text-xs shadow-md shadow-emerald-900/10 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Check size={13} />
                            <span>💾 確認桌席編排（鎖定防誤觸）</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grid Alignment Options */}
                    <div className="flex flex-wrap items-center gap-4 bg-[#202020]/20 border border-white/5 p-3 rounded-xl justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          📏 網格對齊 (Snap to Grid)
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          啟用後拖曳桌席會自動對齊至最近格點
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-zinc-300 font-medium cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={snapToGrid}
                            onChange={(e) => setSnapToGrid(e.target.checked)}
                            className="accent-[#E5B453] w-4 h-4 rounded border-zinc-700 bg-zinc-800"
                          />
                          <span>啟用網格對齊</span>
                        </label>
                        {snapToGrid && (
                          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-zinc-500">網格尺寸:</span>
                            <select
                              value={gridSize}
                              onChange={(e) => setGridSize(Number(e.target.value))}
                              className="bg-[#1a1a1a] text-xs text-[#E5B453] font-mono border-0 p-1 rounded focus:ring-0 cursor-pointer"
                            >
                              <option value={2}>2%</option>
                              <option value={5}>5% (預設)</option>
                              <option value={8}>8%</option>
                              <option value={10}>10%</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 🎫 Real-time Table Status visual legend and counts */}
                    <div
                      className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-zinc-950/40 p-3 rounded-xl border border-white/5 text-xs text-left"
                      id="table-status-legend-bar"
                    >
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>🟢 空桌 Empty</span>
                        </div>
                        <span className="text-lg font-black text-white mt-1">
                          {tables.filter((t) => !t.status || t.status === 'available').length}{' '}
                          <span className="text-[10px] font-medium text-emerald-500/60">桌</span>
                        </span>
                      </div>
                      <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-sky-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-550 bg-sky-500 shrink-0 animate-pulse" />
                          <span>🔵 已入座 Seated</span>
                        </div>
                        <span className="text-lg font-black text-white mt-1">
                          {tables.filter((t) => t.status === 'in_use').length}{' '}
                          <span className="text-[10px] font-medium text-sky-500/60">桌</span>
                        </span>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-amber-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                          <span>🟡 待結帳 Unpaid</span>
                        </div>
                        <span className="text-lg font-black text-white mt-1">
                          {tables.filter((t) => t.status === 'pending_checkout').length}{' '}
                          <span className="text-[10px] font-medium text-amber-500/60">桌</span>
                        </span>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2.5 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-rose-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                          <span>🔴 清潔中 Cleaning</span>
                        </div>
                        <span className="text-lg font-black text-white mt-1">
                          {tables.filter((t) => t.status === 'cleaning').length}{' '}
                          <span className="text-[10px] font-medium text-rose-500/60">桌</span>
                        </span>
                      </div>
                      <div className="bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg p-2.5 flex flex-col justify-between col-span-2 sm:col-span-1 border-dashed">
                        <div className="flex items-center gap-1.5 font-bold text-fuchsia-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shrink-0 animate-pulse" />
                          <span>🟣 預約保留 Reserved</span>
                        </div>
                        <span className="text-lg font-black text-white mt-1">
                          {tables.filter((t) => t.status === 'preserved').length}{' '}
                          <span className="text-[10px] font-medium text-fuchsia-500/60">桌</span>
                        </span>
                      </div>
                    </div>

                    {/* Map Container */}
                    <div
                      id="floor-map-container"
                      className="relative w-full h-[450px] bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden shadow-inner flex flex-col justify-between"
                      style={{
                        backgroundImage:
                          'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
                        backgroundSize: snapToGrid ? `${gridSize}% ${gridSize}%` : '24px 24px',
                      }}
                    >
                      {/* Floor layout structural reference tags */}
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-zinc-900/80 border border-white/5 rounded-full text-[9px] font-mono font-bold tracking-[0.15em] text-zinc-500 uppercase select-none flex items-center gap-1">
                        📴 外場主候位客席區 (Main Dining Hall)
                      </div>

                      {/* Visual Kitchen boundary wall decoration */}
                      <div className="absolute bottom-0 right-0 w-[180px] h-[100px] bg-zinc-900/40 border-l border-t border-dashed border-white/10 rounded-tl-xl p-3 flex flex-col justify-end select-none pointer-events-none">
                        <span className="text-[10px] font-extrabold tracking-widest text-zinc-500">
                          🍳 出餐廚房 KITCHEN
                        </span>
                        <span className="text-[8px] text-zinc-650 text-zinc-500 font-mono">
                          KDS Service Area
                        </span>
                      </div>

                      {/* Visual Entrance Area */}
                      <div className="absolute top-0 left-0 w-[150px] h-[60px] bg-zinc-900/20 border-r border-b border-dashed border-white/10 rounded-br-xl p-2.5 flex flex-col justify-start select-none pointer-events-none">
                        <span className="text-[9px] font-extrabold tracking-widest text-[#E5B453]/60">
                          🚪 餐廳正門 ENTRANCE
                        </span>
                        <span className="text-[8px] text-zinc-600 font-mono">
                          櫃檯買單區 Reception
                        </span>
                      </div>

                      {/* Map Surface containing tables */}
                      <div className="absolute inset-0 select-none">
                        {tables.map((tb) => {
                          const posX =
                            localTablePositions[tb.id]?.x !== undefined
                              ? localTablePositions[tb.id].x
                              : tb.positionX || 10;
                          const posY =
                            localTablePositions[tb.id]?.y !== undefined
                              ? localTablePositions[tb.id].y
                              : tb.positionY || 10;

                          // Determine status highlight color based on customer's exact colors
                          let statusColorClass =
                            'border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20';
                          let iconLabel = '🟢 空桌';
                          if (tb.status === 'in_use') {
                            statusColorClass =
                              'border-sky-500 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20';
                            iconLabel = '🔵 已入座';
                          } else if (tb.status === 'pending_checkout') {
                            statusColorClass =
                              'border-amber-500 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 animate-pulse';
                            iconLabel = '🟡 待結帳';
                          } else if (tb.status === 'cleaning') {
                            statusColorClass =
                              'border-rose-500 bg-rose-500/15 text-rose-450 hover:bg-rose-500/25';
                            iconLabel = '🔴 清潔中';
                          } else if (tb.status === 'preserved') {
                            statusColorClass =
                              'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-400 hover:bg-fuchsia-500/25';
                            iconLabel = '🟣 預約預訂';
                          }

                          const isSelectedForFineTune = selectedFineTuneTableId === tb.id;

                          return (
                            <div
                              key={tb.id}
                              onMouseDown={(e) => {
                                setSelectedFineTuneTableId(tb.id);
                                handleTableMouseDown(e, tb.id);
                              }}
                              onTouchStart={(e) => {
                                setSelectedFineTuneTableId(tb.id);
                                handleTableTouchStart(e, tb.id);
                              }}
                              onClick={() => setSelectedFineTuneTableId(tb.id)}
                              className={`absolute rounded-xl border-2 p-3 font-sans transition-all duration-75 flex flex-col justify-between select-none shadow-lg min-w-[110px] min-h-[90px] ${statusColorClass} ${
                                isTableLayoutLocked
                                  ? 'cursor-pointer hover:border-white/20'
                                  : 'cursor-move border-dashed hover:scale-[1.02] border-[#E5B453]/50 animate-pulse'
                              } ${
                                isSelectedForFineTune
                                  ? 'ring-2 ring-[#E5B453] border-[#E5B453] shadow-md scale-102'
                                  : ''
                              }`}
                              style={{
                                left: `${posX}%`,
                                top: `${posY}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-black text-xs text-white shrink-0">
                                    🥢 {tb.id} 桌
                                  </span>
                                  <span className="text-[8px] font-mono text-zinc-500">
                                    T-{tb.id}
                                  </span>
                                </div>
                                <div className="text-[10px] font-bold mt-1 text-left">
                                  {tb.status === 'preserved' ? (
                                    <span
                                      className="text-fuchsia-300 line-clamp-1"
                                      title={tb.preservedFor || ''}
                                    >
                                      👤 {tb.preservedFor || '已預約'}
                                    </span>
                                  ) : tb.status === 'in_use' ? (
                                    <span className="text-sky-300 font-extrabold font-sans">
                                      💙 已入座用餐
                                    </span>
                                  ) : tb.status === 'pending_checkout' ? (
                                    <span className="text-amber-300 font-black font-sans">
                                      💵 顧客待結帳
                                    </span>
                                  ) : tb.status === 'cleaning' ? (
                                    <span className="text-rose-400 font-black font-sans">
                                      🧹 收拾清潔中
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400/80 font-medium font-sans">
                                      🟢 可入座空桌
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[8px] font-semibold border-t border-white/5 pt-1 mt-1.5">
                                <span>{iconLabel}</span>
                                {tb.mergedWith && (
                                  <span
                                    className="bg-sky-500 text-white px-1 rounded-sm text-[7px]"
                                    title={`已與 ${tb.mergedWith} 桌併桌`}
                                  >
                                    併 {tb.mergedWith}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Touch & Fine-Tuning direction keys */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#202020]/20 border border-white/5 p-4 rounded-xl">
                      <div className="space-y-1.5 text-left w-full sm:w-auto">
                        <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                          🛠️ 觸控裝置定位與微調面板 (Selected Table Control)
                        </span>
                        <p className="text-[11px] text-zinc-400">
                          目前選取：
                          <strong>
                            {selectedFineTuneTableId
                              ? `🥢 餐廳 ${selectedFineTuneTableId} 桌`
                              : '💡 (請先在平面圖中點選任意桌次)'}
                          </strong>
                        </p>
                        {selectedFineTuneTableId && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                const tbl = tables.find((t) => t.id === selectedFineTuneTableId);
                                if (tbl && onUpdateTableStatus) {
                                  // Complete cycle: 空桌available(綠) -> 入座in_use(藍) -> 待結帳pending_checkout(黃) -> 清潔中cleaning(紅) -> 預約preserved(紫)
                                  const statusOrder: (
                                    | 'available'
                                    | 'in_use'
                                    | 'pending_checkout'
                                    | 'cleaning'
                                    | 'preserved'
                                  )[] = [
                                    'available',
                                    'in_use',
                                    'pending_checkout',
                                    'cleaning',
                                    'preserved',
                                  ];
                                  const currentIndex = statusOrder.indexOf(
                                    tbl.status || 'available',
                                  );
                                  const nextIndex = (currentIndex + 1) % statusOrder.length;
                                  const nextStatus = statusOrder[nextIndex];

                                  let presName = tbl.preservedFor || '';
                                  if (nextStatus === 'preserved' && !presName) {
                                    const ans = prompt(
                                      '請輸入預約保留顧客姓名 (Preserved Customer Name)：',
                                    );
                                    if (ans) presName = ans.trim();
                                  }
                                  await onUpdateTableStatus(selectedFineTuneTableId, {
                                    status: nextStatus,
                                    preservedFor: nextStatus === 'preserved' ? presName : '',
                                  });
                                }
                              }}
                              className="px-2.5 py-1 text-[10px] bg-[#E5B453]/10 hover:bg-[#E5B453] hover:text-black text-[#E5B453] rounded font-bold border border-[#E5B453]/20 transition cursor-pointer"
                            >
                              🔄 快速切換狀態 (Cycle Status)
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const tbl = tables.find((t) => t.id === selectedFineTuneTableId);
                                const name = prompt(
                                  '更改客席保留/預約姓名 (Preserved Name)：',
                                  tbl?.preservedFor || '',
                                );
                                if (name !== null && onUpdateTableStatus) {
                                  await onUpdateTableStatus(selectedFineTuneTableId, {
                                    preservedFor: name.trim(),
                                  });
                                }
                              }}
                              className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white rounded font-bold border border-white/10 transition cursor-pointer"
                            >
                              👤 編輯保留姓名
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Direction cross button pad */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-500 hidden md:block">
                          方向微調:
                        </span>
                        <div className="relative w-28 h-24 bg-black/40 rounded-xl border border-white/5 flex items-center justify-center shrink-0">
                          <button
                            type="button"
                            disabled={!selectedFineTuneTableId}
                            onClick={() => handleFineTunePosition(0, -3)}
                            className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-white font-bold flex items-center justify-center cursor-pointer text-xs leading-none"
                            title="向上移動"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={!selectedFineTuneTableId}
                            onClick={() => handleFineTunePosition(-3, 0)}
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-white font-bold flex items-center justify-center cursor-pointer text-xs leading-none"
                            title="向左移動"
                          >
                            ◀
                          </button>
                          <div className="w-6 h-6 rounded-full bg-[#E5B453]/10 border border-[#E5B453]/20 flex items-center justify-center text-[8px] text-[#E5B453] font-mono uppercase">
                            XY
                          </div>
                          <button
                            type="button"
                            disabled={!selectedFineTuneTableId}
                            onClick={() => handleFineTunePosition(3, 0)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-white font-bold flex items-center justify-center cursor-pointer text-xs leading-none"
                            title="向右移動"
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            disabled={!selectedFineTuneTableId}
                            onClick={() => handleFineTunePosition(0, 3)}
                            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-7 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-white font-bold flex items-center justify-center cursor-pointer text-xs leading-none"
                            title="向下移動"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Traditional Grid List of Tables details */}
                {tableLayoutMode === 'grid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                    {tables.map((tb) => (
                      <div
                        key={tb.id}
                        className="p-4 bg-black/35 border border-white/10 rounded-xl flex flex-col justify-between space-y-3.5 shadow-md hover:border-[#E5B453]/25 transition text-left"
                      >
                        <div className="space-y-2.5">
                          <p className="font-extrabold text-white text-sm flex items-center justify-between">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span>🥢 {tb.id} 桌</span>
                              {(tb.status === 'available' || !tb.status) && (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-550/20 font-sans text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  空閒中
                                </span>
                              )}
                              {tb.status === 'in_use' && (
                                <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 font-sans text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  已入座
                                </span>
                              )}
                              {tb.status === 'pending_checkout' && (
                                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-sans text-[8px] font-extrabold px-1.5 py-0.5 rounded animate-pulse">
                                  待結帳
                                </span>
                              )}
                              {tb.status === 'cleaning' && (
                                <span className="bg-rose-500/10 text-rose-450 border border-rose-500/20 font-sans text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  清潔中
                                </span>
                              )}
                              {tb.status === 'preserved' && (
                                <span className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 font-sans text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  預訂保留
                                </span>
                              )}
                              {tb.mergedWith && (
                                <span className="bg-sky-500 text-white font-sans text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  併至 {tb.mergedWith} 桌
                                </span>
                              )}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-500">
                              Table {tb.id}
                            </span>
                          </p>

                          {/* Display state context helpers */}
                          <div className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                            {tb.status === 'in_use' ? (
                              <span className="text-sky-300 font-medium">💙 已帶位/用餐中</span>
                            ) : tb.status === 'pending_checkout' ? (
                              <span className="text-amber-400 font-bold">💵 帳單待結清</span>
                            ) : tb.status === 'cleaning' ? (
                              <span className="text-rose-450 text-rose-400 font-medium">
                                🧹 待翻洗/整理中
                              </span>
                            ) : tb.status === 'preserved' ? (
                              <span className="text-fuchsia-300 font-medium">
                                👤 保留：{tb.preservedFor || '預訂客戶'}
                              </span>
                            ) : (
                              <span className="text-emerald-400">🟢 空閒可接待</span>
                            )}
                          </div>

                          {/* Interactive Occupancy Select */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 font-bold block">
                              客座狀態設定:
                            </span>
                            <select
                              value={tb.status || 'available'}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                let newPresName = tb.preservedFor || '';
                                if (newStatus === 'preserved' && !newPresName) {
                                  const ans = prompt('請輸入預約保留顧客姓名 (Preserved Name)：');
                                  if (ans !== null && ans.trim()) {
                                    newPresName = ans.trim();
                                  }
                                }
                                if (onUpdateTableStatus) {
                                  await onUpdateTableStatus(tb.id, {
                                    status: newStatus,
                                    preservedFor: newStatus === 'preserved' ? newPresName : '',
                                  });
                                }
                              }}
                              className="w-full bg-[#1a1a1a] border border-white/10 rounded bg-[#1e1e1e] text-white text-[11px] h-7 px-1.5 cursor-pointer outline-none focus:border-amber-400 text-xs"
                            >
                              <option value="available">🟢 空桌 Available (可帶位)</option>
                              <option value="in_use">🔵 入座 Occupied (已入座)</option>
                              <option value="pending_checkout">
                                🟡 待結帳 Pending Unpaid (未付)
                              </option>
                              <option value="cleaning">🔴 清潔中 Cleaning (收拾中)</option>
                              <option value="preserved">🟣 預約保留 Preserved (預約中)</option>
                            </select>

                            {tb.status === 'preserved' && (
                              <div className="flex items-center gap-1.5 mt-1 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">
                                <span className="text-[9px] text-rose-400 font-bold shrink-0">
                                  保留姓名:
                                </span>
                                <input
                                  type="text"
                                  value={tb.preservedFor || ''}
                                  placeholder="請輸入姓名"
                                  onChange={async (e) => {
                                    if (onUpdateTableStatus) {
                                      await onUpdateTableStatus(tb.id, {
                                        preservedFor: e.target.value,
                                      });
                                    }
                                  }}
                                  className="bg-transparent border-none text-white text-[10px] p-0 font-bold focus:ring-0 w-full font-sans"
                                />
                              </div>
                            )}
                          </div>

                          {/* Interactive Merging Select */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 font-bold block">
                              合併桌位 (併桌):
                            </span>
                            <select
                              value={tb.mergedWith || ''}
                              onChange={async (e) => {
                                const targetMerge = e.target.value;
                                if (onUpdateTableStatus) {
                                  await onUpdateTableStatus(tb.id, { mergedWith: targetMerge });
                                }
                              }}
                              className="w-full bg-[#1a1a1a] border border-white/10 rounded bg-[#1e1e1e] text-white text-[11px] h-7 px-1.5 cursor-pointer outline-none focus:border-amber-400"
                            >
                              <option value="">🔗 獨立（不合併）</option>
                              {tables
                                .filter((other) => other.id !== tb.id)
                                .map((other) => (
                                  <option key={other.id} value={other.id}>
                                    併帳至 ➔ {other.id} 桌
                                  </option>
                                ))}
                            </select>
                          </div>

                          <p
                            className="text-[9px] min-[360px]:text-[10px] text-zinc-400 break-all bg-black/40 p-2 rounded-lg border border-white/5 font-mono max-h-12 overflow-y-auto scrollbar-none"
                            title={tb.qrCodeUrl}
                          >
                            <span className="text-zinc-600 font-sans block text-[9px] mb-0.5">
                              桌位 QR 連結:
                            </span>
                            {tb.qrCodeUrl || '無設定連結'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                          {tableToDeleteId === tb.id ? (
                            <div className="flex flex-wrap items-center justify-between gap-1.5 w-full bg-rose-500/10 border border-rose-500/20 p-1.5 rounded-lg">
                              <span className="text-rose-450 font-bold text-[10px] shrink-0 text-rose-400">
                                確定刪除？
                              </span>
                              <div className="flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteTable(tb.id);
                                    setTableToDeleteId(null);
                                  }}
                                  className="text-white bg-rose-600 hover:bg-rose-500 font-bold font-sans text-[10px] px-2.5 py-1 rounded cursor-pointer leading-none h-6 active:scale-90 transition"
                                >
                                  確定
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTableToDeleteId(null)}
                                  className="text-zinc-300 hover:text-white bg-white/10 font-sans text-[10px] px-2.5 py-1 rounded cursor-pointer leading-none h-6 active:scale-90 transition"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => triggerEditTableMode(tb)}
                                className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-[#E5B453] hover:text-[#0C0C0C] text-[#E5B453] border border-amber-500/20 rounded-lg transition active:scale-95 text-[11px] font-bold cursor-pointer"
                                title="編輯桌次 QR 碼"
                              >
                                <Edit size={11} />
                                <span>編輯</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTableToDeleteId(tb.id)}
                                className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 rounded-lg transition active:scale-95 text-[11px] font-bold cursor-pointer"
                                title="刪除"
                              >
                                <Trash2 size={11} />
                                <span>刪除</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: ACCOUNTING LOG CHART & SINGLE DRILLDOWN ==================== */}
      {activeSubTab === 'orders' && (
        <div className="space-y-6 animate-fadeIn text-left" id="subtab-section-orders">
          {/* Preset Buttons & Advanced Filters */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-3">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white font-serif">
                  💳 營業核數、點單明細與自訂統計查詢
                </h4>
                <p className="text-white/40 text-xs font-sans">
                  可篩選指定時間、進行單筆交易對帳。點擊表格項目直接下鑽查閱顧客點餐規格細節。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportOrdersReport}
                className="mt-3 md:mt-0 flex items-center justify-center space-x-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-black text-xs active:scale-95 transition whitespace-nowrap cursor-pointer shadow-md"
              >
                <Download size={13} />
                <span>匯出查詢結果 (EXCEL格式報表)</span>
              </button>
            </div>

            {/* Date Preset Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: '全部歷史 orders' },
                { id: 'today', label: '📅 今日銷售 (Today)' },
                { id: 'week', label: '📅 本周銷售 (Last 7 Days)' },
                { id: 'month', label: '📅 本月銷售 (Last 30 Days)' },
                { id: 'custom', label: '🔍 自訂日期區間 (Custom)' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDateRangeFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition active:scale-95 cursor-pointer ${
                    dateRangeFilter === btn.id
                      ? 'bg-amber-400/20 border-amber-400 text-[#E5B453] font-extrabold'
                      : 'bg-black/20 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Date Custom Inputs */}
            {dateRangeFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/20 p-4 rounded-lg border border-white/5 animate-slideDown text-xs">
                <div className="space-y-1">
                  <span className="text-white/40 font-bold block">起始日期 Start Date</span>
                  <input
                    type="date"
                    value={orderQueryStartDate}
                    onChange={(e) => setOrderQueryStartDate(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#E5B453]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-white/40 font-bold block">截止日期 End Date</span>
                  <input
                    type="date"
                    value={orderQueryEndDate}
                    onChange={(e) => setOrderQueryEndDate(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#E5B453]"
                  />
                </div>
              </div>
            )}

            {/* Search Key Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-white/40 font-bold">單號/顧客別搜尋 Keyword Search</label>
                <input
                  type="text"
                  placeholder="輸入 訂單單號 (如 LM-1001) 或顧客姓名搜尋"
                  value={orderQueryKeyword}
                  onChange={(e) => setOrderQueryKeyword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#E5B453] placeholder-white/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 font-bold">點單流向狀態 Order Status</label>
                <select
                  value={orderQueryStatus}
                  onChange={(e) => setOrderQueryStatus(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#E5B453]"
                >
                  <option value="all">顯示全部種類狀態</option>
                  <option value="pending">⏳ 待處理 Pending</option>
                  <option value="preparing">🍳 配備中 Preparing</option>
                  <option value="completed">✅ 已送出熟餐 Completed</option>
                  <option value="cancelled">❌ 已取消退料 Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Aggregated analytics widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-[#1c1c1c] to-[#121212] border border-white/5 rounded-xl p-4">
              <span className="text-[10px] text-white/45 font-black uppercase tracking-wider block">
                篩選區間總營業額
              </span>
              <p className="text-xl font-black text-[#E5B453] font-mono leading-none mt-2">
                NT$ {(filteredStats.revenue || 0).toLocaleString()}
              </p>
              <p className="text-[9px] text-zinc-500 mt-1">（已扣除已取消訂單）</p>
            </div>
            <div className="bg-gradient-to-br from-[#1c1c1c] to-[#121212] border border-white/5 rounded-xl p-4">
              <span className="text-[10px] text-white/45 font-black uppercase tracking-wider block">
                篩選期間總點單筆數
              </span>
              <p className="text-xl font-black text-white font-mono leading-none mt-2">
                {filteredStats.count} <span className="text-xs text-zinc-400 font-sans">筆</span>
              </p>
              <p className="text-[9px] text-zinc-500 mt-1">（含歷史已取消案件）</p>
            </div>
            <div className="bg-gradient-to-br from-[#1c1c1c] to-[#121212] border border-white/5 rounded-xl p-4">
              <span className="text-[10px] text-white/45 font-black uppercase tracking-wider block">
                篩選客單價 (Average Ticket)
              </span>
              <p className="text-xl font-black text-blue-400 font-mono leading-none mt-2">
                NT$ {(filteredStats.aov || 0).toLocaleString()}
              </p>
              <p className="text-[9px] text-zinc-500 mt-1">平均每張訂單消費額</p>
            </div>
            <div className="bg-gradient-to-br from-[#1c1c1c] to-[#121212] border border-white/5 rounded-xl p-4">
              <span className="text-[10px] text-white/45 font-black uppercase tracking-wider block">
                Google 會員佔銷比率
              </span>
              <p className="text-xl font-black text-emerald-400 font-mono leading-none mt-2">
                {filteredStats.memberShare.toFixed(1)}%
              </p>
              <p className="text-[9px] text-zinc-500 mt-1">核定 Google 會員之消費貢獻</p>
            </div>
          </div>

          {/* Orders Chronology list */}
          <div className="bg-[#161616] border border-white/10 rounded-xl overflow-hidden shadow-md">
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-white/45 border-b border-white/10 font-bold uppercase tracking-wide">
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400">訂單 ID</th>
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400">點單時間</th>
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400">客用桌號</th>
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400">
                      餐客 / 顧客別
                    </th>
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400 text-right">
                      總計金額
                    </th>
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400 text-center">
                      出餐進度
                    </th>
                    <th className="py-3 px-4 font-normal text-[10px] text-zinc-400 text-center">
                      核對下鑽
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-white/30 font-medium">
                        無任何符合目前篩選準則的訂單交易紀錄。
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-white/[2%] transition duration-150">
                        <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                          {o.id || ''}
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          {o.tableNumber || 'N/A'} 桌
                        </td>
                        <td className="py-3 px-4 flex items-center space-x-2.5">
                          <img
                            src={
                              o.customerAvatar ||
                              'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=150'
                            }
                            defaultValue=""
                            alt="avatar"
                            className="w-6 h-6 rounded-full object-cover border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                          <span className="font-bold text-white truncate max-w-[120px] block">
                            {o.customerName || 'N/A'}
                          </span>
                          {o.isMember && (
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold px-1 py-0.2 rounded font-sans">
                              ⭐ 會員
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-100 font-extrabold text-sm">
                          NT$ {(o.total || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded text-[10px] font-extrabold ${
                              o.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : o.status === 'preparing'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : o.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {o.status === 'completed'
                              ? '已完成出餐'
                              : o.status === 'preparing'
                                ? '廚房配餐中'
                                : o.status === 'pending'
                                  ? '新單待理'
                                  : '已取消復歸'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(o)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1 rounded-lg font-bold transition active:scale-95 text-[11px] cursor-pointer"
                          >
                            🔎 明細單
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: INVENTORY LEDGER (進銷存) ==================== */}
      {activeSubTab === 'inventory' && (
        <div
          className="space-y-6 animate-fadeIn text-left animate-fadeIn"
          id="subtab-section-inventory"
        >
          {/* Warning state board */}
          {analytics.stockWarnings.length > 0 ? (
            <div className="bg-rose-550/10 border border-rose-500/25 p-4.5 rounded-xl flex items-start space-x-3 text-left">
              <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-rose-400 uppercase tracking-wider">
                  下列原料項目已低於安全防線！
                </h5>
                <p className="text-white/70 text-[11px] leading-tight">
                  建議立即辦理原料進貨或利用手動庫存調整以確保正常配餐原料消耗：
                  {analytics.stockWarnings
                    .map(
                      (ig) => `【${getLocalizedText(ig.name, 'zh')} 剩餘 ${ig.stock} ${ig.unit}】`,
                    )
                    .join('、')}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl flex items-center space-x-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-emerald-400 font-bold text-xs">
                安全保障：目前全店原料大體儲量充足，無任何瀕危低限原料。
              </span>
            </div>
          )}

          {/* Table list from standard ingredients block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <div className="flex items-center space-x-1.5 text-white">
                  <Package size={15} />
                  <h4 className="font-bold text-sm tracking-wide">
                    📦 食材原料庫水位 (安全警備與大宗採購進貨)
                  </h4>
                </div>
              </div>
              {/* Desktop Table view */}
              <div className="hidden md:block overflow-x-auto text-xs rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 text-white/40 border-b border-white/5 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">序碼</th>
                      <th className="py-2.5 px-3">原料項目名稱</th>
                      <th className="py-2.5 px-3">現有儲量</th>
                      <th className="py-2.5 px-3">安全水位</th>
                      <th className="py-2.5 px-3">容量單位</th>
                      <th className="py-2.5 px-3 text-center">進貨登入額</th>
                      <th className="py-2.5 px-3 text-center">管理處置</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {ingredients.map((ig) => {
                      const isWarning = ig.stock <= ig.minThreshold;
                      return (
                        <tr
                          key={ig.id}
                          className={
                            isWarning
                              ? 'bg-rose-500/5 hover:bg-rose-500/10 animate-pulse transition-all'
                              : 'hover:bg-white/5'
                          }
                        >
                          <td className="py-3 px-3 font-mono text-zinc-500">{ig.id}</td>
                          <td className="py-3 px-3 font-bold text-white">
                            <div className="flex items-center space-x-1.5">
                              {isWarning && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
                              )}
                              <span>{getLocalizedText(ig.name, 'zh')}</span>
                            </div>
                          </td>
                          <td
                            className={`py-3 px-3 font-mono font-bold text-sm ${isWarning ? 'text-rose-400 font-extrabold' : 'text-zinc-100'}`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <span>{ig.stock}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickRestockItem(ig);
                                  setQuickRestockQty('');
                                }}
                                className="p-1 inline-flex items-center justify-center rounded bg-amber-500/10 hover:bg-amber-500/20 text-[#E5B453] border border-amber-500/25 transition active:scale-90 cursor-pointer shadow-sm"
                                title="快速補貨 Restock"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-400">{ig.minThreshold}</td>
                          <td className="py-3 px-3 text-zinc-500 text-[11px]">{ig.unit}</td>
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              id={`input-restock-${ig.id}`}
                              placeholder="20"
                              value={
                                restockAmount[ig.id] === undefined
                                  ? ''
                                  : restockAmount[ig.id] === 0
                                    ? ''
                                    : restockAmount[ig.id]
                              }
                              onChange={(e) =>
                                setRestockAmount({
                                  ...restockAmount,
                                  [ig.id]: Math.max(0, parseInt(e.target.value, 10)),
                                })
                              }
                              className="w-16 bg-black/60 border border-white/10 rounded px-2 py-1 text-center font-mono font-bold outline-none text-white focus:border-[#E5B453]"
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRestockClick(ig.id)}
                              className="bg-[#E5B453]/15 hover:bg-[#E5B453]/25 text-[#E5B453] border border-[#E5B453]/35 px-2.5 py-1 rounded font-bold transition active:scale-95 text-[11px] cursor-pointer"
                            >
                              進貨
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card view (High-Comfort & Zero-Overflow) */}
              <div className="block md:hidden space-y-3.5">
                {ingredients.map((ig) => {
                  const isWarning = ig.stock <= ig.minThreshold;
                  return (
                    <div
                      key={ig.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 px-3.5 transition-all shadow-md ${
                        isWarning
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30'
                          : 'bg-black/35 border-white/10 hover:border-zinc-700'
                      }`}
                    >
                      {/* Name & Stock info */}
                      <div className="flex items-start justify-between gap-3 font-sans">
                        <div className="space-y-1">
                          <p className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5 flex-wrap">
                            <span>{getLocalizedText(ig.name, 'zh')}</span>
                            {isWarning && (
                              <span className="text-[9px] bg-rose-500/15 text-rose-450 border border-rose-500/20 px-2 py-0.5 rounded font-black animate-pulse text-rose-400">
                                ⚠️ 低於水位
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            ID: {ig.id} | 單位: {ig.unit}
                          </p>
                        </div>
                        {/* Current quantity details */}
                        <div className="text-right shrink-0">
                          <span
                            className={`text-sm sm:text-base font-black font-mono block ${isWarning ? 'text-rose-400' : 'text-zinc-100'}`}
                          >
                            {ig.stock} {ig.unit}
                          </span>
                          <span className="text-[9px] text-zinc-550 font-mono block text-zinc-500">
                            安全水位: {ig.minThreshold} {ig.unit}
                          </span>
                        </div>
                      </div>

                      {/* Control Panel bottom inside card */}
                      <div className="pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                        {/* Amount input */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-[10px] text-zinc-400 font-bold shrink-0">量:</span>
                          <input
                            type="number"
                            min={1}
                            placeholder="20"
                            value={
                              restockAmount[ig.id] === undefined
                                ? ''
                                : restockAmount[ig.id] === 0
                                  ? ''
                                  : restockAmount[ig.id]
                            }
                            onChange={(e) =>
                              setRestockAmount({
                                ...restockAmount,
                                [ig.id]: Math.max(0, parseInt(e.target.value, 10)),
                              })
                            }
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold outline-none text-white focus:border-[#E5B453] text-xs h-8"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickRestockItem(ig);
                              setQuickRestockQty('');
                            }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[#E5B453] border border-amber-500/25 transition active:scale-90 cursor-pointer shadow-sm"
                            title="快速特定值補貨"
                          >
                            <Plus size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRestockClick(ig.id)}
                            className="bg-[#E5B453] hover:bg-amber-400 text-slate-900 border border-amber-600/20 px-3.5 h-8 rounded-lg font-black transition active:scale-95 text-xs cursor-pointer shadow-md leading-none"
                          >
                            進貨
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manual adjustment and stock audits + Add raw material */}
            <div className="lg:col-span-4 space-y-6">
              {/* Manual adjustment card */}
              <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <h4 className="font-bold text-sm text-[#E5B453] font-serif">
                    ⚙️ 安全盤點。手動核銷調整庫量
                  </h4>
                  <p className="text-[10px] text-white/40 leading-tight mt-1">
                    耗損、報廢、招待用、補發或期末實際庫存不對時，在此校正，亦將產生過帳明細流向日誌以資備忘備查。
                  </p>
                </div>
                <form onSubmit={handleManualAdjustStock} className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-zinc-400">選擇原料 Item Selector</label>
                    <select
                      value={manualAdjustId}
                      onChange={(e) => setManualAdjustId(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white focus:border-[#E5B453]"
                    >
                      <option value="">請選擇要盤調的原料...</option>
                      {ingredients.map((ig) => (
                        <option key={ig.id} value={ig.id}>
                          {getLocalizedText(ig.name, 'zh')} ({ig.stock} {ig.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400">增減異動量 (Change Amount)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="輸入正整數增加，如 10；輸入負數耗扣損，如 -2.5"
                      value={manualAdjustQty}
                      onChange={(e) => setManualAdjustQty(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white font-mono focus:border-[#E5B453]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400">日誌記帳備註 Note reason</label>
                    <input
                      type="text"
                      placeholder="例如：櫛瓜發霉毀損、今日盤點損差、招待貴品"
                      value={manualAdjustNote}
                      onChange={(e) => setManualAdjustNote(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white focus:border-[#E5B453]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-extrabold text-white rounded-lg transition active:scale-95 cursor-pointer shadow-md text-xs"
                  >
                    📝 寫入並過帳盤點調整
                  </button>
                </form>
              </div>

              {/* Add raw material card */}
              <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <h4 className="font-bold text-sm text-[#E5B453] font-serif">
                    ➕ 新增原料項目 (Add Raw Material)
                  </h4>
                  <p className="text-[10px] text-white/40 leading-tight mt-1">
                    在此登錄全新的食材或包裝大宗物料，設定初始儲量、安全水位與容量單位。
                  </p>
                </div>
                <form onSubmit={handleAddNewIngredient} className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-zinc-400">原料庫存識別代號 (Unique ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="例如：egg, tomato, pork-rib"
                      value={newIngId}
                      onChange={(e) => setNewIngId(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white font-mono focus:border-[#E5B453]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400">中文名稱 (Name in Chinese)</label>
                    <input
                      type="text"
                      required
                      placeholder="例如：新鮮洗選大雞蛋"
                      value={newIngNameZh}
                      onChange={(e) => setNewIngNameZh(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white focus:border-[#E5B453]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400">英文名稱 (Name in English - 選填)</label>
                    <input
                      type="text"
                      placeholder="例如：Fresh Chicken Eggs"
                      value={newIngNameEn}
                      onChange={(e) => setNewIngNameEn(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white focus:border-[#E5B453]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-zinc-400">初始水位</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="100"
                        value={newIngStock}
                        onChange={(e) => setNewIngStock(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white font-mono focus:border-[#E5B453]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400">安全水位</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="20"
                        value={newIngMinThreshold}
                        onChange={(e) => setNewIngMinThreshold(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white font-mono focus:border-[#E5B453]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400">容量單位</label>
                      <input
                        type="text"
                        placeholder="kg, 顆, 包"
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-2 outline-none text-white font-mono focus:border-[#E5B453]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 mt-2 bg-emerald-600 hover:bg-emerald-500 font-extrabold text-white rounded-lg transition active:scale-95 cursor-pointer shadow-md text-xs"
                  >
                    🚀 登記並創建全新原料項目
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Dynamic Ingredient Recipe recipe cost definitions */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 text-left">
            <span className="text-[10px] text-[#E5B453] uppercase font-black tracking-widest block mb-1">
              食材配方扣減審核卡
            </span>
            <h4 className="text-sm font-bold border-b border-white/5 pb-2 mb-3">
              菜單食材配方定額與消耗原理 (Recipe Composition Specifications)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 text-xs font-sans">
              {Object.keys(recipeCompositionMap).map((key) => {
                const menuItem = menuItems.find((m) => m.id === key);
                return (
                  <div
                    key={key}
                    className="bg-black/30 border border-white/5 p-3 rounded-lg space-y-1.5"
                  >
                    <span className="font-bold text-[#E5B453] line-clamp-1">
                      {menuItem ? menuItem.name.zh : key}
                    </span>
                    <div className="space-y-1 text-[11px] text-zinc-400">
                      {recipeCompositionMap[key].map((rec, i) => (
                        <p key={i} className="flex justify-between">
                          <span>{rec.name}</span>
                          <span className="font-mono text-white text-right font-semibold">
                            {rec.qty}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Searchable Transaction history table list */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2.5">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-white font-serif">
                  📜 進銷存交易流動流水帳 (Inventory Transaction Logs Ledger)
                </h4>
                <p className="text-white/40 text-[11px]">
                  本表格詳實記載進貨、點餐系統自動配銷、手動調整、取消歸庫等各類流向明細，保障店鋪帳實吻合。
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportInventoryReport}
                className="mt-3.5 sm:mt-0 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 font-black text-xs text-white rounded-lg px-3.5 py-1.5 active:scale-95 transition cursor-pointer"
              >
                <Download size={13} />
                <span>匯出進銷存 CSV 報表</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <label className="text-zinc-400 shrink-0">速尋過濾:</label>
              <input
                type="text"
                placeholder="輸入原料名稱、備註描述或單號關鍵字..."
                value={inventoryLogSearch}
                onChange={(e) => setInventoryLogSearch(e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-3 py-1.5 focus:border-[#E5B453] focus:outline-none w-full outline-none placeholder-white/25 text-white"
              />
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-white/45 border-b border-white/10 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">交易過帳時間</th>
                    <th className="py-2.5 px-3">對象原料</th>
                    <th className="py-2.5 px-3 text-center">異動類別</th>
                    <th className="py-2.5 px-3 text-right">變化量額</th>
                    <th className="py-2.5 px-3 text-right">變動後殘餘</th>
                    <th className="py-2.5 px-3">交易事件備註原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {dbInventoryLogs.filter((l) => {
                    const k = inventoryLogSearch.toLowerCase().trim();
                    if (!k) return true;
                    return (
                      l.ingredientName.toLowerCase().includes(k) || l.note.toLowerCase().includes(k)
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-white/30 font-medium">
                        無任何庫存異動日誌登錄。
                      </td>
                    </tr>
                  ) : (
                    dbInventoryLogs
                      .filter((l) => {
                        const k = inventoryLogSearch.toLowerCase().trim();
                        if (!k) return true;
                        return (
                          l.ingredientName.toLowerCase().includes(k) ||
                          l.note.toLowerCase().includes(k)
                        );
                      })
                      .sort(
                        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                      )
                      .map((l, i) => (
                        <tr key={l.id || i} className="hover:bg-white/[2%] font-sans">
                          <td className="py-2.5 px-3 text-zinc-500 font-mono">
                            {new Date(l.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">{l.ingredientName}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                l.type === 'incoming'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : l.type === 'outgoing'
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : 'bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {l.type === 'incoming'
                                ? '進貨流入'
                                : l.type === 'outgoing'
                                  ? '系統配銷'
                                  : '手控盤核'}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold ${l.quantityChanged > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {l.quantityChanged > 0 ? '+' : ''}
                            {l.quantityChanged}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-zinc-400 font-semibold">
                            {l.remainingStock}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 text-[11.5px] max-w-[200px] truncate">
                            {l.note}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: MENU ITEMS MANAGER ==================== */}
      {activeSubTab === 'menu' && (
        <div className="space-y-6 animate-fadeIn text-left" id="subtab-section-menu">
          {/* Main List & Create trigger */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 flex-wrap gap-3">
              <div>
                <h4 className="font-bold text-sm text-white font-serif">
                  🍜 菜單全品編輯與可售狀態 Availability Dashboard
                </h4>
                <p className="text-white/40 text-xs mt-1">
                  變更餐點是否沽清、客製配料或上下架（設為沽清之品項將於隔日中午12:00自動恢復販售）。
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {onReorderMenuItems && (
                  <>
                    {!isMenuItemSortingMode ? (
                      <button
                        type="button"
                        onClick={() => setIsMenuItemSortingMode(true)}
                        className="bg-amber-500/10 hover:bg-[#E5B453] hover:text-black border border-amber-500/35 text-[#E5B453] px-2.5 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition cursor-pointer flex items-center gap-1"
                        id="btn-menuitem-sort-start"
                      >
                        調整品項排序 ↕️
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-white/5">
                        <button
                          type="button"
                          onClick={handleSaveMenuItemOrder}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-bold active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-900/40 animate-pulse"
                          id="btn-menuitem-sort-confirm"
                        >
                          💾 確認儲存品項排序
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelMenuItemOrder}
                          className="bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white px-2 py-1 rounded text-xs transition cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={triggerAddMenuItemMode}
                  className="flex items-center space-x-1 bg-[#E5B453] hover:bg-amber-400 text-slate-900 border border-white/5 px-3.5 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition cursor-pointer font-sans"
                >
                  <Plus size={14} />
                  <span>新增全新品項 Add</span>
                </button>
              </div>
            </div>

            {/* Excel-style table of menu items catalog */}
            <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/10">
              <table className="w-full min-w-[800px] border-collapse text-xs text-left font-sans">
                <thead>
                  <tr className="bg-zinc-800/80 border-b border-white/10 text-[11px] font-bold text-amber-400">
                    <th scope="col" className="p-3 border-r border-white/10 text-center w-10">
                      #
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10 text-center w-24">
                      手動排序 (Sort)
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10 font-sans">
                      ID碼 (ID Code)
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10">
                      菜品分類 (Category)
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10">
                      品名 (Dish Name)
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10 text-right">
                      定價 (Price)
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10 text-center">
                      可售狀態 (Stock Status)
                    </th>
                    <th scope="col" className="p-3 border-r border-white/10">
                      附加規格 (Options)
                    </th>
                    <th scope="col" className="p-3 text-center">
                      後端控制 (Operations)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {localMenuItemOrder.map((item, index) => {
                    const foundCategoryObj = categories.find((c) => c.id === item.category);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#E5B453]/5 transition-colors ${
                          index % 2 === 0 ? 'bg-zinc-900/20' : 'bg-black/30'
                        }`}
                      >
                        {/* # Row Index */}
                        <td className="p-2.5 border-r border-white/10 text-center text-zinc-500 font-mono text-[10px]">
                          {index + 1}
                        </td>

                        {/* 排序操作 */}
                        <td className="p-2.5 border-r border-white/10 text-center">
                          {isMenuItemSortingMode ? (
                            <div className="flex items-center justify-center space-x-1.5 animate-pulse bg-amber-500/10 p-1 rounded border border-amber-500/25">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveMenuItem(item.id, 'up')}
                                className="p-1 px-2 rounded bg-[#E5B453] hover:bg-amber-400 text-slate-900 transition active:scale-90 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-[10px] font-black flex items-center space-x-0.5"
                                title="上移此品項"
                              >
                                <span>▲</span>
                                <span className="text-[9px]">上移</span>
                              </button>
                              <button
                                type="button"
                                disabled={index === localMenuItemOrder.length - 1}
                                onClick={() => handleMoveMenuItem(item.id, 'down')}
                                className="p-1 px-2 rounded bg-[#E5B453] hover:bg-amber-400 text-slate-900 transition active:scale-90 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-[10px] font-black flex items-center space-x-0.5"
                                title="下移此品項"
                              >
                                <span>▼</span>
                                <span className="text-[9px]">下移</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-zinc-500 text-[10px] font-mono text-center flex items-center justify-center gap-1">
                              <span>🔒</span>
                              <span className="text-[9px]">排序鎖定</span>
                            </div>
                          )}
                        </td>

                        {/* ID碼 */}
                        <td className="p-2.5 border-r border-white/10 font-mono text-zinc-400 font-medium select-all">
                          {item.id}
                        </td>

                        {/* 菜品分類 */}
                        <td className="p-2.5 border-r border-white/10">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {foundCategoryObj?.name?.zh || item.category}
                          </span>
                        </td>

                        {/* 品名 */}
                        <td className="p-2.5 border-r border-white/10 font-sans">
                          <div className="flex items-center space-x-2">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={getLocalizedText(item.name, currentLang)}
                                className="w-10 h-10 object-cover rounded-lg bg-black flex-shrink-0 border border-white/10"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg bg-zinc-800 border border-white/10 flex-shrink-0 flex items-center justify-center text-base text-zinc-500"
                                title="無圖片 No Image"
                              >
                                🥣
                              </div>
                            )}
                            <div className="space-y-0.5 truncate">
                              <p className="font-bold text-white text-[13px] truncate">
                                {getLocalizedText(item.name, currentLang)}
                              </p>
                              {typeof item.name === 'object' && item.name?.en && (
                                <p className="text-[10px] text-zinc-500 truncate">{item.name.en}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 定價 */}
                        <td className="p-2.5 border-r border-white/10 text-right font-mono font-bold text-white">
                          NT$ {item.price}
                        </td>

                        {/* 可售狀態 */}
                        <td className="p-2.5 border-r border-white/10 text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.available
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {item.available ? '● 販售中 Supply' : '✕ 沽清 Sold Out'}
                            </span>
                            {!item.available && (
                              <span
                                className="text-[9px] text-amber-300/80 tracking-tight"
                                title="隔日中午 12:00 將自動恢復販售"
                              >
                                ⏰ 隔日12:00自動恢復
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 附加規格 */}
                        <td className="p-2.5 border-r border-white/10 text-zinc-400 text-[10px]">
                          <div className="flex flex-wrap gap-1">
                            {item.isNotSpicy && (
                              <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] border border-emerald-500/15">
                                完全不辣
                              </span>
                            )}
                            {Array.isArray(item.customAddOns) && item.customAddOns.length > 0 ? (
                              <span className="bg-zinc-500/15 text-zinc-300 px-1.5 py-0.5 rounded text-[9px] border border-zinc-500/20">
                                加價項目x{item.customAddOns.length}
                              </span>
                            ) : (
                              <span className="text-zinc-550 italic">無加選</span>
                            )}
                          </div>
                        </td>

                        {/* 後端控制 */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (onToggleMenuItemAvailability) {
                                  onToggleMenuItemAvailability(item.id);
                                }
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer select-none active:scale-95 ${
                                item.available
                                  ? 'bg-[#E5B453]/10 text-amber-300 border-amber-500/30 hover:bg-[#E5B453]/20'
                                  : 'bg-rose-500/10 text-rose-455 border border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                            >
                              {item.available ? '設為沽清' : '恢復販售'}
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerEditMenuItemMode(item)}
                              className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer select-none active:scale-95 flex items-center space-x-1"
                            >
                              <span>編輯品項 ✏️</span>
                            </button>
                            {onDeleteMenuItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmActionModal({
                                    isOpen: true,
                                    title: '🚨 刪除餐點品項確認',
                                    message: `您確定要永久刪除餐點 [${getLocalizedText(item.name, 'zh')}] 嗎？刪除後，線上顧客與員工點餐畫面中將不再顯示此餐點，且此操作無法復原。`,
                                    actionLabel: '確定刪除 Delete',
                                    onConfirm: async () => {
                                      await onDeleteMenuItem(item.id);
                                    },
                                  });
                                }}
                                className="bg-rose-500/10 hover:bg-rose-550/20 text-rose-400 border border-rose-500/35 px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer select-none active:scale-95 flex items-center space-x-1"
                              >
                                <span>刪除 🗑️</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Business categories settings panel */}
          <div
            className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-3"
            id="manager-categories-panel"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-2 flex-wrap gap-2">
              <div className="flex items-center space-x-1.5">
                <Layers size={15} className="text-[#E5B453]" />
                <h4 className="font-bold text-sm">🗂️ 菜色分類標籤控制 Categories Panel</h4>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {onReorderCategories && (
                  <>
                    {!isCategorySortingMode ? (
                      <button
                        type="button"
                        onClick={() => setIsCategorySortingMode(true)}
                        className="bg-amber-500/10 hover:bg-[#E5B453] hover:text-black border border-amber-500/35 text-[#E5B453] px-2.5 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition cursor-pointer flex items-center gap-1"
                        id="btn-category-sort-start"
                      >
                        調整分類排序 ↕️
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-white/5">
                        <button
                          type="button"
                          onClick={handleSaveCategoryOrder}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-bold active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-900/40 animate-pulse"
                          id="btn-category-sort-confirm"
                        >
                          💾 確認儲存排序
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelCategoryOrder}
                          className="bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white px-2 py-1 rounded text-xs transition cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </>
                )}
                {onAddCategory && (
                  <button
                    type="button"
                    onClick={triggerAddCatMode}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition cursor-pointer"
                  >
                    新增菜色分類標籤
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 text-xs">
              {localCategoryOrder.map((cat) => {
                const catIndex = localCategoryOrder.indexOf(cat);
                const isFirst = catIndex === 0;
                return (
                  <div
                    key={cat.id}
                    className={`bg-black/35 border p-4 flex flex-col justify-between space-y-3 rounded-xl shadow-md hover:border-[#E5B453]/45 transition duration-200 ${
                      isFirst
                        ? 'border-[#E5B453]/60 bg-gradient-to-br from-[#E5B453]/[0.08] to-transparent ring-[1.5px] ring-[#E5B453]/20 shadow-[0_0_15px_rgba(229,180,83,0.06)]'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="text-left font-sans text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2.5 flex-wrap">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-mono font-black border ${
                              isFirst
                                ? 'bg-[#E5B453] text-black border-[#E5B453]'
                                : 'bg-white/5 text-zinc-400 border-white/10'
                            }`}
                            title={`顯示排序：第 ${catIndex + 1} 順位`}
                          >
                            {catIndex + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-white truncate">
                            {getLocalizedText(cat.name, 'zh')}
                          </span>
                        </div>

                        {/* 菜色分類排序 (Category Sorting Controls) */}
                        {isCategorySortingMode ? (
                          <div className="flex items-center space-x-1 shrink-0 bg-amber-500/10 p-0.5 rounded-lg border border-amber-500/20 animate-pulse">
                            <button
                              type="button"
                              disabled={catIndex === 0}
                              onClick={() => handleMoveCategory(cat.id, 'up')}
                              className="p-1 px-1.5 text-[9px] font-black text-[#E5B453] hover:text-amber-400 hover:bg-white/5 rounded transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-0.5"
                              title="往前移動分類 (提升排序)"
                            >
                              <span>◀</span>
                              <span className="text-[8px]">前移</span>
                            </button>
                            <button
                              type="button"
                              disabled={catIndex === localCategoryOrder.length - 1}
                              onClick={() => handleMoveCategory(cat.id, 'down')}
                              className="p-1 px-1.5 text-[9px] font-black text-[#E5B453] hover:text-amber-400 hover:bg-white/5 rounded transition disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-0.5"
                              title="往後移動分類 (降低排序)"
                            >
                              <span className="text-[8px]">後移</span>
                              <span>▶</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 shrink-0 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-[9px] text-zinc-500 font-mono">
                            <span>🔒 排序鎖定中</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <p className="text-zinc-500 font-mono">標記 ID: {cat.id}</p>
                        <span
                          className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] shrink-0 ${cat.showOnCustomerPage !== false ? 'bg-emerald-500/10 text-emerald-400 font-extrabold' : 'bg-rose-500/10 text-rose-450 font-extrabold'}`}
                        >
                          {cat.showOnCustomerPage !== false ? '顧客可見' : '後台限定'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full pt-2.5 border-t border-white/5">
                      {onEditCategory && (
                        <button
                          type="button"
                          onClick={() => triggerEditCatMode(cat)}
                          className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-[#E5B453] hover:text-[#0c0c0c] text-[#E5B453] rounded-lg border border-amber-500/20 transition active:scale-95 text-xs font-bold cursor-pointer"
                          title="編輯該分類名稱"
                        >
                          <Edit size={12} />
                          <span>編輯</span>
                        </button>
                      )}
                      {onDeleteCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmActionModal({
                              isOpen: true,
                              title: '🧩 刪除餐點分類標籤確定',
                              message: `⚠️ 安全確定：您確定要刪除 [${getLocalizedText(cat.name, 'zh')}] 分類標籤嗎？刪除後，線上顧客與員工點餐畫面中此分類的所有餐點將不再顯示。`,
                              actionLabel: '確定刪除 Delete',
                              onConfirm: async () => {
                                await onDeleteCategory(cat.id);
                              },
                            });
                          }}
                          className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-455 rounded-lg border border-rose-500/20 transition active:scale-95 text-xs font-bold cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 size={12} />
                          <span>刪除</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: MEMBERS, ACCESS PRIVILEGE AND PIN ==================== */}
      {activeSubTab === 'members' && (
        <div
          className="space-y-6 animate-fadeIn text-left animate-fadeIn"
          id="subtab-section-members"
        >
          {/* Members Stats & Controls */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <Coins className="text-[#E5B453] shrink-0" size={17} />
                <div>
                  <h4 className="font-bold text-sm text-white font-serif tracking-wide">
                    Google Quick Member / 顧客會員累計點數系統
                  </h4>
                  <p className="text-white/40 text-xs">
                    取代 LINE 傳統推播行銷，本介面詳實登錄全體 Google
                    帳戶顧客之累計點數。店員可在結算時手動輸入消除或微調點數。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewMemberName('');
                  setNewMemberEmail('');
                  setNewMemberBalance('0');
                  setNewMemberPoints('0');
                  setAddMemberError(null);
                  setAddMemberModalOpen(true);
                }}
                className="self-start sm:self-center bg-[#E5B453] hover:bg-[#d6a546] text-black font-extrabold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 text-xs cursor-pointer shadow-md shadow-[#E5B453]/10"
              >
                <Plus size={14} />
                <span>新增顧客會員 Add Member</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block mb-1">
                  已核定 Google 會員
                </span>
                <p className="text-2xl font-black text-white font-mono leading-none">
                  {membersList.length}{' '}
                  <span className="text-xs font-semibold text-zinc-400 font-sans">位</span>
                </p>
              </div>
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block mb-1">
                  累存總流通點數
                </span>
                <p className="text-2xl font-black text-[#E5B453] font-mono leading-none">
                  {membersList.reduce((acc, cur) => acc + (cur.points || 0), 0).toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-zinc-400 font-sans">點</span>
                </p>
              </div>
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block mb-1">
                  消點累計兑消匯率
                </span>
                <p className="text-2xl font-black text-blue-400 font-mono leading-none">
                  100{' '}
                  <span className="text-xs font-semibold text-zinc-400 font-sans">
                    點抵 NT$10 元
                  </span>
                </p>
              </div>
            </div>

            {/* Members table */}
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs text-left text-zinc-300">
                <thead>
                  <tr className="bg-white/5 text-white/50 border-b border-white/5">
                    <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">
                      成員頭像/名稱
                    </th>
                    <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">
                      綁定電子郵箱 Email
                    </th>
                    <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-center">
                      登載註冊時間
                    </th>
                    <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-right">
                      當前統計儲值點數
                    </th>
                    <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-center">
                      手動消點累點變更
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {membersList.map((m) => (
                    <tr key={m.email} className="hover:bg-white/[2%]">
                      <td className="py-3.5 px-4 flex items-center space-x-3 text-white font-bold">
                        <img
                          src={m.avatar}
                          alt="member-avatar"
                          className="w-8 h-8 rounded-full border border-blue-500/20 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span>{m.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-400">
                        {getMaskedEmail(m.email)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-zinc-500">
                        {m.joinedAt || '2026-06-01'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-amber-400 font-black text-sm">
                        {(m.points || 0).toLocaleString()} 點
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustPoints(m.email)}
                            className="bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded transition text-[10px] cursor-pointer"
                          >
                            加減消點
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m.email)}
                            className="bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-450 rounded transition text-[10px] cursor-pointer"
                          >
                            移除帳戶
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PIN changer & Security configuration */}
            <div
              id="pincode-changer-card"
              className="bg-[#161616] border border-white/10 rounded-xl p-4 space-y-2.5 text-left"
            >
              <div className="border-b border-white/5 pb-1.5">
                <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                  安全鑰控制與系統加密安全
                </span>
                <h4 className="font-bold text-xs mt-0.5">變更 6 位數員工解鎖金鑰 PIN Changer</h4>
              </div>
              <form onSubmit={handlePinChangeSubmit} className="space-y-2 text-[11px]">
                {pinChangeError && (
                  <div className="p-1.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-lg">
                    ⚠️ {pinChangeError}
                  </div>
                )}
                {pinChangeSuccess && (
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg">
                    🎯 {pinChangeSuccess}
                  </div>
                )}
                <div className="space-y-0.5">
                  <label className="text-zinc-500 block text-[10px]">
                    目前解鎖金鑰 Current PIN
                  </label>
                  <input
                    id="current-pincode-input"
                    type="password"
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black border border-white/10 rounded-lg px-2 py-1 font-mono text-center tracking-widest text-[13px] text-white"
                    placeholder="輸入目前 6 碼"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-0.5">
                    <label className="text-zinc-500 block text-[10px]">新 PIN-Key</label>
                    <input
                      id="new-pincode-input"
                      type="password"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black border border-white/10 rounded-lg px-2 py-1 font-mono text-center tracking-widest text-[13px] text-white"
                      placeholder="全新 6 碼"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-zinc-500 block text-[10px]">對校新 Key</label>
                    <input
                      id="confirm-pincode-input"
                      type="password"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black border border-white/10 rounded-lg px-2 py-1 font-mono text-center tracking-widest text-[13px] text-white"
                      placeholder="確認新 6 碼"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={pinChangeLoading}
                  className="w-full py-1.5 mt-1 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded-lg active:scale-95 cursor-pointer text-[11px] shadow-sm tracking-wide transition"
                >
                  {pinChangeLoading ? '執行中...' : '💾 確認變更解鎖 PIN'}
                </button>
              </form>
            </div>

            {/* Minimum Spend per Person configuration */}
            <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 font-sans">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                  內用點餐控制與消費門檻
                </span>
                <h4 className="font-bold text-sm mt-0.5">
                  內用每人低消限制 Dine-in Min Spend Setting
                </h4>
              </div>
              <div className="space-y-3 text-xs">
                {minSpendSaveError && (
                  <div className="p-2 bg-rose-500/10 text-rose-400 text-[11px] font-bold rounded-lg">
                    ⚠️ {minSpendSaveError}
                  </div>
                )}
                {minSpendSaveSuccess && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-lg">
                    🎯 {minSpendSaveSuccess}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-zinc-400 block">當前每人最低消費金額 (NT$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempMinSpend}
                    onChange={(e) =>
                      setTempMinSpend(
                        Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0),
                      )
                    }
                    className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-center text-white tracking-wide text-sm"
                    placeholder="例如: 200"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveMinSpend}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg active:scale-95 cursor-pointer text-[12px] shadow-sm tracking-wide transition"
                >
                  💾 儲存低消限制門檻 Settings
                </button>
              </div>
            </div>

            {/* Member points and gifts configuration */}
            <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 font-sans text-left">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                  會員點數與贈品機制設定
                </span>
                <h4 className="font-bold text-sm mt-0.5">
                  點數贈送調整與贈送品項自訂 Member Points & Rewards Config
                </h4>
              </div>
              <div className="space-y-4 text-xs">
                {memberConfigSaveError && (
                  <div className="p-2 bg-rose-500/10 text-rose-400 text-[11px] font-bold rounded-lg border border-rose-500/20">
                    ⚠️ {memberConfigSaveError}
                  </div>
                )}
                {memberConfigSaveSuccess && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/20">
                    🎯 {memberConfigSaveSuccess}
                  </div>
                )}

                {/* Points ratio configuration */}
                <div className="space-y-1.5">
                  <label className="text-zinc-400 block font-semibold">
                    積點比例：每 消費多少元 贈送 1 點會員積分？
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-500 text-xs">每消費</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tempPointsRatio}
                      onChange={(e) =>
                        setTempPointsRatio(
                          Math.max(1, parseInt(e.target.value.replace(/\D/g, ''), 10) || 1),
                        )
                      }
                      className="w-24 bg-black border border-white/10 rounded-lg px-2.5 py-1 font-mono text-center text-white tracking-wide text-xs"
                      placeholder="20"
                    />
                    <span className="text-zinc-400 text-xs">元，獲得 1 點</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">
                    預設為 20 元 1 點，可自由調整為 10 元、50 元等任意大於 1 的正整數值。
                  </p>
                </div>

                {/* Gift reward items selection */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <label className="text-zinc-400 block font-semibold text-xs uppercase tracking-wider">
                    🎁 回饋贈餐品項與點數自訂
                  </label>

                  <div className="space-y-3">
                    {tempRewards.map((reward, index) => {
                      return (
                        <div
                          key={reward.id || index}
                          className="bg-black/40 border border-white/5 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-zinc-500 uppercase">
                              選項 {index + 1} ({reward.id})
                            </span>
                            <label className="flex items-center space-x-1.5 cursor-pointer text-zinc-400 hover:text-white select-none">
                              <input
                                type="checkbox"
                                checked={reward.enabled !== false}
                                onChange={(e) => {
                                  const updated = [...tempRewards];
                                  updated[index] = { ...updated[index], enabled: e.target.checked };
                                  setTempRewards(updated);
                                }}
                                className="rounded text-[#E5B453] bg-zinc-950 border-zinc-700 focus:ring-0 focus:ring-offset-0"
                              />
                              <span className="text-[11px]">啟用此項贈品</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* MenuItem selection */}
                            <div className="space-y-0.5 text-left">
                              <span className="text-zinc-500 text-[10px] block">
                                對應單品餐點 Corresponding Item
                              </span>
                              <select
                                value={reward.menuItemId}
                                onChange={(e) => {
                                  const updated = [...tempRewards];
                                  const selectedId = e.target.value;
                                  const matchItem = menuItems.find((m) => m.id === selectedId);
                                  updated[index] = {
                                    ...updated[index],
                                    menuItemId: selectedId,
                                    fallbackPrice: matchItem ? matchItem.price : 100,
                                    fallbackName: matchItem
                                      ? matchItem.name
                                      : { zh: '贈送項目', en: 'Complimentary Item' },
                                  };
                                  setTempRewards(updated);
                                }}
                                className="w-full bg-black border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                              >
                                {menuItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {getLocalizedText(item.name, 'zh') || item.name} (NT${' '}
                                    {item.price})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Cost index */}
                            <div className="space-y-0.5 text-left">
                              <span className="text-zinc-500 text-[10px] block font-sans">
                                兌換所需點數 Reward Points Required
                              </span>
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={reward.cost !== undefined ? reward.cost : 900}
                                  onChange={(e) => {
                                    const updated = [...tempRewards];
                                    updated[index] = {
                                      ...updated[index],
                                      cost: Math.max(
                                        0,
                                        parseInt(e.target.value.replace(/\D/g, ''), 10) || 0,
                                      ),
                                    };
                                    setTempRewards(updated);
                                  }}
                                  className="w-full bg-black border border-white/10 rounded-lg pl-2 py-1 font-mono text-white text-xs"
                                  placeholder="900"
                                />
                                <span className="absolute right-2 text-[10px] font-bold text-amber-500 block uppercase">
                                  PTS
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveMemberConfig}
                  disabled={isSavingMemberConfig}
                  className="w-full py-2 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded-lg active:scale-95 cursor-pointer text-xs shadow-md tracking-wide transition uppercase"
                >
                  {isSavingMemberConfig ? '儲存中...' : '💾 儲存會員機制自訂設定 Save VIP Config'}
                </button>
              </div>
            </div>

            {/* 客戶注意事項欄位 */}
            <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 font-sans text-left">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                  客席資訊與跑馬燈公告
                </span>
                <h4 className="font-bold text-sm mt-0.5">
                  滾動式客席注意事項公告 Customer Scrolling Notice
                </h4>
              </div>
              <div className="space-y-3.5 text-xs">
                {noticeError && (
                  <div className="p-2 bg-rose-500/10 text-rose-400 text-[11px] font-bold rounded-lg border border-rose-500/20">
                    ⚠️ {noticeError}
                  </div>
                )}
                {noticeSuccess && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/20">
                    🎯 {noticeSuccess}
                  </div>
                )}

                <p className="text-[11px] text-zinc-400 leading-normal">
                  此訊息會以「滾動式跑馬燈」在所有顧客桌別的點餐頁面最上方即時輪播，適合填寫：最新優惠、滿額贈禮、低消或限時說明。
                </p>

                <div className="space-y-1">
                  <label className="text-zinc-500 block font-semibold">
                    公告內容 (字數不限，支援英文及多語系跑馬輪播)
                  </label>
                  <textarea
                    rows={3}
                    value={tempCustomerNotice}
                    onChange={(e) => setTempCustomerNotice(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white leading-relaxed text-xs focus:ring-1 focus:ring-[#E5B453] focus:outline-none focus:border-[#E5B453]"
                    placeholder="輸入你要在頂部跑馬燈輪播的消息..."
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveCustomerNotice}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg active:scale-95 cursor-pointer text-[12px] shadow-sm tracking-wide transition flex items-center justify-center gap-1"
                >
                  <span>💾 儲存並即時推播公告</span>
                </button>
              </div>
            </div>

            {/* 系統資料清洗 System Sanitize & Reset */}
            <div className="bg-[#161616] border border-rose-500/20 rounded-xl p-5 space-y-4 font-sans text-left">
              <div className="border-b border-rose-500/10 pb-2">
                <span className="text-[10px] font-bold text-rose-500 tracking-widest block uppercase">
                  資料清洗與測試單據重置 Sanitize Data
                </span>
                <h4 className="font-bold text-sm mt-0.5 text-white">
                  刪除系統測試用歷史單據及暫存資料 System Data Sanitize
                </h4>
              </div>
              <div className="space-y-3.5 text-xs">
                <p className="text-[11px] text-zinc-400 leading-normal">
                  此功能將永久刪除系統中預載的測試性歷史訂單單據、廚房出單日誌、以及庫存調整流水帳。重置後，系統將進入乾淨的初始運行狀態。
                  <strong>此操作需要員工安全 PIN 碼，且無法撤銷！</strong>
                </p>

                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">
                    🔑 安全驗證：請輸入 6 位數員工安全 PIN 碼以授權：
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="請輸入解鎖 PIN"
                    className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-center tracking-widest text-[14px] text-white focus:outline-none focus:border-rose-500"
                    value={sanitizePin}
                    onChange={(e) => setSanitizePin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sanitize-members-checkbox"
                    checked={clearLocalMembers}
                    onChange={(e) => setClearLocalMembers(e.target.checked)}
                    className="rounded bg-black border-white/10 text-rose-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <label
                    htmlFor="sanitize-members-checkbox"
                    className="text-zinc-300 text-[11px] select-none cursor-pointer"
                  >
                    同時清空瀏覽器 LocalStorage 中的 Google 會員列表。
                  </label>
                </div>

                {sanitizeError && (
                  <div className="p-2 bg-rose-500/10 text-rose-400 text-[11px] font-bold rounded-lg border border-rose-500/20">
                    ⚠️ {sanitizeError}
                  </div>
                )}
                {sanitizeSuccess && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/20">
                    🎯 {sanitizeSuccess}
                  </div>
                )}

                <button
                  type="button"
                  disabled={sanitizeLoading}
                  onClick={handleSanitizeSystemData}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-lg active:scale-95 cursor-pointer text-[12px] shadow-sm tracking-wide transition flex items-center justify-center gap-1.5 align-middle"
                >
                  <Trash2 size={13} />
                  <span>
                    {sanitizeLoading ? '資料清除中...' : '🚨 確認清除所有測試單據及暫存日誌'}
                  </span>
                </button>
              </div>
            </div>

            {/* 時段營業時間設定 (精確到分鐘) */}
            <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 font-sans text-left md:col-span-2">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                  營業控制與點餐時間鎖定
                </span>
                <h4 className="font-bold text-sm mt-0.5">
                  時段營業時間設定 Custom Operating Hours (精確到分鐘)
                </h4>
              </div>
              <div className="space-y-4 text-xs select-none">
                {opHoursError && (
                  <div className="p-2 bg-rose-500/10 text-rose-400 text-[11px] font-bold rounded-lg border border-rose-500/20">
                    ⚠️ {opHoursError}
                  </div>
                )}
                {opHoursSuccess && (
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/20">
                    🎯 {opHoursSuccess}
                  </div>
                )}

                <p className="text-[11px] text-zinc-400 leading-normal">
                  系統在設定的營業時間內自動解鎖「顧客購物車」點餐下單權限。非營業時間，顧客僅能「瀏覽菜單」但無法加入購物車或點餐。安全與時間同步以伺服器為精準標準基準，防止任何用戶端修改時間繞過機制的操作！
                </p>

                <div className="space-y-4">
                  {tempOperatingHours.map((slot, idx) => {
                    const daysOfWeekLabels = ['日', '一', '二', '三', '四', '五', '六'];
                    return (
                      <div
                        key={slot.id || idx}
                        className="p-3 bg-black/40 border border-[#E5B453]/10 rounded-xl space-y-3 relative"
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={slot.name}
                            onChange={(e) => {
                              const updated = [...tempOperatingHours];
                              updated[idx].name = e.target.value;
                              setTempOperatingHours(updated);
                            }}
                            className="bg-transparent border-b border-white/10 hover:border-white/30 focus:border-[#E5B453] text-[12px] font-bold text-white focus:outline-none pb-0.5 w-[160px] truncate"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...tempOperatingHours];
                                updated[idx].isActive = !updated[idx].isActive;
                                setTempOperatingHours(updated);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                slot.isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                              }`}
                            >
                              {slot.isActive ? '● 啟用中 Open' : '○ 已關閉 Closed'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = tempOperatingHours.filter(
                                  (_, sIdx) => sIdx !== idx,
                                );
                                setTempOperatingHours(updated);
                              }}
                              className="p-1 hover:bg-rose-500/10 rounded text-rose-400"
                              title="刪除此時段"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Start and End Inputs */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                              開始時間 (HH:MM)
                            </label>
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => {
                                const updated = [...tempOperatingHours];
                                updated[idx].start = e.target.value;
                                setTempOperatingHours(updated);
                              }}
                              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 font-mono text-center text-white focus:ring-1 focus:ring-[#E5B453] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-1 font-semibold">
                              結束時間 (HH:MM)
                            </label>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => {
                                const updated = [...tempOperatingHours];
                                updated[idx].end = e.target.value;
                                setTempOperatingHours(updated);
                              }}
                              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 font-mono text-center text-white focus:ring-1 focus:ring-[#E5B453] focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Weekday Selection */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-zinc-400 block font-semibold">
                            星期重複設定
                          </span>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {daysOfWeekLabels.map((label, dayNum) => {
                              const isSelected = slot.days ? slot.days.includes(dayNum) : false;
                              return (
                                <button
                                  type="button"
                                  key={dayNum}
                                  onClick={() => {
                                    const updated = [...tempOperatingHours];
                                    let currentDays = slot.days ? [...slot.days] : [];
                                    if (currentDays.includes(dayNum)) {
                                      currentDays = currentDays.filter((d) => d !== dayNum);
                                    } else {
                                      currentDays.push(dayNum);
                                      currentDays.sort((a, b) => a - b);
                                    }
                                    updated[idx].days = currentDays;
                                    setTempOperatingHours(updated);
                                  }}
                                  className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center transition border ${
                                    isSelected
                                      ? 'bg-thai-gold/20 text-thai-gold border-thai-gold/40'
                                      : 'bg-black/40 text-zinc-500 border-white/5 hover:border-white/10'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 預約專用 / 可預約時段設定 - 整合式雙模切換按鈕 */}
                        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-300 block">
                              時段模式與權限
                            </span>
                            <span className="text-[10px] text-zinc-400 block leading-tight">
                              {slot.isReservableOnly
                                ? '🎟️【僅限預約】：營業時間外開放預約桌席，僅對已預約顧客開放點餐進場。'
                                : '🌐【一般營業】：開放現場與所有顧客自由進場與點餐。'}
                            </span>
                          </div>
                          <div className="inline-flex bg-black/60 p-1 rounded-xl border border-white/10 shrink-0 select-none">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...tempOperatingHours];
                                updated[idx].isReservableOnly = false;
                                setTempOperatingHours(updated);
                              }}
                              className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer ${
                                !slot.isReservableOnly
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                              title="切換為開放現場所有顧客之一般營業時段"
                            >
                              <span>🌐 一般營業</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...tempOperatingHours];
                                updated[idx].isReservableOnly = true;
                                setTempOperatingHours(updated);
                              }}
                              className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer ${
                                slot.isReservableOnly
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                              title="切換為僅供已預約顧客進場與點餐之預約專用時段"
                            >
                              <span>🎟️ 僅限預約</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1 font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      const newSlot = {
                        id: `oh-manual-${Date.now()}`,
                        name: `營業時段 ${tempOperatingHours.length + 1}`,
                        start: '11:00',
                        end: '14:30',
                        days: [0, 1, 2, 3, 4, 5, 6],
                        isActive: true,
                        isReservableOnly: false,
                      };
                      setTempOperatingHours([...tempOperatingHours, newSlot]);
                    }}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-750 text-white font-extrabold rounded-lg active:scale-95 cursor-pointer text-[11px] shadow-sm tracking-wide border border-white/10 flex items-center justify-center gap-1 transition"
                  >
                    <Plus size={13} />
                    <span>新增一般營業時段</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newSlot = {
                        id: `oh-res-${Date.now()}`,
                        name: `預約專用時段 ${tempOperatingHours.length + 1}`,
                        start: '14:30',
                        end: '17:30',
                        days: [0, 1, 2, 3, 4, 5, 6],
                        isActive: true,
                        isReservableOnly: true,
                      };
                      setTempOperatingHours([...tempOperatingHours, newSlot]);
                    }}
                    className="flex-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold rounded-lg active:scale-95 cursor-pointer text-[11px] shadow-sm tracking-wide border border-amber-500/30 flex items-center justify-center gap-1 transition"
                  >
                    <Plus size={13} />
                    <span>新增可預約時段 (營業時間外預約專用)</span>
                  </button>
                </div>

                <div className="border-t border-white/5 pt-4 mt-2">
                  <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase mb-1">
                    公休日 / 特殊店休設定 (Rest Days)
                  </span>
                  <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">
                    在下方指定的日期，系統將會自動處於全天公休店休狀態
                    (鎖定點餐購物車)。您可以自訂任何日期，格式為 YYYY-MM-DD。
                  </p>

                  {/* Rest days tags list */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tempRestDays.length === 0 ? (
                      <span className="text-[11px] text-zinc-500 italic">
                        目前無設定公休日 No scheduled rest days.
                      </span>
                    ) : (
                      tempRestDays.map((dateStr, dIdx) => (
                        <div
                          key={dIdx}
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded-md text-[11px] font-mono font-bold"
                        >
                          <span>📅 {dateStr}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTempRestDays(tempRestDays.filter((_, idx) => idx !== dIdx));
                            }}
                            className="bg-transparent text-rose-400 hover:text-rose-200 ml-1 font-bold focus:outline-none cursor-pointer text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add holiday date picker & button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      id="new-rest-day-input"
                      className="bg-[#121212] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-[#E5B453] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(
                          'new-rest-day-input',
                        ) as HTMLInputElement;
                        if (el && el.value) {
                          const val = el.value.trim();
                          if (tempRestDays.includes(val)) {
                            alert('該公休日期已經存在於列表中！');
                            return;
                          }
                          setTempRestDays([...tempRestDays, val].sort());
                          el.value = '';
                        } else {
                          alert('請先選擇有效的日期！');
                        }
                      }}
                      className="bg-zinc-800 hover:bg-zinc-750 text-white font-extrabold px-3 py-1 rounded-lg text-xs tracking-wider transition active:scale-95 cursor-pointer border border-white/10"
                    >
                      + 新增此公休日期
                    </button>
                  </div>
                </div>

                <div className="pt-2 font-sans border-t border-white/5 mt-4">
                  <button
                    type="button"
                    onClick={() => handleSaveOperatingHoursLocal(tempOperatingHours, tempRestDays)}
                    className="w-full py-2.5 bg-[#E5B453] hover:bg-amber-400 text-[#0F0F0F] font-black rounded-lg active:scale-95 cursor-pointer text-[12px] shadow-md tracking-widest transition flex items-center justify-center gap-1 uppercase"
                  >
                    <span>💾 儲存營業時間與公休日配置</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 📢 客席專用 QR CODE 與 NFC 感應點餐配置面板 (Firebase 託管驗證) */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 text-left text-xs space-y-4 col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2.5 gap-2">
              <div>
                <span className="text-[10px] font-bold text-[#E5B453] tracking-widest block uppercase">
                  FIREBASE DEPLOYED PORTAL
                </span>
                <h4 className="font-bold text-sm text-white">
                  📲 餐廳感應點餐元件：QR Code 暨 NFC 智慧標籤全球管理器
                </h4>
              </div>
              <div className="bg-[#E5B453]/10 text-[#E5B453] px-2.5 py-1 rounded-full font-mono text-[10px] border border-[#E5B453]/20 flex items-center gap-1.5 self-start sm:self-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                託管網站: sabay-bbq-order.firebaseapp.com
              </div>
            </div>

            <p className="text-white/50 leading-relaxed font-sans">
              系統已對接並完全優化顧客端的 <strong>?table=桌號</strong> 參數監聽器與{' '}
              <strong>?table=takeout</strong> 外帶自動序號生成邏輯。
              管理人員在此處可一鍵式預覽、印製各桌別的 NFC 感應與 QR Code 連結，並提供完整 NFC
              手機感應燒錄指引，實現顧客貼近手機一鍵極速開網即點！
            </p>

            {/* Quick validation dashboard */}
            <div className="bg-black/25 rounded-xl border border-white/5 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <p className="font-bold text-white/40 uppercase tracking-wider text-[9px]">
                  系統核心路由驗證 Network Gateway
                </p>
                <div className="space-y-1 text-zinc-300">
                  <div className="flex items-center text-emerald-400 font-bold gap-1 text-[11px]">
                    <span className="text-emerald-400">✓</span> 顧客端監聽接收器 (Param Listener)
                    Active
                  </div>
                  <div className="flex items-center text-emerald-400 font-bold gap-1 text-[11px]">
                    <span className="text-emerald-400">✓</span> 外帶自取自動派發序列 (Seq Generator)
                    Active
                  </div>
                  <div className="flex items-center text-emerald-400 font-bold gap-1 text-[11px]">
                    <span className="text-emerald-400">✓</span> NFC NDEF URI 符合 100% 行動裝置規約
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <p className="font-bold text-white/40 uppercase tracking-wider text-[9px]">
                  Firebase 主域名生產分發鏈 Deployed Routing Target
                </p>
                <div className="bg-[#0e0e0e] border border-white/5 rounded-lg p-2 flex items-center justify-between gap-1 font-mono text-[10.5px]">
                  <span className="text-zinc-400 truncate">https://sabay-bbq-order.web.app/</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('https://sabay-bbq-order.web.app/');
                        setCopiedTableId('main-logo');
                        setTimeout(() => setCopiedTableId(null), 1500);
                      }}
                      className="text-[#E5B453] hover:text-amber-400 p-1 bg-white/[0.03] hover:bg-white/[0.08] rounded transition cursor-pointer"
                      title="複製主域名"
                    >
                      {copiedTableId === 'main-logo' ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                    <a
                      href="https://sabay-bbq-order.web.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-white p-1 bg-white/[0.03] hover:bg-white/[0.08] rounded"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  這是系統部署於 Firebase Hosting 的最終外連網址分發中樞，可對應全店桌席感應需求。
                </p>
              </div>
            </div>

            {/* QR/NFC Selection Slider / Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
              {/* Left Selector & Link Lists */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="border border-white/5 bg-black/25 rounded-lg p-3">
                  <span className="text-[10px] font-bold text-[#E5B453] uppercase tracking-wider block mb-2">
                    ① 請選擇欲檢視與生成的席位點：
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQrPreviewId('takeout');
                        setTableError(null);
                        setTableSuccess(null);
                      }}
                      className={`py-2 px-1 rounded font-bold transition flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                        selectedQrPreviewId === 'takeout'
                          ? 'bg-[#E5B453] text-[#0F0F0F] border-[#E5B453] shadow-md'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                      }`}
                    >
                      <ShoppingBag size={14} className="mb-0.5" />
                      <span className="text-[10px]">🥡 外帶專用</span>
                    </button>
                    {tables.map((tb) => (
                      <button
                        key={tb.id}
                        type="button"
                        onClick={() => {
                          setSelectedQrPreviewId(tb.id);
                          setTableError(null);
                          setTableSuccess(null);
                        }}
                        className={`py-2 px-1 rounded font-bold transition flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                          selectedQrPreviewId === tb.id
                            ? 'bg-[#E5B453] text-[#0F0F0F] border-[#E5B453] shadow-md'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                        }`}
                      >
                        <QrCode size={14} className="mb-0.5" />
                        <span className="text-[10px]">{tb.id} 號桌席</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-white/5 bg-black/20 rounded-lg p-3 space-y-2 text-[11px] text-zinc-300">
                  <span className="text-[10px] font-bold text-[#E5B453] uppercase tracking-wider block">
                    Firebase 託管下的 NFC/QR 精準指向連結
                  </span>

                  {(() => {
                    const isTakeout = selectedQrPreviewId === 'takeout';
                    const label = isTakeout
                      ? '🥡 外帶自取顧客專用定位點'
                      : `🥢 內用客席第 ${selectedQrPreviewId} 桌`;
                    const relativePath = isTakeout
                      ? '/?table=takeout'
                      : `/?table=${selectedQrPreviewId}`;
                    const firebaseProdUrl = `https://sabay-bbq-order.web.app/${isTakeout ? '?table=takeout' : `?table=${selectedQrPreviewId}`}`;

                    return (
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-white font-extrabold text-xs">
                          <span>{label}</span>
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0.5 rounded text-[9px]">
                            路由校核良好 ✓
                          </span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 block">
                            內部相對路徑 (Local Route Match):
                          </label>
                          <div className="bg-[#121212] p-1.5 rounded font-mono text-[10px] text-zinc-400 border border-white/5 break-all select-all flex justify-between items-center">
                            <span>{relativePath}</span>
                            <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1 rounded-sm uppercase tracking-widest shrink-0 ml-1">
                              模擬運作
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 block">
                            Firebase 生產域名路徑 (Production Host URL):
                          </label>
                          <div className="bg-[#121212] p-1.5 rounded font-mono text-[10px] text-amber-100 border border-white/10 break-all select-all flex items-center justify-between gap-1">
                            <span className="text-amber-200">{firebaseProdUrl}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(firebaseProdUrl);
                                setCopiedTableId(selectedQrPreviewId);
                                setTimeout(() => setCopiedTableId(null), 1500);
                              }}
                              className="text-[#E5B453] hover:text-amber-400 p-1 bg-white/[0.03] hover:bg-white/[0.1] rounded transition shrink-0 cursor-pointer"
                              title="複製完整點餐網址"
                            >
                              {copiedTableId === selectedQrPreviewId ? (
                                <Check size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right Media Previews, QR Standee Rendering, NFC Guides */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual QR Code Card standee */}
                {(() => {
                  const isTakeout = selectedQrPreviewId === 'takeout';
                  const label = isTakeout ? 'TAKE-OUT' : `TABLE ${selectedQrPreviewId}`;
                  const labelZh = isTakeout
                    ? '外 帶 自 取 由 此 點 餐'
                    : `第 ${selectedQrPreviewId} 桌 位 內 用 點 餐`;
                  const prodUrl = isTakeout
                    ? 'https://sabay-bbq-order.web.app/?table=takeout'
                    : `https://sabay-bbq-order.web.app/?table=${selectedQrPreviewId}`;

                  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=20-20-20&data=${encodeURIComponent(prodUrl)}`;

                  return (
                    <div className="border border-white/10 bg-black/35 rounded-xl p-4 flex flex-col items-center justify-center space-y-3 relative overflow-hidden group">
                      {/* Decorative brand tag */}
                      <div className="absolute top-0 inset-x-0 bg-[#E5B453] text-[#0F0F0F] text-[9px] font-black tracking-widest text-center uppercase py-0.5 select-none font-mono">
                        SABAY BBQ Thai Express
                      </div>

                      <div className="bg-white p-3 rounded-xl shadow-lg border border-white/20 mt-3 flex flex-col items-center justify-center max-w-[170px] w-full">
                        <img
                          src={qrImgUrl}
                          alt={`QR Code Table ${selectedQrPreviewId}`}
                          className="w-full aspect-square border border-slate-100 object-contain select-none"
                          referrerPolicy="no-referrer"
                        />
                        <div className="mt-1 text-[8px] text-slate-400 font-mono tracking-tighter uppercase font-bold text-center">
                          sabay bbq cloud system
                        </div>
                      </div>

                      <div className="text-center space-y-1 w-full">
                        <div className="text-[13px] text-[#E5B453] font-serif font-black tracking-widest uppercase">
                          {label}
                        </div>
                        <div className="text-[10px] text-white/95 font-bold tracking-wider bg-white/5 px-2 py-0.5 rounded truncate">
                          {labelZh}
                        </div>
                        <p className="text-[8.5px] text-zinc-400">
                          請用智慧手機感應 NFC 或相機掃描條碼
                        </p>
                      </div>

                      <div className="w-full flex gap-1 text-[10px] pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const printWindow = window.open();
                            if (printWindow) {
                              printWindow.document.write(`
                                <!DOCTYPE html>
                                <html>
                                  <head>
                                    <meta charset="UTF-8">
                                    <title>列印-席位 QR CODE</title>
                                    <style>
                                      body { text-align: center; font-family: "Microsoft JhengHei", "PingFang TC", "Heiti TC", "Noto Sans TC", system-ui, sans-serif; padding: 40px; }
                                      .card { border: 3px solid #000; padding: 40px; border-radius: 20px; display: inline-block; width: 300px; }
                                      h1 { font-size: 28px; margin: 0 0 10px; }
                                      h2 { font-size: 20px; margin: 0 0 20px; color: #555; }
                                      img { width: 220px; height: 220px; }
                                      .footer { margin-top: 25px; font-size: 11px; color: #888; }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="card">
                                      <h1>SABAY BBQ & THAI HOTPOT</h1>
                                      <h2>${labelZh}</h2>
                                      <img src="${qrImgUrl}" />
                                      <div class="footer">
                                        NFC 感應同效 • 雙向無接觸點餐元件<br/>
                                        連結: ${prodUrl}
                                      </div>
                                    </div>
                                    <script>window.onload = function() { window.print(); }</script>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className="flex-1 py-1.5 border border-[#E5B453]/30 hover:border-[#E5B453] text-[#E5B453] hover:bg-[#E5B453]/5 font-bold rounded transition text-[10px] active:scale-95 cursor-pointer text-center"
                        >
                          🖨️ 獨立列印
                        </button>
                        <a
                          href={qrImgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded text-center block transition text-[10px]"
                        >
                          📥 下載條碼
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {/* NFC Burning Instructions */}
                <div className="border border-white/10 bg-black/35 rounded-xl p-4 flex flex-col justify-between text-left space-y-3 relative overflow-hidden">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-extrabold border-b border-white/5 pb-1.5">
                    <span className="text-[12px]">📶 NTAG 晶片寫入與 NFC 標籤燒錄指示</span>
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                    NFC (近場通訊貼紙)
                    為進階點餐的完美體驗。將貼紙貼於餐桌桌面或玻璃立牌，顧客不需打開相機，只需手機靠近即可喚醒此點餐頁面並帶入桌號座次：
                  </p>

                  <div className="space-y-1.5 bg-[#0A0A0A] p-2 rounded-lg border border-white/5 text-[9.5px]">
                    <div className="space-y-1">
                      <span className="text-[#E5B453]/95 block font-bold">
                        🛠️ 燒寫步驟 / Writing Tool Steps
                      </span>
                      <ol className="list-decimal list-inside text-zinc-400 space-y-0.5 font-sans">
                        <li>
                          下載手機 App：<span className="text-white">NFC Tools</span> (免費下載)
                        </li>
                        <li>
                          進入 App 點選：<span className="text-white">【Write (寫入)】</span>
                        </li>
                        <li>
                          選擇：<span className="text-white">【Add a record】</span> &rarr;{' '}
                          <span className="text-white">【URL / URI】</span>
                        </li>
                        <li>將下方網址複製並寫入 NTAG213晶片：</li>
                      </ol>
                      <div className="bg-black border border-white/10 p-1 rounded font-mono text-[9px] text-[#E5B453] break-all select-all">
                        {selectedQrPreviewId === 'takeout'
                          ? 'https://sabay-bbq-order.web.app/?table=takeout'
                          : `https://sabay-bbq-order.web.app/?table=${selectedQrPreviewId}`}
                      </div>
                      <ol
                        start="5"
                        className="list-decimal list-inside text-zinc-400 space-y-0.5 font-sans"
                      >
                        <li>
                          點擊 <span className="text-white">【Write】</span>，手機靠貼紙即完成！
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded p-1.5 flex items-start gap-1 text-[9.5px]">
                    <span className="shrink-0">ℹ️</span>
                    <span>
                      建議選用防金屬干擾NTAG213系列貼紙，能防止因鋼製木餐桌造成的電磁波感應下降。
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SCREEN SUBTAB: PRINTER SETTINGS ==================== */}
      {activeSubTab === 'printer' && (
        <div className="space-y-6 animate-fadeIn text-left font-sans" id="subtab-section-printer">
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
              <span className="text-xl">🖨️</span>
              <div>
                <h4 className="font-bold text-sm text-white">
                  印表機與硬體規格管理器 (Printer Setup Center)
                </h4>
                <p className="text-white/40 text-xs">
                  分離設置廚房KDS備餐印表機與前台帳單收銀印表機，不同模組各司其職，隨寬度自適應縮放字體大小。
                </p>
              </div>
            </div>

            {printerSaveSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-xl text-center text-xs">
                {printerSaveSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. KDS Kitchen Printer config */}
              <div className="bg-black/40 border border-[#E5B453]/20 p-4 rounded-xl space-y-4">
                <span className="text-xs text-[#E5B453] font-extrabold block uppercase tracking-wider">
                  🍳 廚房 KDS 工作票印表機
                </span>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1">連接方式 Connection Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['USB', 'IP', 'LPT'].map((type) => (
                        <button
                          key={`kit-conn-${type}`}
                          type="button"
                          onClick={() =>
                            setKitchenPrinter({ ...kitchenPrinter, connectionType: type as any })
                          }
                          className={`py-1.5 rounded-lg border font-bold text-center cursor-pointer text-xs ${
                            kitchenPrinter.connectionType === type
                              ? 'bg-[#E5B453]/20 border-[#E5B453] text-[#E5B453]'
                              : 'bg-zinc-900 border-white/5 text-zinc-400'
                          }`}
                        >
                          {type === 'USB' ? '🔌 USB' : type === 'IP' ? '🌐 網路 IP' : '🖨️ LPT 埠'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {kitchenPrinter.connectionType === 'IP' ? (
                    <div>
                      <label className="text-zinc-400 block mb-1">印表機固定 IP 位址</label>
                      <input
                        type="text"
                        value={kitchenPrinter.ip}
                        onChange={(e) =>
                          setKitchenPrinter({ ...kitchenPrinter, ip: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-mono"
                        placeholder="例如: 192.168.1.101"
                      />
                    </div>
                  ) : kitchenPrinter.connectionType === 'LPT' ? (
                    <div>
                      <label className="text-zinc-400 block mb-1">
                        Parallel LPT 埠位置 (LPT1, LPT2...)
                      </label>
                      <input
                        type="text"
                        value={kitchenPrinter.usbPort}
                        onChange={(e) =>
                          setKitchenPrinter({ ...kitchenPrinter, usbPort: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-mono"
                        placeholder="例如: LPT1"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-zinc-400 block mb-1">
                        USB 埠位置 USB Port (ComPath)
                      </label>
                      <input
                        type="text"
                        value={kitchenPrinter.usbPort}
                        onChange={(e) =>
                          setKitchenPrinter({ ...kitchenPrinter, usbPort: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-mono"
                        placeholder="例如: USB001, /dev/usb/lp0"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-zinc-400 block mb-1">紙張出單寬度 Width Specs</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['58mm', '80mm'].map((w) => (
                        <button
                          key={`kit-w-${w}`}
                          type="button"
                          onClick={() =>
                            setKitchenPrinter({
                              ...kitchenPrinter,
                              width: w as any,
                              fontSizeFactor: w === '58mm' ? 0.8 : 1.0,
                            })
                          }
                          className={`py-1.5 rounded-lg border font-bold text-center cursor-pointer ${
                            kitchenPrinter.width === w
                              ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                              : 'bg-zinc-900 border-white/5 text-zinc-400'
                          }`}
                        >
                          {w} {w === '58mm' ? '(縮放 0.8x)' : '(標準 1.0x)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">出單字體縮放比例 Font Scale</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={kitchenPrinter.fontSizeFactor}
                      onChange={(e) =>
                        setKitchenPrinter({
                          ...kitchenPrinter,
                          fontSizeFactor: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-[#E5B453]"
                    />
                    <div className="flex justify-between font-mono text-[10px] text-zinc-500 mt-1">
                      <span>最小(0.5x)</span>
                      <span className="text-[#E5B453] font-bold">
                        當前: {kitchenPrinter.fontSizeFactor}x
                      </span>
                      <span>最大(2.0x)</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">自訂列印抬頭 (廚房名稱)</label>
                    <input
                      type="text"
                      value={kitchenPrinter.restaurantName}
                      onChange={(e) =>
                        setKitchenPrinter({ ...kitchenPrinter, restaurantName: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">
                      表頭自訂引言 Pre-title Message
                    </label>
                    <input
                      type="text"
                      value={kitchenPrinter.headerPrefix}
                      onChange={(e) =>
                        setKitchenPrinter({ ...kitchenPrinter, headerPrefix: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">表尾注意事項 Footer Warning</label>
                    <input
                      type="text"
                      value={kitchenPrinter.footerSuffix}
                      onChange={(e) =>
                        setKitchenPrinter({ ...kitchenPrinter, footerSuffix: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintConfirmData({
                          title: `🍳 KDS 廚房印表機測試列印 (${kitchenPrinter.restaurantName})`,
                          ip: kitchenPrinter.ip || '192.168.123.100',
                          onConfirm: async () => {
                            if (onPrintTestPage) {
                              try {
                                const res = await onPrintTestPage('kitchen');
                                if (res.success) {
                                  alert('✓ 🍳 廚房測試列印請求已成功發送至 IP 印表機！');
                                } else {
                                  alert(`⚠️ 列印失敗: ${res.error || '無法存取設備'}`);
                                }
                              } catch (err) {
                                alert('⚠️ 列印失敗，連線異常');
                              }
                            } else {
                              alert('✓ 🍳 廚房測試列印頁已成功產生！');
                            }
                          },
                        });
                      }}
                      className="w-full py-2 bg-[#E5B453]/10 hover:bg-[#E5B453]/20 active:scale-95 border border-[#E5B453]/30 text-amber-300 font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Printer size={12} className="text-amber-400 animate-pulse" />
                      <span>發送 KDS 測試頁 Test KDS Page</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Front Receipt/Bill Printer config */}
              <div className="bg-black/40 border border-blue-500/20 p-4 rounded-xl space-y-4">
                <span className="text-xs text-blue-400 font-extrabold block uppercase tracking-wider">
                  🧾 前台帳單與收銀明細印表機
                </span>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1">連接方式 Connection Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['USB', 'IP', 'LPT'].map((type) => (
                        <button
                          key={`bill-conn-${type}`}
                          type="button"
                          onClick={() =>
                            setBillPrinter({ ...billPrinter, connectionType: type as any })
                          }
                          className={`py-1.5 rounded-lg border font-bold text-center cursor-pointer text-xs ${
                            billPrinter.connectionType === type
                              ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                              : 'bg-zinc-900 border-white/5 text-zinc-400'
                          }`}
                        >
                          {type === 'USB' ? '🔌 USB' : type === 'IP' ? '🌐 網路 IP' : '🖨️ LPT 埠'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {billPrinter.connectionType === 'IP' ? (
                    <div>
                      <label className="text-zinc-400 block mb-1">印表機固定 IP 位址</label>
                      <input
                        type="text"
                        value={billPrinter.ip}
                        onChange={(e) => setBillPrinter({ ...billPrinter, ip: e.target.value })}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-mono"
                        placeholder="例如: 192.168.1.102"
                      />
                    </div>
                  ) : billPrinter.connectionType === 'LPT' ? (
                    <div>
                      <label className="text-zinc-400 block mb-1">
                        Parallel LPT 埠位置 (LPT1, LPT2...)
                      </label>
                      <input
                        type="text"
                        value={billPrinter.usbPort}
                        onChange={(e) =>
                          setBillPrinter({ ...billPrinter, usbPort: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-white font-mono"
                        placeholder="例如: LPT1"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-zinc-400 block mb-1">
                        USB 埠位置 USB Port (ComPath)
                      </label>
                      <input
                        type="text"
                        value={billPrinter.usbPort}
                        onChange={(e) =>
                          setBillPrinter({ ...billPrinter, usbPort: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 text-white font-mono"
                        placeholder="例如: USB002, /dev/usb/lp1"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-zinc-400 block mb-1">紙張出單寬度 Width Specs</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['58mm', '80mm'].map((w) => (
                        <button
                          key={`bill-w-${w}`}
                          type="button"
                          onClick={() =>
                            setBillPrinter({
                              ...billPrinter,
                              width: w as any,
                              fontSizeFactor: w === '58mm' ? 0.8 : 1.0,
                            })
                          }
                          className={`py-1.5 rounded-lg border font-bold text-center cursor-pointer ${
                            billPrinter.width === w
                              ? 'bg-blue-400/20 border-blue-400 text-blue-300'
                              : 'bg-zinc-900 border-white/5 text-zinc-400'
                          }`}
                        >
                          {w} {w === '58mm' ? '(縮放 0.8x)' : '(標準 1.0x)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">出單字體縮放比例 Font Scale</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={billPrinter.fontSizeFactor}
                      onChange={(e) =>
                        setBillPrinter({
                          ...billPrinter,
                          fontSizeFactor: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between font-mono text-[10px] text-zinc-500 mt-1">
                      <span>最小(0.5x)</span>
                      <span className="text-blue-400 font-bold">
                        當前: {billPrinter.fontSizeFactor}x
                      </span>
                      <span>最大(2.0x)</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">抬頭餐廳名稱 Restaurant Name</label>
                    <input
                      type="text"
                      value={billPrinter.restaurantName}
                      onChange={(e) =>
                        setBillPrinter({ ...billPrinter, restaurantName: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-400 block mb-1">電話 Tel</label>
                      <input
                        type="text"
                        value={billPrinter.printTelephone}
                        onChange={(e) =>
                          setBillPrinter({ ...billPrinter, printTelephone: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">開啟出單時間戳</label>
                      <div className="flex items-center h-9 pl-1">
                        <input
                          type="checkbox"
                          id="bill-checkbox-time"
                          checked={billPrinter.printTimeEnabled}
                          onChange={(e) =>
                            setBillPrinter({ ...billPrinter, printTimeEnabled: e.target.checked })
                          }
                          className="w-4 h-4 text-blue-500 bg-[#161616] border-white/10 rounded focus:ring-0"
                        />
                        <label
                          htmlFor="bill-checkbox-time"
                          className="text-[11px] text-zinc-300 ml-2 cursor-pointer font-bold"
                        >
                          列印時標記精確時間
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">列印餐廳地址 Address</label>
                    <input
                      type="text"
                      value={billPrinter.printAddress}
                      onChange={(e) =>
                        setBillPrinter({ ...billPrinter, printAddress: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-sans text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">表頭促銷首語 Header Slogan</label>
                    <input
                      type="text"
                      value={billPrinter.headerPrefix}
                      onChange={(e) =>
                        setBillPrinter({ ...billPrinter, headerPrefix: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">
                      副聯結尾致謝辭 Thank You Message
                    </label>
                    <input
                      type="text"
                      value={billPrinter.footerSuffix}
                      onChange={(e) =>
                        setBillPrinter({ ...billPrinter, footerSuffix: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white"
                    />
                  </div>

                  {/* 現金收銀抽屜連動設定 Cash Drawer Interlock Setup */}
                  <div className="bg-zinc-950 p-4 rounded-xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-rose-400">🔓</span>
                        <span className="font-bold text-xs text-white">
                          連動開啟現金收銀抽屜 Interlock Drawer
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={billPrinter.cashDrawerEnabled}
                          onChange={(e) =>
                            setBillPrinter({ ...billPrinter, cashDrawerEnabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600 peer-checked:after:bg-white"></div>
                      </label>
                    </div>

                    {billPrinter.cashDrawerEnabled && (
                      <div className="space-y-3 pt-2 border-t border-white/5 text-[11px] animate-fadeIn">
                        <div>
                          <label className="text-zinc-400 block mb-1">
                            硬體驅動連動技術 Driver Layer
                          </label>
                          <select
                            value={billPrinter.cashDrawerDriver}
                            onChange={(e) =>
                              setBillPrinter({
                                ...billPrinter,
                                cashDrawerDriver: e.target.value as any,
                              })
                            }
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-sans"
                          >
                            <option value="OPOS">
                              UPOS / OPOS 控制驅動標準 (EPSON/Star 零售大廠標準)
                            </option>
                            <option value="POS_NET">
                              POS for .NET 類別庫 (Microsoft 點對點標準)
                            </option>
                            <option value="ESC_POS_RAW">
                              ESC/POS 直通 RAW 指令 (winspool.drv / 脈衝指令)
                            </option>
                          </select>
                        </div>

                        {(billPrinter.cashDrawerDriver === 'OPOS' ||
                          billPrinter.cashDrawerDriver === 'POS_NET') && (
                          <div>
                            <label className="text-zinc-400 block mb-1">
                              OPOS 宣告之設備編號 (Logical Device Name / ID)
                            </label>
                            <input
                              type="text"
                              value={billPrinter.cashDrawerOposName}
                              onChange={(e) =>
                                setBillPrinter({
                                  ...billPrinter,
                                  cashDrawerOposName: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-mono"
                              placeholder="例如: CashDrawer1, Epson_Drawer_Pin2"
                            />
                          </div>
                        )}

                        {billPrinter.cashDrawerDriver === 'ESC_POS_RAW' && (
                          <div>
                            <label className="text-zinc-400 block mb-1">
                              ESC/POS 脈衝開鎖指令 (HEX 16進制碼)
                            </label>
                            <input
                              type="text"
                              value={billPrinter.cashDrawerEscPosCommand}
                              onChange={(e) =>
                                setBillPrinter({
                                  ...billPrinter,
                                  cashDrawerEscPosCommand: e.target.value
                                    .toUpperCase()
                                    .replace(/\s/g, ''),
                                })
                              }
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-white font-mono"
                              placeholder="例如: 1B700019FA"
                            />
                            <div className="flex gap-1.5 mt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setBillPrinter({
                                    ...billPrinter,
                                    cashDrawerEscPosCommand: '1B700019FA',
                                  })
                                }
                                className={`px-2 py-1 rounded text-[10px] border transition ${
                                  billPrinter.cashDrawerEscPosCommand === '1B700019FA'
                                    ? 'bg-rose-500/25 border-rose-500/50 text-rose-300'
                                    : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                                }`}
                              >
                                引腳 2 預設 (1B 70 00 19 FA)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setBillPrinter({
                                    ...billPrinter,
                                    cashDrawerEscPosCommand: '1B700119FA',
                                  })
                                }
                                className={`px-2 py-1 rounded text-[10px] border transition ${
                                  billPrinter.cashDrawerEscPosCommand === '1B700119FA'
                                    ? 'bg-rose-500/25 border-rose-500/50 text-rose-300'
                                    : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                                }`}
                              >
                                引腳 5 預設 (1B 70 01 19 FA)
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="pt-1.5">
                          <button
                            type="button"
                            onClick={handleManualOpenDrawer}
                            className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 border border-rose-500/30 text-rose-300 font-extrabold rounded-lg text-[10px] transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Unlock size={10} className="text-rose-400" />
                            <span>測試開啟現金抽屜 (Direct Open Test)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintConfirmData({
                          title: `🧾 前台收銀印表機測試列印 (${billPrinter.restaurantName})`,
                          ip: billPrinter.ip || '192.168.123.100',
                          onConfirm: async () => {
                            if (onPrintTestPage) {
                              try {
                                const res = await onPrintTestPage('bill');
                                if (res.success) {
                                  alert('✓ 🧾 前台收銀測試列印請求已成功發送至 LPT 埠印表機！');
                                } else {
                                  alert(`⚠️ 列印失敗: ${res.error || '無法存取設備'}`);
                                }
                              } catch (err) {
                                alert('⚠️ 列印失敗，連線異常');
                              }
                            } else {
                              alert('✓ 🧾 前台收銀測試列印頁已成功產生！');
                            }
                          },
                        });
                      }}
                      className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 border border-blue-500/30 text-blue-300 font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Printer size={12} className="text-blue-400 animate-pulse" />
                      <span>發送前台測試頁 Test Cashier Page</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex gap-2">
              <button
                type="button"
                onClick={handleSavePrinters}
                className="flex-1 py-3 bg-[#E5B453] hover:bg-amber-400 text-black font-black rounded-lg text-xs tracking-wider transition active:scale-95 cursor-pointer text-center"
              >
                💾 儲存並同步雙模組印表機設定 Store Printer Profiles
              </button>
            </div>
          </div>

          {/* Real-time Virtual Printer Buffer & History Logs */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-white/5 gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-amber-400 text-base">📄</span>
                <div>
                  <h5 className="font-bold text-sm text-white">
                    虛擬熱感印表即時快取管線 (Live Virtual Receipt Spool & Buffer)
                  </h5>
                  <p className="text-zinc-500 text-[10px]">
                    所有拋送至本機 9100
                    通訊埠的餐廳交代票與結帳收據，皆會同步寫入此高可靠即時緩衝區。
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
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
                        log.type === 'kitchen'
                          ? 'KITCHEN_WORK_TICKET'
                          : 'CUSTOMER_CHECKOUT_RECEIPT',
                        log.timestamp || '',
                        tableMark,
                        descriptionStr ? `"${descriptionStr.replace(/"/g, '""')}"` : 'N/A',
                        `"${cleanContent}"`,
                      ];
                    });

                    const csvContent = [
                      headers.join(','),
                      ...rows.map((row) => row.join(',')),
                    ].join('\n');

                    // Force UTF-8 BOM so Excel opens Chinese text correctly
                    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
                      type: 'text/csv;charset=utf-8;',
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute(
                      'download',
                      `Sabay_Manager_Print_Export_${new Date().toISOString().slice(0, 10)}.csv`,
                    );
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    alert('🎉 包含中英雙語客製化字元之歷史熱感出單 CSV 已成功產生並下載！');
                  }}
                  className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-[#E5B453] border border-[#E5B453]/20 hover:border-[#E5B453]/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="匯出歷史虛擬出單 CSV Excel 報表"
                >
                  <Download size={13} className="text-[#E5B453]" />
                  <span>匯出 CSV 報表 Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmActionModal({
                      isOpen: true,
                      title: '🗑️ 清空出單列印緩衝快取確定',
                      message:
                        '您確定要永久清空實體 / 虛擬收發出單機所有的出單列印日誌與緩衝快取資料嗎？此操作將永久移除歷史單據紀錄，且無法復原。',
                      actionLabel: '確定清空 Clear Buffer',
                      onConfirm: async () => {
                        try {
                          const res = await apiFetch('/api/print-logs/clear', { method: 'POST' });
                          if (res.ok) {
                            fetchPrintLogs();
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      },
                    });
                  }}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer active:scale-95"
                  title="清空緩衝區"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {printLogs.length === 0 ? (
              <div className="text-center py-12 bg-black/20 rounded-xl border border-white/5 space-y-2">
                <Printer size={24} className="mx-auto text-zinc-600 animate-pulse" />
                <p className="text-xs text-zinc-500">
                  緩衝通道閒置中，今日尚無列印交單 Spool empty
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[360px] overflow-y-auto scrollbar-thin p-1">
                {printLogs
                  .slice()
                  .reverse()
                  .map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-black/45 border border-white/10 rounded-xl p-3.5 space-y-2 relative overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-[8.5px] font-black tracking-widest px-1.5 py-0.5 rounded font-mono uppercase ${
                              log.type === 'kitchen'
                                ? 'bg-amber-500/10 text-amber-300 border border-[#E5B453]/20'
                                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            }`}
                          >
                            {log.type === 'kitchen' ? 'KITCHEN' : 'BILL/BILLING'}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {log.timestamp}
                          </span>
                        </div>
                        <pre className="text-[9px] font-mono leading-tight whitespace-pre-wrap text-zinc-300/90 max-h-[140px] overflow-y-auto select-text scrollbar-thin py-1 bg-black/25 px-2 rounded-lg border border-white/5">
                          {log.content}
                        </pre>
                      </div>
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[8.5px] text-zinc-500 font-sans">
                        <span>SABAY CORE_V1.2</span>
                        <span className="text-emerald-400 font-bold font-mono">🟢 OK (V_9100)</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SCREEN SUBTAB: MENU OPTION RULES MANAGER ==================== */}
      {activeSubTab === 'options' && (
        <div className="space-y-6 animate-fadeIn text-left font-sans" id="subtab-section-options">
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
              <span className="text-xl">🧩</span>
              <div>
                <h4 className="font-bold text-sm text-white">
                  餐點客製附加選項規則管理器 (Global Choice Rules Manager)
                </h4>
                <p className="text-white/40 text-xs">
                  在此建立全店共用客製選項規則。例如：加配料與價格、辣度熟度細則等，統一發布至餐點附加池中。
                </p>
              </div>
            </div>

            {/* Create Rule Form */}
            <div className="bg-[#202020] border border-white/5 p-4 rounded-xl space-y-3">
              <span className="text-xs font-bold text-[#E5B453] tracking-widest block uppercase">
                ➕ 新增一筆全域附加共用選項規則
              </span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">
                    選項名稱 (e.g. 加河粉, 小鮮蝦)
                  </label>
                  <input
                    type="text"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                    placeholder="輸入例如：加河粉"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">客製項目分類</label>
                  <select
                    value={newRuleCategory}
                    onChange={(e) => setNewRuleCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="加配料">加配料 (Extra Ingredients)</option>
                    <option value="熟度調整">熟度調整 (Cooking Level)</option>
                    <option value="辣度調整">辣度調整 (Spiciness)</option>
                    <option value="主食更換">主食更換 (Main Carb)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">額外附加價格 NT$</label>
                  <input
                    type="number"
                    min="0"
                    value={newRulePrice === 0 || newRulePrice === '' ? '' : newRulePrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setNewRulePrice('');
                      } else {
                        const num = parseInt(val, 10);
                        setNewRulePrice(isNaN(num) ? 0 : num);
                      }
                    }}
                    placeholder="0"
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddGlobalRule}
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg text-xs leading-none transition active:scale-95 cursor-pointer"
                  >
                    新增此選項規則
                  </button>
                </div>
              </div>
            </div>

            {/* Rules DB List */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-bold block uppercase tracking-wider">
                🗂️ 全店共用客製選項規則資料庫
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {globalRules.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-4">暫未建立任何全域加選選項</p>
                ) : (
                  globalRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-bold text-[#E5B453] bg-[#E5B453]/10 px-1.5 py-0.5 rounded border border-[#E5B453]/20">
                            {rule.category}
                          </span>
                          <span className="text-xs font-bold text-white leading-none">
                            {getLocalizedText(rule.name, 'zh')}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-400">
                          額外附帶價格:{' '}
                          <span className="text-amber-300 font-extrabold">NT$ {rule.price}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGlobalRule(rule.id)}
                        className="text-[10px] bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer"
                      >
                        刪除
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ==================== AUTOMATIC PACKAGE PROMO COMBO DISCOUNT ==================== */}
          <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🎁</span>
                <div>
                  <h4 className="font-bold text-sm text-white">
                    自動多重套餐組合折抵活動設定 (Multiple Custom Automatic Combo Settings)
                  </h4>
                  <p className="text-white/40 text-xs">
                    可自訂多個不同名稱、件數及折抵金額的自動套餐規則，並能一鍵將其新增至菜單內作為品項販售！
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newCombo = {
                    id: `combo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: '',
                    enabled: false,
                    requiredQty: 0,
                    discountAmount: 0,
                    eligibleItemIds: [],
                  };
                  setTempPromoCombos([...tempPromoCombos, newCombo]);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition active:scale-95 flex items-center space-x-1 cursor-pointer shadow"
              >
                <span>➕ 新增全新自動套餐組合</span>
              </button>
            </div>

            <div className="space-y-6">
              {tempPromoCombos.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs border border-dashed border-white/10 rounded-xl">
                  目前尚未設定任何自訂套餐組合，點擊右上方按鈕開始新增！
                </div>
              ) : (
                tempPromoCombos.map((combo, comboIdx) => (
                  <div
                    key={combo.id}
                    className="bg-[#1c1c1c] border border-white/5 rounded-xl p-4 space-y-4 shadow relative"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                      <div className="flex items-center space-x-2 flex-grow">
                        <span className="text-amber-500 text-sm">📦</span>
                        <input
                          type="text"
                          value={combo.name}
                          onChange={(e) => {
                            const updated = [...tempPromoCombos];
                            updated[comboIdx].name = e.target.value;
                            setTempPromoCombos(updated);
                          }}
                          className="bg-zinc-900 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-bold max-w-xs focus:border-[#E5B453] focus:outline-none"
                          placeholder="請輸入套餐組合名稱"
                        />
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!combo.enabled}
                            onChange={(e) => {
                              const updated = [...tempPromoCombos];
                              updated[comboIdx].enabled = e.target.checked;
                              setTempPromoCombos(updated);
                            }}
                            className="rounded border-zinc-700 bg-zinc-900 text-[#E5B453] focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className="text-white text-xs font-bold">啟用 (Active)</span>
                        </label>

                        {deleteConfirmComboId === combo.id ? (
                          <div className="flex items-center space-x-1 animate-fadeIn">
                            <button
                              type="button"
                              onClick={() => {
                                setTempPromoCombos(
                                  tempPromoCombos.filter((c) => c.id !== combo.id),
                                );
                                setDeleteConfirmComboId(null);
                              }}
                              className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded-md font-bold transition active:scale-95 cursor-pointer"
                            >
                              確定刪除
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmComboId(null)}
                              className="text-[10px] bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-2 py-1 rounded-md font-bold transition active:scale-95 cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmComboId(combo.id)}
                            className="text-[11px] bg-red-950/40 hover:bg-red-900/60 text-red-400 px-2.5 py-1 rounded-md transition active:scale-95 cursor-pointer border border-red-900/20"
                          >
                            🗑️ 刪除規則
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                        <label className="text-zinc-400 text-[11px] font-bold">
                          需選購限定單品數量 (張數/件數)
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            value={combo.requiredQty || ''}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              const updated = [...tempPromoCombos];
                              updated[comboIdx].requiredQty = val;
                              setTempPromoCombos(updated);
                            }}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                          />
                          <span className="text-zinc-400 text-xs font-bold shrink-0">件</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-zinc-400 text-[11px] font-bold">
                          達到條件時全自動折抵金額 (NT$)
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            value={combo.discountAmount || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              const updated = [...tempPromoCombos];
                              updated[comboIdx].discountAmount = val;
                              setTempPromoCombos(updated);
                            }}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                          />
                          <span className="text-[#E5B453] text-xs font-bold shrink-0">元</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-350 text-[11px] font-extrabold flex items-center gap-1">
                          🎯 適用單品名單 (
                          {combo.eligibleItemIds?.length === 0
                            ? '無限制過濾：預設適用於所有非飲料且非加麵底/加料的商品'
                            : `已指定適用於下列 ${combo.eligibleItemIds?.length} 個餐品`}
                          )
                        </span>
                        {combo.eligibleItemIds?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...tempPromoCombos];
                              updated[comboIdx].eligibleItemIds = [];
                              setTempPromoCombos(updated);
                            }}
                            className="text-[10px] text-zinc-500 hover:text-white cursor-pointer font-bold underline"
                          >
                            清空過濾 &amp; 適用所有
                          </button>
                        )}
                      </div>

                      <div className="max-h-36 overflow-y-auto border border-white/5 rounded-xl bg-zinc-950/40 p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {menuItems.map((item) => {
                          const isSelected = combo.eligibleItemIds?.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex items-center space-x-2.5 p-1.5 rounded-lg border transition cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-[#E5B453]/10 border-[#E5B453]/20 text-white font-bold'
                                  : 'bg-zinc-900/30 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={(e) => {
                                  let updatedList = [...(combo.eligibleItemIds || [])];
                                  if (e.target.checked) {
                                    if (!updatedList.includes(item.id)) updatedList.push(item.id);
                                  } else {
                                    updatedList = updatedList.filter(
                                      (id: string) => id !== item.id,
                                    );
                                  }
                                  const updated = [...tempPromoCombos];
                                  updated[comboIdx].eligibleItemIds = updatedList;
                                  setTempPromoCombos(updated);
                                }}
                                className="rounded border-zinc-700 bg-zinc-900 text-[#E5B453] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                              />
                              <div className="flex flex-col text-left truncate">
                                <span className="text-[10px] truncate">
                                  {getLocalizedText(item.name, 'zh') || item.name}
                                </span>
                                <span className="text-[8px] text-zinc-500 font-mono">
                                  NT$ {item.price} • {item.category}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Add to Menu Section */}
                    <div className="pt-3 border-t border-white/5 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400 font-bold">
                          📌 菜單品項管理 (Menu Item Integration)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (addComboToMenuId === combo.id) {
                              setAddComboToMenuId(null);
                            } else {
                              setAddComboToMenuId(combo.id);
                              // precalculate default package price: e.g. requiredQty * average eligible price * 0.9 or static guess
                              setAddComboPrice(combo.requiredQty * 80 - combo.discountAmount);
                              setAddComboCategory('skewers');
                              setAddComboDesc(
                                `超值優惠自動套餐組合：選購達 ${combo.requiredQty} 件適用單品即可自動折扣 NT$ ${combo.discountAmount} 元！`,
                              );
                            }
                          }}
                          className="px-3 py-1 bg-[#E5B453]/10 hover:bg-[#E5B453]/20 border border-[#E5B453]/20 text-[#E5B453] font-bold text-xs rounded-lg transition active:scale-95 flex items-center space-x-1 cursor-pointer"
                        >
                          <span>⚙️ 一鍵新增此組合至前台菜單品項內</span>
                        </button>
                      </div>

                      {addComboToMenuId === combo.id && (
                        <div className="bg-zinc-950/60 border border-[#E5B453]/10 p-4 rounded-xl space-y-3 text-left animate-fadeIn">
                          <h5 className="text-[#E5B453] text-xs font-bold">
                            🛠️ 設定欲新增之套餐餐飲品項參數
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-zinc-400 text-[10px] font-bold">
                                前台菜單內顯示之售價 (Price NT$)
                              </label>
                              <input
                                type="number"
                                value={addComboPrice}
                                onChange={(e) =>
                                  setAddComboPrice(parseInt(e.target.value, 10) || 0)
                                }
                                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-zinc-400 text-[10px] font-bold">
                                歸屬之菜單分類 (Category)
                              </label>
                              <select
                                value={addComboCategory}
                                onChange={(e) => setAddComboCategory(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                              >
                                {categories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {getLocalizedText(cat.name, 'zh') || cat.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-zinc-400 text-[10px] font-bold">
                              前台描述說明 (Description)
                            </label>
                            <input
                              type="text"
                              value={addComboDesc}
                              onChange={(e) => setAddComboDesc(e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                              placeholder="請輸入餐點描述"
                            />
                          </div>
                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setAddComboToMenuId(null)}
                              className="px-3 py-1.5 border border-white/10 text-zinc-400 hover:text-white rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await handleCreateComboMenuItem(
                                  combo,
                                  addComboPrice,
                                  addComboCategory,
                                  addComboDesc,
                                );
                                setAddComboToMenuId(null);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-extrabold cursor-pointer"
                            >
                              確認新增至菜單品項
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Success and Error messages */}
            {promoComboSaveSuccess && (
              <div
                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg text-left"
                id="promo-combo-success-message"
              >
                {promoComboSaveSuccess}
              </div>
            )}
            {promoComboSaveError && (
              <div
                className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg text-left"
                id="promo-combo-error-message"
              >
                {promoComboSaveError}
              </div>
            )}

            {/* Action confirmation buttons */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  if (promoCombo) {
                    setTempPromoCombos(promoCombo.combos || []);
                  }
                  setPromoComboSaveError(null);
                  setPromoComboSaveSuccess(null);
                }}
                className="px-4 py-2 border border-white/10 text-white hover:bg-white/5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer"
                id="btn-promo-combo-reset"
              >
                重設變更 (Reset)
              </button>
              <button
                type="button"
                onClick={handleSavePromoCombo}
                className="px-5 py-2 bg-[#E5B453] hover:bg-[#F0C46B] text-[#0F0F0F] rounded-lg text-xs font-black transition shadow-lg active:scale-95 flex items-center space-x-1 cursor-pointer"
                id="btn-promo-combo-save-confirm"
              >
                確認儲存所有設定 (Confirm Save)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SCREEN SUBTAB: EOD DAILY CHECKOUT ==================== */}
      {activeSubTab === 'eod' &&
        (() => {
          const paidOrders = orders.filter((o) => o.isPaid);
          const unpaidOrders = orders.filter((o) => !o.isPaid && o.status !== 'cancelled');
          const totalRev = paidOrders.reduce((sum, ord) => sum + ord.total, 0);
          const cashSum = paidOrders
            .filter((o) => o.paymentMethod === 'cash')
            .reduce((sum, ord) => sum + ord.total, 0);
          const creditSum = paidOrders
            .filter((o) => o.paymentMethod === 'credit')
            .reduce((sum, ord) => sum + ord.total, 0);
          const twqrSum = paidOrders
            .filter((o) => o.paymentMethod === 'twqr')
            .reduce((sum, ord) => sum + ord.total, 0);
          const memberSum = paidOrders
            .filter((o) => o.paymentMethod === 'member')
            .reduce((sum, ord) => sum + ord.total, 0);

          // Calculate quantities of each item sold
          const itemQuants: { [name: string]: { zh: string; qty: number } } = {};
          paidOrders.forEach((o) => {
            o.items.forEach((it) => {
              const label = getLocalizedText(it.name, 'zh');
              if (!itemQuants[label]) {
                itemQuants[label] = { zh: label, qty: 0 };
              }
              itemQuants[label].qty += it.qty;
            });
          });

          // Calculate standard ingredient consumption based on recipes
          const calculatedDeductions: { [ingId: string]: number } = {};
          ingredients.forEach((ig) => {
            calculatedDeductions[ig.id] = 0;
          });

          paidOrders.forEach((o) => {
            o.items.forEach((it) => {
              const recipe = recipeCompositionMap[it.id];
              if (recipe) {
                recipe.forEach((rec) => {
                  const ingObj = ingredients.find(
                    (ig) => getLocalizedText(ig.name, 'zh') === rec.name || ig.id === rec.name,
                  );
                  if (ingObj) {
                    const match = rec.qty.match(/([\d\.]+)/);
                    const amountPerItem = match ? parseFloat(match[1]) : 1;
                    calculatedDeductions[ingObj.id] += amountPerItem * it.qty;
                  }
                });
              }
            });
          });

          const handlePerformInventoryEodDeduction = async () => {
            let successCount = 0;
            try {
              for (const ig of ingredients) {
                const consumption = calculatedDeductions[ig.id] || 0;
                if (consumption > 0) {
                  const res = await apiFetch('/api/inventory/adjust', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ingredientId: ig.id,
                      quantityChanged: -consumption,
                      note: `EOD 每日關帳自動扣減：已售餐品配方消耗核銷`,
                    }),
                  });
                  if (res.ok) {
                    successCount++;
                  }
                }
              }
              alert(
                `🎉 庫存連動扣除成功！已為您同步自動化核銷對應 ${successCount} 項餐品配方食材物料流向。`,
              );
              if (ingredients.length > 0) {
                await onRestock(ingredients[0].id, 0); // Sync parent state
              }
              await fetchInventoryLogs();
            } catch (err) {
              console.error(err);
              alert('❌ 自動配方庫存扣減時發生預期外錯誤');
            }
          };

          const handleEodReceiptPrint = () => {
            const lines = Object.entries(itemQuants)
              .map(([lbl, val]) => `  • ${lbl.padEnd(16)} x${val.qty}`)
              .join('\n');
            const ingredientLines = ingredients
              .map((ig) => {
                const consumption = calculatedDeductions[ig.id] || 0;
                return `  • ${getLocalizedText(ig.name, 'zh').padEnd(12)}: 剩餘 ${ig.stock} ${ig.unit} (今日已扣減 ${consumption} ${ig.unit})`;
              })
              .join('\n');

            const receiptBody = `
========================================
       沙貝燒烤 (每日營業結算日報表)
========================================
列印時間: ${new Date().toLocaleString()}
報表日期: ${new Date().toLocaleDateString()}
-----------------------------------------
【今日營業數據加總】
今日實收總額 (Net Revenue): NT$ ${totalRev} 元
成功收款單數 (Paid Bills): ${paidOrders.length} 筆
未收細單單數 (Unpaid Bills): ${unpaidOrders.length} 筆

【付款方式明細匯總】
  - 💵 現金收銀 (Cash):   NT$ ${cashSum} 元
  - 💳 信用卡結 (Credit): NT$ ${creditSum} 元
  - 🖥️ 行動支付 (TWQR):   NT$ ${twqrSum} 元
  - 👤 會員儲值 (Member): NT$ ${memberSum} 元
-----------------------------------------
【餐點熱銷排行明細】
${lines || '  (今天尚無完成收銀單商品)'}
-----------------------------------------
【連動數據庫存原料位變動】
${ingredientLines || '  (尚無庫存異動記錄)'}
-----------------------------------------
設定店名: ${billPrinter.restaurantName}
聯絡電話: ${billPrinter.printTelephone}
店鋪地址: ${billPrinter.printAddress}
========================================
          `.trim();

            const pWin = window.open();
            if (pWin) {
              pWin.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <title>SABAY 每日結帳報表 (EOD)</title>
                  <style>
                    body {
                      font-family: "Microsoft JhengHei", "PingFang TC", "Heiti TC", "Noto Sans TC", "Segoe UI", sans-serif, monospace;
                      background: #fff;
                      color: #000;
                      padding: 20px;
                      font-size: ${billPrinter.width === '58mm' ? '12px' : '14px'};
                      max-width: ${billPrinter.width === '58mm' ? '280px' : '400px'};
                      margin: 0 auto;
                      white-space: pre-wrap;
                      word-break: break-all;
                    }
                  </style>
                </head>
                <body>
                  <pre style="font-family: inherit;">${receiptBody}</pre>
                  <script>window.onload = function() { window.print(); }</script>
                </body>
              </html>
            `);
              pWin.document.close();
            }
          };

          const handleCompleteEodAndLogout = () => {
            alert('🏁 每日關帳作業與庫存對帳已核銷完畢，即將登出工作人員並鎖定客用介面！');
            localStorage.removeItem('google-current-member');
            localStorage.removeItem('line-profile');
            window.location.href = '/';
          };

          return (
            <div className="space-y-6 animate-fadeIn text-left font-sans" id="subtab-section-eod">
              <div className="bg-[#161616] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                  <span className="text-xl">🏁</span>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      沙貝每日關帳結核系統 (Daily Business EOD Checkout Portal)
                    </h4>
                    <p className="text-white/40 text-xs">
                      執行每日店面關帳結算，一鍵更新餐點銷售與原料配銷，產印熱感報表與結存變更，強化營運動能。
                    </p>
                  </div>
                </div>

                {/* Stats KPI Card in Checkout Panel */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-black/30 p-4 rounded-xl border border-white/5">
                  <div className="text-center p-2.5 bg-zinc-900 border border-white/5 rounded-lg">
                    <span className="text-[10px] text-zinc-500 block font-semibold">
                      今日關帳實收金額
                    </span>
                    <span className="text-lg font-mono font-black text-[#E5B453]">
                      NT$ {totalRev}
                    </span>
                  </div>
                  <div className="text-center p-2.5 bg-zinc-900 border border-white/5 rounded-lg">
                    <span className="text-[10px] text-zinc-500 block font-semibold">
                      已收款單數
                    </span>
                    <span className="text-lg font-mono font-black text-white">
                      {paidOrders.length} 筆
                    </span>
                  </div>
                  <div className="text-center p-2.5 bg-zinc-900 border border-white/5 rounded-lg">
                    <span className="text-[10px] text-zinc-500 block font-semibold">
                      現金收訖 (Cash)
                    </span>
                    <span className="text-lg font-mono font-black text-emerald-400">
                      NT$ {cashSum}
                    </span>
                  </div>
                  <div className="text-center p-2.5 bg-zinc-900 border border-white/5 rounded-lg">
                    <span className="text-[10px] text-zinc-500 block font-semibold">
                      信用卡收訖 (Credit)
                    </span>
                    <span className="text-lg font-mono font-black text-blue-400">
                      NT$ {creditSum}
                    </span>
                  </div>
                  <div className="text-center p-2.5 bg-zinc-900 border border-white/5 rounded-lg">
                    <span className="text-[10px] text-zinc-500 block font-semibold">
                      TWQR/會員扣抵合計
                    </span>
                    <span className="text-lg font-mono font-black text-teal-400">
                      NT$ {twqrSum + memberSum}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Column 1: Unpaid orders & Payment State transitions */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
                    <div className="space-y-0.5 border-b border-white/5 pb-2">
                      <h5 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                        ⏱️ 待核銷未收細單明細 ({unpaidOrders.length})
                      </h5>
                      <p className="text-[10px] text-zinc-500">
                        此為今日仍維持未結帳狀態之點單，關帳前可一鍵變更支付方式或進行收銀狀態流轉。
                      </p>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {unpaidOrders.length === 0 ? (
                        <div className="text-center py-8 text-xs text-zinc-500 italic">
                          🎉 太棒了！今日已無任何未結帳點單。
                        </div>
                      ) : (
                        unpaidOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="p-3 bg-zinc-900/80 rounded-lg border border-white/5 text-xs text-zinc-300 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono font-bold text-white">
                                {ord.id.slice(-6).toUpperCase()} ({ord.tableNumber} 桌)
                              </span>
                              <span className="font-mono text-[#E5B453] font-black">
                                NT$ {ord.total}
                              </span>
                            </div>

                            <div className="flex gap-1.5 pt-1 border-t border-white/5">
                              {(['cash', 'credit', 'twqr'] as const).map((pm) => (
                                <button
                                  key={pm}
                                  type="button"
                                  onClick={async () => {
                                    if (onPayOrder) {
                                      await onPayOrder(ord.id, {
                                        paymentMethod: pm,
                                        isPaid: true,
                                      });
                                      alert(
                                        `💸 已將點單 ${ord.id.slice(-6).toUpperCase()} 修改為【已結款 (${pm === 'cash' ? '現金' : pm === 'credit' ? '信用卡' : 'TWQR'})】`,
                                      );
                                    }
                                  }}
                                  className="flex-1 py-1 rounded bg-zinc-800 hover:bg-[#E5B453] hover:text-black transition-colors text-[9px] font-black"
                                >
                                  {pm === 'cash' ? '現結' : pm === 'credit' ? '刷卡' : 'TWQR'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 2: Inventory deductions analysis */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
                    <div className="space-y-0.5 border-b border-white/5 pb-2">
                      <h5 className="font-bold text-xs text-white uppercase tracking-wider">
                        📦 連動「數據庫存」今日配餐配銷扣減
                      </h5>
                      <p className="text-[10px] text-zinc-500">
                        系統即時比對已收款餐品之食材配方，模擬計算當日營業流失的理論庫存量。
                      </p>
                    </div>

                    <div className="space-y-2.5 text-xs text-zinc-300">
                      <div className="bg-zinc-900/60 p-3 rounded-lg border border-white/5 space-y-1.5 max-h-72 overflow-y-auto">
                        {ingredients.map((ig) => {
                          const consumption = calculatedDeductions[ig.id] || 0;
                          const isWarning = ig.stock - consumption <= ig.minThreshold;
                          return (
                            <div
                              key={ig.id}
                              className="flex justify-between items-center border-b border-white/5 pb-1"
                            >
                              <span>{getLocalizedText(ig.name, 'zh')}</span>
                              <div className="text-right font-mono text-[11px]">
                                <span className="text-zinc-500">今日應扣: </span>
                                <span className="text-amber-400 font-bold pr-2">
                                  {consumption} {ig.unit}
                                </span>
                                <span className="text-zinc-500">預估剩餘: </span>
                                <span
                                  className={
                                    isWarning ? 'text-rose-400 font-black' : 'text-zinc-300'
                                  }
                                >
                                  {Math.max(0, Math.round((ig.stock - consumption) * 100) / 100)}{' '}
                                  {ig.unit}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={handlePerformInventoryEodDeduction}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-lg text-xs tracking-wider transition active:scale-95 cursor-pointer uppercase text-center shadow-lg"
                      >
                        📊 連動扣減：一鍵對應「數據庫存」扣位
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Print Receipt Preview layout */}
                  <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-4">
                    <div className="space-y-0.5 border-b border-white/5 pb-2">
                      <h5 className="font-bold text-xs text-white uppercase tracking-wider">
                        🖨️ 每日營業關帳日報表列印預覽
                      </h5>
                      <p className="text-[10px] text-zinc-500">
                        根據當前設定之熱感式出單硬體寬度（目前：{billPrinter.width}
                        ），模擬產生實體對帳聯（含原料變動紀錄）。
                      </p>
                    </div>

                    {/* Thermal paper simulator */}
                    <div className="bg-zinc-950 border border-white/15 p-4 rounded-xl text-[10px] font-mono text-zinc-300 pointer-events-none select-none max-h-64 overflow-y-auto space-y-1 leading-tight">
                      <p className="text-center font-bold text-white">沙貝燒烤 每日營業日報表</p>
                      <p className="text-[9px] text-zinc-500 text-center">
                        列印時間: {new Date().toLocaleDateString()}{' '}
                        {new Date().toLocaleTimeString()}
                      </p>
                      <div className="border-t border-dashed border-zinc-700 my-1"></div>
                      <div className="flex justify-between">
                        <span>今日實收總額 (Net):</span>
                        <span className="font-bold text-[#E5B453]">NT$ {totalRev}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>成功收款單數:</span>
                        <span>{paidOrders.length} 筆</span>
                      </div>
                      <div className="border-t border-dashed border-zinc-700 my-1"></div>
                      <p className="text-[9px] text-[#E5B453] uppercase font-bold">
                        付款方式細點明細:
                      </p>
                      <p> 💵 現金收銀 (Cash): NT$ {cashSum}元</p>
                      <p> 💳 信用卡結 (Credit): NT$ {creditSum}元</p>
                      <p> 🖥️ 行動支付 (TWQR): NT$ {twqrSum}元</p>
                      <p> 👤 会員帳抵 (Member): NT$ {memberSum}元</p>
                      <div className="border-t border-dashed border-zinc-700 my-1"></div>
                      <p className="text-[9px] text-[#E5B453] uppercase font-bold">
                        餐點累計熱售排行:
                      </p>
                      {Object.entries(itemQuants).length === 0 ? (
                        <p className="italic text-zinc-650"> (今日尚無完成結帳商品)</p>
                      ) : (
                        Object.entries(itemQuants).map(([lbl, val]) => (
                          <p key={lbl}>
                            {' '}
                            • {lbl.slice(0, 10).padEnd(12)} x{val.qty}
                          </p>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const lines = Object.entries(itemQuants)
                          .map(([lbl, val]) => `  • ${lbl.padEnd(16)} x${val.qty}`)
                          .join('\n');
                        const ingredientLines = ingredients
                          .map((ig) => {
                            const consumption = calculatedDeductions[ig.id] || 0;
                            return `  • ${getLocalizedText(ig.name, 'zh').padEnd(12)}: 剩餘 ${ig.stock} ${ig.unit} (今日已扣減 ${consumption} ${ig.unit})`;
                          })
                          .join('\n');

                        const receiptBody = `
========================================
       沙貝燒烤 (每日營業結算日報表)
========================================
列印時間: ${new Date().toLocaleString()}
報表日期: ${new Date().toLocaleDateString()}
-----------------------------------------
【今日營業數據加總】
今日實收總額 (Net Revenue): NT$ ${totalRev} 元
成功收款單數 (Paid Bills): ${paidOrders.length} 筆
未收細單單數 (Unpaid Bills): ${unpaidOrders.length} 筆

【付款方式明細匯總】
  - 💵 現金收銀 (Cash):   NT$ ${cashSum} 元
  - 💳 信用卡結 (Credit): NT$ ${creditSum} 元
  - 🖥️ 行動支付 (TWQR):   NT$ ${twqrSum} 元
  - 👤 會員儲值 (Member): NT$ ${memberSum} 元
-----------------------------------------
【餐點熱銷排行明細】
${lines || '  (今天尚無完成收銀單商品)'}
-----------------------------------------
【連動數據庫存原料位變動】
${ingredientLines || '  (尚無庫存異動記錄)'}
-----------------------------------------
設定店名: ${billPrinter.restaurantName}
聯絡電話: ${billPrinter.printTelephone}
店鋪地址: ${billPrinter.printAddress}
========================================`.trim();

                        setPrintConfirmData({
                          title: '列印每日營業結算日報表 (EOD)',
                          ip: printerIp,
                          receiptType: 'eod',
                          receiptBody: receiptBody,
                          onConfirm: handleEodReceiptPrint,
                        });
                      }}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white font-bold rounded-lg text-xs transition active:scale-95 cursor-pointer uppercase text-center"
                    >
                      🖨️ 列印預覽並傳送至熱感印表機 (Print)
                    </button>
                  </div>
                </div>

                {/* Action and Safe lock Gate */}
                <div className="bg-[#202020] border border-rose-500/20 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-left space-y-1">
                    <span className="text-xs font-bold text-rose-400 tracking-widest block uppercase">
                      🏁 安全結帳與登出強制安全鎖
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      執行總營業終結轉後，為求當日帳款安全，系統將自動清理當日點餐通道並登出，返回訪客用餐前台頁面。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCompleteEodAndLogout}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-xs tracking-wider transition active:scale-95 cursor-pointer uppercase text-center whitespace-nowrap shrink-0"
                  >
                    🏁 立即執行每日總結帳登出 Exit Safely
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      {activeSubTab === 'terminal' &&
        (() => {
          const filteredMenuItems = menuItems.filter(
            (item) =>
              item.available && (terminalCategory === 'all' || item.category === terminalCategory),
          );
          const itemsPerPage = 20;
          const totalPages = Math.max(1, Math.ceil(filteredMenuItems.length / itemsPerPage));
          const currentPage = Math.min(terminalPage, totalPages);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const paginatedItems = filteredMenuItems.slice(startIndex, startIndex + itemsPerPage);

          const cartItemsPerPage = 5;
          const totalCartPages = Math.max(1, Math.ceil(terminalCart.length / cartItemsPerPage));
          const currentCartPage = Math.min(terminalCartPage, totalCartPages);
          const cartStartIndex = (currentCartPage - 1) * cartItemsPerPage;
          const paginatedCartItems = terminalCart.slice(
            cartStartIndex,
            cartStartIndex + cartItemsPerPage,
          );

          return (
            <div
              className={
                isTerminalFullScreen
                  ? 'fixed inset-0 z-50 bg-[#0c0c0c] p-6 flex flex-col h-screen w-screen overflow-hidden animate-fadeIn'
                  : 'space-y-6 animate-fadeIn'
              }
              id="subtab-section-terminal"
            >
              <div
                className={`bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl relative ${isTerminalFullScreen ? 'h-full flex flex-col overflow-hidden' : 'overflow-hidden'}`}
              >
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-[#E5B453] flex items-center gap-2">
                      <ShoppingBag size={22} />
                      管理員快速點餐終端 (Resilient Terminal)
                    </h3>
                    <p className="text-xs text-white/40">
                      具備獨立運作能力。離線時訂單將存入本地事務隊列，恢復連線後自動對賬。
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsTerminalFullScreen((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
                    >
                      {isTerminalFullScreen ? (
                        <>
                          <Minimize2 size={14} className="text-[#E5B453]" />
                          <span>退出全螢幕 Exit</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 size={14} className="text-[#E5B453]" />
                          <span>全螢幕 Fullscreen</span>
                        </>
                      )}
                    </button>
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${navigator.onLine ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-bounce'}`}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {navigator.onLine ? 'Online' : 'OFFLINE - Local Auth Mode'}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-[26%_74%] ${isTerminalFullScreen ? 'h-full flex-1 min-h-0' : 'h-[650px]'} gap-8`}
                >
                  {/* 1. 訂單預覽與送出 (Cart on the Left) */}
                  <div className="bg-black/20 rounded-xl p-5 border border-white/5 flex flex-col h-full min-h-0 justify-between">
                    <div className="flex flex-col flex-1 min-h-0">
                      <h4 className="text-xs font-bold text-white/60 uppercase tracking-tighter border-b border-white/5 pb-2 mb-4 shrink-0">
                        點餐籃 Cart
                      </h4>
                      <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-0 custom-scrollbar">
                        {terminalCart.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-white/10">
                            <ShoppingCart size={32} className="mb-2 opacity-30" />
                            <p className="text-[10px]">請從右側點選菜品</p>
                          </div>
                        ) : (
                          paginatedCartItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between bg-white/5 p-2 rounded-lg text-xs"
                            >
                              <span className="font-bold text-white">
                                {getLocalizedText(item.name, 'zh')}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-white/40">x{item.qty}</span>
                                <span className="font-mono text-[#E5B453]">
                                  ${item.price * item.qty}
                                </span>
                                <button
                                  onClick={() =>
                                    setTerminalCart((prev) => prev.filter((i) => i.id !== item.id))
                                  }
                                  className="text-rose-500 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-4 space-y-4 shrink-0">
                      <div className="flex justify-between text-sm font-black text-white">
                        <span>總計 Total</span>
                        <span className="text-[#E5B453] font-mono">
                          ${terminalCart.reduce((s, i) => s + i.price * i.qty, 0)}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!onPlaceOrder) return;
                          const success = await onPlaceOrder({
                            tableNumber: terminalTable,
                            items: terminalCart,
                            paymentMethod: 'cash',
                            guestCount: 1,
                          });
                          if (success) {
                            setTerminalCart([]);
                            alert('訂單已送出' + (navigator.onLine ? '' : ' (進入離線事務隊列)'));
                          }
                        }}
                        className={`w-full py-3 bg-[#E5B453] text-black font-black text-sm rounded-xl transition-all active:scale-95 ${terminalCart.length === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-amber-400 cursor-pointer'}`}
                        disabled={terminalCart.length === 0}
                      >
                        🚀 {navigator.onLine ? '即時送出訂單' : '存入離線事務隊列 (Offline Submit)'}
                      </button>

                      {/* Pagination under the Cart container as well for seamless dual control */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                        <button
                          onClick={() => setTerminalCartPage((p) => Math.max(1, p - 1))}
                          disabled={currentCartPage === 1 || terminalCart.length === 0}
                          className="flex-1 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                        >
                          <ChevronLeft size={16} className="text-[#E5B453]" />
                          <span>上一頁 Prev</span>
                        </button>
                        <span className="text-xs font-bold font-mono text-white/80 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                          {currentCartPage} / {totalCartPages}
                        </span>
                        <button
                          onClick={() =>
                            setTerminalCartPage((p) => Math.min(totalCartPages, p + 1))
                          }
                          disabled={currentCartPage === totalCartPages || terminalCart.length === 0}
                          className="flex-1 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                        >
                          <span>下一頁 Next</span>
                          <ChevronRight size={16} className="text-[#E5B453]" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. 選單選購區 (Menu on the Right) */}
                  <div className="space-y-4 flex flex-col justify-between h-full min-h-0">
                    <div className="space-y-4 flex flex-col flex-1 min-h-0">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white/60 uppercase tracking-tighter">
                            菜單 Menu
                          </h4>
                          <span className="text-[10px] font-mono text-white/30">
                            (
                            {getLocalizedText(
                              categories.find((c) => c.id === terminalCategory)?.name,
                              currentLang,
                            ) || '全部 All'}
                            )
                          </span>
                        </div>
                        <select
                          value={terminalTable}
                          onChange={(e) => setTerminalTable(e.target.value)}
                          className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-[#E5B453] font-bold outline-none cursor-pointer"
                        >
                          {tables.map((t) => (
                            <option key={t.id} value={t.id}>
                              桌號: {t.id}
                            </option>
                          ))}
                          <option value="takeout">外帶 Takeout</option>
                        </select>
                      </div>

                      {/* 菜色分類標籤控制 Categories Panel */}
                      <div
                        className="flex border border-[#008ec4] bg-[#008ec4] rounded-lg overflow-hidden shrink-0"
                        id="terminal-categories-panel"
                      >
                        <button
                          id="btn-term-cat-all"
                          onClick={() => setTerminalCategory('all')}
                          className={`flex-1 py-3 text-center text-xs font-black transition-all cursor-pointer outline-none border-r border-white/10 last:border-r-0 ${
                            terminalCategory === 'all'
                              ? 'bg-[#8ac249] text-white font-extrabold'
                              : 'bg-[#008ec4] text-white hover:bg-[#007cb3]'
                          }`}
                        >
                          全部 All
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            id={`btn-term-cat-${cat.id}`}
                            onClick={() => setTerminalCategory(cat.id)}
                            className={`flex-1 py-3 text-center text-xs font-black transition-all cursor-pointer outline-none border-r border-white/10 last:border-r-0 ${
                              terminalCategory === cat.id
                                ? 'bg-[#8ac249] text-white font-extrabold'
                                : 'bg-[#008ec4] text-white hover:bg-[#007cb3]'
                            }`}
                          >
                            {getLocalizedText(cat.name, currentLang) || cat.id}
                          </button>
                        ))}
                      </div>

                      <div className="flex-1 flex flex-col justify-between min-h-0">
                        <div className="grid grid-cols-5 gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1 py-2">
                          {paginatedItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setTerminalCart((prev) => {
                                  const existing = prev.find((i) => i.menuItemId === item.id);
                                  if (existing) {
                                    return prev.map((i) =>
                                      i.menuItemId === item.id ? { ...i, qty: i.qty + 1 } : i,
                                    );
                                  }
                                  return [
                                    ...prev,
                                    {
                                      id: `term-${Date.now()}`,
                                      menuItemId: item.id,
                                      name: item.name,
                                      price: item.price,
                                      qty: 1,
                                      customization: { sweetness: 2, spiciness: 0, notes: '' },
                                    },
                                  ];
                                });
                              }}
                              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 text-left flex flex-col justify-between transition-all cursor-pointer w-full h-full min-h-[100px] aspect-[1.3/1] shadow-lg hover:border-[#E5B453]/40 active:scale-95 group"
                            >
                              <div
                                className="text-[clamp(10px,1.15vw,14px)] font-black text-white group-hover:text-[#E5B453] leading-snug tracking-tight whitespace-normal break-words overflow-hidden"
                                style={{ wordBreak: 'break-word' }}
                              >
                                {getLocalizedText(item.name, 'zh')}
                              </div>
                              <div className="text-[clamp(9px,1vw,12px)] font-mono font-black text-[#E5B453] text-right shrink-0 mt-1">
                                $ {item.price}
                              </div>
                            </button>
                          ))}
                          {paginatedItems.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-white/20">
                              無可用菜品 No items available
                            </div>
                          )}
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-white/5 shrink-0">
                          <button
                            onClick={() => setTerminalPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-6 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                          >
                            <ChevronLeft size={16} className="text-[#E5B453]" />
                            <span>上一頁 Prev Page</span>
                          </button>
                          <span className="text-xs font-bold font-mono text-white/80 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                            頁次 {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setTerminalPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-6 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                          >
                            <span>下一頁 Next Page</span>
                            <ChevronRight size={16} className="text-[#E5B453]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ========================================================================= */}
      {/* ==================== SCREEN POPUP RESILIENT MODALS ==================== */}
      {/* ========================================================================= */}

      {/* SINGLE ORDER DRILLDOWN DETAIL MODAL */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          id="order-detail-drilldown-modal"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="bg-[#E5B453] text-black font-extrabold px-2.5 py-1 rounded text-xs">
                  單筆點單核數明細
                </span>
                <h3 className="font-bold text-base font-mono">{selectedOrder.id || ''}</h3>
                <span className="text-xs text-white/50">
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {onDeleteOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmActionModal({
                        isOpen: true,
                        title: '🚨 永久刪除此訂單',
                        message: `您確定要永久刪除訂單 [${selectedOrder.id}] 嗎？此操作將永久刪除此訂單，且無法復原。`,
                        actionLabel: '確定刪除 Delete',
                        onConfirm: async () => {
                          await onDeleteOrder(selectedOrder.id);
                          setSelectedOrder(null);
                        },
                      });
                    }}
                    className="text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white transition active:scale-95 border border-rose-500/30 px-3 py-1.5 rounded-lg cursor-pointer font-bold animate-fadeIn"
                  >
                    🗑️ 刪除訂單 Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-white transition text-xs cursor-pointer outline-none bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg"
                >
                  關閉 ✕
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Customer & Status Controls */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                    顧客與桌席定位
                  </span>
                  <div className="flex items-center space-x-3 pb-3 border-b border-white/5">
                    <img
                      src={
                        selectedOrder.customerAvatar ||
                        'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=150'
                      }
                      defaultValue=""
                      alt="avatar"
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm">{selectedOrder.customerName}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        會員身份：{selectedOrder.isMember ? '⭐ Google Quick 會員' : '本桌一般餐客'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-white/40 block text-[10px] uppercase">
                        餐客桌位/服務類型
                      </span>
                      {editingOrderTableId === selectedOrder.id ? (
                        <div
                          className="mt-1 space-y-1.5"
                          id="editing-order-table-section-drilldown"
                        >
                          <select
                            value={editingOrderTableValue}
                            onChange={(e) => setEditingOrderTableValue(e.target.value)}
                            className="w-full bg-[#1c1c1c] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#E5B453]"
                          >
                            <optgroup label="客席就座桌號">
                              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((num) => (
                                <option key={num} value={num}>
                                  🪑 第 {num} 桌 (Dine-in)
                                </option>
                              ))}
                              {tables &&
                                tables.map(
                                  (t) =>
                                    !Array.from({ length: 12 }, (_, i) => String(i + 1)).includes(
                                      t.id,
                                    ) && (
                                      <option key={t.id} value={t.id}>
                                        🪑 第 {t.id} 桌
                                      </option>
                                    ),
                                )}
                            </optgroup>
                            <optgroup label="外帶自取佇列號碼">
                              {Array.from({ length: 15 }, (_, i) => `外帶 #${i + 1}`).map(
                                (takeoutId) => (
                                  <option key={takeoutId} value={takeoutId}>
                                    🛍️ {takeoutId} (Takeout)
                                  </option>
                                ),
                              )}
                            </optgroup>
                          </select>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                if (onUpdateTableNumber) {
                                  const res = await onUpdateTableNumber(
                                    selectedOrder.id,
                                    editingOrderTableValue,
                                  );
                                  if (res.success) {
                                    selectedOrder.tableNumber = editingOrderTableValue;
                                    setEditingOrderTableId(null);
                                  } else {
                                    alert(res.error || '變更桌號失敗');
                                  }
                                } else {
                                  selectedOrder.tableNumber = editingOrderTableValue;
                                  setEditingOrderTableId(null);
                                }
                              }}
                              className="text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                            >
                              確改 OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOrderTableId(null)}
                              className="text-[9px] bg-zinc-700 hover:bg-zinc-650 text-zinc-300 font-extrabold px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1 mt-0.5">
                          <p className="font-extrabold text-sm text-white">
                            {selectedOrder.tableNumber}{' '}
                            {selectedOrder.tableNumber && selectedOrder.tableNumber.includes('外帶')
                              ? ''
                              : '桌'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrderTableId(selectedOrder.id);
                              setEditingOrderTableValue(selectedOrder.tableNumber);
                            }}
                            className="text-[9px] text-[#E5B453] hover:text-amber-300 bg-white/5 border border-white/5 hover:border-[#E5B453]/20 px-1.5 py-0.5 rounded cursor-pointer transition font-bold"
                          >
                            ✎ 更改桌號/外帶
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-white/40 block text-[10px] uppercase">
                        支付途徑管道
                      </span>
                      <p className="font-bold text-sm text-white capitalize mt-0.5">
                        {selectedOrder.paymentMethod === 'twqr'
                          ? 'TWQR支付'
                          : selectedOrder.paymentMethod === 'credit'
                            ? '信用卡支付'
                            : selectedOrder.paymentMethod === 'member'
                              ? '會員儲值支付'
                              : '現場現金結算'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status modifier triggers */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                    出餐進度狀態變更
                  </span>
                  <p className="text-[10px] text-white/40 leading-tight">
                    切換此狀態將向 KDS 後台及客端即時同步。點選「已取消」將會自動算退釋原物料庫存！
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {[
                      {
                        status: 'pending',
                        label: '⏳ 待處理 Pending',
                        color: 'hover:bg-amber-500/20 text-amber-400 border-amber-500/30',
                      },
                      {
                        status: 'preparing',
                        label: '🍳 準備中 Preparing',
                        color: 'hover:bg-blue-500/20 text-blue-400 border-blue-500/30',
                      },
                      {
                        status: 'paid',
                        label: '💳 已結帳 Paid',
                        color: 'hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                      },
                      {
                        status: 'completed',
                        label: '✅ 已完成 Completed',
                        color: 'hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                      },
                      {
                        status: 'cancelled',
                        label: '❌ 已取消 Cancelled',
                        color: 'hover:bg-rose-500/20 text-rose-400 border-rose-500/30',
                      },
                    ].map((btn) => (
                      <button
                        type="button"
                        key={btn.status}
                        onClick={async () => {
                          if (btn.status === 'cancelled') {
                            setConfirmActionModal({
                              isOpen: true,
                              title: '⚠️ 訂單取消確定',
                              message: `您確定要取消此份點單 [${selectedOrder.id}] 嗎？切換為取消狀態後，系統將會釋出本單所消耗的原物料與配料库存！`,
                              actionLabel: '確定取消 Cancel Order',
                              onConfirm: async () => {
                                await onUpdateOrderStatus(selectedOrder.id, btn.status as any);
                                setSelectedOrder({ ...selectedOrder, status: btn.status as any });
                              },
                            });
                          } else {
                            await onUpdateOrderStatus(selectedOrder.id, btn.status as any);
                            setSelectedOrder({ ...selectedOrder, status: btn.status as any });
                          }
                        }}
                        className={`py-2 px-3 border rounded-lg text-[11px] font-bold transition active:scale-95 text-left flex items-center justify-between cursor-pointer ${btn.color} ${
                          selectedOrder.status === btn.status
                            ? 'bg-white/10 border-white/30 text-white font-black'
                            : 'bg-black/20'
                        }`}
                      >
                        <span>{btn.label}</span>
                        {selectedOrder.status === btn.status && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E5B453]"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print simulator option */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 text-xs">
                  <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                    店鋪出餐熱感存票模擬
                  </span>
                  <p className="text-[10px] text-white/40">
                    可將顧客結賬明細或廚房交代工作票重寄發送列印隊列備用明細單：
                  </p>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const specLines = selectedOrder.items
                          .map((it) => {
                            const spec = [
                              it.customization.spiciness === 0
                                ? '不辣 (Non-Spicy)'
                                : it.customization.spiciness === 1
                                  ? '小辣 (Mild)'
                                  : it.customization.spiciness === 2
                                    ? '中辣 (Med)'
                                    : '泰辣 (Hot)',
                              it.customization.sweetness === 0
                                ? '無糖 (0%)'
                                : it.customization.sweetness === 1
                                  ? '微糖 (30%)'
                                  : it.customization.sweetness === 2
                                    ? '半糖 (50%)'
                                    : '正常 (100%)',
                              it.customization.noodleType === 'rice-noodle'
                                ? '河粉'
                                : it.customization.noodleType === 'vermicelli'
                                  ? '米線'
                                  : '',
                              it.customization.soupBase === 'coconut-milk' ? '加椰奶(+50)' : '',
                              it.customization.notes ? `備註: ${it.customization.notes}` : '',
                            ]
                              .filter(Boolean)
                              .join('/');
                            const pName = it.name
                              ? typeof it.name === 'object'
                                ? getLocalizedText(it.name, currentLang) || '未命名'
                                : it.name
                              : '未命名';
                            return `[ ] ${pName} x ${it.qty}份\n    【 ${spec} 】`;
                          })
                          .join('\n');
                        const kitchenStr = `
========================================
       沙貝燒烤 (廚房工作即時交代單-重印)
       桌號/標記: ${selectedOrder.tableNumber}
========================================
單號 ID: ${selectedOrder.id || 'N/A'}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString() : 'N/A'}
狀態 STATE: ${(selectedOrder.status || '').toUpperCase()}
----------------------------------------
餐點項目與客製需求 Kitchen Item(s):
${specLines}
----------------------------------------
* REPRINT KITCHEN TICKET PRINT PREVIEW *
* 感謝廚房人員辛勞，請依序完成出餐確認 *
========================================`.trim();

                        setPrintConfirmData({
                          title: '重印工作廚房票 Kitchen Ticket',
                          ip: printerIp,
                          receiptType: 'kitchen',
                          receiptBody: kitchenStr,
                          onConfirm: () =>
                            alert(`🖨️ 模擬重行印列【防爆/防油熱感廚房交代票】成功！`),
                        });
                      }}
                      className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10.5px] border border-white/10 font-bold active:scale-95 transition cursor-pointer"
                    >
                      🧾 再印工作廚房票
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const customerDetails = selectedOrder.items
                          .map((it) => {
                            const pName = it.name
                              ? typeof it.name === 'object'
                                ? getLocalizedText(it.name, currentLang) || '未命名'
                                : it.name
                              : '未命名';
                            return `  ${pName.padEnd(16)} x${it.qty || 0}  $${(it.price || 0) * (it.qty || 0)}`;
                          })
                          .join('\n');
                        const customerStr = `
========================================
       沙貝燒烤 (顧客結賬與消點收據-重印)
       桌號/標記: ${selectedOrder.tableNumber || 'N/A'} 桌
========================================
單號 ID: ${selectedOrder.id || 'N/A'}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString() : 'N/A'}
付款方式: ${selectedOrder.paymentMethod ? selectedOrder.paymentMethod.toUpperCase() : 'CASH'}
累積儲值會員: ${selectedOrder.isMember ? '是 (小計累積點數中)' : '否'}
----------------------------------------
消費明細 Billing details:
${customerDetails}
----------------------------------------
小計 Total Sub: $${selectedOrder.subtotal || 0}
服務費 Svc(10%): $${selectedOrder.serviceCharge || 0}
實付支付 Net:   $${selectedOrder.total || 0}
========================================
* 感謝您的光臨，美味慢享，期待再次相遇 *
* 憑本熱感收據於當月前台消費享回客點心一份 *
========================================`.trim();

                        setPrintConfirmData({
                          title: '重印顧客結算收據 Customer Receipt',
                          ip: printerIp,
                          receiptType: 'customer',
                          receiptBody: customerStr,
                          onConfirm: () => alert(`🖨️ 模擬重行印列【顧客結賬發票與消點收據】成功！`),
                        });
                      }}
                      className="flex-1 py-1.5 bg-[#E5B453]/15 hover:bg-[#E5B453]/25 text-[#E5B453] rounded-lg text-[10.5px] border border-[#E5B453]/25 font-bold active:scale-95 transition cursor-pointer"
                    >
                      💵 再印顧客結算收據
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Ordered dishes list and checkout status */}
              {!selectedOrder.isPaid ? (
                /* ----------------- UNPAID ORDER PANEL ----------------- */
                <div className="md:col-span-7 space-y-4 font-sans">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-5 space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                        餐點規格與特配耗用
                      </span>
                      <h4 className="text-white text-xs mt-0.5">本單餐點品項與客製需求：</h4>
                    </div>

                    <div className="divide-y divide-white/5 space-y-3">
                      {selectedOrder.items.map((it: any) => {
                        let addOnsStr = '';
                        if (
                          it.customization?.selectedAddOns &&
                          Array.isArray(it.customization.selectedAddOns)
                        ) {
                          addOnsStr = it.customization.selectedAddOns
                            .map(
                              (a: any) =>
                                `+${getLocalizedText(a.name, 'zh') || a.name}(+$${a.price})`,
                            )
                            .join(' ');
                        }
                        const spec = [
                          it.customization?.spiciness === 0
                            ? '不辣'
                            : it.customization?.spiciness === 1
                              ? '小辣'
                              : it.customization?.spiciness === 2
                                ? '中辣'
                                : '泰辣(+10)',
                          it.customization?.sweetness === 0
                            ? '無糖'
                            : it.customization?.sweetness === 1
                              ? '微糖'
                              : it.customization?.sweetness === 2
                                ? '正常甜'
                                : '多糖',
                          it.customization?.noodleType === 'rice-noodle'
                            ? '河粉'
                            : it.customization?.noodleType === 'vermicelli'
                              ? '米線'
                              : '',
                          it.customization?.soupBase === 'coconut-milk' ? '升級奶香冬蔭(+50)' : '',
                          addOnsStr,
                          it.customization?.notes ? `客備：${it.customization?.notes}` : '',
                        ]
                          .filter(Boolean)
                          .join(' / ');

                        const effectiveUnitPrice = computeOrderItemUnitPrice(it, menuItems);
                        const itemRowTotal = effectiveUnitPrice * (it.qty || 0);

                        return (
                          <div
                            key={it.id}
                            className="pt-3 first:pt-0 flex justify-between items-center text-xs font-sans"
                          >
                            <div className="space-y-1 pr-4">
                              <p className="font-bold text-white text-[13px]">
                                {it.name?.zh || it.name}
                              </p>
                              {spec && (
                                <p className="text-[10px] text-amber-400 font-sans">{spec}</p>
                              )}
                              <p className="text-[10px] text-zinc-500 font-mono">
                                計費單價: NT$ {effectiveUnitPrice}
                              </p>
                            </div>

                            <div className="flex items-center space-x-3">
                              {/* Quantity Editor Buttons */}
                              <div className="flex items-center border border-white/10 rounded-lg bg-black/40 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleLocalQtyChange(it.id, -1)}
                                  className="p-1 px-2 hover:bg-white/5 text-zinc-400 hover:text-white transition cursor-pointer"
                                  title="減少數量"
                                >
                                  <Minus size={10} />
                                </button>
                                <span className="px-2 font-mono text-xs font-bold text-white select-none">
                                  {it.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleLocalQtyChange(it.id, 1)}
                                  className="p-1 px-2 hover:bg-white/5 text-zinc-400 hover:text-white transition cursor-pointer"
                                  title="增加數量"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>

                              <div className="text-right whitespace-nowrap min-w-[70px]">
                                <p className="font-mono text-white font-bold text-[13px]">
                                  NT$ {itemRowTotal.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add dish tool inline */}
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <span className="text-[10px] text-white/40 font-bold block mb-1">
                        ➕ 後台手動新增餐點到此單：
                      </span>
                      <div className="flex gap-2">
                        <select
                          id="modal-append-item-select"
                          className="bg-[#1e1e1e] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white flex-1 cursor-pointer outline-none"
                        >
                          {menuItems.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {getLocalizedText(item.name, 'zh') || item.name} (NT$ {item.price})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById(
                              'modal-append-item-select',
                            ) as HTMLSelectElement;
                            if (selectEl && selectEl.value) {
                              handleAddLocalItem(selectEl.value);
                            }
                          }}
                          className="bg-[#E5B453] hover:bg-[#ebd594] text-black px-4 py-1.5 font-bold rounded-lg text-xs transition cursor-pointer active:scale-95"
                        >
                          確認加點
                        </button>
                      </div>
                    </div>

                    {/* Summary math calculation */}
                    <div className="border-t border-white/10 pt-4 space-y-2.5 text-xs font-sans">
                      <div className="flex justify-between text-zinc-400">
                        <span>餐點客用金額小計 Subtotal</span>
                        <span className="font-mono text-white">
                          NT${' '}
                          {computeOrderItemsSubtotal(
                            selectedOrder.items || [],
                            menuItems,
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>刷卡等計10%客用服務費 Charge</span>
                        <span className="font-mono text-white">
                          NT$ {(selectedOrder.serviceCharge || 0).toLocaleString()}
                        </span>
                      </div>
                      {selectedOrder.isMember && (
                        <div className="flex justify-between text-emerald-400">
                          <span>⭐ Google Quick 會員累點優惠</span>
                          <span>0 元免點累存中</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-white/5 pt-3.5 text-sm font-extrabold text-white">
                        <span className="text-[#E5B453]">親享解算總金額 Total</span>
                        <span className="font-mono text-xl text-[#E5B453]">
                          NT$ {(selectedOrder.total || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Takeout Info Panel */}
                  {selectedOrder.takeoutInfo && (
                    <div className="mt-4 bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 font-sans space-y-2">
                      <div className="flex items-center gap-2 border-b border-blue-500/20 pb-2 mb-2">
                        <span className="text-lg">🥡</span>
                        <h4 className="text-xs font-black text-blue-300 uppercase tracking-wider">
                          外帶表單資訊 Takeout Info
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-zinc-500 block text-[10px] mb-0.5">
                            顧客姓名 Name
                          </span>
                          <span className="text-white font-bold">
                            {selectedOrder.takeoutInfo.customerName}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[10px] mb-0.5">
                            聯絡電話 Phone
                          </span>
                          <span className="text-white font-bold font-mono">
                            {selectedOrder.takeoutInfo.phone}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-500 block text-[10px] mb-0.5">
                            預訂取餐時間 Pickup Time
                          </span>
                          <span className="text-amber-400 font-black font-mono text-sm">
                            {selectedOrder.takeoutInfo.pickupTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checkout screen block */}
                  <div className="mt-4 pt-1 font-sans">
                    <div className="bg-gradient-to-br from-[#1a1a1a] via-[#121212] to-[#0a0a0a] border border-[#E5B453]/20 rounded-xl p-4.5 space-y-3.5">
                      <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                        <Coins className="text-[#E5B453]" size={16} />
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">
                          櫃檯現收收款結帳 Counter Checkout
                        </h4>
                        <span className="bg-amber-500/10 text-amber-400 font-extrabold px-1.5 py-0.5 rounded text-[8px] animate-pulse">
                          待結帳 Unpaid
                        </span>
                      </div>

                      <div className="text-xs space-y-3">
                        <div className="flex justify-between items-center text-zinc-400">
                          <span>應收總計 Final Total:</span>
                          <span className="font-mono font-black text-[#E5B453] text-[15px]">
                            NT$ {(selectedOrder.total || 0).toLocaleString()}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] text-zinc-400 block font-bold">
                            自選結帳管道 Payment Method
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['cash', 'credit', 'member'].map((m) => (
                              <button
                                type="button"
                                key={m}
                                onClick={() => {
                                  setSelectedOrder({ ...selectedOrder, paymentMethod: m as any });
                                }}
                                className={`py-1.5 rounded-lg font-bold text-[10px] uppercase border transition cursor-pointer text-center ${
                                  selectedOrder.paymentMethod === m
                                    ? 'bg-[#E5B453]/20 border-[#E5B453] text-[#E5B453]'
                                    : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/10'
                                }`}
                              >
                                {m === 'cash'
                                  ? '💵 現金'
                                  : m === 'credit'
                                    ? '💳 刷卡'
                                    : '⭐️ 會員儲值'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {selectedOrder.paymentMethod === 'cash' && (
                          <div className="space-y-2 pt-1 font-sans border-t border-[#ffffff08]">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-zinc-400 block font-bold">
                                顧客支付現鈔 Received Bill (NT$)
                              </span>
                              <span className="text-[9px] text-zinc-500">
                                (請點選下方快選或手動輸入)
                              </span>
                            </div>
                            <div className="flex gap-1 justify-between">
                              {[selectedOrder.total, 500, 1000, 2000].map((amt) => (
                                <button
                                  type="button"
                                  key={amt}
                                  onClick={() =>
                                    setCashReceivedInput(Math.max(selectedOrder.total, amt))
                                  }
                                  className="bg-white/5 hover:bg-white/10 border border-white/5 px-2 py-1 rounded text-[10px] text-white font-mono transition cursor-pointer flex-1 text-center"
                                >
                                  ${amt}
                                </button>
                              ))}
                            </div>
                            <input
                              type="number"
                              min={selectedOrder.total}
                              value={cashReceivedInput || ''}
                              onChange={(e) =>
                                setCashReceivedInput(parseInt(e.target.value, 10) || 0)
                              }
                              className="w-full bg-[#1b1b1b] border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:border-[#E5B453]/40 outline-none leading-none"
                            />
                            {/* 💳 櫃檯現場付款結帳確認欄 (Single Order Cash Checkout Confirmation Panel) */}
                            <div className="bg-amber-500/5 border border-amber-500/30 p-2.5 rounded-xl space-y-2 mt-2 text-[10px] font-sans">
                              <div className="flex items-center justify-between border-b border-white/5 pb-1 flex-wrap">
                                <span className="text-[#E5B453] font-black uppercase text-[10.5px]">
                                  📝 現場付訖核算確認 (Checkout Confirmation)
                                </span>
                                <span className="bg-amber-500/10 text-amber-500 text-[8px] px-1 py-0.5 rounded font-black font-mono">
                                  現金收款
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                                <div className="space-y-0.5">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">應付金額 Final:</span>
                                    <span className="font-mono text-xs font-black text-white">
                                      NT$ {selectedOrder.total}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">實收金額 Received:</span>
                                    <span className="font-mono text-xs font-black text-amber-400">
                                      NT$ {cashReceivedInput}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-0.5 border-l border-white/5 pl-2">
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">找零金額 Change:</span>
                                    <span className="font-mono text-sm font-black text-emerald-400 animate-pulse">
                                      NT$ {Math.max(0, cashReceivedInput - selectedOrder.total)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <span className="text-zinc-500">狀態 Status:</span>
                                    <span className="font-bold text-zinc-300">款項確認中</span>
                                  </div>
                                </div>
                              </div>
                              {cashReceivedInput < selectedOrder.total ? (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 py-1 px-2 rounded text-[9px] text-center font-bold">
                                  ⚠️ 實收金額不足！尚差 NT${' '}
                                  {selectedOrder.total - cashReceivedInput} 元
                                </div>
                              ) : (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-1 px-2 rounded text-[9px] text-center font-bold">
                                  ⚡ 現金經核算正確，可安全核可付款並上傳 Firestore 資料庫
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedOrder.paymentMethod === 'member' && (
                          <div className="bg-[#121824]/80 border border-blue-500/20 p-3 rounded-lg font-sans space-y-2.5 text-left">
                            <span className="text-[10px] text-blue-400 font-extrabold block uppercase tracking-wider">
                              👤 會員餘額扣扣狀態 (Member Status)
                            </span>
                            {(() => {
                              const dbStr = localStorage.getItem('google-members-database');
                              if (dbStr) {
                                try {
                                  const db = JSON.parse(dbStr);
                                  let vipEmail = '';
                                  if (selectedOrder.customerName) {
                                    const matched = db.find(
                                      (m: any) => m.name === selectedOrder.customerName,
                                    );
                                    if (matched) {
                                      vipEmail = matched.email;
                                    }
                                  }
                                  const member = vipEmail
                                    ? db.find((m: any) => m.email === vipEmail)
                                    : null;
                                  if (member) {
                                    const hasEnough = member.balance >= selectedOrder.total;
                                    return (
                                      <div className="space-y-2 text-xs">
                                        <div className="flex items-center space-x-2 bg-white/5 p-2 rounded border border-white/5">
                                          <img
                                            referrerPolicy="no-referrer"
                                            src={
                                              member.avatar ||
                                              'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=150'
                                            }
                                            className="w-6 h-6 rounded-full object-cover"
                                            alt=""
                                          />
                                          <div>
                                            <p className="text-[11px] font-bold text-white leading-none">
                                              {member.name}
                                            </p>
                                            <p className="text-[8px] text-zinc-500 font-mono leading-none mt-0.5">
                                              {getMaskedEmail(member.email)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex justify-between font-mono bg-zinc-950 p-1.5 rounded">
                                          <span className="text-zinc-500 text-[10px]">
                                            儲值餘額 Balance:
                                          </span>
                                          <span className="text-emerald-400 font-black">
                                            NT$ {member.balance || 0}
                                          </span>
                                        </div>
                                        {!hasEnough && (
                                          <p className="text-[9px] text-red-400">
                                            ⚠️
                                            餘額不足，請先往收銀台為會員儲值再回到這裡或改為其他付費方式。
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                              return (
                                <p className="text-[10px] text-zinc-500">查無對應 Google 會員</p>
                              );
                            })()}
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleProcessCheckout}
                            className="w-full bg-[#E5B453] hover:bg-[#e4cd91] text-black font-extrabold py-2.5 rounded-xl transition font-sans text-xs active:scale-95 cursor-pointer text-center"
                          >
                            🛒 確定現場付款收款，並將結帳紀錄上傳 Cloud Firestore 資料庫
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print simulator option */}
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 text-xs">
                    <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                      店鋪出餐熱感存票模擬
                    </span>
                    <p className="text-[10px] text-white/40">
                      可將顧客結賬明細或廚房交代工作票重寄發送列印隊列備用明細單：
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const specLines = selectedOrder.items
                            .map((it) => {
                              const spec = [
                                it.customization.spiciness === 0
                                  ? '不辣 (Non-Spicy)'
                                  : it.customization.spiciness === 1
                                    ? '小辣 (Mild)'
                                    : it.customization.spiciness === 2
                                      ? '中辣 (Med)'
                                      : '泰辣 (Hot)',
                                it.customization.sweetness === 0
                                  ? '無糖 (0%)'
                                  : it.customization.sweetness === 1
                                    ? '微糖 (30%)'
                                    : it.customization.sweetness === 2
                                      ? '半糖 (50%)'
                                      : '正常 (100%)',
                                it.customization.noodleType === 'rice-noodle'
                                  ? '河粉'
                                  : it.customization.noodleType === 'vermicelli'
                                    ? '米線'
                                    : '',
                                it.customization.soupBase === 'coconut-milk' ? '加椰奶(+50)' : '',
                                it.customization.notes ? `備註: ${it.customization.notes}` : '',
                              ]
                                .filter(Boolean)
                                .join('/');
                              const pName = it.name
                                ? typeof it.name === 'object'
                                  ? getLocalizedText(it.name, currentLang) || '未命名'
                                  : it.name
                                : '未命名';
                              return `[ ] ${pName} x ${it.qty || 0}份\n    【 ${spec} 】`;
                            })
                            .join('\n');
                          const kitchenStr = `
========================================
       沙貝燒烤 (廚房工作即時交代單-重印)
       桌號/標記: ${selectedOrder.tableNumber || 'N/A'}
========================================
單號 ID: ${selectedOrder.id || 'N/A'}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString() : 'N/A'}
狀態 STATE: ${(selectedOrder.status || '').toUpperCase()}
----------------------------------------
餐點項目與客製需求 Kitchen Item(s):
${specLines}
----------------------------------------
* REPRINT KITCHEN TICKET PRINT PREVIEW *
* 感謝廚房人員辛勞，請依序完成出餐確認 *
========================================`.trim();

                          setPrintConfirmData({
                            title: '重印工作廚房票 Kitchen Ticket',
                            ip: printerIp,
                            receiptType: 'kitchen',
                            receiptBody: kitchenStr,
                            onConfirm: () =>
                              alert(`🖨️ 模擬重行印列【防爆/防油熱感廚房交代票】成功！`),
                          });
                        }}
                        className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10.5px] border border-white/10 font-bold active:scale-95 transition cursor-pointer"
                      >
                        🧾 再印工作廚房票
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const customerDetails = selectedOrder.items
                            .map((it) => {
                              const pName = it.name
                                ? typeof it.name === 'object'
                                  ? getLocalizedText(it.name, currentLang) || '未命名'
                                  : it.name
                                : '未命名';
                              return `  ${pName.padEnd(16)} x${it.qty || 0}  $${(it.price || 0) * (it.qty || 0)}`;
                            })
                            .join('\n');
                          const customerStr = `
========================================
       沙貝燒烤 (顧客結賬與消點收據-重印)
       桌號/標記: ${selectedOrder.tableNumber || 'N/A'} 桌
========================================
單號 ID: ${selectedOrder.id || 'N/A'}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString() : 'N/A'}
付款方式: ${selectedOrder.paymentMethod ? selectedOrder.paymentMethod.toUpperCase() : 'CASH'}
累積儲值會員: ${selectedOrder.isMember ? '是 (小計累積點數中)' : '否'}
----------------------------------------
消費明細 Billing details:
${customerDetails}
----------------------------------------
小計 Total Sub: $${selectedOrder.subtotal || 0}
服務費 Svc(10%): $${selectedOrder.serviceCharge || 0}
實付支付 Net:   $${selectedOrder.total || 0}
========================================
* 感謝您的光臨，美味慢享，期待再次相遇 *
* 憑本熱感收據於當月前台消費享回客點心一份 *
========================================`.trim();

                          setPrintConfirmData({
                            title: '重印顧客結算收據 Customer Receipt',
                            ip: printerIp,
                            receiptType: 'customer',
                            receiptBody: customerStr,
                            onConfirm: () =>
                              alert(`🖨️ 模擬重行印列【顧客結賬發票與消點收據】成功！`),
                          });
                        }}
                        className="flex-1 py-1.5 bg-[#E5B453]/15 hover:bg-[#E5B453]/25 text-[#E5B453] rounded-lg text-[10.5px] border border-[#E5B453]/25 font-bold active:scale-95 transition cursor-pointer"
                      >
                        💵 再印顧客結算收據
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ----------------- PAID ORDER PANEL ----------------- */
                <div className="md:col-span-7 space-y-4 font-sans">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-5 space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                        餐點規格與特配耗用 (已結帳)
                      </span>
                      <h4 className="text-white text-xs mt-0.5">
                        本單餐點品項與客製需求（變更項目需配合退貨稽核簽核）：
                      </h4>
                    </div>

                    <div className="divide-y divide-white/5 space-y-3">
                      {selectedOrder.items.map((it: any) => {
                        const spec = [
                          it.customization?.spiciness === 0
                            ? '不辣'
                            : it.customization?.spiciness === 1
                              ? '小辣'
                              : it.customization?.spiciness === 2
                                ? '中辣'
                                : '泰辣',
                          it.customization?.sweetness === 0
                            ? '無糖'
                            : it.customization?.sweetness === 1
                              ? '微糖'
                              : it.customization?.sweetness === 2
                                ? '正常甜'
                                : '多糖',
                          it.customization?.noodleType === 'rice-noodle'
                            ? '河粉'
                            : it.customization?.noodleType === 'vermicelli'
                              ? '米線'
                              : '',
                          it.customization?.soupBase === 'coconut-milk' ? '升級奶香冬蔭' : '',
                          it.customization?.notes ? `客備：${it.customization?.notes}` : '',
                        ]
                          .filter(Boolean)
                          .join(' / ');

                        return (
                          <div
                            key={it.id}
                            className="pt-3 first:pt-0 flex justify-between items-center text-xs font-sans"
                          >
                            <div className="space-y-1 pr-4">
                              <p className="font-bold text-white text-[13px]">
                                {it.name?.zh || it.name}
                              </p>
                              {spec && (
                                <p className="text-[10px] text-amber-400 font-sans">{spec}</p>
                              )}
                              <p className="text-[10px] text-zinc-500 font-mono">
                                定額單價: NT$ {it.price}
                              </p>
                            </div>

                            <div className="flex items-center space-x-3">
                              {/* Quantity Editor Buttons with Return Workflow */}
                              <div className="flex items-center border border-white/10 rounded-lg bg-black/40 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPaidModDetails({ item: it, delta: -1, isAddingNew: false })
                                  }
                                  className="p-1 px-2 hover:bg-white/5 text-rose-450 hover:text-rose-450 text-rose-400 transition cursor-pointer"
                                  title="欲進行已結帳退貨，請點擊以發起核銷簽核"
                                >
                                  <Minus size={10} />
                                </button>
                                <span className="px-2 font-mono text-xs font-bold text-white select-none">
                                  {it.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPaidModDetails({ item: it, delta: 1, isAddingNew: false })
                                  }
                                  className="p-1 px-2 hover:bg-white/5 text-emerald-450 hover:text-emerald-450 text-emerald-400 transition cursor-pointer"
                                  title="欲進行已結帳加點，請點擊以發起補收簽核"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>

                              <div className="text-right whitespace-nowrap min-w-[70px]">
                                <p className="font-mono text-white font-bold text-[13px]">
                                  NT$ {((it.price || 0) * (it.qty || 0)).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Append item selection dropdown for paid orders */}
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <span className="text-[10px] text-amber-500 font-extrabold block mb-1">
                        ➕ 連動退貨或追加異動（點擊下方以追加商品）：
                      </span>
                      <div className="flex gap-2">
                        <select
                          id="paid-modal-append-item-select"
                          className="bg-[#1c1c1c] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white flex-1 cursor-pointer outline-none"
                        >
                          {menuItems.map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {getLocalizedText(item.name, 'zh') || item.name} (NT$ {item.price})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const selectEl = document.getElementById(
                              'paid-modal-append-item-select',
                            ) as HTMLSelectElement;
                            if (selectEl && selectEl.value) {
                              const dish = menuItems.find((m: any) => m.id === selectEl.value);
                              if (dish) {
                                setPaidModDetails({
                                  menuItemId: dish.id,
                                  item: { name: dish.name, price: dish.price },
                                  delta: 1,
                                  isAddingNew: true,
                                });
                              }
                            }
                          }}
                          className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 font-bold rounded-lg text-xs transition cursor-pointer active:scale-95 shadow-sm shadow-amber-500/10 whitespace-nowrap"
                        >
                          確認追加餐點
                        </button>
                      </div>
                    </div>

                    {/* Summary math calculation */}
                    <div className="border-t border-white/10 pt-4 space-y-2.5 text-xs font-sans">
                      <div className="flex justify-between text-zinc-400">
                        <span>餐點實收金額小計 Subtotal</span>
                        <span className="font-mono text-white">
                          NT$ {(selectedOrder.subtotal || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>刷卡等計10%客用服務費 Charge</span>
                        <span className="font-mono text-white">
                          NT$ {(selectedOrder.serviceCharge || 0).toLocaleString()}
                        </span>
                      </div>
                      {selectedOrder.isMember && (
                        <div className="flex justify-between text-emerald-400">
                          <span>⭐ Google Quick 會員累點優惠</span>
                          <span>0 元免點累存中</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-white/5 pt-3.5 text-sm font-extrabold text-white">
                        <span className="text-[#E5B453]">已結帳核實總金額 Total</span>
                        <span className="font-mono text-xl text-[#E5B453]">
                          NT$ {(selectedOrder.total || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Ledger Audit Rail for modifications */}
                    {selectedOrder.refundLogs && selectedOrder.refundLogs.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-orange-500/20 bg-orange-500/5 p-3 rounded-lg space-y-2">
                        <span className="text-[10px] text-orange-400 font-extrabold block uppercase tracking-wider">
                          📔 已簽核已結帳退貨與追加款稽核明細 ({selectedOrder.refundLogs.length} 筆)
                        </span>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {selectedOrder.refundLogs.map((log: any) => (
                            <div
                              key={log.id}
                              className="text-[10.5px] border-b border-orange-500/10 pb-2 last:border-0 last:pb-0 font-sans"
                            >
                              <div className="flex justify-between font-bold text-white">
                                <span>
                                  {log.type === 'refund'
                                    ? '🏮 已核准退貨核銷'
                                    : '📈 已簽核追加補款'}
                                </span>
                                <span
                                  className={
                                    log.totalDiff < 0
                                      ? 'text-rose-400 font-mono'
                                      : 'text-emerald-400 font-mono'
                                  }
                                >
                                  {log.totalDiff < 0
                                    ? `退核 NT$ ${Math.abs(log.totalDiff)}`
                                    : `補收 NT$ ${log.totalDiff}`}
                                </span>
                              </div>
                              <p className="text-zinc-300 mt-0.5">
                                標的物: {log.itemName} (增減量:{' '}
                                {log.qtyChange > 0 ? `+${log.qtyChange}` : log.qtyChange})
                              </p>
                              <div className="flex justify-between text-zinc-400 text-[9.5px] mt-1 italic font-mono">
                                <span>
                                  原因: {log.reason} {log.notes && `(${log.notes})`}
                                </span>
                                <span>經辦: {log.authorizedByPin}</span>
                              </div>
                              <span className="block text-zinc-500 text-[8.5px] text-right mt-0.5">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Billing complete banner */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center space-y-1">
                    <p className="text-emerald-400 font-extrabold text-xs">💸 此訂單已完成結帳</p>
                    <p className="text-[9.5px] text-zinc-500 font-sans">
                      本筆資金已被安全收付，且對應流水交易紀錄已在 Firebase
                      成功建檔。如因餐點規格異動已自動登錄對沖帳目。
                    </p>
                  </div>

                  {/* Print simulator option */}
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 text-xs">
                    <span className="text-[10px] font-black tracking-widest text-[#E5B453] uppercase block">
                      店鋪出餐熱感存票模擬
                    </span>
                    <p className="text-[10px] text-white/40">
                      可將顧客結賬明細或廚房交代工作票重寄發送列印隊列備用明細單：
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const specLines = selectedOrder.items
                            .map((it) => {
                              const spec = [
                                it.customization.spiciness === 0
                                  ? '不辣 (Non-Spicy)'
                                  : it.customization.spiciness === 1
                                    ? '小辣 (Mild)'
                                    : it.customization.spiciness === 2
                                      ? '中辣 (Med)'
                                      : '泰辣 (Hot)',
                                it.customization.sweetness === 0
                                  ? '無糖 (0%)'
                                  : it.customization.sweetness === 1
                                    ? '微糖 (30%)'
                                    : it.customization.sweetness === 2
                                      ? '半糖 (50%)'
                                      : '正常 (100%)',
                                it.customization.noodleType === 'rice-noodle'
                                  ? '河粉'
                                  : it.customization.noodleType === 'vermicelli'
                                    ? '米線'
                                    : '',
                                it.customization.soupBase === 'coconut-milk' ? '加椰奶(+50)' : '',
                                it.customization.notes ? `備註: ${it.customization.notes}` : '',
                              ]
                                .filter(Boolean)
                                .join('/');
                              const pName = it.name
                                ? typeof it.name === 'object'
                                  ? getLocalizedText(it.name, currentLang) || '未命名'
                                  : it.name
                                : '未命名';
                              return `[ ] ${pName} x ${it.qty}份\n    【 ${spec} 】`;
                            })
                            .join('\n');
                          const kitchenStr = `
========================================
       沙貝燒烤 (廚房工作即時交代單-重印)
       桌號/標記: ${selectedOrder.tableNumber}
========================================
單號 ID: ${selectedOrder.id || 'N/A'}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString() : 'N/A'}
狀態 STATE: ${(selectedOrder.status || '').toUpperCase()}
----------------------------------------
餐點項目與客製需求 Kitchen Item(s):
${specLines}
----------------------------------------
* REPRINT KITCHEN TICKET PRINT PREVIEW *
* 感謝廚房人員辛勞，請依序完成出餐確認 *
========================================`.trim();

                          setPrintConfirmData({
                            title: '重印工作廚房票 Kitchen Ticket',
                            ip: printerIp,
                            receiptType: 'kitchen',
                            receiptBody: kitchenStr,
                            onConfirm: () =>
                              alert(`🖨️ 模擬重行印列【防爆/防油熱感廚房交代票】成功！`),
                          });
                        }}
                        className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10.5px] border border-white/10 font-bold active:scale-95 transition cursor-pointer"
                      >
                        🧾 再印工作廚房票
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const customerDetails = selectedOrder.items
                            .map((it) => {
                              const pName = it.name
                                ? typeof it.name === 'object'
                                  ? getLocalizedText(it.name, currentLang) || '未命名'
                                  : it.name
                                : '未命名';
                              return `  ${pName.padEnd(16)} x${it.qty}  $${it.price * it.qty}`;
                            })
                            .join('\n');
                          const customerStr = `
========================================
       沙貝燒烤 (顧客結賬與消點收據-重印)
       桌號/標記: ${selectedOrder.tableNumber} 桌
========================================
單號 ID: ${selectedOrder.id}
出單 IP : ${printerIp} (VIRTUAL LAN_9100)
時間 TIME: ${new Date(selectedOrder.createdAt).toLocaleTimeString()}
付款方式: ${selectedOrder.paymentMethod ? selectedOrder.paymentMethod.toUpperCase() : 'CASH'}
累積儲值會員: ${selectedOrder.isMember ? '是 (小計累積點數中)' : '否'}
----------------------------------------
消費明細 Billing details:
${customerDetails}
----------------------------------------
小計 Total Sub: $${selectedOrder.subtotal}
服務費 Svc(10%): $${selectedOrder.serviceCharge}
實付支付 Net:   $${selectedOrder.total}
========================================
* 感謝您的光臨，美味慢享，期待再次相遇 *
* 憑本熱感收據於當月前台消費享回客點心一份 *
========================================`.trim();

                          setPrintConfirmData({
                            title: '重印顧客結算收據 Customer Receipt',
                            ip: printerIp,
                            receiptType: 'customer',
                            receiptBody: customerStr,
                            onConfirm: () =>
                              alert(`🖨️ 模擬重行印列【顧客結賬發票與消點收據】成功！`),
                          });
                        }}
                        className="flex-1 py-1.5 bg-[#E5B453]/15 hover:bg-[#E5B453]/25 text-[#E5B453] rounded-lg text-[10.5px] border border-[#E5B453]/25 font-bold active:scale-95 transition cursor-pointer"
                      >
                        💵 再印顧客結算收據
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-white/5 px-6 py-4.5 border-t border-white/10 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 hover:bg-white/5 border border-white/10 rounded-xl text-xs font-bold active:scale-95 transition cursor-pointer"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAID ORDER MODIFICATION APPROVAL MODAL (退貨與追加安全簽核對話框) */}
      {paidModDetails && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          id="paid-order-mod-modal"
        >
          <div className="bg-[#18181b] border border-[#E5B453]/40 rounded-2xl w-full max-w-md p-6 space-y-5 text-left shadow-2xl">
            {/* Title block */}
            <div className="space-y-1">
              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider block w-fit">
                🛡️ SECURE BILLING RECONCILIATION GATEWAY
              </span>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5 pt-1">
                已結帳實收帳目 ➔ 安全退改換貨稽核簽核
              </h3>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                本對單已完成付款。任何品項退計或追加加點將影響總流水帳。請在此登記核銷並輸入授權碼安全記帳。
              </p>
            </div>

            {/* Change Detail Card */}
            <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-2">
              <span className="text-[10px] text-[#E5B453] block uppercase tracking-wider font-extrabold font-mono">
                標的異動明細 (Target change)
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white text-sm">
                  {paidModDetails.isAddingNew ? '追加餐點: ' : ''}
                  {typeof paidModDetails.item?.name === 'object'
                    ? getLocalizedText(paidModDetails.item?.name, currentLang)
                    : paidModDetails.item?.name || ''}
                </span>
                <span className="font-mono bg-white/5 border border-white/15 px-2 py-0.5 rounded text-white font-bold text-[10px]">
                  單價 NT$ {paidModDetails.item?.price}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-zinc-400">異動內容：</span>
                <span className="font-bold text-[#E5B453]">
                  {paidModDetails.isAddingNew
                    ? `全新追加 +1 份`
                    : paidModDetails.delta < 0
                      ? `減少單項餐點數量 -1 份 (退貨)`
                      : `增加單項餐點數量 +1 份 (追加)`}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-zinc-400">預估本筆變更差額：</span>
                <span
                  className={`font-mono font-black text-sm ${paidModDetails.delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}
                >
                  {paidModDetails.delta < 0 ? '-' : '+'}NT$ {paidModDetails.item?.price}
                </span>
              </div>
            </div>

            {/* Input Reason and notes */}
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold">
                  選擇已結帳退減變更之「防弊原因分類」：
                </label>
                <select
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  className="w-full bg-[#202020] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E5B453]/60 cursor-pointer"
                >
                  <option value="kitchen_prep_error">🍳 廚房製餐瑕疵 / 出餐食安退餐</option>
                  <option value="wrong_delivery">🚶‍♂️ 員工送錯桌席 / 漏做重出變更</option>
                  <option value="customer_cancel">⏳ 餐期延誤過長 / 顧客臨時取消</option>
                  <option value="input_error">收銀點錯帳目更正 / 單據錯誤補救</option>
                  <option value="sold_out">🚫 食材中途告罄 / 沽清被迫退餐</option>
                  <option value="vip_promo">🎁 現場 VIP 招待 / 自主促銷補償</option>
                  <option value="customer_addon">➕ 顧客追加點餐 / 現正加碼單量</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-bold">
                  稽核備註/詳情文字描述 (Optional)：
                </label>
                <input
                  type="text"
                  placeholder="請輸入詳情（例如：客席反應烤玉米過焦、漏給醬汁、顧客要求追加等）"
                  value={modNotes}
                  onChange={(e) => setModNotes(e.target.value)}
                  className="w-full bg-[#202020] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E5B453]/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#E5B453] block font-black flex items-center justify-between">
                  <span>🔒 輸入經理人/員工安全簽核 PIN 碼：</span>
                </label>
                <input
                  type="password"
                  maxLength={10}
                  placeholder="請輸入員工授權 PIN 密碼"
                  value={modPin}
                  onChange={(e) => setModPin(e.target.value)}
                  className="w-full bg-black/60 border border-yellow-500/30 rounded-lg px-4 py-2 text-center text-sm tracking-widest text-[#E5B453] font-mono focus:outline-none focus:border-[#E5B453] focus:ring-1 focus:ring-[#E5B453]"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPaidModDetails(null);
                  setModReason('input_error');
                  setModNotes('');
                  setModPin('');
                }}
                className="flex-1 py-2 border border-white/10 rounded-xl hover:bg-white/5 text-zinc-300 font-bold transition text-xs cursor-pointer text-center"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSavePaidModification}
                className="flex-1 py-2 bg-[#E5B453] hover:bg-[#e4cd91] text-black font-extrabold rounded-xl transition text-xs cursor-pointer text-center shadow-lg shadow-[#E5B453]/10"
              >
                📝 核准並對沖登錄流水賬
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISH CREATION/EDITING MODAL FORM */}
      {isFormOpen && (
        <ModalErrorBoundary onClose={() => setIsFormOpen(false)}>
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs font-sans"
            onClick={() => setIsFormOpen(false)}
          >
            <form
              onSubmit={handleSaveItemSubmit}
              className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0">
                <h3 className="font-bold text-sm text-amber-400">
                  {editingItem
                    ? `✏️ 編輯餐點品項 Spec: ${typeof editingItem.id === 'string' || typeof editingItem.id === 'number' ? editingItem.id : ''}`
                    : '➕ 新增菜單美食單品 Add Dish'}
                </h3>
              </div>

              {/* Modal Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="w-full h-36 rounded-xl overflow-hidden relative border border-white/10 [content-visibility:auto] bg-neutral-900/40">
                  {itemImage ? (
                    <>
                      <img
                        key={itemImage}
                        src={itemImage}
                        alt="dish mockup preview"
                        className="w-full h-full object-cover bg-neutral-950"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between p-2.5">
                        <span className="text-[10px] text-zinc-300 font-bold font-sans">
                          🖼️ 菜品圖片預覽 Dish Photo Preview
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemImage('')}
                          className="bg-red-650 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition active:scale-95"
                        >
                          🗑️ 刪除照片 Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 space-y-1">
                      <span className="text-3xl">🍲</span>
                      <span className="text-[10px] text-zinc-400 font-bold">
                        目前無餐點照片 No Image Assigned
                      </span>
                      <span className="text-[9px] text-zinc-500">
                        可在下方選擇預設、填入網址或上傳新圖片
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-3.5 text-left text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400">正體中文標題 Name Zh</label>
                      <input
                        type="text"
                        required
                        value={itemNameZh}
                        onChange={(e) => setItemNameZh(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400">英文對應 Name En</label>
                      <input
                        type="text"
                        value={itemNameEn}
                        onChange={(e) => setItemNameEn(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400">食材分類標記 category</label>
                      <select
                        value={itemCategory}
                        onChange={(e) => setItemCategory(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white leading-tight"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name?.zh || c.name || c.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400">售價 Price (可輸入負數折扣，NT$)</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={itemPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemPrice(val === '' ? '' : Number(val));
                        }}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                  {/* Custom Image Editor Panel */}
                  <div className="space-y-2 border border-white/5 bg-white/[0.02] p-3 rounded-xl text-left">
                    <div className="flex items-center justify-between">
                      <label className="text-amber-400 font-bold block text-[11.5px] tracking-wider uppercase">
                        🎨 菜品照片設定 Custom Photo Settings
                      </label>
                    </div>

                    {/* File Upload (Local file with Storage Upload & Base64 Fallback) */}
                    <div className="space-y-1 mt-1">
                      <span className="text-zinc-400 block text-[10px] font-medium">
                        1. 📤 上傳本機照片 (Upload to Storage)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              alert('⚠️ 圖片檔案過大（上限 5MB），建議壓縮後再上傳！');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              if (typeof reader.result === 'string') {
                                const base64Data = reader.result;
                                try {
                                  const fileExt =
                                    (file.name.includes('.')
                                      ? file.name.split('.').pop()?.toLowerCase()
                                      : '') ||
                                    file.type.split('/')[1] ||
                                    'jpg';
                                  const cleanExt =
                                    fileExt === 'jpeg'
                                      ? 'jpg'
                                      : fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
                                  const rawStem = file.name.includes('.')
                                    ? file.name.substring(0, file.name.lastIndexOf('.'))
                                    : file.name;
                                  const cleanStem = rawStem
                                    .replace(/[^a-zA-Z0-9_-]/g, '')
                                    .replace(/^-+|-+$/g, '');
                                  const dishId = editingItem?.id
                                    ? String(editingItem.id).replace(/[^a-zA-Z0-9_-]/g, '')
                                    : 'dish';
                                  const cleanFilename = cleanStem
                                    ? `${dishId}-${Date.now()}-${cleanStem}.${cleanExt}`
                                    : `${dishId}-${Date.now()}.${cleanExt}`;

                                  const res = await fetch('/api/images/upload', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      base64: base64Data,
                                      filename: cleanFilename,
                                      contentType: file.type,
                                      folder: 'dishes',
                                    }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    if (data?.url) {
                                      setItemImage(data.url);
                                      return;
                                    }
                                  }
                                } catch (uploadErr) {
                                  console.warn('Storage upload fallback to base64:', uploadErr);
                                }
                                // Fallback to local DataURL
                                setItemImage(base64Data);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1 text-zinc-300 font-mono text-[10.5px] file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-[#E5B453] file:text-slate-900 file:cursor-pointer hover:file:bg-amber-400 file:transition"
                      />
                    </div>

                    {/* Custom CDN URL */}
                    <div className="space-y-1 mt-1">
                      <span className="text-zinc-400 block text-[10px] font-medium">
                        2. 🔗 輸入外部圖片網址 (Custom URL)
                      </span>
                      <input
                        type="text"
                        placeholder="https://example.com/food.jpg 或 /api/images/dishes/..."
                        value={itemImage}
                        onChange={(e) => setItemImage(e.target.value)}
                        onBlur={(e) => setItemImage(e.target.value.trim())}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1 text-white font-mono text-[10.5px]"
                      />
                    </div>

                    {/* Preset Gallery Choice */}
                    <div className="space-y-1 mt-1">
                      <span className="text-zinc-400 block text-[10px] font-medium">
                        3. 🍢 選擇精選預設美食照片 (Preset Gallery)
                      </span>
                      <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                        {[
                          {
                            name: '🍢 燒烤 skewers',
                            url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400',
                          },
                          {
                            name: '🍜 湯麵 noodles',
                            url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=400',
                          },
                          {
                            name: '🍲 火鍋 soup',
                            url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400',
                          },
                          {
                            name: '🍗 炸雞 fried',
                            url: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&q=80&w=400',
                          },
                          {
                            name: '🥤 飲品 drink',
                            url: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&q=80&w=400',
                          },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setItemImage(preset.url)}
                            className={`text-[9.5px] p-1.5 rounded border text-center transition truncate cursor-pointer ${
                              itemImage === preset.url
                                ? 'bg-amber-500/20 border-amber-500 text-[#E5B453] font-bold'
                                : 'bg-zinc-900 border-white/5 hover:border-white/10 text-zinc-400'
                            }`}
                            title={preset.name}
                          >
                            {preset.name.split(' ')[0]} {preset.name.split(' ')[1]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400">正體中文描述 Description Zh</label>
                    <textarea
                      rows={2}
                      value={itemDescZh}
                      onChange={(e) => setItemDescZh(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-400">英文寫法 Desc En</label>
                    <textarea
                      rows={2}
                      value={itemDescEn}
                      onChange={(e) => setItemDescEn(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="flex flex-col space-y-2 text-left pt-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="checkbox-is-not-spicy"
                        checked={isNotSpicy}
                        onChange={(e) => setIsNotSpicy(e.target.checked)}
                        className="w-3.5 h-3.5 outline-none rounded bg-[#1e1e1e] border-white/10 text-amber-500 focus:ring-0 active:scale-95 transition"
                      />
                      <label
                        htmlFor="checkbox-is-not-spicy"
                        className="text-zinc-300 font-bold cursor-pointer select-none"
                      >
                        此餐品為【完全不辣】(不勾選則為預設香辣/可調辣度)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="checkbox-is-takeout-available"
                        checked={isTakeoutAvailable}
                        onChange={(e) => setIsTakeoutAvailable(e.target.checked)}
                        className="w-3.5 h-3.5 outline-none rounded bg-[#1e1e1e] border-white/10 text-emerald-500 focus:ring-0 active:scale-95 transition"
                      />
                      <label
                        htmlFor="checkbox-is-takeout-available"
                        className="text-zinc-300 font-bold cursor-pointer select-none text-emerald-400"
                      >
                        ✅ 此餐品【可供外帶】(勾選後在外帶模式中可供點購)
                      </label>
                    </div>
                  </div>

                  {/* 自訂加選項目配置 panel (User customizable options) */}
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="text-amber-400 font-bold block text-[11px] tracking-wider uppercase">
                      可自訂單品附加選項 Custom Extra Add-Ons
                    </label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {customAddOns.length === 0 ? (
                        <p className="text-[10px] text-zinc-500 italic">
                          目前無自訂附加選項 (可使用下方控制列添加專屬加料或客製配件如: 加蛋, 加肉)
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5">
                          {customAddOns.map((opt, idx) => (
                            <div
                              key={opt.id || idx}
                              className="flex items-center justify-between bg-white/5 px-2.5 py-2 rounded-lg border border-white/10 text-[11px]"
                            >
                              <span className="font-bold text-white/90">
                                {getLocalizedText(opt.name, 'zh')}
                              </span>
                              <div className="flex items-center space-x-2.5">
                                <span className="font-mono text-[#E5B453] font-bold">
                                  +NT$ {opt.price}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCustomAddOns(customAddOns.filter((_, i) => i !== idx))
                                  }
                                  className="text-rose-400 hover:text-rose-300 font-bold active:scale-90 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                                >
                                  移除
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 快速導入全域規則庫 */}
                    {globalRules.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 block">
                          💡 快速點選匯入全域客製選項規則 (Quick Import Global Rules)：
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto bg-[#0C0C0C] p-1.5 rounded-lg border border-white/5">
                          {globalRules.map((gr) => {
                            const isAdded = customAddOns.some(
                              (o) =>
                                getLocalizedText(o.name, 'zh') === getLocalizedText(gr.name, 'zh'),
                            );
                            return (
                              <button
                                key={`quick-${gr.id}`}
                                type="button"
                                disabled={isAdded}
                                onClick={() => {
                                  const newOption = {
                                    id: `addon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                                    name: gr.name,
                                    price: gr.price,
                                  };
                                  setCustomAddOns([...customAddOns, newOption]);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] transition font-semibold flex items-center space-x-1 border ${
                                  isAdded
                                    ? 'bg-zinc-800/40 border-zinc-700/20 text-zinc-600 cursor-not-allowed'
                                    : 'bg-[#E5B453]/10 hover:bg-[#E5B453]/20 border-[#E5B453]/30 text-[#E5B453] cursor-pointer'
                                }`}
                              >
                                <span>
                                  {gr.name} (+${gr.price})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 增加選項輸入列 */}
                    <div className="flex items-center space-x-2 bg-black/40 p-2 rounded-xl border border-white/5 mt-1.5">
                      <input
                        type="text"
                        id="new-opt-name"
                        placeholder="例如: 加蛋 Add Egg, 加倍肉"
                        className="flex-1 bg-[#222222] border border-white/10 rounded px-2.5 py-1 text-white text-[11px]"
                      />
                      <input
                        type="number"
                        id="new-opt-price"
                        placeholder="金額"
                        className="w-16 bg-[#222222] border border-white/10 rounded px-2 py-1 text-white font-mono text-[11px]"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nameInput = document.getElementById(
                            'new-opt-name',
                          ) as HTMLInputElement;
                          const priceInput = document.getElementById(
                            'new-opt-price',
                          ) as HTMLInputElement;
                          if (!nameInput || !priceInput) return;
                          const name = nameInput.value.trim();
                          const price = parseInt(priceInput.value, 10) || 0;
                          if (!name) {
                            alert('請輸入選項名稱！');
                            return;
                          }
                          const newOption = {
                            id: `addon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            name,
                            price,
                          };
                          setCustomAddOns([...customAddOns, newOption]);
                          nameInput.value = '';
                          priceInput.value = '';
                        }}
                        className="px-3 py-1 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded text-[11px] active:scale-95 transition cursor-pointer shadow"
                      >
                        ➕ 新增
                      </button>
                    </div>
                  </div>

                  {/* 食材配比設定 (Recipe Ingredients Configuration) */}
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="text-amber-400 font-bold block text-[11px] tracking-wider uppercase">
                      🍱 餐點原料扣減配比設定 (Ingredient Recipe Link Ratios)
                    </label>
                    <p className="text-[10px] text-zinc-500 italic">
                      當此餐點被點購時，系統將依據此處設定的比例自動精準扣減原料庫存。不設定則使用系統依品名/特徵自動推算规则。
                    </p>

                    {/* Active Recipe Ratios List */}
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {itemRecipe.length === 0 ? (
                        <div className="text-[10px] text-zinc-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                          ⚠️
                          目前未額外指定配比（點餐時，系統將自動以品類名、辣度、海鮮或牛肉等常規規則進行扣減）。
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5">
                          {itemRecipe.map((rec, idx) => {
                            const ing = ingredients.find((i) => i.id === rec.ingredientId);
                            return (
                              <div
                                key={rec.ingredientId}
                                className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px]"
                              >
                                <span className="font-bold text-white/90">
                                  {ing
                                    ? `${getLocalizedText(ing.name, 'zh')} (${ing.id})`
                                    : `未知材料 (${rec.ingredientId})`}
                                </span>
                                <div className="flex items-center space-x-2.5">
                                  <span className="font-mono text-emerald-400 font-bold">
                                    {rec.amount} {ing?.unit || '單位'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setItemRecipe(itemRecipe.filter((_, i) => i !== idx))
                                    }
                                    className="text-rose-400 hover:text-rose-300 font-bold active:scale-90 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                                  >
                                    移除
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add dynamic recipe item builder */}
                    <div className="flex items-center space-x-2 bg-black/40 p-2 rounded-xl border border-white/5 mt-1.5">
                      <div className="flex-1">
                        <select
                          value={newRecipeIngId}
                          onChange={(e) => setNewRecipeIngId(e.target.value)}
                          className="w-full bg-[#222222] border border-white/10 rounded px-2.5 py-1 text-white text-[11px]"
                        >
                          <option value="">選擇要連動的原料...</option>
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {getLocalizedText(ing.name, 'zh')} (目前庫存: {ing.stock} {ing.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20 relative">
                        <input
                          type="number"
                          step="any"
                          placeholder="份數"
                          value={newRecipeAmount}
                          onChange={(e) => setNewRecipeAmount(e.target.value)}
                          className="w-full bg-[#222222] border border-white/10 rounded px-2 py-1 text-white font-mono text-[11px]"
                          min="0.001"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500">
                          {ingredients.find((i) => i.id === newRecipeIngId)?.unit || ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newRecipeIngId) {
                            alert('請選擇原料項目！');
                            return;
                          }
                          const amount = parseFloat(newRecipeAmount);
                          if (isNaN(amount) || amount <= 0) {
                            alert('量值必須大於 0 ！');
                            return;
                          }

                          // Check if already in recipe
                          if (itemRecipe.some((ir) => ir.ingredientId === newRecipeIngId)) {
                            alert('此原料已在配比列表中！如需調整，請先移除後再新增。');
                            return;
                          }

                          setItemRecipe([...itemRecipe, { ingredientId: newRecipeIngId, amount }]);
                          setNewRecipeIngId('');
                          setNewRecipeAmount('1');
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded text-[11px] active:scale-95 transition cursor-pointer shadow"
                      >
                        ➕ 連動
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Modal Fixed Footer */}
              <div className="flex justify-end space-x-2 p-5 border-t border-white/5 bg-zinc-900/40 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 hover:bg-white/5 border border-white/10 rounded-lg font-bold transition active:scale-95 cursor-pointer text-white"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded-lg active:scale-95 transition cursor-pointer shadow-md"
                >
                  儲存餐點
                </button>
              </div>
            </form>
          </div>
        </ModalErrorBoundary>
      )}

      {/* CATEGORY ADDITION/EDITING MODAL FORM */}
      {isCatFormOpen && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs font-sans"
          onClick={() => setIsCatFormOpen(false)}
        >
          <form
            onSubmit={handleSaveCatSubmit}
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0">
              <h3 className="font-bold text-sm text-amber-400">
                {editingCategory
                  ? `✏️ 編輯分類：${editingCategory.id}`
                  : '➕ 新增菜單分類標籤 Create Category'}
              </h3>
            </div>

            {/* Modal Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {catError && (
                <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded font-bold">
                  {catError}
                </div>
              )}
              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-zinc-400">
                    分類標記 ID 碼 (英文小寫，如 tomyum，留空則自動生成，儲存後不得修改)
                  </label>
                  <input
                    type="text"
                    disabled={!!editingCategory}
                    placeholder="例如 tomyum (留空則自動隨機生成)"
                    value={catId}
                    onChange={(e) => setCatId(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono disabled:opacity-40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400">中文正體類別名稱 Name Zh</label>
                  <input
                    type="text"
                    required
                    value={catNameZh}
                    onChange={(e) => setCatNameZh(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    id="cat-show-on-customer"
                    checked={catShowOnCustomer}
                    onChange={(e) => setCatShowOnCustomer(e.target.checked)}
                    className="rounded border-zinc-700 bg-[#1e1e1e] text-[#E5B453] focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <label
                    htmlFor="cat-show-on-customer"
                    className="text-zinc-350 cursor-pointer font-bold select-none"
                  >
                    顯示於顧客線上點餐頁面 (Show on Customer Page)
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400">英文對應 Name En</label>
                  <input
                    type="text"
                    value={catNameEn}
                    onChange={(e) => setCatNameEn(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2.5 text-[11px]">
                  <div className="space-y-1">
                    <label className="text-zinc-500">泰文 Name Th</label>
                    <input
                      type="text"
                      value={catNameTh}
                      onChange={(e) => setCatNameTh(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500">日文 Name Ja</label>
                    <input
                      type="text"
                      value={catNameJa}
                      onChange={(e) => setCatNameJa(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500">韓文 Name Ko</label>
                    <input
                      type="text"
                      value={catNameKo}
                      onChange={(e) => setCatNameKo(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-zinc-500">越文 Name Vi</label>
                    <input
                      type="text"
                      value={catNameVi}
                      onChange={(e) => setCatNameVi(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2 py-1 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Modal Fixed Footer */}
            <div className="flex justify-end space-x-2 p-5 border-t border-white/5 bg-zinc-900/40 flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setIsCatFormOpen(false)}
                className="px-4 py-1.5 hover:bg-white/5 border border-white/10 rounded font-bold transition active:scale-95 cursor-pointer text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded transition active:scale-95 cursor-pointer shadow-sm"
              >
                儲存分類
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABLE SETTING MODAL FORM */}
      {isTableFormOpen && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center text-xs font-sans"
          onClick={() => setIsTableFormOpen(false)}
        >
          <form
            onSubmit={handleTableSaveSubmit}
            className="bg-[#121212] border-t border-white/10 w-full h-full md:h-full lg:h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0 flex items-center justify-between">
              <h3 className="font-bold text-sm text-amber-400">
                {editingTableObj
                  ? `✏️ 編輯客座：第 ${editingTableObj.id} 桌`
                  : '➕ 新增客座與條碼定位 Create Table'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTableFormOpen(false)}
                className="text-white/40 hover:text-white text-base font-mono"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {tableError && (
                <div className="p-2.5 bg-rose-500/10 text-rose-400 font-bold rounded">
                  {tableError}
                </div>
              )}
              {tableSuccess && (
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 font-bold rounded">
                  {tableSuccess}
                </div>
              )}
              <div className="space-y-3.5 text-left">
                <div className="space-y-1">
                  <span className="text-zinc-500 block">
                    桌鍵號碼 Table ID (限阿拉伯數字，保存後不改)
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    disabled={!!editingTableObj}
                    value={tableIdInput}
                    onChange={(e) => setTableIdInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-zinc-500 block">
                    客用條碼定位 URL QR (點餐自動扣桌號用連結)
                  </span>
                  <input
                    type="text"
                    value={tableQrUrlInput}
                    onChange={(e) => setTableQrUrlInput(e.target.value)}
                    placeholder="如 https://sabaybbq.com/?table=6"
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono placeholder-white/20"
                  />
                  <div className="pt-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const finalId = tableIdInput.trim() || '6';
                        setTableQrUrlInput(`https://sabay-bbq-order.web.app/?table=${finalId}`);
                      }}
                      className="text-[9.5px] text-[#E5B453] hover:text-amber-300 font-bold bg-[#E5B453]/10 border border-[#E5B453]/35 px-2.5 py-1 rounded-lg transition whitespace-nowrap inline-flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      ✨ 免手打：自動帶入 Firebase 託管點餐連結
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-zinc-500 block">
                    桌席人數上限 Max Capacity (選填，可作為訂位人數參考)
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tableMaxCapacityInput}
                    onChange={(e) => setTableMaxCapacityInput(e.target.value)}
                    placeholder="例如: 4"
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono placeholder-white/20"
                  />
                </div>
              </div>
            </div>
            {/* Modal Fixed Footer */}
            <div className="flex justify-end space-x-2 p-5 border-t border-white/5 bg-zinc-900/40 flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setIsTableFormOpen(false)}
                className="px-4 py-1.5 hover:bg-white/5 border border-white/10 rounded transition cursor-pointer text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded transition cursor-pointer shadow-md"
              >
                儲存桌次
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESERVATION SETTING MODAL FORM */}
      {isResFormOpen && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs font-sans"
          onClick={() => setIsResFormOpen(false)}
        >
          <form
            onSubmit={handleReservationSaveSubmit}
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 pb-3 border-b border-white/5 flex-shrink-0 flex items-center justify-between">
              <h3 className="font-bold text-sm text-amber-400">
                {editingResObj
                  ? `✏️ 編輯顧客預約：${editingResObj.customerName}`
                  : '📅 新增預約訂位紀錄 Add Reservation'}
              </h3>
              <button
                type="button"
                onClick={() => setIsResFormOpen(false)}
                className="text-white/40 hover:text-white text-base font-mono"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {resError && (
                <div className="p-2.5 bg-rose-500/10 text-rose-400 font-bold rounded-lg">
                  {resError}
                </div>
              )}
              {resSuccess && (
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg">
                  {resSuccess}
                </div>
              )}

              <div className="space-y-3.5 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-sans block text-[10px]">
                      顧客姓名 Name *
                    </span>
                    <input
                      type="text"
                      required
                      value={resNameInput}
                      onChange={(e) => setResNameInput(e.target.value)}
                      placeholder="例如：林大明 先生"
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-sans block text-[10px]">
                      連絡電話 Phone *
                    </span>
                    <input
                      type="tel"
                      required
                      value={resPhoneInput}
                      onChange={(e) => {
                        setResPhoneInput(e.target.value);
                        setResPhoneError(false);
                      }}
                      placeholder="例如：0912-345-678 或 02-2345-6789"
                      className={`w-full bg-[#1e1e1e] border ${
                        resPhoneError
                          ? 'border-red-500 focus:border-red-500 ring-2 ring-red-500/20'
                          : 'border-white/10 focus:border-[#E5B453]'
                      } rounded px-2.5 py-1.5 text-white outline-none transition-all`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-sans text-[10px] flex items-center justify-between">
                      <span>預定日期 Date *</span>
                      {!isResDateValid && (
                        <span className="text-rose-500 font-bold text-xs">
                          {restDays && restDays.includes(resDateInput)
                            ? '公休日無法訂位'
                            : '無效或超過3個月'}
                        </span>
                      )}
                    </span>
                    <input
                      type="date"
                      required
                      min={todayDateStr}
                      max={maxThreeMonthsDateStr}
                      value={resDateInput}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setResDateInput(newDate);
                        if (!newDate) return;
                        const candidateSlots = generateCandidateSlots(newDate);
                        if (candidateSlots.length > 0 && !candidateSlots.includes(resTimeInput)) {
                          setResTimeInput(candidateSlots[0]);
                        }
                      }}
                      className={`w-full bg-[#1e1e1e] border ${!isResDateValid ? 'border-rose-500 text-rose-500 focus:border-rose-400' : 'border-white/10 focus:border-[#E5B453] text-white'} rounded px-2.5 py-1.5 font-mono outline-none transition-all`}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-sans text-[10px] flex items-center justify-between">
                      <span>預訂時間 Time *</span>
                      {!isResTimeValid && (
                        <span className="text-rose-500 font-bold">非營業時間</span>
                      )}
                    </span>
                    <select
                      required
                      value={resTimeInput}
                      onChange={(e) => setResTimeInput(e.target.value)}
                      disabled={!resDateInput || (restDays && restDays.includes(resDateInput))}
                      className={`w-full bg-[#1e1e1e] border ${!isResTimeValid ? 'border-rose-500 focus:border-rose-400 text-rose-500' : 'border-white/10 focus:border-[#E5B453] text-white'} rounded px-2.5 py-1.5 font-mono outline-none transition-all`}
                    >
                      {generateCandidateSlots(resDateInput).map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-sans block text-[10px]">
                      用餐人數 Guest Count *
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      required
                      value={resGuestsInput}
                      onChange={(e) => setResGuestsInput(Number(e.target.value))}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 font-sans block text-[10px]">
                      指定桌號 Designated Table *
                    </span>
                    <div className="w-full bg-[#1e1e1e] border border-white/10 rounded p-1.5 text-white max-h-32 overflow-y-auto space-y-1">
                      {(() => {
                        const currentSelectedCapacity = tables
                          .filter((t) => resTableInputs.includes(t.id))
                          .reduce((sum, t) => sum + (t.maxCapacity || 0), 0);

                        return tables.map((t) => {
                          const isChecked = resTableInputs.includes(t.id);
                          const isDisabled =
                            !isChecked && currentSelectedCapacity >= resGuestsInput;

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
                                  if (e.target.checked) {
                                    setResTableInputs((prev) => [...prev, t.id]);
                                  } else {
                                    setResTableInputs((prev) => prev.filter((id) => id !== t.id));
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

                <div className="space-y-1">
                  <span className="text-zinc-500 font-sans block text-[10px]">
                    備註需求 Notes (選填)
                  </span>
                  <textarea
                    value={resNotesInput}
                    onChange={(e) => setResNotesInput(e.target.value)}
                    placeholder="加不辣/嬰兒椅/需靠窗等需求"
                    rows={2}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded px-2.5 py-1.5 text-white resize-none"
                  />
                </div>

                {/* 預約訂位專屬連結 & 預約編號區塊 */}
                <div className="bg-amber-950/25 border border-amber-500/30 rounded-xl p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-zinc-400 font-sans block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
                        預約編號 (依預約日期自動產生序號) Reservation Serial No.
                      </span>
                      <div className="flex items-center gap-2 mt-1 flex-nowrap overflow-x-auto pb-0.5">
                        <span className="text-amber-400 font-mono font-black text-xs sm:text-sm bg-black/60 px-2.5 py-1 rounded border border-amber-500/30 whitespace-nowrap shrink-0">
                          {resNoInput || generateReservationNo(resDateInput, reservations)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const currentNo =
                          resNoInput || generateReservationNo(resDateInput, reservations);
                        setResNoInput(currentNo);
                        const origin = window.location.origin;
                        const link = `${origin}/?reservationNo=${encodeURIComponent(currentNo)}&tableNumber=${encodeURIComponent(resTableInputs.join(',') || '1')}&resName=${encodeURIComponent(resNameInput || '預約顧客')}&resDate=${encodeURIComponent(resDateInput)}&resTime=${encodeURIComponent(resTimeInput)}`;
                        setGeneratedResLink(link);
                        try {
                          navigator.clipboard.writeText(link);
                          setCopiedLinkNotice(true);
                          setTimeout(() => setCopiedLinkNotice(false), 3000);
                        } catch (err) {
                          console.error('Copy link failed', err);
                        }
                      }}
                      className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-1.5 shrink-0"
                    >
                      🔗 新增預約訂位專屬連結
                    </button>
                  </div>

                  {/* 顯示產生的專屬連結與複製說明 */}
                  {generatedResLink && (
                    <div className="bg-gradient-to-r from-zinc-900 via-black to-zinc-950 border border-amber-500/40 rounded-xl p-3 space-y-2 text-left">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-amber-400 font-extrabold text-xs flex items-center gap-1">
                          ✨ 專屬預約點餐連結已產生
                        </span>
                        {copiedLinkNotice && (
                          <span className="text-emerald-400 font-bold text-[10.5px] bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                            ✅ 已複製連結至剪貼簿！
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedResLink}
                          className="flex-1 bg-black border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-mono outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedResLink);
                            setCopiedLinkNotice(true);
                            setTimeout(() => setCopiedLinkNotice(false), 3000);
                          }}
                          className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-lg border border-amber-500/30 cursor-pointer transition shrink-0"
                        >
                          📋 複製專屬連結
                        </button>
                      </div>

                      <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                        💡 顧客點擊此連結可進入「顧客前台」點餐且
                        <strong className="text-amber-300 font-bold">不受營業時間限制</strong>
                        自由瀏覽與送單。點餐送出後會直接進入「廚房KDS」，預約日期前顯示
                        <strong className="text-purple-300">保留狀態</strong>
                        ，於預約日期當天營業時間自動解除保留開放廚房作業。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Modal Fixed Footer */}
            <div className="flex justify-end space-x-2 p-5 border-t border-white/5 bg-zinc-900/40 flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setIsResFormOpen(false)}
                className="px-4 py-1.5 hover:bg-white/5 border border-white/10 rounded transition cursor-pointer text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded transition cursor-pointer shadow-md"
              >
                儲存預約
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ⚡ 快速補貨或調整庫位微調彈出視窗 Quick Restock Modal */}
      {quickRestockItem && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs font-sans"
          id="quick-restock-dialog"
          onClick={() => setQuickRestockItem(null)}
        >
          <div
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-sm text-amber-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>快速補貨：{getLocalizedText(quickRestockItem.name, 'zh')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setQuickRestockItem(null)}
                className="text-white/40 hover:text-white/80 transition text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                <div className="flex justify-between text-zinc-500 text-[10px]">
                  <span>當前庫水位 Stock</span>
                  <span>最低安全防禦 Threshold</span>
                </div>
                <div className="flex justify-between font-mono font-bold text-xs mt-1">
                  <span
                    className={
                      quickRestockItem.stock <= quickRestockItem.minThreshold
                        ? 'text-rose-400'
                        : 'text-white'
                    }
                  >
                    {quickRestockItem.stock} {quickRestockItem.unit}
                  </span>
                  <span className="text-zinc-500">
                    {quickRestockItem.minThreshold} {quickRestockItem.unit}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-400 font-medium">
                  補貨進貨量 ({quickRestockItem.unit})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder="輸入要增加的數量 (如 10 或 50)"
                  value={quickRestockQty}
                  onChange={(e) => setQuickRestockQty(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-center text-sm font-extrabold font-mono text-white focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-1.5">
                {[5, 10, 20, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuickRestockQty(String(preset))}
                    className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/5 text-white font-bold font-mono text-[10px] rounded transition active:scale-95 cursor-pointer"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 p-5 border-t border-white/5 bg-zinc-900/40 text-xs">
              <button
                type="button"
                onClick={() => setQuickRestockItem(null)}
                className="px-4 py-1.5 hover:bg-white/5 border border-white/10 rounded font-bold transition active:scale-95 cursor-pointer text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const amt = Number(quickRestockQty);
                  if (isNaN(amt) || amt <= 0) {
                    alert('❌ 請輸入有效的補貨數量！');
                    return;
                  }
                  try {
                    await onRestock(quickRestockItem.id, amt);
                    alert(
                      `🎉 成功為「${getLocalizedText(quickRestockItem.name, 'zh')}」快速進貨 +${amt} ${quickRestockItem.unit}！`,
                    );
                    setQuickRestockItem(null);
                  } catch (err: any) {
                    console.error(err);
                    alert('⚠️ 快速補貨程序異常，請重試！');
                  }
                }}
                className="px-4 py-1.5 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded transition active:scale-95 cursor-pointer shadow-sm"
              >
                確認進補
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧾 櫃檯收銀二次確認彈出視窗 Cashier Checkout Confirmation Dialog */}
      {showCheckoutConfirm && cashierSelectedOrder && (
        <div
          id="checkout-confirm-modal"
          className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-xs font-sans animate-fadeIn"
        >
          <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-left transition-all duration-300">
            <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#E5B453] flex items-center gap-1.5">
                <Coins size={15} />
                <span>櫃檯收銀二次確認 Checkout Confirm</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCheckoutConfirm(false)}
                className="text-white/40 hover:text-white/80 transition text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-black/35 border border-white/5 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>結帳桌號 Table(s)</span>
                  <span className="text-white font-mono font-bold bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
                    {cashierMergedOrders.map((o) => o.tableNumber).join(' + ')} 桌
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-400">
                  <span>主單編號 Order ID</span>
                  <span className="text-white font-mono font-semibold">
                    {cashierSelectedOrder.id.substring(0, 8)}...
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-400">
                  <span>付款方式 Payment</span>
                  <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md text-xs">
                    {cashierPaymentMethod === 'cash' && '💵 現金支付 Cash'}
                    {cashierPaymentMethod === 'credit' && '💳 信用卡 Credit Card (+10%)'}
                    {cashierPaymentMethod === 'twqr' && '📱 TWQR行動支付 (+10%)'}
                    {cashierPaymentMethod === 'member' && '👤 會員餘額扣款 VIP Member'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-400 pt-1 border-t border-white/5">
                  <span>餐點小計 Subtotal</span>
                  <span className="text-white font-mono font-bold">
                    NT$ {cashierCalculatedTotals?.subtotal.toLocaleString()}
                  </span>
                </div>

                {cashierCalculatedTotals && cashierCalculatedTotals.discount > 0 && (
                  <div className="flex justify-between items-center text-rose-400">
                    <span>
                      折扣折抵 Discount (
                      {cashierDiscountType === 'percent'
                        ? `${cashierDiscountRate}% OFF`
                        : '固定折抵'}
                      )
                    </span>
                    <span className="font-mono font-bold">
                      - NT$ {cashierCalculatedTotals.discount.toLocaleString()}
                    </span>
                  </div>
                )}

                {cashierCalculatedTotals && cashierCalculatedTotals.surcharge > 0 && (
                  <div className="flex justify-between items-center text-blue-400">
                    <span>
                      服務費/加成 Surcharge (
                      {cashierSurchargeType === 'percent' ? `${cashierSurchargeRate}%` : '固定加成'}
                      )
                    </span>
                    <span className="font-mono font-bold">
                      + NT$ {cashierCalculatedTotals.surcharge.toLocaleString()}
                    </span>
                  </div>
                )}

                {cashierPaymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>實收現金 Cash Received</span>
                      <span className="text-white font-mono font-bold text-sm">
                        NT$ {cashierCashReceived}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>應找零錢 Change Provided</span>
                      <span className="text-emerald-400 font-mono font-bold text-sm">
                        NT${' '}
                        {Math.max(0, cashierCashReceived - (cashierCalculatedTotals?.total || 0))}
                      </span>
                    </div>
                  </>
                )}

                <div className="border-t border-white/10 pt-3 flex justify-between items-center text-zinc-300">
                  <span className="font-bold text-xs">應付總額 Final Total</span>
                  <span className="text-[#E5B453] font-mono text-xl font-black">
                    NT$ {cashierCalculatedTotals?.total.toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                ℹ️
                請確認款項點收無誤。點選上方「確認結清」後，系統將會儲存收銀紀錄，並將此桌席與連屬訂單更改為「已付清並釋放空桌」。
              </p>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-end space-x-3.5">
              <button
                type="button"
                disabled={isCheckoutSubmitting}
                onClick={() => setShowCheckoutConfirm(false)}
                className={`px-4 py-2 border border-white/10 rounded-lg font-bold transition text-white text-xs ${
                  isCheckoutSubmitting
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-white/5 active:scale-95 cursor-pointer'
                }`}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isCheckoutSubmitting}
                onClick={async () => {
                  try {
                    await handleCashierCheckoutSubmit();
                    setShowCheckoutConfirm(false);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className={`flex-1 py-2 bg-[#E5B453] text-slate-900 font-extrabold rounded-lg transition text-xs text-center font-bold flex items-center justify-center space-x-1.5 ${
                  isCheckoutSubmitting
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-amber-400 active:scale-95 cursor-pointer shadow-md'
                }`}
              >
                {isCheckoutSubmitting && (
                  <span className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>{isCheckoutSubmitting ? '處理中...' : '🎯 確認結清並放桌'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 列印確認視窗 Printer Selection / Confirmation Dialog */}
      {printConfirmData && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-xs font-sans animate-fadeIn"
          id="print-confirmation-dialog-manager"
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
                  請確認您已與印表機硬體連線至同一區域網路內（WiFi），並確認印表機已開機且狀態正常。
                </p>

                {/* Additional simulated details */}
                <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl text-[10px] space-y-1.5 font-mono text-amber-400/80">
                  <span className="text-[9px] font-black tracking-widest text-[#E5B453] uppercase block">
                    🟢 virtual queue live
                  </span>
                  <p>
                    ✔ 出單格式:{' '}
                    {printConfirmData.receiptType === 'eod'
                      ? '每日營業結算日報表 (EOD Report)'
                      : printConfirmData.receiptType === 'kitchen'
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

      {/* 🧾 結帳完成收據出單對話框 Checkout Completed Success Dialog */}
      {checkoutSuccessData && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 text-xs font-sans animate-fadeIn"
          id="checkout-success-dialog"
          onClick={() => {
            setCheckoutSuccessData(null);
            setCheckoutPrintSuccess(null);
          }}
        >
          <div
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-left transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
              <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 font-serif">
                <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Check size={14} />
                </span>
                <span>系統結帳成功 / Transaction Settled</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCheckoutSuccessData(null);
                  setCheckoutPrintSuccess(null);
                }}
                className="text-white/40 hover:text-white/80 transition text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              <div className="text-center py-2">
                <div className="inline-block p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
                  <Coins size={32} />
                </div>
                <h4 className="text-lg font-bold text-white font-serif">
                  應收總額: NT$ {checkoutSuccessData.total}
                </h4>
                <p className="text-white/40 text-[10px] tracking-wide mt-1 font-mono">
                  單號: {checkoutSuccessData.id}
                </p>
              </div>

              {/* Order specifications breakdown */}
              <div className="border-t border-b border-white/5 py-4 space-y-2.5 font-sans">
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-500 font-sans">客座編號 Table:</span>
                  <span className="bg-emerald-500/15 text-emerald-400 font-extrabold px-2 py-0.5 rounded text-[10px]">
                    {checkoutSuccessData.tableNumber} 桌
                  </span>
                </div>
                <div className="flex justify-between items-center text-zinc-300 text-[11px]">
                  <span className="text-zinc-500 font-sans">原始原價 Subtotal:</span>
                  <span className="font-mono text-white/95">
                    NT$ {checkoutSuccessData.subtotal}
                  </span>
                </div>
                {checkoutSuccessData.discount > 0 && (
                  <div className="flex justify-between items-center text-amber-400 text-[11px]">
                    <span className="font-sans">折扣減免 Discount:</span>
                    <span className="font-mono">- NT$ {checkoutSuccessData.discount}</span>
                  </div>
                )}
                {checkoutSuccessData.serviceCharge > 0 && (
                  <div className="flex justify-between items-center text-zinc-300 text-[11px]">
                    <span className="text-zinc-500 font-sans">服務費/加成 Service Surcharge:</span>
                    <span className="font-mono text-white/95">
                      + NT$ {checkoutSuccessData.serviceCharge}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-zinc-300 border-t border-dashed border-white/5 pt-2.5">
                  <span className="text-zinc-500 font-sans">付款方式 Method:</span>
                  <span className="font-bold text-white/95 uppercase font-mono">
                    {checkoutSuccessData.paymentMethod}
                  </span>
                </div>

                {checkoutSuccessData.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between items-center text-zinc-300 text-[11px]">
                      <span className="text-zinc-500 font-bold font-sans">Cash 實收 Received:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        NT$ {checkoutSuccessData.amountPaid}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-300 text-[11px]">
                      <span className="text-zinc-500 font-sans">找零金額 Change Back:</span>
                      <span className="font-mono font-black text-amber-400">
                        NT$ {checkoutSuccessData.changeProvided}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Status or alerts */}
              {checkoutPrintSuccess ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-lg text-center font-bold text-[11px]">
                  {checkoutPrintSuccess}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-white/5 p-2.5 rounded-lg text-center text-zinc-400 text-[10px]">
                  <span>🟢 交易憑證已妥善上傳儲存至 Cloud Firestore！</span>
                </div>
              )}
            </div>

            {/* Footer buttons with the core print receipt request */}
            <div className="flex items-center justify-end space-x-3 p-5 border-t border-white/5 bg-zinc-900/40 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCheckoutSuccessData(null);
                  setCheckoutPrintSuccess(null);
                }}
                className="px-4 py-2 hover:bg-white/5 border border-white/10 rounded-lg text-white font-bold transition active:scale-95 cursor-pointer"
              >
                關閉視窗 Close
              </button>

              <button
                type="button"
                disabled={checkoutPrintLoading}
                onClick={async () => {
                  if (onPrintTestPage) {
                    setCheckoutPrintLoading(true);
                    setCheckoutPrintSuccess(null);
                    try {
                      const res = await onPrintTestPage();
                      if (res.success) {
                        setCheckoutPrintSuccess('✅ 收據已成功發送至出單列印佇列！');
                      } else {
                        setCheckoutPrintSuccess(`❌ 列印失敗: ${res.error || '連線逾時'}`);
                      }
                    } catch (e: any) {
                      setCheckoutPrintSuccess(`❌ 列印錯誤: ${e?.message || String(e)}`);
                    } finally {
                      setCheckoutPrintLoading(false);
                    }
                  } else {
                    setCheckoutPrintSuccess('⚠️ 系統測試列印程序未就緒！');
                  }
                }}
                className="px-4 py-2 bg-[#E5B453] hover:bg-amber-400 text-slate-900 font-extrabold rounded-lg transition active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {checkoutPrintLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Printer size={14} />
                )}
                <span>列印收據 (Direct Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reusable Action Confirmation Dialog */}
      {confirmActionModal && confirmActionModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 text-xs font-sans animate-fadeIn">
          <div className="bg-[#161616] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-2.5 text-rose-500 text-left">
                <AlertTriangle size={20} className="shrink-0" />
                <h3 className="font-extrabold text-white text-base tracking-wide font-sans">
                  {confirmActionModal.title}
                </h3>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed font-medium text-left">
                {confirmActionModal.message}
              </p>
            </div>
            <div className="p-4 bg-zinc-900/60 border-t border-white/5 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setConfirmActionModal(null)}
                className="px-4 py-2 hover:bg-white/5 border border-white/10 rounded-lg text-zinc-400 hover:text-white font-bold transition active:scale-95 cursor-pointer text-[11px]"
              >
                取消 Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await confirmActionModal.onConfirm();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setConfirmActionModal(null);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-lg transition active:scale-95 cursor-pointer shadow-md shadow-rose-600/10 text-[11px]"
              >
                {confirmActionModal.actionLabel || '確定 Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Member Points Adjustment Modal */}
      {adjustPointsModal && adjustPointsModal.isOpen && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000] flex items-center justify-center p-4 text-xs font-sans animate-fadeIn"
          id="adjust-points-modal-container"
        >
          <div className="bg-[#18181A] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp text-left">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-2.5 text-[#E5B453]">
                <Coins size={22} className="shrink-0 animate-bounce" />
                <h3 className="font-extrabold text-white text-base tracking-wide font-sans">
                  🪙 手動調整會員點數 Adjust Points
                </h3>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-400">會員名稱 Member Name:</span>
                  <span className="text-white font-bold">{adjustPointsModal.name}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-400 font-sans">綁定郵箱 Email:</span>
                  <span className="text-zinc-400 font-mono">
                    {getMaskedEmail(adjustPointsModal.email)}
                  </span>
                </div>
                <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">當前累積點數 Current Points:</span>
                  <span className="text-[#E5B453] font-black font-mono text-sm">
                    {adjustPointsModal.currentPoints} 點
                  </span>
                </div>
              </div>

              {adjustPointsError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[11px] font-semibold rounded-lg text-left">
                  ⚠️ {adjustPointsError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-zinc-300 font-bold block text-xs">
                  ✍️ 請輸入增減點數 (正數累計，負數扣除)：
                </label>
                <div className="relative">
                  <input
                    type="number"
                    autoFocus
                    value={adjustPointsValue}
                    onChange={(e) => {
                      setAdjustPointsValue(e.target.value);
                      setAdjustPointsError(null);
                    }}
                    placeholder="例如: 100 或 -200"
                    className="w-full bg-black border border-white/15 rounded-xl px-4 py-3 font-mono text-white text-sm focus:outline-none focus:border-[#E5B453] transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold font-sans">
                    點
                  </span>
                </div>
              </div>

              {/* Quick adjustment presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                  ⚡ 快速增增減 (Quick Presets)：
                </span>
                <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustPointsValue('100');
                      setAdjustPointsError(null);
                    }}
                    className="py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/20 text-emerald-400 rounded-lg font-mono font-bold hover:scale-[1.03] transition cursor-pointer text-center"
                  >
                    +100 點
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustPointsValue('500');
                      setAdjustPointsError(null);
                    }}
                    className="py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/20 text-emerald-400 rounded-lg font-mono font-bold hover:scale-[1.03] transition cursor-pointer text-center"
                  >
                    +500 點
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustPointsValue('-100');
                      setAdjustPointsError(null);
                    }}
                    className="py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/20 text-rose-400 rounded-lg font-mono font-bold hover:scale-[1.03] transition cursor-pointer text-center"
                  >
                    -100 點
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustPointsValue('-500');
                      setAdjustPointsError(null);
                    }}
                    className="py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/20 text-rose-400 rounded-lg font-mono font-bold hover:scale-[1.03] transition cursor-pointer text-center"
                  >
                    -500 點
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-900/80 border-t border-white/5 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setAdjustPointsModal(null)}
                className="px-4 py-2 hover:bg-white/5 border border-white/10 rounded-lg text-zinc-400 hover:text-white font-bold transition active:scale-95 cursor-pointer text-[11px]"
              >
                取消 Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePointsAdjustment}
                className="px-5 py-2 bg-[#E5B453] hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-md shadow-[#E5B453]/10 transition active:scale-95 cursor-pointer text-[11px]"
              >
                💾 確定調整 Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Add Member Modal */}
      {addMemberModalOpen && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000] flex items-center justify-center p-4 text-xs font-sans animate-fadeIn"
          id="add-member-modal-container"
        >
          <div className="bg-[#18181A] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp text-left">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-2.5 text-[#E5B453]">
                <Plus size={22} className="shrink-0 animate-bounce" />
                <h3 className="font-extrabold text-white text-base tracking-wide font-sans">
                  👤 手動新增顧客會員 Add New Member
                </h3>
              </div>

              {addMemberError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[11px] font-semibold rounded-lg text-left">
                  ⚠️ {addMemberError}
                </div>
              )}

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-bold block text-[11px]">
                    顧客姓名 Name *
                  </label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      setAddMemberError(null);
                    }}
                    placeholder="例如: 王小明"
                    className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#E5B453] transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-bold block text-[11px]">
                    電子郵箱 Email * (用於唯一帳戶識別)
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => {
                      setNewMemberEmail(e.target.value);
                      setAddMemberError(null);
                    }}
                    placeholder="例如: xiaoming@gmail.com"
                    className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#E5B453] transition font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-zinc-400 font-bold block text-[11px]">
                      初始儲值金 (NT$)
                    </label>
                    <input
                      type="number"
                      value={newMemberBalance}
                      onChange={(e) => {
                        setNewMemberBalance(e.target.value);
                        setAddMemberError(null);
                      }}
                      min="0"
                      className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#E5B453] transition font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-400 font-bold block text-[11px]">
                      初始點數 (Points)
                    </label>
                    <input
                      type="number"
                      value={newMemberPoints}
                      onChange={(e) => {
                        setNewMemberPoints(e.target.value);
                        setAddMemberError(null);
                      }}
                      min="0"
                      className="w-full bg-black border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-[#E5B453] transition font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setAddMemberModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-white/5 text-zinc-300 font-extrabold rounded-lg transition active:scale-95 cursor-pointer text-[11px]"
                >
                  取消 Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const name = newMemberName.trim();
                    const email = newMemberEmail.trim().toLowerCase();
                    const balance = parseInt(newMemberBalance, 10) || 0;
                    const points = parseInt(newMemberPoints, 10) || 0;

                    if (!name) {
                      setAddMemberError('請輸入顧客姓名！');
                      return;
                    }
                    if (!email) {
                      setAddMemberError('請輸入電子郵箱！');
                      return;
                    }
                    if (!email.includes('@')) {
                      setAddMemberError('請輸入有效的電子郵箱格式！');
                      return;
                    }

                    const dbStr = localStorage.getItem('google-members-database');
                    let db: any[] = [];
                    if (dbStr) {
                      try {
                        db = JSON.parse(dbStr);
                      } catch (e) {
                        db = [];
                      }
                    }

                    if (db.some((m: any) => m.email && m.email.toLowerCase().trim() === email)) {
                      setAddMemberError('此電子郵箱已被其他會員綁定使用！');
                      return;
                    }

                    const newMember = {
                      name,
                      email,
                      avatar:
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
                      joinedAt: new Date().toISOString().split('T')[0],
                      balance,
                      points,
                    };

                    db.push(newMember);
                    localStorage.setItem('google-members-database', JSON.stringify(db));
                    localStorage.setItem(`google-points-${email}`, String(points));

                    window.dispatchEvent(new Event('local-points-updated'));
                    loadMembers();
                    setAddMemberModalOpen(false);
                  }}
                  className="px-4 py-2 bg-[#E5B453] hover:bg-[#d6a546] text-black font-extrabold rounded-lg transition active:scale-95 cursor-pointer shadow-md shadow-[#E5B453]/10 text-[11px]"
                >
                  確認新增 Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
