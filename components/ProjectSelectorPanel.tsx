/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Project } from '../types';
import { PenLineIcon, PlusIcon } from './icons';

interface ProjectSelectorPanelProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onEditProject: () => void;
  onCreateProject: () => void;
  isCreateDisabled?: boolean;
}

const ProjectSelectorPanel: React.FC<ProjectSelectorPanelProps> = ({
  projects,
  currentProjectId,
  onProjectChange,
  onEditProject,
  onCreateProject,
  isCreateDisabled = false,
}) => {
  return (
    <div className="flex-shrink-0 p-3 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-200 mb-1.5 flex items-center gap-1.5">Project</h3>
        <div className="flex items-center gap-1.5">
            <select
                value={currentProjectId || ''}
                onChange={(e) => onProjectChange(e.target.value)}
                className="w-full text-xs p-1.5 bg-black/30 border border-gray-700 text-gray-200 rounded"
                disabled={projects.length === 0}
            >
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                {projects.length === 0 && <option>No projects yet</option>}
            </select>
            <button
                onClick={onEditProject}
                className="p-1.5 rounded bg-black/30 border border-gray-700 text-gray-300 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit Project"
                disabled={!currentProjectId}
            >
                <PenLineIcon className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={onCreateProject}
                className="p-1.5 rounded bg-black/30 border border-gray-700 text-gray-300 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isCreateDisabled ? "Create new projects in the Create Model screen" : "New Project"}
                disabled={isCreateDisabled}
            >
                <PlusIcon className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
  );
};

export default ProjectSelectorPanel;