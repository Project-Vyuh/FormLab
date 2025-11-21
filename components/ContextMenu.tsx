/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2Icon } from './icons';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onDelete: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleDeleteClick = () => {
    onDelete();
    onClose();
  };

  if (!position) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 1000,
          }}
          className="bg-[#2a2a2a] rounded-lg shadow-xl border border-gray-700 py-1 min-w-[160px]"
        >
          <button
            onClick={handleDeleteClick}
            className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#3a3a3a] flex items-center gap-2 transition-colors"
          >
            <Trash2Icon className="w-4 h-4 text-red-400" />
            <span>Delete Model</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContextMenu;
