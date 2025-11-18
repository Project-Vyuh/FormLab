/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '../icons';

const CollapsibleSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    isToggleable?: boolean;
    isPanelEnabled?: boolean;
    onPanelToggle?: () => void;
}> = ({ title, icon, isOpen, onToggle, children, isToggleable, isPanelEnabled, onPanelToggle }) => (
    <div className="border-t border-gray-800 pt-4">
        <div className="w-full flex justify-between items-center text-sm font-semibold text-gray-200">
            <button onClick={onToggle} className="flex items-center gap-2 flex-grow text-left">
                {icon} {title}
            </button>
            <div className="flex items-center gap-3">
                {isToggleable && (
                    <label className="relative inline-flex items-center cursor-pointer" title={isPanelEnabled ? `Disable ${title} controls` : `Enable ${title} controls`}>
                        <input type="checkbox" checked={isPanelEnabled} onChange={onPanelToggle} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                )}
                <button onClick={onToggle} aria-label={isOpen ? 'Collapse section' : 'Expand section'}>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </div>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className={`mt-3 space-y-4 transition-opacity duration-300 ${isToggleable && !isPanelEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export default CollapsibleSection;
