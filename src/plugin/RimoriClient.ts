import { EventBusMessage, ListenerCallback, PluginController } from "./PluginController";
import { SupabaseClient } from "@supabase/supabase-js";
import { SettingsController } from "../controller/SettingsController";
import { GenericSchema } from "@supabase/supabase-js/dist/module/lib/types";
import { getSTTResponse, getTTSResponse } from "../controller/VoiceController";
import { PostgrestQueryBuilder, PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { SharedContentController, BasicAssignment } from "../controller/SharedContentController";
import { streamChatGPT, Message, Tool, OnLLMResponse, generateText } from "../controller/AIController";
import { generateObject as generateObjectFunction, ObjectRequest } from "../controller/ObjectController";
import { getPlugins, Plugin } from "../controller/SidePluginController";
import { UserInfo } from "../controller/SettingsController";

interface RimoriClientOptions {
    pluginController: PluginController;
    supabase: SupabaseClient;
    tablePrefix: string;
    pluginId: string;
}

interface Db {
    from: {
        <TableName extends string & keyof GenericSchema['Tables'], Table extends GenericSchema['Tables'][TableName]>(relation: TableName): PostgrestQueryBuilder<GenericSchema, Table, TableName>;
        <ViewName extends string & keyof GenericSchema['Views'], View extends GenericSchema['Views'][ViewName]>(relation: ViewName): PostgrestQueryBuilder<GenericSchema, View, ViewName>;
    };
    rpc: <Fn extends GenericSchema['Functions'][string], FnName extends string & keyof GenericSchema['Functions']>(functionName: FnName, args?: Fn["Args"], options?: {
        head?: boolean;
        get?: boolean;
        count?: "exact" | "planned" | "estimated";
    }) => PostgrestFilterBuilder<GenericSchema, Fn["Returns"] extends any[] ? Fn["Returns"][number] extends Record<string, unknown> ? Fn["Returns"][number] : never : never, Fn["Returns"], string, null>;
    functions: SupabaseClient["functions"];
    storage: SupabaseClient["storage"];
}

interface PluginInterface {
    pluginId: string;
    tablePrefix: string;
    setSettings: (settings: any) => Promise<void>;
    /**
     * Get the settings for the plugin. T can be any type of settings, UserSettings or SystemSettings.
     * @param defaultSettings The default settings to use if no settings are found.
     * @param genericSettings The type of settings to get.
     * @returns The settings for the plugin. 
     */
    getSettings: <T extends object>(defaultSettings: T) => Promise<T>;
     /**
     * Fetches all installed plugins.
     * @returns A promise that resolves to an array of plugins
     */
    getInstalled: () => Promise<Plugin[]>;
    getUserInfo: () => Promise<UserInfo>;
}

export class RimoriClient {
    private static instance: RimoriClient;
    private superbase: SupabaseClient;
    private pluginController: PluginController;
    private settingsController: SettingsController;
    private sharedContentController: SharedContentController;
    private supabaseUrl: string;
    public db: Db;
    public plugin: PluginInterface;

    private constructor(options: RimoriClientOptions) {
        this.superbase = options.supabase;
        this.pluginController = options.pluginController;
        this.settingsController = new SettingsController(options.supabase, options.pluginId);
        this.sharedContentController = new SharedContentController(this);
        this.supabaseUrl = this.pluginController.getSupabaseUrl();

        this.rpc = this.rpc.bind(this);
        this.from = this.from.bind(this);

        this.db = {
            rpc: this.rpc,
            from: this.from,
            storage: this.superbase.storage,
            functions: this.superbase.functions,
        }
        this.plugin = {
            pluginId: options.pluginId,
            tablePrefix: options.tablePrefix,
            setSettings: async (settings: any) => {
                await this.settingsController.setSettings(settings);
            },
            getSettings: async <T extends object>(defaultSettings: T): Promise<T> => {
                return await this.settingsController.getSettings<T>(defaultSettings);
            },
            getInstalled: async (): Promise<Plugin[]> => {
                return getPlugins(this.superbase);
            },
            getUserInfo: async (): Promise<UserInfo> => {
                return this.settingsController.getUserInfo();
            }
        }
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
        emit: (topic: string, data: any, eventId?: number) => {
            this.pluginController.emit(topic, data, eventId);
        },
        /**
         * Request an event.
         * @param topic The topic to request the event on.
         * @param data The data to request.
         * @returns The response from the event.
         */
        request: <T>(topic: string, data?: any): Promise<T> => {
            return this.pluginController.request<T>(topic, data);
        },
        /**
         * Subscribe to an event.
         * @param topic The topic to subscribe to.
         * @param callback The callback to call when the event is emitted.
         */
        subscribe: <T = any>(topic: string, callback: ListenerCallback<T>) => {
            this.pluginController.subscribe(topic, callback);
        },
        /**
         * Subscribe to an event once.
         * @param topic The topic to subscribe to.
         * @param callback The callback to call when the event is emitted.
         */
        once: <T = any>(topic: string, callback: ListenerCallback<T>) => {
            this.pluginController.onOnce(topic, callback);
        }
    }

    public static async getInstance(pluginController: PluginController): Promise<RimoriClient> {
        if (!RimoriClient.instance) {
            const { supabase, tablePrefix, pluginId } = await pluginController.getClient();
            RimoriClient.instance = new RimoriClient({ pluginController, supabase, tablePrefix, pluginId });
        }
        return RimoriClient.instance;
    }

    private from<
        TableName extends string & keyof GenericSchema['Tables'],
        Table extends GenericSchema['Tables'][TableName]
    >(relation: TableName): PostgrestQueryBuilder<GenericSchema, Table, TableName>
    private from<
        ViewName extends string & keyof GenericSchema['Views'],
        View extends GenericSchema['Views'][ViewName]
    >(relation: ViewName): PostgrestQueryBuilder<GenericSchema, View, ViewName>
    private from(relation: string): PostgrestQueryBuilder<GenericSchema, any, any> {
        return this.superbase.from(this.getTableName(relation));
    }

    /**
    * Perform a function call.
    *
    * @param functionName - The function name to call
    * @param args - The arguments to pass to the function call
    * @param options - Named parameters
    * @param options.head - When set to `true`, `data` will not be returned.
    * Useful if you only need the count.
    * @param options.get - When set to `true`, the function will be called with
    * read-only access mode.
    * @param options.count - Count algorithm to use to count rows returned by the
    * function. Only applicable for [set-returning
    * functions](https://www.postgresql.org/docs/current/functions-srf.html).
    *
    * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
    * hood.
    *
    * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
    * statistics under the hood.
    *
    * `"estimated"`: Uses exact count for low numbers and planned count for high
    * numbers.
    */
    private rpc<Fn extends GenericSchema['Functions'][string], FnName extends string & keyof GenericSchema['Functions']>(
        functionName: FnName,
        args: Fn['Args'] = {},
        options: {
            head?: boolean
            get?: boolean
            count?: 'exact' | 'planned' | 'estimated'
        } = {}
    ): PostgrestFilterBuilder<
        GenericSchema,
        Fn['Returns'] extends any[]
        ? Fn['Returns'][number] extends Record<string, unknown>
        ? Fn['Returns'][number]
        : never
        : never,
        Fn['Returns'],
        string,
        null
    > {
        return this.superbase.rpc(this.getTableName(functionName), args, options)
    }

    private getTableName(type: string) {
        return this.plugin.tablePrefix + "_" + type;
    }

    public llm = {
        getText: async (messages: Message[], tools?: Tool[]): Promise<string> => {
            const token = await this.pluginController.getToken();
            return generateText(this.supabaseUrl, messages, tools || [], token).then(response => response.messages[0].content[0].text);
        },
        getSteamedText: async (messages: Message[], onMessage: OnLLMResponse, tools?: Tool[]) => {
            const token = await this.pluginController.getToken();
            streamChatGPT(this.supabaseUrl, messages, tools || [], onMessage, token);
        },
        getVoice: async (text: string, voice = "alloy", speed = 1, language?: string): Promise<Blob> => {
            return getTTSResponse(
                this.pluginController.getSupabaseUrl(),
                { input: text, voice, speed, language },
                await this.pluginController.getToken()
            );
        },
        getTextFromVoice: (file: Blob): Promise<string> => {
            return getSTTResponse(this.superbase, file);
        },
        getObject: async (request: ObjectRequest): Promise<any> => {
            const token = await this.pluginController.getToken();
            return generateObjectFunction(this.pluginController.getSupabaseUrl(), request, token);
        },
        // getSteamedObject: this.generateObjectStream,
    }

    /**
     * Fetch new shared content.
     * @param type The type of shared content to fetch. E.g. assignments, exercises, etc.
     * @param generatorInstructions The instructions for the generator.
     * @param filter The filter for the shared content.
     * @returns The new shared content.
     */
    public async fetchNewSharedContent<T, R = T & BasicAssignment>(
        type: string,
        generatorInstructions: (reservedTopics: string[]) => Promise<ObjectRequest> | ObjectRequest,
        filter?: { column: string, value: string | number | boolean },
    ): Promise<R[]> {
        return this.sharedContentController.fetchNewSharedContent(type, generatorInstructions, filter);
    }

    /**
     * Get a shared content item by id.
     * @param type The type of shared content to get. E.g. assignments, exercises, etc.
     * @param id The id of the shared content item.
     * @returns The shared content item.
     */
    public async getSharedContent<T extends BasicAssignment>(type: string, id: string): Promise<T> {
        return this.sharedContentController.getSharedContent(type, id);
    }

    /**
     * Complete a shared content item.
     * @param type The type of shared content to complete. E.g. assignments, exercises, etc.
     * @param assignmentId The id of the shared content item to complete.
     */
    public async completeSharedContent(type: string, assignmentId: string) {
        return this.sharedContentController.completeSharedContent(type, assignmentId);
    }

    public triggerSidebarAction(pluginId: string, actionKey: string, text?: string) {
        this.pluginController.emit("global.sidebar.triggerAction", { pluginId, actionKey, text });
    }
}
