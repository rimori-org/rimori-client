import { AIModule } from './AIModule';
import { SupabaseClient } from '../CommunicationHandler';
import { LanguageLevel } from '../../utils/difficultyConverter';
import { Translator } from '../../controller/TranslationController';
import { ActivePlugin, Plugin } from '../../fromRimori/PluginTypes';
import { RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';

export type Theme = 'light' | 'dark' | 'system'; // system means the system's default theme
export type ApplicationMode = 'main' | 'sidebar' | 'settings';
/**
 * Controller for plugin-related operations.
 * Provides access to plugin settings, user info, and plugin information.
 */
export class PluginModule {
  public pluginId: string;
  private rimoriInfo: RimoriInfo;
  private translator: Translator;
  private supabase: SupabaseClient;
  private communicationHandler: RimoriCommunicationHandler;
  /**
   * The release channel of this plugin installation.
   * Determines which database schema is used for plugin tables.
   */
  public releaseChannel: string;
  public applicationMode: ApplicationMode;
  public theme: Theme;

  constructor(
    supabase: SupabaseClient,
    communicationHandler: RimoriCommunicationHandler,
    info: RimoriInfo,
    ai: AIModule,
  ) {
    this.rimoriInfo = info;
    this.supabase = supabase;
    this.pluginId = info.pluginId;
    this.releaseChannel = info.releaseChannel;
    this.communicationHandler = communicationHandler;

    const currentPlugin = info.installedPlugins.find((plugin) => plugin.id === info.pluginId);
    this.translator = new Translator(info.interfaceLanguage, currentPlugin?.endpoint || '', ai);

    this.communicationHandler.onUpdate((updatedInfo) => (this.rimoriInfo = updatedInfo));
    this.applicationMode = this.communicationHandler.getQueryParam('applicationMode') as ApplicationMode;
    this.theme = (this.communicationHandler.getQueryParam('rm_theme') as Theme) || 'light';
  }

  /**
   * Fetches settings based on guild configuration.
   * If guild doesn't allow user settings, fetches guild-level settings.
   * Otherwise, fetches user-specific settings.
   * @returns The settings object or null if not found.
   */
  private async fetchSettings<T>(): Promise<T | null> {
    const isGuildSetting = !this.rimoriInfo.guild.allowUserPluginSettings;

    const { data } = await this.supabase
      .schema('public')
      .from('plugin_settings')
      .select('*')
      .eq('plugin_id', this.pluginId)
      .eq('guild_id', this.rimoriInfo.guild.id)
      .eq('is_guild_setting', isGuildSetting)
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
    const isGuildSetting = !this.rimoriInfo.guild.allowUserPluginSettings;

    const payload: any = {
      plugin_id: this.pluginId,
      settings,
      guild_id: this.rimoriInfo.guild.id,
      is_guild_setting: isGuildSetting,
    };

    if (isGuildSetting) {
      payload.user_id = null;
    }

    // Try UPDATE first (safe with RLS). If nothing updated, INSERT.
    const updateQuery = this.supabase
      .schema('public')
      .from('plugin_settings')
      .update({ settings })
      .eq('plugin_id', this.pluginId)
      .eq('guild_id', this.rimoriInfo.guild.id)
      .eq('is_guild_setting', isGuildSetting);

    const { data: updatedRows, error: updateError } = await (isGuildSetting
      ? updateQuery.is('user_id', null).select()
      : updateQuery.select());

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
    const { error: insertError } = await this.supabase.schema('public').from('plugin_settings').insert(payload);

    if (insertError) {
      // In case of race condition (duplicate), try one more UPDATE
      if (insertError.code === '23505' /* unique_violation */) {
        const retry = this.supabase
          .schema('public')
          .from('plugin_settings')
          .update({ settings })
          .eq('plugin_id', this.pluginId)
          .eq('guild_id', this.rimoriInfo.guild.id)
          .eq('is_guild_setting', isGuildSetting);
        const { error: retryError } = await (isGuildSetting ? retry.is('user_id', null) : retry);
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
  public async getSettings<T extends BasePluginSettings>(defaultSettings: ExplicitUndefined<T>): Promise<ExplicitUndefined<T>> {
    const storedSettings = await this.fetchSettings<T>();

    if (!storedSettings) {
      await this.setSettings(defaultSettings);
      return defaultSettings;
    }

    // Handle settings migration
    const storedKeys = Object.keys(storedSettings);
    const defaultKeys = Object.keys(defaultSettings);

    if (storedKeys.length !== defaultKeys.length) {
      const validStoredSettings = Object.fromEntries(
        Object.entries(storedSettings).filter(([key]) => defaultKeys.includes(key)),
      );
      const mergedSettings = { ...defaultSettings, ...validStoredSettings };

      await this.setSettings(mergedSettings);
      return mergedSettings;
    }

    return storedSettings as ExplicitUndefined<T>;
  }

  /**
   * Get the current user info.
   * Note: For reactive updates in React components, use the userInfo from useRimori() hook instead.
   * @returns The user info.
   */
  getUserInfo(): UserInfo {
    return this.rimoriInfo.profile;
  }

  getGuildInfo(): {
    id: string;
    name: string;
    description: string | null;
  } {
    return {
      id: this.rimoriInfo.guild.id,
      name: this.rimoriInfo.guild.name,
      description: this.rimoriInfo.guild.description,
    };
  }

  /**
   * Register a callback to be notified when RimoriInfo is updated.
   * This is useful for reacting to changes in user info, tokens, or other rimori data.
   * @param callback - Function to call with the new RimoriInfo
   * @returns Cleanup function to unregister the callback
   */
  onRimoriInfoUpdate(callback: (info: RimoriInfo) => void): () => void {
    return this.communicationHandler.onUpdate(callback);
  }

  /**
   * Retrieves information about plugins, including:
   * - All installed plugins
   * - The currently active plugin in the main panel
   * - The currently active plugin in the side panel
   */
  getPluginInfo(): {
    /**
     * All installed plugins.
     */
    installedPlugins: Plugin[];
    /**
     * The plugin that is loaded in the main panel.
     */
    mainPanelPlugin?: ActivePlugin;
    /**
     * The plugin that is loaded in the side panel.
     */
    sidePanelPlugin?: ActivePlugin;
  } {
    return {
      installedPlugins: this.rimoriInfo.installedPlugins,
      mainPanelPlugin: this.rimoriInfo.mainPanelPlugin,
      sidePanelPlugin: this.rimoriInfo.sidePanelPlugin,
    };
  }

  /**
   * Get the translator for the plugin.
   * @returns The translator for the plugin.
   */
  async getTranslator(): Promise<Translator> {
    await this.translator.initialize();
    return this.translator;
  }
}

export interface Buddy {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  voiceId: string;
  aiPersonality: string;
}

export interface Language {
  code: string;
  name: string;
  native: string;
  capitalized: string;
  uppercase: string;
}

export type UserRole = 'user' | 'plugin_moderator' | 'lang_moderator' | 'admin';

export const LEARNING_REASONS = [
  'work',
  'partner',
  'friends',
  'study',
  'living',
  'culture',
  'growth',
  'citizenship',
  'other',
] as const;

export type LearningReason = (typeof LEARNING_REASONS)[number];

// this requires that
export type ExplicitUndefined<T> = {
  [K in Exclude<keyof T, never>]-?: {} extends Pick<T, K> ? T[K] | undefined : T[K];
};

/**
 * All plugin settings must include is_inited so rimori-main can detect
 * plugins whose one-time worker init did not complete and re-trigger them.
 */
export type BasePluginSettings = { is_inited: boolean };

export interface UserInfo {
  /**
   * The user's unique ID
   */
  user_id: string;
  skill_level_reading: LanguageLevel;
  skill_level_writing: LanguageLevel;
  skill_level_grammar: LanguageLevel;
  skill_level_speaking: LanguageLevel;
  skill_level_listening: LanguageLevel;
  skill_level_understanding: LanguageLevel;
  study_buddy: Buddy;
  study_duration: number;
  /**
   * The language the user speaks natively.
   */
  mother_tongue: Language;
  /**
   * The language the user targets to learn.
   */
  target_language: Language;
  /**
   * Why the user is learning the language
   */
  learning_reason: LearningReason;
  /**
   * Free-text personal interests
   */
  personal_interests: string;
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
  /**
   * The user's role: 'user', 'plugin_moderator', 'lang_moderator', or 'admin'
   */
  user_role: UserRole;
}
