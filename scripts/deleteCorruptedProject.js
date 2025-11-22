/**
 * One-time script to delete corrupted project document
 * Run with: node scripts/deleteCorruptedProject.js
 *
 * This script uses Firebase Admin SDK to bypass security rules
 * and delete a document that can't be accessed via normal means.
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// Note: Running locally will use Application Default Credentials
admin.initializeApp({
  projectId: 'formlab-42fae'
});

const db = admin.firestore();

async function deleteCorruptedProject() {
  const projectId = 'project-1763812276984';
  const docRef = db.collection('projects').doc(projectId);

  try {
    console.log(`Attempting to read document: ${projectId}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('Document does not exist. No action needed.');
      return;
    }

    console.log('Document exists. Current data:', doc.data());
    console.log('\nDeleting document...');

    await docRef.delete();
    console.log('✓ Document deleted successfully!');
    console.log('\nYou can now refresh your app and the sync should work.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nIf you see a permissions error, you may need to:');
    console.error('1. Install firebase-admin: npm install firebase-admin');
    console.error('2. Authenticate: firebase login');
    console.error('3. Or delete via Firebase Console instead');
  } finally {
    // Exit the script
    process.exit(0);
  }
}

// Run the function
deleteCorruptedProject();
