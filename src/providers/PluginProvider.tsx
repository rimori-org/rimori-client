import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { PluginController } from '../plugin/PluginController';
import { RimoriClient } from '../plugin/RimoriClient';
import { EventBusHandler } from '../plugin/fromRimori/EventBus';
import ContextMenu from '../core/components/ContextMenu';

interface PluginProviderProps {
  children: ReactNode;
  pluginId: string;
}

const PluginContext = createContext<RimoriClient | null>(null);

export const PluginProvider: React.FC<PluginProviderProps> = ({ children, pluginId }) => {
  const [plugin, setPlugin] = useState<RimoriClient | null>(null);
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

  //detect page height change
  useEffect(() => {
    const body = document.body;
    const handleResize = () => plugin?.event.emit('session.triggerHeightChange', body.clientHeight);
    body.addEventListener('resize', handleResize);
    handleResize();
    return () => body.removeEventListener('resize', handleResize);
  }, [plugin]);

  if (!plugin) {
    return ""
  }

  return (
    <PluginContext.Provider value={plugin}>
      <ContextMenu client={plugin} />
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