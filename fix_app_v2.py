import sys
import re

def fix():
    path = 'src/App.tsx'
    with open(path, 'r') as f:
        content = f.read()

    # The corrupted section starts at line 277 based on previous cat
    # Let's replace the whole PinGate component content to ensure it's clean.

    # Define the correct PinGate return block
    correct_pingate_ui = """  return (
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
            onClick={() => { setRole('BRANCH_STAFF'); setPin(''); setBranchAccount('sabay'); setError(''); }}
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
                placeholder="預設為 888888"
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
                  <span>管理員帳號登入系統</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>進入管理控制台</span>
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
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* Inner Sub-tab Switcher for BRANCH_STAFF */}
            <div className="flex w-full gap-2 p-1 bg-slate-950/40 rounded-xl border border-slate-850/40 mb-5 text-[10.5px]">
              <button
                type="button"
                onClick={() => { setBranchLoginSubMode('form'); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                  branchLoginSubMode === 'form'
                    ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-300'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                帳號密碼登入
              </button>
              <button
                type="button"
                onClick={() => { setBranchLoginSubMode('pin'); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                  branchLoginSubMode === 'pin'
                    ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-300'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {!unlockedBranches[selectedBranchId] && <Lock className="h-3 w-3 text-slate-500" />}
                <span>PIN 快速登入</span>
              </button>
            </div>

            {branchLoginSubMode === 'form' ? (
              <form onSubmit={handleBranchFormSubmit} className="w-full space-y-4 mb-5">
                <div className="w-full">
                  <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">選擇駐點店別 (Branch Target)</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => { setSelectedBranchId(e.target.value); setError(''); }}
                    disabled={isDisabled}
                    className="w-full bg-slate-950 border border-slate-800 text-xs font-black text-white rounded-xl py-2.5 px-3 focus:outline-none focus:border-emerald-500"
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">使用者帳號 (Username)</label>
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
                  <label className="block text-[10px] text-slate-500 font-black mb-1.5 uppercase tracking-wider">安全登入密碼 (Password/PIN)</label>
                  <input
                    type="password"
                    value={branchPassword}
                    onChange={(e) => { setError(''); setBranchPassword(e.target.value); }}
                    disabled={isDisabled}
                    placeholder="請輸入安全管理密碼或員工 PIN 碼"
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
                      <KeyRound className="h-3 w-3" />
                      <span>登入完成後將自動開啟分店 PIN 快速登入</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isDisabled}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>登入使用者後台</span>
                </button>
              </form>
            ) : (
              !unlockedBranches[selectedBranchId] ? (
                <div className="w-full py-5 text-center space-y-4">
                  <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-400 space-y-1.5 text-center max-w-sm mx-auto">
                    <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-1 animate-bounce" />
                    <h4 className="font-extrabold text-[11px] uppercase tracking-wide">此分店預設 PIN 碼快速登入尚未啟用</h4>
                    <p className="leading-relaxed text-[10.5px] text-slate-400 pt-1">
                      本系統安全機制要求：此分店必須先進行「帳號密碼登入」正確登入使用者帳密，後續才能開啟並使用分店預設 PIN 碼進行快速登入。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setBranchLoginSubMode('form'); setError(''); }}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>切換至帳號密碼登入</span>
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full mb-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      <span>分店裝置已啟用快速登入</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        lockBranch(selectedBranchId);
                        setPin('');
                        setError('');
                      }}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Lock className="h-3 w-3" />
                      <span>安全鎖定分店</span>
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
                        <span>請輸入該分店 6 位數預設 PIN 碼</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleKeyPress(num)}
                        disabled={isDisabled}
                        type="button"
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
                      type="button"
                      className={`h-14 rounded-2xl text-slate-500 hover:text-slate-300 font-extrabold text-xs transition-all flex items-center justify-center select-none border border-transparent ${
                        isDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-slate-800/20 cursor-pointer'
                      }`}
                    >
                      清除
                    </button>
                    <button
                      onClick={() => handleKeyPress('0')}
                      disabled={isDisabled}
                      type="button"
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
                      type="button"
                      className={`h-14 rounded-2xl text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center select-none border border-transparent ${
                        isDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-rose-950/10 cursor-pointer'
                      }`}
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <Link
          to="/"
          className="mt-2 text-[10.5px] font-bold text-slate-600 hover:text-slate-400 transition-all flex items-center gap-1 py-1.5 px-3 rounded-lg hover:bg-slate-900/50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回點餐前台</span>
        </Link>
      </div>"""

    # Target the PinGate return statement
    # Use a simpler pattern to avoid matching errors
    pattern = r'return\s+\(\s+<div className={`min-h-screen.*?</Link>\s+</div>'
    content = re.sub(pattern, correct_pingate_ui, content, flags=re.DOTALL)

    with open(path, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    fix()
