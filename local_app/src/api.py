from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .hardware import HardwareManager
import os

app = FastAPI()
hw = HardwareManager(port=os.getenv("PRINTER_PORT", "COM1"))

class PrintPayload(BaseModel):
    order_id: str
    table_id: str
    total: float
    items: list

@app.post("/print")
async def trigger_print(payload: PrintPayload):
    success = hw.print_receipt(payload.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Printer Error")
    return {"status": "success"}

@app.post("/open-drawer")
async def trigger_drawer():
    success = hw.open_cash_drawer()
    if not success:
        raise HTTPException(status_code=500, detail="Drawer Error")
    return {"status": "success"}
