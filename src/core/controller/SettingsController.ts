import { SupabaseClient } from "@supabase/supabase-js";
import { LanguageLevel } from "../../utils/difficultyConverter";
import { Language } from "../../utils/Language";

export interface UserInfo {
  skill_level_reading: LanguageLevel;
  skill_level_writing: LanguageLevel;
  skill_level_grammar: LanguageLevel;
  skill_level_speaking: LanguageLevel;
  skill_level_listening: LanguageLevel;
  skill_level_understanding: LanguageLevel;
  goal_longterm: string;
  goal_weekly: string;
  study_buddy: string;
  story_genre: string;
  study_duration: number;
  mother_tongue: Language;
  motivation_type: string;
  onboarding_completed: boolean;
  context_menu_on_select: boolean;
}

export class SettingsController {
  private pluginId: string;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, pluginId: string) {
    this.supabase = supabase;
    this.pluginId = pluginId;
  }

  private async fetchSettings(): Promise<any | null> {
    const { data } = await this.supabase.from("plugin_settings").select("*").eq("plugin_id", this.pluginId)

    if (!data || data.length === 0) {
      return null;
    }

    return data[0].settings;
  }

  public async setSettings(settings: any): Promise<void> {
    await this.supabase.from("plugin_settings").upsert({ plugin_id: this.pluginId, settings });
  }

  /**
   * Get the settings for the plugin. T can be any type of settings, UserSettings or SystemSettings.
   * @param defaultSettings The default settings to use if no settings are found.
   * @returns The settings for the plugin. 
   */
  public async getSettings<T extends object>(defaultSettings: T): Promise<T> {
    const storedSettings = await this.fetchSettings() as T | null;

    if (!storedSettings) {
      await this.setSettings(defaultSettings);
      return defaultSettings;
    }

    // Handle settings migration
    const storedKeys = Object.keys(storedSettings);
    const defaultKeys = Object.keys(defaultSettings);

    if (storedKeys.length !== defaultKeys.length) {
      const validStoredSettings = Object.fromEntries(
        Object.entries(storedSettings).filter(([key]) => defaultKeys.includes(key))
      );
      const mergedSettings = { ...defaultSettings, ...validStoredSettings } as T;

      await this.setSettings(mergedSettings);
      return mergedSettings;
    }

    return storedSettings;
  }
}
