/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
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
import { Model, Project, Notification, User } from './types';
import { getAllProjectMetadata as dbGetAllProjectMetadata, loadProjectState, saveProjectMetadata } from './services/dbService';
import { onAuthStateChanged, signOutUser } from './services/authService';
import { getUserDocument, updateLastLogin, createUserDocument } from './services/userService';


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

          // Load latest model from each project into the gallery
          const galleryModels: Model[] = [];
          for (const project of projects) {
            try {
              const state = await loadProjectState(project.id);
              if (state?.generatedModelHistory?.length > 0) {
                // Get the very last image generated in that project
                const lastHistoryItem = state.generatedModelHistory[state.generatedModelHistory.length - 1];
                galleryModels.push({
                  id: `${project.id}-${lastHistoryItem.imageUrl.slice(-10)}`, // Make ID more unique
                  url: lastHistoryItem.imageUrl,
                });
              }
            } catch (e) {
              console.error(`Failed to load state for project ${project.id}`, e);
            }
          }
          setModelGallery(galleryModels.reverse()); // Show newest first
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

  const handleNavigate = useCallback((view: View) => {
    // If navigating to Image Studio and no model is active, but models exist,
    // select the first one to avoid showing an unnecessary empty state.
    if (view === 'imageStudio' && !activeModelUrl && modelGallery.length > 0) {
      setActiveModelUrl(modelGallery[0].url);
    }
    setActiveView(view);
  }, [activeModelUrl, modelGallery]);

  const handleSaveModel = useCallback(async (modelUrl: string) => {
    // This logic is now mostly deprecated in favor of project-based saves,
    // but kept for compatibility with ImageStudio's "Upload New Model" which doesn't have project context yet.
    console.log("Legacy save model called:", modelUrl);
  }, []);

  const handleDeleteModel = useCallback(async (modelToDelete: Model) => {
    // This logic is now mostly deprecated.
    console.log("Legacy delete model called:", modelToDelete);
  }, []);

  const handleModelCreated = useCallback(async (modelUrl: string, projectId: string) => {
    // Add/update the model in the gallery for ImageStudio
    setModelGallery(prevGallery => {
      const newModel: Model = { id: `${projectId}-${Date.now()}`, url: modelUrl };
      // Remove any old model from the same project to avoid duplicates in the gallery
      const filteredGallery = prevGallery.filter(m => !m.id.startsWith(projectId));
      return [newModel, ...filteredGallery];
    });

    // Set it as the active model for immediate use
    setActiveModelUrl(modelUrl);

    // Navigate to Image Studio
    setActiveView('imageStudio');
  }, []);

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



  const handleProjectChange = useCallback((id: string) => {
    setCurrentProjectId(id);
    localStorage.setItem('formlab-lastProject', id);
  }, []);

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
          />
        </div>
        <div className={`${activeView === 'imageStudio' ? 'block' : 'hidden'} absolute inset-0`}>
          <ImageStudio
            initialModelUrl={activeModelUrl}
            modelGallery={modelGallery}
            onSelectModel={setActiveModelUrl}
            onDeleteModel={handleDeleteModel}
            onUploadNewModel={handleSaveModel}
            onNavigateToVideoCreator={handleUseAsVideoReference}
            onNavigateToCreateModel={() => handleNavigate('createModel')}
            projectList={projectList}
            currentProjectId={currentProjectId}
            onProjectChange={handleProjectChange}
            onOpenProjectModal={handleOpenProjectModal}
            currentUser={currentUser}
            onCategoriesChange={setWardrobeCategories}
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
          <Templates wardrobeCategories={wardrobeCategories} />
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