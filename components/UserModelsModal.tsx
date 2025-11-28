import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UserIcon } from './icons';
import { Model } from '../types';
import { getGlobalModels, deleteGlobalModel, renameGlobalModel } from '../services/firestoreService';
import { getCurrentUserId } from '../services/authService';
import ConfirmationModal from './ConfirmationModal';

interface UserModelsModalProps {
    isOpen: boolean;
    onClose: () => void;
    models: Model[];
    onSelectModel: (model: Model) => void;
    currentModelUrl?: string;
    onRenameModel?: (modelId: string, newName: string) => void;
    onDeleteModel?: (model: Model) => void;
    currentProjectId?: string;
}

const UserModelsModal: React.FC<UserModelsModalProps> = ({
    isOpen,
    onClose,
    models,
    onSelectModel,
    currentModelUrl,
    onRenameModel,
    onDeleteModel,
    currentProjectId
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [contextMenuModel, setContextMenuModel] = useState<Model | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [modelToDelete, setModelToDelete] = useState<Model | null>(null);
    const [globalModels, setGlobalModels] = useState<Model[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGlobalModels();
        } else {
            setSearchTerm('');
            setContextMenuModel(null);
            setContextMenuPosition(null);
        }
    }, [isOpen, currentProjectId]);

    const loadGlobalModels = async () => {
        const userId = getCurrentUserId();
        if (!userId) return;

        setIsLoading(true);
        try {
            const models = await getGlobalModels(userId, currentProjectId);
            const formattedModels: Model[] = models.map(m => ({
                id: m.id,
                url: m.url,
                name: m.name,
                source: 'user',
                projectId: m.projectId,
                historyItemId: m.historyItemId,
                createdAt: new Date(m.createdAt).getTime(),
                updatedAt: new Date(m.updatedAt).getTime(),
            }));
            setGlobalModels(formattedModels.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
        } catch (error) {
            console.error('Failed to load global models:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Ref for context menu to detect clicks outside
    const menuRef = useRef<HTMLDivElement>(null);

    // Close context menu on click outside or escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextMenuPosition && menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenuPosition(null);
                setContextMenuModel(null);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && contextMenuPosition) {
                setContextMenuPosition(null);
                setContextMenuModel(null);
            }
        };

        if (contextMenuPosition) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenuPosition]);

    const filteredModels = globalModels.filter(model =>
        model.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleContextMenu = (e: React.MouseEvent, model: Model) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuModel(model);
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
    };

    const handleRename = () => {
        if (contextMenuModel) {
            console.log('[UserModelsModal] Opening rename modal for:', contextMenuModel.id);
            setRenameValue(contextMenuModel.name || '');
            setIsRenameModalOpen(true);
            setContextMenuPosition(null);
        }
    };

    const handleRenameSubmit = async () => {
        if (contextMenuModel && renameValue.trim()) {
            const userId = getCurrentUserId();
            if (userId) {
                try {
                    await renameGlobalModel(userId, contextMenuModel.id, renameValue.trim());
                    await loadGlobalModels(); // Refresh list
                    if (onRenameModel) onRenameModel(contextMenuModel.id, renameValue.trim());
                } catch (error) {
                    console.error('Failed to rename model:', error);
                }
            }
            setIsRenameModalOpen(false);
            setContextMenuModel(null);
            setRenameValue('');
        }
    };

    const handleDeleteClick = (model: Model) => {
        setModelToDelete(model);
    };

    const handleDeleteConfirm = async () => {
        if (modelToDelete) {
            const userId = getCurrentUserId();
            if (userId) {
                try {
                    await deleteGlobalModel(userId, modelToDelete.id);
                    await loadGlobalModels(); // Refresh list
                    if (onDeleteModel) onDeleteModel(modelToDelete);
                } catch (error) {
                    console.error('Failed to delete model:', error);
                }
            }
            setModelToDelete(null);
        }
    };

    return (
        <>
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
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-5xl h-[70vh] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a]/80 backdrop-blur-xl shadow-2xl flex flex-col"
                            style={{
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                                        <UserIcon className="w-5 h-5 text-gray-400" />
                                        Your Models
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Manage and select from your created models</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <XIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-grow p-6 overflow-y-auto">
                                {filteredModels.length > 0 ? (
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {filteredModels.map((model) => (
                                            <div
                                                key={model.id}
                                                onClick={() => {
                                                    onSelectModel(model);
                                                    onClose();
                                                }}
                                                onContextMenu={(e) => handleContextMenu(e, model)}
                                                className={`group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border transition-all ${currentModelUrl === model.url
                                                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                                                    : 'border-white/10 hover:border-white/30'
                                                    }`}
                                            >
                                                <img
                                                    src={model.url}
                                                    alt={model.name || 'Model'}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                    <p className="text-xs font-medium text-white truncate">{model.name || 'Untitled Model'}</p>
                                                    <p className="text-[10px] text-gray-400 truncate">
                                                        {model.updatedAt || model.createdAt
                                                            ? new Date(model.updatedAt || model.createdAt || 0).toLocaleString()
                                                            : 'Unknown Date'}
                                                    </p>
                                                </div>
                                                {currentModelUrl === model.url && (
                                                    <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                                                        <div className="bg-blue-500 rounded-full p-1">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <UserIcon className="w-12 h-12 mb-3 opacity-20" />
                                        <p>No models found.</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Context Menu - Rendered at root level with high z-index and liquid glass UI */}
            {contextMenuPosition && contextMenuModel && isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{
                        position: 'fixed',
                        left: `${contextMenuPosition.x}px`,
                        top: `${contextMenuPosition.y}px`,
                        zIndex: 120,
                    }}
                    className="bg-[#1a1a1a]/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 py-1.5 min-w-[180px] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleRename}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-white/10 transition-all duration-200 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Rename</span>
                    </button>
                    <div className="h-px bg-white/5 mx-2" />
                    <button
                        onClick={() => contextMenuModel && handleDeleteClick(contextMenuModel)}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-all duration-200 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Model</span>
                    </button>
                </motion.div>
            )}

            {/* Rename Modal - Rendered at root level with liquid glass UI using Portal */}
            {ReactDOM.createPortal(
                <AnimatePresence>
                    {isRenameModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[130] flex items-center justify-center p-4"
                            onClick={() => setIsRenameModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                transition={{ type: "spring", duration: 0.3 }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl"
                                style={{
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-white tracking-tight">
                                        Rename Model
                                    </h2>
                                    <button
                                        onClick={() => setIsRenameModalOpen(false)}
                                        className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        <XIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mb-6">
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSubmit();
                                            if (e.key === 'Escape') setIsRenameModalOpen(false);
                                        }}
                                        placeholder="Enter model name"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsRenameModalOpen(false)}
                                        className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRenameSubmit}
                                        disabled={!renameValue.trim()}
                                        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Rename
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Delete Confirmation Modal - Rendered at root level using Portal */}
            {modelToDelete && ReactDOM.createPortal(
                <ConfirmationModal
                    isOpen={true}
                    onClose={() => setModelToDelete(null)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Model"
                    message="Are you sure you want to delete this model? This action cannot be undone."
                    confirmText="Delete Model"
                />,
                document.body
            )}
        </>
    );
};

export default UserModelsModal;
