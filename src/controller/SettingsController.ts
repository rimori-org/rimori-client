import { SupabaseClient } from "@supabase/supabase-js";
import { LanguageLevel } from "../utils/difficultyConverter";

type SettingsType = "user" | "system" | "plugin";

export interface UserSettings {
    motherTongue: string;
    languageLevel: LanguageLevel;
    contextMenuOnSelect: boolean;
}

export interface SystemSettings {
    // TODO: add system settings
}

export class SettingsController {
    private pluginId: string;
    private supabase: SupabaseClient;

    constructor(supabase: SupabaseClient, pluginId: string) {
        this.supabase = supabase;
        this.pluginId = pluginId;
    }

    private getSettingsType(genericSettings?: "user" | "system"): SettingsType {
        return genericSettings || "plugin";
    }

    private async fetchSettings(type: SettingsType): Promise<any | null> {
        const pluginId = type === "plugin" ? this.pluginId : type;
        const { data } = await this.supabase.from("plugin_settings").select("*").eq("plugin_id", pluginId)

        if (!data || data.length === 0) {
            return null;
        }

        return data[0].settings;
    }

    private async saveSettings(settings: any, type: SettingsType): Promise<void> {
        if (type !== "plugin") {
            throw new Error(`Cannot modify ${type} settings`);
        }

        await this.supabase.from("plugin_settings").upsert({ plugin_id: this.pluginId, settings });
    }

    /**
     * Get the settings for the plugin. T can be any type of settings, UserSettings or SystemSettings.
     * @param defaultSettings The default settings to use if no settings are found.
     * @param genericSettings The type of settings to get.
     * @returns The settings for the plugin. 
     */
    public async getSettings<T extends object>(defaultSettings: T, genericSettings?: "user" | "system"): Promise<T> {
        const type = this.getSettingsType(genericSettings);
        const storedSettings = await this.fetchSettings(type) as T | null;

        if (!storedSettings) {
            if (type === "plugin") {
                await this.saveSettings(defaultSettings, type);
            }
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

            if (type === "plugin") {
                await this.saveSettings(mergedSettings, type);
            }
            return mergedSettings;
        }

        return storedSettings;
    }

    public async setSettings(settings: any, genericSettings?: "user" | "system"): Promise<void> {
        const type = this.getSettingsType(genericSettings);
        await this.saveSettings(settings, type);
    }
}
