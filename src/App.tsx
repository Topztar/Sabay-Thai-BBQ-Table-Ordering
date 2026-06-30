import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { OfflineQueueProvider, useOfflineQueue } from './components/OfflineQueueContext';
import { OfflineQueueHUD } from './components/OfflineQueueHUD';
import { CustomerOrderView } from './components/CustomerOrderView';
import { KitchenDisplaySystem } from './components/KitchenDisplaySystem';
import { ManagerDashboard } from './components/ManagerDashboard';
import { TenantManagementView } from './components/TenantManagementView';
import { CentralizedMenuView } from './components/CentralizedMenuView';
import { UserManagementView } from './components/UserManagementView';
import { UserRole } from './types';
import {
  Flame,
  Monitor,
  Shield,
  Building,
  ArrowLeft,
  Lock,
  Delete,
  KeyRound,
  AlertCircle,
  Database,
  WifiOff,
  Maximize,
  Minimize,
  Sparkles,
  Check,
  AlertTriangle,
  Users,
  X
} from 'lucide-react';

type AdminViewMode = 'kds' | 'manager' | 'tenant-admin' | 'central-menu' | 'user-management';

function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const { tenants, loginSession, users } = useOfflineQueue();
  const [role, setRole] = useState<UserRole>('SUPER_ADMIN');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('DEFAULT');
  const [pin, setPin] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [lockoutTime, setLockoutTime] = useState<number>(0);
  const [isCooldown, setIsCooldown] = useState<boolean>(false);
  const [showForgotPinHelp, setShowForgotPinHelp] = useState<boolean>(false);

  // Keep track of unlocked branches on this device
  const [unlockedBranches, setUnlockedBranches] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('sabay_unlocked_branches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Branch level full login input state (Step 1)
  const [branchAccount, setBranchAccount] = useState<string>('sabay');
  const [branchPassword, setBranchPassword] = useState<string>('');

  // Set default selected branch when tenants load
  useEffect(() => {
    if (tenants.length > 0 && !tenants.some(t => t.id === selectedBranchId)) {
      setSelectedBranchId(tenants[0].id);
    }
  }, [tenants, selectedBranchId]);

  // Handle countdown for lockout state
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFailedCount(0); // Reset failures on lockout expiry
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const isDisabled = isVerifying || lockoutTime > 0 || isCooldown;

  const triggerCooldown = () => {
    setIsCooldown(true);
    setTimeout(() => {
      setIsCooldown(false);
    }, 100);
  };

  const handleKeyPress = async (num: string) => {
    if (isDisabled) return;
    setError('');
    triggerCooldown();
    
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 6) {
        setIsVerifying(true);
        const success = await loginSession(role, selectedBranchId, newPin, adminUsername);
        
        if (success) {
          setTimeout(() => {
            onSuccess();
            setIsVerifying(false);
            setFailedCount(0);
          }, 150);
        } else {
          const nextFailed = failedCount + 1;
          setFailedCount(nextFailed);

          setTimeout(() => {
            setPin('');
            setIsVerifying(false);
            if (nextFailed >= 3) {
              setError('連續錯誤 3 次，系統已鎖定 60 秒');
              setLockoutTime(60);
            } else {
              setError(`密碼錯誤，請重新輸入 (剩餘嘗試次數: ${3 - nextFailed})`);
            }
          }, 400);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (isDisabled) return;
    setError('');
    triggerCooldown();
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isDisabled) return;
    setError('');
    triggerCooldown();
    setPin('');
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setError('');

    const uName = adminUsername.trim();
    const uPass = adminPassword.trim();

    if (!uName) {
      setError('請輸入最高管理員帳號！');
      return;
    }
    if (!uPass) {
      setError('請輸入安全登入密碼！');
      return;
    }

    setIsVerifying(true);
    const success = await loginSession('SUPER_ADMIN', 'ALL', uPass, uName);

    if (success) {
      setTimeout(() => {
        onSuccess();
        setIsVerifying(false);
        setFailedCount(0);
      }, 150);
    } else {
      const nextFailed = failedCount + 1;
      setFailedCount(nextFailed);
      setIsVerifying(false);
      if (nextFailed >= 3) {
        setError('帳密連續錯誤 3 次，系統已鎖定 60 秒');
        setLockoutTime(60);
      } else {
        setError(`帳號或密碼錯誤，請重新輸入 (剩餘嘗試次數: ${3 - nextFailed})`);
      }
    }
  };

  const handleBranchUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    setError('');

    const accountInput = branchAccount.trim();
    const passwordInput = branchPassword.trim();

    if (!accountInput) {
      setError('請輸入分店登入帳號！');
      return;
    }
    if (!passwordInput) {
      setError('請輸入分店安全密碼！');
      return;
    }

    // 1. Default system-wide fallback/development branch account
    const isValidDefault = (accountInput.toLowerCase() === 'sabay' && passwordInput === '952700');

    // 2. Branch-specific tenant PIN code (e.g. 111111 for DEFAULT) matching
    const currentTenant = tenants.find(t => t.id === selectedBranchId);
    const tenantPin = currentTenant?.pin || (selectedBranchId === 'DEFAULT' ? '111111' : selectedBranchId === 'EAST_BRANCH' ? '222222' : '333333');
    const isValidTenantPin = (accountInput.toLowerCase() === 'sabay' || accountInput.toLowerCase() === selectedBranchId.toLowerCase()) && passwordInput === tenantPin;

    // 3. Dynamic branch staff user accounts
    const isValidCustomUser = users?.some(u => 
      u.username.toLowerCase() === accountInput.toLowerCase() && 
      u.pin === passwordInput && 
      u.role === 'BRANCH_STAFF' &&
      (u.tenantId === 'ALL' || u.tenantId === selectedBranchId)
    );

    if (isValidDefault || isValidTenantPin || isValidCustomUser) {
      const nextUnlocked = [...unlockedBranches, selectedBranchId];
      setUnlockedBranches(nextUnlocked);
      sessionStorage.setItem('sabay_unlocked_branches', JSON.stringify(nextUnlocked));
      setBranchPassword('');
      setError('');
    } else {
      setError('分店帳號或安全密碼錯誤，請重新輸入！');
    }
  };

  return (
    <div className={`min-h-screen ${role === 'SUPER_ADMIN' ? 'bg-slate-950' : 'bg-emerald-950/20'} flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans antialiased transition-colors duration-700`}>
      {/* Decorative background glows */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 ${role === 'SUPER_ADMIN' ? 'bg-indigo-600/10' : 'bg-emerald-600/10'} rounded-full blur-3xl pointer-events-none transition-colors duration-700`} />
      <div className={`absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 ${role === 'SUPER_ADMIN' ? 'bg-purple-600/10' : 'bg-teal-600/10'} rounded-full blur-3xl pointer-events-none transition-colors duration-700`} />

      <div className={`w-full max-w-md ${role === 'SUPER_ADMIN' ? 'bg-slate-900/85 border-slate-800/80' : 'bg-emerald-900/10 border-emerald-800/30'} backdrop-blur-xl border rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col items-center transition-all duration-700`}>
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-6">
          {lockoutTime > 0 ? (
            <div className="relative w-20 h-20 flex items-center justify-center mb-4">
              {/* Circle Progress SVG */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-slate-800"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-amber-500 transition-all duration-1000 ease-linear"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="263.9"
                  strokeDashoffset={263.9 * (1 - lockoutTime / 60)}
                />
              </svg>
              
              <div className="flex flex-col items-center justify-center text-white relative z-10">
                <Lock className="h-4 w-4 text-amber-500 animate-pulse" />
                <span className="text-xs font-black font-mono mt-0.5 text-amber-400">{lockoutTime}s</span>
              </div>
            </div>
          ) : (
            <div className={`${role === 'SUPER_ADMIN' ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-500/10' : 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/10'} p-3.5 rounded-2xl text-white shadow-xl mb-4 animate-pulse transition-all duration-700`}>
              {role === 'SUPER_ADMIN' ? <Shield className="h-7 w-7" /> : <Users className="h-7 w-7" />}
            </div>
          )}
          <h2 className="text-xl font-black text-white tracking-tight mb-1">
            {role === 'SUPER_ADMIN' ? '高級管理員登入' : '使用者登入'}
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
            {role === 'SUPER_ADMIN' ? 'Advanced Admin Authentication' : 'Staff Access Portal'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-full gap-2 p-1 bg-slate-950/50 rounded-2xl border border-slate-800/50 mb-8">
          <button
            type="button"
            onClick={() => { setRole('SUPER_ADMIN'); setPin(''); setError(''); }}
            disabled={isDisabled}
            className={`flex-1 py-3.5 rounded-2xl border text-[11px] font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              role === 'SUPER_ADMIN'
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-inner'
                : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-800'
            }`}
          >
            <Shield className="h-4.5 w-4.5" />
            <span>高級管理員登入</span>
          </button>
          <button
            type="button"
            onClick={() => { setRole('BRANCH_STAFF'); setPin(''); setAdminUsername(''); setError(''); }}
            disabled={isDisabled}
            className={`flex-1 py-3.5 rounded-2xl border text-[11px] font-black transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
              role === 'BRANCH_STAFF'
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-inner'
                : 'bg-slate-950/40 border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-800'
            }`}
          >
            <Users className="h-4.5 w-4.5" />
            <span>使用者登入</span>
          </button>
        </div>

        {/* Dynamic Forms */}
        {role === 'SUPER_ADMIN' ? (
          <form onSubmit={handleAdminSubmit} className="w-full space-y-4 mb-5">
            <div>
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">高級管理員帳號 (Account)</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => { setError(''); setAdminUsername(e.target.value); }}
                disabled={isDisabled}
                placeholder="預設為 topztar"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-700"
              />
            </div>
            
            <div>
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">安全驗證密碼 (Password)</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => { setError(''); setAdminPassword(e.target.value); }}
                disabled={isDisabled}
                placeholder="預設為 Eur0pe2266"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500/80 transition-all placeholder-slate-700"
              />
            </div>

            <div className="h-8 flex items-center justify-center text-center">
              {lockoutTime > 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/20 px-4 py-1 rounded-full">
                  <span className="animate-spin h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full" />
                  <span>鎖定中！請等待 {lockoutTime} 秒</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-extrabold bg-red-500/10 border border-red-500/20 px-3.5 py-1 rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <KeyRound className="h-3 w-3" />
                  <span>請輸入管理員帳密進行授權</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className={`w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>驗證身分中...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>登入後台系統</span>
                </>
              )}
            </button>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowForgotPinHelp(true)}
                className="text-[11px] font-bold text-slate-500 hover:text-indigo-400 hover:underline transition-colors duration-200 cursor-pointer"
              >
                忘記帳密？ / Forgot Credentials?
              </button>
            </div>
          </form>
        ) : !unlockedBranches.includes(selectedBranchId) ? (
          <form onSubmit={handleBranchUnlock} className="w-full space-y-4 mb-5">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4.5 text-xs text-amber-400 space-y-1 text-center mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1 animate-pulse" />
              <h4 className="font-extrabold text-[11px] uppercase tracking-wide">此分店裝置尚未啟用授權</h4>
              <p className="leading-relaxed text-[10.5px] text-slate-400">
                本系統安全機制要求：分店必須先登入帳號及密碼進行裝置啟用，後續才能使用 6 位數 PIN 碼進行快速登入。
              </p>
            </div>

            <div className="w-full">
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">選擇駐點店別 (Branch Target)</label>
              <select
                value={selectedBranchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); setPin(''); setError(''); }}
                disabled={isDisabled}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-black text-white rounded-xl py-2.5 px-3 focus:outline-none focus:border-emerald-500"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">分店登入帳號 (Branch Account)</label>
              <input
                type="text"
                value={branchAccount}
                onChange={(e) => { setError(''); setBranchAccount(e.target.value); }}
                disabled={isDisabled}
                placeholder="預設為 sabay"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500/80 transition-all placeholder-slate-700"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">分店安全密碼 (Branch Password)</label>
              <input
                type="password"
                value={branchPassword}
                onChange={(e) => { setError(''); setBranchPassword(e.target.value); }}
                disabled={isDisabled}
                placeholder="請輸入分店安全管理密碼"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500/80 transition-all placeholder-slate-700"
              />
            </div>

            <div className="h-8 flex items-center justify-center text-center">
              {error ? (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-extrabold bg-red-500/10 border border-red-500/20 px-3.5 py-1 rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <Lock className="h-3 w-3" />
                  <span>登入完成後將啟用 6 位數 PIN 快速登入</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>啟用分店快速登入 (Activate)</span>
            </button>
          </form>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="w-full mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <span>分店裝置已啟用授權</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextUnlocked = unlockedBranches.filter(id => id !== selectedBranchId);
                  setUnlockedBranches(nextUnlocked);
                  sessionStorage.setItem('sabay_unlocked_branches', JSON.stringify(nextUnlocked));
                  setPin('');
                  setError('');
                }}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <Lock className="h-3 w-3" />
                <span>安全鎖定裝置</span>
              </button>
            </div>

            <div className="w-full mb-4">
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">選擇駐點店別 (Branch Target)</label>
              <select
                value={selectedBranchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); setPin(''); setError(''); }}
                disabled={isDisabled}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-black text-white rounded-xl py-2.5 px-3 focus:outline-none focus:border-emerald-500"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="w-full mb-5">
              <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">使用者帳號 (Account)</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => { setError(''); setAdminUsername(e.target.value); }}
                disabled={isDisabled}
                placeholder="預設為 sabay"
                className="w-full bg-slate-950 border border-slate-850 text-xs text-white font-medium rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500/80 transition-all placeholder-slate-700"
              />
            </div>

            <div className="flex justify-center gap-3.5 mb-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 border ${
                    lockoutTime > 0
                      ? 'bg-slate-800 border-slate-700/60'
                      : i < pin.length
                        ? 'bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/50 scale-110'
                        : 'bg-slate-950 border-slate-800'
                  }`}
                />
              ))}
            </div>

            <div className="h-8 mb-4 flex items-center justify-center text-center">
              {lockoutTime > 0 ? (
                <div className="flex items-center gap-2 text-[11px] text-amber-400 font-extrabold bg-amber-500/10 border border-amber-500/20 px-4 py-1 rounded-full">
                  <span className="animate-spin h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full" />
                  <span>鎖定中！請等待 {lockoutTime} 秒</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-extrabold bg-red-500/10 border border-red-500/20 px-3.5 py-1 rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <KeyRound className="h-3 w-3" />
                  <span>請輸入帳號與 6 位數 PIN 碼</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  disabled={isDisabled}
                  className={`h-14 rounded-2xl bg-slate-950/40 border border-slate-850 text-white font-black text-lg transition-all flex items-center justify-center select-none ${
                    isDisabled
                      ? 'opacity-25 cursor-not-allowed bg-slate-950/10'
                      : 'hover:bg-emerald-900/40 active:bg-emerald-800/60 cursor-pointer'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                disabled={isDisabled}
                className={`h-14 rounded-2xl text-slate-500 hover:text-slate-300 font-extrabold text-xs transition-all flex items-center justify-center select-none border border-transparent ${
                  isDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-slate-800/20 cursor-pointer'
                }`}
              >
                清除
              </button>
              <button
                onClick={() => handleKeyPress('0')}
                disabled={isDisabled}
                className={`h-14 rounded-2xl bg-slate-950/40 border border-slate-850 text-white font-black text-lg transition-all flex items-center justify-center select-none ${
                  isDisabled
                    ? 'opacity-25 cursor-not-allowed bg-slate-950/10'
                    : 'hover:bg-emerald-900/40 active:bg-emerald-800/60 cursor-pointer'
                }`}
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={isDisabled}
                className={`h-14 rounded-2xl text-slate-500 hover:text-slate-300 font-extrabold transition-all flex items-center justify-center select-none border border-transparent ${
                  isDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-slate-800/20 cursor-pointer'
                }`}
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotPinHelp(true)}
              className="mt-3 mb-2 text-[11px] font-bold text-slate-500 hover:text-emerald-400 hover:underline transition-colors duration-200 cursor-pointer"
            >
              忘記 PIN 碼？ / Forgot PIN?
            </button>
          </div>
        )}

        {/* Back Link */}
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white font-extrabold transition-all px-4 py-2 bg-slate-950/40 hover:bg-slate-850/60 border border-slate-850/60 rounded-xl cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回點餐前台</span>
        </Link>
      </div>

      {/* Forgot PIN Helper Modal */}
      {showForgotPinHelp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setShowForgotPinHelp(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-850 hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3 text-emerald-400 mb-4">
              <div className="bg-emerald-500/15 p-2 rounded-xl border border-emerald-500/30">
                <KeyRound className="h-5 w-5 stroke-[2.5]" />
              </div>
              <h2 className="text-base font-black text-slate-100">
                忘記 PIN 碼與登入協助
              </h2>
            </div>
            
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl">
                <span className="font-extrabold text-slate-400 block mb-1">📞 聯絡系統管理員 (Contact Admin)</span>
                <p className="leading-relaxed text-slate-400">
                  如需變更或確認您的員工 PIN 碼，請聯繫各分店店長或系統管理員。
                  <br />
                  服務專線：<span className="text-white font-mono font-bold">02-1234-5678</span>
                </p>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-2">
                <span className="font-extrabold text-emerald-400 block">💡 沙盒測試預設帳密 (Sandbox Defaults)</span>
                
                <div className="space-y-1.5 pt-1 border-t border-slate-850/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">總店 PIN：</span>
                    <span className="font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">111111</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">東區分店 PIN：</span>
                    <span className="font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">222222</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">西門店 PIN：</span>
                    <span className="font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">333333</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-850/60">
                    <span className="text-slate-400">員工帳號 / PIN：</span>
                    <span className="font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">sabay / 952700</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">高級管理員：</span>
                    <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">topztar / Eur0pe2266</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPinHelp(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-600/15"
              >
                我知道了 (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSystem() {
  const { session, logoutSession, queue, tenants, currentTenantId, setCurrentTenantId, isOnline, simulatedOffline } = useOfflineQueue();
  const [currentView, setCurrentView] = useState<AdminViewMode>('kds');
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const hasUnsyncedData = queue.length > 0;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => !!document.fullscreenElement);

  // Strictly enforce that BRANCH_STAFF can only access the KDS kitchen view
  useEffect(() => {
    if (session?.role === 'BRANCH_STAFF') {
      setCurrentView('kds');
    }
  }, [session]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Track system idle state (15s of inactivity triggers slow breathing animation)
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;
    const resetTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIsIdle(true);
      }, 15000); // 15 seconds
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      clearTimeout(idleTimer);
    };
  }, []);

  // Session Expiry Tracker (300 seconds of inactivity triggers warning, 30s before auto-logout)
  const SESSION_DURATION = 300; // 5 minutes
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(SESSION_DURATION);

  const extendSession = () => {
    setSessionTimeLeft(SESSION_DURATION);
  };

  useEffect(() => {
    if (session) {
      setSessionTimeLeft(SESSION_DURATION);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      setSessionTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          logoutSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const handleUserActivity = () => {
      setSessionTimeLeft((current) => {
        // If we've already entered the final 30-second warning state, do not reset via passive background movement.
        // User must explicitly click "Keep Session Active" (延長會話) to ensure physical presence.
        if (current > 30) {
          return SESSION_DURATION;
        }
        return current;
      });
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [session, logoutSession]);

  if (!session) {
    return <PinGate onSuccess={() => {}} />;
  }

  return (
    <div className={`min-h-screen flex flex-col ${session.role === "SUPER_ADMIN" ? "bg-slate-900" : "bg-emerald-950/10"} font-sans antialiased text-slate-100 transition-colors duration-700`}>
      {/* Synchronization HUD */}
      <OfflineQueueHUD />

      {/* Backend Premium Header */}
      <header className={`${session.role === "SUPER_ADMIN" ? "bg-slate-950 border-slate-800" : "bg-emerald-950 border-emerald-900/30"} border-b px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl transition-colors duration-700`}>
        <div className="flex items-center gap-3">
          <div className={`${session.role === "SUPER_ADMIN" ? "bg-red-600 shadow-red-600/30" : "bg-emerald-600 shadow-emerald-600/30"} p-2 rounded-xl text-white transition-all duration-1000 ${
            isIdle
              ? 'animate-[pulse_3s_ease-in-out_infinite] scale-95 opacity-70'
              : 'animate-[pulse_1s_ease-in-out_infinite] scale-100 opacity-100'
          }`}>
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wider text-white">Sabay Thai BBQ 后台系統</h1>
              {isIdle && (
                <span className="bg-slate-900 text-[9px] text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                  系統閒置中 (Idle)
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">SECURE MANAGEMENT PANEL // PORTAL</p>
          </div>
        </div>

        {/* Super Admin Global Branch Context Switcher & Visual Status Card */}
        {session.role === 'SUPER_ADMIN' && (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-slate-900/60 p-2.5 rounded-2xl border border-indigo-950">
            {/* Context Selector */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl">
              <span className="text-[10.5px] font-black text-indigo-400 uppercase tracking-wide">
                切換分店：
              </span>
              <select
                value={currentTenantId}
                onChange={(e) => setCurrentTenantId(e.target.value)}
                className="bg-slate-950 border-none text-xs font-black text-white rounded-lg py-0.5 px-1 focus:outline-none cursor-pointer"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Tenant Visual Indicator Status Card */}
            {(() => {
              const activeTenant = tenants.find(t => t.id === currentTenantId) || tenants[0];
              const branchUnsyncedJobs = queue.filter(job => {
                let tenantId = 'DEFAULT';
                if (job.payload?.tenantId) {
                  tenantId = job.payload.tenantId;
                } else if (job.url?.includes('/tenants/')) {
                  tenantId = job.url.split('/tenants/')[1]?.split('/')[0] || 'DEFAULT';
                }
                return tenantId === currentTenantId;
              });
              const branchUnsyncedCount = branchUnsyncedJobs.length;
              const isActuallyOnline = isOnline && !simulatedOffline;

              return (
                <div className="flex items-center gap-3.5 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-850 text-xs">
                  {/* Branch Details */}
                  <div className="flex flex-col">
                    <span className="font-black text-slate-100 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      {activeTenant?.name}
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-mono">
                      分店編號：<span className="text-indigo-400 font-bold">{currentTenantId}</span>
                    </span>
                  </div>

                  <span className="text-slate-800 text-[10px]">|</span>

                  {/* Sync Status Badge */}
                  <div className="flex items-center gap-2">
                    {/* Mode (Online vs Offline) */}
                    <span className={`text-[9.5px] px-2 py-0.5 rounded font-black border uppercase ${
                      isActuallyOnline
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                        : 'bg-red-950/40 text-red-400 border-red-900/30'
                    }`}>
                      {isActuallyOnline ? 'Live Sync' : 'Offline Cache'}
                    </span>

                    {/* Data Status */}
                    {branchUnsyncedCount > 0 ? (
                      <span className="text-[9.5px] bg-amber-950/50 text-amber-400 border border-amber-900/40 px-2 py-0.5 rounded font-bold animate-pulse flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>未同步 ({branchUnsyncedCount} 筆)</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] bg-slate-900 text-slate-400 border border-slate-850 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>數據同頻</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Locked branch for Branch Staff */}
        {session.role === 'BRANCH_STAFF' && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/65 border border-slate-800 rounded-2xl">
            <span className="text-[10px] text-slate-400 font-black uppercase">當前駐店：</span>
            <span className="text-xs font-black text-emerald-400">{session.branchName}</span>
          </div>
        )}

        {/* Offline Sync Notification Status Indicator */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="relative flex items-center justify-center">
            {hasUnsyncedData ? (
              <>
                <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-500 opacity-75" />
              </>
            ) : (
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {hasUnsyncedData ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-red-500 animate-bounce" />
                  <span className="text-xs font-black text-red-400">未同步離線 ({queue.length} 筆)</span>
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-400">數據已同步</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
            title="切換全螢幕模式"
          >
            {isFullscreen ? (
              <>
                <Minimize className="h-3.5 w-3.5 text-indigo-400" />
                <span>退出全螢幕</span>
              </>
            ) : (
              <>
                <Maximize className="h-3.5 w-3.5 text-indigo-400" />
                <span>全螢幕模式</span>
              </>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={logoutSession}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/20 cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>安全登出</span>
          </button>

          {/* Back to Customer Link */}
          <Link 
            to="/" 
            className="flex items-center gap-1.5 px-4.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回點餐前台</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-grow flex flex-col ${session.role === "SUPER_ADMIN" ? "pb-28 bg-slate-950/20" : "pb-6 bg-emerald-950/5"} transition-all`}>
        {currentView === 'kds' && <KitchenDisplaySystem />}
        {currentView === 'manager' && session.role === 'SUPER_ADMIN' && <ManagerDashboard />}
        {currentView === 'tenant-admin' && session.role === 'SUPER_ADMIN' && <TenantManagementView />}
        {currentView === 'central-menu' && session.role === 'SUPER_ADMIN' && <CentralizedMenuView />}
        {currentView === 'user-management' && session.role === 'SUPER_ADMIN' && <UserManagementView />}
      </main>

      {/* Persistent Premium Tab Controller (Sticky Bottom Navigation for Admin only) */}
      {session.role === 'SUPER_ADMIN' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 text-white shadow-2xl py-3 px-4">
          <div className="max-w-5xl mx-auto flex justify-around items-center gap-3">
            
            {/* Kitchen Display View Tab */}
            <button
              onClick={() => setCurrentView('kds')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'kds'
                  ? 'bg-indigo-600 text-white font-black scale-105 shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Monitor className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">1. KDS 廚房端</span>
            </button>

            {/* Manager Dashboard View Tab */}
            <button
              onClick={() => setCurrentView('manager')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'manager'
                  ? 'bg-purple-600 text-white font-black scale-105 shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">2. 經理人後台</span>
            </button>

            {/* Tenant Admin View Tab */}
            <button
              onClick={() => setCurrentView('tenant-admin')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'tenant-admin'
                  ? 'bg-violet-600 text-white font-black scale-105 shadow-lg shadow-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Building className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">3. 集團多租戶</span>
            </button>

            {/* Centralized Menu View Tab */}
            <button
              onClick={() => setCurrentView('central-menu')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'central-menu'
                  ? 'bg-emerald-600 text-white font-black scale-105 shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">4. 菜單分發中心</span>
            </button>

            {/* User Credentials View Tab */}
            <button
              onClick={() => setCurrentView('user-management')}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all cursor-pointer ${
                currentView === 'user-management'
                  ? 'bg-rose-600 text-white font-black scale-105 shadow-lg shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-[11px] font-bold tracking-wide">5. 帳號權限管理</span>
            </button>

          </div>
        </nav>
      )}

      {/* Session Expiring Warning Banner */}
      {sessionTimeLeft <= 30 && (
        <div 
          id="session-expiry-warning"
          className={`fixed ${session.role === 'SUPER_ADMIN' ? 'bottom-28' : 'bottom-6'} right-6 z-50 max-w-sm w-[calc(100%-3rem)] sm:w-96 bg-slate-950/95 backdrop-blur-lg border border-red-500/40 rounded-2xl shadow-2xl p-4 text-slate-100 transition-all duration-300 animate-pulse shadow-red-950/50`}
        >
          <div className="flex gap-3">
            <div className="p-2.5 bg-red-500/15 rounded-xl text-red-500 self-start">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-grow min-w-0">
              <h4 className="text-xs font-black text-white flex items-center justify-between">
                <span className="tracking-wide">安全連線即將過期 (Session Expiry)</span>
                <span className="font-mono text-red-500 text-xs font-black bg-red-500/20 px-2 py-0.5 rounded-full select-none">
                  {sessionTimeLeft} 秒
                </span>
              </h4>
              <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">
                系統已偵測到閒置。為保障店鋪數據安全，將於 {sessionTimeLeft} 秒後自動登出並關閉安全面板。
              </p>
              
              {/* Subtle Progress Bar */}
              <div id="session-expiry-progress-track" className="mt-3.5 bg-slate-800 h-1.5 rounded-full overflow-hidden w-full relative">
                <div 
                  id="session-expiry-progress-bar"
                  className="bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(sessionTimeLeft / 30) * 100}%` }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 mt-3.5">
                <button
                  id="session-logout-btn"
                  type="button"
                  onClick={() => logoutSession()}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-[10.5px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Lock className="h-3 w-3" />
                  <span>直接登出</span>
                </button>
                <button
                  id="session-extend-btn"
                  type="button"
                  onClick={extendSession}
                  className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[10.5px] font-black shadow-lg shadow-emerald-600/10 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  <span>繼續登入 (Extend)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerSystem() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      <main className="flex-grow flex flex-col">
        <CustomerOrderView />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <OfflineQueueProvider>
        <Routes>
          {/* Customer Front-End Portal */}
          <Route path="/" element={<CustomerSystem />} />
          
          {/* Backend Manager Portal Entrance */}
          <Route path="/FSY20260606" element={<AdminSystem />} />
          
          {/* Fallback route back to customer view */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OfflineQueueProvider>
    </Router>
  );
}
