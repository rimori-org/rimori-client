import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserInfo } from '../core/controller/SettingsController';
import { EventBus, EventBusMessage } from '../fromRimori/EventBus';
import { ActivePlugin, Plugin } from '../fromRimori/PluginTypes';
import { RimoriClient } from "./RimoriClient";
import { StandaloneClient } from './StandaloneClient';
import { setTheme } from './ThemeSetter';
import { Logger } from './Logger';

// Add declaration for WorkerGlobalScope
declare const WorkerGlobalScope: any;

export interface RimoriInfo {
  url: string,
  key: string,
  backendUrl: string,
  token: string,
  expiration: Date,
  tablePrefix: string,
  pluginId: string
  installedPlugins: Plugin[]
  profile: UserInfo
  mainPanelPlugin?: ActivePlugin
  sidePanelPlugin?: ActivePlugin
}

export class PluginController {
  private static client: RimoriClient;
  private static instance: PluginController;
  private port: MessagePort | null = null;
  private queryParams: Record<string, string> = {};
  private supabase: SupabaseClient | null = null;
  private rimoriInfo: RimoriInfo | null = null;
  private pluginId: string;
  private isMessageChannelReady: boolean = false;
  private pendingRequests: Array<() => void> = [];

  private constructor(pluginId: string, standalone: boolean) {
    this.pluginId = pluginId;
    this.getClient = this.getClient.bind(this);

    if (typeof WorkerGlobalScope === 'undefined') {
      // In standalone mode, use URL fallback. In iframe mode, theme will be set after MessageChannel init
      if (standalone) {
        setTheme();
      }
    }

    //no need to forward messages to parent in standalone mode or worker context
    if (standalone) return;

    this.initMessageChannel(typeof WorkerGlobalScope !== 'undefined');
  }

  private initMessageChannel(worker: boolean = false) {
    const listener = (event: MessageEvent) => {
      console.log("[PluginController] window message", { origin: event.origin, data: event.data });
      const { type, pluginId, queryParams, rimoriInfo } = event.data || {};
      const [transferredPort] = event.ports || [];

      if (type !== "rimori:init" || !transferredPort || pluginId !== this.pluginId) {
        console.log("[PluginController] message ignored (not init or wrong plugin)", { type, pluginId, hasPort: !!transferredPort });
        return;
      }

      this.queryParams = queryParams || {};
      this.port = transferredPort;

      // Initialize Supabase client immediately with provided info
      if (rimoriInfo) {
        this.rimoriInfo = rimoriInfo;
        this.supabase = createClient(rimoriInfo.url, rimoriInfo.key, {
          accessToken: () => Promise.resolve(rimoriInfo.token)
        });
      }

      // Handle messages from parent
      this.port.onmessage = ({ data }) => {
        const { event, type, eventId, response, error } = data || {};

        // no idea why this is needed but it works for now
        if (type === 'response' && eventId) {
          EventBus.emit(this.pluginId, response.topic, response.data, eventId);
        } else if (type === 'error' && eventId) {
          EventBus.emit(this.pluginId, 'error', { error }, eventId);
        } else if (event) {
          const { topic, sender, data: eventData, eventId } = event as EventBusMessage;
          if (sender !== this.pluginId) {
            EventBus.emit(sender, topic, eventData, eventId);
          }
        }
      };

      // Set theme from MessageChannel query params
      if (!worker) {
        const theme = this.queryParams['rm_theme'];
        setTheme(theme);
      }

      // Forward plugin events to parent (only after MessageChannel is ready)
      EventBus.on("*", (ev) => {
        if (ev.sender === this.pluginId && !ev.topic.startsWith("self.")) {
          this.port?.postMessage({ event: ev });
        }
      });

      // Mark MessageChannel as ready and process pending requests
      this.isMessageChannelReady = true;

      // Process any pending requests
      this.pendingRequests.forEach(request => request());
      this.pendingRequests = [];
    };
    if (worker) {
      self.onmessage = listener;
    } else {
      window.addEventListener("message", listener);
    }
    this.sendHello(worker);
  }

  private sendHello(isWorker: boolean = false) {
    try {
      const payload = { type: "rimori:hello", pluginId: this.pluginId };
      if (isWorker) {
        self.postMessage(payload);
      } else {
        window.parent.postMessage(payload, "*");
      }
    } catch (e) {
      console.error("[PluginController] Error sending hello:", e);
    }
  }

  public static async getInstance(pluginId: string, standalone = false): Promise<RimoriClient> {
    if (!PluginController.instance) {
      if (standalone) {
        await StandaloneClient.initListeners(pluginId);
      }
      PluginController.instance = new PluginController(pluginId, standalone);
      PluginController.client = await RimoriClient.getInstance(PluginController.instance);

      //only init logger in workers and on main plugin pages
      if (PluginController.instance.getQueryParam("applicationMode") !== "sidebar") {
        Logger.getInstance(PluginController.client);
      }
    }
    return PluginController.client;
  }

  public getQueryParam(key: string): string | null {
    return this.queryParams[key] || null;
  }

  public async getClient(): Promise<{ supabase: SupabaseClient, info: RimoriInfo }> {
    // Return cached client if valid
    if (this.supabase && this.rimoriInfo && this.rimoriInfo.expiration > new Date()) {
      return { supabase: this.supabase, info: this.rimoriInfo };
    }

    // If MessageChannel is not ready yet, queue the request
    if (!this.isMessageChannelReady) {
      return new Promise<{ supabase: SupabaseClient, info: RimoriInfo }>((resolve) => {
        this.pendingRequests.push(async () => {
          const result = await this.getClient();
          resolve(result);
        });
      });
    }

    // If we have rimoriInfo from MessageChannel init, use it directly
    if (this.rimoriInfo && this.supabase) {
      return { supabase: this.supabase, info: this.rimoriInfo };
    }

    // Fallback: request from parent
    if (!this.rimoriInfo) {
      if (typeof WorkerGlobalScope !== 'undefined') {
        // In worker context, send request via self.postMessage to WorkerHandler
        const eventId = Math.floor(Math.random() * 1000000000);
        const requestEvent = {
          event: {
            timestamp: new Date().toISOString(),
            eventId,
            sender: this.pluginId,
            topic: 'global.supabase.requestAccess',
            data: {},
            debug: false
          }
        };

        return new Promise<{ supabase: SupabaseClient, info: RimoriInfo }>((resolve) => {
          // Listen for the response
          const originalOnMessage = self.onmessage;
          self.onmessage = (event) => {
            if (event.data?.topic === 'global.supabase.requestAccess' && event.data?.eventId === eventId) {
              this.rimoriInfo = event.data.data;
              this.supabase = createClient(this.rimoriInfo!.url, this.rimoriInfo!.key, {
                accessToken: () => Promise.resolve(this.getToken())
              });
              self.onmessage = originalOnMessage; // Restore original handler
              resolve({ supabase: this.supabase, info: this.rimoriInfo! });
            } else if (originalOnMessage) {
              originalOnMessage.call(self, event);
            }
          };

          // Send the request
          self.postMessage(requestEvent);
        });
      } else {
        // In main thread context, use EventBus
        const { data } = await EventBus.request<RimoriInfo>(this.pluginId, "global.supabase.requestAccess");
        this.rimoriInfo = data;
        this.supabase = createClient(this.rimoriInfo.url, this.rimoriInfo.key, {
          accessToken: () => Promise.resolve(this.getToken())
        });
      }
    }

    return { supabase: this.supabase!, info: this.rimoriInfo };
  }

  public async getToken(): Promise<string> {
    if (this.rimoriInfo && this.rimoriInfo.expiration && this.rimoriInfo.expiration > new Date()) {
      return this.rimoriInfo.token;
    }

    // If we don't have rimoriInfo, request it
    if (!this.rimoriInfo) {
      const { data } = await EventBus.request<RimoriInfo>(this.pluginId, "global.supabase.requestAccess");
      this.rimoriInfo = data;
      return this.rimoriInfo.token;
    }

    // If token is expired, request fresh access
    const { data } = await EventBus.request<{ token: string, expiration: Date }>(this.pluginId, "global.supabase.requestAccess");
    this.rimoriInfo.token = data.token;
    this.rimoriInfo.expiration = data.expiration;

    return this.rimoriInfo.token;
  }

  /**
   * Gets the Supabase URL.
   * @returns The Supabase URL.
   * @deprecated All endpoints should use the backend URL instead.
   */
  public getSupabaseUrl() {
    if (!this.rimoriInfo) {
      throw new Error("Supabase info not found");
    }

    return this.rimoriInfo.url;
  }

  public getBackendUrl() {
    if (!this.rimoriInfo) {
      throw new Error("Rimori info not found");
    }
    return this.rimoriInfo.backendUrl;
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