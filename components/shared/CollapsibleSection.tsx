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
    noBorder?: boolean;
}> = ({ title, icon, isOpen, onToggle, children, isToggleable, isPanelEnabled, onPanelToggle, noBorder }) => (
    <div className={noBorder ? "pt-3" : "border-t border-white/5 pt-3"}>
        <div className="w-full flex justify-between items-center">
            <button
                onClick={onToggle}
                className="flex items-center gap-2 flex-grow text-left min-w-0 overflow-hidden group py-1 transition-colors"
            >
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors">{icon}</span>
                <span className="truncate text-[11px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">{title}</span>
            </button>
            <div className="flex items-center gap-2.5 flex-shrink-0">
                {isToggleable && (
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" title={isPanelEnabled ? `Disable ${title} controls` : `Enable ${title} controls`}>
                        <input type="checkbox" checked={isPanelEnabled} onChange={onPanelToggle} className="sr-only peer" />
                        <div className="w-7 h-3.5 bg-white/10 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-white/20 peer-checked:after:bg-white"></div>
                    </label>
                )}
                <button onClick={onToggle} aria-label={isOpen ? 'Collapse section' : 'Expand section'} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
                    <div className={`mt-3 space-y-3 transition-opacity duration-300 ${isToggleable && !isPanelEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export default CollapsibleSection;
