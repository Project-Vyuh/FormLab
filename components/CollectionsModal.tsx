import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons';

interface CollectionsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CollectionsModal: React.FC<CollectionsModalProps> = ({ isOpen, onClose }) => {
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
                        className="relative w-full max-w-4xl h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl flex flex-col"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-lg font-semibold text-white tracking-tight">Collections</h2>
                                <p className="text-sm text-gray-400 mt-1">Choose a template to get started</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content - Empty for now */}
                        <div className="flex-grow p-6 overflow-y-auto">
                            {/* Template grid will go here later */}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CollectionsModal;
