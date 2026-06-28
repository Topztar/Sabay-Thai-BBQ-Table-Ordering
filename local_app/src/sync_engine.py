import time
import logging
from google.cloud import firestore
from .database import get_db
from .models import LocalOrder
import threading

class SyncEngine:
    def __init__(self, tenant_id, hw_manager=None):
        self.tenant_id = tenant_id
        self.db = firestore.Client()
        self.local_session = get_db()
        self.hw = hw_manager
        self.logger = logging.getLogger("SyncEngine")
        self._lock = threading.Lock() # 加入狀態鎖，防止 Race Condition

    def start_listening(self):
        try:
            orders_ref = self.db.collection(f'tenants/{self.tenant_id}/orders')
            self.watcher = orders_ref.on_snapshot(self.on_snapshot)
            self.logger.info(f"Started listening for tenant: {self.tenant_id}")
        except Exception as e:
            self.logger.error(f"Failed to connect to Firestore: {e}")

    def on_snapshot(self, col_snapshot, changes, read_time):
        with self._lock: # 確保處理單一 Snapshot 時的原子性
            for change in changes:
                if change.type.name == 'ADDED':
                    order_data = change.document.to_dict()
                    order_id = change.document.id

                    # 檢查本地是否已存在，防止重複處理（Unconditional Seeding Guard）
                    existing = self.local_session.query(LocalOrder).filter_by(order_id=order_id).first()
                    if not existing:
                        self.logger.info(f"Processing New Order: {order_id}")
                        self.save_local(order_id, order_data)
                    else:
                        self.logger.debug(f"Order {order_id} already exists locally. Skipping.")

    def save_local(self, order_id, data):
        try:
            new_order = LocalOrder(
                order_id=order_id,
                table_id=data.get('table_id'),
                total_amount=data.get('total_amount'),
                status='pending'
            )
            self.local_session.add(new_order)
            self.local_session.commit()

            if self.hw:
                self.hw.print_receipt({
                    "order_id": order_id,
                    "table_id": data.get('table_id'),
                    "total": data.get('total_amount'),
                    "items": data.get('items', []),
                    "time": str(data.get('timestamp', 'N/A'))
                })
        except Exception as e:
            self.logger.error(f"Error saving local order {order_id}: {e}")
            self.local_session.rollback()
