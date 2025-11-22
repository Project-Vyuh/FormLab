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
import CreateProjectModal from './components/CreateProjectModal';
import CollectionsModal from './components/CollectionsModal';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import ProjectSyncListener from './components/ProjectSyncListener';
import { Model, Project, Notification, User, SelectedStylingModel } from './types';
import { getAllProjectMetadata as dbGetAllProjectMetadata, loadProjectState, saveProjectMetadata, cleanupBlobUrls, saveStylingHistory, migrateHistoryItemTypes, migrateBase64ImagesToStorage, migrateIndexedDBToFirestore, setCurrentUserId } from './services/dbService';
import { onAuthStateChanged, signOutUser } from './services/authService';
import { getUserDocument, updateLastLogin, createUserDocument } from './services/userService';
import { loadPredefinedModels, PredefinedModel } from './services/firestoreService';
import { SyncProvider } from './contexts/SyncContext';


export type View = 'createModel' | 'imageStudio' | 'videoCreator' | 'templates' | 'projects';

// Helper function to deduplicate models by ID
const deduplicateModels = (models: Model[]): Model[] => {
  const modelMap = new Map<string, Model>();
  models.forEach(model => {
    if (!modelMap.has(model.id)) {
      modelMap.set(model.id, model);
    }
  });
  return Array.from(modelMap.values());
};

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
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCollectionsModalOpen, setIsCollectionsModalOpen] = useState(false);

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

          // Set user ID for Firestore sync
          setCurrentUserId(user.uid);
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

          // Set user ID for Firestore sync
          setCurrentUserId(user.uid);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setAuthLoading(false);

        // Clear user ID for Firestore sync
        setCurrentUserId(null);
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

  // Migrate IndexedDB to Firestore when user logs in
  useEffect(() => {
    const runFirestoreMigration = async () => {
      if (!currentUser) return;

      // Check if migrations have already been run for this user
      const base64MigrationKey = `formlab-base64-migration-${currentUser.uid}`;
      const firestoreMigrationKey = `formlab-firestore-migration-${currentUser.uid}`;

      const hasRunBase64Migration = localStorage.getItem(base64MigrationKey);
      const hasRunFirestoreMigration = localStorage.getItem(firestoreMigrationKey);

      try {
        // Step 1: Migrate base64 images to Firebase Storage (run first)
        if (!hasRunBase64Migration) {
          console.log('[App] Running one-time base64 image migration...');
          const base64Result = await migrateBase64ImagesToStorage();
          console.log('[App] Base64 migration result:', base64Result);

          // Mark base64 migration as complete
          localStorage.setItem(base64MigrationKey, 'completed');

          if (base64Result.uploaded > 0) {
            console.log(`[App] Successfully uploaded ${base64Result.uploaded} base64 images to Storage`);
          }
        } else {
          console.log('[App] Base64 migration already completed for this user');
        }

        // Step 2: Migrate IndexedDB to Firestore (run after base64 migration)
        if (!hasRunFirestoreMigration) {
          console.log('[App] Running one-time Firestore migration...');
          const firestoreResult = await migrateIndexedDBToFirestore();
          console.log('[App] Firestore migration result:', firestoreResult);

          // Mark Firestore migration as complete
          localStorage.setItem(firestoreMigrationKey, 'completed');

          if (firestoreResult.migrated > 0) {
            console.log(`[App] Successfully migrated ${firestoreResult.migrated} projects to Firestore`);
          }
        } else {
          console.log('[App] Firestore migration already completed for this user');
        }
      } catch (error) {
        console.error('[App] Migration failed:', error);
        // Don't mark as complete so it can be retried
      }
    };

    runFirestoreMigration();
  }, [currentUser]);

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

            // Combine user models with pre-defined models and deduplicate
            const allModels = deduplicateModels([
              ...galleryModels.reverse(), // User models first, newest first
              ...predefinedModels, // Then pre-defined models
            ]);
            setModelGallery(allModels);
          } catch (error) {
            console.error('Failed to load pre-defined models:', error);
            // Fallback to just user models with deduplication
            setModelGallery(deduplicateModels(galleryModels.reverse()));
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
    // Remove the model from the gallery
    setModelGallery(prevGallery => prevGallery.filter(m => m.id !== modelToDelete.id));
    console.log('[App] Model deleted from gallery:', modelToDelete.id);
  }, []);

  const handleModelAdded = useCallback((model: Model) => {
    // Add the new model to the gallery immediately, checking for duplicates
    setModelGallery(prevGallery => {
      const exists = prevGallery.some(m => m.id === model.id);
      if (exists) {
        console.log('[App] Model already in gallery, skipping duplicate:', model.id);
        return prevGallery;
      }
      return [model, ...prevGallery];
    });
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

    // Add base model to gallery only if it doesn't already exist (prevent duplicates)
    // Use baseModelId to ensure only base models appear in "Your Models", not revisions
    setModelGallery(prevGallery => {
      const existingModel = prevGallery.find(
        model => model.historyItemId === stylingModelData.baseModelId &&
          model.projectId === currentProjectId
      );

      // If base model already exists in gallery, don't add duplicate
      if (existingModel) {
        return prevGallery;
      }

      // Only add base model to gallery (not revisions)
      const newModel: Model = {
        id: `${currentProjectId}-${stylingModelData.baseModelId}`,
        url: stylingModelData.url,
        source: 'user',
        projectId: currentProjectId || undefined,
        historyItemId: stylingModelData.baseModelId,
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
    if (mode === 'create') {
      setIsCreateProjectModalOpen(true);
    }
  }, []);

  const handleCreateProject = useCallback(async (projectName: string) => {
    const newProject: Project = {
      id: `project-${Date.now()}`,
      title: projectName,
      description: '',
      organization: '',
      clientDetails: { name: '', email: '', phone: '', location: '' },
      createdAt: new Date().toISOString(),
      deadline: '',
      tags: [],
      status: 'Draft',
    };

    try {
      await saveProjectMetadata(newProject);
      setProjectList(prev => [...prev, newProject]);
      setCurrentProjectId(newProject.id);
      setIsCreateProjectModalOpen(false);
      setIsCollectionsModalOpen(true);
    } catch (e) {
      console.error("Failed to create project", e);
    }
  }, []);

  const handleUseTemplate = useCallback((template: PredefinedModel) => {
    // For now, we'll just load the template as a base model in the new project
    // In the future, this could load a full project template
    console.log("Using template:", template);

    // Add to gallery as a new model
    const newModel: Model = {
      id: `${currentProjectId}-${template.id}`,
      url: template.url,
      source: 'user',
      projectId: currentProjectId || undefined,
      historyItemId: template.id, // Using template ID as history ID for now
    };

    setModelGallery(prev => [newModel, ...prev]);
    setActiveModelUrl(newModel.url);
    setActiveView('imageStudio');
  }, [currentProjectId]);

  const handleNavigateToCollections = useCallback(() => {
    setActiveView('templates');
  }, []);



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
    <SyncProvider>
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
              onModelDeleted={handleDeleteModel}
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
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onCreate={handleCreateProject}
        />

        <CollectionsModal
          isOpen={isCollectionsModalOpen}
          onClose={() => setIsCollectionsModalOpen(false)}
          onUseTemplate={handleUseTemplate}
          onNavigateToCollections={handleNavigateToCollections}
        />

        {/* Real-time Sync Listener (invisible component) */}
        <ProjectSyncListener projectId={currentProjectId} currentUser={currentUser} />

        {/* Sync Conflict Resolution Modal */}
        <ConflictResolutionModal />
      </div>
    </SyncProvider>
  );
};

export default App;