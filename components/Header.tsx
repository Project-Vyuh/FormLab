/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { View } from '../App';
import { Notification, User } from '../types';
import NotificationDropdown from './NotificationDropdown';
import SyncStatusIndicator from './SyncStatusIndicator';
import { ChevronDownIcon, UserIcon, ZapIcon } from './icons';
import { migrateAssetsToGlobalLibrary } from '../services/migrationService';

interface HeaderProps {
    activeView: View;
    onNavigate: (view: View) => void;
    notifications: Notification[];
    currentUser: User;
    onLogout: () => void;
    hasProjects: boolean;
}

const UserMenu: React.FC<{ user: User; onLogout: () => void; onNavigateToProjects: () => void }> = ({ user, onLogout, onNavigateToProjects }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleProjectsClick = () => {
        onNavigateToProjects();
        setIsOpen(false);
    };

    return (
        <div ref={menuRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 text-[13px] font-semibold text-gray-300 hover:text-white transition-colors"
            >
                {user.photoURL && !imageError ? (
                    <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-6 h-6 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-gray-400" />
                    </div>
                )}
                <span>{user.displayName || user.email}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 mt-2 w-56 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 origin-top-right py-1.5"
                    >
                        <div className="px-4 py-3 border-b border-white/5">
                            <p className="text-sm font-semibold text-white">{user.displayName}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{user.email}</p>
                        </div>
                        <div className="p-1">
                            <button
                                onClick={handleProjectsClick}
                                className="w-full text-left px-3 py-2 text-[13px] font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Projects
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm('Migrate all project assets to Global Library? This may take a moment.')) {
                                        try {
                                            const result = await migrateAssetsToGlobalLibrary(user.uid);
                                            alert(`Migration Complete!\nModels: ${result.modelsMigrated}\nWardrobe: ${result.wardrobeItemsMigrated}`);
                                        } catch (e) {
                                            alert('Migration Failed. Check console for details.');
                                        }
                                    }
                                    setIsOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-[13px] font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <ZapIcon className="w-3.5 h-3.5" />
                                Migrate Assets
                            </button>
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ activeView, onNavigate, notifications, currentUser, onLogout, hasProjects }) => {
    const getButtonClasses = (view: View, disabled: boolean = false) => {
        if (disabled) {
            return 'text-[13px] font-semibold text-gray-600 cursor-not-allowed border border-transparent py-1.5 px-4 rounded-full transition-all';
        }
        return activeView === view
            ? 'text-[13px] font-semibold text-white bg-white/10 border border-white/10 shadow-inner py-1.5 px-4 rounded-full transition-all'
            : 'text-[13px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 border border-transparent py-1.5 px-4 rounded-full transition-all';
    };

    return (
        <header className="w-full py-3 px-4 md:px-6 bg-[#1a1a1a]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between flex-shrink-0 z-40 sticky top-0">
            <h1 className="text-xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                FormLab
            </h1>
            <nav className="flex items-center gap-2">
                <button
                    onClick={() => hasProjects && onNavigate('createModel')}
                    className={getButtonClasses('createModel', !hasProjects)}
                    disabled={!hasProjects}
                >
                    Create Model
                </button>
                <button
                    onClick={() => hasProjects && onNavigate('imageStudio')}
                    className={getButtonClasses('imageStudio', !hasProjects)}
                    disabled={!hasProjects}
                >
                    Image Studio
                </button>
                <button
                    onClick={() => hasProjects && onNavigate('videoCreator')}
                    className={getButtonClasses('videoCreator', !hasProjects)}
                    disabled={!hasProjects}
                >
                    Video Creator
                </button>
                <div className="w-px h-5 bg-white/10 mx-1"></div>
                <button
                    onClick={() => onNavigate('templates')}
                    className={getButtonClasses('templates')}
                >
                    Collections
                </button>
                <NotificationDropdown notifications={notifications} />
                <SyncStatusIndicator />
                <div className="w-px h-5 bg-white/10 mx-1"></div>
                <UserMenu user={currentUser} onLogout={onLogout} onNavigateToProjects={() => onNavigate('projects')} />
            </nav>
        </header>
    );
};

export default Header;