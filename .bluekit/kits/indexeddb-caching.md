---
id: indexeddb-caching
alias: IndexedDB Persistent Caching
type: kit
is_base: false
version: 1
tags:
  - caching
  - storage
  - performance
description: A lightweight, persistent caching layer using IndexedDB for storing large objects and files in the browser
---
# IndexedDB Persistent Caching Kit

## End State

After applying this kit, the application will have:

**Persistent Storage Layer:**
- A lightweight wrapper around the browser's `IndexedDB` API
- Support for storing large strings, JSON objects, or Blobs that exceed `localStorage` limits
- Asynchronous `get`, `set`, `delete`, and `clear` operations
- No external dependencies (pure browser API)

**Caching Logic:**
- A mechanism to cache expensive network responses (e.g., file content, large datasets)
- Configurable Time-To-Live (TTL) for cache validity
- Fallback to network on cache miss or expiration
- Persistence across browser sessions and app restarts

**Interfaces available to downstream code:**
- `cacheStorage.get(key): Promise<CacheEntry | null>`
- `cacheStorage.set(key, value, timestamp): Promise<void>`
- `cacheStorage.delete(key): Promise<void>`
- `cacheStorage.clear(): Promise<void>`

**Performance guarantees:**
- Non-blocking I/O (runs on separate thread)
- "Instant" load times for previously visited content
- Reduced network bandwidth usage

## Implementation Principles

- **Use IndexedDB, not localStorage**: For large content (files, markdown, large JSON), localStorage is blocking and has small quotas (5MB). IndexedDB is async and handles hundreds of MBs.
- **Lazy connection**: Open the database connection only when the first request is made.
- **Graceful degradation**: Handle errors quietly (e.g., if private browsing disables IDB) and fall back to network.
- **Time-based expiry**: Store a timestamp with every entry and check it on retrieval. Deleting expired items lazily is preferred over background cleanup tasks.

## Verification Criteria

After generation, verify:
- ✓ `cacheStorage.set` successfully stores data in the browser's IndexedDB (verifiable via DevTools -> Application -> IndexedDB)
- ✓ `cacheStorage.get` retrieves data correctly after a page reload
- ✓ Data expires after the configured TTL
- ✓ Application loads cached content instantly without network requests
- ✓ "Clear Cache" or similar user actions successfully wipe the IndexedDB store

## Interface Contracts

**Provides:**
- Utility: `cacheStorage` singleton or class
- Types: `CacheEntry` interface

**Requires:**
- Browser environment (window.indexedDB)

**Compatible With:**
- **React Context**: Can be wrapped in a Context Provider for global access
- **Service Workers**: Can be accessed by service workers for offline-first capabilities
- **TanStack Query**: can be used as a custom persister
