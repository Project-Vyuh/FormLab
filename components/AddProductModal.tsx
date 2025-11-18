/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
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
        if (!name.trim() || !sku.trim() || !file) {
            setError('Please fill all fields and upload an image.');
            return;
        }
        onAdd({ name, sku, category, file });
        onClose();
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
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-[#2a2a2a] rounded-2xl w-full max-w-lg flex flex-col shadow-xl border border-gray-700"
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-xl font-sans font-semibold text-gray-200">Add New Product</h2>
                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700">
                    <XIcon className="w-5 h-5" />
                </button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-6">
                    <div className="col-span-1">
                        <p className="text-sm font-medium text-gray-300 mb-2 block">Product Image</p>
                        <label 
                            htmlFor="product-image-upload" 
                            className="relative w-full aspect-square border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300 cursor-pointer"
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} alt="Product preview" className="w-full h-full object-cover rounded-md" />
                            ) : (
                                <>
                                    <UploadCloudIcon className="w-8 h-8 mb-2"/>
                                    <span className="text-xs text-center font-medium">Drag & drop or click to upload</span>
                                </>
                            )}
                        </label>
                        <input id="product-image-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => handleFileChange(e.target.files)} />
                    </div>
                    <div className="col-span-1 space-y-4">
                        <div>
                            <label htmlFor="product-name" className="text-sm font-medium text-gray-300">Product Name</label>
                            <input type="text" id="product-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500"/>
                        </div>
                        <div>
                            <label htmlFor="product-sku" className="text-sm font-medium text-gray-300">SKU</label>
                            <input type="text" id="product-sku" value={sku} onChange={(e) => setSku(e.target.value)} className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md"/>
                        </div>
                        <div>
                            <label htmlFor="product-category" className="text-sm font-medium text-gray-300">Category</label>
                            <select id="product-category" value={category} onChange={(e) => setCategory(e.target.value as WardrobeCategory)} className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md">
                                {categories.map(cat => <option key={cat} value={cat} className="capitalize">{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-400 text-xs px-6 pb-2 -mt-2">{error}</p>}

                <div className="flex justify-end items-center gap-3 p-4 bg-[#1a1a1a] border-t border-gray-700 rounded-b-2xl">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                    Add Product
                </button>
                </div>
            </motion.div>
            </motion.div>
        )}
        </AnimatePresence>
    );
};

export default AddProductModal;