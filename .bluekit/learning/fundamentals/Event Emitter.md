# Event Emitter

Here's a foundational guide to Event Emitters — a pattern for broadcasting internal events and enabling loose coupling between components.

⸻

# Event Emitter (Foundations)

## What Is an Event Emitter?

An **Event Emitter** is an object that can broadcast events to multiple listeners. Think of it like a **radio station**:
- The emitter broadcasts events (like a radio station broadcasting)
- Listeners subscribe to events they care about (like tuning into a radio station)
- When an event is emitted, all subscribed listeners are notified

This pattern enables **loose coupling** — components don't need to know about each other directly, they just listen for events.

⸻

## The Core Concept: Publish-Subscribe

Event Emitters use the **publish-subscribe** (pub/sub) pattern:

1. **Publishers** emit events (the emitter)
2. **Subscribers** listen for events (the listeners)
3. **Decoupling** — publishers don't need to know who's listening

```js
// Publisher emits an event
emitter.emit('user-logged-in', { userId: 123 });

// Subscribers listen for the event
emitter.on('user-logged-in', (data) => {
  console.log('User logged in:', data.userId);
});
```

⸻

## Basic Event Emitter API

### Three Core Methods

**1. `on(event, listener)` — Subscribe to an event**
```js
emitter.on('click', (data) => {
  console.log('Clicked!', data);
});
```

**2. `emit(event, data)` — Broadcast an event**
```js
emitter.emit('click', { x: 100, y: 200 });
```

**3. `off(event, listener)` — Unsubscribe from an event**
```js
emitter.off('click', listener);
```

⸻

## How It Works Internally

An Event Emitter maintains a **map of event names to listeners**:

```js
class EventEmitter {
  constructor() {
    // Internal storage: event name → array of listeners
    this.listeners = {};
  }

  on(event, listener) {
    // If no listeners for this event yet, create array
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    // Add listener to the array
    this.listeners[event].push(listener);
  }

  emit(event, data) {
    // Get all listeners for this event
    const listeners = this.listeners[event] || [];
    // Call each listener with the data
    listeners.forEach(listener => listener(data));
  }

  off(event, listener) {
    // Remove the specific listener from the array
    const listeners = this.listeners[event] || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }
}
```

**Key insight:** The emitter stores listeners in arrays, and when you `emit()`, it calls all listeners in that array.

⸻

## Broadcasting Internal Events

Event Emitters are perfect for broadcasting **internal state changes** or **lifecycle events**:

```js
class UserManager {
  constructor() {
    this.emitter = new EventEmitter();
    this.currentUser = null;
  }

  login(userId) {
    this.currentUser = { id: userId };
    // Broadcast the event internally
    this.emitter.emit('user-logged-in', { userId });
  }

  logout() {
    this.currentUser = null;
    // Broadcast the event internally
    this.emitter.emit('user-logged-out');
  }

  // Expose emitter methods for external listeners
  on(event, listener) {
    return this.emitter.on(event, listener);
  }
}

// Usage: Other parts of the app can listen
const userManager = new UserManager();

userManager.on('user-logged-in', (data) => {
  console.log('User logged in:', data.userId);
  // Update UI, fetch data, etc.
});

userManager.on('user-logged-out', () => {
  console.log('User logged out');
  // Clear UI, reset state, etc.
});

userManager.login(123); // Triggers 'user-logged-in' event
```

**Benefits:**
- `UserManager` doesn't need to know about UI components
- UI components don't need direct references to `UserManager`
- Easy to add new listeners without modifying `UserManager`

⸻

## Extending EventEmitter in Classes

Instead of having a separate emitter instance, classes can **extend** EventEmitter to become emitters themselves:

### Pattern 1: Composition (Has-A)

```js
const EventEmitter = require('events');

class UserManager {
  constructor() {
    // Create an emitter instance
    this.emitter = new EventEmitter();
  }

  login(userId) {
    this.currentUser = { id: userId };
    this.emitter.emit('user-logged-in', { userId });
  }

  // Expose emitter methods
  on(event, listener) {
    return this.emitter.on(event, listener);
  }

  emit(event, data) {
    return this.emitter.emit(event, data);
  }
}
```

### Pattern 2: Inheritance (Is-A) — Recommended

```js
const EventEmitter = require('events');

class UserManager extends EventEmitter {
  constructor() {
    super(); // Call EventEmitter constructor
    this.currentUser = null;
  }

  login(userId) {
    this.currentUser = { id: userId };
    // Can directly use emit() from EventEmitter
    this.emit('user-logged-in', { userId });
  }

  logout() {
    this.currentUser = null;
    this.emit('user-logged-out');
  }
}

// Usage: UserManager IS an EventEmitter
const userManager = new UserManager();

// Can use all EventEmitter methods directly
userManager.on('user-logged-in', (data) => {
  console.log('User logged in:', data.userId);
});

userManager.login(123); // Emits 'user-logged-in'
```

**Key difference:**
- **Composition**: Class has an emitter (`this.emitter`)
- **Inheritance**: Class is an emitter (extends EventEmitter)

**Inheritance is cleaner** because you get all EventEmitter methods (`on`, `emit`, `off`, `once`, etc.) without manual delegation.

⸻

## Real-World Example: File Watcher

```js
const EventEmitter = require('events');
const fs = require('fs');

class FileWatcher extends EventEmitter {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.watchInterval = null;
  }

  start() {
    this.emit('watching-started', { filePath: this.filePath });
    
    this.watchInterval = setInterval(() => {
      fs.readFile(this.filePath, 'utf8', (err, content) => {
        if (err) {
          this.emit('error', err);
          return;
        }
        
        // Broadcast file change
        this.emit('file-changed', { 
          filePath: this.filePath,
          content 
        });
      });
    }, 1000);
  }

  stop() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.emit('watching-stopped');
    }
  }
}

// Usage: Multiple components can listen
const watcher = new FileWatcher('./data.txt');

watcher.on('watching-started', (data) => {
  console.log(`Started watching: ${data.filePath}`);
});

watcher.on('file-changed', (data) => {
  console.log('File changed!', data.content);
  // Update UI, process data, etc.
});

watcher.on('error', (err) => {
  console.error('Watch error:', err);
});

watcher.start();
```

**Benefits:**
- `FileWatcher` doesn't need to know about UI, logging, or data processors
- Each component subscribes to only the events it cares about
- Easy to add new listeners without modifying `FileWatcher`

⸻

## Common Event Emitter Methods

### `once(event, listener)` — Listen only once

```js
emitter.once('user-logged-in', (data) => {
  console.log('First login detected');
  // Listener is automatically removed after first call
});
```

### `removeAllListeners(event)` — Remove all listeners

```js
emitter.removeAllListeners('click');
// All 'click' listeners are removed
```

### `listenerCount(event)` — Count listeners

```js
const count = emitter.listenerCount('click');
console.log(`${count} listeners for 'click' event`);
```

⸻

## Best Practices

### 1. Always Call `super()` When Extending

```js
class MyClass extends EventEmitter {
  constructor() {
    super(); // Required! Initializes EventEmitter
    // Your initialization code
  }
}
```

### 2. Clean Up Listeners

```js
class Component {
  constructor(emitter) {
    this.emitter = emitter;
    this.handleClick = (data) => {
      console.log('Clicked:', data);
    };
    this.emitter.on('click', this.handleClick);
  }

  destroy() {
    // Remove listener to prevent memory leaks
    this.emitter.off('click', this.handleClick);
  }
}
```

### 3. Use Named Functions for Removal

```js
// ❌ Bad: Can't remove anonymous function
emitter.on('click', (data) => { /* ... */ });
emitter.off('click', ???); // Can't reference the function!

// ✅ Good: Named function can be removed
const handleClick = (data) => { /* ... */ };
emitter.on('click', handleClick);
emitter.off('click', handleClick);
```

### 4. Emit Meaningful Data

```js
// ❌ Bad: No context
this.emit('error');

// ✅ Good: Include useful data
this.emit('error', { 
  message: 'Failed to connect',
  code: 'CONNECTION_ERROR',
  timestamp: Date.now()
});
```

⸻

## When to Use Event Emitters

**Good use cases:**
- **State changes** — notify listeners when internal state changes
- **Lifecycle events** — `started`, `stopped`, `completed`
- **User interactions** — `click`, `keypress`, `scroll`
- **Async operations** — `data-loaded`, `upload-complete`
- **Cross-component communication** — when components shouldn't know about each other

**Not ideal for:**
- **Request-response patterns** — use Promises/async-await instead
- **Direct function calls** — if you need a return value, just call the function
- **Tightly coupled components** — if components must know about each other, direct references are clearer

⸻

## Mental Model Summary

- Event Emitters enable **publish-subscribe** pattern
- Classes can **extend EventEmitter** to become emitters themselves
- Emitters **broadcast events** to all subscribed listeners
- Listeners **subscribe** with `on()`, **unsubscribe** with `off()`
- Events enable **loose coupling** between components
- Always **clean up listeners** to prevent memory leaks
- Use **named functions** if you need to remove listeners later

⸻

## One-Line Intuition

Event Emitters are like a **radio station** — they broadcast events, and any component can tune in to listen. When you extend EventEmitter, your class becomes the radio station itself.
