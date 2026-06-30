import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOfflineQueue } from './OfflineQueueContext';
import { Tenant, UserAccount, UserRole } from '../types';
import { 
  Users, 
  Lock, 
  UserCheck, 
  Edit, 
  Key, 
  Building, 
  Check, 
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  Shield,
  X
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const {
    tenants,
    updateTenant,
    isOnline,
    simulatedOffline,
    users,
    addUserAccount,
    deleteUserAccount
  } = useOfflineQueue();

  const isEffectiveOnline = isOnline && !simulatedOffline;

  // Admin PIN configuration states
  const [adminPin, setAdminPin] = useState(() => {
    return localStorage.getItem('sabay_thai_admin_pin') || 'Eur0pe2266';
  });
  const [newAdminPin, setNewAdminPin] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [adminPinSuccess, setAdminPinSuccess] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);

  // Branch PIN editing states
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [newBranchPin, setNewBranchPin] = useState('');
  const [branchPinError, setBranchPinError] = useState('');
  const [branchPinSuccess, setBranchPinSuccess] = useState(false);
  const [showBranchPinMap, setShowBranchPinMap] = useState<Record<string, boolean>>({});

  // New account creation window state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPin, setNewUserPin] = useState('');

  // Custom user deletion confirmation modal state
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<{
    isOpen: boolean;
    userId: string;
    username: string;
  }>({
    isOpen: false,
    userId: '',
    username: ''
  });
  const [newUserRole, setNewUserRole] = useState<UserRole>('BRANCH_STAFF');
  const [newUserTenantId, setNewUserTenantId] = useState('DEFAULT');
  const [newUserError, setNewUserError] = useState('');
  const [newUserSuccess, setNewUserSuccess] = useState(false);

  const handleUpdateAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinError('');
    setAdminPinSuccess(false);

    const trimmed = newAdminPin.trim();
    if (trimmed.length < 6) {
      setAdminPinError('管理員安全密碼長度必須至少為 6 位！');
      return;
    }

    localStorage.setItem('sabay_thai_admin_pin', trimmed);
    setAdminPin(trimmed);
    setNewAdminPin('');
    setAdminPinSuccess(true);
    setTimeout(() => {
      setAdminPinSuccess(false);
    }, 3000);
  };

  const handleToggleShowBranchPin = (branchId: string) => {
    setShowBranchPinMap(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }));
  };

  const handleStartEditBranchPin = (tenant: Tenant) => {
    setEditingBranchId(tenant.id);
    const currentPin = tenant.pin || (tenant.id === 'DEFAULT' ? '111111' : tenant.id === 'EAST_BRANCH' ? '222222' : '333333');
    setNewBranchPin(currentPin);
    setBranchPinError('');
  };

  const handleSaveBranchPin = async (tenant: Tenant) => {
    setBranchPinError('');
    setBranchPinSuccess(false);

    const trimmed = newBranchPin.trim();
    if (trimmed.length !== 6 || !/^\d+$/.test(trimmed)) {
      setBranchPinError('分店 PIN 碼必須剛好是 6 位數字！');
      return;
    }

    try {
      const updatedTenant: Tenant = {
        ...tenant,
        pin: trimmed
      };
      updateTenant(updatedTenant);
      setEditingBranchId(null);
      setNewBranchPin('');
      setBranchPinSuccess(true);
      setTimeout(() => {
        setBranchPinSuccess(false);
      }, 3000);
    } catch (err: any) {
      setBranchPinError('更換失敗: ' + err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError('');

    const usernameTrimmed = newUsername.trim();
    const pinTrimmed = newUserPin.trim();

    if (!usernameTrimmed) {
      setNewUserError('請輸入使用者名稱！');
      return;
    }

    if (pinTrimmed.length !== 6 || !/^\d+$/.test(pinTrimmed)) {
      setNewUserError('PIN 碼必須剛好是 6 位數字！');
      return;
    }

    // Check if duplicate PIN
    const isDuplicatePin = users.some(u => u.pin === pinTrimmed);
    if (isDuplicatePin || pinTrimmed === adminPin) {
      setNewUserError('此 PIN 碼已被其他使用者或系統預設超管佔用！');
      return;
    }

    const newUser: UserAccount = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      username: usernameTrimmed,
      pin: pinTrimmed,
      role: newUserRole,
      tenantId: newUserRole === 'SUPER_ADMIN' ? 'ALL' : newUserTenantId,
      createdAt: new Date().toISOString()
    };

    try {
      addUserAccount(newUser);
      
      // Reset form & state
      setNewUsername('');
      setNewUserPin('');
      setNewUserRole('BRANCH_STAFF');
      setNewUserTenantId('DEFAULT');
      setIsNewUserModalOpen(false);
      setNewUserSuccess(true);
      setTimeout(() => {
        setNewUserSuccess(false);
      }, 3000);
    } catch (err: any) {
      setNewUserError('建立帳號失敗: ' + err.message);
    }
  };

  const handleDeleteUser = (userId: string, username: string) => {
    setDeleteUserConfirm({
      isOpen: true,
      userId,
      username
    });
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen p-6 pb-24">
      
      {/* Toast Notification for Success actions */}
      <AnimatePresence>
        {(adminPinSuccess || branchPinSuccess || newUserSuccess) && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-[999] flex items-center gap-3 bg-slate-900 border border-emerald-500/40 px-5 py-4 rounded-2xl shadow-2xl"
          >
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <Check className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-100">設定儲存成功</p>
              <p className="text-[10px] text-slate-400">登入帳密與 PIN 碼已即時更新，系統同步完成。</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              <span>帳號與權限設定中心</span>
              <span className="text-[10px] font-mono bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded font-black border border-indigo-900/30">
                STAFF ACCESS HUB
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              管理系統最高管理員及各分店、品牌端點之現場服務人員 (Branch Staff) 的登入帳號與安全 PIN 碼。
            </p>
          </div>
        </div>

        {/* Create User Button */}
        <button
          onClick={() => setIsNewUserModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer transition-all shrink-0 border border-indigo-500/30"
        >
          <UserPlus className="h-4 w-4" />
          <span>建立新帳號</span>
        </button>
      </header>

      {/* New User Account Creation Modal Window */}
      <AnimatePresence>
        {isNewUserModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 border-b border-slate-850 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <h3 className="font-black text-sm text-slate-100">建立全新使用者帳號</h3>
                </div>
                <button
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    使用者名稱 / 員工暱稱
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例如: 忠孝店廚房-阿泰"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                {/* Role selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    分配帳號角色 (Role Assignment)
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setNewUserRole(role);
                      if (role === 'SUPER_ADMIN') {
                        setNewUserTenantId('ALL');
                      } else {
                        setNewUserTenantId(tenants[0]?.id || 'DEFAULT');
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="BRANCH_STAFF">分店現場服務端 (BRANCH_STAFF)</option>
                    <option value="SUPER_ADMIN">集團最高管理員 (SUPER_ADMIN)</option>
                  </select>
                </div>

                {/* Tenant association */}
                {newUserRole === 'BRANCH_STAFF' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      關聯特定分店 (Data Isolation Context)
                    </label>
                    <select
                      value={newUserTenantId}
                      onChange={(e) => setNewUserTenantId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} (ID: {t.id})
                        </option>
                      ))}
                    </select>
                    <span className="text-[9.5px] text-slate-500 block leading-normal mt-1">
                      * 該人員登入後只能檢視及處理所屬分店的 KDS 訂單與狀態，其餘分店資料將受系統層隔離。
                    </span>
                  </div>
                )}

                {/* Secure Pin */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    安全登入 PIN 碼 (6 位數字)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="請輸入 6 位數數字"
                    value={newUserPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewUserPin(val);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono tracking-widest focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                {newUserError && (
                  <div className="text-[10px] text-rose-400 font-bold flex items-center gap-1.5 bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{newUserError}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewUserModalOpen(false)}
                    className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/10 cursor-pointer"
                  >
                    確定建立
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left column: Super Admin default Credentials */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <Lock className="h-24 w-24 text-slate-400" />
            </div>
            
            <h2 className="text-sm font-black text-slate-200 flex items-center gap-2 mb-1">
              <UserCheck className="h-5 w-5 text-indigo-400" />
              <span>最高管理員 (Super Admin)</span>
            </h2>
            <p className="text-[11px] text-slate-400 mb-6">
              控制全域系統最高權限 (包含多租戶、菜單分發及離線佇列強制清除等功能)。
            </p>

            <div className="bg-slate-950 rounded-2xl p-4.5 border border-slate-850 text-xs mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-slate-500 font-medium">目前的帳號角色</span>
                <span className="font-mono bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2.5 py-0.5 rounded font-black text-[10px]">
                  SUPER_ADMIN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">當前最高登入安全密碼</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-200 font-bold tracking-widest text-[13px]">
                    {showAdminPin ? adminPin : '••••••'}
                  </span>
                  <button
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                  >
                    {showAdminPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Change Admin Pin Form */}
            <form onSubmit={handleUpdateAdminPin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
                  設定全新最高管理員密碼：
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="請輸入管理密碼 (至少 6 位)"
                    value={newAdminPin}
                    onChange={(e) => {
                      setNewAdminPin(e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono tracking-widest focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                  <div className="absolute right-3.5 top-2.5 text-slate-500">
                    <Key className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {adminPinError && (
                <div className="text-[10.5px] text-rose-400 font-bold flex items-center gap-1.5 bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{adminPinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={newAdminPin.length < 6}
                className={`w-full font-black text-xs py-2.5 rounded-xl transition-all ${
                  newAdminPin.length >= 6
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                }`}
              >
                儲存管理員安全密碼
              </button>
            </form>
          </section>

          {/* Sync status card info */}
          <div className="bg-slate-900/50 border border-slate-850/60 rounded-2xl p-4.5 text-xs text-slate-400 space-y-2">
            <h4 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              <span>實體同步與權限定義安全宣告</span>
            </h4>
            <p className="leading-relaxed text-[11px]">
              為了確保離線作業時各品牌分店的營運不中斷，所有的分店 PIN 碼修改與新建使用者皆經過 context 資料層的佇列同步包裝。若目前處於離線狀態，更改的內容將於重新連線後即時同頻至雲端資料庫，離線狀態下刷新網頁仍會讀取 Local 緩存。
            </p>
          </div>
        </div>

        {/* Right column: Custom user accounts & default branches accounts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Custom Accounts List Section */}
          <section className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-sm font-black text-slate-200 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-400" />
                <span>新建使用者帳號列表 ({users.length} 筆)</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                此處顯示所有客製建立的分店或超管帳號，均各自受限於所對應的分店租戶 (tenantId) 資料保護政策。
              </p>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-10 bg-slate-950 rounded-2xl border border-dashed border-slate-800">
                <Users className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">目前尚無新建自訂帳號</p>
                <p className="text-[10px] text-slate-500 mt-1">您可以點擊右上角「建立新帳號」為現場夥伴分派獨立的登入憑證。</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {users.map((user) => {
                  const boundBranch = tenants.find(t => t.id === user.tenantId);
                  return (
                    <div 
                      key={user.id} 
                      className="bg-slate-950 rounded-2xl p-4 border border-slate-850/80 flex items-center justify-between gap-4 hover:border-indigo-500/20 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-100">{user.username}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            user.role === 'SUPER_ADMIN'
                              ? 'bg-rose-950/40 text-rose-400 border-rose-900/30'
                              : 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30'
                          }`}>
                            {user.role === 'SUPER_ADMIN' ? '集團超管' : '分店人員'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3 text-slate-500" />
                            <span>關聯店端: {user.role === 'SUPER_ADMIN' ? '全域 (ALL)' : (boundBranch?.name || `未命名分店 (${user.tenantId})`)}</span>
                          </span>
                          <span className="text-slate-700">|</span>
                          <span className="flex items-center gap-1">
                            <Key className="h-3 w-3 text-slate-500" />
                            <span className="font-mono font-bold tracking-wider">PIN: {user.pin}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="p-2 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-slate-850 cursor-pointer"
                        title="刪除帳號"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Legacy default branches list */}
          <section className="bg-slate-900 border border-slate-850 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-black text-slate-200 flex items-center gap-2">
                  <Building className="h-5 w-5 text-indigo-400" />
                  <span>分店預設 PIN 密鑰快速變更</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">
                  現場服務端點預設 (BRANCH_STAFF) 快速登入 PIN 碼。
                </p>
              </div>
            </div>

            {/* List of active branch staff users */}
            <div className="space-y-4">
              {tenants.map((branch) => {
                const isEditing = editingBranchId === branch.id;
                const currentPin = branch.pin || (branch.id === 'DEFAULT' ? '111111' : branch.id === 'EAST_BRANCH' ? '222222' : '333333');
                const isShowPin = showBranchPinMap[branch.id] || false;

                return (
                  <div 
                    key={branch.id} 
                    className="bg-slate-950 rounded-2xl p-4.5 border border-slate-850/80 hover:border-slate-800 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left: Branch details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-xs text-slate-200">{branch.name}</h3>
                          <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">
                            ID: {branch.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>預設角色:</span>
                          <span className="font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            BRANCH_STAFF
                          </span>
                        </div>
                      </div>

                      {/* Right: Auth PIN controls */}
                      <div className="flex items-center gap-3 shrink-0">
                        
                        {isEditing ? (
                          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                            <input
                              type="text"
                              maxLength={6}
                              value={newBranchPin}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setNewBranchPin(val);
                              }}
                              className="w-24 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs font-mono tracking-widest text-center focus:outline-none focus:border-indigo-500/50"
                              placeholder="新 PIN 碼"
                            />
                            <button
                              onClick={() => handleSaveBranchPin(branch)}
                              disabled={newBranchPin.length !== 6}
                              className={`p-1 px-2.5 rounded-lg text-xs font-bold ${
                                newBranchPin.length === 6
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                  : 'bg-slate-850 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => setEditingBranchId(null)}
                              className="p-1 px-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-900 border border-slate-850 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PIN 碼:</span>
                              <span className="font-mono text-xs font-black tracking-widest text-slate-200">
                                {isShowPin ? currentPin : '••••••'}
                              </span>
                              <button
                                onClick={() => handleToggleShowBranchPin(branch.id)}
                                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                {isShowPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>

                            <button
                              onClick={() => handleStartEditBranchPin(branch)}
                              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-850 rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1 font-bold"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>修改 PIN</span>
                            </button>
                          </div>
                        )}

                      </div>

                    </div>
                    {isEditing && branchPinError && (
                      <div className="mt-3 text-[10px] text-rose-400 font-bold flex items-center gap-1.5 bg-rose-950/10 border border-rose-900/20 p-2 rounded-lg">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{branchPinError}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

        </div>

      </div>

      {/* CUSTOM MODAL: DELETE USER CONFIRMATION */}
      <AnimatePresence>
        {deleteUserConfirm.isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setDeleteUserConfirm({ isOpen: false, userId: '', username: '' })}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-3 text-red-400 mb-2">
                <div className="bg-red-500/15 p-2 rounded-xl border border-red-500/30">
                  <AlertTriangle className="h-5 w-5 stroke-[2.5]" />
                </div>
                <h2 className="text-lg font-black text-slate-100">
                  確認刪除使用者帳號？
                </h2>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                您確定要永久刪除使用者「<span className="text-slate-100 font-bold">{deleteUserConfirm.username}</span>」嗎？
              </p>

              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 mb-6 space-y-2 leading-relaxed">
                <h4 className="font-bold">⚠️ 安全提示：</h4>
                <p>此動作將會立即撤銷該帳號的系統存取權限。該使用者將被強制登出且無法再使用原有帳密/PIN 碼進行任何後台或前台操作。</p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setDeleteUserConfirm({ isOpen: false, userId: '', username: '' })}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700/60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = deleteUserConfirm.userId;
                    try {
                      deleteUserAccount(targetId);
                      setDeleteUserConfirm({ isOpen: false, userId: '', username: '' });
                    } catch (err: any) {
                      alert('刪除失敗: ' + err.message);
                    }
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>確認永久刪除</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
