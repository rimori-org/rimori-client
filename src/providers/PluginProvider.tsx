import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { PluginController } from '../plugin/PluginController';
import { RimoriClient } from '../plugin/RimoriClient';
import { EventBusHandler } from '../plugin/fromRimori/EventBus';

interface PluginProviderProps {
  children: ReactNode;
  pluginId: string;
}

const PluginContext = createContext<RimoriClient | null>(null);

export const PluginProvider: React.FC<PluginProviderProps> = ({ children, pluginId }) => {
  const [plugin, setPlugin] = useState<RimoriClient | null>(null);
  const [contextMenuOnSelect, setContextMenuOnTextSelection] = useState(false);
  initEventBus(pluginId);

  useEffect(() => {
    PluginController.getInstance(pluginId).then(setPlugin);
  }, [pluginId]);

  //route change
  useEffect(() => {
    if (!plugin) return;

    const url = new URL(window.location.href);
    //sidebar pages should not report url changes
    if (url.searchParams.get("applicationMode") === "sidebar") return;

    let lastHash = url.hash;
    const emitUrlChange = (url: string) => plugin.event.emit('session.triggerUrlChange', { url });

    const interval = setInterval(() => {
      if (lastHash === window.location.hash) return;
      lastHash = window.location.hash;
      // console.log('url changed:', lastHash);
      emitUrlChange(lastHash);
    }, 1000);

    emitUrlChange(lastHash);
    return () => clearInterval(interval);
  }, [plugin]);

  //check if context menu opens on text selection
  useEffect(() => {
    if (!plugin) return;
    plugin.plugin.getUserInfo().then((userInfo) => {
      setContextMenuOnTextSelection(userInfo.context_menu_on_select);
    }).catch(error => {
      console.error('Error fetching settings:', error);
    });
  }, [plugin]);

  //detect page height change
  useEffect(() => {
    const body = document.body;
    const handleResize = () => plugin?.event.emit('session.triggerHeightChange', body.clientHeight);
    body.addEventListener('resize', handleResize);
    handleResize();
    return () => body.removeEventListener('resize', handleResize);
  }, [plugin]);

  //context menu
  useEffect(() => {
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isSelecting = false;

    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection()?.toString().trim();
      if (selection) {
        e.preventDefault();
        // console.log('context menu handled', selection);
        plugin?.event.emit('global.contextMenu.trigger', { text: selection, x: e.clientX, y: e.clientY, open: true });
      }
    };

    const handleSelectionChange = () => {
      // if (triggerOnTextSelection) {
      const selection = window.getSelection()?.toString().trim();
      const open = !!selection && isSelecting;
      // console.log('Selection change, contextMenuOnSelect:', contextMenuOnSelect);
      plugin?.event.emit('global.contextMenu.trigger', { text: selection, x: lastMouseX, y: lastMouseY, open });
      // }
    };
    const handleMouseUpDown = (e: MouseEvent) => {
      if (e.type === 'mousedown') {
        isSelecting = false;
      } else if (e.type === 'mouseup') {
        isSelecting = true;
        // console.log('mouseup, contextMenuOnSelect:', contextMenuOnSelect);
        if (contextMenuOnSelect) {
          handleSelectionChange();
        }
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener('mousedown', handleMouseUpDown);
    document.addEventListener('mouseup', handleMouseUpDown);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseUpDown);
      document.removeEventListener('mouseup', handleMouseUpDown);
    };
  }, [plugin, contextMenuOnSelect]);

  if (!plugin) {
    return ""
  }

  return (
    <PluginContext.Provider value={plugin}>
      {children}
    </PluginContext.Provider>
  );
};

export const usePlugin = () => {
  const context = useContext(PluginContext);
  if (context === null) {
    throw new Error('usePlugin must be used within an PluginProvider');
  }
  return context;
};

function initEventBus(pluginId: string) {
  const url = new URL(window.location.href);
  const isSidebar = url.searchParams.get("applicationMode") === "sidebar";
  EventBusHandler.getInstance("Plugin EventBus " + pluginId + " " + (isSidebar ? "sidebar" : "main"));
}