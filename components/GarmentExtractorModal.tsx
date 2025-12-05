/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadCloudIcon, CheckCircleIcon, AlertCircleIcon } from './icons';
import { WardrobeCategory } from '../types';

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
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl flex flex-col"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div>
                                <h2 className="text-lg font-semibold text-white tracking-tight">Extract Garment</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Upload a product image to automatically extract the garment</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Two-Panel Layout */}
                        <div className="grid grid-cols-2 gap-0 border-b border-white/5">
                            {/* Left Panel: Upload & Configure */}
                            <div className="p-6 border-r border-white/5 bg-[#1a1a1a]">
                                <div className="space-y-6">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Configuration</h3>

                                    {/* Upload Area */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-300 mb-2 block">Product Image</label>
                                        <label
                                            htmlFor="garment-image-upload"
                                            className={`relative w-full aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-400 transition-all cursor-pointer group ${uploadedImageUrl ? 'border-white/20 bg-black/40' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30'}`}
                                            onDrop={onDrop}
                                            onDragOver={onDragOver}
                                        >
                                            {uploadedImageUrl ? (
                                                <img src={uploadedImageUrl} alt="Uploaded garment" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <UploadCloudIcon className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-300">Click to upload</span>
                                                    <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
                                                </>
                                            )}
                                            {/* Hover overlay for replacing image */}
                                            {uploadedImageUrl && (
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                                    <span className="text-sm font-medium text-white flex items-center gap-2">
                                                        <UploadCloudIcon className="w-4 h-4" />
                                                        Replace Image
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
                                    </div>

                                    {/* Form Fields */}
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label htmlFor="product-name" className="text-sm font-medium text-gray-300">
                                                Product Name <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                id="product-name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                                                placeholder="e.g. Summer Floral Dress"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label htmlFor="product-sku" className="text-sm font-medium text-gray-300">
                                                    SKU <span className="text-gray-600 text-xs">(Optional)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    id="product-sku"
                                                    value={sku}
                                                    onChange={(e) => setSku(e.target.value)}
                                                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                                                    placeholder="SKU-123"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="product-category" className="text-sm font-medium text-gray-300">
                                                    Category
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        id="product-category"
                                                        value={category}
                                                        onChange={(e) => setCategory(e.target.value as WardrobeCategory)}
                                                        className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                                                    >
                                                        {categories.map(cat => <option key={cat} value={cat} className="bg-gray-900">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Extraction Preview */}
                            <div className="p-6 bg-[#151515] flex flex-col">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Extraction Preview</h3>

                                <div className="flex-1 flex flex-col h-full">
                                    <div className="relative flex-1 w-full border border-white/10 rounded-xl bg-[#151515] flex items-center justify-center overflow-hidden">
                                        {/* Checkerboard background overlay */}
                                        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,#222_25%,transparent_25%,transparent_75%,#222_75%,#222),linear-gradient(45deg,#222_25%,transparent_25%,transparent_75%,#222_75%,#222)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]"></div>

                                        {extractionStatus === 'idle' && (
                                            <div className="relative z-10 text-center p-6 max-w-sm">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                                    <UploadCloudIcon className="w-8 h-8 text-gray-600" />
                                                </div>
                                                <p className="text-sm text-gray-400">Your extracted garment will appear here.</p>
                                                <p className="text-xs text-gray-500 mt-1">Upload an image and click "Extract Garment" to begin.</p>
                                            </div>
                                        )}

                                        {extractionStatus === 'extracting' && (
                                            <div className="relative z-10 text-center p-6">
                                                <div className="w-16 h-16 mx-auto mb-4">
                                                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
                                                </div>
                                                <p className="text-sm text-gray-300 font-medium">Analyzing & Extracting...</p>
                                                <p className="text-xs text-gray-500 mt-2">AI is processing your image. First run may take longer.</p>
                                            </div>
                                        )}

                                        {extractionStatus === 'success' && extractedImageUrl && (
                                            <img src={extractedImageUrl} alt="Extracted garment" className="relative z-10 max-h-full max-w-full object-contain p-4" />
                                        )}

                                        {extractionStatus === 'error' && (
                                            <div className="relative z-10 text-center p-6">
                                                <AlertCircleIcon className="w-16 h-16 mx-auto mb-4 text-red-400" />
                                                <p className="text-sm text-red-400 font-medium">Extraction failed</p>
                                                <p className="text-xs text-gray-500 mt-2">Please try again</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Extraction Metrics */}
                                    <div className="mt-4 h-[72px]">
                                        {extractionStatus === 'success' && extractionData ? (
                                            <div className="grid grid-cols-2 gap-4 h-full">
                                                <div className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col justify-center">
                                                    <span className="text-xs text-gray-500 mb-1">Confidence</span>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                                                        <span className="text-lg font-semibold text-white tracking-tight">{extractionData.confidence}%</span>
                                                    </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col justify-center">
                                                    <span className="text-xs text-gray-500 mb-1">Detected Type</span>
                                                    <span className="text-lg font-semibold text-white tracking-tight">{extractionData.garmentType}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full border border-dashed border-white/5 rounded-lg bg-black/10 flex items-center justify-center text-xs text-gray-600">
                                                metrics will appear here
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
                                <p className="text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircleIcon className="w-4 h-4" />
                                    {error}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex gap-3 justify-end items-center">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleExtractGarment}
                                    disabled={!canExtract}
                                    className={`px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${canExtract ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20' : 'bg-gray-700'}`}
                                >
                                    {extractionStatus === 'extracting' ? 'Extracting...' : 'Extract Garment'}
                                </button>
                                <button
                                    onClick={handleAddToWardrobe}
                                    disabled={!canAddToWardrobe}
                                    className={`px-6 py-2.5 text-sm font-semibold text-white rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2 ${canAddToWardrobe ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20' : 'bg-gray-700'}`}
                                >
                                    <CheckCircleIcon className="w-4 h-4" />
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
