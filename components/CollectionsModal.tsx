import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ChevronRightIcon, GridIcon, LayoutIcon, StarIcon } from './icons';
import { loadPredefinedModels, PredefinedModel, getGlobalModels, getGlobalWardrobeItems } from '../services/firestoreService';
import { User, Project, WardrobeItem, Model } from '../types';

interface CollectionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUseTemplate: (template: PredefinedModel) => void;
    onNavigateToCollections: () => void;
    onStartBlankCanvas: () => void;
    currentUser: User | null;
    projects: Project[];
    currentProjectId: string | null;
    showUserContent?: boolean;
}

type MenuSection = 'models' | 'user-content';
type MenuItem = 'featured' | 'latest' | 'categories' | 'user-models' | 'user-wardrobe';

const CollectionsModal: React.FC<CollectionsModalProps> = ({ isOpen, onClose, onUseTemplate, onNavigateToCollections, onStartBlankCanvas, currentUser, projects, currentProjectId, showUserContent = true }) => {
    const [activeItem, setActiveItem] = useState<MenuItem>('featured');
    const [models, setModels] = useState<PredefinedModel[]>([]);
    const [userModels, setUserModels] = useState<Model[]>([]);
    const [userWardrobe, setUserWardrobe] = useState<WardrobeItem[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<PredefinedModel | null>(null);
    const [isBlankCanvasSelected, setIsBlankCanvasSelected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Check if selected template is already in the current project
    const isDuplicate = React.useMemo(() => {
        if (!selectedTemplate || !currentProjectId) return false;
        return userModels.some(m => m.sourceTemplateId === selectedTemplate.id && m.projectId === currentProjectId);
    }, [selectedTemplate, userModels, currentProjectId]);

    useEffect(() => {
        if (isOpen) {
            loadContent();
        }
    }, [isOpen, activeItem]);

    const loadContent = async () => {
        setIsLoading(true);
        try {
            if (activeItem === 'featured' || activeItem === 'latest') {
                const data = await loadPredefinedModels();
                setModels(data);

                // Also load user models to check for duplicates if we haven't already
                if (currentUser && userModels.length === 0) {
                    const userData = await getGlobalModels(currentUser.uid);
                    setUserModels(userData);
                }
            } else if (activeItem === 'user-models') {
                if (currentUser) {
                    const data = await getGlobalModels(currentUser.uid);
                    setUserModels(data);
                }
            } else if (activeItem === 'user-wardrobe') {
                if (currentUser) {
                    const data = await getGlobalWardrobeItems(currentUser.uid);
                    setUserWardrobe(data);
                }
            } else {
                setModels([]);
            }
        } catch (error) {
            console.error("Failed to load content", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseTemplate = () => {
        if (isBlankCanvasSelected) {
            onStartBlankCanvas();
            onClose();
        } else if (selectedTemplate && !isDuplicate) {
            onUseTemplate(selectedTemplate);
            onClose();
        }
    };

    const handleAllCollections = () => {
        onNavigateToCollections();
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedTemplate(null);
            setIsBlankCanvasSelected(false);
        }
    }, [isOpen]);

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
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-5xl h-[70vh] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a]/80 backdrop-blur-xl shadow-2xl flex flex-col"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Unified Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div>
                                <h2 className="text-lg font-semibold text-white tracking-tight">Collections</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Choose a template to get started</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex flex-grow overflow-hidden">
                            {/* Sidebar */}
                            <div className="w-72 min-w-[18rem] bg-white/5 border-r border-white/5 flex flex-col flex-shrink-0">
                                <div className="flex-grow py-4 overflow-y-auto">
                                    {/* Models Section */}
                                    <div className="mb-2">
                                        <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Models
                                        </div>
                                        <div className="space-y-0.5">
                                            <button
                                                onClick={() => setActiveItem('featured')}
                                                className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${activeItem === 'featured'
                                                    ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                    }`}
                                            >
                                                <StarIcon className="w-4 h-4" />
                                                Featured
                                            </button>
                                            <button
                                                onClick={() => setActiveItem('latest')}
                                                className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${activeItem === 'latest'
                                                    ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                    }`}
                                            >
                                                <GridIcon className="w-4 h-4" />
                                                Latest
                                            </button>
                                            <button
                                                onClick={() => setActiveItem('categories')}
                                                className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${activeItem === 'categories'
                                                    ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                    }`}
                                            >
                                                <LayoutIcon className="w-4 h-4" />
                                                Categories
                                            </button>
                                        </div>
                                    </div>

                                    {/* User Content Section */}
                                    {showUserContent && currentUser && (
                                        <div className="mb-2 mt-4">
                                            <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                User Content
                                            </div>
                                            <div className="space-y-0.5">
                                                <button
                                                    onClick={() => setActiveItem('user-models')}
                                                    className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${activeItem === 'user-models'
                                                        ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                        }`}
                                                >
                                                    <StarIcon className="w-4 h-4" />
                                                    Your Models
                                                </button>
                                                <button
                                                    onClick={() => setActiveItem('user-wardrobe')}
                                                    className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${activeItem === 'user-wardrobe'
                                                        ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                        }`}
                                                >
                                                    <LayoutIcon className="w-4 h-4" />
                                                    Your Wardrobe
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-white/5">
                                    <button
                                        onClick={handleAllCollections}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap"
                                    >
                                        All Collections
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-grow flex flex-col bg-transparent overflow-hidden">
                                {/* Content Grid */}
                                <div className="flex-grow p-6 overflow-y-auto">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : models.length > 0 ? (
                                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                            {/* Blank Canvas Option */}
                                            <div
                                                onClick={() => {
                                                    setIsBlankCanvasSelected(!isBlankCanvasSelected);
                                                    setSelectedTemplate(null);
                                                }}
                                                className={`group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border transition-all flex flex-col items-center justify-center ${isBlankCanvasSelected
                                                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10'
                                                    : 'border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${isBlankCanvasSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400 group-hover:text-white'}`}>
                                                    <LayoutIcon className="w-6 h-6" />
                                                </div>
                                                <p className={`text-sm font-medium group-hover:text-white ${isBlankCanvasSelected ? 'text-white' : 'text-gray-300'}`}>Blank Canvas</p>
                                                <p className="text-xs text-gray-500 mt-1">Start from scratch</p>

                                                {isBlankCanvasSelected && (
                                                    <div className="absolute top-3 right-3">
                                                        <div className="bg-blue-500 rounded-full p-1">
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {models.map((model) => {
                                                const isDuplicate = userModels.some(m =>
                                                    m.sourceTemplateId === model.id && m.projectId === currentProjectId
                                                );

                                                return (
                                                    <div
                                                        key={model.id}
                                                        onClick={() => {
                                                            if (!isDuplicate) {
                                                                setSelectedTemplate(prev => prev?.id === model.id ? null : model);
                                                                setIsBlankCanvasSelected(false);
                                                            }
                                                        }}
                                                        className={`group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer border transition-all ${isDuplicate
                                                            ? 'border-white/5 opacity-50 grayscale cursor-not-allowed'
                                                            : selectedTemplate?.id === model.id
                                                                ? 'border-blue-500 ring-2 ring-blue-500/20'
                                                                : 'border-white/10 hover:border-white/30'
                                                            }`}
                                                    >
                                                        <img
                                                            src={model.url}
                                                            alt={model.name}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                            <p className="text-xs font-medium text-white truncate">{model.name}</p>
                                                        </div>
                                                        {selectedTemplate?.id === model.id && (
                                                            <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                                                                <div className="bg-blue-500 rounded-full p-1">
                                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {isDuplicate && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                                <div className="bg-green-500 rounded-full p-1">
                                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                    ) : activeItem === 'user-models' ? (
                                        <div className="space-y-8">
                                            {Object.entries(userModels.reduce((acc, model) => {
                                                const pid = model.projectId || 'unknown';
                                                if (!acc[pid]) acc[pid] = [];
                                                acc[pid].push(model);
                                                return acc;
                                            }, {} as Record<string, Model[]>)).map(([projectId, projectModels]: [string, Model[]]) => {
                                                const projectTitle = projects.find(p => p.id === projectId)?.title || (projectId === 'unknown' ? 'Unassigned' : 'Unknown Project');
                                                return (
                                                    <div key={projectId}>
                                                        <h3 className="text-sm font-semibold text-gray-400 mb-3 px-1">{projectTitle}</h3>
                                                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                            {projectModels.map((model) => (
                                                                <div key={model.id} className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-white/5">
                                                                    <img src={model.url} alt={model.name} className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                                        <p className="text-xs font-medium text-white truncate">{model.name}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {userModels.length === 0 && (
                                                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                                    <p>No user models found.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : activeItem === 'user-wardrobe' ? (
                                        <div className="space-y-8">
                                            {Object.entries(userWardrobe.reduce((acc, item) => {
                                                const pid = item.projectId || 'unknown';
                                                if (!acc[pid]) acc[pid] = [];
                                                acc[pid].push(item);
                                                return acc;
                                            }, {} as Record<string, WardrobeItem[]>)).map(([projectId, projectItems]: [string, WardrobeItem[]]) => {
                                                const projectTitle = projects.find(p => p.id === projectId)?.title || (projectId === 'unknown' ? 'Unassigned' : 'Unknown Project');
                                                return (
                                                    <div key={projectId}>
                                                        <h3 className="text-sm font-semibold text-gray-400 mb-3 px-1">{projectTitle}</h3>
                                                        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                                                            {projectItems.map((item) => (
                                                                <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5">
                                                                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                                                        <p className="text-xs font-medium text-white truncate">{item.name}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {userWardrobe.length === 0 && (
                                                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                                    <p>No wardrobe items found.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                            <LayoutIcon className="w-12 h-12 mb-3 opacity-20" />
                                            <p>No items found in this category.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="p-4 border-t border-white/5 flex justify-end bg-white/5">
                                    <button
                                        onClick={handleUseTemplate}
                                        disabled={(!selectedTemplate && !isBlankCanvasSelected) || isDuplicate}
                                        className={`px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${isDuplicate ? 'bg-gray-600' : ''}`}
                                        style={{ backgroundColor: isDuplicate ? undefined : '#318CE7' }}
                                    >
                                        {isBlankCanvasSelected ? 'Start from scratch' : isDuplicate ? 'Already in Project' : 'Use Template'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )
            }
        </AnimatePresence >
    );
};

export default CollectionsModal;
