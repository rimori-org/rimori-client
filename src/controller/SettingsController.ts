import { SupabaseClient } from "@supabase/supabase-js";
import { LanguageLevel } from "../utils/difficultyConverter";

export interface UserInfo {
    motherTongue: string;
    xp: number;
    listening_level: LanguageLevel;
    reading_level: LanguageLevel;
    speaking_level: LanguageLevel;
    writing_level: LanguageLevel;
    understanding_level: LanguageLevel;
    grammar_level: LanguageLevel;
    longterm_goal: string;
    motivation_type: string;
    study_buddy: string;
    preferred_genre: string;
    milestone: string;
    settings: {
        contextMenuOnSelect: boolean;
    }
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

    public async getUserInfo(): Promise<UserInfo> {
        const { data } = await this.supabase.from("profiles").select("*");

        if (!data || data.length === 0) {
            return {
                motherTongue: "en",
                xp: 0,
                listening_level: "Pre-A1",
                reading_level: "Pre-A1",
                speaking_level: "Pre-A1",
                writing_level: "Pre-A1",
                understanding_level: "Pre-A1",
                grammar_level: "Pre-A1",
                longterm_goal: "",
                motivation_type: "self-motivated",
                study_buddy: "clarence",
                preferred_genre: "adventure",
                milestone: "",
                settings: {
                    contextMenuOnSelect: false,
                }
            }
        }

        return data[0];
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
