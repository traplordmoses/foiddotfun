import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Hook encapsulating all wallet menu dropdown state:
 * open/close, positioning, click-outside, focus trap, keyboard nav.
 */
export function useWalletMenu(isConnected: boolean, onSwitchWallet: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Client-side mount check for portal
  useEffect(() => { setMounted(true); }, []);

  // Calculate menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = Math.max(rect.width, 200);
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - menuWidth,
        width: menuWidth,
      });
    }
  }, [isOpen]);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus trap within menu
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const menu = menuRef.current;
    const focusableElements = menu.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    menu.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);
    firstElement?.focus();
    return () => {
      menu.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const toggle = useCallback(() => {
    if (!isConnected) {
      onSwitchWallet();
      return;
    }
    setIsOpen((prev) => !prev);
  }, [isConnected, onSwitchWallet]);

  const close = useCallback(() => setIsOpen(false), []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    },
    [isOpen],
  );

  return {
    isOpen,
    mounted,
    menuPosition,
    buttonRef,
    menuRef,
    menuId,
    toggle,
    close,
    handleKeyDown,
  };
}
