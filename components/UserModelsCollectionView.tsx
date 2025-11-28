import React, { useState, useEffect } from 'react';
import { getGlobalModels, GlobalModel } from '../services/firestoreService';
import { getAllProjectMetadata } from '../services/dbService';
import { getCurrentUserId } from '../services/authService';
import { User, Project } from '../types';
import { LayoutIcon } from './icons';

interface UserModelsCollectionViewProps {
    currentUser: User | null;
}

interface ProjectGroup {
    project: Project;
    models: GlobalModel[];
}

const UserModelsCollectionView: React.FC<UserModelsCollectionViewProps> = ({ currentUser }) => {
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadModels = async () => {
            if (!currentUser) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const userId = getCurrentUserId();
                if (!userId) return;

                // Load all projects
                const projects = await getAllProjectMetadata();

                // Load all global models (without project filter to get ALL models)
                const allModels = await getGlobalModels(userId);

                // Group models by project
                const groups: ProjectGroup[] = projects
                    .map(project => ({
                        project,
                        models: allModels.filter(m => m.projectId === project.id)
                    }))
                    .filter(g => g.models.length > 0); // Only show projects with models

                setProjectGroups(groups);
            } catch (error) {
                console.error('Error loading user models for collections:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadModels();
    }, [currentUser]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-gray-400">Loading models...</div>
            </div>
        );
    }

    if (projectGroups.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center mx-auto mb-8">
                    <LayoutIcon className="w-16 h-16 text-gray-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                </div>
                <h3 className="text-xl font-sans font-semibold text-white mb-3">
                    No Models Yet
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
                    Create models in your projects to see them here. Models from all projects will be organized and displayed.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            {projectGroups.map(({ project, models }) => (
                <div key={project.id}>
                    {/* Project Header */}
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-white/90">{project.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{models.length} model{models.length !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Models Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {models.map(model => (
                            <div
                                key={model.id}
                                className="group relative aspect-[3/4] bg-white/5 rounded-lg border border-white/5 hover:border-white/10 overflow-hidden cursor-pointer transition-all hover:scale-105"
                            >
                                <img
                                    src={model.thumbnail || model.url}
                                    alt={model.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-xs font-medium text-white truncate">{model.name}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserModelsCollectionView;
