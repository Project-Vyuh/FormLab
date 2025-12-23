import React, { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, XIcon, PlusIcon, ImageIcon, CheckCircle2Icon, Loader2Icon, FileIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { AspectRatio } from '../types';

interface ReferenceUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: () => void;
    isGenerating: boolean;
    selectedResolution: string;
    onResolutionChange: (res: string) => void;
    selectedAspectRatio: AspectRatio;
    onAspectRatioChange: (ratio: AspectRatio) => void;
    files: File[];
    setFiles: (files: File[] | ((prev: File[]) => File[])) => void;
}

const Thumbnail: React.FC<{ file: File; index: number; onRemove: () => void }> = ({
    file,
    index,
    onRemove
}) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        let url = '';

        const generatePreview = async () => {
            const fileName = file.name.toLowerCase();
            const fileType = file.type.toLowerCase();
            const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') ||
                fileType === 'image/heic' || fileType === 'image/heif';

            console.log(`[Thumbnail] Processing file: ${file.name} (type: ${file.type}, isHeic: ${isHeic})`);

            if (isHeic) {
                setIsConverting(true);
                try {
                    console.log(`[Thumbnail] Attempting HEIC conversion (heic-to) for: ${file.name}`);
                    // Use a more robust dynamic import pattern for heic-to
                    const module = await import('heic-to');
                    const convertFn = (module.default || module) as any;

                    if (typeof convertFn !== 'function') {
                        throw new Error('heic-to conversion function not found in module');
                    }

                    const blob = await convertFn({
                        blob: file,
                        type: 'image/jpeg',
                        quality: 0.7
                    });

                    if (isCancelled) return;

                    url = URL.createObjectURL(blob);
                    console.log(`[Thumbnail] HEIC conversion success: ${file.name}`);
                    setPreviewUrl(url);
                    setHasError(false);
                } catch (err) {
                    console.error('[Thumbnail] HEIC conversion error:', err);
                    // Fallback to direct object URL if conversion fails
                    try {
                        url = URL.createObjectURL(file);
                        setPreviewUrl(url);
                        setHasError(false);
                        console.log(`[Thumbnail] Fallback to direct ObjectURL for: ${file.name}`);
                    } catch (e) {
                        setHasError(true);
                    }
                } finally {
                    if (!isCancelled) setIsConverting(false);
                }
            } else {
                try {
                    url = URL.createObjectURL(file);
                    setPreviewUrl(url);
                    setHasError(false);
                } catch (e) {
                    console.error(`[Thumbnail] Direct ObjectURL error for ${file.name}:`, e);
                    setHasError(true);
                }
            }
        };

        generatePreview();

        return () => {
            isCancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [file]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group aspect-square rounded-lg bg-black/40 border border-white/10 overflow-hidden"
        >
            {isConverting ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/5">
                    <Loader2Icon className="w-4 h-4 text-white/40 animate-spin" />
                    <span className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">Converting...</span>
                </div>
            ) : previewUrl && !hasError ? (
                <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={() => setHasError(true)}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-white/5 p-2 text-center">
                    <FileIcon className="w-4 h-4 text-white/20" />
                    <span className="text-[8px] text-gray-500 truncate w-full px-1">{file.name}</span>
                </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-1.5 bg-red-500/80 text-white rounded-md hover:bg-red-500 transition-all"
                >
                    <XIcon className="w-3.5 h-3.5" />
                </button>
            </div>
        </motion.div>
    );
};

export const ReferenceUploadModal: React.FC<ReferenceUploadModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    isGenerating,
    selectedResolution,
    onResolutionChange,
    selectedAspectRatio,
    onAspectRatioChange,
    files,
    setFiles
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isAspectRatioMenuOpen, setIsAspectRatioMenuOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const aspectRatioMenuRef = useRef<HTMLDivElement>(null);

    // Close menus on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (aspectRatioMenuRef.current && !aspectRatioMenuRef.current.contains(event.target as Node)) {
                setIsAspectRatioMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard interaction: Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles].slice(0, 14));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [setFiles]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files);
            setFiles(prev => [...prev, ...newFiles].slice(0, 14));
        }
    }, [setFiles]);

    const removeFile = useCallback((index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }, [setFiles]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#1a1a1a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl w-full max-w-[480px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col max-h-[80vh]"
                >
                    {/* Sleek Header */}
                    <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <ImageIcon className="w-4 h-4 text-white/40" />
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded-lg transition-all text-gray-500 hover:text-white"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-5 space-y-5 custom-scrollbar">
                        {/* Sleek Upload Section */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "border border-dashed rounded-xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center group",
                                isDragging ? "border-white/40 bg-white/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]",
                                files.length >= 14 && "opacity-50 cursor-not-allowed pointer-events-none"
                            )}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                multiple
                                accept="image/*"
                                className="hidden"
                            />
                            <UploadCloudIcon className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                            <p className="text-[12px] font-medium text-white/70">
                                {isDragging ? "Drop to upload" : "Upload Reference Images"}
                            </p>
                        </div>

                        {/* Preview Grid */}
                        {files.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2Icon className="w-3.5 h-3.5 text-white/40" />
                                        Reference Images ({files.length}/14)
                                    </span>
                                    <button onClick={() => setFiles([])} className="hover:text-red-400 transition-colors">Clear all</button>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                    {files.map((file, idx) => (
                                        <Thumbnail
                                            key={`${file.name}-${file.size}-${idx}`}
                                            file={file}
                                            index={idx}
                                            onRemove={() => removeFile(idx)}
                                        />
                                    ))}
                                    {files.length < 14 && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square rounded-lg border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] flex items-center justify-center text-gray-600 hover:text-white/60 transition-all group"
                                        >
                                            <PlusIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sleek Resolution & Aspect Ratio */}
                        <div className="flex flex-col items-center gap-4 pt-2">
                            <div className="flex flex-col items-center gap-1.5 w-full">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Output Resolution</span>
                                <div className="flex gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
                                    {['1K', '2K', '4K'].map((res) => (
                                        <button
                                            key={res}
                                            onClick={() => onResolutionChange(res)}
                                            className={cn(
                                                "px-4 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase",
                                                selectedResolution === res
                                                    ? "bg-white text-black shadow-lg"
                                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                            )}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-1.5 w-full">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Aspect Ratio</span>
                                <div ref={aspectRatioMenuRef} className="relative w-full max-w-[200px]">
                                    <button
                                        onClick={() => setIsAspectRatioMenuOpen(p => !p)}
                                        disabled={isGenerating}
                                        className="w-full h-9 px-3 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[11px] font-medium text-gray-400 hover:text-white hover:bg-white/[0.02] transition-all focus:outline-none"
                                    >
                                        <span className="text-blue-400 font-bold">{selectedAspectRatio || '1:1'}</span>
                                        <ChevronDownIcon className={cn("w-3.5 h-3.5 opacity-50 transition-transform", isAspectRatioMenuOpen && "rotate-180")} />
                                    </button>
                                    <AnimatePresence>
                                        {isAspectRatioMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1 max-h-[240px] overflow-y-auto custom-scrollbar"
                                            >
                                                {[
                                                    { id: '1:1', label: '1:1 (Square)' },
                                                    { id: '4:5', label: '4:5' },
                                                    { id: '3:4', label: '3:4' },
                                                    { id: '2:3', label: '2:3' },
                                                    { id: '9:16', label: '9:16 (Portrait)' },
                                                    { id: '5:4', label: '5:4' },
                                                    { id: '4:3', label: '4:3' },
                                                    { id: '3:2', label: '3:2' },
                                                    { id: '16:9', label: '16:9 (Widescreen)' },
                                                    { id: '21:9', label: '21:9' }
                                                ].map((ratio) => (
                                                    <button
                                                        key={ratio.id}
                                                        onClick={() => {
                                                            onAspectRatioChange(ratio.id as AspectRatio);
                                                            setIsAspectRatioMenuOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full text-left px-4 py-2 text-[10px] font-medium transition-colors flex items-center justify-between group",
                                                            selectedAspectRatio === ratio.id ? "text-white bg-white/5" : "text-gray-400 hover:bg-white/[0.02] hover:text-gray-200"
                                                        )}
                                                    >
                                                        {ratio.label}
                                                        {selectedAspectRatio === ratio.id && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sleek Footer */}
                    <div className="px-5 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-4">
                        <button
                            onClick={onClose}
                            className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-[0.15em]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onGenerate}
                            disabled={files.length === 0 || isGenerating}
                            className={cn(
                                "px-6 py-2.5 rounded-md font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 transition-colors duration-200",
                                files.length === 0 || isGenerating
                                    ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                                    : "bg-white text-black hover:bg-white/90 active:scale-[0.98] cursor-pointer"
                            )}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <span>Generate Model</span>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
