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

    const handleAddToWardrobe = () => {
        if (!name.trim() || !extractedImageUrl) {
            setError('Please provide a product name and extract the garment first.');
            return;
        }

        // Create a File object from the extracted image URL
        // For now, use the uploaded file - will be replaced with extracted image file
        if (uploadedFile) {
            onAdd({ name, sku: sku.trim(), category, file: uploadedFile });
            onClose();
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
                        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <h2 className="text-lg font-semibold text-white tracking-tight">Extract Garment</h2>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Two-Panel Layout */}
                        <div className="grid grid-cols-2 gap-6 p-6">
                            {/* Left Panel: Upload & Configure */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Upload</h3>

                                {/* Image Upload */}
                                <div>
                                    <label className="text-sm font-medium text-gray-300 mb-2 block">Product Image</label>
                                    <label
                                        htmlFor="garment-image-upload"
                                        className="relative w-full aspect-square border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center text-gray-400 transition-all hover:border-white/30 hover:bg-white/5 cursor-pointer group"
                                        onDrop={onDrop}
                                        onDragOver={onDragOver}
                                    >
                                        {uploadedImageUrl ? (
                                            <img src={uploadedImageUrl} alt="Uploaded garment" className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            <>
                                                <UploadCloudIcon className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                                                <span className="text-xs text-center font-medium px-2">Drag & drop or click to upload</span>
                                            </>
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

                                {/* Product Name */}
                                <div className="space-y-2">
                                    <label htmlFor="product-name" className="text-sm font-medium text-gray-300">
                                        Product Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="product-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="Enter product name"
                                    />
                                </div>

                                {/* SKU */}
                                <div className="space-y-2">
                                    <label htmlFor="product-sku" className="text-sm font-medium text-gray-300">
                                        SKU <span className="text-gray-500 text-xs">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="product-sku"
                                        value={sku}
                                        onChange={(e) => setSku(e.target.value)}
                                        className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        placeholder="Enter SKU"
                                    />
                                </div>

                                {/* Category */}
                                <div className="space-y-2">
                                    <label htmlFor="product-category" className="text-sm font-medium text-gray-300">
                                        Category
                                    </label>
                                    <select
                                        id="product-category"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as WardrobeCategory)}
                                        className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                                    >
                                        {categories.map(cat => <option key={cat} value={cat} className="bg-gray-900">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Right Panel: Extraction Preview */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Preview</h3>

                                <div className="relative w-full aspect-square border border-white/10 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                                    {extractionStatus === 'idle' && (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                                <UploadCloudIcon className="w-8 h-8 text-gray-500" />
                                            </div>
                                            <p className="text-sm text-gray-400">Upload an image and click "Extract Garment"</p>
                                        </div>
                                    )}

                                    {extractionStatus === 'extracting' && (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 mx-auto mb-4">
                                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
                                            </div>
                                            <p className="text-sm text-gray-300 font-medium">Extracting garment...</p>
                                            <p className="text-xs text-gray-500 mt-2">This may take a few moments</p>
                                        </div>
                                    )}

                                    {extractionStatus === 'success' && extractedImageUrl && (
                                        <img src={extractedImageUrl} alt="Extracted garment" className="w-full h-full object-contain bg-white" />
                                    )}

                                    {extractionStatus === 'error' && (
                                        <div className="text-center p-6">
                                            <AlertCircleIcon className="w-16 h-16 mx-auto mb-4 text-red-400" />
                                            <p className="text-sm text-red-400 font-medium">Extraction failed</p>
                                            <p className="text-xs text-gray-500 mt-2">Please try again</p>
                                        </div>
                                    )}
                                </div>

                                {/* Extraction Metrics */}
                                {extractionStatus === 'success' && extractionData && (
                                    <div className="space-y-2 p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Confidence</span>
                                            <div className="flex items-center gap-2">
                                                <CheckCircleIcon className="w-4 h-4 text-green-400" />
                                                <span className="text-sm font-semibold text-white">{extractionData.confidence}%</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">Type</span>
                                            <span className="text-sm font-medium text-white">{extractionData.garmentType}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && <p className="text-red-400 text-sm px-6 pb-4">{error}</p>}

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExtractGarment}
                                disabled={!canExtract}
                                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: canExtract ? '#9333EA' : '#4B5563' }}
                            >
                                {extractionStatus === 'extracting' ? 'Extracting...' : 'Extract Garment'}
                            </button>
                            <button
                                onClick={handleAddToWardrobe}
                                disabled={!canAddToWardrobe}
                                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: canAddToWardrobe ? '#318CE7' : '#4B5563' }}
                            >
                                Add to Wardrobe
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default GarmentExtractorModal;
