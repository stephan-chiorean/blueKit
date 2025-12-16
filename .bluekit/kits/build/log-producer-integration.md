---
id: log-producer-integration
alias: Log Producer Integration
type: kit
is_base: false
version: 1
tags: ['logging', 'integration', 'monitoring']
description: Hook any application into the real-time log dashboard by integrating with WebSocket, HTTP, or file-based log streaming
---

# Log Producer Integration

Integrate any application with the Real-time Log Dashboard to send logs, errors, and health metrics. This kit provides universal patterns and code examples for multiple languages and frameworks.

## Overview

This kit shows you how to:
- **Send logs to the dashboard** from any application
- **Use multiple transport methods** - WebSocket, HTTP POST, or file watching
- **Integrate with popular logging frameworks** - Winston, Bunyan, tracing, Python logging, etc.
- **Format logs correctly** for dashboard compatibility
- **Handle connection failures** gracefully with retry logic

## Universal Log Format

All logs sent to the dashboard must follow this JSON structure:

```json
{
  "timestamp": "2025-12-01T10:30:45.123Z",
  "level": "INFO" | "DEBUG" | "WARN" | "ERROR" | "FATAL",
  "app_id": "my-app",
  "message": "User logged in successfully",
  "context": {
    "user_id": "12345",
    "session_id": "abc-def-ghi",
    "custom_field": "any value"
  },
  "stack_trace": "Error: Something failed\n  at Function.foo (file.js:10:5)\n  ...",
  "tags": ["auth", "security"]
}
```

**Required fields:**
- `timestamp` - ISO 8601 format
- `level` - One of: DEBUG, INFO, WARN, ERROR, FATAL
- `app_id` - Unique identifier for your application
- `message` - Human-readable log message

**Optional fields:**
- `context` - Arbitrary JSON object with structured data
- `stack_trace` - Stack trace for errors (string)
- `tags` - Array of strings for categorization

## Integration Methods

### Method 1: WebSocket (Recommended for Real-time)

**Best for:** High-frequency logs, real-time monitoring, bidirectional communication

**Connection:**
```
ws://localhost:9000/logs
```

**Authentication:**
```json
{
  "type": "auth",
  "app_id": "my-app",
  "api_key": "optional-secret-key"
}
```

**Sending logs:**
```json
{
  "type": "log",
  "data": {
    "timestamp": "2025-12-01T10:30:45.123Z",
    "level": "INFO",
    "app_id": "my-app",
    "message": "Application started"
  }
}
```

### Method 2: HTTP POST

**Best for:** Batch logging, intermittent connections, simple integration

**Endpoint:**
```
POST http://localhost:9000/api/logs
Content-Type: application/json
Authorization: Bearer <api-key>
```

**Single log:**
```json
{
  "timestamp": "2025-12-01T10:30:45.123Z",
  "level": "ERROR",
  "app_id": "my-app",
  "message": "Database connection failed",
  "context": {
    "error_code": "ECONNREFUSED",
    "host": "localhost:5432"
  }
}
```

**Batch logs:**
```json
{
  "logs": [
    { "timestamp": "...", "level": "INFO", ... },
    { "timestamp": "...", "level": "WARN", ... }
  ]
}
```

### Method 3: File Watching

**Best for:** Legacy applications, minimal code changes

Configure the dashboard to watch a log file:

**Dashboard config (dashboard.config.json):**
```json
{
  "file_watchers": [
    {
      "app_id": "legacy-app",
      "file_path": "/var/log/my-app/app.log",
      "format": "json",
      "tail": true
    }
  ]
}
```

**Your app writes to file:**
```javascript
// Just write JSON logs to a file
fs.appendFileSync('/var/log/my-app/app.log', JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  app_id: 'legacy-app',
  message: 'Something happened'
}) + '\n');
```

## Language-Specific Integrations

### Node.js + Winston

**Install:**
```bash
npm install winston winston-transport ws
```

**Create custom transport:**

```typescript
// src/logging/DashboardTransport.ts
import Transport from 'winston-transport';
import WebSocket from 'ws';

interface DashboardTransportOptions extends Transport.TransportStreamOptions {
  dashboardUrl: string;
  appId: string;
  apiKey?: string;
}

export class DashboardTransport extends Transport {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private dashboardUrl: string;
  private appId: string;
  private apiKey?: string;

  constructor(options: DashboardTransportOptions) {
    super(options);
    this.dashboardUrl = options.dashboardUrl;
    this.appId = options.appId;
    this.apiKey = options.apiKey;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.dashboardUrl);

    this.ws.on('open', () => {
      console.log('[DashboardTransport] Connected to log dashboard');

      // Authenticate
      if (this.apiKey) {
        this.ws?.send(JSON.stringify({
          type: 'auth',
          app_id: this.appId,
          api_key: this.apiKey,
        }));
      }
    });

    this.ws.on('close', () => {
      console.log('[DashboardTransport] Disconnected, reconnecting in 5s...');
      setTimeout(() => this.connect(), this.reconnectInterval);
    });

    this.ws.on('error', (err) => {
      console.error('[DashboardTransport] WebSocket error:', err);
    });
  }

  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    const logEntry = {
      type: 'log',
      data: {
        timestamp: new Date().toISOString(),
        level: info.level.toUpperCase(),
        app_id: this.appId,
        message: info.message,
        context: info.context || {},
        stack_trace: info.stack,
        tags: info.tags || [],
      },
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(logEntry));
    }

    callback();
  }
}
```

**Use in your app:**

```typescript
// src/logging/logger.ts
import winston from 'winston';
import { DashboardTransport } from './DashboardTransport';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console output
    new winston.transports.Console(),

    // Dashboard output
    new DashboardTransport({
      dashboardUrl: 'ws://localhost:9000/logs',
      appId: 'my-node-app',
      apiKey: process.env.DASHBOARD_API_KEY,
    }),
  ],
});

export default logger;
```

**Usage:**

```typescript
import logger from './logging/logger';

logger.info('User logged in', {
  context: { user_id: '12345', ip: '192.168.1.1' },
  tags: ['auth'],
});

logger.error('Payment failed', {
  context: { order_id: 'ORD-789', amount: 49.99 },
  tags: ['payment', 'critical'],
});
```

### Rust + tracing

**Add dependencies to Cargo.toml:**
```toml
[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json"] }
tokio-tungstenite = "0.21"
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
```

**Create custom layer:**

```rust
// src/logging/dashboard_layer.rs
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::{Context, Layer};
use tokio::sync::mpsc;
use std::sync::Arc;

pub struct DashboardLayer {
    app_id: String,
    log_sender: mpsc::UnboundedSender<serde_json::Value>,
}

impl DashboardLayer {
    pub fn new(dashboard_url: &str, app_id: String) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let url = dashboard_url.to_string();
        let app_id_clone = app_id.clone();

        // Spawn WebSocket sender task
        tokio::spawn(async move {
            loop {
                match connect_async(&url).await {
                    Ok((ws_stream, _)) => {
                        tracing::info!("Connected to log dashboard");
                        let (mut write, _read) = ws_stream.split();

                        // Send auth
                        let auth_msg = json!({
                            "type": "auth",
                            "app_id": app_id_clone,
                        });
                        let _ = write.send(Message::Text(auth_msg.to_string())).await;

                        // Forward logs from channel to WebSocket
                        while let Some(log_entry) = rx.recv().await {
                            let msg = json!({
                                "type": "log",
                                "data": log_entry,
                            });
                            if write.send(Message::Text(msg.to_string())).await.is_err() {
                                break; // Connection closed
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to connect to dashboard: {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });

        Self {
            app_id,
            log_sender: tx,
        }
    }
}

impl<S: Subscriber> Layer<S> for DashboardLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let metadata = event.metadata();

        let log_entry = json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "level": metadata.level().to_string().to_uppercase(),
            "app_id": self.app_id,
            "message": format!("{:?}", event),
            "context": {
                "target": metadata.target(),
                "file": metadata.file(),
                "line": metadata.line(),
            },
        });

        let _ = self.log_sender.send(log_entry);
    }
}
```

**Initialize in main.rs:**

```rust
use tracing_subscriber::prelude::*;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() {
    // Initialize logging with dashboard layer
    let dashboard_layer = DashboardLayer::new(
        "ws://localhost:9000/logs",
        "my-rust-app".to_string(),
    );

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(fmt::layer()) // Console output
        .with(dashboard_layer) // Dashboard output
        .init();

    tracing::info!("Application starting...");

    // Your app code here
}
```

### Python + logging

**Install:**
```bash
pip install websocket-client
```

**Create custom handler:**

```python
# logging_config.py
import logging
import json
import websocket
import threading
from datetime import datetime
from queue import Queue, Empty

class DashboardHandler(logging.Handler):
    def __init__(self, dashboard_url, app_id, api_key=None):
        super().__init__()
        self.dashboard_url = dashboard_url
        self.app_id = app_id
        self.api_key = api_key
        self.queue = Queue()
        self.ws = None

        # Start background thread for WebSocket
        self.thread = threading.Thread(target=self._run_websocket, daemon=True)
        self.thread.start()

    def _run_websocket(self):
        while True:
            try:
                self.ws = websocket.WebSocketApp(
                    self.dashboard_url,
                    on_open=self._on_open,
                    on_error=self._on_error,
                    on_close=self._on_close
                )
                self.ws.run_forever()
            except Exception as e:
                print(f"WebSocket error: {e}")
                import time
                time.sleep(5)

    def _on_open(self, ws):
        print("Connected to log dashboard")

        # Authenticate
        if self.api_key:
            auth_msg = json.dumps({
                'type': 'auth',
                'app_id': self.app_id,
                'api_key': self.api_key
            })
            ws.send(auth_msg)

        # Start sending queued logs
        threading.Thread(target=self._send_logs, daemon=True).start()

    def _on_error(self, ws, error):
        print(f"WebSocket error: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        print("Disconnected from log dashboard")

    def _send_logs(self):
        while self.ws and self.ws.sock and self.ws.sock.connected:
            try:
                log_entry = self.queue.get(timeout=1)
                msg = json.dumps({
                    'type': 'log',
                    'data': log_entry
                })
                self.ws.send(msg)
            except Empty:
                continue
            except Exception as e:
                print(f"Error sending log: {e}")

    def emit(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'app_id': self.app_id,
            'message': self.format(record),
            'context': {
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno,
            },
        }

        if record.exc_info:
            log_entry['stack_trace'] = self.formatter.formatException(record.exc_info)

        self.queue.put(log_entry)

def setup_logging(app_id, dashboard_url='ws://localhost:9000/logs'):
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    logger.addHandler(console_handler)

    # Dashboard handler
    dashboard_handler = DashboardHandler(dashboard_url, app_id)
    dashboard_handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(dashboard_handler)

    return logger
```

**Use in your app:**

```python
# main.py
from logging_config import setup_logging
import logging

logger = setup_logging('my-python-app')

logger.info('Application started')
logger.warning('Cache miss', extra={
    'context': {'cache_key': 'user:12345'}
})

try:
    result = 1 / 0
except Exception:
    logger.exception('Division by zero error')
```

### Tauri + tracing (Already Integrated!)

Your BlueKit application already uses `tracing`! You just need to add the dashboard layer to emit logs to the dashboard WebSocket.

**Add to src-tauri/Cargo.toml:**
```toml
tokio-tungstenite = "0.21"
```

**Update src-tauri/src/main.rs:**

```rust
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() {
    // Create dashboard layer (if dashboard is running)
    let dashboard_layer = if std::env::var("ENABLE_DASHBOARD").is_ok() {
        Some(DashboardLayer::new(
            "ws://localhost:9000/logs",
            "bluekit-app".to_string(),
        ))
    } else {
        None
    };

    // Initialize logging
    let subscriber = tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_max_level(tracing::Level::INFO)
                .with_target(false)
        );

    // Conditionally add dashboard layer
    if let Some(layer) = dashboard_layer {
        subscriber.with(layer).init();
    } else {
        subscriber.init();
    }

    tauri::Builder::default()
        // ... rest of your setup
}
```

Now all your existing `tracing::info!()`, `tracing::warn!()`, etc. calls will automatically send to the dashboard when `ENABLE_DASHBOARD=1` env var is set!

## HTTP Fallback Integration

For environments where WebSocket isn't available or practical:

**Simple HTTP POST client:**

```typescript
// src/logging/httpLogger.ts
interface LogEntry {
  timestamp: string;
  level: string;
  app_id: string;
  message: string;
  context?: Record<string, any>;
  stack_trace?: string;
  tags?: string[];
}

export class HttpLogger {
  private buffer: LogEntry[] = [];
  private flushInterval = 5000; // 5 seconds
  private maxBufferSize = 100;

  constructor(
    private dashboardUrl: string,
    private appId: string,
    private apiKey?: string
  ) {
    // Auto-flush every 5 seconds
    setInterval(() => this.flush(), this.flushInterval);
  }

  log(level: string, message: string, context?: Record<string, any>, tags?: string[]) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      app_id: this.appId,
      message,
      context,
      tags,
    };

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      const response = await fetch(`${this.dashboardUrl}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({ logs }),
      });

      if (!response.ok) {
        console.error('Failed to send logs to dashboard:', response.statusText);
        // Re-add logs to buffer for retry
        this.buffer.unshift(...logs);
      }
    } catch (error) {
      console.error('Error sending logs to dashboard:', error);
      // Re-add logs to buffer for retry
      this.buffer.unshift(...logs);
    }
  }

  // Ensure flush on shutdown
  async close() {
    await this.flush();
  }
}
```

**Usage:**

```typescript
const logger = new HttpLogger(
  'http://localhost:9000',
  'my-app',
  process.env.DASHBOARD_API_KEY
);

logger.log('INFO', 'Application started');
logger.log('ERROR', 'Database connection failed', {
  host: 'localhost',
  port: 5432,
  error_code: 'ECONNREFUSED'
}, ['database', 'critical']);

// Flush remaining logs before exit
process.on('beforeExit', async () => {
  await logger.close();
});
```

## Configuration Best Practices

### Environment Variables

Create `.env` file for configuration:

```bash
# Dashboard connection
DASHBOARD_URL=ws://localhost:9000/logs
DASHBOARD_API_KEY=your-secret-key

# App identification
APP_ID=my-application
APP_ENVIRONMENT=production

# Log settings
LOG_LEVEL=info
ENABLE_DASHBOARD=true
```

### Graceful Degradation

Always handle dashboard connection failures gracefully:

```typescript
try {
  dashboardTransport.connect();
} catch (error) {
  console.warn('Dashboard unavailable, logs will only go to console');
  // Application continues without dashboard
}
```

### Retry Logic

Implement exponential backoff for reconnections:

```typescript
private reconnect(attemptCount: number = 0) {
  const maxAttempts = 10;
  const baseDelay = 1000;

  if (attemptCount >= maxAttempts) {
    console.error('Max reconnection attempts reached, giving up');
    return;
  }

  const delay = Math.min(baseDelay * Math.pow(2, attemptCount), 30000);

  setTimeout(() => {
    console.log(`Reconnection attempt ${attemptCount + 1}/${maxAttempts}...`);
    this.connect().catch(() => this.reconnect(attemptCount + 1));
  }, delay);
}
```

### Log Sampling for High Volume

For very high-frequency logs, implement sampling:

```typescript
class SampledLogger {
  private sampleRate = 0.1; // 10% of logs

  log(level: string, message: string, context?: any) {
    // Always send errors
    if (level === 'ERROR' || level === 'FATAL') {
      this.sendToDashboard(level, message, context);
      return;
    }

    // Sample other logs
    if (Math.random() < this.sampleRate) {
      this.sendToDashboard(level, message, context);
    }
  }
}
```

## Testing Your Integration

### 1. Local Testing

Start the dashboard:
```bash
cd log-dashboard-app
npm run dev
```

Run your application with dashboard enabled:
```bash
ENABLE_DASHBOARD=true node dist/index.js
```

### 2. Verify Connection

Check dashboard UI shows your app in the apps list.

### 3. Test Log Levels

```typescript
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

Verify all levels appear correctly in the dashboard.

### 4. Test Reconnection

Stop the dashboard, wait 10 seconds, restart it. Verify your app reconnects automatically.

## Production Checklist

- [ ] Dashboard URL configured via environment variable
- [ ] API key authentication implemented
- [ ] Automatic reconnection with exponential backoff
- [ ] Graceful degradation if dashboard is unavailable
- [ ] Log levels configurable (don't send DEBUG to production dashboard)
- [ ] Structured context data included in logs
- [ ] Error stack traces captured
- [ ] Tags used for categorization
- [ ] Batch sending for HTTP transport (reduce network overhead)
- [ ] Local console logging still works as fallback
- [ ] PII/sensitive data scrubbed from logs

## Troubleshooting

**Logs not appearing in dashboard:**
- Check WebSocket connection in browser dev tools (Network tab)
- Verify `app_id` matches between producer and dashboard
- Check API key if authentication is enabled
- Look for errors in producer console

**Connection keeps dropping:**
- Check firewall settings
- Verify WebSocket server is running
- Check for proxy/load balancer issues
- Implement longer reconnection backoff

**High memory usage:**
- Reduce log buffer size
- Implement log sampling
- Use HTTP POST instead of buffering for WebSocket
- Decrease flush interval

**Dashboard performance degraded:**
- Reduce log verbosity (disable DEBUG logs)
- Implement log sampling
- Increase dashboard server resources
- Use log retention policies (delete old logs)

## Related Kits

- **realtime-log-dashboard-app** - The dashboard application that receives these logs
- **structured-logging-best-practices** - Advanced logging patterns and strategies

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [tracing Documentation](https://docs.rs/tracing)
- [Python logging](https://docs.python.org/3/library/logging.html)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
