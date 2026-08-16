"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("firebase-admin/storage");
const express_1 = __importDefault(require("express"));
(0, v2_1.setGlobalOptions)({ maxInstances: 10, minInstances: 1, memory: "1GiB", region: "asia-east1", concurrency: 80 });
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const net = __importStar(require("net"));
const path = __importStar(require("path"));
const firestore_1 = require("firebase-admin/firestore");
admin.initializeApp();
const db = (0, firestore_1.getFirestore)('ai-studio-sabaythaibbqtabl-84418196-9d0c-459c-bced-ddc424dfba07');
const storageBucket = (0, storage_1.getStorage)().bucket('sabay-bbq-order.firebasestorage.app');
const app = (0, express_1.default)();
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
function getMimeTypeFromExt(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        case '.svg':
            return 'image/svg+xml';
        case '.bmp':
            return 'image/bmp';
        case '.ico':
            return 'image/x-icon';
        default:
            return 'image/jpeg';
    }
}
const get = (routePath, handler) => {
    app.get([`/api${routePath}`, routePath], handler);
};
const post = (routePath, handler) => {
    app.post([`/api${routePath}`, routePath], handler);
};
const put = (routePath, handler) => {
    app.put([`/api${routePath}`, routePath], handler);
};
const del = (routePath, handler) => {
    app.delete([`/api${routePath}`, routePath], handler);
};
app.get(['/api/images/:path(*)', '/images/:path(*)', '/api/images', '/images'], async (req, res) => {
    const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600';
    try {
        let rawPath = req.params?.path || req.query.path || req.query.file || req.query.name || '';
        if (!rawPath && req.query.url) {
            const urlStr = String(req.query.url);
            if (urlStr.startsWith('gs://')) {
                const parts = urlStr.replace('gs://', '').split('/');
                parts.shift();
                rawPath = parts.join('/');
            }
            else if (urlStr.includes('firebasestorage.googleapis.com') || urlStr.includes('storage.googleapis.com')) {
                const match = urlStr.match(/\/o\/([^?]+)/) || urlStr.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
                if (match && match[1]) {
                    rawPath = decodeURIComponent(match[1]);
                }
            }
            else if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
                return res.redirect(302, urlStr);
            }
        }
        if (!rawPath) {
            return res.redirect(302, DEFAULT_FALLBACK_IMAGE);
        }
        if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
            return res.redirect(302, rawPath);
        }
        let cleanPath = decodeURIComponent(String(rawPath)).replace(/^\/+/, '').replace(/\.\.\//g, '');
        let file = storageBucket.file(cleanPath);
        let [exists] = await file.exists().catch(() => [false]);
        if (!exists && !cleanPath.startsWith('dishes/')) {
            const dishFile = storageBucket.file(`dishes/${cleanPath}`);
            const [dishExists] = await dishFile.exists().catch(() => [false]);
            if (dishExists) {
                file = dishFile;
                exists = true;
                cleanPath = `dishes/${cleanPath}`;
            }
        }
        if (!exists && !cleanPath.startsWith('images/')) {
            const imgFile = storageBucket.file(`images/${cleanPath}`);
            const [imgExists] = await imgFile.exists().catch(() => [false]);
            if (imgExists) {
                file = imgFile;
                exists = true;
                cleanPath = `images/${cleanPath}`;
            }
        }
        if (!exists) {
            console.warn(`[Cloud Functions Storage] Image not found: ${cleanPath}. Redirecting to fallback image.`);
            return res.redirect(302, DEFAULT_FALLBACK_IMAGE);
        }
        const [metadata] = await file.getMetadata().catch(() => [{}]);
        const contentType = metadata?.contentType || getMimeTypeFromExt(cleanPath) || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        if (metadata?.size) {
            res.setHeader('Content-Length', metadata.size);
        }
        if (metadata?.etag) {
            res.setHeader('ETag', metadata.etag);
        }
        const readStream = file.createReadStream();
        readStream.on('error', (err) => {
            console.error('[Cloud Functions Storage Stream Error]:', err);
            if (!res.headersSent) {
                res.redirect(302, DEFAULT_FALLBACK_IMAGE);
            }
        });
        readStream.pipe(res);
    }
    catch (error) {
        console.error('[Cloud Functions Storage Error]:', error);
        if (!res.headersSent) {
            res.redirect(302, DEFAULT_FALLBACK_IMAGE);
        }
    }
});
post('/images/upload', async (req, res) => {
    try {
        const { base64, data, filename, contentType, folder = 'dishes' } = req.body;
        const rawData = base64 || data;
        if (!rawData) {
            return res.status(400).json({ error: 'Missing image data (base64) / 缺少圖片資料' });
        }
        let mime = contentType || 'image/jpeg';
        let base64Clean = rawData;
        if (rawData.includes(';base64,')) {
            const parts = rawData.split(';base64,');
            const mimeMatch = parts[0].match(/data:(.*?)$/);
            if (mimeMatch)
                mime = mimeMatch[1];
            base64Clean = parts[1];
        }
        const buffer = Buffer.from(base64Clean, 'base64');
        const ext = mime.split('/')[1] || 'jpg';
        const cleanExt = ext === 'jpeg' ? 'jpg' : ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
        let targetFilename = filename
            ? filename.replace(/[^a-zA-Z0-9._-]/g, '')
            : `dish-${Date.now()}.${cleanExt}`;
        targetFilename = targetFilename.replace(/-+\./g, '.').replace(/\.+/g, '.').replace(/^-+|-+$/g, '');
        if (!targetFilename.includes('.')) {
            targetFilename = `${targetFilename}.${cleanExt}`;
        }
        const targetPath = `${folder}/${targetFilename}`.replace(/^\/+/, '');
        const file = storageBucket.file(targetPath);
        await file.save(buffer, {
            metadata: {
                contentType: mime,
                cacheControl: 'public, max-age=86400, stale-while-revalidate=604800'
            },
            resumable: false
        });
        const publicUrl = `/api/images/${targetPath}`;
        return res.json({
            success: true,
            url: publicUrl,
            path: targetPath,
            filename: targetFilename,
            size: buffer.length,
            contentType: mime
        });
    }
    catch (error) {
        console.error('[Cloud Functions Storage Upload Error]:', error);
        res.status(500).json({ error: 'Failed to upload image to storage', details: error?.message });
    }
});
let cachedMenu = null;
let cachedCategories = null;
const CACHE_TTL_MS = 60 * 1000;
get('/bootstrap', async (_req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300');
        const [categoriesSnap, menuSnap, tablesSnap, systemDoc, ingredientsSnap, reservationsSnap] = await Promise.all([
            db.collection('categories').orderBy('orderIndex').get(),
            db.collection('menu').orderBy('orderIndex').get(),
            db.collection('tables').get(),
            db.collection('settings').doc('system').get(),
            db.collection('ingredients').get(),
            db.collection('reservations').get()
        ]);
        const now = new Date();
        const items = menuSnap.docs.map(doc => {
            const data = doc.data();
            return { ...data, _docId: doc.id };
        });
        const processedItems = items.map((item) => {
            if (item.available === false) {
                if (!item.soldOutAt) {
                    item.soldOutAt = now.toISOString();
                }
                else {
                    const soldDate = new Date(item.soldOutAt);
                    if (!isNaN(soldDate.getTime())) {
                        const restoreTime = new Date(soldDate);
                        restoreTime.setDate(restoreTime.getDate() + 1);
                        restoreTime.setHours(12, 0, 0, 0);
                        if (now.getTime() >= restoreTime.getTime()) {
                            item.available = true;
                            item.soldOutAt = null;
                        }
                    }
                }
            }
            else if (item.soldOutAt) {
                item.soldOutAt = null;
            }
            delete item._docId;
            return item;
        });
        const nowMs = Date.now();
        const tableUpdatePromises = [];
        const tables = tablesSnap.docs.map(doc => {
            const tb = doc.data();
            if (tb.status === 'cleaning') {
                let cleaningStartMs = tb.cleaningStartedAt ? new Date(tb.cleaningStartedAt).getTime() : 0;
                if (!cleaningStartMs || isNaN(cleaningStartMs)) {
                    cleaningStartMs = nowMs - (16 * 60 * 1000);
                }
                if (nowMs - cleaningStartMs >= 15 * 60 * 1000) {
                    tb.status = 'available';
                    tb.cleaningStartedAt = null;
                    tableUpdatePromises.push(doc.ref.update({ status: 'available', cleaningStartedAt: null }));
                }
            }
            return tb;
        });
        if (tableUpdatePromises.length > 0) {
            Promise.all(tableUpdatePromises).catch(err => console.error('[Cloud Functions] Bootstrap tables auto-clean write error:', err));
        }
        const sysData = systemDoc.data() || {};
        const isOpen = isStoreOpenFromData(sysData);
        res.json({
            menu: processedItems,
            categories: categoriesSnap.docs.map(doc => doc.data()),
            tables,
            operatingHours: {
                slots: sysData.liveOperatingHours || [],
                restDays: sysData.liveRestDays || [],
                isOpen
            },
            customerNotice: { notice: sysData.liveCustomerNotice || '' },
            promoCombo: sysData.livePromoCombo || { enabled: false, requiredQty: 0, discountAmount: 0, eligibleItemIds: [] },
            popularItemIds: sysData.livePopularItemIds || [],
            minSpend: { minSpend: sysData.liveMinSpendPerPerson ?? 200 },
            membersConfig: {
                pointsRatio: sysData.liveMemberPointsRatio ?? 20,
                rewards: sysData.liveMemberRewards || []
            },
            servicePaused: { servicePaused: sysData.liveServicePaused || false },
            printerConfig: { ip: sysData.livePrinterIp || '192.168.123.100' },
            ingredients: ingredientsSnap.docs.map(doc => doc.data()),
            reservations: reservationsSnap.docs.map(doc => doc.data())
        });
    }
    catch (error) {
        console.error('Error fetching bootstrap data:', error);
        res.status(500).send(error);
    }
});
get('/categories', async (_req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300');
        const nowMs = Date.now();
        if (cachedCategories && (nowMs - cachedCategories.timestamp < CACHE_TTL_MS)) {
            return res.json(cachedCategories.data);
        }
        const snapshot = await db.collection('categories').orderBy('orderIndex').get();
        const categories = snapshot.docs.map(doc => doc.data());
        cachedCategories = { data: categories, timestamp: nowMs };
        res.json(categories);
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send(error);
    }
});
get('/menu', async (_req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300');
        const nowMs = Date.now();
        if (cachedMenu && (nowMs - cachedMenu.timestamp < CACHE_TTL_MS)) {
            return res.json(cachedMenu.data);
        }
        const now = new Date();
        const snapshot = await db.collection('menu').select('id', 'category', 'name', 'price', 'image', 'description', 'available', 'isAvailable', 'isSetMeal', 'requiredSaucesOption', 'hasNoodlesOption', 'hasCoconutsMilkOption', 'containsBeef', 'containsPork', 'containsSeafood', 'isNotSpicy', 'customAddOns', 'recipe', 'orderIndex', 'isTakeoutAvailable', 'soldOutAt').orderBy('orderIndex').get();
        const items = snapshot.docs.map(doc => {
            const data = doc.data();
            return { ...data, _docId: doc.id };
        });
        const processedItems = items.map((item) => {
            if (item.available === false) {
                if (!item.soldOutAt) {
                    item.soldOutAt = now.toISOString();
                }
                else {
                    const soldDate = new Date(item.soldOutAt);
                    if (!isNaN(soldDate.getTime())) {
                        const restoreTime = new Date(soldDate);
                        restoreTime.setDate(restoreTime.getDate() + 1);
                        restoreTime.setHours(12, 0, 0, 0);
                        if (now.getTime() >= restoreTime.getTime()) {
                            item.available = true;
                            item.soldOutAt = null;
                        }
                    }
                }
            }
            else if (item.soldOutAt) {
                item.soldOutAt = null;
            }
            delete item._docId;
            return item;
        });
        cachedMenu = { data: processedItems, timestamp: nowMs };
        res.json(processedItems);
    }
    catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).send(error);
    }
});
get('/ingredients', async (_req, res) => {
    try {
        const snapshot = await db.collection('ingredients').get();
        const ingredients = snapshot.docs.map(doc => doc.data());
        res.json(ingredients);
    }
    catch (error) {
        console.error('Error fetching ingredients:', error);
        res.status(500).send(error);
    }
});
post('/menu', async (req, res) => {
    try {
        const data = req.body;
        const isAvail = data.available !== undefined ? !!data.available : true;
        const newItem = {
            id: `dish-${Date.now()}`,
            ...data,
            available: isAvail,
            soldOutAt: !isAvail ? new Date().toISOString() : null,
            orderIndex: data.orderIndex !== undefined ? data.orderIndex : 999
        };
        await db.collection('menu').doc(newItem.id).set(newItem);
        res.status(201).json(newItem);
    }
    catch (error) {
        console.error('Error creating menu:', error);
        res.status(500).send(error);
    }
});
put('/menu/reorder', async (req, res) => {
    const { order } = req.body;
    if (!Array.isArray(order))
        return res.status(400).json({ error: 'Invalid order parameter' });
    try {
        const batch = db.batch();
        order.forEach((id, index) => {
            const ref = db.collection('menu').doc(id);
            batch.update(ref, { orderIndex: index });
        });
        await batch.commit();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/menu/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        if (data.available !== undefined) {
            if (data.available === false && !data.soldOutAt) {
                data.soldOutAt = new Date().toISOString();
            }
            else if (data.available === true) {
                data.soldOutAt = null;
            }
        }
        await db.collection('menu').doc(id).set(data, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating menu:', error);
        res.status(500).send(error);
    }
});
del('/menu/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.collection('menu').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting menu:', error);
        res.status(500).send(error);
    }
});
post('/menu/toggle-available', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Missing menu item id' });
        }
        let docRef = db.collection('menu').doc(id);
        let docSnap = await docRef.get();
        if (!docSnap.exists) {
            const query = await db.collection('menu').where('id', '==', id).limit(1).get();
            if (!query.empty) {
                docRef = query.docs[0].ref;
                docSnap = query.docs[0];
            }
        }
        if (docSnap.exists) {
            const currentData = docSnap.data();
            const newAvailable = !(currentData?.available ?? true);
            const newSoldOutAt = !newAvailable ? new Date().toISOString() : null;
            await docRef.set({ available: newAvailable, soldOutAt: newSoldOutAt }, { merge: true });
            const updatedItem = { ...currentData, available: newAvailable, soldOutAt: newSoldOutAt };
            return res.json({ success: true, item: updatedItem, available: newAvailable });
        }
        return res.status(404).json({ error: 'Menu item not found' });
    }
    catch (error) {
        console.error('Error toggling menu availability in Cloud Functions:', error);
        return res.status(500).json({ error: error?.message || 'Server error' });
    }
});
post('/categories', async (req, res) => {
    try {
        const data = req.body;
        const docRef = await db.collection('categories').add(data);
        res.json({ id: docRef.id });
    }
    catch (error) {
        console.error('Error creating category:', error);
        res.status(500).send(error);
    }
});
put('/categories/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        await db.collection('categories').doc(id).set(data, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating category:', error);
        res.status(500).send(error);
    }
});
del('/categories/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.collection('categories').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).send(error);
    }
});
post('/ingredients', async (req, res) => {
    try {
        const data = req.body;
        const docRef = await db.collection('ingredients').add(data);
        res.json({ id: docRef.id });
    }
    catch (error) {
        console.error('Error creating ingredient:', error);
        res.status(500).send(error);
    }
});
put('/ingredients/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        await db.collection('ingredients').doc(id).set(data, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating ingredient:', error);
        res.status(500).send(error);
    }
});
del('/ingredients/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.collection('ingredients').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting ingredient:', error);
        res.status(500).send(error);
    }
});
get('/tables', async (_req, res) => {
    try {
        const snapshot = await db.collection('tables').get();
        const nowMs = Date.now();
        const updatePromises = [];
        const tables = snapshot.docs.map(doc => {
            const tb = doc.data();
            if (tb.status === 'cleaning') {
                let cleaningStartMs = tb.cleaningStartedAt ? new Date(tb.cleaningStartedAt).getTime() : 0;
                if (!cleaningStartMs || isNaN(cleaningStartMs)) {
                    cleaningStartMs = nowMs - (16 * 60 * 1000);
                }
                if (nowMs - cleaningStartMs >= 15 * 60 * 1000) {
                    tb.status = 'available';
                    tb.cleaningStartedAt = null;
                    updatePromises.push(doc.ref.update({ status: 'available', cleaningStartedAt: null }));
                }
            }
            return tb;
        });
        if (updatePromises.length > 0) {
            Promise.all(updatePromises).catch(err => console.error('[Cloud Functions] Tables auto-clean write error:', err));
        }
        res.json(tables);
    }
    catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).send(error);
    }
});
get('/reservations', async (_req, res) => {
    try {
        const snapshot = await db.collection('reservations').get();
        const reservations = snapshot.docs.map(doc => doc.data());
        res.json(reservations);
    }
    catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).send(error);
    }
});
get('/orders', async (_req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = today.toISOString();
        const snapshot = await db.collection('orders').where('createdAt', '>=', startOfDay).orderBy('createdAt', 'desc').get();
        const orders = snapshot.docs.map(doc => doc.data());
        res.json(orders);
    }
    catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send(error);
    }
});
let cachedServicePause = null;
get('/settings/service-pause', async (_req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
        const nowMs = Date.now();
        if (cachedServicePause && (nowMs - cachedServicePause.timestamp < CACHE_TTL_MS)) {
            return res.json(cachedServicePause.data);
        }
        const systemDoc = await db.collection('settings').doc('system').get();
        const data = { servicePaused: systemDoc.data()?.liveServicePaused || false };
        cachedServicePause = { data, timestamp: nowMs };
        res.json(data);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/settings/min-spend', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        res.json({ minSpend: systemDoc.data()?.liveMinSpendPerPerson ?? 200 });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
function isStoreOpenFromData(sysData, timestamp, isReservation = false) {
    if (!sysData)
        return true;
    if (sysData.liveServicePaused)
        return false;
    const restDays = sysData.liveRestDays || [];
    const operatingHours = sysData.liveOperatingHours || [];
    const date = timestamp ? new Date(timestamp) : new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const localDate = new Date(utc + (3600000 * 8));
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(localDate.getDate()).padStart(2, '0');
    const taiwanDateString = `${year}-${month}-${dayOfMonth}`;
    if (restDays.includes(taiwanDateString)) {
        return false;
    }
    const activeSlots = operatingHours.filter((s) => s && s.isActive);
    if (activeSlots.length === 0) {
        return true;
    }
    const day = localDate.getDay();
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();
    const currentTotalMinutes = hour * 60 + minute;
    for (const slot of activeSlots) {
        if (slot.days && Array.isArray(slot.days) && !slot.days.includes(day))
            continue;
        if (slot.isReservableOnly && !isReservation)
            continue;
        const [startH, startM] = (slot.start || '00:00').split(':').map(Number);
        const [endH, endM] = (slot.end || '23:59').split(':').map(Number);
        const startTotal = (startH || 0) * 60 + (startM || 0);
        const endTotal = (endH || 0) * 60 + (endM || 0);
        if (startTotal <= endTotal) {
            if (currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal) {
                return true;
            }
        }
        else {
            if (currentTotalMinutes >= startTotal || currentTotalMinutes <= endTotal) {
                return true;
            }
        }
    }
    return false;
}
get('/settings/operating-hours', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const data = systemDoc.data() || {};
        const isOpen = isStoreOpenFromData(data);
        res.json({
            slots: data.liveOperatingHours || [],
            restDays: data.liveRestDays || [],
            isOpen
        });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/settings/customer-notice', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        res.json({ notice: systemDoc.data()?.liveCustomerNotice || '' });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/settings/popular-item-ids', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        res.json(systemDoc.data()?.livePopularItemIds || []);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/settings/members-config', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const data = systemDoc.data();
        res.json({
            pointsRatio: data?.liveMemberPointsRatio ?? 20,
            rewards: data?.liveMemberRewards || []
        });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/promo-combo', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        res.json(systemDoc.data()?.livePromoCombo || { enabled: false, requiredQty: 0, discountAmount: 0, eligibleItemIds: [] });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/option-rules', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const defaultRules = [
            {
                id: 'rule-1784360566576',
                name: '加河粉',
                category: '加配料',
                price: 20
            },
            {
                id: 'rule-1784360574891',
                name: '加米線',
                category: '加配料',
                price: 20
            },
            {
                id: 'rule-1784360613823',
                name: '升級套餐(烤蔬菜+泰奶一杯)',
                category: '加配料',
                price: 140
            }
        ];
        res.json(systemDoc.data()?.liveOptionRules || defaultRules);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/printer/config', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        res.json({ ip: systemDoc.data()?.livePrinterIp || '192.168.123.100' });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/print-logs', async (_req, res) => {
    try {
        const logsDoc = await db.collection('settings').doc('logs').get();
        res.json(logsDoc.data()?.printLogs || []);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/push-notifications', async (_req, res) => {
    try {
        const logsDoc = await db.collection('settings').doc('logs').get();
        res.json(logsDoc.data()?.promoNotifications || []);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/orders', async (req, res) => {
    const orderData = req.body;
    const orderId = orderData.id || `ORD-${Date.now().toString(36).toUpperCase()}`;
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const sysData = systemDoc.data();
        if (!isStoreOpenFromData(sysData)) {
            return res.status(403).json({ error: '目前不在營業時間內（店鋪休息中），系統不開放下單點餐！' });
        }
        await db.collection('orders').doc(orderId).set({
            ...orderData,
            id: orderId,
            status: orderData.status || 'pending',
            createdAt: orderData.createdAt || new Date().toISOString(),
        });
        if (orderData.tableNumber && !String(orderData.tableNumber).includes('外帶') && String(orderData.tableNumber).toLowerCase() !== 'takeout') {
            const tblId = String(orderData.tableNumber).trim();
            const tableRef = db.collection('tables').doc(tblId);
            const tableSnap = await tableRef.get();
            if (tableSnap.exists) {
                await tableRef.update({ status: 'in_use', cleaningStartedAt: null });
            }
        }
        res.status(201).json({ success: true, id: orderId });
    }
    catch (error) {
        console.error('Error submitting order:', error);
        res.status(500).send(error);
    }
});
put('/orders/:id/status', async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    try {
        await db.collection('orders').doc(id).update({ status });
        res.json({ id, status });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/table-number', async (req, res) => {
    const id = req.params.id;
    const { tableNumber } = req.body;
    try {
        await db.collection('orders').doc(id).update({ tableNumber });
        res.json({ id, tableNumber });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/quick-notes', async (req, res) => {
    const id = req.params.id;
    const { quickNotes } = req.body;
    try {
        await db.collection('orders').doc(id).update({ quickNotes });
        res.json({ id, quickNotes });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/flag', async (req, res) => {
    const id = req.params.id;
    const { isFlagged, flagReason } = req.body;
    try {
        await db.collection('orders').doc(id).update({ isFlagged, flagReason });
        res.json({ id, isFlagged, flagReason });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/items', async (req, res) => {
    const id = req.params.id;
    const { items, refundLogs } = req.body;
    try {
        await db.collection('orders').doc(id).update({ items, refundLogs });
        res.json({ id, items, refundLogs });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/checkout', async (req, res) => {
    const id = req.params.id;
    const checkoutData = req.body;
    try {
        const orderDoc = await db.collection('orders').doc(id).get();
        const orderData = orderDoc.data();
        await db.collection('orders').doc(id).update({
            ...checkoutData,
            isPaid: true,
            status: 'paid'
        });
        if (orderData && orderData.tableNumber && !String(orderData.tableNumber).includes('外帶') && String(orderData.tableNumber).toLowerCase() !== 'takeout') {
            const tblId = String(orderData.tableNumber).trim();
            const tableRef = db.collection('tables').doc(tblId);
            const tableSnap = await tableRef.get();
            if (tableSnap.exists) {
                await tableRef.update({
                    status: 'cleaning',
                    preservedFor: '',
                    cleaningStartedAt: new Date().toISOString()
                });
            }
        }
        if (orderData && orderData.reservationNo) {
            const resQuery = await db.collection('reservations').where('reservationNo', '==', orderData.reservationNo).get();
            if (!resQuery.empty) {
                for (const doc of resQuery.docs) {
                    await db.collection('reservations').doc(doc.id).delete();
                }
            }
            else {
                const resDoc = await db.collection('reservations').doc(orderData.reservationNo).get();
                if (resDoc.exists) {
                    await db.collection('reservations').doc(orderData.reservationNo).delete();
                }
            }
        }
        res.json({ id, ...checkoutData, isPaid: true, status: 'paid' });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/complete', async (req, res) => {
    const id = req.params.id;
    try {
        await db.collection('orders').doc(id).update({
            status: 'completed'
        });
        res.json({ id, status: 'completed' });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/items/:itemId/complete', async (req, res) => {
    const id = req.params.id;
    const itemId = req.params.itemId;
    const { isCompleted, isPrepared } = req.body;
    try {
        const docRef = db.collection('orders').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = docSnap.data();
        const item = order.items.find((it) => it.id === itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (typeof isCompleted !== 'undefined') {
            item.isCompleted = !!isCompleted;
            if (item.isCompleted) {
                item.isPrepared = true;
            }
        }
        if (typeof isPrepared !== 'undefined') {
            item.isPrepared = !!isPrepared;
        }
        const allCompleted = order.items.every((it) => it.isCompleted);
        if (allCompleted && order.status !== 'paid') {
            order.status = 'completed';
        }
        else if (order.status === 'completed') {
            order.status = 'preparing';
        }
        await docRef.set(order, { merge: true });
        return res.json(order);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
del('/orders/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.collection('orders').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/inventory/adjust', async (req, res) => {
    const { ingredientId, quantityChanged } = req.body;
    const change = Number(quantityChanged);
    if (isNaN(change)) {
        return res.status(400).json({ error: 'Invalid quantityChanged' });
    }
    const ingRef = db.collection('ingredients').doc(ingredientId);
    try {
        await db.runTransaction(async (t) => {
            const docSnap = await t.get(ingRef);
            const newStock = Math.round(((docSnap.data()?.stock || 0) + change) * 100) / 100;
            t.update(ingRef, { stock: newStock });
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error adjusting inventory:', error);
        res.status(500).send(error);
    }
});
post('/ingredients/restock', async (req, res) => {
    const { ingredientId, quantityAdded } = req.body;
    const amount = Number(quantityAdded);
    if (isNaN(amount)) {
        return res.status(400).json({ error: 'Invalid quantityAdded' });
    }
    const ingRef = db.collection('ingredients').doc(ingredientId);
    try {
        await db.runTransaction(async (t) => {
            const docSnap = await t.get(ingRef);
            const newStock = Math.round(((docSnap.data()?.stock || 0) + amount) * 100) / 100;
            t.update(ingRef, { stock: newStock });
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/print-logs/clear', async (_req, res) => {
    try {
        await db.collection('settings').doc('logs').set({ printLogs: [] }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/settings/service-pause', async (req, res) => {
    const { servicePaused } = req.body;
    try {
        await db.collection('settings').doc('system').set({ liveServicePaused: !!servicePaused }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/settings/min-spend', async (req, res) => {
    const { minSpend } = req.body;
    try {
        await db.collection('settings').doc('system').set({ liveMinSpendPerPerson: Number(minSpend) }, { merge: true });
        res.json({ success: true, minSpend: Number(minSpend) });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/settings/operating-hours', async (req, res) => {
    const { slots, restDays } = req.body;
    try {
        await db.collection('settings').doc('system').set({
            liveOperatingHours: slots,
            liveRestDays: restDays
        }, { merge: true });
        const systemDoc = await db.collection('settings').doc('system').get();
        const servicePaused = systemDoc.data()?.liveServicePaused || false;
        res.json({ success: true, slots, restDays, isOpen: !servicePaused });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/settings/customer-notice', async (req, res) => {
    const { notice } = req.body;
    try {
        await db.collection('settings').doc('system').set({ liveCustomerNotice: String(notice) }, { merge: true });
        res.json({ success: true, notice: String(notice) });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/settings/popular-item-ids', async (req, res) => {
    const { popularItemIds, ids } = req.body;
    const targetIds = popularItemIds || ids || [];
    try {
        await db.collection('settings').doc('system').set({ livePopularItemIds: targetIds }, { merge: true });
        res.json({ success: true, popularItemIds: targetIds });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
const handleSavePrinterIp = async (req, res) => {
    const { ip } = req.body;
    const targetIp = String(ip || '192.168.123.100');
    try {
        const systemRef = db.collection('settings').doc('system');
        const docSnap = await systemRef.get();
        const sysData = docSnap.data() || {};
        let currentSettings = sysData.livePrinterSettings || {};
        if (!currentSettings.kitchen)
            currentSettings.kitchen = {};
        if (!currentSettings.bill)
            currentSettings.bill = {};
        currentSettings.kitchen.ip = targetIp;
        currentSettings.bill.ip = targetIp;
        await systemRef.set({
            livePrinterIp: targetIp,
            livePrinterSettings: currentSettings
        }, { merge: true });
        res.json({ success: true, ip: targetIp });
    }
    catch (error) {
        res.status(500).send(error);
    }
};
put('/printer/config', handleSavePrinterIp);
post('/printer/config', handleSavePrinterIp);
post('/staff/pin/verify', async (req, res) => {
    const { pin } = req.body;
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const liveStaffPin = systemDoc.data()?.liveStaffPin || '888888';
        if (String(pin) === String(liveStaffPin)) {
            return res.json({ success: true, access_token: 'mock-jwt-token-for-staff' });
        }
        return res.status(400).json({ success: false, error: '解鎖金鑰錯誤！' });
    }
    catch (error) {
        console.error('Error verifying PIN:', error);
        res.status(500).send(error);
    }
});
put('/staff/pin', async (req, res) => {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
        return res.status(400).json({ error: '請輸入目前金鑰與新解鎖金鑰' });
    }
    try {
        const systemRef = db.collection('settings').doc('system');
        const systemDoc = await systemRef.get();
        const liveStaffPin = systemDoc.data()?.liveStaffPin || '888888';
        if (String(currentPin) !== String(liveStaffPin)) {
            return res.status(400).json({ error: '目前金鑰輸入錯誤！' });
        }
        if (!/^\d{6}$/.test(newPin)) {
            return res.status(400).json({ error: '新金鑰必須為 6 位數字！' });
        }
        await systemRef.set({ liveStaffPin: newPin }, { merge: true });
        return res.json({ success: true, message: '員工解鎖金鑰已成功變更！' });
    }
    catch (error) {
        console.error('Error updating PIN:', error);
        res.status(500).send(error);
    }
});
post('/printer/pin', async (req, res) => {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
        return res.status(400).json({ error: '請輸入目前金鑰與新解鎖金鑰' });
    }
    try {
        const systemRef = db.collection('settings').doc('system');
        const systemDoc = await systemRef.get();
        const liveStaffPin = systemDoc.data()?.liveStaffPin || '888888';
        if (String(currentPin) !== String(liveStaffPin)) {
            return res.status(400).json({ error: '目前解鎖金鑰輸入錯誤！' });
        }
        if (!/^\d{6}$/.test(newPin)) {
            return res.status(400).json({ error: '新金鑰必須為 6 位數字！' });
        }
        await systemRef.set({ liveStaffPin: newPin }, { merge: true });
        return res.json({ success: true, message: '員工解鎖金鑰已成功變更！' });
    }
    catch (error) {
        console.error('Error updating PIN via printer/pin:', error);
        res.status(500).send(error);
    }
});
post('/promo-combo', async (req, res) => {
    const data = req.body;
    try {
        await db.collection('settings').doc('system').set({ livePromoCombo: data, livePromoCombos: data.combos }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/settings/members-config', async (req, res) => {
    const { pointsRatio, rewards } = req.body;
    try {
        await db.collection('settings').doc('system').set({
            liveMemberPointsRatio: pointsRatio,
            liveMemberRewards: rewards
        }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/printer/settings', async (req, res) => {
    const { kitchen, bill } = req.body;
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        let currentSettings = systemDoc.data()?.livePrinterSettings || {};
        if (kitchen) {
            currentSettings.kitchen = { ...currentSettings.kitchen, ...kitchen };
        }
        if (bill) {
            currentSettings.bill = { ...currentSettings.bill, ...bill };
        }
        await db.collection('settings').doc('system').set({ livePrinterSettings: currentSettings }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/option-rules', async (req, res) => {
    const { name, category, price } = req.body;
    const newRule = {
        id: `rule-${Date.now()}`,
        name: name || '新選項',
        category: category || '加配料',
        price: Number(price) || 0
    };
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        let rules = systemDoc.data()?.liveOptionRules || [];
        rules.push(newRule);
        await db.collection('settings').doc('system').set({ liveOptionRules: rules }, { merge: true });
        res.status(201).json(newRule);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
del('/option-rules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        let rules = systemDoc.data()?.liveOptionRules || [];
        rules = rules.filter((r) => r.id !== id);
        await db.collection('settings').doc('system').set({ liveOptionRules: rules }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/admin/clear-test-data', async (req, res) => {
    const { pin } = req.body;
    try {
        const systemRef = db.collection('settings').doc('system');
        const systemDoc = await systemRef.get();
        const liveStaffPin = systemDoc.data()?.liveStaffPin || '888888';
        if (!pin || String(pin) !== String(liveStaffPin)) {
            return res.status(403).json({ error: '安全校對碼 (員工解鎖 PIN 碼) 不正確，無法授權清空！' });
        }
        await db.collection('settings').doc('logs').set({ printLogs: [], inventoryLogs: [], promoNotifications: [] }, { merge: true });
        const ordersSnapshot = await db.collection('orders').get();
        const batchOrders = db.batch();
        ordersSnapshot.docs.forEach((doc) => {
            batchOrders.delete(doc.ref);
        });
        await batchOrders.commit();
        const reservationsSnapshot = await db.collection('reservations').get();
        const batchReservations = db.batch();
        reservationsSnapshot.docs.forEach((doc) => {
            batchReservations.delete(doc.ref);
        });
        await batchReservations.commit();
        const tablesSnapshot = await db.collection('tables').get();
        const batchTables = db.batch();
        tablesSnapshot.docs.forEach((doc) => {
            batchTables.update(doc.ref, { status: 'available', preservedFor: '' });
        });
        await batchTables.commit();
        await systemRef.set({
            liveTakeoutSeq: 0,
            liveStaffPin: '888888'
        }, { merge: true });
        res.json({ success: true, message: '已成功清除系統內所有測試單據、顧客預約、桌位佔用，並將登入密碼重設為預設值 888888！' });
    }
    catch (error) {
        console.error('Error clearing test data:', error);
        res.status(500).send(error);
    }
});
post('/categories', async (req, res) => {
    const data = req.body;
    try {
        await db.collection('categories').doc(data.id).set(data);
        res.status(201).json(data);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/categories/reorder', async (req, res) => {
    const { order } = req.body;
    if (!Array.isArray(order))
        return res.status(400).json({ error: 'Invalid order parameter' });
    try {
        const batch = db.batch();
        order.forEach((id, index) => {
            const ref = db.collection('categories').doc(id);
            batch.update(ref, { orderIndex: index });
        });
        await batch.commit();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/categories/:id', async (req, res) => {
    const id = req.params.id;
    const updates = req.body;
    try {
        await db.collection('categories').doc(id).update(updates);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
del('/categories/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.collection('categories').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/tables', async (req, res) => {
    const data = req.body;
    try {
        await db.collection('tables').doc(data.id).set(data);
        res.status(201).json(data);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/tables/:id', async (req, res) => {
    const id = req.params.id;
    const updates = req.body;
    try {
        if (updates.status === 'cleaning' && updates.cleaningStartedAt === undefined) {
            updates.cleaningStartedAt = new Date().toISOString();
        }
        else if (updates.status && updates.status !== 'cleaning') {
            updates.cleaningStartedAt = null;
        }
        await db.collection('tables').doc(id).update(updates);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
del('/tables/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.collection('tables').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/reservations', async (req, res) => {
    const data = req.body;
    if (data.date) {
        const now = new Date();
        now.setMonth(now.getMonth() + 3);
        const maxDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (data.date.trim() > maxDateStr) {
            res.status(400).json({ error: `預約日期最多只能提前 3 個月 (最晚至 ${maxDateStr})！` });
            return;
        }
    }
    const newReservation = {
        id: 'res-' + Math.random().toString(36).substring(2, 11),
        ...data,
        createdAt: new Date().toISOString()
    };
    try {
        await db.collection('reservations').doc(newReservation.id).set(newReservation);
        if (newReservation.status === 'pending') {
            const tableRef = db.collection('tables').doc(newReservation.tableNumber);
            await tableRef.update({ status: 'preserved', preservedFor: `${newReservation.customerName} (${newReservation.time})` });
        }
        res.status(201).json(newReservation);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/reservations/:id', async (req, res) => {
    const id = req.params.id;
    const updates = req.body;
    try {
        if (updates.status === 'cancelled') {
            const doc = await db.collection('reservations').doc(id).get();
            const resData = doc.data();
            if (resData && resData.tableNumber) {
                await db.collection('tables').doc(resData.tableNumber).update({ status: 'available', preservedFor: '' });
            }
            await db.collection('reservations').doc(id).delete();
            res.json({ success: true, message: 'Reservation cancelled and deleted' });
            return;
        }
        await db.collection('reservations').doc(id).update(updates);
        if (updates.status) {
            const doc = await db.collection('reservations').doc(id).get();
            const resData = doc.data();
            if (resData && resData.tableNumber) {
                const tableRef = db.collection('tables').doc(resData.tableNumber);
                if (updates.status === 'seated') {
                    await tableRef.update({ status: 'in_use', preservedFor: '' });
                }
                else if (updates.status === 'pending') {
                    await tableRef.update({ status: 'preserved', preservedFor: `${resData.customerName} (${resData.time})` });
                }
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).send(error);
    }
});
del('/reservations/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.collection('reservations').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/ingredients', async (req, res) => {
    const data = req.body;
    const finalName = {
        zh: data.name.zh,
        en: data.name.en || data.name.zh,
        ko: data.name.ko || data.name.zh,
        ja: data.name.ja || data.name.zh,
        th: data.name.th || data.name.zh,
    };
    const newIngredient = {
        id: data.id,
        name: finalName,
        stock: Math.round(Number(data.stock || 0) * 100) / 100,
        minThreshold: Number(data.minThreshold) || 0,
        unit: data.unit || 'kg',
    };
    try {
        await db.collection('ingredients').doc(newIngredient.id).set(newIngredient);
        res.status(201).json(newIngredient);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/pay', async (req, res) => {
    const id = req.params.id;
    const { isPaid } = req.body;
    try {
        const orderDoc = await db.collection('orders').doc(id).get();
        const orderData = orderDoc.data();
        await db.collection('orders').doc(id).update({ isPaid });
        if (isPaid && orderData && orderData.tableNumber && !String(orderData.tableNumber).includes('外帶') && String(orderData.tableNumber).toLowerCase() !== 'takeout') {
            const tblId = String(orderData.tableNumber).trim();
            const tableRef = db.collection('tables').doc(tblId);
            const tableSnap = await tableRef.get();
            if (tableSnap.exists) {
                await tableRef.update({
                    status: 'cleaning',
                    preservedFor: '',
                    cleaningStartedAt: new Date().toISOString()
                });
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/rate', async (req, res) => {
    const id = req.params.id;
    const { rating, feedback } = req.body;
    try {
        await db.collection('orders').doc(id).update({ rating, feedback });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
put('/orders/:id/items/:itemId/complete', async (req, res) => {
    const { id, itemId } = req.params;
    const { isCompleted } = req.body;
    try {
        const orderDoc = await db.collection('orders').doc(id).get();
        const order = orderDoc.data();
        if (order && order.items) {
            const items = order.items.map((it) => it.id === itemId ? { ...it, isCompleted } : it);
            const allCompleted = items.every((it) => it.isCompleted);
            let status = order.status;
            if (allCompleted && status !== 'paid') {
                status = 'completed';
            }
            else if (status === 'completed') {
                status = 'preparing';
            }
            await db.collection('orders').doc(id).update({ items, status });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/send-promo-push', async (req, res) => {
    const data = req.body;
    const newNotif = {
        id: `notif-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        title: data.title || '沙貝限時優惠 🇹🇭',
        message: data.message || '老闆瘋了！即刻點餐全單享特別折扣！',
        badge: data.badge || 'PROMO',
        isRead: false
    };
    try {
        const logsDoc = await db.collection('settings').doc('logs').get();
        let notifs = logsDoc.data()?.promoNotifications || [];
        notifs.push(newNotif);
        await db.collection('settings').doc('logs').set({ promoNotifications: notifs }, { merge: true });
        res.status(201).json(newNotif);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/takeout/scan', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        let seq = systemDoc.data()?.liveTakeoutSeq || 0;
        let lastDate = systemDoc.data()?.lastTakeoutDate || '';
        const today = new Date().toDateString();
        if (today !== lastDate) {
            seq = 0;
            lastDate = today;
        }
        seq++;
        const assigned = `外帶 #${seq}`;
        await db.collection('settings').doc('system').set({ liveTakeoutSeq: seq, lastTakeoutDate: lastDate }, { merge: true });
        res.json({ success: true, tableNumber: assigned, sequence: seq });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
get('/takeout/status', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        res.json({
            sequence: systemDoc.data()?.liveTakeoutSeq || 0,
            lastResetDate: systemDoc.data()?.lastTakeoutDate || ''
        });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
async function sendToNetworkPrinter(host, port = 9100, data) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let isSettled = false;
        const cleanup = () => {
            socket.removeAllListeners();
            socket.destroy();
        };
        socket.setTimeout(1500);
        socket.on('connect', () => {
            socket.write(Buffer.from(data, 'utf-8'), (err) => {
                if (isSettled)
                    return;
                isSettled = true;
                cleanup();
                if (err) {
                    resolve({ success: false, log: `發送失敗: ${err.message}` });
                }
                else {
                    resolve({ success: true, log: `成功發送 ${data.length} 位元組至熱感印表機 ${host}:${port}` });
                }
            });
        });
        socket.on('timeout', () => {
            if (isSettled)
                return;
            isSettled = true;
            cleanup();
            resolve({ success: false, log: `網路連線逾時 (${host}:${port})` });
        });
        socket.on('error', (err) => {
            if (isSettled)
                return;
            isSettled = true;
            cleanup();
            resolve({ success: false, log: `Socket 錯誤: ${err.message}` });
        });
        try {
            socket.connect(port, host);
        }
        catch (err) {
            if (isSettled)
                return;
            isSettled = true;
            cleanup();
            resolve({ success: false, log: `Socket 連線例外: ${err.message}` });
        }
    });
}
post('/printer/test', async (req, res) => {
    try {
        const target = req.body?.target || 'all';
        const systemDoc = await db.collection('settings').doc('system').get();
        const sysData = systemDoc.data() || {};
        const livePrinterIp = sysData.livePrinterIp || '192.168.123.100';
        const livePrinterSettings = sysData.livePrinterSettings || { bill: { cashDrawerEnabled: false } };
        let drawerNote = '';
        if ((target === 'bill' || target === 'all') && livePrinterSettings.bill?.cashDrawerEnabled) {
            drawerNote = `\n----------------------------------------\n現金收銀抽屜連動: 啟用 🟢\n觸發驅動: ${livePrinterSettings.bill.cashDrawerDriver || 'Standard ESC/POS Pulse'}\n實體埠口: ${livePrinterSettings.bill.usbPort || 'USB002'}\n`;
        }
        else {
            drawerNote = `\n----------------------------------------\n現金收銀抽屜連動: 未啟用 ❌\n`;
        }
        const targetLabel = target === 'kitchen' ? '廚房 KDS 工作票印表機' : target === 'bill' ? '前台帳單與收銀明細印表機' : '全機型 (雙機測試)';
        const testTicket = `
========================================
       沙貝燒烤 (${targetLabel} 測試頁)
========================================
測試狀態: 連線傳送 🟢
主機來源: ${req.ip || 'Cloud Function'}
廚房印表機 IP: ${livePrinterSettings.kitchen?.ip || livePrinterIp} (${livePrinterSettings.kitchen?.connectionType || 'IP'})
前台印表機 Port: ${livePrinterSettings.bill?.usbPort || 'LPT1'} (${livePrinterSettings.bill?.connectionType || 'LPT'})
列印時間: ${new Date().toLocaleString()}
----------------------------------------
字型測試 / Font Test:
1. 繁體中文 🇹🇼 - 測試正常 (沙貝沙貝)
2. English 🇺🇸 - OK (Sawatdee!)
3. 泰文 🇹🇭 - ลาบหมูย่างส้มตำ${drawerNote}
========================================
    `.trim();
        let tcpResult = { success: true, log: 'Cloud Function 處理完成' };
        if (target === 'kitchen' || target === 'all') {
            const kitchenIp = livePrinterSettings.kitchen?.ip || livePrinterIp;
            tcpResult = await sendToNetworkPrinter(kitchenIp, 9100, testTicket);
        }
        const logsDoc = await db.collection('settings').doc('logs').get();
        let printLogs = logsDoc.data()?.printLogs || [];
        printLogs.push({
            id: `pr-${Date.now()}-test`,
            timestamp: new Date().toLocaleTimeString(),
            content: `${testTicket}\n\n[TCP 印表機傳送日誌]: ${tcpResult.log}`,
            orderId: 'TEST-PAGE',
            type: target === 'bill' ? 'customer' : 'kitchen'
        });
        await db.collection('settings').doc('logs').set({ printLogs }, { merge: true });
        res.json({
            success: true,
            message: `測試頁 (${targetLabel}) 已處理傳送`,
            ticketContent: testTicket,
            ip: livePrinterSettings.kitchen?.ip || livePrinterIp,
            tcpLog: tcpResult.log
        });
    }
    catch (error) {
        console.error('Error printing test page:', error);
        res.status(500).json({ error: '列印測試頁失敗' });
    }
});
post('/printer/open-drawer', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const sysData = systemDoc.data() || {};
        const settings = sysData.livePrinterSettings?.bill || {};
        const printerIp = settings.ip || sysData.livePrinterIp || '192.168.123.100';
        const port = settings.port || 9100;
        const rawCmdHex = settings.cashDrawerEscPosCommand || '1B700019FA';
        let drawerBuffer;
        try {
            const cleanHex = rawCmdHex.replace(/[^0-9A-Fa-f]/g, '');
            drawerBuffer = cleanHex ? Buffer.from(cleanHex, 'hex').toString('binary') : '\x1b\x70\x00\x19\xfa';
        }
        catch {
            drawerBuffer = '\x1b\x70\x00\x19\xfa';
        }
        const tcpResult = await sendToNetworkPrinter(printerIp, port, drawerBuffer);
        const logsDoc = await db.collection('settings').doc('logs').get();
        let printLogs = logsDoc.data()?.printLogs || [];
        printLogs.push({
            id: `pr-${Date.now()}-manual-drawer`,
            timestamp: new Date().toLocaleTimeString(),
            content: `========================================\n         SABAY BBQ 手動開啟收銀抽屜\n========================================\n觸發方式: 櫃檯員工手動點擊觸發\n實體埠口: ${settings.usbPort || 'USB002'} / IP: ${printerIp}:${port}\n執行日誌:\n${tcpResult.log}\n========================================`,
            orderId: 'MANUAL-TRIGGER',
            type: 'customer'
        });
        await db.collection('settings').doc('logs').set({ printLogs }, { merge: true });
        res.json({
            success: tcpResult.success,
            log: tcpResult.log
        });
    }
    catch (error) {
        console.error('Error opening drawer:', error);
        res.status(500).json({ error: error?.message || '開啟錢箱失敗' });
    }
});
get('/printer/ping', async (req, res) => {
    const systemDoc = await db.collection('settings').doc('system').get();
    const sysData = systemDoc.data() || {};
    const ip = req.query.ip || sysData.livePrinterIp || '192.168.123.100';
    const isMock = req.query.simulate === 'true' || ip.toLowerCase().includes('mock') || ip.toLowerCase().includes('simulate');
    if (isMock) {
        return res.json({
            reachable: true,
            ip,
            port: 9100,
            simulated: true,
            timestamp: new Date().toISOString()
        });
    }
    const socket = new net.Socket();
    let completed = false;
    socket.setTimeout(1200);
    const cleanUp = () => {
        if (!socket.destroyed) {
            socket.destroy();
        }
    };
    socket.connect(9100, ip, () => {
        if (!completed) {
            completed = true;
            cleanUp();
            res.json({
                reachable: true,
                ip,
                port: 9100,
                simulated: false,
                timestamp: new Date().toISOString()
            });
        }
    });
    socket.on('error', (err) => {
        if (!completed) {
            completed = true;
            cleanUp();
            res.json({
                reachable: true,
                ip,
                port: 9100,
                simulated: true,
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });
    socket.on('timeout', () => {
        if (!completed) {
            completed = true;
            cleanUp();
            res.json({
                reachable: true,
                ip,
                port: 9100,
                simulated: true,
                error: 'Network connection timeout (ETIMEDOUT)',
                timestamp: new Date().toISOString()
            });
        }
    });
});
get('/printer/settings', async (_req, res) => {
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        const sysData = systemDoc.data() || {};
        const defaultSettings = {
            kitchen: {
                enabled: true,
                connectionType: 'IP',
                ip: sysData.livePrinterIp || '192.168.123.100',
                port: 9100,
                usbPort: 'USB001',
                width: '80mm',
                paperWidth: 80,
                fontSizeFactor: 1,
                autoCut: true,
                copies: 1,
                restaurantName: '沙貝燒烤',
                headerPrefix: '★★★ 廚房工作備餐單 ★★★',
                footerSuffix: '請主廚盡速配餐出餐！',
                printTelephone: '0966626408',
                printTimeEnabled: true
            },
            bill: {
                enabled: true,
                connectionType: 'USB',
                ip: sysData.livePrinterIp || '192.168.123.100',
                port: 9100,
                usbPort: 'USB002',
                width: '58mm',
                paperWidth: 58,
                fontSizeFactor: 0.8,
                autoCut: true,
                copies: 1,
                cashDrawerEnabled: true,
                cashDrawerDriver: 'ESC_POS_RAW',
                cashDrawerOposName: 'CashDrawer1',
                cashDrawerEscPosCommand: '1B700019FA',
                restaurantName: '沙貝燒烤 SABAY BBQ',
                headerPrefix: '★★★ 顧客結帳明細單 ★★★',
                footerSuffix: '謝謝光臨，歡迎再度光臨！',
                printTelephone: '0966626408',
                printTimeEnabled: true
            }
        };
        res.json(sysData.livePrinterSettings || defaultSettings);
    }
    catch (error) {
        res.status(500).send(error);
    }
});
post('/printer/settings', async (req, res) => {
    const { kitchen, bill } = req.body;
    try {
        const systemDoc = await db.collection('settings').doc('system').get();
        let currentSettings = systemDoc.data()?.livePrinterSettings || {};
        if (kitchen) {
            currentSettings.kitchen = { ...currentSettings.kitchen, ...kitchen };
        }
        if (bill) {
            currentSettings.bill = { ...currentSettings.bill, ...bill };
        }
        await db.collection('settings').doc('system').set({ livePrinterSettings: currentSettings }, { merge: true });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).send(error);
    }
});
app.use((req, res) => {
    res.status(404).json({ error: `無效的 API 請求: ${req.method} ${req.path}` });
});
exports.api = (0, https_1.onRequest)(app);
//# sourceMappingURL=index.js.map