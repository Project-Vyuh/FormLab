/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useState } from 'react';
import { LayoutIcon, PlusIcon, SearchIcon, Trash2Icon } from './icons';
import { Project } from '../types';

interface ProjectsProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => Promise<void>;
  onOpen: () => void;
}

const Projects: React.FC<ProjectsProps> = ({ projects, currentProjectId, onSelect, onCreate, onDelete, onOpen }) => {
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(project => [project.title, project.description, project.organization, ...project.tags]
      .some(value => value?.toLowerCase().includes(needle)));
  }, [projects, query]);

  const remove = async (project: Project) => {
    if (!window.confirm(`Delete “${project.title}” and its saved work? This cannot be undone.`)) return;
    setDeletingId(project.id);
    try { await onDelete(project.id); } finally { setDeletingId(null); }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#111111] text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div><h1 className="text-3xl font-semibold">Projects</h1><p className="text-sm text-gray-400 mt-1">Organize models, campaigns, wardrobe, and generated assets.</p></div>
          <button onClick={onCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-black px-4 py-2.5 text-sm font-medium hover:bg-gray-200"><PlusIcon className="w-4 h-4" /> New project</button>
        </div>
        <label className="relative block mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects" className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm outline-none focus:border-white/25" />
        </label>
        {visibleProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center"><LayoutIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" /><p className="text-gray-300">{projects.length ? 'No projects match your search.' : 'Create your first project to begin.'}</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleProjects.map(project => {
              const active = project.id === currentProjectId;
              return (
                <article key={project.id} className={`rounded-2xl border p-5 transition ${active ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <div className="flex justify-between gap-3"><div className="min-w-0"><h2 className="font-medium truncate">{project.title}</h2><p className="text-xs text-gray-500 mt-1">{project.status} · {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}</p></div>{active && <span className="text-[10px] uppercase tracking-wider text-blue-300">Active</span>}</div>
                  <p className="text-sm text-gray-400 mt-4 line-clamp-2 min-h-10">{project.description || 'No description yet.'}</p>
                  <div className="flex gap-2 mt-5">
                    <button onClick={() => { onSelect(project.id); onOpen(); }} className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Open</button>
                    <button aria-label={`Delete ${project.title}`} disabled={deletingId === project.id} onClick={() => void remove(project)} className="rounded-lg border border-red-500/20 px-3 text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2Icon className="w-4 h-4" /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
