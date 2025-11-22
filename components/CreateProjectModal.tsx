import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (projectName: string) => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [projectName, setProjectName] = useState('');
    const [createdAt, setCreatedAt] = useState('');

    useEffect(() => {
        if (isOpen) {
            setProjectName('');
            setCreatedAt(new Date().toLocaleString());
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (projectName.trim()) {
            onCreate(projectName);
        }
    };

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
                        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white tracking-tight">Create New Project</h2>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Project Name */}
                            <div className="space-y-2">
                                <label htmlFor="projectName" className="text-sm font-medium text-gray-300">
                                    Project Name
                                </label>
                                <input
                                    id="projectName"
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="Enter project name..."
                                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Created At */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">
                                    Created at
                                </label>
                                <div className="w-full rounded-lg border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed">
                                    {createdAt}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={!projectName.trim()}
                                    className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                    style={{ backgroundColor: '#318CE7' }}
                                >
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CreateProjectModal;
