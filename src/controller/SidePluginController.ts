import { SupabaseClient } from '@supabase/supabase-js';

export interface Plugin {
    id: string;
    title: string;
    icon_url: string;
    website: string;
    context_menu_actions: string;
    plugin_pages: string;
    sidebar_pages: string;
    settings_page: string;
    version: string;
    external_hosted_url: string;
}

export async function getPlugins(supabase: SupabaseClient): Promise<Plugin[]> {
    let { data, error } = await supabase.from('plugins').select('*');
    
    if (error) {
        console.error(error);
        return [];
    }

    return (data || []).map((plugin: any) => ({
        id: plugin.id,
        title: plugin.title,
        icon_url: plugin.icon_url,
        website: plugin.website,
        context_menu_actions: plugin.context_menu_actions,
        plugin_pages: plugin.plugin_pages,
        sidebar_pages: plugin.sidebar_pages,
        settings_page: plugin.settings_page,
        version: plugin.version,
        external_hosted_url: plugin.external_hosted_url,
    }));
}