// Types for Sabay BBQ Web Ordering App

export type Language = 'zh' | 'en' | 'ko' | 'ja' | 'th' | 'vi';

export interface CustomAddOn {
  id: string;
  name: { [key in Language]?: string } | string;
  price: number;
}

export interface FoodCustomization {
  sweetness: number; // 0=No, 1=Less, 2=Regular, 3=Extra
  spiciness: number; // 0=None, 1=Mild (小辣), 2=Medium (中辣), 3=Thai Spicy (大辣, +10)
  noodleType?: 'rice-noodle' | 'vermicelli' | 'none'; // for Tom Yum noodles
  soupBase?: 'plain' | 'coconut-milk'; // +50
  notes: string;
  selectedAddOns?: CustomAddOn[];
}

export interface MenuItem {
  id: string;
  category: string;
  name: { [key in Language]?: string };
  price: number;
  image: string;
  description: { [key in Language]?: string };
  available: boolean;
  isAvailable?: boolean;
  isSetMeal?: boolean;
  requiredSaucesOption?: boolean; // needs dipping options
  hasNoodlesOption?: boolean;
  hasCoconutsMilkOption?: boolean;
  containsBeef?: boolean;
  containsPork?: boolean;
  containsSeafood?: boolean;
  isNotSpicy?: boolean;
  customAddOns?: CustomAddOn[];
  recipe?: { ingredientId: string; amount: number }[];
  orderIndex?: number;
  isTakeoutAvailable?: boolean;
  soldOutAt?: string | null;
}

export interface OrderItem {
  id: string; // instance id
  menuItemId: string;
  name: { [key in Language]?: string };
  price: number;
  qty: number;
  customization: FoodCustomization;
  isPrepared?: boolean;
  isCompleted?: boolean;
}

export type OrderStatus = 'pending' | 'preparing' | 'paid' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  subtotal: number;
  serviceCharge: number; // 10% for dine-in if credit card, or 10% standard fee
  total: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  customerAvatar: string;
  paymentMethod: 'cash' | 'credit' | 'member' | 'twqr';
  isMember: boolean;
  isPaid?: boolean;
  guestCount?: number;
  refundLogs?: unknown[];
  discount?: number;
  quickNotes?: string;
  isFlagged?: boolean;
  flagReason?: string;
  takeoutInfo?: {
    customerName: string;
    phone: string;
    pickupTime: string;
  };
  rating?: number;
  feedback?: string;
  isOfflinePending?: boolean;
  clientOrderId?: string;
  reservationNo?: string;
  reservationDate?: string;
  reservationTime?: string;
}

export interface Ingredient {
  id: string;
  name: { [key in Language]?: string };
  stock: number;
  minThreshold: number; // triggers alerts
  unit: string;
}

// Map menu food item ID to its ingredient cost mapping
export interface IngredientCost {
  ingredientId: string;
  amount: number;
}

export interface Category {
  id: string;
  name: { [key in Language]?: string };
  showOnCustomerPage?: boolean;
  orderIndex?: number;
}

export interface TableConfig {
  id: string;
  qrCodeUrl: string;
  status?: 'available' | 'preserved' | 'reserved' | 'in_use' | 'pending_checkout' | 'cleaning';
  preservedFor?: string;
  mergedWith?: string;
  positionX?: number;
  positionY?: number;
  isOfflinePending?: boolean;
  maxCapacity?: number;
  cleaningStartedAt?: string | null;
}

export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  guestCount: number;
  tableNumber: string;
  date: string;
  time: string;
  status:
    'pending' | 'confirmed' | 'seated' | 'cancelled' | 'completed' | 'checked_out' | 'upcoming';
  notes?: string;
  createdAt: string;
  reservationNo?: string;
}

export interface OperatingHourSlot {
  id: string;
  name: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  days: number[]; // days of week, 0-6 (0 is Sunday, 6 is Saturday)
  isActive: boolean;
  isReservableOnly?: boolean; // 可預約時段 (營業時間外只開放給已預約顧客)
}

export interface OrderHistoryUserStatus {
  isMember: boolean;
  memberId?: string;
  hasPastOrders: boolean;
}

export interface OrderHistoryBillStatus {
  hasUnpaidBillOnTable: boolean;
  tableNumber?: string;
}

export interface AnalyticsDataResponse {
  totalRevenue: number;
  ordersCount: number;
  categorySales: { category: string; revenue: number }[];
  hourlyDistribution: { timeSlot: string; orders: number }[];
  topDishes: { name: string; qty: number }[];
  stockWarnings: Ingredient[];
}

export interface PrinterConfigResponse {
  ip?: string;
  name?: string;
}

export interface PromoComboResponse {
  enabled: boolean;
  requiredQty: number;
  discountAmount: number;
  eligibleItemIds: string[];
}

export interface OperatingHoursResponse {
  slots?: OperatingHourSlot[];
  restDays?: string[];
  isOpen?: boolean;
}

export interface MembersConfigResponse {
  pointsRatio?: number;
  rewards?: { id: string; name: string; points: number }[];
}

export interface CustomerNoticeResponse {
  notice?: string;
}
