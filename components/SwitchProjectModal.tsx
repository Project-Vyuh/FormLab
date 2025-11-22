import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, FolderIcon, CalendarIcon, Trash2Icon } from './icons';
import { Project } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface SwitchProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    currentProjectId: string | null;
    onSwitchProject: (projectId: string) => void;
    onDeleteProject: (projectId: string) => void;
}

const SwitchProjectModal: React.FC<SwitchProjectModalProps> = ({
    isOpen,
    onClose,
    projects,
    currentProjectId,
    onSwitchProject,
    onDeleteProject,
}) => {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedProjectId(currentProjectId);
        }
    }, [isOpen, currentProjectId]);

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    const handleSwitch = () => {
        if (selectedProjectId) {
            onSwitchProject(selectedProjectId);
            onClose();
        }
    };

    const handleDeleteClick = () => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = () => {
        if (selectedProjectId) {
            onDeleteProject(selectedProjectId);
            setIsDeleteConfirmOpen(false);
            if (selectedProjectId === currentProjectId) {
                onClose();
            } else {
                setSelectedProjectId(null);
            }
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#1a1a1a] w-full max-w-4xl h-[60vh] rounded-xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#1a1a1a]">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Projects</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">All your created projects appear here.</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <XIcon className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex flex-1 overflow-hidden">
                                {/* Sidebar - Project List */}
                                <div className="w-72 border-r border-gray-800 overflow-y-auto bg-[#141414]">
                                    <div className="p-3 space-y-1">
                                        {projects.map(project => (
                                            <button
                                                key={project.id}
                                                onClick={() => setSelectedProjectId(project.id)}
                                                className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 group flex items-center gap-3 ${selectedProjectId === project.id
                                                    ? 'bg-blue-500/10 border border-blue-500/30'
                                                    : 'hover:bg-white/5 border border-transparent'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-md ${selectedProjectId === project.id ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700 group-hover:text-gray-300'}`}>
                                                    <FolderIcon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`text-sm font-medium truncate ${selectedProjectId === project.id ? 'text-blue-400' : 'text-gray-300 group-hover:text-white'}`}>
                                                        {project.title}
                                                    </h3>
                                                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                                        {new Date(project.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                        {projects.length === 0 && (
                                            <div className="text-center py-8 text-gray-500 text-xs">
                                                No projects found
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Main Content - Project Details */}
                                <div className="flex-1 bg-[#1a1a1a] p-8 flex flex-col">
                                    {selectedProject ? (
                                        <>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between mb-6">
                                                    <div>
                                                        <h1 className="text-2xl font-bold text-white mb-2">{selectedProject.title}</h1>
                                                        <div className="flex items-center gap-4 text-xs text-gray-400">
                                                            <span className="flex items-center gap-1.5">
                                                                <CalendarIcon className="w-3.5 h-3.5" />
                                                                Created {new Date(selectedProject.createdAt).toLocaleDateString()}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${selectedProject.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                                selectedProject.status === 'Completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                                }`}>
                                                                {selectedProject.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-auto pt-6 border-t border-gray-800">
                                                <div className="mb-6">
                                                    <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
                                                    <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center justify-between">
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-200 mb-0.5">Delete this project</h4>
                                                            <p className="text-xs text-gray-500">Once you delete a repository, there is no going back. Please be certain.</p>
                                                        </div>
                                                        <button
                                                            onClick={handleDeleteClick}
                                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded border border-red-500/20 transition-colors"
                                                        >
                                                            Delete this project
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handleSwitch}
                                                        disabled={selectedProjectId === currentProjectId}
                                                        className="px-6 py-2 bg-[#318CE7] hover:bg-[#2b7bc0] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                                                    >
                                                        {selectedProjectId === currentProjectId ? 'Current Project' : 'Switch Project'}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                                            Select a project to view details
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Project?"
                message="Are you sure you want to delete this project? This action cannot be undone and will permanently remove all data associated with this project."
                confirmText="Delete Project"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            />
        </>
    );
};

export default SwitchProjectModal;
