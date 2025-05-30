import { SupabaseClient } from '@supabase/supabase-js';
import { Plugin } from '../plugin/fromRimori/PluginTypes';

export async function getPlugins(supabase: SupabaseClient): Promise<Plugin[]> {
    let { data, error } = await supabase.from('plugins').select('*');
    
    if (error) {
        console.error(error);
        return [];
    }

    return (data || []).map((plugin: any) => ({
        id: plugin.id,
        title: plugin.title,
        description: plugin.description,
        icon_url: plugin.icon_url,
        endpoint: plugin.endpoint,
        context_menu_actions: plugin.context_menu_actions,
        plugin_pages: plugin.plugin_pages,
        sidebar_pages: plugin.sidebar_pages,
        settings_page: plugin.settings_page,
        version: plugin.version,
        external_hosted_url: plugin.external_hosted_url,
    }));
}