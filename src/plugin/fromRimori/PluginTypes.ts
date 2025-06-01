

// whole configuration of a plugin (from the database)
export interface Plugin {
  id: string;
  title: string;
  description: string;
  icon_url: string;
  version: string;
  endpoint: string;
  release_stage: "alpha" | "beta" | "stable";
  context_menu_actions: MenuEntry[];
  plugin_pages: PluginPage[];
  sidebar_pages: SidebarPage[];
  settings_page: string;
  worker?: {
    url: string;
    topics?: string[];
  };
}

// browsable page of a plugin
export interface PluginPage {
  name: string;
  url: string;
  // Whether the page should be shown in the navbar
  show: boolean;
  description: string;
  root: string;
  // The actions that can be triggered in the plugin
  // The key is the action key. The other entries are additional properties needed when triggering the action
  action?: (Record<string, string> & {
    key: string;
  })
}

// a sidebar page of a plugin
export interface SidebarPage {
  name: string;
  url: string;
  iconUrl: string;
  description: string;
  actionKey: string;
}

// context menu entry being configured in the plugin configuration
export interface MenuEntry {
  text: string;
  pluginId: string;
  actionKey: string;
  icon?: React.ReactNode;
}

// an action from the main panel that can be triggered and performs an action in the main panel
export type MainPanelAction = {
  pluginId: string;
  actionKey: string;
} & Record<string, string>;

// an action from the context menu that can be triggered and performs an action in the sidebar plugin
export interface ContextMenuAction {
  text: string;
  pluginId: string;
  actionKey: string
}