import {
  SharedContent,
  SharedContentController,
  SharedContentFilter,
  SharedContentObjectRequest,
} from '../controller/SharedContentController';
import { RimoriCommunicationHandler, RimoriInfo } from './CommunicationHandler';
import { Logger } from './Logger';
import { PluginModule } from './module/PluginModule';
import { DbModule } from './module/DbModule';
import { EventModule } from './module/EventModule';
import { AIModule } from './module/AIModule';
import { ExerciseModule } from './module/ExerciseModule';
import { PostgrestClient } from '@supabase/postgrest-js';

// Add declaration for WorkerGlobalScope
declare const WorkerGlobalScope: any;

export class RimoriClient {
  private static instance: RimoriClient;
  private pluginController: RimoriCommunicationHandler;
  private sharedContentController: SharedContentController;
  public db: DbModule;
  public event: EventModule;
  public plugin: PluginModule;
  public ai: AIModule;
  public exercise: ExerciseModule;
  private rimoriInfo: RimoriInfo;

  private constructor(controller: RimoriCommunicationHandler, supabase: PostgrestClient, info: RimoriInfo) {
    this.rimoriInfo = info;
    this.pluginController = controller;
    this.sharedContentController = new SharedContentController(supabase, this);
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

  public navigation = {
    toDashboard: (): void => {
      this.event.emit('global.navigation.triggerToDashboard');
    },
  };

  /**
   * Get a query parameter value that was passed via MessageChannel
   * @param key The query parameter key
   * @deprecated Use the plugin.applicationMode and plugin.theme properties instead
   * @returns The query parameter value or null if not found
   */
  public getQueryParam(key: string): string | null {
    return this.pluginController.getQueryParam(key);
  }

  public static async getInstance(pluginId?: string): Promise<RimoriClient> {
    if (!RimoriClient.instance) {
      if (!pluginId) throw new Error('Plugin ID is required');

      const controller = new RimoriCommunicationHandler(pluginId, false);

      if (typeof WorkerGlobalScope === 'undefined') {
        // In standalone mode, use URL fallback. In iframe mode, theme will be set after MessageChannel init
        // setTheme();
        // await StandaloneClient.initListeners(pluginId);
      }
      const client = await controller.getClient();
      RimoriClient.instance = new RimoriClient(controller, client.supabase, client.info);
    }
    return RimoriClient.instance;
  }

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
}

// test 123456
console.log('test 123456');
