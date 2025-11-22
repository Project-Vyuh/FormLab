/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellIcon } from './icons';
import { Notification } from '../types';

interface NotificationDropdownProps {
  notifications: Notification[];
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ notifications }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasNotifications = notifications.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        aria-label={`View notifications (${notifications.length} unread)`}
      >
        <BellIcon className="w-5 h-5" />
        {hasNotifications && (
          <span className="absolute top-1 right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 origin-top-right"
          >
            <div className="p-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {hasNotifications ? (
                <ul>
                  {notifications.map((notif) => (
                    <li key={notif.id} className="border-b border-white/5 last:border-b-0">
                      <a href="#" className="block p-3 hover:bg-white/5 transition-colors">
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${notif.type === 'deadline-past-due' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {notif.type === 'deadline-past-due' ? 'Deadline Past Due' : 'Deadline Approaching'}
                        </p>
                        <p className="text-[13px] text-gray-300 mt-1 leading-snug">{notif.message}</p>
                        <p className="text-[11px] text-gray-500 mt-2">{notif.createdAt.toLocaleString()}</p>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-[13px] text-gray-400">You have no new notifications.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationDropdown;
