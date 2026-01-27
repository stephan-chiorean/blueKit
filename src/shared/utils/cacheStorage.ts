// Simple Promise-based wrapper for IndexedDB

const DB_NAME = 'bluekit-cache';
const STORE_NAME = 'variation-content';
const DB_VERSION = 1;

export interface CacheEntry {
    content: string;
    timestamp: number;
}

export interface JsonCacheEntry<T> {
    data: T;
    timestamp: number;
}

// Simple Promise-based wrapper for IndexedDB
class CacheStorage {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = (event) => {
                resolve((event.target as IDBOpenDBRequest).result);
            };

            request.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };
        });

        return this.dbPromise;
    }

    async get(key: string): Promise<CacheEntry | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache storage get error:', error);
            return null;
        }
    }

    async set(key: string, value: string, timestamp: number): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ content: value, timestamp }, key);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache storage set error:', error);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache storage delete error:', error);
        }
    }

    async clear(): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache storage clear error:', error);
        }
    }

    // JSON storage methods for collections and catalogs
    async getJson<T>(key: string): Promise<JsonCacheEntry<T> | null> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        resolve(result as JsonCacheEntry<T>);
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache storage getJson error:', error);
            return null;
        }
    }

    async setJson<T>(key: string, data: T, timestamp: number): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ data, timestamp }, key);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache storage setJson error:', error);
        }
    }
}

export const cacheStorage = new CacheStorage();
