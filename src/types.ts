export interface MenuItem {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  category: string;
  image?: string;
  description?: string;
  descriptionEn?: string;
  available: boolean;
}

export interface CartItem {
  id: string; // generated per cart entry
  menuItem: MenuItem;
  quantity: number;
  remarks: string;
  selectedModifiers: string[];
}

export type OrderStatus = 'pending' | 'preparing' | 'completed';

export interface Order {
  id: string;
  tenantId: string;
  table_id: string;
  items: {
    name: string;
    nameEn: string;
    price: number;
    quantity: number;
    remarks: string;
    selectedModifiers: string[];
  }[];
  total_amount: number;
  status: OrderStatus;
  timestamp: string; // ISO String
  isFlagged: boolean;
  flagReason?: string;
  paymentMethod: 'Cash' | 'Credit Card' | 'Mobile Pay';
}

export interface QueueJob {
  id: string; // UUID
  timestamp: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  description: string;
}

export interface LanguageResources {
  menu: string;
  cart: string;
  placeOrder: string;
  total: string;
  table: string;
  takeout: string;
  minSpendMsg: string;
  remarksPlaceholder: string;
  addRemarks: string;
  addCart: string;
  modifiers: string;
  subtotal: string;
  emptyCart: string;
  orderSent: string;
  orderSentOffline: string;
  orderStatus: string;
  pending: string;
  preparing: string;
  completed: string;
  searchMenu: string;
  allCategories: string;
  statusTrackerTitle: string;
  toastCompleted: string;
}

export interface Tenant {
  id: string;
  name: string;
  nameEn: string;
  minSpend: number;
  currency: string;
  tables: string[];
  contactNumber?: string;
  address?: string;
  createdAt: string;
}
