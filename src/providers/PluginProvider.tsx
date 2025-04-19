import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { PluginController } from '../plugin/PluginController';
import { RimoriClient } from '../plugin/RimoriClient';
import { UserSettings } from '../controller/SettingsController';

interface PluginProviderProps {
    children: ReactNode;
}

const PluginContext = createContext<RimoriClient | null>(null);


export const PluginProvider: React.FC<PluginProviderProps> = ({ children }) => {
    const [plugin, setPlugin] = useState<RimoriClient | null>(null);
    const [contextMenuOnSelect, setContextMenuOnTextSelection] = useState(false);

    //route change
    useEffect(() => {
        let lastHash = window.location.hash;

        setInterval(() => {
            if (lastHash !== window.location.hash) {
                lastHash = window.location.hash;
                console.log('url changed:', lastHash);
                plugin?.emit('urlChange', window.location.hash);
            }
        }, 100);
        PluginController.getInstance().then(setPlugin);
    }, []);

    //check if context menu opens on text selection
    useEffect(() => {
        if (!plugin) return;
        plugin.getSettings<UserSettings>({
            languageLevel: "A1",
            motherTongue: "English",
            contextMenuOnSelect: false,
        }, "user").then((settings) => {
            setContextMenuOnTextSelection(settings.contextMenuOnSelect);
        }).catch(error => {
            console.error('Error fetching settings:', error);
        });
    }, [plugin]);

    //detect page height change
    useEffect(() => {
        const body = document.body;
        const handleResize = () => plugin?.emit('heightAdjustment', body.clientHeight);
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
                plugin?.emit('contextMenu', { text: selection, x: e.clientX, y: e.clientY, open: true });
            }
        };

        const handleSelectionChange = () => {
            // if (triggerOnTextSelection) {
            const selection = window.getSelection()?.toString().trim();
            const open = !!selection && isSelecting;
            // console.log('Selection change, contextMenuOnSelect:', contextMenuOnSelect);
            plugin?.emit('contextMenu', { text: selection, x: lastMouseX, y: lastMouseY, open });
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