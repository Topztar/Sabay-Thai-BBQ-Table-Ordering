from fastapi import FastAPI, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from . import models, auth, database
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import os

app = FastAPI(title="Sabay Thai BBQ Cloud API")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_tenant_id(request: Request, db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        tenant_id: str = payload.get("tenant_id")
        if tenant_id is None:
            raise credentials_exception
        # 設定資料庫 Session 的租戶上下文 (RLS)
        database.set_tenant_context(db, tenant_id)
        return tenant_id
    except JWTError:
        raise credentials_exception

@app.get("/orders/")
def read_orders(tenant_id: str = Depends(get_current_tenant_id), db: Session = Depends(database.get_db)):
    # 由於 RLS 已啟用，這裡的查詢會自動被過濾
    orders = db.query(models.BillingOrder).all()
    return orders

@app.get("/health")
def health_check():
    return {"status": "healthy"}
