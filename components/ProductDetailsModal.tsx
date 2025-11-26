import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WardrobeItem } from '../types';
import { XIcon, StarIcon } from './icons';

interface ProductDetailsModalProps {
    item: WardrobeItem | null;
    onClose: () => void;
    onApply: (item: WardrobeItem) => void;
    onReplace: (item: WardrobeItem) => void;
    lastAppliedGarment: WardrobeItem | null;
    isFavorite: boolean;
    onToggleFavorite: (itemId: string) => void;
}

const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
    item,
    onClose,
    onApply,
    onReplace,
    lastAppliedGarment,
    isFavorite,
    onToggleFavorite
}) => {
    const [mainImage, setMainImage] = useState<string | undefined>(item?.url);

    useEffect(() => {
        if (item) {
            setMainImage(item.url);
        }
    }, [item]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const showReplaceButton = lastAppliedGarment && item && lastAppliedGarment.category === item.category && lastAppliedGarment.id !== item.id;

    if (!item) return null;

    return createPortal(
        <AnimatePresence>
            {item && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#1a1a1a]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex"
                    >
                        {/* Main Image Area */}
                        <div className="flex-1 flex items-center justify-center bg-black/40 p-8 relative">
                            <img
                                src={mainImage}
                                alt={item.name}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                            />
                        </div>

                        {/* Metadata Sidebar */}
                        <div className="w-80 bg-white/5 border-l border-white/10 flex flex-col">
                            {/* Header */}
                            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-medium text-white/90 mb-1">{item.name}</h2>
                                    <p className="text-sm text-gray-400">{item.sku}</p>
                                </div>
                                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Thumbnails */}
                                <div className="flex gap-2">
                                    {[item.url, item.images?.back, item.images?.detail].filter(Boolean).map((imgUrl, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setMainImage(imgUrl)}
                                            className={`w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${mainImage === imgUrl ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10 hover:border-white/30'}`}
                                        >
                                            <img src={imgUrl} alt={`View ${idx}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>

                                {/* Details */}
                                <div className="space-y-4">
                                    {item.colorways && item.colorways.length > 0 && (
                                        <div>
                                            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Colorways</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {item.colorways.map(color => (
                                                    <div key={color} className="w-6 h-6 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: color }} title={color}></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div>
                                            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</h3>
                                            <p className="text-sm text-gray-200 capitalize">{item.category} <span className="text-gray-500">/</span> {item.subcategory}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Fabric</h3>
                                                <p className="text-sm text-gray-200 capitalize">{item.fabric}</p>
                                            </div>
                                            <div>
                                                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Fit</h3>
                                                <p className="text-sm text-gray-200 capitalize">{item.fit}</p>
                                            </div>
                                            <div>
                                                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Color</h3>
                                                <p className="text-sm text-gray-200 capitalize">{item.color}</p>
                                            </div>
                                            <div>
                                                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Season</h3>
                                                <p className="text-sm text-gray-200">{item.season}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {item.tags?.styling?.length > 0 && (
                                        <div>
                                            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Tags</h3>
                                            <div className="flex flex-wrap gap-1.5">
                                                {item.tags.styling.map(tag => (
                                                    <span key={tag} className="px-2.5 py-1 bg-white/5 border border-white/10 text-gray-300 text-xs rounded-full">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {item.notes && (
                                        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                            <p className="text-xs text-gray-400 italic">"{item.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-white/10 space-y-3 bg-white/5">
                                {showReplaceButton && (
                                    <button
                                        onClick={() => onReplace(item)}
                                        className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors border border-white/10"
                                    >
                                        Replace Current {lastAppliedGarment?.category}
                                    </button>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onApply(item)}
                                        className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-100 text-black rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-white/5"
                                    >
                                        Apply to Model
                                    </button>
                                    <button
                                        onClick={() => onToggleFavorite(item.id)}
                                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 transition-colors"
                                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                    >
                                        <StarIcon className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default ProductDetailsModal;
