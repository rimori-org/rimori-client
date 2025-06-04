import { SupabaseClient } from '@supabase/supabase-js';
import { Plugin } from '../plugin/fromRimori/PluginTypes';

export async function getPlugins(supabase: SupabaseClient): Promise<Plugin[]> {
  let { data: installed } = await supabase.from('plugins_installed').select('*');
  let { data, error } = await supabase.from('plugins').select('*').in('plugin_id', installed?.map((plugin: any) => plugin.plugin_id) || []);

  if (error) {
    console.error(error);
    return [];
  }

  return (data || [])
    .filter((p: any) => installed?.some((i: any) => i.release_channel === p.release_channel && i.plugin_id === p.plugin_id))
    // .map((plugin: any) => ({
    //   plugin_id: plugin.plugin_id,
    //   version: plugin.version,
    //   release_channel: plugin.release_channel,
    //   endpoint: plugin.endpoint,
    //   dev: plugin.dev,
    //   info: plugin.info,
    //   pages: plugin.pages,
    //   context_menu_actions: plugin.context_menu_actions,
    //   documentation: plugin.documentation,
    //   worker: plugin.worker,
    // }));
}