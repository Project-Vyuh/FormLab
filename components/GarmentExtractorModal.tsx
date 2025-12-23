/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadCloudIcon, CheckCircleIcon, AlertCircleIcon, ScissorsIcon } from './icons';
import { WardrobeCategory } from '../types';
import { cn } from '../lib/utils';

interface GarmentExtractorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (productData: { name: string, sku: string, category: WardrobeCategory, file: File }) => void;
    categories: string[];
}

type ExtractionStatus = 'idle' | 'extracting' | 'success' | 'error';

interface ExtractionData {
    confidence: number;
    garmentType: string;
}

const GarmentExtractorModal: React.FC<GarmentExtractorModalProps> = ({ isOpen, onClose, onAdd, categories }) => {

    const getInitialCategory = useCallback(() => {
        const filteredCategories = categories.filter(c => c.toLowerCase() !== 'uncategorized');
        return filteredCategories[0] || categories[0] || '';
    }, [categories]);

    // Form state
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState<WardrobeCategory>(getInitialCategory());

    // Upload state
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

    // Extraction state
    const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null);
    const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
    const [extractionData, setExtractionData] = useState<ExtractionData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setName('');
        setSku('');
        setCategory(getInitialCategory());
        setUploadedFile(null);
        setUploadedImageUrl(null);
        setExtractedImageUrl(null);
        setExtractionStatus('idle');
        setExtractionData(null);
        setError(null);
    }, [getInitialCategory]);

    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    useEffect(() => {
        setCategory(getInitialCategory());
    }, [categories, getInitialCategory]);

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

    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) {
            const selectedFile = files[0];
            if (!selectedFile.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            setError(null);
            setUploadedFile(selectedFile);
            setUploadedImageUrl(URL.createObjectURL(selectedFile));

            // Reset extraction state when new file is uploaded
            setExtractedImageUrl(null);
            setExtractionStatus('idle');
            setExtractionData(null);

            // Pre-fill name and SKU from filename
            const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
            setName(nameWithoutExt.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

            const skuFromName = selectedFile.name.match(/^([a-zA-Z0-9-]+)/);
            if (skuFromName) {
                setSku(skuFromName[1].toUpperCase());
            }
        }
    };

    const onDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        handleFileChange(event.dataTransfer.files);
    }, []);

    const onDragOver = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
    };

    const handleExtractGarment = async () => {
        if (!uploadedFile) {
            setError('Please upload an image first.');
            return;
        }

        setExtractionStatus('extracting');
        setError(null);

        try {
            // Import extraction service
            const { extractGarmentFromImage } = await import('../services/garmentExtractor');

            // Call extraction service
            const result = await extractGarmentFromImage(uploadedFile);

            setExtractedImageUrl(result.extractedImageUrl);
            setExtractionData({
                confidence: result.confidence,
                garmentType: result.garmentType
            });
            setExtractionStatus('success');
        } catch (err) {
            console.error('Extraction failed:', err);
            setError('Failed to extract garment. Please try again.');
            setExtractionStatus('error');
        }
    };

    const handleAddToWardrobe = async () => {
        if (!name.trim() || !extractedImageUrl) {
            setError('Please provide a product name and extract the garment first.');
            return;
        }

        try {
            // Convert extracted image data URL to File object
            const response = await fetch(extractedImageUrl);
            const blob = await response.blob();
            const extractedFile = new File([blob], `extracted_${uploadedFile?.name || 'garment.png'}`, {
                type: blob.type || 'image/png'
            });

            onAdd({ name, sku: sku.trim(), category, file: extractedFile });
            onClose();
        } catch (err) {
            console.error('Failed to convert extracted image:', err);
            setError('Failed to save extracted garment. Please try again.');
        }
    };

    const canExtract = uploadedFile && extractionStatus !== 'extracting';
    const canAddToWardrobe = extractionStatus === 'success' && name.trim();

    return createPortal(
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
                        initial={{ scale: 0.98, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.98, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#1a1a1a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col max-h-[85vh]"
                    >
                        {/* Sleek Header */}
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <ScissorsIcon className="w-4 h-4 text-white/40" />
                                <span className="text-[12px] font-medium text-white/70">Extract Garment</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/10 rounded-lg transition-all text-gray-500 hover:text-white"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-grow overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                                {/* Left Panel: Upload & Configure */}
                                <div className="p-5 border-b md:border-b-0 md:border-r border-white/5">
                                    <div className="space-y-4">
                                        {/* Upload Area */}
                                        <label
                                            htmlFor="garment-image-upload"
                                            className={cn(
                                                "relative w-full aspect-[4/3] border border-dashed rounded-xl flex flex-col items-center justify-center text-gray-400 transition-all cursor-pointer group",
                                                uploadedImageUrl ? 'border-white/20 bg-black/40' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                                            )}
                                            onDrop={onDrop}
                                            onDragOver={onDragOver}
                                        >
                                            {uploadedImageUrl ? (
                                                <img src={uploadedImageUrl} alt="Uploaded garment" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <>
                                                    <UploadCloudIcon className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                                                    <p className="text-[12px] font-medium text-white/70 mt-2">Upload Product Image</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">or drag and drop</p>
                                                </>
                                            )}
                                            {/* Hover overlay for replacing image */}
                                            {uploadedImageUrl && (
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                                    <span className="text-[11px] font-medium text-white flex items-center gap-2">
                                                        <UploadCloudIcon className="w-3.5 h-3.5" />
                                                        Replace
                                                    </span>
                                                </div>
                                            )}
                                        </label>
                                        <input
                                            id="garment-image-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/png, image/jpeg, image/webp"
                                            onChange={(e) => handleFileChange(e.target.files)}
                                        />

                                        {/* Form Fields */}
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label htmlFor="product-name" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                    Product Name <span className="text-red-400">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    id="product-name"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white placeholder-gray-600 focus:border-white/20 focus:outline-none transition-all"
                                                    placeholder="e.g. Summer Floral Dress"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label htmlFor="product-sku" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                        SKU <span className="text-gray-600 text-[9px]">(Optional)</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="product-sku"
                                                        value={sku}
                                                        onChange={(e) => setSku(e.target.value)}
                                                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white placeholder-gray-600 focus:border-white/20 focus:outline-none transition-all"
                                                        placeholder="SKU-123"
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label htmlFor="product-category" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                        Category
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            id="product-category"
                                                            value={category}
                                                            onChange={(e) => setCategory(e.target.value as WardrobeCategory)}
                                                            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white focus:border-white/20 focus:outline-none transition-all appearance-none cursor-pointer"
                                                        >
                                                            {categories.map(cat => <option key={cat} value={cat} className="bg-gray-900">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                                                        </select>
                                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Extraction Preview */}
                                <div className="p-5 bg-black/20 flex flex-col">
                                    <div className="relative flex-1 w-full border border-white/10 rounded-xl bg-[#151515] flex items-center justify-center overflow-hidden min-h-[180px]">
                                        {/* Checkerboard background overlay */}
                                        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,#222_25%,transparent_25%,transparent_75%,#222_75%,#222),linear-gradient(45deg,#222_25%,transparent_25%,transparent_75%,#222_75%,#222)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]"></div>

                                        {extractionStatus === 'idle' && (
                                            <div className="relative z-10 text-center p-4">
                                                <UploadCloudIcon className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                                                <p className="text-[11px] text-gray-400">Extracted garment preview</p>
                                            </div>
                                        )}

                                        {extractionStatus === 'extracting' && (
                                            <div className="relative z-10 text-center p-4">
                                                <div className="w-8 h-8 mx-auto mb-2">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                                </div>
                                                <p className="text-[11px] text-gray-300 font-medium">Extracting...</p>
                                            </div>
                                        )}

                                        {extractionStatus === 'success' && extractedImageUrl && (
                                            <img src={extractedImageUrl} alt="Extracted garment" className="relative z-10 max-h-full max-w-full object-contain p-3" />
                                        )}

                                        {extractionStatus === 'error' && (
                                            <div className="relative z-10 text-center p-4">
                                                <AlertCircleIcon className="w-8 h-8 mx-auto mb-2 text-red-400" />
                                                <p className="text-[11px] text-red-400 font-medium">Failed</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Extraction Metrics */}
                                    {extractionStatus === 'success' && extractionData && (
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Confidence</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <CheckCircleIcon className="w-3 h-3 text-green-500" />
                                                    <span className="text-sm font-semibold text-white">{extractionData.confidence}%</span>
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Detected Type</span>
                                                <span className="text-sm font-semibold text-white block mt-0.5">{extractionData.garmentType}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="px-5 py-2.5 bg-red-500/10 border-t border-red-500/20 flex-shrink-0">
                                <p className="text-red-400 text-[11px] flex items-center gap-2">
                                    <AlertCircleIcon className="w-3.5 h-3.5" />
                                    {error}
                                </p>
                            </div>
                        )}

                        {/* Sleek Footer */}
                        <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-4 flex-shrink-0">
                            <button
                                onClick={onClose}
                                className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-[0.15em]"
                            >
                                Cancel
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExtractGarment}
                                    disabled={!canExtract}
                                    className={cn(
                                        "px-4 py-2 rounded-md font-bold text-[10px] transition-all flex items-center gap-1.5",
                                        canExtract
                                            ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'
                                            : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                    )}
                                >
                                    {extractionStatus === 'extracting' ? 'Extracting...' : 'Extract'}
                                </button>
                                <button
                                    onClick={handleAddToWardrobe}
                                    disabled={!canAddToWardrobe}
                                    className={cn(
                                        "px-4 py-2 rounded-md font-bold text-[10px] transition-all flex items-center gap-1.5",
                                        canAddToWardrobe
                                            ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
                                            : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                    )}
                                >
                                    <CheckCircleIcon className="w-3 h-3" />
                                    Add to Wardrobe
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default GarmentExtractorModal;
