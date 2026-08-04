// Safe localStorage and sessionStorage wrapper to prevent crash in sandboxed iframes or environments with disabled storage
class SafeStorage implements Storage {
  private memStore: Record<string, string> = {};
  private isAvailable: boolean;
  private storageType: 'localStorage' | 'sessionStorage';

  constructor(type: 'localStorage' | 'sessionStorage' = 'localStorage') {
    this.storageType = type;
    this.isAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    try {
      const storage = window[this.storageType];
      if (!storage) return false;
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn(
        `[SafeStorage] ${this.storageType} is not available (likely sandboxed iframe or disabled). Falling back to in-memory store.`,
      );
      return false;
    }
  }

  get length(): number {
    if (this.isAvailable) {
      try {
        return window[this.storageType].length;
      } catch (e) {
        return Object.keys(this.memStore).length;
      }
    }
    return Object.keys(this.memStore).length;
  }

  clear(): void {
    if (this.isAvailable) {
      try {
        window[this.storageType].clear();
      } catch (e) {
        // Fallback
      }
    }
    this.memStore = {};
  }

  getItem(key: string): string | null {
    if (this.isAvailable) {
      try {
        return window[this.storageType].getItem(key);
      } catch (e) {
        return this.memStore[key] || null;
      }
    }
    return this.memStore[key] || null;
  }

  key(index: number): string | null {
    if (this.isAvailable) {
      try {
        return window[this.storageType].key(index);
      } catch (e) {
        const keys = Object.keys(this.memStore);
        return keys[index] || null;
      }
    }
    const keys = Object.keys(this.memStore);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    if (this.isAvailable) {
      try {
        window[this.storageType].removeItem(key);
      } catch (e) {
        // Fallback
      }
    }
    delete this.memStore[key];
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable) {
      try {
        window[this.storageType].setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.memStore[key] = String(value);
  }
}

export const safeStorage = new SafeStorage('localStorage');
export const safeSessionStorage = new SafeStorage('sessionStorage');
