from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from .models import Base
import os
import logging

DB_PATH = "sqlite:///local_cache.db"
engine = create_engine(DB_PATH)
SessionLocal = sessionmaker(bind=engine)
logger = logging.getLogger("Database")

def init_db():
    # 實作持久化守衛：檢查資料庫是否已初始化
    inspector = inspect(engine)
    if not inspector.get_table_names():
        logger.info("First-time setup detected. Initializing local SQLite schema...")
        Base.metadata.create_all(engine)
    else:
        logger.info("Existing local cache detected. Skipping schema initialization to prevent state reversion.")

def get_db():
    return SessionLocal()
