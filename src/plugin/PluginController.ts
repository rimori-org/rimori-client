import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { RimoriClient } from "./RimoriClient";

interface SupabaseInfo {
    url: string,
    key: string,
    token: string,
    expiration: Date,
    tablePrefix: string,
    pluginId: string
}
type EventPayload = Record<string, any>;

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
}

export type ListenerCallback<T> = (data: T, event: EventBusMessage) => void;

export class PluginController {
    private static instance: PluginController;
    private static client: RimoriClient;
    private onceListeners: Map<string, any[]> = new Map();
    private listeners: Map<string, any[]> = new Map();
    private communicationSecret: string | null = null;
    private supabase: SupabaseClient | null = null;
    private supabaseInfo: SupabaseInfo | null = null;
    private uninitialzedSender: string;

    private constructor(sender: string) {
        this.uninitialzedSender = sender;
        window.addEventListener("message", (event) => {
            console.log("client: message received", event);
            const { topic, sender, data } = event.data.event as EventBusMessage;

            if (sender === this.uninitialzedSender) {
                // console.log("client: message received from own uninitialized plugin. Skipping.", event);
                return;
            }

            this.onceListeners.get(topic)?.forEach((callback: any) => callback(data, event.data.event));
            this.onceListeners.set(topic, []);
            this.listeners.get(topic)?.forEach((callback: any) => callback(data, event.data.event));
        });

        this.emit = this.emit.bind(this);
        this.onOnce = this.onOnce.bind(this);
        this.request = this.request.bind(this);
        this.getClient = this.getClient.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.internalEmit = this.internalEmit.bind(this);
    }

    public static async getInstance(sender: string): Promise<RimoriClient> {
        if (!PluginController.instance) {
            PluginController.instance = new PluginController(sender);
            // console.log('[PluginController] instance created', PluginController.instance);
            PluginController.client = await RimoriClient.getInstance(PluginController.instance);
            // console.log('[PluginController] RimoriClient instance created', PluginController.client);
        }
        // console.log('[PluginController] instance returned', PluginController.client);
        return PluginController.client;
    }

    private getSecret() {
        if (!this.communicationSecret) {
            const secret = new URLSearchParams(window.location.search).get("secret");
            if (!secret) {
                throw new Error("Communication secret not found in URL as query parameter");
            }
            this.communicationSecret = secret;
        }
        return this.communicationSecret;
    }

    public async getClient(): Promise<{ supabase: SupabaseClient, tablePrefix: string, pluginId: string }> {
        if (
            this.supabase &&
            this.supabaseInfo &&
            this.supabaseInfo.expiration > new Date()
        ) {
            return { supabase: this.supabase, tablePrefix: this.supabaseInfo.tablePrefix, pluginId: this.supabaseInfo.pluginId };
        }

        this.supabaseInfo = await this.request<SupabaseInfo>("global.supabase.requestAccess");
        this.supabase = createClient(this.supabaseInfo.url, this.supabaseInfo.key, {
            accessToken: () => Promise.resolve(this.getToken())
        });

        return { supabase: this.supabase, tablePrefix: this.supabaseInfo.tablePrefix, pluginId: this.supabaseInfo.pluginId };
    }

    public async getToken() {
        if (this.supabaseInfo && this.supabaseInfo.expiration && this.supabaseInfo.expiration > new Date()) {
            return this.supabaseInfo.token;
        }

        const response = await this.request<{ token: string, expiration: Date }>("global.supabase.requestAccess");

        if (!this.supabaseInfo) {
            throw new Error("Supabase info not found");
        }

        this.supabaseInfo.token = response.token;
        this.supabaseInfo.expiration = response.expiration;

        return this.supabaseInfo.token;
    }

    public getSupabaseUrl() {
        if (!this.supabaseInfo) {
            throw new Error("Supabase info not found");
        }

        return this.supabaseInfo.url;
    }

    public emit(topic: string, data?: any, eventId?: number) {
        this.internalEmit(topic, eventId ?? 0, data);
    }

    // every message between the parent and the plugin needs to have an id to be able to distinguish it from other messages. Otherwise a message having the same topic will be received in multiple places whenever the topic is emitted.
    private async internalEmit(topic: string, eventId: number, data?: any) {
        const event: EventBusMessage = {
            eventId,
            topic: this.getTopic(topic),
            timestamp: new Date().toISOString(),
            sender: this.supabaseInfo?.pluginId ?? this.uninitialzedSender,
            data,
        }
        window.parent.postMessage({ event, secret: this.getSecret() }, "*")
    }

    private getTopic(preliminaryTopic: string) {
        if (preliminaryTopic.startsWith("global.")) {
            return preliminaryTopic;
        }
        const topicParts = preliminaryTopic.split(".");
        if (topicParts.length === 3) {
            if (![this.supabaseInfo?.pluginId, "global"].includes(topicParts[0])) {
                throw new Error("The event topic must start with the plugin id or 'global'.");
            }
            return preliminaryTopic;
        }

        const topicRoot = this.supabaseInfo?.pluginId ?? "global";
        return `${topicRoot}.${preliminaryTopic}`;
    }

    public subscribe<T = any>(topic: string, callback: ListenerCallback<T>) {
        const globalTopic = this.getTopic(topic);

        if (!this.listeners.has(globalTopic)) {
            this.listeners.set(globalTopic, []);
        }

        this.listeners.get(globalTopic)?.push(callback);
    }

    public onOnce<T = any>(topic: string, callback: ListenerCallback<T>) {
        const globalTopic = this.getTopic(topic);

        if (!this.onceListeners.has(globalTopic)) {
            this.onceListeners.set(globalTopic, []);
        }

        this.onceListeners.get(globalTopic)?.push(callback);
    }

    async request<T>(topic: string, data: any = {}): Promise<T> {
        const globalTopic = this.getTopic(topic);

        return await new Promise((resolve) => {
            const messageId = Math.random();
            let triggered = false;

            this.subscribe(globalTopic, (data: any, event) => {
                // console.log('[PluginController] request: received message', { eventId: event.eventId, data, globalTopic, messageId });
                if (triggered || (event.eventId !== messageId && event.eventId !== 0)) return;
                triggered = true;

                resolve(data)
            })
            this.internalEmit(globalTopic, messageId, data)
        });
    }
}