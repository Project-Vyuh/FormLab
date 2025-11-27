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
                            className="bg-[#1a1a1a]/80 backdrop-blur-xl w-full max-w-5xl h-[70vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
                            style={{
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                                <div>
                                    <h2 className="text-lg font-semibold text-white tracking-tight">Projects</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">All your created projects appear here.</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex flex-1 overflow-hidden">
                                {/* Sidebar - Project List */}
                                <div className="w-72 min-w-[18rem] bg-white/5 border-r border-white/5 flex flex-col flex-shrink-0">
                                    <div className="flex-grow py-4 overflow-y-auto">
                                        <div className="mb-2">
                                            <div className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                Your Projects
                                            </div>
                                            <div className="space-y-0.5">
                                                {projects.map(project => (
                                                    <button
                                                        key={project.id}
                                                        onClick={() => setSelectedProjectId(project.id)}
                                                        className={`w-full text-left px-6 py-3 transition-all duration-200 group flex items-center gap-3 ${selectedProjectId === project.id
                                                            ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                                                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                                            }`}
                                                    >
                                                        <div className={`p-1.5 rounded-md ${selectedProjectId === project.id ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500 group-hover:text-gray-400'}`}>
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
                                            </div>
                                        </div>
                                        {projects.length === 0 && (
                                            <div className="text-center py-8 text-gray-500 text-xs">
                                                No projects found
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Main Content - Project Details */}
                                <div className="flex-1 bg-transparent p-8 flex flex-col">
                                    {selectedProject ? (
                                        <>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between mb-6">
                                                    <div>
                                                        <h1 className="text-xl font-bold text-white mb-2">{selectedProject.title}</h1>
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

                                            <div className="mt-auto pt-6 border-t border-white/5">
                                                <div className="mb-6">
                                                    <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
                                                    <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center justify-between">
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-200 mb-0.5">Delete this project</h4>
                                                            <p className="text-xs text-gray-500">Once you delete a project, there is no going back. Please be certain.</p>
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
                                                        className="px-6 py-2.5 bg-[#318CE7] hover:bg-[#2b7bc0] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
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
