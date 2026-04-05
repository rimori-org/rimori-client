import { SharedContentController } from './module/SharedContentController';
import { RimoriCommunicationHandler, RimoriInfo } from './CommunicationHandler';
import { Logger } from './Logger';
import { PluginModule } from './module/PluginModule';
import { DbModule } from './module/DbModule';
import { EventModule } from './module/EventModule';
import { AIModule } from './module/AIModule';
import { ExerciseModule } from './module/ExerciseModule';
import { StorageModule } from './module/StorageModule';
import { PostgrestClient } from '@supabase/postgrest-js';
import { EventBus, EventBusHandler } from '../fromRimori/EventBus';

export class RimoriClient {
  private static instance: RimoriClient;
  public sharedContent: SharedContentController;
  public db: DbModule;
  public event: EventModule;
  public plugin: PluginModule;
  public ai: AIModule;
  public exercise: ExerciseModule;
  /** Upload and manage images stored in Supabase via the backend. */
  public storage: StorageModule;
  private rimoriInfo: RimoriInfo;
  /** The EventBus instance used by this client. In federation mode this is a per-plugin instance. */
  public eventBus: EventBusHandler;

  private constructor(controller: RimoriCommunicationHandler, supabase: PostgrestClient, info: RimoriInfo, eventBus?: EventBusHandler) {
    this.rimoriInfo = info;
    this.eventBus = eventBus ?? EventBus;
    this.sharedContent = new SharedContentController(supabase, this);
    this.ai = new AIModule(info.backendUrl, () => this.rimoriInfo.token, info.pluginId);
    this.ai.setOnRateLimited((exercisesRemaining) => {
      this.eventBus.emit(info.pluginId, 'global.quota.triggerExceeded', { exercises_remaining: exercisesRemaining });
    });
    this.event = new EventModule(info.pluginId, info.backendUrl, () => this.rimoriInfo.token, this.ai, this.eventBus);
    this.db = new DbModule(supabase, controller, info);
    this.plugin = new PluginModule(supabase, controller, info, this.ai);
    this.exercise = new ExerciseModule(supabase, controller, info, this.event);
    this.storage = new StorageModule(info.backendUrl, () => this.rimoriInfo.token);

    controller.onUpdate((updatedInfo) => {
      this.rimoriInfo = updatedInfo;
    });

    //only init logger in workers and on main plugin pages
    if (this.plugin.applicationMode !== 'sidebar') {
      Logger.getInstance(this);
    }
  }

  /**
   * Creates a RimoriClient with pre-existing RimoriInfo (federation mode).
   * Uses a fresh per-plugin EventBus instance instead of the global singleton.
   * Creates the Supabase PostgrestClient internally from the info.
   */
  public static createWithInfo(info: RimoriInfo): RimoriClient {
    const eventBus = EventBusHandler.create('Plugin EventBus ' + info.pluginId);
    const controller = new RimoriCommunicationHandler(info.pluginId, true);
    const supabase = new PostgrestClient(`${info.url}/rest/v1`, {
      schema: info.dbSchema,
      headers: {
        apikey: info.key,
        Authorization: `Bearer ${info.token}`,
      },
    }) as unknown as PostgrestClient;
    const client = new RimoriClient(controller, supabase, info, eventBus);

    // In federated mode, CommunicationHandler skips MessageChannel setup so it never
    // subscribes to triggerUpdate events. PluginEventBridge forwards host-bus events to
    // this plugin's isolated eventBus, so we listen here and hand off to the controller.
    eventBus.on(`${info.pluginId}.supabase.triggerUpdate`, (ev) => {
      console.log('[RimoriClient] Federated triggerUpdate received for', info.pluginId, '| ttsEnabled:', (ev.data as RimoriInfo)?.ttsEnabled);
      controller.handleRimoriInfoUpdate(ev.data as RimoriInfo);
    });

    return client;
  }

  public static async getInstance(pluginId?: string): Promise<RimoriClient> {
    if (!RimoriClient.instance) {
      if (!pluginId) throw new Error('Plugin ID is required');

      const controller = new RimoriCommunicationHandler(pluginId, false);

      const client = await controller.getClient();
      RimoriClient.instance = new RimoriClient(controller, client.supabase, client.info);
    }
    return RimoriClient.instance;
  }

  public navigation = {
    toDashboard: (): void => {
      this.event.emit('global.navigation.triggerToDashboard');
    },
  };

  public runtime = {
    fetchBackend: async (url: string, options: RequestInit) => {
      return fetch(this.rimoriInfo.backendUrl + url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.rimoriInfo.token}`,
        },
      });
    },
  };
}
