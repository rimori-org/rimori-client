type Listener<T = any> = (event: T) => void;

export class EventEmitter {
  private events: Map<string, Listener[]> = new Map();

  constructor() {
    this.on = this.on.bind(this);
    this.once = this.once.bind(this);
    this.emit = this.emit.bind(this);
    this.removeListener = this.removeListener.bind(this);
  }

  // Subscribe to an event
  on<T = any>(eventName: string, listener: Listener<T>): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName)!.push(listener);
  }

  // Subscribe to an event for a single invocation
  once<T = any>(eventName: string, listener: Listener<T>): void {
    const onceWrapper: Listener<T> = (event) => {
      this.removeListener(eventName, onceWrapper);
      listener(event);
    };
    this.on(eventName, onceWrapper);
  }

  // Remove a specific listener
  removeListener<T = any>(eventName: string, listener: Listener<T>): void {
    const listeners = this.events.get(eventName);
    if (!listeners) return;

    this.events.set(eventName, listeners.filter((l) => l !== listener));
  }

  // Emit an event
  emit<T = any>(eventName: string, data?: T): void {
    const listeners = this.events.get(eventName);
    console.log("emit", eventName, data, listeners);
    if (!listeners) return;

    listeners.forEach((listener) => listener(data));
  }
}
const emitter = new EventEmitter();
export const EmitterSingleton = emitter;