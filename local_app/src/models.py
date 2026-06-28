from sqlalchemy import Column, String, Float, Integer, DateTime
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class LocalOrder(Base):
    __tablename__ = "local_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(100), unique=True)
    table_id = Column(String(20))
    total_amount = Column(Float)
    status = Column(String(20), default='pending') # pending, printed, synced
    created_at = Column(DateTime, server_default=func.now())

class LocalMenu(Base):
    __tablename__ = "local_menu"
    id = Column(String(50), primary_key=True)
    name = Column(String(100))
    price = Column(Float)
    stock = Column(Integer)
