// whole configuration of a plugin (from the database)
export type Plugin = RimoriPluginConfig & {
  version: string;
  endpoint: string;
  release_channel: "alpha" | "beta" | "stable";
}

// browsable page of a plugin
export interface PluginPage {
  id: string;
  name: string;
  url: string;
  // Whether the page should be shown in the navbar
  show: boolean;
  description: string;
  root: "vocabulary" | "grammar" | "reading" | "listening" | "writing" | "speaking" | "other" | "community";
  // The actions that can be triggered in the plugin
  // The key is the action key. The other entries are additional properties needed when triggering the action
  action?: {
    key: string;
    parameters: Tool;
  }
}

// a sidebar page of a plugin
export interface SidebarPage {
  // identifier of the page. Used to know which page to trigger when clicking on the sidebar
  id: string;
  // name of the page. Shown in the settings
  name: string;
  // description of the page. Shown in the settings
  description: string;
  // relative or absolute URL or path to the plugin's page
  url: string;
  // relative or absolute URL or path to the plugin's icon image
  icon: string;
}

// context menu entry being configured in the plugin configuration
export interface MenuEntry {
  // id of the plugin that the menu entry belongs to
  plugin_id: string;
  // identifier of the menu entry action. Used to know which entry to trigger when clicking on the context menu
  action_key: string;
  // text of the menu entry. Shown in the context menu
  text: string;
  // icon of the menu entry. Shown in the context menu
  icon?: React.ReactNode;
}

// an action from the main panel that can be triggered and performs an action in the main panel
export type MainPanelAction = {
  plugin_id: string;
  action_key: string;
} & Record<string, string>;

// an action from the context menu that can be triggered and performs an action in the sidebar plugin
export interface ContextMenuAction {
  // selected text when clicking on the context menu
  text: string;
  // id of the plugin that the action belongs to
  plugin_id: string;
  // key of the action. Used to know which action to trigger when clicking on the context menu
  action_key: string
}

/**
 * Rimori plugin structure representing the complete configuration
 * of a Rimori plugin with all metadata and configuration options.
 */
export interface RimoriPluginConfig {
  id: string;
  /**
   * Basic information about the plugin including branding and core details.
   */
  info: {
    /** The display name of the plugin shown to users */
    title: string;
    /** Detailed description introducing the plugin */
    description: string;
    /** relative or absolute URL or path to the plugin's logo/icon image */
    logo: string;
    /** Optional website URL for the plugin's homepage or link to plugins owner for contributions */
    website?: string;
  }
  /**
   * Configuration for different types of pages.
   */
  pages: {
    /** Optional external URL where the plugin is hosted instead of the default CDN */
    external_hosted_url?: string;
    /** Array of main plugin pages that appear in the application's main navigation (can be disabled using the 'show' flag) */
    main: PluginPage[];
    /** Array of sidebar pages that appear in the sidebar for quick access (can be disabled using the 'show' flag) */
    sidebar: SidebarPage[];
    /** Optional path to the plugin's settings/configuration page */
    settings?: string;
    /** Optional array of event topics the plugin pages can listen to for cross-plugin communication */
    topics?: string[];
  }
  /**
   * Context menu actions that the plugin registers to appear in right-click menus throughout the application.
   */
  context_menu_actions: MenuEntry[];
  /**
   * Documentation paths for different types of plugin documentation.
   */
  documentation: {
    /** Path to the general overview documentation. It's shown upon installation of the plugin. */
    overview_path: string;
    /** Path to user-facing documentation and guides */
    user_path: string;
    /** Path to developer documentation for plugin development */
    developer_path: string;
  }
  /**
   * Configuration for the plugin's web worker if it uses background processing or exposes actions to other plugins.
   */
  worker?: {
    /** Relative path to the web worker JavaScript file. Mostly it's 'web-worker.js' which is located in the public folder. */
    url: string;
    /** Optional array of event topics the worker should listen to in addition to events having the pluginId in the topic. Can be a wildcard. Example: 'global.topic.*' or 'pluginId.*' */
    topics?: string[];
  };
}

// copied from llm edge function

/**
 * The tool definition structure is used for LLM function calling and plugin action parameters.
 * It defines the schema for tools that can be used by Language Learning Models (LLMs)
 * and plugin actions.
 * 
 * @example
 * ```typescript
 * const flashcardTool: Tool = {
 *   total_amount: {
 *     type: 'string',
 *     enum: ['default', '10', '20', '50'],
 *     description: 'Number of flashcards to practice'
 *   },
 *   deck: {
 *     type: 'string', 
 *     enum: ['latest', 'random', 'oldest', 'mix', 'best_known'],
 *     description: 'Type of deck to practice'
 *   }
 * };
 * ```
 * 
 */
export type Tool = {
  [key: string]: ToolParameter;
};

/**
 * Parameter definition for LLM tools and plugin actions.
 * Defines the structure, validation rules, and metadata for individual tool parameters.
 * Used to create type-safe interfaces between LLMs, plugins, and the Rimori platform.
 */
interface ToolParameter {
  /** The data type of the parameter - can be primitive, nested object, or array */
  type: ToolParameterType;
  /** Human-readable description of the parameter's purpose and usage */
  description: string;
  /** Optional array of allowed values for enumerated parameters */
  enum?: string[];
}

/**
 * Union type defining all possible parameter types for LLM tools.
 * Supports primitive types, nested objects for complex data structures,
 * and arrays of objects for collections. The tuple notation [{}] indicates
 * arrays of objects with a specific structure.
 * 
 * @example Primitive: 'string' | 'number' | 'boolean'
 * @example Nested object: { name: { type: 'string' }, age: { type: 'number' } }
 * @example Array of objects: [{ id: { type: 'string' }, value: { type: 'number' } }]
 */
type ToolParameterType =
  | PrimitiveType
  | { [key: string]: ToolParameter }  // for nested objects
  | [{ [key: string]: ToolParameter }];  // for arrays of objects (notice the tuple type)

/**
 * Primitive data types supported by the LLM tool system.
 * These align with JSON schema primitive types and TypeScript basic types.
 */
type PrimitiveType = 'string' | 'number' | 'boolean';
