import React, { useState, useEffect, useRef } from "react";
import { EventBus } from "../../plugin/fromRimori/EventBus";
import { RimoriClient } from "../../plugin/RimoriClient";
import { MenuEntry } from "../../plugin/fromRimori/PluginTypes";

export interface Position {
  x: number,
  y: number,
  text?: string
}

const ContextMenu = ({ client }: { client: RimoriClient }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [actions, setActions] = useState<MenuEntry[]>([]);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [openOnTextSelect, setOpenOnTextSelect] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.plugin.getInstalled().then(plugins => {
      setActions(plugins.flatMap(p => p.context_menu_actions).filter(Boolean));
    });

    client.plugin.getUserInfo().then((userInfo) => {
      setOpenOnTextSelect(userInfo.context_menu_on_select);
    })

    EventBus.on<{ actions: MenuEntry[] }>("global.contextMenu.createActions", ({ data }) => {
      setActions([...data.actions, ...actions]);
    });
  }, []);

  useEffect(() => {
    // Track mouse position globally
    const handleMouseMove = (e: MouseEvent) => {
      const selectedText = window.getSelection()?.toString().trim();
      if (isOpen && selectedText === position.text) return;
      setPosition({ x: e.clientX, y: e.clientY, text: selectedText });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const selectedText = window.getSelection()?.toString().trim();
      // Check if click is inside the context menu
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        // Don't close the menu if clicking inside
        return;
      }

      // Prevent context menu on textarea or text input selection
      const target = e.target as HTMLElement;
      const isTextInput = target && (
        (target.tagName === 'TEXTAREA') ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text')
      );
      if (isTextInput) {
        setIsOpen(false);
        return;
      }

      if (e.button === 0 && isOpen) {
        setIsOpen(false);
        window.getSelection()?.removeAllRanges();
      } else if (selectedText && (openOnTextSelect || e.button === 2)) {
        if (e.button === 2) {
          e.preventDefault();
        }
        setPosition({ x: e.clientX, y: e.clientY, text: selectedText });
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // Add selectionchange listener to close menu if selection is cleared
    const handleSelectionChange = () => {
      const selectedText = window.getSelection()?.toString().trim();
      if (!selectedText && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("contextmenu", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("contextmenu", handleMouseUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [openOnTextSelect, isOpen, position.text]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-400 dark:bg-gray-700 shadow-lg border border-gray-400 rounded-md overflow-hidden dark:text-white z-50"
      style={{ top: position.y, left: position.x }}>
      {actions.map((action, index) => (
        <MenuEntryItem key={index} icon={action.icon} text={action.text} onClick={() => {
          setIsOpen(false);
          window.getSelection()?.removeAllRanges();
          client.event.emitSidebarAction(action.plugin_id, action.action_key, position.text);
        }} />
      ))}
    </div>
  );
};

function MenuEntryItem(props: { icon: React.ReactNode, text: string, onClick: () => void }) {
  return <button onClick={props.onClick} className="px-4 py-2 text-left hover:bg-gray-500 dark:hover:bg-gray-600 w-full flex flex-row">
    <span className="flex-grow">{props.icon}</span>
    <span className="flex-grow">{props.text}</span>
    {/* <span className="text-sm">Ctrl+Shift+xxxx</span> */}
  </button>
}

export default ContextMenu;
