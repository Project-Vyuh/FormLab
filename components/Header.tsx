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
import { ChevronDownIcon, UserIcon } from './icons';

interface HeaderProps {
    activeView: View;
    onNavigate: (view: View) => void;
    notifications: Notification[];
    currentUser: User;
    onLogout: () => void;
}

const UserMenu: React.FC<{ user: User; onLogout: () => void; onNavigateToProjects: () => void }> = ({ user, onLogout, onNavigateToProjects }) => {
    const [isOpen, setIsOpen] = useState(false);
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
                className="flex items-center gap-3 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
            >
                {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-gray-400" />
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
                        className="absolute right-0 mt-2 w-48 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl z-50 origin-top-right py-1"
                    >
                        <div className="px-4 py-2 border-b border-gray-700">
                            <p className="text-sm font-semibold text-gray-200">{user.displayName}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                        <button
                            onClick={handleProjectsClick}
                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
                        >
                            Projects
                        </button>
                        <button
                            onClick={onLogout}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                        >
                            Logout
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ activeView, onNavigate, notifications, currentUser, onLogout }) => {
    const getButtonClasses = (view: View) => {
        return activeView === view
            ? 'text-sm font-semibold bg-gray-100 text-gray-900 py-1.5 px-4 rounded-full transition-colors'
            : 'text-sm font-semibold text-gray-400 hover:bg-gray-800 py-1.5 px-4 rounded-full transition-colors';
    };

    return (
        <header className="w-full py-3 px-4 md:px-8 bg-[#1a1a1a] border-b border-gray-700/80 flex items-center justify-between flex-shrink-0 z-40">
            <h1 className="text-xl font-bold text-gray-100 tracking-wide">
                FormLab
            </h1>
            <nav className="flex items-center gap-2">
                <button
                    onClick={() => onNavigate('createModel')}
                    className={getButtonClasses('createModel')}
                >
                    Create Model
                </button>
                <button
                    onClick={() => onNavigate('imageStudio')}
                    className={getButtonClasses('imageStudio')}
                >
                    Image Studio
                </button>
                <button
                    onClick={() => onNavigate('videoCreator')}
                    className={getButtonClasses('videoCreator')}
                >
                    Video Creator
                </button>
                <div className="w-px h-6 bg-gray-700 mx-2"></div>
                <button
                    onClick={() => onNavigate('templates')}
                    className={getButtonClasses('templates')}
                >
                    Collections
                </button>
                <NotificationDropdown notifications={notifications} />
                <SyncStatusIndicator />
                <div className="w-px h-6 bg-gray-700 mx-2"></div>
                <UserMenu user={currentUser} onLogout={onLogout} onNavigateToProjects={() => onNavigate('projects')} />
            </nav>
        </header>
    );
};

export default Header;