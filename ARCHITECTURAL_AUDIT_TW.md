# Sabay Thai BBQ 系統架構審計與功能映射報告

## 1. 系統架構層次分析 (Architectural Hierarchy)

本系統採用 **混合雲 (Hybrid Cloud)** 分散式架構，旨在平衡高可用性、即時同步與硬體離線運作能力。

### 1.1 分散式服務組件
- **雲端資料層 (Cloud Data Layer)**:
  - **Firebase Firestore**: 負責即時交易資料 (Orders, Table States) 與菜單同步。作為客戶端與本機節點的訊息橋樑。
  - **PostgreSQL (Cloud SQL/Render)**: 負責長效帳務存儲、多租戶 RBAC 與大數據分析。啟用 RLS (Row-Level Security) 確保租戶物理隔離。
- **雲端運算層 (Cloud Computing Layer)**:
  - **FastAPI (Cloud)**: 提供多租戶認證、JWT 核發、管理 API 與跨店數據彙總。
- **本機邊緣層 (Local Edge Layer)**:
  - **FastAPI (Local)**: 運行於店內 Windows 主機，負責與實體硬體 (印表機、錢箱) 通訊。
  - **PySide6 Desktop App**: 店內櫃台點餐與 KDS 監控介面。
  - **SQLite**: 本地快取，確保在斷網時仍能記錄交易並在恢復連線後同步回雲端。

### 1.2 資料流向與協定
- **同步協定**: Firestore `on_snapshot` (WebSocket) 確保從客戶端下單到廚房列印的延遲 < 500ms。
- **認證協定**: JWT (HS256) 用於雲端 API 存取； tenant_id 被注入 PostgreSQL Session 驅動 RLS。
- **硬體協定**: 標準 ESC/POS 串列通訊 (9600 baud rate)。

---

## 2. 功能清單與業務邏輯清單 (Feature Inventory)

### 2.1 客戶端模組 (Customer Facing)
- **動態路由解析**: 從 URL (?tenantId=T&tableId=B) 提取上下文。
- **即時菜單流**: 根據租戶 ID 載入對應 Firestore 集合。
- **非同步下單**: 直接提交 Payload 至 /tenants/{id}/orders。

### 2.2 櫃台與廚房模組 (POS/KDS)
- **Firestore 監聽引擎**: SyncEngine 自動追蹤新增訂單。
- **自動列印邏輯**: 偵測到新訂單後自動格式化收據並驅動切刀。
- **錢箱觸發**: 結帳程序結束後發送 0x1B, 0x70 脈衝。
- **離線韌性**: 所有操作優先寫入 SQLite 避免數據丟失。

### 2.3 管理員模組 (Management)
- **多租戶隔離控制**: 透過 JWT token 限制管理員僅能存取其所屬 tenant_id。
- **手動錢箱控制**: 繞過列印流程的獨立緊急開箱 API。

---

## 3. Web UI 與後端欄位映射矩陣 (UI-Backend Mapping)

| 前端 UI 元件 / 視圖 | 後端資料欄位 (Schema/Payload) | 業務邏輯與 API 連結 |
| :--- | :--- | :--- |
| **點餐清單卡片** | dish_name, unit_price | 綁定至 Firestore menus 集合 |
| **總計金額顯示** | total_amount (Numeric) | 前端計算後存入 billing_orders |
| **KDS 訂單表格** | status (pending/paid) | LocalOrder 模型狀態更新 |
| **手動開錢箱按鈕** | N/A (指令觸發) | 調用 Local FastAPI /open-drawer |
| **桌號標籤** | table_id | 解析自 URL 查詢參數 |
| **店名 Header** | tenants.name | 基於 tenant_id 的雲端查詢 |

---

## 4. 審計結論
經深度掃描，本專案已實現 **Zero-Trust 多租戶架構**。關鍵優勢在於將硬體相依性解耦至本機 FastAPI，同時利用 Firestore 的即時性解決傳統 POS 系統在高峰期同步緩慢的問題。
