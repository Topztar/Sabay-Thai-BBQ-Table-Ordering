import sys
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QPushButton, QLabel, QWidget, QTableWidget, QTableWidgetItem
from PySide6.QtCore import Qt

class POSWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Sabay Thai BBQ - Local POS")
        self.resize(800, 600)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        self.label = QLabel("即時訂單監控 (KDS)")
        self.label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.label)

        self.order_table = QTableWidget(0, 4)
        self.order_table.setHorizontalHeaderLabels(["單號", "桌號", "金額", "狀態"])
        layout.addWidget(self.order_table)

        self.btn_open_drawer = QPushButton("手動開啟錢箱 (Manual Open)")
        self.btn_open_drawer.setStyleSheet("background-color: #ff4444; color: white; height: 50px;")
        layout.addWidget(self.btn_open_drawer)

        self.status_bar = self.statusBar()
        self.status_bar.showMessage("系統就緒 (離線模式支援中)")

def main():
    app = QApplication(sys.argv)
    window = POSWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
