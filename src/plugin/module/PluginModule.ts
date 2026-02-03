import { SettingsController, UserInfo } from '../../controller/SettingsController';
import { Guild, RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';
import { Translator } from '../../controller/TranslationController';
import { ActivePlugin, Plugin } from '../../fromRimori/PluginTypes';
import { SupabaseClient } from '../CommunicationHandler';
import { AIModule } from './AIModule';

export type Theme = 'light' | 'dark' | 'system'; // system means the system's default theme
export type ApplicationMode = 'main' | 'sidebar' | 'settings';
/**
 * Controller for plugin-related operations.
 * Provides access to plugin settings, user info, and plugin information.
 */
export class PluginModule {
  private settingsController: SettingsController;
  private communicationHandler: RimoriCommunicationHandler;
  private translator: Translator;
  private rimoriInfo: RimoriInfo;
  public pluginId: string;
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
    this.communicationHandler = communicationHandler;
    this.pluginId = info.pluginId;
    this.releaseChannel = info.releaseChannel;

    this.settingsController = new SettingsController(supabase, info.pluginId, info.guild);

    const currentPlugin = info.installedPlugins.find((plugin) => plugin.id === info.pluginId);
    this.translator = new Translator(info.interfaceLanguage, currentPlugin?.endpoint || '', ai);

    this.communicationHandler.onUpdate((updatedInfo) => (this.rimoriInfo = updatedInfo));
    this.applicationMode = this.communicationHandler.getQueryParam('applicationMode') as ApplicationMode;
    this.theme = (this.communicationHandler.getQueryParam('rm_theme') as Theme) || 'light';
  }

  /**
   * Set the settings for the plugin.
   * @param settings The settings to set.
   */
  async setSettings(settings: any): Promise<void> {
    await this.settingsController.setSettings(settings);
  }

  /**
   * Get the settings for the plugin. T can be any type of settings, UserSettings or SystemSettings.
   * @param defaultSettings The default settings to use if no settings are found.
   * @returns The settings for the plugin.
   */
  async getSettings<T extends object>(defaultSettings: T): Promise<T> {
    return await this.settingsController.getSettings<T>(defaultSettings);
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
