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
    <div className={noBorder ? "pt-3" : "border-t border-gray-800 pt-3"}>
        <div className="w-full flex justify-between items-center text-xs font-semibold text-gray-200">
            <button onClick={onToggle} className="flex items-center gap-1.5 flex-grow text-left min-w-0 overflow-hidden">
                {icon} <span className="truncate">{title}</span>
            </button>
            <div className="flex items-center gap-2.5 flex-shrink-0">
                {isToggleable && (
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" title={isPanelEnabled ? `Disable ${title} controls` : `Enable ${title} controls`}>
                        <input type="checkbox" checked={isPanelEnabled} onChange={onPanelToggle} className="sr-only peer" />
                        <div className="w-8 h-4 bg-gray-800 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-500 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-gray-200 peer-checked:after:bg-gray-900"></div>
                    </label>
                )}
                <button onClick={onToggle} aria-label={isOpen ? 'Collapse section' : 'Expand section'}>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
                    <div className={`mt-2 space-y-3 transition-opacity duration-300 ${isToggleable && !isPanelEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export default CollapsibleSection;
