import { EventBus, EventBusMessage, EventHandler, EventPayload, EventListener } from '../../fromRimori/EventBus';
import { MainPanelAction } from '../../fromRimori/PluginTypes';
import { AccomplishmentController, AccomplishmentPayload } from '../../controller/AccomplishmentController';

/**
 * Event module for plugin event bus operations.
 * Provides methods for emitting, listening to, and responding to events.
 */
export class EventModule {
  private pluginId: string;
  private accomplishmentController: AccomplishmentController;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
    this.accomplishmentController = new AccomplishmentController(pluginId);
  }

  public getGlobalEventTopic(preliminaryTopic: string): string {
    if (preliminaryTopic.startsWith('global.')) {
      return preliminaryTopic;
    }
    if (preliminaryTopic.startsWith('self.')) {
      return preliminaryTopic;
    }
    const topicParts = preliminaryTopic.split('.');
    if (topicParts.length === 3) {
      if (!topicParts[0].startsWith('pl') && topicParts[0] !== 'global') {
        throw new Error("The event topic must start with the plugin id or 'global'.");
      }
      return preliminaryTopic;
    } else if (topicParts.length > 3) {
      throw new Error(
        `The event topic must consist of 3 parts. <pluginId>.<topic area>.<action>. Received: ${preliminaryTopic}`,
      );
    }

    const topicRoot = this.pluginId ?? 'global';
    return `${topicRoot}.${preliminaryTopic}`;
  }

  /**
   * Emit an event to Rimori or a plugin.
   * The topic schema is:
   * {pluginId}.{eventId}
   * Check out the event bus documentation for more information.
   * For triggering events from Rimori like context menu actions use the "global" keyword.
   * @param topic The topic to emit the event on.
   * @param data The data to emit.
   * @param eventId The event id.
   */
  emit(topic: string, data?: any, eventId?: number): void {
    const globalTopic = this.getGlobalEventTopic(topic);
    EventBus.emit(this.pluginId, globalTopic, data, eventId);
  }

  /**
   * Request an event.
   * @param topic The topic to request the event on.
   * @param data The data to request.
   * @returns The response from the event.
   */
  request<T>(topic: string, data?: any): Promise<EventBusMessage<T>> {
    const globalTopic = this.getGlobalEventTopic(topic);
    return EventBus.request<T>(this.pluginId, globalTopic, data);
  }

  /**
   * Subscribe to an event.
   * @param topic The topic to subscribe to.
   * @param callback The callback to call when the event is emitted.
   * @returns An EventListener object containing an off() method to unsubscribe the listeners.
   */
  on<T = EventPayload>(topic: string | string[], callback: EventHandler<T>): EventListener {
    const topics = Array.isArray(topic) ? topic : [topic];
    return EventBus.on<T>(
      topics.map((t) => this.getGlobalEventTopic(t)),
      callback,
    );
  }

  /**
   * Subscribe to an event once.
   * @param topic The topic to subscribe to.
   * @param callback The callback to call when the event is emitted.
   */
  once<T = EventPayload>(topic: string, callback: EventHandler<T>): void {
    EventBus.once<T>(this.getGlobalEventTopic(topic), callback);
  }

  /**
   * Respond to an event.
   * @param topic The topic to respond to.
   * @param data The data to respond with.
   */
  respond<T = EventPayload>(
    topic: string | string[],
    data: EventPayload | ((data: EventBusMessage<T>) => EventPayload | Promise<EventPayload>),
  ): void {
    const topics = Array.isArray(topic) ? topic : [topic];
    EventBus.respond(
      this.pluginId,
      topics.map((t) => this.getGlobalEventTopic(t)),
      data,
    );
  }

  /**
   * Emit an accomplishment.
   * @param payload The payload to emit.
   */
  emitAccomplishment(payload: AccomplishmentPayload): void {
    this.accomplishmentController.emitAccomplishment(payload);
  }

  /**
   * Subscribe to an accomplishment.
   * @param accomplishmentTopic The topic to subscribe to.
   * @param callback The callback to call when the accomplishment is emitted.
   */
  onAccomplishment(
    accomplishmentTopic: string,
    callback: (payload: EventBusMessage<AccomplishmentPayload>) => void,
  ): void {
    this.accomplishmentController.subscribe(accomplishmentTopic, callback);
  }

  /**
   * Trigger an action that opens the sidebar and triggers an action in the designated plugin.
   * @param pluginId The id of the plugin to trigger the action for.
   * @param actionKey The key of the action to trigger.
   * @param text Optional text to be used for the action like for example text that the translator would look up.
   */
  emitSidebarAction(pluginId: string, actionKey: string, text?: string): void {
    this.emit('global.sidebar.triggerAction', { plugin_id: pluginId, action_key: actionKey, text });
  }

  /**
   * Subscribe to main panel actions triggered by the user from the dashboard.
   * @param callback Handler function that receives the action data when a matching action is triggered.
   * @param actionsToListen Optional filter to listen only to specific action keys. If empty or not provided, all actions will trigger the callback.
   * @returns An EventListener object with an `off()` method for cleanup.
   *
   * @example
   * ```ts
   * const listener = client.event.onMainPanelAction((data) => {
   *   console.log('Action received:', data.action_key);
   * }, ['startSession', 'pauseSession']);
   *
   * // Clean up when component unmounts to prevent events from firing
   * // when navigating away or returning to the page
   * useEffect(() => {
   *   return () => listener.off();
   * }, []);
   * ```
   *
   * **Important:** Always call `listener.off()` when your component unmounts or when you no longer need to listen.
   * This prevents the event handler from firing when navigating away from or returning to the page, which could
   * cause unexpected behavior or duplicate event handling.
   */
  onMainPanelAction(callback: (data: MainPanelAction) => void, actionsToListen: string | string[] = []): EventListener {
    const listeningActions = Array.isArray(actionsToListen) ? actionsToListen : [actionsToListen];
    // this needs to be a emit and on because the main panel action is triggered by the user and not by the plugin
    this.emit('action.requestMain');
    return this.on<MainPanelAction>('action.requestMain', ({ data }) => {
      // console.log('Received action for main panel ' + data.action_key);
      // console.log('Listening to actions', listeningActions);
      if (listeningActions.length === 0 || listeningActions.includes(data.action_key)) {
        callback(data);
      }
    });
  }

  /**
   * Subscribe to side panel actions triggered by the user from the dashboard.
   * @param callback Handler function that receives the action data when a matching action is triggered.
   * @param actionsToListen Optional filter to listen only to specific action keys. If empty or not provided, all actions will trigger the callback.
   * @returns An EventListener object with an `off()` method for cleanup.
   */
  onSidePanelAction(callback: (data: MainPanelAction) => void, actionsToListen: string | string[] = []): EventListener {
    const listeningActions = Array.isArray(actionsToListen) ? actionsToListen : [actionsToListen];
    // this needs to be a emit and on because the main panel action is triggered by the user and not by the plugin
    this.emit('action.requestSidebar');
    return this.on<MainPanelAction>('action.requestSidebar', ({ data }) => {
      // console.log("eventHandler .onSidePanelAction", data);
      // console.log('Received action for sidebar ' + data.action);
      // console.log('Listening to actions', listeningActions);
      if (listeningActions.length === 0 || listeningActions.includes(data.action)) {
        callback(data);
      }
    });
  }
}
