/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { OutfitLayer } from '../types';
import { LayersIcon } from './icons';

interface PerItemControlsProps {
    selectedLayer: OutfitLayer | undefined;
}

const PerItemControls: React.FC<PerItemControlsProps> = ({ selectedLayer }) => {
    if (!selectedLayer || !selectedLayer.garment) {
        return (
            <div className="pt-4 border-t border-gray-700/60">
                <h2 className="text-base font-sans font-semibold text-gray-200 flex items-center gap-2 mb-2">
                    <LayersIcon className="w-5 h-5" />
                    Per-Item Controls
                </h2>
                <p className="text-center text-xs text-gray-500 pt-3">Select a layer to see its controls.</p>
            </div>
        );
    }

    return (
        <div className="pt-4 border-t border-gray-700/60">
            <h2 className="text-base font-sans font-semibold text-gray-200 flex items-center gap-2 mb-3">
                <LayersIcon className="w-5 h-5" />
                Controls: <span className="font-sans font-medium text-gray-400 truncate">{selectedLayer.garment.name}</span>
            </h2>
            <div className="space-y-3 p-3 bg-black/20 rounded-md">
                <h3 className="text-sm font-semibold text-gray-300">Styling</h3>
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-400">Tuck Shirt</span>
                    <div className="relative">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                </label>
                <p className="text-xs text-gray-500 text-center pt-2">More AI fit & styling controls coming soon.</p>
            </div>
        </div>
    );
};

export default PerItemControls;