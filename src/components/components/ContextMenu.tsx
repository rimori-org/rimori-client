import React, { useState, useEffect, useRef } from 'react';
import { EventBus } from '../../fromRimori/EventBus';
import { RimoriClient } from '../../plugin/RimoriClient';
import { MenuEntry } from '../../fromRimori/PluginTypes';

export interface Position {
  x: number;
  y: number;
  text?: string;
}

const ContextMenu = ({ client }: { client: RimoriClient }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [actions, setActions] = useState<MenuEntry[]>([]);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [openOnTextSelect, setOpenOnTextSelect] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth < 768;

  /**
   * Calculates position for mobile context menu based on selected text bounds.
   * Centers the menu horizontally over the selected text and positions it 30px below the text's end.
   * @param selectedText - The currently selected text
   * @param menuWidth - The width of the menu to center properly
   * @returns Position object with x and y coordinates
   */
  const calculateMobilePosition = (selectedText: string, menuWidth: number = 0): Position => {
    const selection = window.getSelection();
    if (!selection || !selectedText) {
      return { x: 0, y: 0, text: selectedText };
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Center horizontally over the selected text, accounting for menu width
    const centerX = rect.left + rect.width / 2 - menuWidth / 2;

    // Position 12px below where the text ends vertically
    const textEndY = rect.bottom + 12;

    return { x: centerX, y: textEndY, text: selectedText };
  };

  useEffect(() => {
    const actions = client.plugin
      .getPluginInfo()
      .installedPlugins.flatMap((p) => p.context_menu_actions)
      .filter(Boolean);
    setActions(actions);
    setOpenOnTextSelect(client.plugin.getUserInfo().context_menu_on_select);

    EventBus.on<{ actions: MenuEntry[] }>('global.contextMenu.createActions', ({ data }) => {
      setActions([...data.actions, ...actions]);
    });
  }, []);

  // Update menu width when menu is rendered
  useEffect(() => {
    if (isOpen && menuRef.current) {
      setMenuWidth(menuRef.current.offsetWidth);
    }
  }, [isOpen, actions]);

  useEffect(() => {
    // Track mouse position globally
    const handleMouseMove = (e: MouseEvent) => {
      const selectedText = window.getSelection()?.toString().trim();
      if (isOpen && selectedText === position.text) return;

      if (isMobile && selectedText) {
        setPosition(calculateMobilePosition(selectedText, menuWidth));
      } else {
        setPosition({ x: e.clientX, y: e.clientY, text: selectedText });
      }
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
      const isTextInput =
        target &&
        (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text'));
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

        if (isMobile) {
          setPosition(calculateMobilePosition(selectedText, menuWidth));
        } else {
          setPosition({ x: e.clientX, y: e.clientY, text: selectedText });
        }
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // Add selectionchange listener to close menu if selection is cleared and update position for mobile
    const handleSelectionChange = () => {
      const selectedText = window.getSelection()?.toString().trim();
      if (!selectedText && isOpen) {
        setIsOpen(false);
      } else if (selectedText && isOpen && isMobile) {
        // Update position in real-time as text selection changes on mobile
        setPosition(calculateMobilePosition(selectedText, menuWidth));
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('contextmenu', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('contextmenu', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [openOnTextSelect, isOpen, position.text]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-400 dark:bg-gray-700 shadow-lg border border-gray-400 rounded-md overflow-hidden dark:text-white z-50"
      style={{ top: position.y, left: position.x }}
    >
      {actions.map((action, index) => (
        <MenuEntryItem
          key={index}
          icon={action.icon}
          text={action.text}
          onClick={() => {
            setIsOpen(false);
            window.getSelection()?.removeAllRanges();
            client.event.emitSidebarAction(action.plugin_id, action.action_key, position.text);
          }}
        />
      ))}
    </div>
  );
};

function MenuEntryItem(props: { icon: React.ReactNode; text: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className="px-4 py-2 text-left hover:bg-gray-500 dark:hover:bg-gray-600 w-full flex flex-row"
    >
      <span className="flex-grow">{props.icon}</span>
      <span className="flex-grow">{props.text}</span>
      {/* <span className="text-sm">Ctrl+Shift+xxxx</span> */}
    </button>
  );
}

export default ContextMenu;
