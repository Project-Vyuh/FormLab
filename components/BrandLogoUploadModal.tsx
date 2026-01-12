/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, XIcon, ImageIcon, Loader2Icon, CheckCircle2Icon, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { removeImageBackground } from '../services/backgroundRemovalService';

interface BrandLogoUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (logoBlob: Blob, fileName: string) => Promise<void>;
}

export const BrandLogoUploadModal: React.FC<BrandLogoUploadModalProps> = ({
    isOpen,
    onClose,
    onSave
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [originalPreview, setOriginalPreview] = useState<string | null>(null);
    const [processedPreview, setProcessedPreview] = useState<string | null>(null);
    const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setSelectedFile(null);
        setOriginalPreview(null);
        setProcessedPreview(null);
        setProcessedBlob(null);
        setIsProcessing(false);
        setIsSaving(false);
        setProcessingProgress(0);
        setProcessingStatus('');
        setError(null);
        setIsDragging(false);
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [onClose, resetState]);

    const handleFileSelect = useCallback((file: File) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('Image size must be less than 10MB');
            return;
        }

        setError(null);
        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setOriginalPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Reset processed state
        setProcessedPreview(null);
        setProcessedBlob(null);
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [handleFileSelect]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, [handleFileSelect]);

    const handleProcessBackground = useCallback(async () => {
        if (!selectedFile) return;

        setIsProcessing(true);
        setError(null);

        try {
            const blob = await removeImageBackground(selectedFile, (progress) => {
                setProcessingProgress(progress.percentage);
                setProcessingStatus(progress.status);
            });

            // Create preview URL
            const previewUrl = URL.createObjectURL(blob);
            setProcessedPreview(previewUrl);
            setProcessedBlob(blob);

        } catch (err) {
            console.error('[BrandLogoUploadModal] Background removal failed:', err);
            setError('Failed to process logo. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    }, [selectedFile]);

    const handleSave = useCallback(async () => {
        if (!processedBlob || !selectedFile) return;

        setIsSaving(true);
        setError(null);

        try {
            await onSave(processedBlob, selectedFile.name);
            handleClose();
        } catch (err) {
            console.error('[BrandLogoUploadModal] Save failed:', err);
            setError('Failed to save logo. Please try again.');
            setIsSaving(false);
        }
    }, [processedBlob, selectedFile, onSave, handleClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl w-full max-w-[520px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-white/40" />
                            <span className="text-sm font-medium text-white/70">Upload Brand Logo</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-white/10 rounded-lg transition-all text-gray-500 hover:text-white"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-5 space-y-4 custom-scrollbar">
                        {/* Upload Section */}
                        {!selectedFile && (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border border-dashed rounded-xl p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center",
                                    isDragging ? "border-white/40 bg-white/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                                )}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <UploadCloudIcon className="w-8 h-8 text-white/40" />
                                <div>
                                    <p className="text-sm font-medium text-white/70">
                                        {isDragging ? "Drop logo here" : "Upload Brand Logo"}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        PNG, JPG up to 10MB
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Preview and Processing */}
                        {selectedFile && (
                            <div className="space-y-4">
                                {/* Previews */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Original */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Original</span>
                                        <div className="aspect-square rounded-lg border border-white/10 overflow-hidden bg-[repeating-linear-gradient(45deg,#1a1a1a_0,#1a1a1a_10px,#2a2a2a_10px,#2a2a2a_20px)] p-4 flex items-center justify-center">
                                            {originalPreview && (
                                                <img src={originalPreview} alt="Original" className="max-w-full max-h-full object-contain" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Processed */}
                                    <div className="space-y-2">
                                        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Processed</span>
                                        <div className="aspect-square rounded-lg border border-white/10 overflow-hidden bg-[repeating-linear-gradient(45deg,#1a1a1a_0,#1a1a1a_10px,#2a2a2a_10px,#2a2a2a_20px)] p-4 flex items-center justify-center">
                                            {isProcessing ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2Icon className="w-6 h-6 text-blue-400 animate-spin" />
                                                    <div className="text-center">
                                                        <p className="text-xs text-gray-400">{processingProgress}%</p>
                                                        <p className="text-[9px] text-gray-600 uppercase tracking-wider mt-1">{processingStatus}</p>
                                                    </div>
                                                </div>
                                            ) : processedPreview ? (
                                                <div className="relative max-w-full max-h-full">
                                                    <img src={processedPreview} alt="Processed" className="max-w-full max-h-full object-contain" />
                                                    <div className="absolute top-1 right-1 bg-green-500/20 border border-green-500/50 rounded-full p-1">
                                                        <CheckCircle2Icon className="w-3 h-3 text-green-400" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <Sparkles className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                                                    <p className="text-[10px] text-gray-600">Click Process</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* File Info */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                    <p className="text-xs text-gray-400 truncate">{selectedFile.name}</p>
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>

                                {/* Process Button */}
                                {!processedBlob && !isProcessing && (
                                    <button
                                        onClick={handleProcessBackground}
                                        className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Remove Background
                                    </button>
                                )}

                                {/* Change File Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isProcessing}
                                    className="w-full px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                                >
                                    Change File
                                </button>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                <p className="text-xs text-red-400">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-4">
                        <button
                            onClick={handleClose}
                            disabled={isSaving}
                            className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-[0.15em] disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!processedBlob || isSaving}
                            className={cn(
                                "px-6 py-2.5 rounded-md font-bold text-[11px] transition-all flex items-center justify-center gap-2",
                                !processedBlob || isSaving
                                    ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                                    : "bg-white text-black hover:bg-white/90 active:scale-[0.98] cursor-pointer"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Save Logo</span>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BrandLogoUploadModal;
