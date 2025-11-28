/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { OutfitLayer } from '../types';
import { ShirtIcon, ArrowUpIcon, ArrowDownIcon, EyeIcon, EyeOffIcon, ReplaceIcon, MoreHorizontalIcon, Trash2Icon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface LayerMenuProps {
    onRemove: () => void;
    onClose: () => void;
}

const LayerMenu: React.FC<LayerMenuProps> = ({ onRemove, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-full mt-1 w-32 bg-[#2a2a2a] border border-gray-700 rounded-md shadow-lg z-20 py-1"
        >
            <button onClick={onRemove} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10">
                <Trash2Icon className="w-4 h-4" />
                Remove
            </button>
        </motion.div>
    );
};

const LayerCard: React.FC<{
    layer: OutfitLayer;
    index: number;
    layerNumber: number;
    totalLayers: number;
    modelImageUrl: string | null;
    onMoveLayerUp: (layerId: string) => void;
    onMoveLayerDown: (layerId: string) => void;
    onToggleVisibility: (layerId: string) => void;
    onSelect: (layerId: string) => void;
    onRemove: (layerId: string) => void;
    onQuickReplace: (category: string) => void;
    isSelected: boolean;
    baseModelName?: string;
}> = (props) => {
    const { layer, index, layerNumber, totalLayers, modelImageUrl, baseModelName = 'Base Model', onMoveLayerUp, onMoveLayerDown, onToggleVisibility, onSelect, onRemove, onQuickReplace, isSelected } = props;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const isBaseModel = !layer.garment;

    return (
        <div
            className={`group/item relative rounded-lg border transition-all ${isSelected ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
            onClick={() => onSelect(layer.id)}
        >
            <div className="flex items-center gap-2 p-2">
                <div className="flex-shrink-0 w-5 h-12 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-gray-500">{layerNumber}</span>
                </div>

                {isBaseModel ? (
                    <div className="w-[26px] flex-shrink-0" /> // Placeholder for alignment
                ) : (
                    <div className="flex flex-col gap-0.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onMoveLayerUp(layer.id); }}
                            disabled={index <= 1}
                            className="p-1 rounded-md text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
                        >
                            <ArrowUpIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMoveLayerDown(layer.id); }}
                            disabled={index >= totalLayers - 1}
                            className="p-1 rounded-md text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
                        >
                            <ArrowDownIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <div className="w-12 h-12 rounded-md bg-gray-800 flex-shrink-0 overflow-hidden">
                    {isBaseModel && modelImageUrl && <img src={modelImageUrl} alt={baseModelName} className="w-full h-full object-cover" />}
                    {layer.garment && <img src={layer.garment.url} alt={layer.garment.name} className="w-full h-full object-cover" />}
                </div>

                <div className="flex-grow min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">{layer.garment ? layer.garment.name : baseModelName}</p>
                    <p className="text-[10px] text-gray-500">{layer.garment ? layer.garment.sku : '---'}</p>
                </div>

                <div className="flex items-center flex-shrink-0 gap-1">
                    {!isBaseModel && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onQuickReplace(layer.garment!.category); }}
                            className="p-1.5 rounded-md text-gray-400 hover:bg-white/10 hover:text-white opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Replace Item"
                        >
                            <ReplaceIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                        className="p-1.5 rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
                        title={layer.isVisible ? 'Hide Layer' : 'Show Layer'}
                    >
                        {layer.isVisible ? <EyeIcon className="w-4 h-4" /> : <EyeOffIcon className="w-4 h-4" />}
                    </button>
                    {!isBaseModel && (
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(p => !p); }}
                                className="p-1.5 rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
                                title="More options"
                            >
                                <MoreHorizontalIcon className="w-4 h-4" />
                            </button>
                            <AnimatePresence>
                                {isMenuOpen && <LayerMenu onClose={() => setIsMenuOpen(false)} onRemove={() => onRemove(layer.id)} />}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface OutfitStackProps {
    layers: OutfitLayer[];
    modelImageUrl: string | null;
    baseModelName?: string;
    onMoveLayerUp: (layerId: string) => void;
    onMoveLayerDown: (layerId: string) => void;
    onToggleVisibility: (layerId: string) => void;
    onRemove: (layerId: string) => void;
    onSelect: (layerId: string | null) => void;
    selectedLayerId: string | null;
    onQuickReplace: (category: string) => void;
}

const OutfitStack: React.FC<OutfitStackProps> = (props) => {
    const { layers, selectedLayerId, onSelect, modelImageUrl, baseModelName = 'Base Model' } = props;
    const reversedLayers = useMemo(() => [...layers].reverse(), [layers]);

    return (
        <div className="space-y-4">
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <ShirtIcon className="w-3.5 h-3.5" />
                Outfit Stack
            </h2>
            <div className="space-y-2">
                {reversedLayers.map((layer, reversedIndex) => {
                    const originalIndex = layers.length - 1 - reversedIndex;
                    const layerNumber = originalIndex + 1;
                    return (
                        <LayerCard
                            key={layer.id}
                            layer={layer}
                            index={originalIndex}
                            layerNumber={layerNumber}
                            totalLayers={layers.length}
                            isSelected={selectedLayerId === layer.id}
                            onSelect={onSelect}
                            modelImageUrl={modelImageUrl}
                            baseModelName={baseModelName}
                            onMoveLayerUp={props.onMoveLayerUp}
                            onMoveLayerDown={props.onMoveLayerDown}
                            onToggleVisibility={props.onToggleVisibility}
                            onRemove={props.onRemove}
                            onQuickReplace={props.onQuickReplace}
                        />
                    );
                })}
            </div>
            {layers.length <= 1 && (
                <p className="text-center text-[10px] text-gray-500 pt-2">Your stacked items will appear here. Select an item from the library to start.</p>
            )}
        </div>
    );
};

export default OutfitStack;