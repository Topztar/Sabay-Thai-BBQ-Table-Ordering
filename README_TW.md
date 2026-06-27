# Sabay Thai BBQ 混合雲端點餐系統

本系統採用混合雲架構，結合 Firebase 即時同步與本機 Python POS 節點，確保在高併發點餐下維持極低延遲，並支援完全離線的結帳與熱感式列印。

## 系統架構
- **Cloud**: Firebase Firestore (Real-time Sync), PostgreSQL (Historical Analytics).
- **Local Node**: Python 3.11, FastAPI, PySide6, SQLite.
- **Hardware**: ESC/POS Printer, Cash Drawer (0x1B, 0x70, 0x00, 0x1E, 0xFA).

## 快速啟動

### 1. 前端點餐系統 (Customer UI)
1. `cd frontend`
2. `npm install`
3. `npm run dev`
訪問連結範例： `http://localhost:5173/?tenantId=T001&tableId=A1`

### 2. 本機 POS 節點 (Local Node)
1. `cd local_app`
2. `pip install -r requirements.txt`
3. `python src/gui.py`

## 多租戶 RLS 說明
所有資料庫查詢均受 PostgreSQL Row-Level Security 保護。在執行 SQL 前，請務必設定：
`SET LOCAL app.current_tenant_id = 'your_tenant_id';`

## 授權
Senior Enterprise Project Architect & Lead Full-Stack Engineer Delivery.
