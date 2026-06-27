import time
from google.cloud import firestore
from .database import get_db
from .models import LocalOrder

class SyncEngine:
    def __init__(self, tenant_id):
        self.tenant_id = tenant_id
        self.db = firestore.Client()
        self.local_session = get_db()

    def start_listening(self):
        # 監聽 Firestore 中的訂單集合
        orders_ref = self.db.collection(f'tenants/{self.tenant_id}/orders')
        self.watcher = orders_ref.on_snapshot(self.on_snapshot)
        print(f"Started listening for tenant: {self.tenant_id}")

    def on_snapshot(self, col_snapshot, changes, read_time):
        for change in changes:
            if change.type.name == 'ADDED':
                order_data = change.document.to_dict()
                order_id = change.document.id
                print(f"New Order: {order_id}")
                self.save_local(order_id, order_data)

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
            # 這裡之後會觸發列印邏輯
        except Exception as e:
            print(f"Error saving local: {e}")
