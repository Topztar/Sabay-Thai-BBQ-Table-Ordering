# 專案審查與最佳化報告

## 1. 架構與邏輯分析
- **目前架構**：本專案為一個基於 React + Vite 開發的點餐系統前端，搭配 Express 作為 Backend Server，以及使用 Firebase Cloud Functions 運行後端 API 與 Firestore 進行資料同步。
- **執行流程**：前端初始化時會透過 API (`/api/bootstrap`) 及 `data.json` 載入初始菜單、桌號等狀態，再以 WebSocket/HTTP 及 Firebase `onSnapshot` 進行即時更新與同步。

## 2. 程式碼庫清理 (Codebase Cleanup)
- **測試與模擬檔案**：已掃描專案並確認無殘留獨立的 `.test.ts` 或 `.spec.ts` 檔案。
- **開發測試路由**：`server.ts` 內存在 `/api/admin/clear-test-data` (清除測試資料) 與 `/api/printer/test` (列印測試頁) 等開發除錯用的端點。將會評估是否屬於正式環境功能，如果僅為開發期臨時腳本，將予以移除。
- **死碼與未使用的依賴**：在前面的步驟中，已移除了未使用的 `firebase-admin` 與 `motion` 等套件，且配置了 `eslint-plugin-unused-imports` 完成了程式碼內部未使用的變數及 import 的清除。目前仍可進一步移除冗餘的註解與暫時性邏輯。

## 3. Firebase 效能最佳化 (Firebase Performance Optimization)
- **現存效能瓶頸**：
  1. **函數冷啟動慢 (Cold Starts)**：已將 Firebase Functions 升級至 Gen 2，並設定 `minInstances: 1` 確保隨時有一個實例可用。
  2. **重複計費與 CPU 閒置**：已設定 `concurrency: 80` 允許多個請求共用同一個實例，大幅降低 CPU 資源與記憶體計費。
  3. **資料庫連線冗餘**：已將 Firebase Admin SDK 的初始化及資料庫宣告 (`admin.initializeApp()`, `getFirestore()`, `getStorage()`) 移出 Request Handler 之外（全域範圍），避免每次請求重複連線。
  4. **全表掃描與 Payload 過大**：Firestore 的查詢未妥善分頁，導致資料庫傳輸過載。已針對 `orders` 加入 `limit(500)` 與 Index 進行最佳化，後端也已篩選不必要欄位避免回傳整個 Document。
  5. **靜態資源快取**：已在 `firebase.json` 設定 `.js`、`.css` 的不可變快取，並為 HTTP 回傳加入 `compression` 以 GZIP 壓縮封包。
  6. **第三方 API Timeout**：針對使用 Google Gen AI 的請求，已加上 `timeout: 2000` 毫秒的超時設定，防止外部伺服器卡頓拖累 Function 計費時間。

**預期處理**：
- 即將把上述發現的未清理測試資料端點 (`/api/admin/clear-test-data` 及 `simulate` 模擬程式碼) 移除，進一步清理未使用變數，確認安全後進行 Commit 提交。
