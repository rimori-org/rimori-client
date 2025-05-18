// the received action when the plugin pages action is triggered
// This is based upon plugin_pages configuration of the plugin
export type MainPanelAction = {
  pluginId: string;
  actionKey: string;
} & Record<string, string>;