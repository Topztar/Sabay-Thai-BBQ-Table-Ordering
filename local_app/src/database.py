from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
import os

DB_PATH = "sqlite:///local_cache.db"
engine = create_engine(DB_PATH)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

def get_db():
    return SessionLocal()
