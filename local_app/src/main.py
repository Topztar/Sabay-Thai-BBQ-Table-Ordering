import threading
from .gui import POSWindow
from .sync_engine import SyncEngine
from .hardware import HardwareManager
from .database import init_db
from PySide6.QtWidgets import QApplication
import sys
import os

def start_services(tenant_id):
    init_db()
    hw = HardwareManager(port=os.getenv("PRINTER_PORT", "COM1"))
    sync = SyncEngine(tenant_id, hw_manager=hw)

    # 在獨立執行緒中啟動 Firestore 監聽
    thread = threading.Thread(target=sync.start_listening, daemon=True)
    thread.start()
    return hw

def main():
    app = QApplication(sys.argv)

    tenant_id = os.getenv("TENANT_ID", "T001")
    hw = start_services(tenant_id)

    window = POSWindow()
    # 連結 GUI 按鈕到硬體管理器
    window.btn_open_drawer.clicked.connect(hw.open_cash_drawer)

    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
