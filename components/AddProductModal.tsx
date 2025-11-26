/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadCloudIcon } from './icons';
import { WardrobeCategory } from '../types';

interface AddProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (productData: { name: string, sku: string, category: WardrobeCategory, file: File }) => void;
    categories: string[];
}

const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onAdd, categories }) => {

    const getInitialCategory = useCallback(() => {
        const filteredCategories = categories.filter(c => c.toLowerCase() !== 'uncategorized');
        return filteredCategories[0] || categories[0] || '';
    }, [categories]);

    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState<WardrobeCategory>(getInitialCategory());
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setName('');
        setSku('');
        setCategory(getInitialCategory());
        setFile(null);
        setPreviewUrl(null);
        setError(null);
    }, [getInitialCategory]);

    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    // Update category state if the list of categories changes while modal is open
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
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));

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

    const handleSubmit = () => {
        if (!name.trim() || !file) {
            setError('Please provide a product name and upload an image.');
            return;
        }
        onAdd({ name, sku: sku.trim(), category, file });
        onClose();
    };

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
                        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white tracking-tight">Add New Product</h2>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-4">
                            {/* Image Upload */}
                            <div>
                                <label className="text-sm font-medium text-gray-300 mb-2 block">Product Image</label>
                                <label
                                    htmlFor="product-image-upload"
                                    className="relative w-full aspect-square border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center text-gray-400 transition-all hover:border-white/30 hover:bg-white/5 cursor-pointer group"
                                    onDrop={onDrop}
                                    onDragOver={onDragOver}
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Product preview" className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        <>
                                            <UploadCloudIcon className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs text-center font-medium px-2">Drag & drop or click to upload</span>
                                        </>
                                    )}
                                </label>
                                <input
                                    id="product-image-upload"
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

                        {/* Error Message */}
                        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

                        {/* Actions */}
                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-blue-500/30"
                                style={{ backgroundColor: '#318CE7' }}
                            >
                                Add Product
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default AddProductModal;