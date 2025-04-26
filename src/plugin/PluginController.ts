import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { RimoriClient } from "./RimoriClient";
import { EventBus, EventBusMessage } from './fromRimori/EventBus';

interface SupabaseInfo {
    url: string,
    key: string,
    token: string,
    expiration: Date,
    tablePrefix: string,
    pluginId: string
}

export class PluginController {
    private static client: RimoriClient;
    private static instance: PluginController;
    private communicationSecret: string | null = null;
    private supabase: SupabaseClient | null = null;
    private supabaseInfo: SupabaseInfo | null = null;
    private pluginId: string;

    private constructor(pluginId: string) {
        this.pluginId = pluginId;
        this.getClient = this.getClient.bind(this);

        window.addEventListener("message", (event) => {
            // console.log("client: message received", event);
            const { topic, sender, data, eventId } = event.data.event as EventBusMessage;

            // skip forwarding messages from own plugin
            if (sender === pluginId) return;

            EventBus.emit(sender, topic, data, eventId);
        });

        EventBus.on("*", (event) => {
            // skip messages which are not from the own plugin
            if (event.sender !== this.pluginId) return;
            window.parent.postMessage({ event, secret: this.getSecret() }, "*")
        });
    }

    public static async getInstance(sender: string): Promise<RimoriClient> {
        if (!PluginController.instance) {
            PluginController.instance = new PluginController(sender);
            PluginController.client = await RimoriClient.getInstance(PluginController.instance);
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

        const {data} = await EventBus.request<SupabaseInfo>(this.pluginId, "global.supabase.requestAccess");
        this.supabaseInfo = data;
        this.supabase = createClient(this.supabaseInfo.url, this.supabaseInfo.key, {
            accessToken: () => Promise.resolve(this.getToken())
        });

        return { supabase: this.supabase, tablePrefix: this.supabaseInfo.tablePrefix, pluginId: this.supabaseInfo.pluginId };
    }

    public async getToken() {
        if (this.supabaseInfo && this.supabaseInfo.expiration && this.supabaseInfo.expiration > new Date()) {
            return this.supabaseInfo.token;
        }

        const {data} = await EventBus.request<{ token: string, expiration: Date }>(this.pluginId, "global.supabase.requestAccess");

        if (!this.supabaseInfo) {
            throw new Error("Supabase info not found");
        }

        this.supabaseInfo.token = data.token;
        this.supabaseInfo.expiration = data.expiration;

        return this.supabaseInfo.token;
    }

    public getSupabaseUrl() {
        if (!this.supabaseInfo) {
            throw new Error("Supabase info not found");
        }

        return this.supabaseInfo.url;
    }

    public getGlobalEventTopic(preliminaryTopic: string) {
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

}