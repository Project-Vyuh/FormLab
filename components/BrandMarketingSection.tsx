/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TagIcon, PlusIcon, Trash2Icon, CheckCircleIcon } from './icons';
import SectionHeading from './shared/SectionHeading';
import BrandLogoUploadModal from './BrandLogoUploadModal';
import { BrandLogo } from '../types';
import { useLogoBranding } from '../contexts/LogoBrandingContext';
import { uploadFile, deleteFile } from '../services/storageService';
import { getCurrentUserId } from '../services/authService';
import {
    collection,
    query,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface BrandMarketingSectionProps {
    // Placeholder props for future functionality
}

/**
 * Brand Marketing section component with features for branding customization
 */
const BrandMarketingSection: React.FC<BrandMarketingSectionProps> = () => {
    const [isAddBrandLogoEnabled, setIsAddBrandLogoEnabled] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);

    // Use logo branding context
    const { logoBranding, setLogoBranding, brandLogos, setBrandLogos } = useLogoBranding();

    // Load brand logos on mount
    useEffect(() => {
        if (isAddBrandLogoEnabled) {
            loadBrandLogos();
        }
    }, [isAddBrandLogoEnabled]);

    const loadBrandLogos = async () => {
        const userId = getCurrentUserId();
        if (!userId) return;

        setIsLoading(true);
        try {
            const logosRef = collection(db, `users/${userId}/brandLogos`);
            const q = query(logosRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const logos: BrandLogo[] = [];
            snapshot.forEach((doc) => {
                logos.push({ id: doc.id, ...doc.data() } as BrandLogo);
            });

            setBrandLogos(logos);
        } catch (error) {
            console.error('[BrandMarketingSection] Failed to load logos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLogo = async (logoBlob: Blob, fileName: string, dimensions: { width: number; height: number }): Promise<void> => {
        const userId = getCurrentUserId();
        if (!userId) {
            throw new Error('User not authenticated');
        }

        try {
            // Generate unique ID for the logo
            const logoId = `logo-${Date.now()}`;

            // Detect file type from blob and preserve it
            const isSvg = logoBlob.type === 'image/svg+xml';
            const fileExt = isSvg ? 'svg' : 'png';
            const contentType = isSvg ? 'image/svg+xml' : 'image/png';

            const storagePath = `brand-logos/${userId}/${logoId}.${fileExt}`;

            // Convert Blob to File with correct type
            const file = new File([logoBlob], `${logoId}.${fileExt}`, { type: contentType });

            // Upload directly to Firebase Storage using custom path
            console.log('[BrandMarketingSection] Uploading logo to:', storagePath, 'as', contentType, 'dimensions:', dimensions);

            // Import Firebase storage functions
            const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('../services/firebase');

            const fileRef = storageRef(storage, storagePath);
            const snapshot = await uploadBytes(fileRef, file, {
                contentType: contentType,
                customMetadata: {
                    uploadedAt: new Date().toISOString(),
                    userId: userId,
                    category: 'brand-logos'
                }
            });

            const url = await getDownloadURL(snapshot.ref);

            // Create logo metadata with dimensions
            const logoData: Omit<BrandLogo, 'id'> = {
                url,
                name: fileName.replace(/\.[^/.]+$/, ''), // Remove file extension
                createdAt: Date.now(),
                width: dimensions.width,
                height: dimensions.height
            };

            // Save to Firestore
            const logosRef = collection(db, `users/${userId}/brandLogos`);
            const docRef = await addDoc(logosRef, logoData);

            // Add to local state
            setBrandLogos((prev) => [{ id: docRef.id, ...logoData }, ...prev]);

            console.log('[BrandMarketingSection] Logo saved successfully:', docRef.id, 'with dimensions:', dimensions);
        } catch (error) {
            console.error('[BrandMarketingSection] Failed to save logo:', error);
            throw error;
        }
    };

    const handleDeleteLogo = async (logo: BrandLogo) => {
        const userId = getCurrentUserId();
        if (!userId) return;

        try {
            // Delete from Storage
            await deleteFile(logo.url);

            // Delete from Firestore
            const logoDocRef = doc(db, `users/${userId}/brandLogos`, logo.id);
            await deleteDoc(logoDocRef);

            // Remove from local state
            setBrandLogos((prev) => prev.filter((l) => l.id !== logo.id));

            console.log('[BrandMarketingSection] Logo deleted successfully:', logo.id);
        } catch (error) {
            console.error('[BrandMarketingSection] Failed to delete logo:', error);
        }
    };

    return (
        <div className="mt-4 pt-6 border-t border-white/10 flex flex-col gap-4">
            {/* Section Heading */}
            <SectionHeading
                icon={<TagIcon className="w-4 h-4" />}
                title="Brand Marketing"
            />

            {/* Add Brand Logo Feature */}
            <div className="flex items-center justify-between pl-2 border-l-2 border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Add Brand Logo
                    </span>
                </div>
                <label
                    className="relative inline-flex items-center flex-shrink-0 cursor-pointer"
                    title="Toggle Brand Logo"
                >
                    <input
                        type="checkbox"
                        checked={isAddBrandLogoEnabled}
                        onChange={(e) => {
                            const enabled = e.target.checked;
                            setIsAddBrandLogoEnabled(enabled);
                            if (!enabled) {
                                // Reset selection and branding when toggled off
                                setSelectedLogoId(null);
                                setLogoBranding({
                                    selectedLogoId: null,
                                    mode: null,
                                    position: null,
                                    watermarkStyle: 'tiled',
                                    size: 'medium',
                                    opacity: 80,
                                    offsetX: 0,
                                    offsetY: 0
                                });
                            }
                        }}
                        className="sr-only peer"
                    />
                    <div className="w-7 h-3.5 bg-white/10 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-white/20 peer-checked:after:bg-white"></div>
                </label>
            </div>

            {/* Logo Grid */}
            <AnimatePresence>
                {isAddBrandLogoEnabled && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-3 overflow-hidden pl-2"
                    >
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            Brand Logos ({brandLogos.length}/5)
                        </span>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {/* Add New Logo Card */}
                                <button
                                    onClick={() => setIsUploadModalOpen(true)}
                                    disabled={brandLogos.length >= 5}
                                    className={`aspect-square rounded-lg border transition-all flex items-center justify-center ${brandLogos.length >= 5
                                        ? 'border-white/5 bg-white/5 cursor-not-allowed opacity-30'
                                        : 'border-dashed border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer'
                                        }`}
                                    title={brandLogos.length >= 5 ? 'Maximum 5 logos reached' : 'Add brand logo'}
                                >
                                    <PlusIcon className={`w-6 h-6 ${brandLogos.length >= 5 ? 'text-gray-700' : 'text-gray-500 group-hover:text-blue-400'}`} />
                                </button>

                                {/* Logo Cards */}
                                {brandLogos.map((logo) => (
                                    <div
                                        key={logo.id}
                                        className="group relative aspect-square rounded-lg overflow-hidden bg-[repeating-linear-gradient(45deg,#0a0a0a_0,#0a0a0a_8px,#1a1a1a_8px,#1a1a1a_16px)] border border-white/10 hover:border-white/20 transition-all p-2 flex items-center justify-center"
                                    >
                                        <img
                                            src={logo.url}
                                            alt={logo.name}
                                            className="max-w-full max-h-full object-contain"
                                        />

                                        {/* Overlay Actions - Matches Wardrobe Pattern */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                            <div className="flex justify-end">
                                                {/* Empty space for future actions (like favorite) */}
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[9px] text-white font-medium truncate">{logo.name}</p>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => {
                                                            if (selectedLogoId === logo.id) {
                                                                // Deselect: clear local state and reset context
                                                                setSelectedLogoId(null);
                                                                setLogoBranding({
                                                                    selectedLogoId: null,
                                                                    mode: null,
                                                                    position: null,
                                                                    watermarkStyle: 'tiled',
                                                                    size: 'medium',
                                                                    opacity: 80,
                                                                    offsetX: 0,
                                                                    offsetY: 0
                                                                });
                                                            } else {
                                                                setSelectedLogoId(logo.id);
                                                            }
                                                        }}
                                                        className={`flex-1 text-[9px] font-bold py-1 rounded transition-colors ${selectedLogoId === logo.id
                                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                                            : 'bg-white text-black hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {selectedLogoId === logo.id ? 'Deselect' : 'Select'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteLogo(logo);
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
                        )}

                        {brandLogos.length === 0 && !isLoading && (
                            <div className="p-4 text-center border border-dashed border-white/10 rounded-lg text-gray-600 text-[10px] italic">
                                No logos yet. Click + to add your first brand logo.
                            </div>
                        )}

                        {/* Logo Position Controls */}
                        {selectedLogoId && (
                            <div className="mt-4 flex flex-col gap-3">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                    Position
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
                                        <button
                                            key={pos}
                                            onClick={() => {
                                                setLogoBranding({
                                                    ...logoBranding,
                                                    selectedLogoId,
                                                    mode: 'position',
                                                    position: pos
                                                });
                                            }}
                                            className={`px-3 py-2 text-[10px] font-semibold rounded-lg transition-all ${logoBranding.position === pos && logoBranding.mode === 'position'
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            {pos.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Size & Opacity Controls */}
                        {selectedLogoId && (
                            <div className="mt-3 space-y-3">
                                {/* Size Control */}
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Size</span>
                                    <div className="flex gap-1.5 mt-1.5">
                                        {(['small', 'medium', 'large'] as const).map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setLogoBranding({ ...logoBranding, size: s })}
                                                className={`flex-1 px-2 py-1.5 text-[9px] font-bold rounded transition-all ${logoBranding.size === s
                                                    ? 'bg-white text-black'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {s.charAt(0).toUpperCase() + s.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Opacity Slider */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Opacity</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{logoBranding.opacity}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="40"
                                        max="100"
                                        step="20"
                                        value={logoBranding.opacity}
                                        onChange={(e) => setLogoBranding({ ...logoBranding, opacity: Number(e.target.value) })}
                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                                    />
                                </div>

                                {/* Offset Controls */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Offset</span>
                                        {(logoBranding.offsetX !== 0 || logoBranding.offsetY !== 0) && (
                                            <button
                                                onClick={() => setLogoBranding({ ...logoBranding, offsetX: 0, offsetY: 0 })}
                                                className="text-[9px] text-blue-400 hover:text-blue-300 font-medium"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {/* Horizontal Offset */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-gray-500 w-4">X</span>
                                            <input
                                                type="range"
                                                min="-20"
                                                max="20"
                                                step="1"
                                                value={logoBranding.offsetX}
                                                onChange={(e) => setLogoBranding({ ...logoBranding, offsetX: Number(e.target.value) })}
                                                className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                                            />
                                            <span className="text-[9px] text-gray-400 font-mono w-8 text-right">{logoBranding.offsetX}%</span>
                                        </div>
                                        {/* Vertical Offset */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] text-gray-500 w-4">Y</span>
                                            <input
                                                type="range"
                                                min="-20"
                                                max="20"
                                                step="1"
                                                value={logoBranding.offsetY}
                                                onChange={(e) => setLogoBranding({ ...logoBranding, offsetY: Number(e.target.value) })}
                                                className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                                            />
                                            <span className="text-[9px] text-gray-400 font-mono w-8 text-right">{logoBranding.offsetY}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Watermark Toggle - Phase 2 */}
                        {selectedLogoId && (
                            <div className="mt-3 flex items-center justify-between pl-0">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    Use as Watermark
                                </span>
                                <label
                                    className="relative inline-flex items-center flex-shrink-0 cursor-pointer"
                                    title="Toggle Watermark (Coming Soon)"
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        disabled
                                        checked={logoBranding.mode === 'watermark'}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setLogoBranding({
                                                    ...logoBranding,
                                                    selectedLogoId,
                                                    mode: 'watermark',
                                                    position: null
                                                });
                                            } else {
                                                setLogoBranding({
                                                    ...logoBranding,
                                                    mode: null
                                                });
                                            }
                                        }}
                                    />
                                    <div className="w-7 h-3.5 bg-white/10 rounded-full peer peer-disabled:opacity-30 peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-400 after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-white/20 peer-checked:after:bg-white"></div>
                                </label>
                            </div>
                        )}

                        {/* Status Indicator */}
                        {selectedLogoId && logoBranding.position && logoBranding.mode === 'position' && (
                            <div className="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-[10px] text-green-400">
                                        <p className="font-semibold">Logo Applied</p>
                                        <p className="text-green-400/80 mt-0.5">
                                            {brandLogos.find(l => l.id === selectedLogoId)?.name} at {logoBranding.position.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} • Visible on download
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Modal */}
            <BrandLogoUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSave={handleSaveLogo}
            />
        </div>
    );
};

export default BrandMarketingSection;
