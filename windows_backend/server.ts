import express from 'express';
import cors from 'cors';
import os from 'os';
import { SerialPort } from 'serialport';
import { executePrintJob, HardwarePrinterConfig } from '../hardware/printerDriver';

const app = express();
const PORT = process.env.WINDOWS_BACKEND_PORT || 8080;

app.use(cors());
app.use(express.json());

// Hardware Config State
const defaultPrinterConfig: HardwarePrinterConfig = {
  connectionType: 'serial',
  portName: 'COM1',
  baudRate: 9600,
  ipAddress: '192.168.1.200',
  tcpPort: 9100,
  paperWidthMm: 80,
  characterSet: 'CP950',
};

// Print Queue
interface WindowsPrintJob {
  id: string;
  tableNumber: string;
  items: Array<{ name: string; quantity: number; notes?: string; price: number }>;
  totalAmount: number;
  createdAt: string;
  status: 'PENDING' | 'PRINTING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

const printQueue: WindowsPrintJob[] = [];
let isPrinting = false;

// 1. Status & Hardware Diagnostic Endpoint
app.get('/windows/status', async (req, res) => {
  try {
    const availablePorts = await SerialPort.list().catch(() => []);
    res.json({
      success: true,
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      cpus: os.cpus().length,
      memory: {
        totalMb: Math.round(os.totalmem() / 1024 / 1024),
        freeMb: Math.round(os.freemem() / 1024 / 1024),
      },
      hardware: {
        printerConfig: defaultPrinterConfig,
        availableComPorts: availablePorts.map((p) => ({
          path: p.path,
          manufacturer: p.manufacturer,
        })),
      },
      queue: {
        totalJobs: printQueue.length,
        pendingJobs: printQueue.filter((j) => j.status === 'PENDING').length,
        isPrinting,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Hardware COM Port Scanner Endpoint
app.get('/windows/com-ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json({ success: true, ports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Update Hardware Printer Config
app.post('/windows/config/printer', (req, res) => {
  const { connectionType, portName, baudRate, ipAddress, tcpPort, paperWidthMm, characterSet } =
    req.body;

  if (connectionType) defaultPrinterConfig.connectionType = connectionType;
  if (portName) defaultPrinterConfig.portName = portName;
  if (baudRate) defaultPrinterConfig.baudRate = Number(baudRate);
  if (ipAddress) defaultPrinterConfig.ipAddress = ipAddress;
  if (tcpPort) defaultPrinterConfig.tcpPort = Number(tcpPort);
  if (paperWidthMm) defaultPrinterConfig.paperWidthMm = Number(paperWidthMm);
  if (characterSet) defaultPrinterConfig.characterSet = characterSet;

  res.json({
    success: true,
    message: 'Windows POS Printer Configuration Updated',
    config: defaultPrinterConfig,
  });
});

// 4. Print Job Submission Endpoint
app.post('/windows/print', async (req, res) => {
  const { tableNumber, items, totalAmount } = req.body;

  if (!tableNumber || !items || !Array.isArray(items)) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid print job data. Require tableNumber and items.' });
  }

  const newJob: WindowsPrintJob = {
    id: `WIN-PRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tableNumber,
    items,
    totalAmount: totalAmount || 0,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
  };

  printQueue.push(newJob);
  processPrintQueue();

  res.json({
    success: true,
    jobId: newJob.id,
    message: 'Print job queued in Windows backend',
    queuePosition: printQueue.length,
  });
});

// 5. Print Queue Status & History
app.get('/windows/print-queue', (req, res) => {
  res.json({
    success: true,
    jobs: printQueue.slice(-50), // last 50 jobs
  });
});

// Worker to process print queue
async function processPrintQueue() {
  if (isPrinting) return;
  const nextJob = printQueue.find((j) => j.status === 'PENDING');
  if (!nextJob) return;

  isPrinting = true;
  nextJob.status = 'PRINTING';

  try {
    const receiptText = generateReceiptText(nextJob);
    const printResult = await executePrintJob(receiptText, defaultPrinterConfig);

    if (printResult.success) {
      nextJob.status = 'SUCCESS';
    } else {
      nextJob.status = 'FAILED';
      nextJob.errorMessage = printResult.error;
    }
  } catch (err: any) {
    nextJob.status = 'FAILED';
    nextJob.errorMessage = err.message;
  } finally {
    isPrinting = false;
    setTimeout(processPrintQueue, 500);
  }
}

function generateReceiptText(job: WindowsPrintJob): string {
  let text = `================================\n`;
  text += `   SABAY THAI BBQ - KITCHEN CUE  \n`;
  text += `================================\n`;
  text += `Job ID: ${job.id}\n`;
  text += `Table: ${job.tableNumber}\n`;
  text += `Time: ${new Date(job.createdAt).toLocaleString()}\n`;
  text += `--------------------------------\n`;
  job.items.forEach((item) => {
    text += `${item.name} x${item.quantity}  $${item.price * item.quantity}\n`;
    if (item.notes) {
      text += `  * Notes: ${item.notes}\n`;
    }
  });
  text += `--------------------------------\n`;
  text += `Total: $${job.totalAmount}\n`;
  text += `================================\n\n\n`;
  return text;
}

// 6. Health Check / Ping
app.get('/windows/ping', (req, res) => {
  res.send('Windows Backend Active');
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`[Windows Environment Backend] Server running on port ${PORT}`);
  console.log(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`Status API: http://localhost:${PORT}/windows/status`);
  console.log(`Print API:  http://localhost:${PORT}/windows/print`);
  console.log(`=======================================================`);
});
