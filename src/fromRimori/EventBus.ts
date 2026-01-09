// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventPayload = Record<string, any>;

/**
 * Interface representing a message sent through the EventBus
 *
 * Debug capabilities:
 * - System-wide debugging: Send an event to "global.system.requestDebug"
 *   Example: `EventBus.emit("yourPluginId", "global.system.requestDebug");`
 */
export interface EventBusMessage<T = EventPayload> {
  //timestamp of the event
  timestamp: string;
  //unique ID of the event
  eventId: number;
  //plugin id or "global" for global events
  sender: string;
  //the topic of the event consisting of the plugin id, key area and action e.g. "translator.word.triggerTranslation"
  topic: string;
  //any type of data to be transmitted
  data: T;
  //indicated if the debug mode is active
  debug: boolean;
}

export type EventHandler<T = EventPayload> = (event: EventBusMessage<T>) => void | Promise<void>;

interface Listeners<T = EventPayload> {
  id: number;
  handler: EventHandler<T>;
  ignoreSender?: string[];
}

export interface EventListener {
  off: () => void;
}

export class EventBusHandler {
  private listeners: Map<string, Set<Listeners<EventPayload>>> = new Map();
  private responseResolvers: Map<number, (value: EventBusMessage<unknown>) => void> = new Map();
  private static instance: EventBusHandler | null = null;
  private debugEnabled = false;
  private evName = '';
  private generatedIds: Map<number, number> = new Map(); // Map<id, timestamp>
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    //private constructor
    this.startIdCleanup();
  }

  static getInstance(name?: string) {
    if (!EventBusHandler.instance) {
      EventBusHandler.instance = new EventBusHandler();

      EventBusHandler.instance.on('global.system.requestDebug', () => {
        EventBusHandler.instance!.debugEnabled = true;
        console.log(
          `[${
            EventBusHandler.instance!.evName
          }] Debug mode enabled. Make sure debugging messages are enabled in the browser console.`,
        );
      });
    }
    if (name && EventBusHandler.instance.evName === '') {
      EventBusHandler.instance.evName = name;
    }
    return EventBusHandler.instance;
  }

  /**
   * Starts the interval to cleanup the generated ids.
   */
  private startIdCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000; // 60 seconds in milliseconds

      for (const [id, timestamp] of this.generatedIds.entries()) {
        if (timestamp < oneMinuteAgo) {
          this.generatedIds.delete(id);
        }
      }
    }, 10000); // Run every 10 seconds
  }

  /**
   * Generates a unique id.
   * @returns A unique id.
   */
  private generateUniqueId(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const id = Math.floor(Math.random() * 10000000000);

    // Check if ID was generated within the last minute
    const existingTimestamp = this.generatedIds.get(id);
    if (existingTimestamp && existingTimestamp > oneMinuteAgo) {
      // ID was recently generated, generate a new one recursively
      return this.generateUniqueId();
    }

    // Store the ID with current timestamp
    this.generatedIds.set(id, now);
    return id;
  }

  private createEvent(sender: string, topic: string, data: EventPayload, eventId?: number): EventBusMessage {
    const generatedEventId = eventId || this.generateUniqueId();

    return {
      eventId: generatedEventId,
      timestamp: new Date().toISOString(),
      sender,
      topic,
      data,
      debug: this.debugEnabled,
    };
  }

  /**
   * Emits an event to the event bus. Can be a new event or a response to a request.
   * @param sender - The sender of the event.
   * @param topic - The topic of the event.
   * @param data - The data of the event.
   * @param eventId - The event id of the event.
   *
   * The topic format is: **pluginId.area.action**
   *
   * Example topics:
   * - pl1234.card.requestHard
   * - pl1234.card.requestNew
   * - pl1234.card.requestAll
   * - pl1234.card.create
   * - pl1234.card.update
   * - pl1234.card.delete
   * - pl1234.card.triggerBackup
   */
  public emit<T = EventPayload>(sender: string, topic: string, data?: T, eventId?: number): void {
    this.emitInternal(sender, topic, data || {}, eventId);
  }

  private emitInternal(
    sender: string,
    topic: string,
    data: EventPayload,
    eventId?: number,
    skipResponseTrigger = false,
  ): void {
    if (!this.validateTopic(topic)) {
      this.logAndThrowError(false, `Invalid topic: ` + topic);
      return;
    }

    const event = this.createEvent(sender, topic, data, eventId);

    const handlers = this.getMatchingHandlers(event.topic);
    handlers.forEach((handler) => {
      if (handler.ignoreSender && handler.ignoreSender.includes(sender)) {
        // console.log("ignore event as its in the ignoreSender list", { event, ignoreList: handler.ignoreSender });
        return;
      }
      handler.handler(event);
    });
    this.logIfDebug(`Emitting event to ` + topic, event);
    if (handlers.size === 0) {
      this.logAndThrowError(false, `No handlers found for topic: ` + topic);
    }

    // If it's a response to a request
    if (eventId && this.responseResolvers.has(eventId) && !skipResponseTrigger) {
      // console.log("[Rimori] Resolving response to request: " + eventId, event.data);
      this.responseResolvers.get(eventId)!(event);
      this.responseResolvers.delete(eventId);
    }
  }

  /**
   * Subscribes to an event on the event bus.
   * @param topics - The topic of the event.
   * @param handler - The handler to be called when the event is emitted.
   * @param ignoreSender - The senders to ignore.
   * @returns An EventListener object containing an off() method to unsubscribe the listeners.
   */
  public on<T = EventPayload>(
    topics: string | string[],
    handler: EventHandler<T>,
    ignoreSender: string[] = [],
  ): EventListener {
    const ids = this.toArray(topics).map((topic) => {
      this.logIfDebug(`Subscribing to ` + topic, { ignoreSender });
      if (!this.validateTopic(topic)) {
        this.logAndThrowError(true, `Invalid topic: ` + topic);
      }

      if (!this.listeners.has(topic)) {
        this.listeners.set(topic, new Set());
      }
      const id = this.generateUniqueId();

      // To prevent infinite loops and processing the same eventId multiple times
      const blackListedEventIds: { eventId: number; sender: string }[] = [];
      const eventHandler = (data: EventBusMessage) => {
        if (blackListedEventIds.some((item) => item.eventId === data.eventId && item.sender === data.sender)) {
          // console.log('BLACKLISTED EVENT ID', data.eventId, data);
          return;
        }
        blackListedEventIds.push({
          eventId: data.eventId,
          sender: data.sender,
        });
        if (blackListedEventIds.length > 100) {
          blackListedEventIds.shift();
        }
        return (handler as unknown as EventHandler<EventPayload>)(data);
      };

      this.listeners.get(topic)!.add({ id, handler: eventHandler, ignoreSender });

      this.logIfDebug(`Subscribed to ` + topic, {
        listenerId: id,
        ignoreSender,
      });

      return btoa(JSON.stringify({ topic, id }));
    });

    return {
      off: () => this.off(ids),
    };
  }

  /**
   * Subscribes to an event, processes the data and emits a response on the event bus.
   * @param sender - The sender of the event.
   * @param topic - The topic of the event.
   * @param handler - The handler to be called when the event is received. The handler returns the data to be emitted. Can be a static object or a function.
   * @returns An EventListener object containing an off() method to unsubscribe the listeners.
   */
  public respond(
    sender: string,
    topic: string | string[],
    handler: EventPayload | ((data: EventBusMessage) => EventPayload | Promise<EventPayload>),
  ): EventListener {
    const topics = Array.isArray(topic) ? topic : [topic];
    const listeners = topics.map((topic) => {
      const blackListedEventIds: number[] = [];
      //To allow event communication inside the same plugin the sender needs to be ignored but the events still need to be checked for the same event just reaching the subscriber to prevent infinite loops
      const finalIgnoreSender = !topic.startsWith('self.') ? [sender] : [];

      const listener = this.on(
        topic,
        async (data: EventBusMessage) => {
          if (blackListedEventIds.includes(data.eventId)) {
            // console.log("BLACKLISTED EVENT ID", data.eventId);
            return;
          }
          blackListedEventIds.push(data.eventId);
          if (blackListedEventIds.length > 100) {
            blackListedEventIds.shift();
          }
          const response = typeof handler === 'function' ? await handler(data) : handler;
          this.emit(sender, topic, response, data.eventId);
        },
        finalIgnoreSender,
      );

      this.logIfDebug(`Added respond listener ` + sender + ' to topic ' + topic, { listener, sender });
      return {
        off: () => listener.off(),
      };
    });
    return {
      off: () => listeners.forEach((listener) => listener.off()),
    };
  }

  /**
   * Subscribes to an event on the event bus. The handler will be called once and then removed.
   * @param topic - The topic of the event.
   * @param handler - The handler to be called when the event is emitted.
   */
  public once<T = EventPayload>(topic: string, handler: EventHandler<T>): void {
    if (!this.validateTopic(topic)) {
      this.logAndThrowError(false, `Invalid topic: ` + topic);
      return;
    }

    let listener: EventListener | undefined = undefined;
    const wrapper = (event: EventBusMessage<T>) => {
      handler(event);
      listener?.off();
    };
    listener = this.on(topic, wrapper);

    this.logIfDebug(`Added once listener ` + topic, { listener, topic });
  }

  /**
   * Unsubscribes from an event on the event bus.
   * @param listenerIds - The ids of the listeners to unsubscribe from.
   */
  private off(listenerIds: string | string[]): void {
    this.toArray(listenerIds).forEach((fullId) => {
      const { topic, id } = JSON.parse(atob(fullId));

      const listeners = this.listeners.get(topic) || new Set();

      listeners.forEach((listener) => {
        if (listener.id === Number(id)) {
          listeners.delete(listener);
          this.logIfDebug(`Removed listener ` + fullId, {
            topic,
            listenerId: id,
          });
        }
      });
    });
  }

  private toArray(item: string | string[]): string[] {
    return Array.isArray(item) ? item : [item];
  }

  /**
   * Requests data from the event bus.
   * @param sender - The sender of the event.
   * @param topic - The topic of the event.
   * @param data - The data of the event.
   * @returns A promise that resolves to the event.
   */
  public async request<T = EventPayload>(
    sender: string,
    topic: string,
    data?: EventPayload,
  ): Promise<EventBusMessage<T>> {
    if (!this.validateTopic(topic)) {
      this.logAndThrowError(true, `Invalid topic: ` + topic);
    }

    const event = this.createEvent(sender, topic, data || {});

    this.logIfDebug(`Requesting data from ` + topic, { event });

    return new Promise<EventBusMessage<T>>((resolve) => {
      this.responseResolvers.set(event.eventId, (value: EventBusMessage<unknown>) =>
        resolve(value as EventBusMessage<T>),
      );
      this.emitInternal(sender, topic, data || {}, event.eventId, true);
    });
  }

  /**
   * Gets the matching handlers for an event.
   * @param topic - The topic of the event.
   * @returns A set of handlers that match the event type.
   */
  private getMatchingHandlers(topic: string): Set<Listeners<EventPayload>> {
    const exact = this.listeners.get(topic) || new Set();

    // Find wildcard matches
    const wildcard = [...this.listeners.entries()]
      .filter(([key]) => key.endsWith('*') && topic.startsWith(key.slice(0, -1)))
      .flatMap(([_, handlers]) => [...handlers]);
    return new Set([...exact, ...wildcard]);
  }

  /**
   * Validates the topic of an event.
   * @param topic - The topic of the event.
   * @returns True if the topic is valid, false otherwise.
   */
  private validateTopic(topic: string): boolean {
    // Split event type into parts
    const parts = topic.split('.');
    const [plugin, area, action] = parts;

    if (parts.length !== 3) {
      if (parts.length === 1 && plugin === '*') {
        return true;
      }
      if (parts.length === 2 && plugin !== '*' && area === '*') {
        return true;
      }
      this.logAndThrowError(false, `Event type must have 3 parts separated by dots. Received: ` + topic);
      return false;
    }

    if (action === '*') {
      return true;
    }

    // Validate action part
    const validActions = ['request', 'create', 'update', 'delete', 'trigger'];

    if (validActions.some((a) => action.startsWith(a))) {
      return true;
    }

    this.logAndThrowError(
      false,
      `Invalid event topic name. The action: ` + action + '. Must be or start with one of: ' + validActions.join(', '),
    );
    return false;
  }

  private logIfDebug(...args: (string | EventPayload)[]) {
    if (this.debugEnabled) {
      console.debug(`[${this.evName}] ` + args[0], ...args.slice(1));
    }
  }

  private logAndThrowError(throwError: boolean, ...args: (string | EventPayload)[]) {
    const message = `[${this.evName}] ` + args[0];
    console.error(message, ...args.slice(1));
    if (throwError) {
      throw new Error(message);
    }
  }
}

export const EventBus = EventBusHandler.getInstance();
