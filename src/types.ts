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
  assignedBranches?: string[]; // IDs of branches (tenants) this item is distributed to
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
  urgent?: boolean;
  paymentMethod: 'Cash' | 'Credit Card' | 'Mobile Pay';
}

export type UserRole = 'SUPER_ADMIN' | 'BRANCH_STAFF';

export interface UserSession {
  role: UserRole;
  branchId: string; // if SUPER_ADMIN, can switch or access 'ALL'. if BRANCH_STAFF, strictly locked to their branch ID.
  branchName: string;
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

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  description: string;
  syncedAt: string;
  status: 'success' | 'failed';
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
  pin?: string; // staff login PIN for this specific branch
  lastHeartbeat?: string; // ISO string for tracking connection status
}

export interface UserAccount {
  id: string;
  username: string;
  pin: string;
  role: UserRole;
  tenantId: string; // associate to a specific branch/tenant, or 'ALL' for super admin
  createdAt: string;
}

