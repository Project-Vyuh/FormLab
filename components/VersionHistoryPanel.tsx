/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HistoryItem, HistoryItemType } from '../types';
import { StarIcon, ChevronUpIcon, GitBranchIcon, PenLineIcon, ChevronRightIcon, Trash2Icon, UserIcon, WandIcon, ShirtIcon } from './icons';

// Helper function to get icon and color for history item type
const getTypeInfo = (type: HistoryItemType) => {
  switch (type) {
    case 'model-generation':
      return { icon: UserIcon, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Base Model' };
    case 'model-revision':
      return { icon: WandIcon, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Model Revision' };
    case 'try-on':
      return { icon: ShirtIcon, color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Try-On' };
    case 'try-on-revision':
      return { icon: PenLineIcon, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Try-On Revision' };
    default:
      return { icon: GitBranchIcon, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Unknown' };
  }
};

interface VersionHistoryPanelProps {
  history: HistoryItem[];
  currentHistoryItemId: string | null;
  onSelectVersion: (id: string) => void;
  onDeleteVersion: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRenameVersion: (id: string, newName: string) => void;
}

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  history,
  currentHistoryItemId,
  onSelectVersion,
  onDeleteVersion,
  onToggleStar,
  onRenameVersion,
}) => {
  const [panelHeight, setPanelHeight] = useState(96);
  const [filter, setFilter] = useState<'all' | 'starred'>('all');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: HistoryItem } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [renamingVersionId, setRenamingVersionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const currentHistoryItem = useMemo(() => history.find(item => item.id === currentHistoryItemId), [history, currentHistoryItemId]);

  // Find the root ancestor (base model) of a given history item
  const findRootAncestor = useCallback((itemId: string | null, historyItems: HistoryItem[]): string | null => {
    if (!itemId) return null;

    let current = historyItems.find(item => item.id === itemId);
    if (!current) return null;

    // Traverse up the tree until we find a node with no parent (base model)
    while (current && current.parentId) {
      const parent = historyItems.find(item => item.id === current!.parentId);
      if (!parent) break;
      current = parent;
    }

    return current.id;
  }, []);

  // Get all descendants of a given history item (children, grandchildren, etc.)
  const getAllDescendants = useCallback((itemId: string, historyItems: HistoryItem[]): Set<string> => {
    const descendants = new Set<string>();
    const queue: string[] = [itemId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      descendants.add(currentId);

      // Find all children of this item
      const children = historyItems.filter(item => item.parentId === currentId);
      children.forEach(child => queue.push(child.id));
    }

    return descendants;
  }, []);

  // Filter history to show only items with the same baseModelId
  const lineageFilteredHistory = useMemo(() => {
    if (!currentHistoryItemId || history.length === 0) {
      console.log('[VersionHistoryPanel] No currentHistoryItemId or empty history, showing all:', history.length);
      return history;
    }

    const currentItem = history.find(h => h.id === currentHistoryItemId);
    if (!currentItem || !currentItem.baseModelId) {
      console.log('[VersionHistoryPanel] Current item not found or no baseModelId, showing all:', history.length);
      return history;
    }

    const filtered = history.filter(item => item.baseModelId === currentItem.baseModelId);

    console.log('[VersionHistoryPanel] Filtering by baseModelId:', currentItem.baseModelId);
    console.log('[VersionHistoryPanel] Total history items:', history.length);
    console.log('[VersionHistoryPanel] Filtered history items:', filtered.length);
    console.log('[VersionHistoryPanel] Filtered items:', filtered.map(h => ({ id: h.id, type: h.type, baseModelId: h.baseModelId })));

    return filtered;
  }, [history, currentHistoryItemId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commitRename = () => {
    if (renamingVersionId) {
      onRenameVersion(renamingVersionId, renameValue);
    }
    setRenamingVersionId(null);
    setRenameValue('');
  };

  const handleResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight;
    let animationFrameId: number | null = null;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = startHeight - (moveEvent.clientY - startY);
      const clampedHeight = Math.max(96, Math.min(newHeight, window.innerHeight * 0.6));

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        setPanelHeight(clampedHeight);
      });
    };

    const handleMouseUp = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [panelHeight]);

  const { historyNodes, connections, activePath } = useMemo(() => {
    if (!lineageFilteredHistory.length) return { historyNodes: [], connections: [], activePath: new Set() };

    const itemsById = new Map(lineageFilteredHistory.map(item => [item.id, { ...item, children: [] as HistoryItem[] }]));
    const nodePositions = new Map<string, { x: number, y: number }>();
    const sortedHistory = [...lineageFilteredHistory].sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]));

    sortedHistory.forEach((item, index) => {
      let depth = 0;
      let current: HistoryItem | (HistoryItem & { children: HistoryItem[] }) | undefined = item;
      while (current && current.parentId && itemsById.has(current.parentId)) {
        depth++;
        current = itemsById.get(current.parentId) as (HistoryItem & { children: HistoryItem[] }) | undefined;
      }
      nodePositions.set(item.id, { x: index, y: depth });
    });

    const finalNodes = lineageFilteredHistory.map(item => ({
      ...item,
      position: nodePositions.get(item.id) || { x: 0, y: 0 },
    }));

    const finalConnections = lineageFilteredHistory
      .filter(item => item.parentId && nodePositions.has(item.parentId) && nodePositions.has(item.id))
      .map(item => ({ from: item.parentId!, to: item.id }));

    const path = new Set<string>();
    let currentItemInPath: HistoryItem | undefined = currentHistoryItem;
    while (currentItemInPath) {
      path.add(currentItemInPath.id);
      currentItemInPath = currentItemInPath.parentId ? lineageFilteredHistory.find(item => item.id === currentItemInPath!.parentId) : undefined;
    }

    return { historyNodes: finalNodes, connections: finalConnections, activePath: path };
  }, [lineageFilteredHistory, currentHistoryItem]);

  const filteredHistory = useMemo(() => {
    if (filter === 'starred') {
      return lineageFilteredHistory.filter(item => item.isStarred);
    }
    return [...lineageFilteredHistory].sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]));
  }, [lineageFilteredHistory, filter]);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex flex-col">
      <div onMouseDown={handleResize} className="w-full h-1 cursor-row-resize bg-white/5 hover:bg-[#318CE7] transition-colors z-10" />
      <div style={{ height: `${panelHeight}px` }} className="bg-[#1a1a1a] border-t border-white/5 transition-all duration-200 ease-in-out flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 h-10 flex-shrink-0 border-b border-white/5">
          <div className="flex items-center gap-2">
            <button onClick={() => setPanelHeight(p => p > 120 ? 96 : 300)} title={panelHeight > 120 ? 'Collapse' : 'Expand'} className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors">
              <ChevronUpIcon className={`w-3.5 h-3.5 transition-transform ${panelHeight > 120 ? '' : 'rotate-180'}`} />
            </button>
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <GitBranchIcon className="w-3.5 h-3.5 text-gray-600" />
              Version History
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFilter('all')} className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${filter === 'all' ? 'bg-white/10 text-white border border-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>All</button>
            <button onClick={() => setFilter('starred')} className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${filter === 'starred' ? 'bg-white/10 text-white border border-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>
              <StarIcon className="w-2.5 h-2.5" /> Starred
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-grow px-4 py-3">
          {panelHeight <= 120 ? (
            <div className="flex items-center gap-3 h-full overflow-x-auto overflow-y-hidden pb-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {filteredHistory.map(item => {
                const typeInfo = getTypeInfo(item.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={item.id} className="h-full flex flex-col items-center justify-center group/history flex-shrink-0" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}>
                    <button
                      onClick={() => onSelectVersion(item.id)}
                      title={`${typeInfo.label}: ${item.name || item.prompt}`}
                      className={`relative block w-12 h-12 rounded-lg overflow-hidden border transition-all ${item.id === currentHistoryItemId ? 'border-[#318CE7] shadow-[0_0_0_1px_#318CE7]' : 'border-white/10 hover:border-white/30'}`}>
                      <img src={item.imageUrl} alt={item.name || item.prompt} className="w-full h-full object-cover" />
                      <div className={`absolute top-0.5 left-0.5 p-0.5 rounded ${typeInfo.color} border backdrop-blur-sm`}>
                        <TypeIcon className="w-2.5 h-2.5" />
                      </div>
                      {item.isStarred && <StarIcon className="absolute bottom-1 right-1 w-3 h-3 fill-yellow-400 stroke-yellow-500 drop-shadow-md" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative h-full w-full">
              {historyNodes.map(node => {
                const typeInfo = getTypeInfo(node.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={node.id} className="absolute group/history transition-all duration-300" style={{ left: `${node.position.x * 140}px`, top: `${node.position.y * 130}px`, width: '120px' }}>
                    <div className="flex flex-col items-center">
                      <div className="relative" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: node }); }}>
                        <button onClick={() => onSelectVersion(node.id)} className={`relative block w-24 h-24 rounded-xl overflow-hidden border transition-all duration-200 ${node.id === currentHistoryItemId ? 'border-[#318CE7] shadow-[0_0_15px_-3px_rgba(49,140,231,0.3)] scale-105' : 'border-white/10 hover:border-white/30'} ${activePath.has(node.id) && node.id !== currentHistoryItemId ? 'border-[#318CE7]/50' : ''}`}>
                          <img src={node.imageUrl} alt={node.name || node.prompt} className="w-full h-full object-cover" />
                          <div className={`absolute top-1 left-1 p-1 rounded ${typeInfo.color} border backdrop-blur-sm`}>
                            <TypeIcon className="w-3 h-3" />
                          </div>
                        </button>
                        <button onClick={() => onToggleStar(node.id)} className={`absolute top-1 right-1 p-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white transition-opacity ${node.isStarred ? 'opacity-100' : 'opacity-0 group-hover/history:opacity-100'}`} title="Star version">
                          <StarIcon className={`w-3.5 h-3.5 transition-colors ${node.isStarred ? 'fill-yellow-400 stroke-yellow-400' : 'fill-transparent stroke-white'}`} />
                        </button>
                      </div>
                      {renamingVersionId === node.id ? (
                        <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={commitRename} onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingVersionId(null); }} autoFocus className="w-full text-[10px] bg-black/50 border border-[#318CE7] text-white rounded px-1.5 py-0.5 mt-2 text-center outline-none" />
                      ) : (
                        <p onDoubleClick={() => { setRenamingVersionId(node.id); setRenameValue(node.name || ''); }} className="text-[10px] font-medium w-full text-gray-400 truncate text-center mt-2 px-1 select-none group-hover/history:text-gray-300 transition-colors" title={node.name || node.prompt}>{node.name || `Version ${node.id.slice(-4)}`}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ minWidth: `${(Math.max(...historyNodes.map(n => n.position.x)) + 2) * 140}px`, minHeight: `${(Math.max(...historyNodes.map(n => n.position.y)) + 2) * 130}px` }}>
                {connections.map(({ from, to }) => {
                  const fromNode = historyNodes.find(n => n.id === from)?.position;
                  const toNode = historyNodes.find(n => n.id === to)?.position;
                  if (!fromNode || !toNode) return null;
                  const x1 = fromNode.x * 140 + 60;
                  const y1 = fromNode.y * 130 + 120;
                  const x2 = toNode.x * 140 + 60;
                  const y2 = toNode.y * 130;
                  const isActive = activePath.has(from) && activePath.has(to);
                  return <path key={`${from}-${to}`} d={`M ${x1} ${y1} C ${x1} ${y1 + 40}, ${x2} ${y2 - 40}, ${x2} ${y2}`} stroke={isActive ? '#318CE7' : 'rgba(255,255,255,0.1)'} strokeWidth={isActive ? 2 : 1.5} fill="none" />;
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
      {contextMenu && (
        <div ref={contextMenuRef} style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-50 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 w-48 overflow-hidden">
          <button onClick={() => { onSelectVersion(contextMenu.item.id); setContextMenu(null); }} className="w-full flex items-center gap-3 text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
            <GitBranchIcon className="w-3.5 h-3.5" /> Create Branch from Here
          </button>
          <button onClick={() => { setRenamingVersionId(contextMenu.item.id); setRenameValue(contextMenu.item.name || ''); setContextMenu(null); }} className="w-full flex items-center gap-3 text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
            <PenLineIcon className="w-3.5 h-3.5" /> Rename
          </button>
          <button onClick={() => { onToggleStar(contextMenu.item.id); setContextMenu(null); }} className="w-full flex items-center gap-3 text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
            <StarIcon className={`w-3.5 h-3.5 ${contextMenu.item.isStarred ? 'fill-yellow-400 stroke-yellow-400' : 'fill-transparent'}`} /> {contextMenu.item.isStarred ? 'Unstar' : 'Star Version'}
          </button>
          <div className="h-px bg-white/5 my-1"></div>
          <button onClick={() => onDeleteVersion(contextMenu.item.id)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2Icon className="w-3.5 h-3.5" /> Delete Version
          </button>
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;