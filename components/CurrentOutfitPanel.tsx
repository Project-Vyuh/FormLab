/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { OutfitLayer } from '../types';
import { Trash2Icon, ShirtIcon } from './icons';

interface OutfitStackProps {
  outfitHistory: OutfitLayer[];
  onRemoveLayer: (index: number) => void;
}

const OutfitStack: React.FC<OutfitStackProps> = ({ outfitHistory, onRemoveLayer }) => {
  return (
    <div className="flex flex-col">
      <h2 className="text-base font-sans font-semibold text-gray-800 dark:text-gray-200 pb-2 mb-2 flex items-center gap-2">
        <ShirtIcon className="w-5 h-5" />
        Outfit Stack
      </h2>
      <div className="space-y-2">
        {outfitHistory.map((layer, index) => (
          <div
            key={layer.garment?.id || 'base'}
            className="flex items-center justify-between bg-white/50 dark:bg-white/10 p-2 rounded-lg animate-fade-in border border-gray-200/80 dark:border-gray-700/80"
          >
            <div className="flex items-center overflow-hidden">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-full">
                  {index + 1}
                </span>
                {layer.garment && (
                    <img src={layer.garment.url} alt={layer.garment.name} className="flex-shrink-0 w-10 h-10 object-cover rounded-md mr-3" />
                )}
                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate text-sm" title={layer.garment?.name}>
                  {layer.garment ? layer.garment.name : 'Base Model'}
                </span>
            </div>
            {index > 0 && (
               <button
                onClick={() => onRemoveLayer(index)}
                className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                aria-label={`Remove ${layer.garment?.name}`}
              >
                <Trash2Icon className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {outfitHistory.length === 1 && (
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 pt-3">Your stacked items will appear here. Select an item from the wardrobe below.</p>
        )}
      </div>
    </div>
  );
};

export default OutfitStack;