import serial
from escpos.printer import Serial, Usb
import logging

# 定義錢箱開啟指令 (ESC/POS)
OPEN_DRAWER = bytes([0x1B, 0x70, 0x00, 0x1E, 0xFA])

class HardwareManager:
    def __init__(self, port='COM1', baudrate=9600):
        self.port = port
        self.baudrate = baudrate
        self.logger = logging.getLogger("HardwareManager")

    def open_cash_drawer(self):
        """獨立發送開啟錢箱指令"""
        try:
            ser = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                bytesize=8,
                stopbits=1,
                parity='N',
                timeout=2
            )
            ser.write(OPEN_DRAWER)
            ser.close()
            self.logger.info("Cash drawer opened manually.")
            return True
        except Exception as e:
            self.logger.error(f"Failed to open drawer: {e}")
            return False

    def print_receipt(self, order_data):
        """列印收據並在列印後自動開錢箱"""
        try:
            # 假設使用 Serial 連接印表機
            p = Serial(
                devfile=self.port,
                baudrate=self.baudrate,
                bytesize=8,
                timeout=1
            )

            # 設定編碼為繁體中文 (依據印表機型號，通常為 CP950 或 Big5)
            # p.charcode('BIG5')

            p.set(align='center', text_type='B', width=2, height=2)
            p.text("Sabay Thai BBQ\n")
            p.set(align='center', text_type='NORMAL')
            p.text("--------------------------------\n")
            p.text(f"訂單編號: {order_data.get('order_id')}\n")
            p.text(f"桌號: {order_data.get('table_id')}\n")
            p.text(f"時間: {order_data.get('time')}\n")
            p.text("--------------------------------\n")

            for item in order_data.get('items', []):
                name = item.get('name')
                qty = item.get('qty')
                price = item.get('price')
                # 簡單的對齊處理
                p.text(f"{name:<15} x{qty:>2} {price:>8}\n")

            p.text("--------------------------------\n")
            p.text(f"總計 Amount: {order_data.get('total'):>15}\n")
            p.cut()

            # 列印完成後觸發錢箱
            p._raw(OPEN_DRAWER)
            p.close()
            return True
        except Exception as e:
            self.logger.error(f"Printing failed: {e}")
            return False
