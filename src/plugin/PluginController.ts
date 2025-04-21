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

export class PluginController {
    private static instance: PluginController;
    private static client: RimoriClient;
    private onceListeners: Map<string, any[]> = new Map();
    private listeners: Map<string, any[]> = new Map();
    private communicationSecret: string | null = null;
    private supabase: SupabaseClient | null = null;
    private supabaseInfo: SupabaseInfo | null = null;

    private constructor() {
        window.addEventListener("message", (event) => {
            // console.log("client: message received", event);

            const { topic, id, data } = event.data;

            this.onceListeners.get(topic)?.forEach((callback: any) => callback(id, data));
            this.onceListeners.set(topic, []);
            this.listeners.get(topic)?.forEach((callback: any) => callback(id, data));
        });

        this.emit = this.emit.bind(this);
        this.onOnce = this.onOnce.bind(this);
        this.getClient = this.getClient.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.internalEmit = this.internalEmit.bind(this);
        this.request = this.request.bind(this);
    }

    public static async getInstance(): Promise<RimoriClient> {
        if (!PluginController.instance) {
            PluginController.instance = new PluginController();
            PluginController.client = await RimoriClient.getInstance(
                PluginController.instance
            );
        }
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

        this.supabaseInfo = await this.request<SupabaseInfo>("getSupabaseAccess");

        this.supabase = createClient(this.supabaseInfo.url, this.supabaseInfo.key, {
            accessToken: () => Promise.resolve(this.getToken())
        });

        return { supabase: this.supabase, tablePrefix: this.supabaseInfo.tablePrefix, pluginId: this.supabaseInfo.pluginId };
    }

    public async getToken() {
        if (this.supabaseInfo && this.supabaseInfo.expiration && this.supabaseInfo.expiration > new Date()) {
            return this.supabaseInfo.token;
        }

        const response = await this.request<{ token: string, expiration: Date }>("getSupabaseAccess");

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

    public emit(eventName: string, data?: any) {
        this.internalEmit(eventName, 0, data);
    }

    // every message between the parent and the plugin needs to have an id to be able to distinguish it from other messages. Otherwise a message having the same topic will be received in multiple places whenever the topic is emitted.
    private async internalEmit(topic: string, id: number, data?: any, skipInit?: boolean) {
        window.parent.postMessage({ id, data, topic, secret: this.getSecret() }, "*")
    }

    public subscribe(eventName: string, callback: (id: number, data: any) => void) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        this.listeners.get(eventName)?.push(callback);
    }

    public onOnce(eventName: string, callback: (data: any) => void) {
        if (!this.onceListeners.has(eventName)) {
            this.onceListeners.set(eventName, []);
        }

        this.onceListeners.get(eventName)?.push(callback);
    }

    async request<T>(topic: string, data: any = {}): Promise<T> {
        return await new Promise((resolve) => {
            const messageId = Math.random();
            let triggered = false;

            this.subscribe(topic, (id: number, data: any) => {
                if (triggered || (id !== messageId && id !== 0)) return;
                triggered = true;

                resolve(data)
            })
            this.internalEmit(topic, messageId, data)
        });
    }
}