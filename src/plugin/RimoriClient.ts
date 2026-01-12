import { SharedContentController } from './module/SharedContentController';
import { RimoriCommunicationHandler, RimoriInfo } from './CommunicationHandler';
import { Logger } from './Logger';
import { PluginModule } from './module/PluginModule';
import { DbModule } from './module/DbModule';
import { EventModule } from './module/EventModule';
import { AIModule } from './module/AIModule';
import { ExerciseModule } from './module/ExerciseModule';
import { PostgrestClient } from '@supabase/postgrest-js';

export class RimoriClient {
  private static instance: RimoriClient;
  public sharedContent: SharedContentController;
  public db: DbModule;
  public event: EventModule;
  public plugin: PluginModule;
  public ai: AIModule;
  public exercise: ExerciseModule;
  private rimoriInfo: RimoriInfo;

  private constructor(controller: RimoriCommunicationHandler, supabase: PostgrestClient, info: RimoriInfo) {
    this.rimoriInfo = info;
    this.sharedContent = new SharedContentController(supabase, this);
    this.ai = new AIModule(controller, info);
    this.event = new EventModule(info.pluginId);
    this.db = new DbModule(supabase, controller, info);
    this.plugin = new PluginModule(supabase, controller, info);
    this.exercise = new ExerciseModule(supabase, controller, info, this.event);

    controller.onUpdate((updatedInfo) => {
      this.rimoriInfo = updatedInfo;
    });

    //only init logger in workers and on main plugin pages
    if (this.plugin.applicationMode !== 'sidebar') {
      Logger.getInstance(this);
    }
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
