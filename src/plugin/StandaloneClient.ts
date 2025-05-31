import { EventBus } from "./fromRimori/EventBus";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface StandaloneConfig {
  url: string,
  key: string
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
      const config = await fetch("http://localhost:3000/config.json").then(res => res.json()).catch(err => {
        console.error("Error fetching config.json", err);
        return {
          SUPABASE_URL: "https://pheptqdoqsdnadgoihvr.supabase.co",
          SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZXB0cWRvcXNkbmFkZ29paHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2OTY2ODcsImV4cCI6MjA0NzI3MjY4N30.4GPFAXTF8685FaXISdAPNCIM-H3RGLo8GbyhQpu1mP0",
        }
      });
      StandaloneClient.instance = new StandaloneClient({ url: config.SUPABASE_URL, key: config.SUPABASE_ANON_KEY });
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
      const { data, error } = await supabase.functions.invoke("plugin-token", { headers: { authorization: `Bearer ${session.data.session?.access_token}` } });
      if (error) {
        throw new Error("Failed to get plugin token. " + error.message);
      }
      return {
        token: data.token,
        pluginId: pluginId,
        url: config.url,
        key: config.key,
        tablePrefix: pluginId,
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 1.5), // 1.5 hours
      }
    });

    EventBus.on("*", async (event) => {
      console.log("[standalone] would send event to parent", event);
    }, ["standalone"]);
  }
}