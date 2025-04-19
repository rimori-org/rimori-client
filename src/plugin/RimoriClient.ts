import { PluginController } from "./PluginController";
import { SupabaseClient } from "@supabase/supabase-js";
import { SettingsController } from "../controller/SettingsController";
import { GenericSchema } from "@supabase/supabase-js/dist/module/lib/types";
import { getSTTResponse, getTTSResponse } from "../controller/VoiceController";
import { PostgrestQueryBuilder, PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { SharedContentController, BasicAssignment } from "../controller/SharedContentController";
import { streamChatGPT, Message, Tool, OnLLMResponse, generateText } from "../controller/AIController";
import { generateObject as generateObjectFunction, ObjectRequest } from "../controller/ObjectController";
import { getPlugins, Plugin } from "../controller/SidePluginController";

interface RimoriClientOptions {
    pluginController: PluginController;
    supabase: SupabaseClient;
    tablePrefix: string;
    pluginId: string;
}

export class RimoriClient {
    private static instance: RimoriClient;
    private superbase: SupabaseClient;
    private plugin: PluginController;
    public functions: SupabaseClient["functions"];
    public storage: SupabaseClient["storage"];
    public pluginId: string;
    public tablePrefix: string;
    private settingsController: SettingsController;
    private sharedContentController: SharedContentController;

    private constructor(options: RimoriClientOptions) {
        this.superbase = options.supabase;
        this.pluginId = options.pluginId;
        this.plugin = options.pluginController;
        this.tablePrefix = options.tablePrefix;
        this.storage = this.superbase.storage;
        this.functions = this.superbase.functions;
        this.settingsController = new SettingsController(options.supabase, options.pluginId);
        this.sharedContentController = new SharedContentController(this);
        this.rpc = this.rpc.bind(this);
        this.from = this.from.bind(this);
        this.emit = this.emit.bind(this);
        this.request = this.request.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.getSettings = this.getSettings.bind(this);
        this.setSettings = this.setSettings.bind(this);
        this.getAIResponse = this.getAIResponse.bind(this);
        this.generateObject = this.generateObject.bind(this);
        this.getVoiceResponse = this.getVoiceResponse.bind(this);
        this.getAIResponseStream = this.getAIResponseStream.bind(this);
        this.getVoiceToTextResponse = this.getVoiceToTextResponse.bind(this);
    }

    public static async getInstance(pluginController: PluginController): Promise<RimoriClient> {
        if (!RimoriClient.instance) {
            const { supabase, tablePrefix, pluginId } = await pluginController.getClient();
            RimoriClient.instance = new RimoriClient({ pluginController, supabase, tablePrefix, pluginId });
        }
        return RimoriClient.instance;
    }

    public from<
        TableName extends string & keyof GenericSchema['Tables'],
        Table extends GenericSchema['Tables'][TableName]
    >(relation: TableName): PostgrestQueryBuilder<GenericSchema, Table, TableName>
    public from<
        ViewName extends string & keyof GenericSchema['Views'],
        View extends GenericSchema['Views'][ViewName]
    >(relation: ViewName): PostgrestQueryBuilder<GenericSchema, View, ViewName>
    public from(relation: string): PostgrestQueryBuilder<GenericSchema, any, any> {
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
    rpc<Fn extends GenericSchema['Functions'][string], FnName extends string & keyof GenericSchema['Functions']>(
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
        return this.tablePrefix + "_" + type;
    }

    public subscribe(eventName: string, callback: (_id: number, data: any) => void) {
        this.plugin.subscribe(eventName, callback);
    }

    public request<T>(eventName: string, data?: any): Promise<T> {
        return this.plugin.request(eventName, data);
    }

    public emit(eventName: string, data: any) {
        this.plugin.emit(eventName, data);
    }

    /**
    * Get the settings for the plugin. T can be any type of settings, UserSettings or SystemSettings.
    * @param defaultSettings The default settings to use if no settings are found.
    * @param genericSettings The type of settings to get.
    * @returns The settings for the plugin. 
    */
    public async getSettings<T extends object>(defaultSettings: T, genericSettings?: "user" | "system"): Promise<T> {
        return this.settingsController.getSettings<T>(defaultSettings, genericSettings);
    }

    public async setSettings(settings: any, genericSettings?: "user" | "system") {
        await this.settingsController.setSettings(settings, genericSettings);
    }

    public async getAIResponse(messages: Message[], tools?: Tool[]): Promise<string> {
        const token = await this.plugin.getToken();
        return generateText(messages, tools || [], token).then(response => response.messages[0].content[0].text);
    }

    public async getAIResponseStream(messages: Message[], onMessage: OnLLMResponse, tools?: Tool[]) {
        const token = await this.plugin.getToken();
        streamChatGPT(messages, tools || [], onMessage, token);
    }

    public async getVoiceResponse(text: string, voice = "alloy", speed = 1, language?: string): Promise<Blob> {
        return getTTSResponse(
            this.plugin.getSupabaseUrl(),
            { input: text, voice, speed, language },
            await this.plugin.getToken()
        );
    }

    public getVoiceToTextResponse(file: Blob): Promise<string> {
        return getSTTResponse(this.superbase, file);
    }

    /**
     * Fetches all installed plugins.
     * @returns A promise that resolves to an array of plugins
     */
    public async getPlugins(): Promise<Plugin[]> {
        return getPlugins(this.superbase);
    }

    public async generateObject(request: ObjectRequest): Promise<any> {
        const token = await this.plugin.getToken();
        return generateObjectFunction(request, token);
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
        this.emit("triggerSidebarAction", { pluginId, actionKey, text });
    }
}
