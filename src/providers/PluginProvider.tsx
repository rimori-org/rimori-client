import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { PluginController } from '../plugin/PluginController';
import { RimoriClient } from '../plugin/RimoriClient';
import { EventBusHandler } from '../fromRimori/EventBus';
import ContextMenu from '../components/components/ContextMenu';
import { StandaloneClient } from '../plugin/StandaloneClient';

interface PluginProviderProps {
  children: ReactNode;
  pluginId: string;
  settings?: {
    disableContextMenu?: boolean;
  }
}

const PluginContext = createContext<RimoriClient | null>(null);

export const PluginProvider: React.FC<PluginProviderProps> = ({ children, pluginId, settings }) => {
  const [plugin, setPlugin] = useState<RimoriClient | null>(null);
  const [standaloneClient, setStandaloneClient] = useState<StandaloneClient | boolean>(false);
  const isSidebar = getUrlParam("applicationMode") === "sidebar";
  const isSettings = getUrlParam("applicationMode") === "settings";

  useEffect(() => {
    initEventBus(pluginId);
    const standaloneDetected = new URLSearchParams(window.location.search).get("secret") === null;
    if (standaloneDetected && !standaloneClient) {
      StandaloneClient.getInstance().then(client => {
        client.needsLogin().then((needLogin) => setStandaloneClient(needLogin ? client : true));
      });
    }

    if ((!standaloneDetected && !plugin) || (standaloneDetected && standaloneClient === true)) {
      PluginController.getInstance(pluginId, standaloneDetected).then(setPlugin);
    }
  }, [pluginId, standaloneClient]);

  //route change
  useEffect(() => {
    if (!plugin) return;

    //sidebar pages should not report url changes
    if (isSidebar) return;

    let lastHash = window.location.hash;
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

  if (standaloneClient instanceof StandaloneClient) {
    return <StandaloneAuth onLogin={async (email, password) => {
      if (await standaloneClient.login(email, password)) setStandaloneClient(true);
    }} />
  }

  if (!plugin) {
    return ""
  }

  return (
    <PluginContext.Provider value={plugin}>
      {!settings?.disableContextMenu && !isSidebar && !isSettings && <ContextMenu client={plugin} />}
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

function getUrlParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function initEventBus(pluginId: string) {
  const isSidebar = getUrlParam("applicationMode") === "sidebar";
  EventBusHandler.getInstance("Plugin EventBus " + pluginId + " " + (isSidebar ? "sidebar" : "main"));
}

function StandaloneAuth({ onLogin }: { onLogin: (user: string, password: string) => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    }}>
      <div style={{ backgroundColor: '#343534', padding: '1rem', borderRadius: '0.5rem', width: '500px', flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>Rimori Login</p>
        <p style={{ marginBottom: '1rem', textAlign: 'center' }}>
          Please login with your Rimori developer account for this plugin to be able to access the Rimori platform the same it will operate in the Rimori platform.
        </p>
        {/* email and password input */}
        <input style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#444444' }} type="email" placeholder="Email" onChange={(e) => setUser(e.target.value)} />
        <input style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#444444' }} type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
        <button style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#928358' }} onClick={() => {
          onLogin(user, password);
        }}>Login</button>
      </div>
    </div>
  )
}