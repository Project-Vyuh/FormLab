/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WardrobeItem } from '../types';
import { XIcon, StarIcon } from './icons';

interface ProductDetailsFlyoutProps {
  item: WardrobeItem | null;
  onClose: () => void;
  onApply: (item: WardrobeItem) => void;
  onReplace: (item: WardrobeItem) => void;
  lastAppliedGarment: WardrobeItem | null;
  panelWidth: number;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string) => void;
}

const ProductDetailsFlyout: React.FC<ProductDetailsFlyoutProps> = ({ item, onClose, onApply, onReplace, lastAppliedGarment, panelWidth, isFavorite, onToggleFavorite }) => {
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

  return (
    <AnimatePresence>
      {item && (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-black/50 z-40"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                className="absolute top-0 left-0 h-full bg-[#2a2a2a] z-50 flex flex-col border-r border-gray-700"
                style={{ width: `${panelWidth}px` }}
                onClick={(e) => e.stopPropagation()}
                >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-serif text-gray-200">Product Details</h2>
                <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700">
                <XIcon className="w-5 h-5" />
                </button>
            </div>
            
            {/* Content */}
            <div className="flex-grow p-4 overflow-y-auto">
                <img src={mainImage} alt={item.name} className="w-full rounded-lg mb-4 aspect-[3/4] object-cover bg-gray-800" />

                <div className="flex gap-2 mb-4">
                  {[item.url, item.images?.back, item.images?.detail].filter(Boolean).map((imgUrl, idx) => (
                    <button key={idx} onClick={() => setMainImage(imgUrl)} className={`w-16 h-16 rounded-md overflow-hidden border-2 ${mainImage === imgUrl ? 'border-blue-500' : 'border-transparent'}`}>
                      <img src={imgUrl} alt={`View ${idx}`} className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>

                <h3 className="text-xl font-semibold text-white">{item.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{item.sku}</p>

                {item.colorways && item.colorways.length > 0 && (
                    <div className="mb-4">
                        <p className="font-semibold text-gray-300 text-sm mb-1">Colorways:</p>
                        <div className="flex flex-wrap gap-2">
                            {item.colorways.map(color => (
                                <div key={color} className="w-6 h-6 rounded-full border border-gray-500" style={{backgroundColor: color}} title={color}></div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="space-y-2 text-sm text-gray-400">
                    <p><span className="font-semibold text-gray-300 w-20 inline-block">Category:</span> <span className="capitalize">{item.category} / {item.subcategory}</span></p>
                    <p><span className="font-semibold text-gray-300 w-20 inline-block">Fabric:</span> <span className="capitalize">{item.fabric}</span></p>
                    <p><span className="font-semibold text-gray-300 w-20 inline-block">Fit:</span> <span className="capitalize">{item.fit}</span></p>
                    <p><span className="font-semibold text-gray-300 w-20 inline-block">Color:</span> <span className="capitalize">{item.color}</span></p>
                    <p><span className="font-semibold text-gray-300 w-20 inline-block">Print:</span> <span className="capitalize">{item.print}</span></p>
                    <p><span className="font-semibold text-gray-300 w-20 inline-block">Season:</span> {item.season}</p>
                    {item.tags?.styling?.length > 0 && 
                    <div className="flex items-start">
                        <span className="font-semibold text-gray-300 w-20 inline-block pt-1">Tags:</span> 
                        <div className="flex flex-wrap gap-1">
                        {item.tags.styling.map(tag => <span key={tag} className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">{tag}</span>)}
                        </div>
                    </div>
                    }
                    {item.notes && <p className="pt-2 italic text-gray-500">"{item.notes}"</p>}
                </div>
            </div>
            
            {/* Footer/Actions */}
            <div className="flex-shrink-0 p-4 border-t border-gray-700 space-y-2">
                {showReplaceButton && (
                    <button onClick={() => onReplace(item)} className="w-full py-2.5 bg-gray-700 text-white rounded-md font-semibold hover:bg-gray-600">
                        Replace Current {lastAppliedGarment?.category}
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={() => onApply(item)} className="w-full py-2.5 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700">
                        Apply to Model
                    </button>
                    <button onClick={() => onToggleFavorite(item.id)} className="p-2.5 border border-gray-700 rounded-md text-gray-400 hover:bg-white/5" title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                        <StarIcon className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-yellow-400 stroke-yellow-400' : 'fill-transparent'}`} />
                    </button>
                </div>
            </div>
            </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProductDetailsFlyout;
