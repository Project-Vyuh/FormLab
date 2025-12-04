/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Header from './components/Header';
import CreateModel, { initialGenerationSettings } from './components/CreateModel';
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
import { Model, Project, Notification, User, SelectedStylingModel, HistoryItem } from './types';
import { getAllProjectMetadata as dbGetAllProjectMetadata, loadProjectState, saveProjectMetadata, saveProjectState, cleanupBlobUrls, saveStylingHistory, migrateHistoryItemTypes, migrateBase64ImagesToStorage, migrateIndexedDBToFirestore, setCurrentUserId, deleteProjectState, deleteProjectMetadata, forceImmediateSync } from './services/dbService';
import { onAuthStateChanged, signOutUser } from './services/authService';
import { getUserDocument, updateLastLogin, createUserDocument } from './services/userService';
import { loadPredefinedModels, PredefinedModel, getGlobalModels, subscribeToGlobalModels } from './services/firestoreService';
import { loadAllUserProjectsFromFirestore, loadProjectFromFirestore, deleteProjectFromFirestore } from './services/firestoreSync';
import { deleteFolderContents } from './services/storageService';
import { auth } from './services/firebase';
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
  const [projectUpdateTrigger, setProjectUpdateTrigger] = useState(0); // Trigger for CreateModel to reload

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
        // Step 1: Load from IndexedDB first (instant)
        let projects = await dbGetAllProjectMetadata();
        console.log(`[App] Loaded ${projects.length} projects from IndexedDB`);

        // Step 2: ALWAYS load from Firestore to ensure sync across devices
        console.log('[App] Checking Firestore for project updates...');
        try {
          const firestoreProjects = await loadAllUserProjectsFromFirestore(currentUser.uid);
          console.log(`[App] Loaded ${firestoreProjects.length} projects from Firestore`);

          if (firestoreProjects.length > 0) {
            // Merge strategy: Firestore is the source of truth for existence.
            // 1. Save all Firestore projects to IndexedDB (updating existing ones)
            for (const project of firestoreProjects) {
              await saveProjectMetadata(project);
            }

            // 2. Update local projects list to reflect Firestore data
            projects = await dbGetAllProjectMetadata();
          }
        } catch (err) {
          console.error("[App] Failed to sync projects from Firestore:", err);
          // Fallback to local projects if offline
        }

        // Step 3: If still no projects (new user), create default
        if (projects.length === 0) {
          console.log('[App] No projects found, creating default...');
          const defaultProject: Project = {
            id: `project-${Date.now()}`,
            title: 'My First Project',
            description: 'Welcome to your first project!',
            organization: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: [],
            status: 'In Progress',
          };
          await saveProjectMetadata(defaultProject);
          projects = [defaultProject];
        }

        setProjectList(projects); // Set global project list state

        // Auto-select most recent project
        if (projects.length > 0) {
          // Sort by updatedAt desc
          const sorted = [...projects].sort((a, b) => {
            const dateA = new Date(a.updatedAt || 0).getTime();
            const dateB = new Date(b.updatedAt || 0).getTime();
            return dateB - dateA;
          });

          setCurrentProjectId(sorted[0].id);
        } else {
          setNeedsOnboarding(true);
        }

        // Determine projectIdToLoad based on the newly set currentProjectId
        const projectIdToLoad = currentProjectId || (projects.length > 0 ? projects[0].id : null);

        if (projectIdToLoad) {
          setNeedsOnboarding(false);

          // Load pre-defined models first (these don't change)
          try {
            const predefinedModels = await loadPredefinedModels();
            console.log(`Loaded ${predefinedModels.length} pre-defined models`);

            // Set initial model gallery with just pre-defined models
            setModelGallery(predefinedModels);

            // Subscribe to real-time updates for global models (Enterprise Sync)
            if (currentUser) {
              console.log('[App] Subscribing to global models for user:', currentUser.uid, 'project:', projectIdToLoad);

              const unsubscribe = subscribeToGlobalModels(currentUser.uid, projectIdToLoad, (globalModels) => {
                console.log(`[App] Received ${globalModels.length} global models from Firestore`);

                // Convert GlobalModel to Model type
                const galleryModels: Model[] = globalModels.map(gm => ({
                  id: gm.id,
                  url: gm.url,
                  name: gm.name,
                  source: 'user',
                  projectId: gm.projectId,
                  historyItemId: gm.historyItemId,
                  createdAt: new Date(gm.createdAt).getTime(),
                  updatedAt: new Date(gm.updatedAt).getTime(),
                  sourceTemplateId: gm.sourceTemplateId,
                }));

                // Combine user models with pre-defined models and deduplicate
                const allModels = deduplicateModels([
                  ...galleryModels.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), // User models first, newest first
                  ...predefinedModels, // Then pre-defined models
                ]);

                console.log(`[App] Updated model gallery with ${allModels.length} total models`);
                setModelGallery(allModels);
              });

              // Store unsubscribe function to clean up later
              return () => {
                console.log('[App] Unsubscribing from global models');
                unsubscribe();
              };
            }
          } catch (error) {
            console.error('Failed to load pre-defined models:', error);
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

  const handleModelUpdated = useCallback((modelId: string) => {
    // Update the model's updatedAt timestamp
    setModelGallery(prevGallery => {
      return prevGallery.map(m => {
        if (m.id === modelId) {
          return { ...m, updatedAt: Date.now() };
        }
        return m;
      });
    });
  }, []);

  const handleRenameModel = useCallback((modelId: string, newName: string) => {
    // Update the model's name in the gallery
    setModelGallery(prevGallery => {
      return prevGallery.map(m => {
        if (m.id === modelId) {
          return { ...m, name: newName };
        }
        return m;
      });
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
      const timestamp = Date.now();
      const newModel: Model = {
        id: `${currentProjectId}-${stylingModelData.baseModelId}`,
        url: stylingModelData.url,
        source: 'user',
        projectId: currentProjectId || undefined,
        historyItemId: stylingModelData.baseModelId,
        createdAt: timestamp,
        updatedAt: timestamp,
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
    setIsCollectionsModalOpen(true);
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

    // Reload global models for the new project
    if (currentUser) {
      try {
        const globalModels = await getGlobalModels(currentUser.uid, id);
        const galleryModels: Model[] = globalModels.map(gm => ({
          id: gm.id,
          url: gm.url,
          name: gm.name,
          source: 'user',
          projectId: gm.projectId,
          historyItemId: gm.historyItemId,
          createdAt: new Date(gm.createdAt).getTime(),
          updatedAt: new Date(gm.updatedAt).getTime(),
          sourceTemplateId: gm.sourceTemplateId,
        }));

        // Load pre-defined models
        const predefinedModels = await loadPredefinedModels();

        // Combine and deduplicate
        const allModels = deduplicateModels([
          ...galleryModels.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
          ...predefinedModels,
        ]);
        setModelGallery(allModels);
        console.log(`Loaded ${galleryModels.length} global models for project ${id}`);
      } catch (error) {
        console.error('Failed to load global models for new project:', error);
      }
    }
  }, [activeView, selectedStylingModel, currentProjectId, currentUser]);

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
      // Save metadata to IndexedDB
      await saveProjectMetadata(newProject);

      // Create initial project state
      const initialState = {
        id: newProject.id,
        generatedModelHistory: [],
        wardrobe: [],
        generationSettings: initialGenerationSettings
      };
      await saveProjectState(newProject.id, initialState);

      // Force immediate Firestore sync to prevent data loss
      try {
        await forceImmediateSync(newProject.id, initialState);
        console.log('[App] Project synced immediately to Firestore');
      } catch (syncError) {
        console.warn('[App] Immediate sync failed, will retry with debounce:', syncError);
        // Don't block UI - debounced sync will retry
      }

      setProjectList(prev => [...prev, newProject]);
      setCurrentProjectId(newProject.id);
      setIsCreateProjectModalOpen(false);
      setIsCollectionsModalOpen(true);
    } catch (e) {
      console.error("Failed to create project", e);
    }
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    try {
      console.log('[App] Starting project deletion:', projectId);

      // Get current user for storage paths
      const currentUser = auth.currentUser;
      const userId = currentUser?.uid;

      // 1. Delete from Firebase Storage (all project files)
      if (userId) {
        try {
          // Delete all files in the project's model folder
          await deleteFolderContents(`users/${userId}/models/${projectId}`);
          console.log('[App] Deleted project storage files');
        } catch (storageError) {
          console.warn('[App] Failed to delete some storage files:', storageError);
          // Continue with other deletions
        }

        // 2. Delete from Firestore
        try {
          await deleteProjectFromFirestore(projectId, userId);
          console.log('[App] Deleted project from Firestore');
        } catch (firestoreError) {
          console.warn('[App] Failed to delete from Firestore:', firestoreError);
          // Continue with other deletions
        }
      } else {
        console.warn('[App] No user logged in, skipping Firebase deletion');
      }

      // 3. Delete from IndexedDB (always do this, even if Firebase fails)
      await deleteProjectState(projectId);
      await deleteProjectMetadata(projectId);
      console.log('[App] Deleted from IndexedDB');

      // 4. Update UI state
      setProjectList(prev => {
        const newList = prev.filter(p => p.id !== projectId);
        if (newList.length === 0) {
          setNeedsOnboarding(true);
        }
        return newList;
      });

      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
      }

      console.log('[App] Project deletion completed:', projectId);
    } catch (e) {
      console.error("[App] Failed to delete project:", e);
      // Show error to user
      alert("Failed to delete project. Some files may remain. Please try again.");
    }
  }, [currentProjectId]);

  const handleUseTemplate = useCallback(async (template: PredefinedModel) => {
    if (!currentProjectId) return;

    try {
      // 1. Load current project state
      const projectState = await loadProjectState(currentProjectId) || {};
      const currentHistory = projectState.generatedModelHistory || [];

      // 2. Check if already saved (optional, but good for avoiding duplicates)
      // For now, we'll allow duplicates as "copies" like CreateModel does

      // 3. Create new HistoryItem
      const newHistoryItemId = `rev-${Date.now()}`;
      const newHistoryItem: HistoryItem = {
        id: newHistoryItemId,
        parentId: null, // Base model
        imageUrl: template.url,
        prompt: `Saved from template: ${template.name || template.id}`,
        settings: initialGenerationSettings, // Use default settings
        modelName: 'Nano Banana', // Default model
        name: `${template.name || 'Template'} - Copy`,
        isStarred: true,
        type: 'model-generation',
        baseModelId: newHistoryItemId,
      };

      // 4. Update Project State
      const updatedHistory = [...currentHistory, newHistoryItem];
      const updatedState = {
        ...projectState,
        generatedModelHistory: updatedHistory,
        // We don't set currentHistoryItemId here in DB necessarily, 
        // but we want CreateModel to load it.
      };

      await saveProjectState(currentProjectId, updatedState);

      // 5. Update Gallery (App state)
      const timestamp = Date.now();
      const newModel: Model = {
        id: `${currentProjectId}-${newHistoryItemId}`,
        url: template.url,
        source: 'user',
        projectId: currentProjectId,
        historyItemId: newHistoryItemId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setModelGallery(prev => [newModel, ...prev]);

      // 6. Select and Navigate
      // Set the selected history item ID so CreateModel loads it
      setSelectedHistoryItemId(newHistoryItemId);

      // Trigger reload in CreateModel
      setProjectUpdateTrigger(prev => prev + 1);

      // Switch view
      setActiveView('createModel');

    } catch (error) {
      console.error("Failed to use template:", error);
    }
  }, [currentProjectId]);

  const handleNavigateToCollections = useCallback(() => {
    setActiveView('templates');
  }, []);

  const handleStartBlankCanvas = useCallback(() => {
    setIsCollectionsModalOpen(false);
    setActiveView('createModel');
    setSelectedHistoryItemId(null);
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



  return (
    <SyncProvider>
      <div className="font-sans flex flex-col h-screen bg-[#1a1a1a]">
        <Header
          activeView={activeView}
          onNavigate={handleNavigate}
          notifications={notifications}
          currentUser={currentUser}
          onLogout={handleLogout}
          hasProjects={projectList.length > 0}
        />
        <div className="flex-grow min-h-0 relative">
          {needsOnboarding ? (
            <div className="absolute inset-0 z-10 bg-[#1a1a1a]">
              <ProjectOnboarding onProjectCreated={handleFirstProjectCreated} />
            </div>
          ) : (
            <>
              <div className={`${activeView === 'createModel' ? 'block' : 'hidden'} absolute inset-0 bg-[#1a1a1a]`}>
                <CreateModel
                  onModelFinalized={handleModelCreated}
                  onSaveModelInstance={handleSaveModel}
                  projectList={projectList}
                  currentProjectId={currentProjectId}
                  onProjectChange={handleProjectChange}
                  onOpenProjectModal={handleOpenProjectModal}
                  currentUser={currentUser}
                  modelGallery={modelGallery}
                  onSelectModel={handleSelectModelFromGallery}
                  onModelAdded={handleModelAdded}
                  onModelUpdated={handleModelUpdated}
                  onModelDeleted={handleDeleteModel}
                  onRenameModel={handleRenameModel}
                  selectedHistoryItemId={selectedHistoryItemId}
                  onHistoryItemLoaded={() => setSelectedHistoryItemId(null)}
                  onOpenCollectionsModal={() => setIsCollectionsModalOpen(true)}
                  lastExternalUpdate={projectUpdateTrigger}
                  onDeleteProject={handleDeleteProject}
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
            </>
          )}
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
          onStartBlankCanvas={handleStartBlankCanvas}
          currentUser={currentUser}
          projects={projectList}
          currentProjectId={currentProjectId}
          showUserContent={false}
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