import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserInfo } from '../core/controller/SettingsController';
import { EventBus, EventBusMessage } from '../fromRimori/EventBus';
import { Plugin } from '../fromRimori/PluginTypes';
import { RimoriClient } from "./RimoriClient";
import { StandaloneClient } from './StandaloneClient';
import { setTheme } from './ThemeSetter';

// Add declaration for WorkerGlobalScope
declare const WorkerGlobalScope: any;

export interface RimoriInfo {
  url: string,
  key: string,
  token: string,
  expiration: Date,
  tablePrefix: string,
  pluginId: string
  installedPlugins: Plugin[]
  profile: UserInfo
}

export class PluginController {
  private static client: RimoriClient;
  private static instance: PluginController;
  private communicationSecret: string | null = null;
  private supabase: SupabaseClient | null = null;
  private rimoriInfo: RimoriInfo | null = null;
  private pluginId: string;

  private constructor(pluginId: string, standalone: boolean) {
    this.pluginId = pluginId;
    this.getClient = this.getClient.bind(this);

    if (typeof WorkerGlobalScope === 'undefined') {
      setTheme();
    }

    //no need to forward messages to parent in standalone mode
    if (standalone) return;

    window.addEventListener("message", (event) => {
      // console.log("client: message received", event);
      const { topic, sender, data, eventId } = event.data.event as EventBusMessage;

      // skip forwarding messages from own plugin
      if (sender === pluginId) return;

      EventBus.emit(sender, topic, data, eventId);
    });

    const secret = this.getSecret();

    EventBus.on("*", (event) => {
      // skip messages which are not from the own plugin
      if (event.sender !== this.pluginId) return;
      if (event.topic.startsWith("self.")) return;
      // console.log("sending event to parent", event);
      window.parent.postMessage({ event, secret }, "*")
    });
  }

  public static async getInstance(pluginId: string, standalone = false): Promise<RimoriClient> {
    if (!PluginController.instance) {
      if (standalone) {
        await StandaloneClient.initListeners(pluginId);
      }
      PluginController.instance = new PluginController(pluginId, standalone);
      PluginController.client = await RimoriClient.getInstance(PluginController.instance);
    }
    return PluginController.client;
  }

  private getSecret(): string | null {
    if (!this.communicationSecret) {
      const secret = new URLSearchParams(window.location.search).get("secret");
      if (!secret) {
        console.info("Communication secret not found in URL as query parameter");
      }
      this.communicationSecret = secret;
    }
    return this.communicationSecret;
  }

  public async getClient(): Promise<{ supabase: SupabaseClient, info: RimoriInfo }> {
    if (
      this.supabase &&
      this.rimoriInfo &&
      this.rimoriInfo.expiration > new Date()
    ) {
      return { supabase: this.supabase, info: this.rimoriInfo };
    }

    const { data } = await EventBus.request<RimoriInfo>(this.pluginId, "global.supabase.requestAccess");
    this.rimoriInfo = data;
    this.supabase = createClient(this.rimoriInfo.url, this.rimoriInfo.key, {
      accessToken: () => Promise.resolve(this.getToken())
    });

    return { supabase: this.supabase, info: this.rimoriInfo };
  }

  public async getToken() {
    if (this.rimoriInfo && this.rimoriInfo.expiration && this.rimoriInfo.expiration > new Date()) {
      return this.rimoriInfo.token;
    }

    const { data } = await EventBus.request<{ token: string, expiration: Date }>(this.pluginId, "global.supabase.requestAccess");

    if (!this.rimoriInfo) {
      throw new Error("Supabase info not found");
    }

    this.rimoriInfo.token = data.token;
    this.rimoriInfo.expiration = data.expiration;

    return this.rimoriInfo.token;
  }

  public getSupabaseUrl() {
    if (!this.rimoriInfo) {
      throw new Error("Supabase info not found");
    }

    return this.rimoriInfo.url;
  }

  public getGlobalEventTopic(preliminaryTopic: string) {
    if (preliminaryTopic.startsWith("global.")) {
      return preliminaryTopic;
    }
    if (preliminaryTopic.startsWith("self.")) {
      return preliminaryTopic;
    }
    const topicParts = preliminaryTopic.split(".");
    if (topicParts.length === 3) {
      if (!topicParts[0].startsWith("pl") && topicParts[0] !== "global") {
        throw new Error("The event topic must start with the plugin id or 'global'.");
      }
      return preliminaryTopic;
    } else if (topicParts.length > 3) {
      throw new Error(`The event topic must consist of 3 parts. <pluginId>.<topic area>.<action>. Received: ${preliminaryTopic}`);
    }

    const topicRoot = this.rimoriInfo?.pluginId ?? "global";
    return `${topicRoot}.${preliminaryTopic}`;
  }

}