import { UserInfo } from './module/PluginModule';
import { PostgrestClient } from '@supabase/postgrest-js';
import { ActivePlugin, Plugin } from '../fromRimori/PluginTypes';
import { EventBus, EventBusMessage } from '../fromRimori/EventBus';

// Add declaration for WorkerGlobalScope
declare const WorkerGlobalScope: any;

export type SupabaseClient = PostgrestClient;

export interface Guild {
  allowUserPluginSettings: boolean;
  city: string | null;
  country: string | null;
  description: string | null;
  id: string;
  isPublic: boolean;
  name: string;
  ownerId: string;
  primaryLanguage: string;
  scope: string;
}

export interface RimoriInfo {
  url: string;
  key: string;
  backendUrl: string;
  token: string;
  expiration: Date;
  tablePrefix: string;
  pluginId: string;
  guild: Guild;
  installedPlugins: Plugin[];
  profile: UserInfo;
  mainPanelPlugin?: ActivePlugin;
  sidePanelPlugin?: ActivePlugin;
  interfaceLanguage: string;
  /**
   * The release channel of the plugin installation.
   */
  releaseChannel: 'alpha' | 'beta' | 'stable';
  /**
   * The database schema to use for plugin tables.
   * Determined by rimori-main based on release channel:
   * - 'plugins_alpha' for alpha release channel
   * - 'plugins' for beta and stable release channels
   */
  dbSchema: 'plugins' | 'plugins_alpha';
}

export class RimoriCommunicationHandler {
  private port: MessagePort | null = null;
  private queryParams: Record<string, string> = {};
  private supabase: SupabaseClient | null = null;
  private rimoriInfo: RimoriInfo | null = null;
  private pluginId: string;
  private isMessageChannelReady = false;
  private pendingRequests: Array<() => void> = [];
  private updateCallbacks: Set<(info: RimoriInfo) => void> = new Set();

  public constructor(pluginId: string, standalone: boolean) {
    this.pluginId = pluginId;
    this.getClient = this.getClient.bind(this);

    //no need to forward messages to parent in standalone mode or worker context
    if (standalone) return;

    this.initMessageChannel(typeof WorkerGlobalScope !== 'undefined');
  }

  private initMessageChannel(worker = false): void {
    const listener = (event: MessageEvent) => {
      // console.log('[PluginController] window message', { origin: event.origin, data: event.data });
      const { type, pluginId, queryParams, rimoriInfo } = event.data || {};
      const [transferredPort] = event.ports || [];

      if (type !== 'rimori:init' || !transferredPort || pluginId !== this.pluginId) {
        // console.log('[PluginController] message ignored (not init or wrong plugin)', {
        //   type,
        //   pluginId,
        //   currentPluginId: this.pluginId,
        //   hasPortProperty: !!transferredPort,
        //   event
        // });
        return;
      }

      this.queryParams = queryParams || {};
      this.port = transferredPort;

      // Initialize Supabase client immediately with provided info
      if (rimoriInfo) {
        this.rimoriInfo = rimoriInfo;
        this.supabase = this.getSupabase(rimoriInfo.url, rimoriInfo.key, rimoriInfo.token);
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
          } else {
            console.log('[PluginController] event from self', event);
          }
        }
      };

      // Forward plugin events to parent (only after MessageChannel is ready)
      EventBus.on('*', (ev) => {
        if (ev.sender === this.pluginId && !ev.topic.startsWith('self.')) {
          this.port?.postMessage({ event: ev });
        }
      });

      // Listen for updates from rimori-main (data changes, token refresh, etc.)
      // Topic format: {pluginId}.supabase.triggerUpdate
      EventBus.on(`${this.pluginId}.supabase.triggerUpdate`, (ev) => {
        // console.log('[RimoriCommunicationHandler] Received update from rimori-main', ev.data);
        this.handleRimoriInfoUpdate(ev.data as RimoriInfo);
      });

      // Mark MessageChannel as ready and process pending requests
      this.isMessageChannelReady = true;

      // Process any pending requests
      this.pendingRequests.forEach((request) => request());
      this.pendingRequests = [];
    };
    if (worker) {
      self.onmessage = listener;
    } else {
      window.addEventListener('message', listener);
    }
    this.sendHello(worker);
    EventBus.on('self.rimori.triggerInitFinished', () => {
      this.sendFinishedInit(worker);
    });
  }

  private sendHello(isWorker = false): void {
    try {
      const payload = { type: 'rimori:hello', pluginId: this.pluginId };
      if (isWorker) {
        self.postMessage(payload);
      } else {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {
      console.error('[PluginController] Error sending hello:', e);
    }
  }

  private sendFinishedInit(isWorker = false): void {
    try {
      const payload = { type: 'rimori:acknowledged', pluginId: this.pluginId };
      if (isWorker) {
        self.postMessage(payload);
      } else {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {
      console.error('[PluginController] Error sending finished init:', e);
    }
  }

  public getQueryParam(key: string): string | null {
    return this.queryParams[key] || null;
  }

  private getSupabase(url: string, key: string, token: string): SupabaseClient {
    return new PostgrestClient(`${url}/rest/v1`, {
      schema: this.rimoriInfo?.dbSchema,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
    }) as unknown as SupabaseClient;
  }

  public async getClient(): Promise<{ supabase: SupabaseClient; info: RimoriInfo }> {
    // Return cached client if valid
    if (this.supabase && this.rimoriInfo && this.rimoriInfo.expiration > new Date()) {
      return { supabase: this.supabase, info: this.rimoriInfo };
    }

    // If MessageChannel is not ready yet, queue the request
    if (!this.isMessageChannelReady) {
      return new Promise<{ supabase: SupabaseClient; info: RimoriInfo }>((resolve) => {
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
            debug: false,
          },
        };

        return new Promise<{ supabase: SupabaseClient; info: RimoriInfo }>((resolve) => {
          // Listen for the response
          const originalOnMessage = self.onmessage;
          self.onmessage = (event) => {
            if (event.data?.topic === 'global.supabase.requestAccess' && event.data?.eventId === eventId) {
              this.rimoriInfo = event.data.data;
              this.supabase = this.getSupabase(this.rimoriInfo!.url, this.rimoriInfo!.key, this.rimoriInfo!.token);
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
        const { data } = await EventBus.request<RimoriInfo>(this.pluginId, 'global.supabase.requestAccess');
        // console.log({ data });
        this.rimoriInfo = data;
        this.supabase = this.getSupabase(this.rimoriInfo.url, this.rimoriInfo.key, this.rimoriInfo.token);
      }
    }

    return { supabase: this.supabase!, info: this.rimoriInfo };
  }

  /**
   * Handles updates to RimoriInfo from rimori-main.
   * Updates the cached info and Supabase client, then notifies all registered callbacks.
   */
  private handleRimoriInfoUpdate(newInfo: RimoriInfo): void {
    if (JSON.stringify(this.rimoriInfo) === JSON.stringify(newInfo)) {
      // console.log('[RimoriCommunicationHandler] RimoriInfo update is the same as the cached info, skipping update');
      return;
    }
    // Update cached rimoriInfo
    this.rimoriInfo = newInfo;

    // Update Supabase client with new token
    this.supabase = this.getSupabase(newInfo.url, newInfo.key, newInfo.token);

    // Notify all registered callbacks
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(newInfo);
      } catch (error) {
        console.error('[RimoriCommunicationHandler] Error in update callback:', error);
      }
    });
  }

  /**
   * Registers a callback to be called when RimoriInfo is updated.
   * @param callback - Function to call with the new RimoriInfo
   * @returns Cleanup function to unregister the callback
   */
  public onUpdate(callback: (info: RimoriInfo) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }
}
