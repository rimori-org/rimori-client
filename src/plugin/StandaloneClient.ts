import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { EventBus } from "../fromRimori/EventBus";
import { DEFAULT_ANON_KEY, DEFAULT_ENDPOINT } from "../utils/endpoint";

export interface StandaloneConfig {
  url: string,
  key: string,
  backendUrl?: string
}

export class StandaloneClient {
  private static instance: StandaloneClient;
  private config: StandaloneConfig;
  private supabase: SupabaseClient;

  private constructor(config: StandaloneConfig) {
    this.supabase = createClient(config.url, config.key);
    this.config = config;
  }

  public static async getInstance(): Promise<StandaloneClient> {
    if (!StandaloneClient.instance) {
      const config = await fetch("https://app.rimori.se/config.json").then(res => res.json()).catch(err => {
        console.warn("Error fetching config.json, using default values", err);
      });
      StandaloneClient.instance = new StandaloneClient({
        url: config?.SUPABASE_URL || DEFAULT_ENDPOINT,
        key: config?.SUPABASE_ANON_KEY || DEFAULT_ANON_KEY,
        backendUrl: config?.BACKEND_URL || 'https://api.rimori.se',
      });
    }
    return StandaloneClient.instance;
  }

  public async getClient(): Promise<SupabaseClient> {
    return this.supabase;
  }

  public async needsLogin(): Promise<boolean> {
    const { error } = await this.supabase.auth.getUser();
    return error !== null;
  }

  public async login(email: string, password: string) {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Login failed:", error);
      return false;
    }
    console.log("Successfully logged in");
    return true;
  }

  public static async initListeners(pluginId: string) {
    console.warn("The plugin seams to not be running inside the Rimori platform. Switching to development standalone mode.");
    // console.log("event that needs to be handled", event);
    const { supabase, config } = await StandaloneClient.getInstance();

    // EventBus.on("*", async (event) => {
    EventBus.respond("standalone", "global.supabase.requestAccess", async () => {
      const session = await supabase.auth.getSession();
      console.log("session", session);
      
      // Call the NestJS backend endpoint instead of the Supabase edge function
      // get current guild id if any
      let guildId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('current_guild_id')
            .eq('user_id', user.id)
            .maybeSingle();
          guildId = (profile as { current_guild_id?: string | null } | null)?.current_guild_id || null;
        }
      } catch (_) {
        guildId = null;
      }

      const response = await fetch(`${config.backendUrl}/plugin/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`
        },
        body: JSON.stringify({
          pluginId: pluginId,
          guildId: guildId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get plugin token. ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      return {
        token: data.token,
        pluginId: pluginId,
        url: config.url,
        key: config.key,
        backendUrl: config.backendUrl,
        tablePrefix: pluginId,
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 1.5), // 1.5 hours
      }
    });

    EventBus.on("*", async (event) => {
      console.log("[standalone] would send event to parent", event);
    }, ["standalone"]);
  }
}