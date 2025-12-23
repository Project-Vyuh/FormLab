/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserIcon,
    ZapIcon,
    PlusIcon,
    Trash2Icon,
    WandIcon,
    LayersIcon
} from './icons';
import { CompositeSubject, HistoryItem } from '../types';

interface CompositesSectionProps {
    isCompositeMode: boolean;
    onCompositeModeToggle: (mode: boolean) => void;
    compositeSubjects: CompositeSubject[];
    onAddCompositeSubject: (subject: CompositeSubject) => void;
    onRemoveCompositeSubject: (id: string) => void;
    compositePrompt: string;
    onCompositePromptChange: (prompt: string) => void;
    onGenerate: () => void;
    isLoading: boolean;
    isProModel: boolean;
    history: HistoryItem[];
    onUploadCompositeSubject: (file: File) => void;
    isCompositeRevision?: boolean;
    currentProjectId?: string;
    currentCompositeHistoryId?: string | null;
    onSelectCompositeHistoryItem?: (id: string | null) => void;
    onDeleteComposite?: (id: string) => void;
}

const CompositesSection: React.FC<CompositesSectionProps> = ({
    isCompositeMode,
    onCompositeModeToggle,
    compositeSubjects,
    onAddCompositeSubject,
    onRemoveCompositeSubject,
    compositePrompt,
    onCompositePromptChange,
    onGenerate,
    isLoading,
    isProModel,
    history,
    onUploadCompositeSubject,

    isCompositeRevision,
    currentProjectId,
    currentCompositeHistoryId,
    onSelectCompositeHistoryItem,
    onDeleteComposite
}) => {
    // Filter history for "All Composites" grid
    // 1. Must be composite type
    // 2. Must belong to current project (if project is selected)
    const compositeHistory = React.useMemo(() => {
        return history
            .filter(h => h.type === 'composite-generation')
            .filter(h => !currentProjectId || h.projectId === currentProjectId)
            .filter(h => !h.parentId) // Only show base composites (roots) in the grid
            .sort((a, b) => {
                // Sort by timestamp descending (newest first)
                // IDs are 'comp-TIMESTAMP' or 'hist-TIMESTAMP'
                const timeA = parseInt(a.id.split('-')[1] || '0');
                const timeB = parseInt(b.id.split('-')[1] || '0');
                return timeB - timeA;
            });
    }, [history, currentProjectId]);
    const [isUploading, setIsUploading] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, id });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setIsUploading(true);
            try {
                await onUploadCompositeSubject(e.target.files[0]);
            } catch (error) {
                console.error("Upload failed", error);
            } finally {
                setIsUploading(false);
                // Reset input
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="mt-4 pt-6 border-t border-white/10 flex flex-col gap-4">
            {/* Main Heading: Composites */}
            <div className="flex items-center gap-2 mb-1">
                <LayersIcon className="w-4 h-4 text-blue-400/80" />
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Composites</h3>
            </div>

            {/* Sub Heading: Multi-Model Feature */}
            <div className="flex items-center justify-between pl-2 border-l-2 border-white/5">
                <div className="flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Multi-Model Feature</span>
                </div>
                <label className={`relative inline-flex items-center flex-shrink-0 ${!isProModel ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} title={isProModel ? "Toggle Composite Mode" : "Requires Nano Banana Pro"}>
                    <input
                        type="checkbox"
                        checked={isCompositeMode}
                        onChange={(e) => isProModel && onCompositeModeToggle(e.target.checked)}
                        className="sr-only peer"
                        disabled={!isProModel}
                    />
                    <div className="w-7 h-3.5 bg-white/10 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-white/20 peer-checked:after:bg-white"></div>
                </label>
            </div>

            {!isProModel && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-[11px] text-blue-300 leading-relaxed">
                        <ZapIcon className="w-3 h-3 inline mr-1" />
                        Composite mode is exclusive to <strong>Nano Banana Pro</strong>. Select the Pro model to enable multi-model scenes.
                    </p>
                </div>
            )}

            {isCompositeMode && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex flex-col gap-4 overflow-hidden pl-2"
                >
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] text-gray-500 font-medium">SCENE SUBJECTS ({compositeSubjects.length}/4)</span>
                        <div className="grid grid-cols-4 gap-2">
                            {compositeSubjects.map((s) => (
                                <div key={s.id} className="relative group aspect-square rounded-md overflow-hidden bg-white/5 border border-white/10">
                                    <img src={s.url} alt={s.name} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => onRemoveCompositeSubject(s.id)}
                                        className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        <Trash2Icon className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ))}
                            {compositeSubjects.length < 4 && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="aspect-square rounded-md border border-dashed border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5 flex items-center justify-center transition-all text-gray-500 hover:text-blue-400 relative"
                                >
                                    {isUploading ? (
                                        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                    ) : (
                                        <PlusIcon className="w-5 h-5" />
                                    )}
                                </button>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] text-gray-500 font-medium">
                            {isCompositeRevision ? "SCENE REVISION" : "SCENE DESCRIPTION"}
                        </span>
                        <textarea
                            value={compositePrompt}
                            onChange={(e) => onCompositePromptChange(e.target.value)}
                            placeholder={isCompositeRevision ? "Describe changes to the scene..." : "e.g., Two models laughing and drinking champagne at a luxury gala..."}
                            className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                    </div>

                    {/* All Composites Grid */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">All Composites</span>
                        <div className="grid grid-cols-3 gap-2">
                            {/* New Composite Card (+ Card) */}
                            <button
                                onClick={() => onSelectCompositeHistoryItem && onSelectCompositeHistoryItem(null)}
                                className={`aspect-[3/4] rounded-lg border flex flex-col items-center justify-center gap-2 transition-all group ${!currentCompositeHistoryId
                                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
                                    }`}
                            >
                                <div className={`p-2 rounded-full ${!currentCompositeHistoryId ? 'bg-blue-500/20' : 'bg-white/10 group-hover:bg-white/20'}`}>
                                    <PlusIcon className="w-5 h-5" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-wider">New</span>
                            </button>

                            {/* History Cards */}
                            {compositeHistory.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onSelectCompositeHistoryItem && onSelectCompositeHistoryItem(item.id)}
                                    className={`relative aspect-[3/4] rounded-lg border overflow-hidden transition-all group ${currentCompositeHistoryId === item.id
                                        ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]'
                                        : 'border-white/10 hover:border-white/30'
                                        }`}
                                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                                >
                                    <img
                                        src={item.imageUrl}
                                        alt={item.prompt}
                                        className="w-full h-full object-cover"
                                    />
                                    {currentCompositeHistoryId === item.id && (
                                        <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {compositeHistory.length === 0 && (
                            <div className="p-2 text-center border border-dashed border-white/10 rounded-lg text-gray-600 text-[9px] italic">
                                No saved composites
                            </div>
                        )}
                    </div>

                </motion.div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={() => onDeleteComposite?.(contextMenu.id)}
                        className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                        <Trash2Icon className="w-3.5 h-3.5" />
                        Delete Composite
                    </button>
                </div>
            )}
        </div>
    );
};




export default CompositesSection;
