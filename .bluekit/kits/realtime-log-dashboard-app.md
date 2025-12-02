---
id: realtime-log-dashboard-app
alias: Real-time Log Dashboard App
type: kit
is_base: false
version: 1
tags: ['monitoring', 'logging', 'real-time']
description: A standalone dashboard application for monitoring logs, errors, and health metrics from multiple applications in real-time via WebSocket or Server-Sent Events
---

# Real-time Log Dashboard App

A production-grade, standalone monitoring dashboard that receives and displays logs, errors, and health metrics from any application in real-time. Built to be generic and protocol-agnostic, supporting WebSocket, Server-Sent Events (SSE), or HTTP polling.

## Overview

This kit creates a complete monitoring dashboard application with:
- **Real-time log streaming** - WebSocket/SSE support
- **Multiple app support** - Monitor several applications simultaneously
- **Filtering & search** - By app, level, timestamp, content
- **Error tracking** - Dedicated error view with stack traces
- **Health monitoring** - Service health checks and uptime
- **Persistence** - Local SQLite database for log history
- **Export** - Export logs as JSON/CSV
- **Alerts** - Browser notifications for critical errors

## Technology Stack

**Frontend:**
- React + TypeScript
- Chakra UI for components
- TanStack Query for data fetching
- WebSocket API / EventSource for real-time
- IndexedDB for client-side caching

**Backend (Optional - can be standalone or embedded):**
- Node.js + Express OR Tauri (Rust)
- WebSocket server (ws library or Tauri events)
- SQLite for log storage
- REST API for queries

**Deployment Modes:**
1. **Standalone Web App** - Deployed separately, apps connect via WebSocket
2. **Tauri Desktop App** - Cross-platform desktop application
3. **Embedded Dashboard** - Import as component into existing app

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Log Dashboard App                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Live Logs    │  │ Error View   │  │ Health View  │      │
│  │ - Filter     │  │ - Stack      │  │ - Uptime     │      │
│  │ - Search     │  │ - Grouping   │  │ - Metrics    │      │
│  │ - Export     │  │ - Trends     │  │ - Alerts     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                  ↓                  ↓              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        WebSocket/SSE Client Connection Manager       │    │
│  │  - Auto-reconnect                                    │    │
│  │  - Multiple source support                           │    │
│  │  - Connection health monitoring                      │    │
│  └─────────────────────────────────────────────────────┘    │
│         ↓                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              IndexedDB Cache Layer                   │    │
│  │  - Recent logs (last 1000)                           │    │
│  │  - Offline viewing                                   │    │
│  │  - Quick search                                      │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js/Tauri - Optional)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ WebSocket    │  │ REST API     │  │ SQLite DB    │      │
│  │ Server       │  │ /logs        │  │ - Log store  │      │
│  │ - Broadcast  │  │ /health      │  │ - Queries    │      │
│  │ - Filtering  │  │ /export      │  │ - History    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑
         │                    │
    WebSocket/SSE         HTTP POST
         │                    │
┌────────┴────────────────────┴─────────┐
│       External Applications            │
│  - App A (Node.js + Winston)          │
│  - App B (Rust + tracing)             │
│  - App C (Python + logging)           │
└────────────────────────────────────────┘
```

## Installation & Setup

### Option 1: Standalone Web App (Recommended)

```bash
# Create new project
npx create-react-app {{PROJECT_NAME}}-dashboard --template typescript
cd {{PROJECT_NAME}}-dashboard

# Install dependencies
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
npm install @tanstack/react-query
npm install date-fns
npm install recharts  # For charts
npm install dexie     # IndexedDB wrapper

# Install backend dependencies (if using Node.js backend)
npm install express ws cors sqlite3
npm install --save-dev @types/express @types/ws @types/cors
```

### Option 2: Tauri Desktop App

```bash
# Create Tauri app
npm create tauri-app@latest {{PROJECT_NAME}}-dashboard
cd {{PROJECT_NAME}}-dashboard

# Install frontend dependencies (same as above)
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
npm install @tanstack/react-query date-fns recharts dexie

# Backend is Rust (Tauri) - no additional npm packages needed
```

## File Structure

```
{{PROJECT_NAME}}-dashboard/
├── src/
│   ├── components/
│   │   ├── LogViewer/
│   │   │   ├── LogTable.tsx           # Main log table component
│   │   │   ├── LogRow.tsx             # Individual log row
│   │   │   ├── LogFilters.tsx         # Filter controls
│   │   │   └── LogSearch.tsx          # Search functionality
│   │   ├── ErrorDashboard/
│   │   │   ├── ErrorList.tsx          # Error listing
│   │   │   ├── ErrorDetail.tsx        # Stack trace viewer
│   │   │   └── ErrorStats.tsx         # Error statistics
│   │   ├── HealthMonitor/
│   │   │   ├── ServiceStatus.tsx      # Service health cards
│   │   │   ├── UptimeChart.tsx        # Uptime visualization
│   │   │   └── MetricsPanel.tsx       # Key metrics display
│   │   └── ConnectionManager/
│   │       ├── ConnectionStatus.tsx   # Connection indicator
│   │       ├── SourceSelector.tsx     # Multi-app selector
│   │       └── ReconnectButton.tsx    # Manual reconnect
│   ├── hooks/
│   │   ├── useWebSocket.ts            # WebSocket connection hook
│   │   ├── useLogStream.ts            # Log streaming logic
│   │   ├── useLogDatabase.ts          # IndexedDB operations
│   │   └── useNotifications.ts        # Browser notifications
│   ├── services/
│   │   ├── websocket.ts               # WebSocket client
│   │   ├── logDatabase.ts             # IndexedDB wrapper
│   │   ├── logExporter.ts             # Export utilities
│   │   └── api.ts                     # REST API client
│   ├── types/
│   │   ├── log.ts                     # Log entry types
│   │   ├── health.ts                  # Health status types
│   │   └── connection.ts              # Connection types
│   ├── utils/
│   │   ├── logFormatter.ts            # Log formatting
│   │   ├── logParser.ts               # Parse various formats
│   │   └── logFilter.ts               # Filtering logic
│   ├── App.tsx                        # Main app component
│   └── main.tsx                       # Entry point
├── server/ (Optional - for standalone backend)
│   ├── index.ts                       # Express server
│   ├── websocket.ts                   # WebSocket server
│   ├── database.ts                    # SQLite connection
│   └── routes/
│       ├── logs.ts                    # Log endpoints
│       └── health.ts                  # Health endpoints
└── package.json
```

## Core Implementation

### 1. Log Entry Type Definition

**File:** `src/types/log.ts`

```typescript
/**
 * Universal log entry structure
 * Compatible with Winston, Pino, Bunyan, tracing, Python logging, etc.
 */
export interface LogEntry {
  /** Unique ID for this log entry */
  id: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Log level (trace, debug, info, warn, error, fatal) */
  level: LogLevel;

  /** Source application identifier */
  appId: string;

  /** Application name for display */
  appName: string;

  /** Log message */
  message: string;

  /** Optional structured metadata */
  metadata?: Record<string, unknown>;

  /** Stack trace (for errors) */
  stackTrace?: string;

  /** Source file/module */
  source?: string;

  /** Function/method name */
  function?: string;

  /** Line number */
  line?: number;

  /** Correlation ID for request tracing */
  correlationId?: string;

  /** User ID (if applicable) */
  userId?: string;

  /** Environment (dev, staging, prod) */
  environment?: string;
}

export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal';

export interface HealthStatus {
  appId: string;
  appName: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number; // seconds
  lastHeartbeat: string; // ISO 8601
  metrics?: {
    memoryUsage?: number;
    cpuUsage?: number;
    errorRate?: number;
    requestRate?: number;
  };
}
```

### 2. WebSocket Client Hook

**File:** `src/hooks/useWebSocket.ts`

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  url,
  reconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectCount(0);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onDisconnect?.();

        // Auto-reconnect
        if (reconnect && reconnectCount < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);
            setReconnectCount(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [url, reconnect, reconnectInterval, maxReconnectAttempts, reconnectCount, onMessage, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return {
    isConnected,
    reconnectCount,
    send,
    connect,
    disconnect,
  };
}
```

### 3. Log Streaming Hook

**File:** `src/hooks/useLogStream.ts`

```typescript
import { useState, useCallback } from 'react';
import { LogEntry, LogLevel } from '../types/log';
import { useWebSocket } from './useWebSocket';

const MAX_LOGS_IN_MEMORY = 1000;

interface UseLogStreamOptions {
  websocketUrl: string;
  appId?: string; // Filter by app ID
  levelFilter?: LogLevel[];
}

export function useLogStream({
  websocketUrl,
  appId,
  levelFilter,
}: UseLogStreamOptions) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const handleMessage = useCallback((data: unknown) => {
    if (isPaused) return;

    const logEntry = data as LogEntry;

    // Apply filters
    if (appId && logEntry.appId !== appId) return;
    if (levelFilter && !levelFilter.includes(logEntry.level)) return;

    setLogs(prev => {
      const newLogs = [logEntry, ...prev];
      // Keep only recent logs in memory
      return newLogs.slice(0, MAX_LOGS_IN_MEMORY);
    });
  }, [isPaused, appId, levelFilter]);

  const { isConnected, reconnectCount, send } = useWebSocket({
    url: websocketUrl,
    onMessage: handleMessage,
  });

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  return {
    logs,
    isConnected,
    reconnectCount,
    isPaused,
    clearLogs,
    togglePause,
    send,
  };
}
```

### 4. IndexedDB Log Database

**File:** `src/services/logDatabase.ts`

```typescript
import Dexie, { Table } from 'dexie';
import { LogEntry } from '../types/log';

class LogDatabase extends Dexie {
  logs!: Table<LogEntry, string>;

  constructor() {
    super('LogDashboard');

    this.version(1).stores({
      logs: 'id, timestamp, level, appId, appName',
    });
  }

  async addLog(log: LogEntry) {
    await this.logs.add(log);
  }

  async addLogs(logs: LogEntry[]) {
    await this.logs.bulkAdd(logs);
  }

  async getLogs(options: {
    appId?: string;
    level?: string[];
    startTime?: string;
    endTime?: string;
    limit?: number;
  }) {
    let query = this.logs.orderBy('timestamp').reverse();

    if (options.appId) {
      query = query.filter(log => log.appId === options.appId);
    }

    if (options.level) {
      query = query.filter(log => options.level!.includes(log.level));
    }

    if (options.startTime) {
      query = query.filter(log => log.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      query = query.filter(log => log.timestamp <= options.endTime!);
    }

    if (options.limit) {
      return await query.limit(options.limit).toArray();
    }

    return await query.toArray();
  }

  async clearOldLogs(olderThanDays: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    await this.logs.where('timestamp').below(cutoffISO).delete();
  }

  async searchLogs(query: string) {
    return await this.logs
      .filter(log =>
        log.message.toLowerCase().includes(query.toLowerCase()) ||
        log.appName.toLowerCase().includes(query.toLowerCase())
      )
      .toArray();
  }
}

export const logDB = new LogDatabase();
```

### 5. Main Log Viewer Component

**File:** `src/components/LogViewer/LogViewer.tsx`

```typescript
import { useState, useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Input,
  Select,
  Button,
  Icon,
  Text,
  Code,
} from '@chakra-ui/react';
import { LuPause, LuPlay, LuTrash2, LuDownload } from 'react-icons/lu';
import { useLogStream } from '../../hooks/useLogStream';
import { LogLevel } from '../../types/log';
import { format } from 'date-fns';

const WEBSOCKET_URL = '{{WEBSOCKET_URL}}'; // Replace with actual URL

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: 'gray',
  debug: 'blue',
  info: 'green',
  warn: 'yellow',
  error: 'red',
  fatal: 'purple',
};

export default function LogViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');

  const {
    logs,
    isConnected,
    isPaused,
    clearLogs,
    togglePause,
  } = useLogStream({
    websocketUrl: WEBSOCKET_URL,
    appId: selectedApp || undefined,
    levelFilter: levelFilter.length > 0 ? levelFilter : undefined,
  });

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;

    const query = searchQuery.toLowerCase();
    return logs.filter(log =>
      log.message.toLowerCase().includes(query) ||
      log.appName.toLowerCase().includes(query) ||
      log.source?.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  const uniqueApps = useMemo(() => {
    const apps = new Set(logs.map(log => log.appId));
    return Array.from(apps);
  }, [logs]);

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString()}.json`;
    link.click();
  };

  return (
    <VStack align="stretch" h="100vh" gap={0}>
      {/* Header */}
      <Box bg="bg.surface" borderBottom="1px" borderColor="border.base" p={4}>
        <HStack justify="space-between">
          <HStack gap={4}>
            <Badge colorScheme={isConnected ? 'green' : 'red'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Text color="text.secondary" fontSize="sm">
              {filteredLogs.length} logs
            </Text>
          </HStack>

          <HStack gap={2}>
            <Button
              size="sm"
              variant="ghost"
              onClick={togglePause}
              leftIcon={<Icon>{isPaused ? <LuPlay /> : <LuPause />}</Icon>}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearLogs}
              leftIcon={<Icon><LuTrash2 /></Icon>}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExport}
              leftIcon={<Icon><LuDownload /></Icon>}
            >
              Export
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Filters */}
      <Box bg="bg.subtle" borderBottom="1px" borderColor="border.base" p={4}>
        <HStack gap={4}>
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            flex={1}
          />
          <Select
            placeholder="All apps"
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            w="200px"
          >
            {uniqueApps.map(appId => (
              <option key={appId} value={appId}>{appId}</option>
            ))}
          </Select>
          <Select
            placeholder="All levels"
            onChange={(e) => {
              const value = e.target.value;
              setLevelFilter(value ? [value as LogLevel] : []);
            }}
            w="150px"
          >
            <option value="trace">Trace</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
          </Select>
        </HStack>
      </Box>

      {/* Log Table */}
      <Box flex={1} overflow="auto">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader w="180px">Timestamp</Table.ColumnHeader>
              <Table.ColumnHeader w="80px">Level</Table.ColumnHeader>
              <Table.ColumnHeader w="150px">App</Table.ColumnHeader>
              <Table.ColumnHeader>Message</Table.ColumnHeader>
              <Table.ColumnHeader w="200px">Source</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredLogs.map((log) => (
              <Table.Row key={log.id}>
                <Table.Cell>
                  <Text fontSize="xs" fontFamily="mono">
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge colorScheme={LEVEL_COLORS[log.level]} size="sm">
                    {log.level.toUpperCase()}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="sm">{log.appName}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Code fontSize="sm" colorScheme={log.level === 'error' || log.level === 'fatal' ? 'red' : undefined}>
                    {log.message}
                  </Code>
                  {log.stackTrace && (
                    <Box mt={2} p={2} bg="bg.subtle" borderRadius="sm">
                      <Code fontSize="xs" whiteSpace="pre-wrap">
                        {log.stackTrace}
                      </Code>
                    </Box>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Text fontSize="xs" color="text.secondary" fontFamily="mono">
                    {log.source}
                    {log.line && `:${log.line}`}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </VStack>
  );
}
```

### 6. Backend WebSocket Server (Node.js)

**File:** `server/websocket.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { LogEntry } from '../src/types/log';

export function createWebSocketServer(port: number = 8080) {
  const wss = new WebSocketServer({ port });

  console.log(`WebSocket server listening on port ${port}`);

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('New client connected');
    clients.add(ws);

    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast log to all connected clients
  function broadcastLog(log: LogEntry) {
    const message = JSON.stringify(log);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  return {
    wss,
    broadcastLog,
  };
}
```

### 7. REST API for Log Ingestion

**File:** `server/routes/logs.ts`

```typescript
import { Router } from 'express';
import { LogEntry } from '../../src/types/log';

export function createLogsRouter(broadcastLog: (log: LogEntry) => void) {
  const router = Router();

  // Receive log via HTTP POST
  router.post('/logs', (req, res) => {
    const log: LogEntry = req.body;

    // Validate log entry
    if (!log.timestamp || !log.level || !log.message || !log.appId) {
      return res.status(400).json({ error: 'Invalid log entry' });
    }

    // Broadcast to WebSocket clients
    broadcastLog(log);

    // TODO: Save to SQLite database

    res.status(201).json({ success: true });
  });

  // Batch endpoint for multiple logs
  router.post('/logs/batch', (req, res) => {
    const logs: LogEntry[] = req.body;

    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'Expected array of log entries' });
    }

    logs.forEach(log => broadcastLog(log));

    res.status(201).json({ success: true, count: logs.length });
  });

  return router;
}
```

## Configuration

Create a configuration file for connection settings:

**File:** `src/config.ts`

```typescript
export const config = {
  // WebSocket URL - update based on deployment
  websocketUrl: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080',

  // HTTP API URL
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8080/api',

  // Max logs in memory
  maxLogsInMemory: 1000,

  // IndexedDB retention (days)
  logRetentionDays: 7,

  // Auto-reconnect settings
  reconnect: {
    enabled: true,
    interval: 3000,
    maxAttempts: 10,
  },
};
```

## Deployment

### Development
```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
npm start
```

### Production
```bash
# Build frontend
npm run build

# Serve static files + WebSocket server
# Or deploy to Vercel/Netlify + separate WebSocket server
```

## Customization Tokens

| Token | Description | Example |
|-------|-------------|---------|
| `{{PROJECT_NAME}}` | Dashboard project name | `my-app-logs` |
| `{{WEBSOCKET_URL}}` | WebSocket server URL | `ws://localhost:8080` |
| `{{API_URL}}` | REST API URL | `http://localhost:8080/api` |
| `{{PORT}}` | Server port | `8080` |

## Future Enhancements

- [ ] **Alerting rules** - Custom alert conditions
- [ ] **Log aggregation** - Group similar logs
- [ ] **Performance metrics** - Charts and graphs
- [ ] **Multi-user support** - Authentication and permissions
- [ ] **Export formats** - CSV, PDF reports
- [ ] **Query language** - Advanced filtering
- [ ] **Dark mode** - Theme support

## Integration

See the companion kit **"Log Producer Integration Kit"** for instructions on connecting your applications to this dashboard.
