---
id: indexeddb-caching-architecture
alias: Client-Side Caching with IndexedDB
type: walkthrough
is_base: false
version: 1
tags:
  - architecture
  - persistent-storage
  - performance
description: In-depth look at how BlueKit leverages IndexedDB for persistent caching of library content.
complexity: moderate
format: architecture
---
# Client-Side Caching with IndexedDB

BlueKit employs a client-side caching strategy to improve the performance of the Library, particularly for fetching large markdown content. This walkthrough explains the architecture of our persistent caching layer.

## Overview

The caching system is built on two primary layers:
1.  **Memory Cache (React State)**: For lightweight list data (catalogs, folders, collections). Fast but ephemeral.
2.  **Persistent Cache (IndexedDB)**: For heavy content queries (variation markdown). Slower than memory but persists across page reloads and app restarts.

## IndexedDB Implementation

We do not use a third-party library like `idb` or `kvs`. Instead, we use a lightweight, custom `Promise`-based wrapper around the native `IndexedDB` API.

### The Wrapper (`cacheStorage.ts`)

The `CacheStorage` class provides a simple key-value interface (`get`, `set`, `delete`, `clear`) backed by an object store.

-   **DB Name**: `bluekit-cache`
-   **Store Name**: `variation-content`
-   **Key**: The absolute path of the variation file (string).
-   **Value**: An object `{ content: string, timestamp: number }`.

### The Context (`LibraryCacheContext.tsx`)

The `LibraryCacheProvider` manages access to this storage. It acts as the high-level API for the rest of the application.

#### Content Cache Logic
-   **TTL**: 24 hours (`24 * 60 * 60 * 1000` ms).
-   **Read Strategy**:
    1.  Check IndexedDB for the given path.
    2.  If found:
        -   Check age (`Date.now() - timestamp`).
        -   If valid (< 24h), return content.
        -   If expired, delete from DB and return `null` (updates occur lazily).
    3.  If not found, return `null`.

#### Write Strategy
-   Writes are "write-through" from the perspective of the fetcher component. When content is fetched from the backend (GitHub/Network), the component calls `setCachedVariationContent`.
-   The context saves the content + current timestamp to IndexedDB.

## Usage in Components

Components consume this via the `useLibraryCache` hook.

```typescript
const { getCachedVariationContent, setCachedVariationContent } = useLibraryCache();

// Reading
const cached = await getCachedVariationContent(path);
if (cached) {
  setContent(cached);
  return;
}

// Fetching & Saving
const fetchedContent = await fetchContent(path);
setCachedVariationContent(path, fetchedContent);
```

## Benefits
-   **Reduced Latency**: Instant loading for previously viewed variations.
-   **Bandwidth Savings**: Prevents redundant network requests for static content.
-   **Offline Readiness**: Lays the groundwork for offline viewing of cached items.
