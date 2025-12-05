/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    SearchIcon,
    PlusIcon,
    FilterIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    StarIcon,
    MoreHorizontalIcon,
    Trash2Icon,
    UploadCloudIcon,
    ShirtIcon,
    XIcon,
    CheckCircleIcon
} from './icons';
import type { WardrobeItem } from '../types';
import GarmentExtractorModal from './GarmentExtractorModal';

interface WardrobeLibraryProps {
    wardrobe: WardrobeItem[];
    onSelectItem: (item: WardrobeItem) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedCategories: string[];
    onCategoryToggle: (category: string) => void;
    favorites: string[];
    onToggleFavorite: (itemId: string) => void;
    recentlyUsed: WardrobeItem[];
    onAddProduct: (productData: Omit<WardrobeItem, 'id' | 'url'> & { file: File }) => void;
    categories: string[];
    onCreateCategory: (name: string) => void;
    onRenameCategory: (oldName: string, newName: string) => void;
    onDeleteCategory: (category: string) => void;
    onDeleteProduct: (product: WardrobeItem) => void;
}

const WardrobeLibrary: React.FC<WardrobeLibraryProps> = (props) => {
    const {
        wardrobe,
        onSelectItem,
        searchQuery,
        onSearchChange,
        selectedCategories,
        onCategoryToggle,
        favorites,
        onToggleFavorite,
        onAddProduct,
        categories,
        onCreateCategory,
        onRenameCategory,
        onDeleteCategory,
        onDeleteProduct
    } = props;

    const [isCategoriesCollapsed, setIsCategoriesCollapsed] = useState(true);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);

    // Add Product Form State
    const [addProductForm, setAddProductForm] = useState<{
        name: string;
        category: string;
        sku: string;
        file: File | null;
        previewUrl: string | null;
    }>({
        name: '',
        category: categories[0] || 'tops',
        sku: '',
        file: null,
        previewUrl: null
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                setAddProductForm(prev => ({
                    ...prev,
                    file,
                    previewUrl: URL.createObjectURL(file),
                    name: prev.name || file.name.split('.')[0]
                }));
            }
        }
    };

    const handleAddProductSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!addProductForm.file || !addProductForm.name || !addProductForm.category) return;

        onAddProduct({
            name: addProductForm.name,
            category: addProductForm.category,
            sku: addProductForm.sku, // Optional
            subcategory: 'Custom',
            color: 'N/A',
            fabric: 'N/A',
            print: 'N/A',
            fit: 'relaxed',
            season: 'N/A',
            gender: 'unisex',
            priceTier: 'basic',
            tags: { styling: [], campaign: [] },
            file: addProductForm.file
        });

        // Reset and close
        setAddProductForm({
            name: '',
            category: categories[0] || 'tops',
            sku: '',
            file: null,
            previewUrl: null
        });
        setIsAddProductOpen(false);
    };

    const filteredWardrobe = wardrobe.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category);
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-4">
            {/* Header & Search */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <ShirtIcon className="w-3.5 h-3.5" />
                        Wardrobe Library
                    </h2>
                    <button
                        onClick={() => setIsAddProductOpen(true)}
                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        title="Add Product"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search garments..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                    />
                </div>
            </div>

            {/* Categories (Collapsible) */}
            <div className="space-y-2">
                <button
                    onClick={() => setIsCategoriesCollapsed(!isCategoriesCollapsed)}
                    className="flex items-center gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors w-full"
                >
                    {isCategoriesCollapsed ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronUpIcon className="w-3 h-3" />}
                    Categories
                </button>

                {!isCategoriesCollapsed && (
                    <div className="space-y-2 pl-2 border-l border-white/5 ml-1.5">
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => onCategoryToggle(cat)}
                                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${selectedCategories.includes(cat.toLowerCase())
                                        ? 'bg-white text-black border-white'
                                        : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                            <button
                                onClick={() => setIsCreatingCategory(true)}
                                className="px-2 py-1 rounded text-[10px] font-medium border border-dashed border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
                            >
                                + New
                            </button>
                        </div>

                        {isCreatingCategory && (
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Category name"
                                    className="bg-transparent border-b border-gray-700 text-xs text-white px-1 py-0.5 focus:outline-none focus:border-gray-500 w-24"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newCategoryName.trim()) {
                                            onCreateCategory(newCategoryName.trim());
                                            setNewCategoryName('');
                                            setIsCreatingCategory(false);
                                        } else if (e.key === 'Escape') {
                                            setIsCreatingCategory(false);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (newCategoryName.trim()) {
                                            onCreateCategory(newCategoryName.trim());
                                            setNewCategoryName('');
                                            setIsCreatingCategory(false);
                                        }
                                    }}
                                    className="text-[10px] text-green-500 hover:text-green-400"
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => setIsCreatingCategory(false)}
                                    className="text-[10px] text-red-500 hover:text-red-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2 max-h-[300px] overflow-y-auto pr-1">
                {/* Add New Placeholder - Moved to First Position */}
                <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="aspect-[3/4] rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-white/5 hover:border-white/20 transition-all group"
                >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                        <PlusIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
                    </div>
                    <span className="text-[10px] text-gray-500 group-hover:text-gray-300">Add New</span>
                </button>

                {filteredWardrobe.map((item) => (
                    <div key={item.id} className="group relative aspect-[3/4] rounded-lg overflow-hidden bg-white/5 border border-white/5 hover:border-white/20 transition-all">
                        <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />

                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                            <div className="flex justify-end">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleFavorite(item.id);
                                    }}
                                    className="text-white/70 hover:text-yellow-400 transition-colors"
                                >
                                    <StarIcon className={`w-3.5 h-3.5 ${favorites.includes(item.id) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                </button>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[9px] text-white font-medium truncate">{item.name}</p>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onSelectItem(item)}
                                        className="flex-1 bg-white text-black text-[9px] font-bold py-1 rounded hover:bg-gray-200"
                                    >
                                        Select
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteProduct(item);
                                        }}
                                        className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
                                    >
                                        <Trash2Icon className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>


            {/* Garment Extractor Modal */}
            <GarmentExtractorModal
                isOpen={isAddProductOpen}
                onClose={() => setIsAddProductOpen(false)}
                onAdd={(productData) => {
                    onAddProduct({
                        name: productData.name,
                        category: productData.category,
                        sku: productData.sku,
                        subcategory: 'Custom',
                        color: 'N/A',
                        fabric: 'N/A',
                        print: 'N/A',
                        fit: 'relaxed',
                        season: 'N/A',
                        gender: 'unisex',
                        priceTier: 'basic',
                        tags: { styling: [], campaign: [] },
                        file: productData.file
                    });
                }}
                categories={categories}
            />
        </div>
    );
};

export default WardrobeLibrary;
