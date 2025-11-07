import { PostgrestQueryBuilder } from '@supabase/postgrest-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { GenericSchema } from '@supabase/supabase-js/dist/module/lib/types';
import { generateText, Message, OnLLMResponse, streamChatGPT } from '../core/controller/AIController';
import { generateObject, ObjectRequest } from '../core/controller/ObjectController';
import { SettingsController, UserInfo } from '../core/controller/SettingsController';
import {
  SharedContent,
  SharedContentController,
  SharedContentFilter,
  SharedContentObjectRequest,
} from '../core/controller/SharedContentController';
import { getSTTResponse, getTTSResponse } from '../core/controller/VoiceController';
import { ExerciseController, CreateExerciseParams } from '../core/controller/ExerciseController';
import { EventBus, EventBusMessage, EventHandler, EventPayload } from '../fromRimori/EventBus';
import { ActivePlugin, MainPanelAction, Plugin, Tool } from '../fromRimori/PluginTypes';
import { AccomplishmentHandler, AccomplishmentPayload } from '../core/controller/AccomplishmentHandler';
import { PluginController, RimoriInfo } from './PluginController';
import { Translator } from '../core/controller/TranslationController';

interface Db {
  from: {
    <TableName extends string & keyof GenericSchema['Tables'], Table extends GenericSchema['Tables'][TableName]>(
      relation: TableName,
    ): PostgrestQueryBuilder<GenericSchema, Table, TableName>;
    <ViewName extends string & keyof GenericSchema['Views'], View extends GenericSchema['Views'][ViewName]>(
      relation: ViewName,
    ): PostgrestQueryBuilder<GenericSchema, View, ViewName>;
  };
  // storage: SupabaseClient["storage"];

  // functions: SupabaseClient["functions"];
  /**
   * The table prefix for of database tables of the plugin.
   */
  tablePrefix: string;
  /**
   * Get the table name for a given plugin table.
   * Internally all tables are prefixed with the plugin id. This function is used to get the correct table name for a given public table.
   * @param table The plugin table name to get the full table name for.
   * @returns The full table name.
   */
  getTableName: (table: string) => string;
}

interface PluginInterface {
  pluginId: string;
  setSettings: (settings: any) => Promise<void>;
  /**
   * Get the settings for the plugin. T can be any type of settings, UserSettings or SystemSettings.
   * @param defaultSettings The default settings to use if no settings are found.
   * @param genericSettings The type of settings to get.
   * @returns The settings for the plugin.
   */
  getSettings: <T extends object>(defaultSettings: T) => Promise<T>;
  /**
   * Retrieves information about plugins, including:
   * - All installed plugins
   * - The currently active plugin in the main panel
   * - The currently active plugin in the side panel
   */
  getPluginInfo: () => {
    /**
     * All installed plugins.
     */
    installedPlugins: Plugin[];
    /**
     * The plugin that is loaded in the main panel.
     */
    mainPanelPlugin?: ActivePlugin;
    /**
     * The plugin that is loaded in the side panel.
     */
    sidePanelPlugin?: ActivePlugin;
  };
  getUserInfo: () => UserInfo;
  getTranslator: () => Promise<Translator>;
}

export class RimoriClient {
  private static instance: RimoriClient;
  private superbase: SupabaseClient;
  private pluginController: PluginController;
  private settingsController: SettingsController;
  private sharedContentController: SharedContentController;
  private exerciseController: ExerciseController;
  private accomplishmentHandler: AccomplishmentHandler;
  private rimoriInfo: RimoriInfo;
  private translator: Translator;
  public plugin: PluginInterface;
  public db: Db;

  private constructor(supabase: SupabaseClient, info: RimoriInfo, pluginController: PluginController) {
    this.rimoriInfo = info;
    this.superbase = supabase;
    this.pluginController = pluginController;
    this.settingsController = new SettingsController(supabase, info.pluginId, info.guild);
    this.sharedContentController = new SharedContentController(this.superbase, this);
    this.exerciseController = new ExerciseController(supabase, pluginController);
    this.accomplishmentHandler = new AccomplishmentHandler(info.pluginId);
    this.translator = new Translator(info.profile.mother_tongue.code);

    this.from = this.from.bind(this);
    this.getTableName = this.getTableName.bind(this);

    this.db = {
      from: this.from,
      // storage: this.superbase.storage,
      // functions: this.superbase.functions,
      tablePrefix: info.tablePrefix,
      getTableName: this.getTableName,
    };
    this.plugin = {
      pluginId: info.pluginId,
      setSettings: async (settings: any): Promise<void> => {
        await this.settingsController.setSettings(settings);
      },
      getSettings: async <T extends object>(defaultSettings: T): Promise<T> => {
        return await this.settingsController.getSettings<T>(defaultSettings);
      },
      getUserInfo: (): UserInfo => {
        return this.rimoriInfo.profile;
      },
      getPluginInfo: () => {
        return {
          installedPlugins: this.rimoriInfo.installedPlugins,
          mainPanelPlugin: this.rimoriInfo.mainPanelPlugin,
          sidePanelPlugin: this.rimoriInfo.sidePanelPlugin,
        };
      },
      getTranslator: async (): Promise<Translator> => {
        await this.translator.initialize();
        return this.translator;
      },
    };
  }

  public event = {
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
    emit: (topic: string, data?: any, eventId?: number) => {
      const globalTopic = this.pluginController.getGlobalEventTopic(topic);
      EventBus.emit(this.plugin.pluginId, globalTopic, data, eventId);
    },
    /**
     * Request an event.
     * @param topic The topic to request the event on.
     * @param data The data to request.
     * @returns The response from the event.
     */
    request: <T>(topic: string, data?: any): Promise<EventBusMessage<T>> => {
      const globalTopic = this.pluginController.getGlobalEventTopic(topic);
      return EventBus.request<T>(this.plugin.pluginId, globalTopic, data);
    },
    /**
     * Subscribe to an event.
     * @param topic The topic to subscribe to.
     * @param callback The callback to call when the event is emitted.
     * @returns An EventListener object containing an off() method to unsubscribe the listeners.
     */
    on: <T = EventPayload>(topic: string | string[], callback: EventHandler<T>) => {
      const topics = Array.isArray(topic) ? topic : [topic];
      return EventBus.on<T>(
        topics.map((t) => this.pluginController.getGlobalEventTopic(t)),
        callback,
      );
    },
    /**
     * Subscribe to an event once.
     * @param topic The topic to subscribe to.
     * @param callback The callback to call when the event is emitted.
     */
    once: <T = EventPayload>(topic: string, callback: EventHandler<T>) => {
      EventBus.once<T>(this.pluginController.getGlobalEventTopic(topic), callback);
    },
    /**
     * Respond to an event.
     * @param topic The topic to respond to.
     * @param data The data to respond with.
     */
    respond: <T = EventPayload>(
      topic: string | string[],
      data: EventPayload | ((data: EventBusMessage<T>) => EventPayload | Promise<EventPayload>),
    ) => {
      const topics = Array.isArray(topic) ? topic : [topic];
      EventBus.respond(
        this.plugin.pluginId,
        topics.map((t) => this.pluginController.getGlobalEventTopic(t)),
        data,
      );
    },
    /**
     * Emit an accomplishment.
     * @param payload The payload to emit.
     */
    emitAccomplishment: (payload: AccomplishmentPayload) => {
      this.accomplishmentHandler.emitAccomplishment(payload);
    },
    /**
     * Subscribe to an accomplishment.
     * @param accomplishmentTopic The topic to subscribe to.
     * @param callback The callback to call when the accomplishment is emitted.
     */
    onAccomplishment: (
      accomplishmentTopic: string,
      callback: (payload: EventBusMessage<AccomplishmentPayload>) => void,
    ) => {
      this.accomplishmentHandler.subscribe(accomplishmentTopic, callback);
    },
    /**
     * Trigger an action that opens the sidebar and triggers an action in the designated plugin.
     * @param pluginId The id of the plugin to trigger the action for.
     * @param actionKey The key of the action to trigger.
     * @param text Optional text to be used for the action like for example text that the translator would look up.
     */
    emitSidebarAction: (pluginId: string, actionKey: string, text?: string) => {
      this.event.emit('global.sidebar.triggerAction', { plugin_id: pluginId, action_key: actionKey, text });
    },

    onMainPanelAction: (callback: (data: MainPanelAction) => void, actionsToListen: string[] = []) => {
      // this needs to be a emit and on because the main panel action is triggered by the user and not by the plugin
      this.event.emit('action.requestMain');
      this.event.on<MainPanelAction>('action.requestMain', ({ data }) => {
        if (actionsToListen.includes(data.action)) {
          callback(data);
        }
      });
    },
  };

  public navigation = {
    toDashboard: () => {
      this.event.emit('global.navigation.triggerToDashboard');
    },
  };

  /**
   * Get a query parameter value that was passed via MessageChannel
   * @param key The query parameter key
   * @returns The query parameter value or null if not found
   */
  public getQueryParam(key: string): string | null {
    return this.pluginController.getQueryParam(key);
  }

  public static async getInstance(pluginController: PluginController): Promise<RimoriClient> {
    if (!RimoriClient.instance) {
      const client = await pluginController.getClient();
      RimoriClient.instance = new RimoriClient(client.supabase, client.info, pluginController);
    }
    return RimoriClient.instance;
  }

  private from<
    TableName extends string & keyof GenericSchema['Tables'],
    Table extends GenericSchema['Tables'][TableName],
  >(relation: TableName): PostgrestQueryBuilder<GenericSchema, Table, TableName>;
  private from<ViewName extends string & keyof GenericSchema['Views'], View extends GenericSchema['Views'][ViewName]>(
    relation: ViewName,
  ): PostgrestQueryBuilder<GenericSchema, View, ViewName>;
  private from(relation: string): PostgrestQueryBuilder<GenericSchema, any, any> {
    return this.superbase.from(this.getTableName(relation));
  }

  private getTableName(table: string) {
    if (/[A-Z]/.test(table)) {
      throw new Error('Table name cannot include uppercase letters. Please use snake_case for table names.');
    }
    if (table.startsWith('global_')) {
      return table.replace('global_', '');
    }
    return this.db.tablePrefix + '_' + table;
  }

  public ai = {
    getText: async (messages: Message[], tools?: Tool[]): Promise<string> => {
      const token = await this.pluginController.getToken();
      return generateText(this.pluginController.getBackendUrl(), messages, tools || [], token).then(
        ({ messages }) => messages[0].content[0].text,
      );
    },
    getSteamedText: async (messages: Message[], onMessage: OnLLMResponse, tools?: Tool[]) => {
      const token = await this.pluginController.getToken();
      streamChatGPT(this.pluginController.getBackendUrl(), messages, tools || [], onMessage, token);
    },
    getVoice: async (text: string, voice = 'alloy', speed = 1, language?: string): Promise<Blob> => {
      const token = await this.pluginController.getToken();
      return getTTSResponse(this.pluginController.getBackendUrl(), { input: text, voice, speed, language }, token);
    },
    getTextFromVoice: async (file: Blob): Promise<string> => {
      const token = await this.pluginController.getToken();
      return getSTTResponse(this.pluginController.getBackendUrl(), file, token);
    },
    getObject: async <T = any>(request: ObjectRequest): Promise<T> => {
      const token = await this.pluginController.getToken();
      return generateObject<T>(this.pluginController.getBackendUrl(), request, token);
    },
    // getSteamedObject: this.generateObjectStream,
  };

  public runtime = {
    fetchBackend: async (url: string, options: RequestInit) => {
      const token = await this.pluginController.getToken();
      return fetch(this.pluginController.getBackendUrl() + url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
  };

  public community = {
    /**
     * Shared content is a way to share completable content with other users using this plugin.
     * Typical examples are assignments, exercises, stories, etc.
     * Users generate new shared content items and others can complete the content too.
     */
    sharedContent: {
      /**
       * Get one dedicated shared content item by id. It does not matter if it is completed or not.
       * @param contentType The type of shared content to get. E.g. assignments, exercises, etc.
       * @param id The id of the shared content item.
       * @returns The shared content item.
       */
      get: async <T = any>(contentType: string, id: string): Promise<SharedContent<T>> => {
        return await this.sharedContentController.getSharedContent(contentType, id);
      },
      /**
       * Get a list of shared content items.
       * @param contentType The type of shared content to get. E.g. assignments, exercises, etc.
       * @param filter The optional additional filter for checking new shared content based on a column and value. This is useful if the aditional information stored on the shared content is used to further narrow down the kind of shared content wanted to be received. E.g. only adjective grammar exercises.
       * @param limit The optional limit for the number of results.
       * @returns The list of shared content items.
       */
      getList: async <T = any>(
        contentType: string,
        filter?: SharedContentFilter,
        limit?: number,
      ): Promise<SharedContent<T>[]> => {
        return await this.sharedContentController.getSharedContentList(contentType, filter, limit);
      },
      /**
       * Get new shared content.
       * @param contentType The type of shared content to fetch. E.g. assignments, exercises, etc.
       * @param generatorInstructions The instructions for the creation of new shared content. The object will automatically be extended with a tool property with a topic and keywords property to let a new unique topic be generated.
       * @param filter The optional additional filter for checking new shared content based on a column and value. This is useful if the aditional information stored on the shared content is used to further narrow down the kind of shared content wanted to be received. E.g. only adjective grammar exercises.
       * @param options An optional object with options for the new shared content.
       * @param options.privateTopic An optional flag to indicate if the topic should be private and only be visible to the user. This is useful if the topic is not meant to be shared with other users. Like for personal topics or if the content is based on the personal study goal.
       * @param options.skipDbSave An optional flag to indicate if the new shared content should not be saved to the database. This is useful if the new shared content is not meant to be saved to the database.
       * @param options.alwaysGenerateNew An optional flag to indicate if the new shared content should always be generated even if there is already a content with the same filter. This is useful if the new shared content is not meant to be saved to the database.
       * @param options.excludeIds An optional list of ids to exclude from the selection. This is useful if the new shared content is not meant to be saved to the database.
       * @returns The new shared content.
       */
      getNew: async <T = any>(
        contentType: string,
        generatorInstructions: SharedContentObjectRequest,
        filter?: SharedContentFilter,
        options?: { privateTopic?: boolean; skipDbSave?: boolean; alwaysGenerateNew?: boolean; excludeIds?: string[] },
      ): Promise<SharedContent<T>> => {
        return await this.sharedContentController.getNewSharedContent(
          contentType,
          generatorInstructions,
          filter,
          options,
        );
      },
      /**
       * Create a new shared content item.
       * @param content The content to create.
       * @returns The new shared content item.
       */
      create: async <T = any>(content: Omit<SharedContent<T>, 'id'>): Promise<SharedContent<T>> => {
        return await this.sharedContentController.createSharedContent(content);
      },
      /**
       * Update a shared content item.
       * @param id The id of the shared content item to update.
       * @param content The content to update.
       * @returns The updated shared content item.
       */
      update: async <T = any>(id: string, content: Partial<SharedContent<T>>): Promise<SharedContent<T>> => {
        return await this.sharedContentController.updateSharedContent(id, content);
      },
      /**
       * Complete a shared content item.
       * @param contentType The type of shared content to complete. E.g. assignments, exercises, etc.
       * @param assignmentId The id of the shared content item to complete.
       */
      complete: async (contentType: string, assignmentId: string) => {
        return await this.sharedContentController.completeSharedContent(contentType, assignmentId);
      },
      /**
       /**
        * Update the state of a shared content item for a specific user.
        * Useful for marking content as completed, ongoing, hidden, liked, disliked, or bookmarked.
        */
      updateState: async (params: {
        contentType: string;
        id: string;
        state?: 'completed' | 'ongoing' | 'hidden';
        reaction?: 'liked' | 'disliked' | null;
        bookmarked?: boolean;
      }): Promise<void> => {
        return await this.sharedContentController.updateSharedContentState(params);
      },
      /**
       * Remove a shared content item.
       * @param id The id of the shared content item to remove.
       * @returns The removed shared content item.
       */
      remove: async (id: string): Promise<SharedContent<any>> => {
        return await this.sharedContentController.removeSharedContent(id);
      },
    },
  };

  public exercise = {
    /**
     * Fetches weekly exercises from the weekly_exercises view.
     * Shows exercises for the current week that haven't expired.
     * @returns Array of exercise objects.
     */
    view: async () => {
      return this.exerciseController.viewWeeklyExercises();
    },

    /**
     * Creates a new exercise via the backend API.
     * @param params Exercise creation parameters.
     * @returns Created exercise object.
     */
    add: async (params: CreateExerciseParams) => {
      return this.exerciseController.addExercise(params);
    },

    /**
     * Deletes an exercise via the backend API.
     * @param id The exercise ID to delete.
     * @returns Success status.
     */
    delete: async (id: string) => {
      return this.exerciseController.deleteExercise(id);
    },
  };
}
