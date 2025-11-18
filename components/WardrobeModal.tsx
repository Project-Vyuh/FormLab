/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { WardrobeItem, WardrobeCategory } from '../types';
import { UploadCloudIcon, CheckCircleIcon, SearchIcon } from './icons';

interface WardrobeModalProps {
  onGarmentSelect: (garmentFile: File, garmentInfo: WardrobeItem) => void;
  onUploadItem: (file: File) => void;
  activeGarmentIds: string[];
  isLoading: boolean;
  wardrobe: WardrobeItem[];
  search: string;
  onSearchChange: (value: string) => void;
  filter: WardrobeCategory;
  onFilterChange: (category: WardrobeCategory) => void;
  onContextMenu: (e: React.MouseEvent, item: WardrobeItem) => void;
}

const urlToFile = (url: string, filename: string): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context.'));
            ctx.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas toBlob failed.'));
                const file = new File([blob], filename, { type: blob.type || 'image/png' });
                resolve(file);
            }, 'image/png');
        };
        image.onerror = (error) => reject(new Error(`Image load failed for canvas conversion. Error: ${error}`));
        image.src = url;
    });
};

const FilterButton: React.FC<{
    onClick: () => void;
    isActive: boolean;
    children: React.ReactNode;
}> = ({ onClick, isActive, children }) => (
    <button onClick={onClick} className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${isActive ? 'bg-gray-100 text-gray-900' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
        {children}
    </button>
);


const WardrobeModal: React.FC<WardrobeModalProps> = (props) => {
    const { onGarmentSelect, onUploadItem, activeGarmentIds, isLoading, wardrobe, search, onSearchChange, filter, onFilterChange, onContextMenu } = props;
    const [error, setError] = useState<string | null>(null);

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading || activeGarmentIds.includes(item.id)) return;
        setError(null);
        try {
            const file = await urlToFile(item.url, item.name);
            onGarmentSelect(file, item);
        } catch (err) {
            const detailedError = `Failed to load wardrobe item. Check console for CORS errors.`;
            setError(detailedError);
            console.error(`[CORS Check] Failed to load and convert item from URL: ${item.url}.`, err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            onUploadItem(file);
            e.target.value = ''; // Reset file input to allow uploading the same file again
        }
    };

  return (
    <div className="pt-4 border-t border-gray-700/60">
        <h2 className="text-base font-sans font-semibold text-gray-200 mb-3">Wardrobe</h2>
        <div className="relative mb-2">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
                type="text"
                id="wardrobe-search"
                name="wardrobe-search"
                placeholder="Search wardrobe..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-gray-600 rounded-md focus:ring-1 focus:ring-gray-200 focus:border-gray-200"
            />
        </div>
        <div className="flex items-center gap-2 mb-3">
            <FilterButton onClick={() => onFilterChange('all')} isActive={filter === 'all'}>All</FilterButton>
            <FilterButton onClick={() => onFilterChange('tops')} isActive={filter === 'tops'}>Tops</FilterButton>
            <FilterButton onClick={() => onFilterChange('bottoms')} isActive={filter === 'bottoms'}>Bottoms</FilterButton>
        </div>
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {wardrobe.map((item) => {
            const isActive = activeGarmentIds.includes(item.id);
            return (
                <button
                key={item.id}
                onClick={() => handleGarmentClick(item)}
                onContextMenu={(e) => onContextMenu(e, item)}
                disabled={isLoading || isActive}
                className="relative aspect-square border border-gray-700 rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] focus:ring-gray-200 group disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={`Select ${item.name}`}
                >
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                </div>
                {isActive && (
                    <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                        <CheckCircleIcon className="w-8 h-8 text-white" />
                    </div>
                )}
                </button>
            );
            })}
            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-800' : 'hover:border-gray-500 hover:text-gray-300 cursor-pointer'}`}>
                <UploadCloudIcon className="w-5 h-5 mb-1"/>
                <span className="text-xs text-center font-medium">Upload</span>
                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
            </label>
        </div>
        {wardrobe.length === 0 && (
             <p className="text-center text-xs text-gray-400 mt-2">No items match your search.</p>
        )}
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
};

export default WardrobeModal;