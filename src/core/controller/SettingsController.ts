import { SupabaseClient } from "@supabase/supabase-js";
import { LanguageLevel } from "../../utils/difficultyConverter";
import { Language } from "../../utils/Language";
import { Guild } from "../core";

export interface Buddy {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  voiceId: string;
  aiPersonality: string;
}

export interface UserInfo {
  skill_level_reading: LanguageLevel;
  skill_level_writing: LanguageLevel;
  skill_level_grammar: LanguageLevel;
  skill_level_speaking: LanguageLevel;
  skill_level_listening: LanguageLevel;
  skill_level_understanding: LanguageLevel;
  goal_longterm: string;
  goal_weekly: string;
  study_buddy: Buddy;
  story_genre: string;
  study_duration: number;
  /**
   * The 2 letter language code of the language the user speaks natively.
   * With the function getLanguageName, the language name can be retrieved.
   */
  mother_tongue: Language;
  /**
   * The language the user targets to learn.
   */
  target_language: Language;
  motivation_type: string;
  onboarding_completed: boolean;
  context_menu_on_select: boolean;
  user_name?: string;
  /**
   * ISO 3166-1 alpha-2 country code of user's target location (exposed to plugins)
   */
  target_country: string;
  /**
   * Optional: nearest big city (>100,000) near user's location
   */
  target_city?: string;
}

export class SettingsController {
  private pluginId: string;
  private supabase: SupabaseClient;
  private guild: Guild;

  constructor(supabase: SupabaseClient, pluginId: string, guild: Guild) {
    this.supabase = supabase;
    this.pluginId = pluginId;
    this.guild = guild;
  }

  /**
   * Fetches settings based on guild configuration.
   * If guild doesn't allow user settings, fetches guild-level settings.
   * Otherwise, fetches user-specific settings.
   * @returns The settings object or null if not found.
   */
  private async fetchSettings(): Promise<any | null> {
    const isGuildSetting = !this.guild.allowUserPluginSettings;

    const { data } = await this.supabase
      .from("plugin_settings")
      .select("*")
      .eq("plugin_id", this.pluginId)
      .eq("guild_id", this.guild.id)
      .eq("is_guild_setting", isGuildSetting)
      .maybeSingle();

    return data?.settings ?? null;
  }

  /**
   * Sets settings for the plugin.
   * Automatically saves as guild settings if guild doesn't allow user settings,
   * otherwise saves as user-specific settings.
   * @param settings - The settings object to save.
   * @throws {Error} if RLS blocks the operation.
   */
  public async setSettings(settings: any): Promise<void> {
    const isGuildSetting = !this.guild.allowUserPluginSettings;
    
    const payload: any = {
      plugin_id: this.pluginId,
      settings,
      guild_id: this.guild.id,
      is_guild_setting: isGuildSetting,
    };

    if (isGuildSetting) {
      payload.user_id = null;
    }

    // Try UPDATE first (safe with RLS). If nothing updated, INSERT.
    const updateQuery = this.supabase
      .from("plugin_settings")
      .update({ settings })
      .eq("plugin_id", this.pluginId)
      .eq("guild_id", this.guild.id)
      .eq("is_guild_setting", isGuildSetting);

    const { data: updatedRows, error: updateError } = await (isGuildSetting
      ? updateQuery.is("user_id", null).select("id")
      : updateQuery.select("id"));

    if (updateError) {
      if (updateError.code === '42501' || updateError.message?.includes('policy')) {
        throw new Error(`Cannot set ${isGuildSetting ? 'guild' : 'user'} settings: Permission denied.`);
      }
      // proceed to try insert in case of other issues
    }

    if (updatedRows && updatedRows.length > 0) {
      return; // updated successfully
    }

    // No row updated -> INSERT
    const { error: insertError } = await this.supabase
      .from("plugin_settings")
      .insert(payload);

    if (insertError) {
      // In case of race condition (duplicate), try one more UPDATE
      if (insertError.code === '23505' /* unique_violation */) {
        const retry = this.supabase
          .from("plugin_settings")
          .update({ settings })
          .eq("plugin_id", this.pluginId)
          .eq("guild_id", this.guild.id)
          .eq("is_guild_setting", isGuildSetting);
        const { error: retryError } = await (isGuildSetting
          ? retry.is("user_id", null)
          : retry);
        if (!retryError) return;
      }

      throw insertError;
    }
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
