/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { WardrobeItem, WardrobeCategory } from '../types';
import { SearchIcon, FilterIcon, StarIcon, ChevronDownIcon, PlusIcon, FolderPlusIcon, FilePlusIcon, Trash2Icon, HistoryIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import AddProductModal from './AddProductModal';

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
    filters: Record<string, string[]>;
    onFilterChange: (filterType: string, value: string) => void;
    onClearFilters: () => void;
    onAddProduct: (productData: Omit<WardrobeItem, 'id' | 'url'> & { file: File }) => void;
    categories: string[];
    onCreateCategory: (name: string) => void;
    onRenameCategory: (oldName: string, newName: string) => void;
    onDeleteCategory: (category: string) => void;
    onDeleteProduct: (product: WardrobeItem) => void;
}

const ITEM_HEIGHT = 120;
const GAP = 8; // Corresponds to gap-2 in Tailwind

const WardrobeLibrary: React.FC<WardrobeLibraryProps> = (props) => {
    const {
        wardrobe, onSelectItem, searchQuery, onSearchChange,
        selectedCategories, onCategoryToggle,
        favorites, onToggleFavorite, onAddProduct,
        categories, onCreateCategory, onRenameCategory, onDeleteCategory, onDeleteProduct,
        filters, onFilterChange, onClearFilters
    } = props;

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);
    const [numColumns, setNumColumns] = useState(2);
    const [scrollTop, setScrollTop] = useState(0);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, category: string } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        const calculateColumns = () => {
            if (gridRef.current) {
                const containerWidth = gridRef.current.offsetWidth;
                const itemWidth = 90; // Approx item width + gap
                const newNumColumns = Math.max(2, Math.floor(containerWidth / itemWidth));
                setNumColumns(newNumColumns);
            }
        };

        const resizeObserver = new ResizeObserver(calculateColumns);
        if (gridRef.current) {
            resizeObserver.observe(gridRef.current);
        }

        calculateColumns();

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filterOptions = useMemo(() => {
        const fabrics = new Set<string>();
        const fits = new Set<string>();
        const prints = new Set<string>();
        const seasons = new Set<string>();

        wardrobe.forEach(item => {
            if (item.fabric) fabrics.add(item.fabric);
            if (item.fit) fits.add(item.fit);
            if (item.print) prints.add(item.print);
            if (item.season) seasons.add(item.season);
        });

        return {
            fabric: Array.from(fabrics),
            fit: Array.from(fits),
            print: Array.from(prints),
            season: Array.from(seasons),
        };
    }, [wardrobe]);

    const FilterGroup: React.FC<{ title: string; options: string[]; filterType: string; }> = ({ title, options, filterType }) => (
        <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2">{title}</h4>
            <div className="flex flex-wrap gap-1.5">
                {options.map(option => {
                    const isActive = filters[filterType]?.includes(option);
                    return (
                        <button
                            key={option}
                            onClick={() => onFilterChange(filterType, option)}
                            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const handleContextMenu = (e: React.MouseEvent, category: string) => {
        e.preventDefault();
        if (category.toLowerCase() === 'uncategorized') return;
        setContextMenu({ x: e.clientX, y: e.clientY, category });
    };

    const startRename = (category: string) => {
        setRenamingCategory(category);
        setRenameValue(category);
        setContextMenu(null);
    };

    const commitRename = () => {
        if (renamingCategory) {
            onRenameCategory(renamingCategory, renameValue);
        }
        setRenamingCategory(null);
        setRenameValue('');
    };

    const handleCreateNewCategory = () => {
        if (newCategoryName.trim()) {
            onCreateCategory(newCategoryName.trim());
        }
        setNewCategoryName('');
        setIsCreatingCategory(false);
    };

    const finalItems = useMemo(() => {
        // Special views take precedence and are exclusive
        if (selectedCategories.includes('favorites')) {
            return wardrobe.filter(item => favorites.includes(item.id));
        }
        if (selectedCategories.includes('recently used')) {
            return props.recentlyUsed
                .map(recentItem => wardrobe.find(w => w.id === recentItem.id))
                .filter(Boolean) as WardrobeItem[];
        }

        // Standard filtering if no special view is active
        if (selectedCategories.length === 0) return [];

        let items = wardrobe.filter(item =>
            selectedCategories.map(c => c.toLowerCase()).includes(item.category.toLowerCase())
        );

        // Apply advanced filters
        const activeFilterKeys = Object.keys(filters);
        if (activeFilterKeys.length > 0) {
            items = items.filter(item => {
                return activeFilterKeys.every(key => {
                    const selectedValues = filters[key];
                    if (!selectedValues || selectedValues.length === 0) return true;
                    const itemValue = (item as any)[key];
                    return itemValue && selectedValues.includes(itemValue);
                });
            });
        }

        // Apply search query
        const query = searchQuery.toLowerCase();
        if (query) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.sku.toLowerCase().includes(query) ||
                item.fabric.toLowerCase().includes(query) ||
                item.color.toLowerCase().includes(query) ||
                item.tags.styling.some(t => t.toLowerCase().includes(query)) ||
                (item.notes && item.notes.toLowerCase().includes(query)) ||
                item.category.toLowerCase().includes(query) ||
                item.season.toLowerCase().includes(query)
            );
        }

        return items;
    }, [wardrobe, searchQuery, selectedCategories, filters, favorites, props.recentlyUsed]);

    const handleAdd = (data: { name: string, sku: string, category: WardrobeCategory, file: File }) => {
        onAddProduct({
            file: data.file,
            name: data.name,
            sku: data.sku,
            category: data.category,
            subcategory: data.category.charAt(0).toUpperCase() + data.category.slice(1),
            color: 'Multi',
            fabric: 'Mixed',
            print: 'Solid',
            fit: 'relaxed',
            season: 'SS25',
            gender: 'unisex',
            priceTier: 'premium',
            tags: { styling: ['new'], campaign: [] }
        });
    };

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const renderVirtualGrid = () => {
        const containerHeight = gridRef.current?.clientHeight || 0;
        const totalRows = Math.ceil((finalItems.length + 1) / numColumns); // +1 for add button
        const totalHeight = totalRows * (ITEM_HEIGHT + GAP) - GAP;

        const startRow = Math.max(0, Math.floor(scrollTop / (ITEM_HEIGHT + GAP)));
        const rowsToRender = Math.ceil(containerHeight / (ITEM_HEIGHT + GAP)) + 1; // +1 buffer row

        const startIndex = startRow * numColumns;
        const endIndex = Math.min(finalItems.length, (startRow + rowsToRender) * numColumns);

        const visibleItems = finalItems.slice(startIndex, endIndex);

        return (
            <div style={{ position: 'relative', height: `${totalHeight}px` }}>
                {visibleItems.map((item, index) => {
                    const itemIndex = startIndex + index;
                    const row = Math.floor(itemIndex / numColumns);
                    const col = itemIndex % numColumns;
                    const top = row * (ITEM_HEIGHT + GAP);

                    return (
                        <div
                            key={item.id}
                            style={{
                                position: 'absolute',
                                top: `${top}px`,
                                left: `calc(${(col / numColumns) * 100}% + ${GAP / 2}px)`,
                                width: `calc(${(1 / numColumns) * 100}% - ${GAP}px)`,
                                height: `${ITEM_HEIGHT}px`,
                            }}
                        >
                            <button
                                onClick={() => onSelectItem(item)}
                                className="group relative w-full h-full rounded-md overflow-hidden bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <img src={item.url} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity group-hover:opacity-50"></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="bg-white/90 text-black text-xs font-bold px-3 py-1 rounded-full">View</span>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-1.5 pointer-events-none">
                                    <p className="text-xs text-white font-semibold truncate">{item.name}</p>
                                    <p className="text-[10px] text-gray-400">{item.sku}</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id) }}
                                    className="absolute top-1 right-1 p-1 bg-black/40 rounded-full text-white opacity-50 hover:opacity-100 transition-opacity"
                                    title={favorites.includes(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    <StarIcon className={`w-3.5 h-3.5 transition-colors ${favorites.includes(item.id) ? 'fill-yellow-400 stroke-yellow-400' : 'fill-transparent stroke-white'}`} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteProduct(item); }}
                                    className="absolute bottom-1 right-1 p-1.5 bg-black/40 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                                    title="Delete Product"
                                >
                                    <Trash2Icon className="w-3 h-3" />
                                </button>
                            </button>
                        </div>
                    );
                })}

                {/* Render Add button */}
                {(() => {
                    const itemIndex = finalItems.length;
                    const row = Math.floor(itemIndex / numColumns);
                    const col = itemIndex % numColumns;
                    const top = row * (ITEM_HEIGHT + GAP);

                    if (top >= scrollTop - ITEM_HEIGHT && top <= scrollTop + containerHeight) {
                        return (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: `${top}px`,
                                    left: `calc(${(col / numColumns) * 100}% + ${GAP / 2}px)`,
                                    width: `calc(${(1 / numColumns) * 100}% - ${GAP}px)`,
                                    height: `${ITEM_HEIGHT}px`,
                                }}
                            >
                                <button onClick={() => setIsAddProductModalOpen(true)} className="w-full h-full group rounded-md border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-600 hover:border-gray-500 hover:text-gray-500 cursor-pointer transition-colors">
                                    <PlusIcon className="w-6 h-6" />
                                    <span className="text-xs font-semibold mt-1">Add Product</span>
                                </button>
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>
        )
    }

    return (
        <>
            <div className="flex-shrink-0 px-4 pt-4 pb-2">
                <h2 className="text-base font-sans font-semibold text-gray-200 mb-3">Wardrobe</h2>
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search SKU, name, fabric..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-gray-700 rounded-md focus:ring-1 focus:ring-gray-200"
                    />
                </div>
                <button onClick={() => setIsFiltersOpen(!isFiltersOpen)} className="text-xs text-gray-400 mt-2 flex items-center gap-1 hover:text-white">
                    <FilterIcon className="w-3 h-3" />
                    Advanced Filters
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <AnimatePresence>
                {isFiltersOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex-shrink-0 px-4 pb-2 border-b border-gray-800"
                    >
                        <div className="p-3 bg-black/20 rounded-md space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-semibold text-gray-200">Filters</h4>
                                <button onClick={onClearFilters} className="text-xs text-blue-400 hover:underline">Clear All</button>
                            </div>
                            {filterOptions.fabric.length > 0 && <FilterGroup title="Fabric" options={filterOptions.fabric} filterType="fabric" />}
                            {filterOptions.fit.length > 0 && <FilterGroup title="Fit" options={filterOptions.fit} filterType="fit" />}
                            {filterOptions.print.length > 0 && <FilterGroup title="Print / Pattern" options={filterOptions.print} filterType="print" />}
                            {filterOptions.season.length > 0 && <FilterGroup title="Season" options={filterOptions.season} filterType="season" />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-grow min-h-0 flex flex-col">
                <div className="flex-shrink-0 px-4 py-2 border-b border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-semibold uppercase text-gray-500">Categories</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsCreatingCategory(true)} title="Create Category" className="text-gray-500 hover:text-white"><FolderPlusIcon className="w-4 h-4" /></button>
                            <button onClick={() => setIsAddProductModalOpen(true)} title="Add Product" className="text-gray-500 hover:text-white"><FilePlusIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        {categories.map(cat => (
                            <div key={cat} onContextMenu={(e) => handleContextMenu(e, cat)}>
                                {renamingCategory === cat ? (
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingCategory(null); }}
                                        className="w-full text-left text-sm px-2 py-1 rounded bg-gray-900 border border-blue-500 text-white"
                                        autoFocus
                                    />
                                ) : (
                                    <button
                                        onClick={() => onCategoryToggle(cat)}
                                        className={`w-full text-left text-sm px-2 py-1 rounded ${selectedCategories.map(c => c.toLowerCase()).includes(cat.toLowerCase()) ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5'}`}
                                    >
                                        {cat}
                                    </button>
                                )}
                            </div>
                        ))}
                        {isCreatingCategory && (
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onBlur={handleCreateNewCategory}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreateNewCategory(); if (e.key === 'Escape') setIsCreatingCategory(false); }}
                                placeholder="New category name..."
                                className="w-full text-left text-sm px-2 py-1 rounded bg-gray-900 border border-blue-500 text-white"
                                autoFocus
                            />
                        )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-800 space-y-1">
                        <button
                            onClick={() => onCategoryToggle('favorites')}
                            className={`w-full text-left text-sm px-2 py-1 rounded flex items-center gap-2 ${selectedCategories.includes('favorites') ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <StarIcon className="w-4 h-4" /> Favorites
                        </button>
                        <button
                            onClick={() => onCategoryToggle('recently used')}
                            className={`w-full text-left text-sm px-2 py-1 rounded flex items-center gap-2 ${selectedCategories.includes('recently used') ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <HistoryIcon className="w-4 h-4" /> Recently Used
                        </button>
                    </div>
                </div>

                <div className="flex-grow p-4 overflow-y-auto" ref={gridRef} onScroll={handleScroll}>
                    {wardrobe.length === 0 ? (
                        <div className="col-span-full text-center py-10">
                            <p className="text-xs text-gray-500">Your library is empty.</p>
                            <p className="text-xs text-gray-500">Click "Add Product" to start.</p>
                        </div>
                    ) : selectedCategories.length === 0 ? (
                        <div className="col-span-full text-center py-10">
                            <p className="text-xs text-gray-500">Select a category to view items.</p>
                        </div>
                    ) : finalItems.length === 0 && searchQuery.length > 0 ? (
                        <div className="col-span-full text-center py-10">
                            <p className="text-xs text-gray-500">No items match your search/filters.</p>
                        </div>
                    ) : (
                        renderVirtualGrid()
                    )}
                </div>
            </div>

            {contextMenu && (
                <div ref={contextMenuRef} style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-50 bg-[#1f1f1f] border border-gray-700 rounded-md shadow-lg py-1">
                    <button onClick={() => startRename(contextMenu.category)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10">Rename</button>
                    <button onClick={() => { onDeleteCategory(contextMenu.category); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">Delete</button>
                </div>
            )}

            <AddProductModal
                isOpen={isAddProductModalOpen}
                onClose={() => setIsAddProductModalOpen(false)}
                onAdd={handleAdd}
                categories={categories.filter(c => c !== 'Uncategorized')}
            />
        </>
    );
}

export default WardrobeLibrary;