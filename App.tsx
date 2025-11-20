/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Header from './components/Header';
import CreateModel from './components/CreateModel';
import ImageStudio from './components/ImageStudio';
import VideoCreator from './components/VideoCreator';
import Templates from './components/Templates';
import Projects from './components/Projects';
import Auth from './components/Auth';
import EmailVerification from './components/EmailVerification';
import ProjectOnboarding from './components/ProjectOnboarding';
import ProjectModal from './components/ProjectModal';
import { Model, Project, Notification, User, SelectedStylingModel } from './types';
import { getAllProjectMetadata as dbGetAllProjectMetadata, loadProjectState, saveProjectMetadata, cleanupBlobUrls, saveStylingHistory, migrateHistoryItemTypes } from './services/dbService';
import { onAuthStateChanged, signOutUser } from './services/authService';
import { getUserDocument, updateLastLogin, createUserDocument } from './services/userService';
import { loadPredefinedModels } from './services/firestoreService';


export type View = 'createModel' | 'imageStudio' | 'videoCreator' | 'templates' | 'projects';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('createModel');

  // Centralized state for model data
  const [modelGallery, setModelGallery] = useState<Model[]>([]);
  const [activeModelUrl, setActiveModelUrl] = useState<string | null>(null);

  const [videoReferenceImageUrl, setVideoReferenceImageUrl] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // NEW: Centralized Project State
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<'create' | 'edit'>('create');

  // Model selection state for CreateModel
  const [selectedHistoryItemId, setSelectedHistoryItemId] = useState<string | null>(null);

  // Selected styling model state for Image Studio
  const [selectedStylingModel, setSelectedStylingModel] = useState<SelectedStylingModel | null>(null);

  // Wardrobe Categories State (shared between ImageStudio and Templates)
  const [wardrobeCategories, setWardrobeCategories] = useState<string[]>([
    'Uncategorized', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Footwear', 'Accessories'
  ]);


  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Check if email is verified
        if (!firebaseUser.emailVerified) {
          // User exists but email not verified
          setUnverifiedEmail(firebaseUser.email || '');
          setCurrentUser(null);
          setAuthLoading(false);
          // Sign out the unverified user
          signOutUser();
          return;
        }

        try {
          // Fetch user data from Firestore
          let userData = await getUserDocument(firebaseUser.uid);

          // If user document doesn't exist, create it (for existing users who signed up before this feature)
          if (!userData) {
            console.log('No user document found, creating one...');
            await createUserDocument(firebaseUser.uid, {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              authProvider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
              emailVerified: firebaseUser.emailVerified,
            });
            userData = await getUserDocument(firebaseUser.uid);
          } else {
            // Update last login timestamp for existing users
            await updateLastLogin(firebaseUser.uid);
          }

          // Merge Firebase Auth data with Firestore data
          const user: User = {
            uid: firebaseUser.uid,
            email: userData?.email || firebaseUser.email,
            displayName: userData?.displayName || firebaseUser.displayName,
            photoURL: userData?.photoURL || firebaseUser.photoURL,
          };
          setCurrentUser(user);
          setUnverifiedEmail(null);
          setAuthLoading(false);
        } catch (error) {
          console.error('Error fetching user data from Firestore:', error);
          // Fallback to Firebase Auth data if Firestore fetch fails
          const user: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          };
          setCurrentUser(user);
          setUnverifiedEmail(null);
          setAuthLoading(false);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Run migrations on app mount (one-time)
  useEffect(() => {
    const runMigrations = async () => {
      await cleanupBlobUrls();
      await migrateHistoryItemTypes();
    };
    runMigrations();
  }, []);

  // Check for persisted user session on initial load
  useEffect(() => {
    const initApp = async () => {
      if (!currentUser) return;

      try {
        const projects = await dbGetAllProjectMetadata();
        setProjectList(projects); // Set global project list state
        if (projects.length === 0) {
          setNeedsOnboarding(true);
        } else {
          setNeedsOnboarding(false);
          const lastProject = localStorage.getItem('formlab-lastProject');
          const projectIdToLoad =
            (lastProject && projects.some(p => p.id === lastProject) ? lastProject : null) ||
            projects[0].id;

          setCurrentProjectId(projectIdToLoad);

          // Load only BASE models (parentId === null) from ALL projects into the gallery
          const galleryModels: Model[] = [];
          for (const project of projects) {
            try {
              const state = await loadProjectState(project.id);
              if (state?.generatedModelHistory?.length > 0) {
                // Get only BASE models (no parent) - these are unique model creations
                state.generatedModelHistory
                  .filter(historyItem => historyItem.parentId === null)
                  .forEach(historyItem => {
                    galleryModels.push({
                      id: `${project.id}-${historyItem.id}`,
                      url: historyItem.imageUrl,
                      source: 'user',
                      projectId: project.id, // Associate model with project
                      historyItemId: historyItem.id, // Store history item ID for loading
                    });
                  });
              }
            } catch (e) {
              console.error(`Failed to load state for project ${project.id}`, e);
            }
          }

          // Load pre-defined models
          try {
            const predefinedModels = await loadPredefinedModels();
            console.log(`Loaded ${predefinedModels.length} pre-defined models`);

            // Combine user models with pre-defined models
            const allModels = [
              ...galleryModels.reverse(), // User models first, newest first
              ...predefinedModels, // Then pre-defined models
            ];
            setModelGallery(allModels);
          } catch (error) {
            console.error('Failed to load pre-defined models:', error);
            // Fallback to just user models
            setModelGallery(galleryModels.reverse());
          }

          setActiveView('createModel');
        }
      } catch (e) {
        console.error("Failed to check for projects", e);
        setNeedsOnboarding(true); // Default to onboarding if DB check fails
      }
    };

    initApp();
  }, [currentUser]);

  const handleProjectsUpdate = useCallback((projects: Project[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const newNotifications = projects.reduce<Notification[]>((acc, project) => {
      if (project.deadline) {
        const deadlineDate = new Date(project.deadline);
        deadlineDate.setHours(0, 0, 0, 0); // Normalize deadline date

        if (deadlineDate < today) {
          acc.push({
            id: `${project.id}-past-due`,
            message: `Project "${project.title}" was due on ${deadlineDate.toLocaleDateString()}.`,
            projectId: project.id,
            type: 'deadline-past-due',
            createdAt: new Date(),
          });
        } else if (deadlineDate <= oneWeekFromNow) {
          const daysUntil = Math.round((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const dayString = daysUntil === 1 ? '1 day' : `${daysUntil} days`;
          acc.push({
            id: `${project.id}-approaching`,
            message: `Project "${project.title}" is due in ${dayString}.`,
            projectId: project.id,
            type: 'deadline-approaching',
            createdAt: new Date(),
          });
        }
      }
      return acc;
    }, []);

    setNotifications(newNotifications);
  }, []);

  // Update notifications when project list changes
  useEffect(() => {
    if (projectList.length > 0) {
      handleProjectsUpdate(projectList);
    }
  }, [projectList, handleProjectsUpdate]);

  // Filter models for current project only (user models + predefined models)
  const currentProjectModels = useMemo(() => {
    if (!currentProjectId) return modelGallery;
    return modelGallery.filter(model =>
      model.source === 'predefined' || model.projectId === currentProjectId
    );
  }, [modelGallery, currentProjectId]);

  const handleNavigate = useCallback((view: View) => {
    // If navigating to Image Studio and no model is active, but models exist,
    // select the first one to avoid showing an unnecessary empty state.
    if (view === 'imageStudio' && !activeModelUrl && currentProjectModels.length > 0) {
      setActiveModelUrl(currentProjectModels[0].url);
    }
    setActiveView(view);
  }, [activeModelUrl, currentProjectModels]);

  const handleSaveModel = useCallback(async (modelUrl: string) => {
    // This logic is now mostly deprecated in favor of project-based saves,
    // but kept for compatibility with ImageStudio's "Upload New Model" which doesn't have project context yet.
    console.log("Legacy save model called:", modelUrl);
  }, []);

  const handleDeleteModel = useCallback(async (modelToDelete: Model) => {
    // This logic is now mostly deprecated.
    console.log("Legacy delete model called:", modelToDelete);
  }, []);

  const handleModelAdded = useCallback((model: Model) => {
    // Add the new model to the gallery immediately
    setModelGallery(prevGallery => [model, ...prevGallery]);
  }, []);

  const handleSelectModelFromGallery = useCallback((model: Model) => {
    // If the model is from a different project, switch to that project
    if (model.projectId && model.projectId !== currentProjectId) {
      setCurrentProjectId(model.projectId);
      localStorage.setItem('formlab-lastProject', model.projectId);
    }

    // Set the selected history item ID in state (works for both same-project and cross-project)
    if (model.historyItemId) {
      setSelectedHistoryItemId(model.historyItemId);
    }

    // Set as active model
    setActiveModelUrl(model.url);
  }, [currentProjectId]);

  const handleHistoryItemLoaded = useCallback(() => {
    // Clear the selection after CreateModel has loaded it
    setSelectedHistoryItemId(null);
  }, []);

  const handleModelCreated = useCallback(async (stylingModelData: SelectedStylingModel) => {
    // Set the selected styling model for Image Studio
    setSelectedStylingModel(stylingModelData);

    // Keep the gallery updated (for backward compatibility if needed)
    setModelGallery(prevGallery => {
      const newModel: Model = {
        id: `${stylingModelData.baseModelId}-${Date.now()}`,
        url: stylingModelData.url,
        source: 'user',
        projectId: currentProjectId || undefined,
        historyItemId: stylingModelData.historyItemId,
      };
      return [newModel, ...prevGallery];
    });

    // Navigate to Image Studio
    setActiveView('imageStudio');
  }, [currentProjectId]);

  const handleSaveStylingHistory = useCallback(async (baseModelId: string, history: any[]) => {
    if (currentProjectId) {
      await saveStylingHistory(currentProjectId, baseModelId, history);
    }
  }, [currentProjectId]);

  const handleUseAsVideoReference = useCallback((imageUrl: string) => {
    setVideoReferenceImageUrl(imageUrl);
    setActiveView('videoCreator');
  }, []);



  const handleFirstProjectCreated = useCallback((project: Project) => {
    setProjectList([project]);
    setCurrentProjectId(project.id);
    setNeedsOnboarding(false);
    setActiveView('createModel');
  }, []);

  const handleLogout = async () => {
    try {
      await signOutUser();
      setProjectList([]);
      setCurrentProjectId(null);
      setCurrentProject(null);
      setActiveView('createModel');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };



  const handleProjectChange = useCallback(async (id: string) => {
    // If switching from Image Studio, auto-save current work and navigate to Create Model
    if (activeView === 'imageStudio' && selectedStylingModel && currentProjectId) {
      // Auto-save is already handled by ImageStudio's useEffect, but we'll clear the selection
      setSelectedStylingModel(null);
      setActiveView('createModel');
    }

    setCurrentProjectId(id);
    localStorage.setItem('formlab-lastProject', id);
  }, [activeView, selectedStylingModel, currentProjectId]);

  const handleOpenProjectModal = useCallback((mode: 'create' | 'edit') => {
    setProjectModalMode(mode);
    setIsProjectModalOpen(true);
  }, []);

  const handleSaveProject = useCallback(async (projectData: Project) => {
    try {
      await saveProjectMetadata(projectData);
      let updatedList;
      const existingIndex = projectList.findIndex(p => p.id === projectData.id);
      if (existingIndex > -1) {
        updatedList = projectList.map(p => p.id === projectData.id ? projectData : p);
      } else {
        updatedList = [...projectList, projectData];
      }
      setProjectList(updatedList);

      if (projectModalMode === 'create') {
        setCurrentProjectId(projectData.id);
      } else {
        setCurrentProject(projectData);
      }

      setIsProjectModalOpen(false);
    } catch (e) {
      console.error("Failed to save project metadata", e);
    }
  }, [projectList, projectModalMode]);

  useEffect(() => {
    const project = projectList.find(p => p.id === currentProjectId);
    setCurrentProject(project || null);
  }, [currentProjectId, projectList]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show verification screen if user has unverified email
  if (unverifiedEmail) {
    return <EmailVerification email={unverifiedEmail} onBackToLogin={() => setUnverifiedEmail(null)} />;
  }

  // Show auth screen if not authenticated
  if (!currentUser) {
    return <Auth />;
  }

  if (needsOnboarding) {
    return <ProjectOnboarding onProjectCreated={handleFirstProjectCreated} />;
  }

  return (
    <div className="font-sans flex flex-col h-screen bg-[#1a1a1a]">
      <Header
        activeView={activeView}
        onNavigate={handleNavigate}
        notifications={notifications}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <div className="flex-grow min-h-0 relative">
        <div className={`${activeView === 'createModel' ? 'block' : 'hidden'} absolute inset-0 bg-[#1a1a1a]`}>
          <CreateModel
            onModelFinalized={handleModelCreated}
            onSaveModelInstance={handleSaveModel}
            projectList={projectList}
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
            onOpenProjectModal={handleOpenProjectModal}
            currentUser={currentUser}
            modelGallery={currentProjectModels}
            onSelectModel={handleSelectModelFromGallery}
            onModelAdded={handleModelAdded}
            selectedHistoryItemId={selectedHistoryItemId}
            onHistoryItemLoaded={handleHistoryItemLoaded}
          />
        </div>
        <div className={`${activeView === 'imageStudio' ? 'block' : 'hidden'} absolute inset-0`}>
          <ImageStudio
            selectedStylingModel={selectedStylingModel}
            onNavigateToVideoCreator={handleUseAsVideoReference}
            onNavigateToCreateModel={() => handleNavigate('createModel')}
            projectList={projectList}
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
            onOpenProjectModal={handleOpenProjectModal}
            currentUser={currentUser}
            onCategoriesChange={setWardrobeCategories}
            onSaveStylingHistory={handleSaveStylingHistory}
          />
        </div>
        <div className={`${activeView === 'videoCreator' ? 'block' : 'hidden'} absolute inset-0`}>
          <VideoCreator
            referenceImageUrl={videoReferenceImageUrl}
            projectList={projectList}
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
            onOpenProjectModal={handleOpenProjectModal}
            currentUser={currentUser}
          />
        </div>
        <div className={`${activeView === 'templates' ? 'block' : 'hidden'} absolute inset-0`}>
          <Templates wardrobeCategories={wardrobeCategories} currentUser={currentUser} />
        </div>
        <div className={`${activeView === 'projects' ? 'block' : 'hidden'} absolute inset-0`}>
          <Projects />
        </div>

      </div>
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        mode={projectModalMode}
        projectData={projectModalMode === 'edit' ? currentProject : null}
      />
    </div>
  );
};

export default App;