/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, FolderIcon } from './icons';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: { name: string; description: string }) => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Please provide a folder name.');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
    });
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-[#2a2a2a] rounded-2xl w-full max-w-md flex flex-col shadow-xl border border-gray-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-sans font-semibold text-gray-200">Create Folder</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Folder Name */}
              <div>
                <label htmlFor="folder-name" className="text-sm font-medium text-gray-300 block mb-2">
                  Folder Name *
                </label>
                <input
                  type="text"
                  id="folder-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., Summer Collection"
                  autoFocus
                  className="w-full p-3 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="folder-description" className="text-sm font-medium text-gray-300 block mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="folder-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for this folder..."
                  rows={3}
                  className="w-full p-3 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Info */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-400">
                  Organize your templates into folders for better management and quick access.
                </p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="px-6 pb-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end items-center gap-3 p-4 bg-[#1a1a1a] border-t border-gray-700 rounded-b-2xl">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!name.trim()}
              >
                Create Folder
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateFolderModal;
