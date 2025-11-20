# FormLab Deployment Guide

## Phase 1: Security Rules (COMPLETED ✅)

### Files Created:
- ✅ `firestore.rules` - Firestore database security rules
- ✅ `storage.rules` - Firebase Storage security rules

### Deployment Steps:

1. **Deploy Firestore Rules:**
```bash
firebase deploy --only firestore:rules
```

2. **Deploy Storage Rules:**
```bash
firebase deploy --only storage
```

3. **Verify in Firebase Console:**
   - Navigate to Firestore Database → Rules
   - Navigate to Storage → Rules
   - Ensure rules are active and no errors

## Phase 2: Unified History System (PARTIALLY COMPLETED ⚠️)

### Completed:
- ✅ Updated `types.ts` - Added `'try-on-revision'` type, made `type` and `baseModelId` required fields
- ✅ Updated `services/dbService.ts` - Added `loadUnifiedHistory()` function
- ✅ Updated `services/dbService.ts` - Enhanced `saveStylingHistory()` to handle unified history
- ✅ Updated `components/ImageStudio.tsx` - Uses `loadUnifiedHistory()` on initialization
- ✅ Updated `components/ImageStudio.tsx` - Removed type filter from auto-save
- ✅ Updated `components/ImageStudio.tsx` - Added `type` and `baseModelId` to all new history items

###Remaining Tasks:

1. **Update CreateModel.tsx to add types to history items:**
   - Find where base models are generated → Add `type: 'model-generation'`
   - Find where revisions are generated → Add `type: 'model-revision'`
   - Ensure all history items have `baseModelId` field

2. **Update VersionHistoryPanel.tsx for visual differentiation:**
   - Add different icons for each type:
     - `model-generation`: User/Person icon
     - `model-revision`: Wand/Edit icon
     - `try-on`: Wardrobe/Shirt icon
     - `try-on-revision`: Pen/Revision icon
   - Add color coding or badges
   - Add filter/group by type functionality

3. **Run migration for existing data:**
   - The migration function already exists in `dbService.ts` (`migrateHistoryItemTypes`)
   - Call it on app initialization to add types to existing history items
   - Add check to prevent re-running migration

## Phase 3: Firestore Sync (NOT STARTED ⏸️)

### Files to Create:

1. **`services/firestoreSync.ts`** - Firestore synchronization service
2. **`components/SyncStatusIndicator.tsx`** - UI component for sync status
3. **`components/ConflictResolutionModal.tsx`** - UI for handling sync conflicts

### Key Functions Needed:

```typescript
// services/firestoreSync.ts
export const syncProjectToFirestore(projectId, state): Promise<void>
export const loadProjectFromFirestore(projectId): Promise<any>
export const mergeProjectStates(local, remote): any
export const detectConflicts(local, remote): Conflict[]
```

### Integration Points:

1. Update `dbService.ts`:
   - Call Firestore sync in `saveProjectState()`
   - Check Firestore in `loadProjectState()` if not in IndexedDB

2. Update main App component:
   - Add `<SyncStatusIndicator />` to header
   - Initialize Firestore sync on app load

3. Add real-time listeners:
   - Listen to project changes in Firestore
   - Update local state when remote changes detected

## Testing Checklist

### Manual Test Scenarios:

#### Test 1: History Continuity
1. ✅ Create a base model in Create Model
2. ✅ Make some revisions
3. ✅ Click "Proceed to Styling"
4. ✅ Make some try-ons in Image Studio
5. ✅ Go back to Create Model
6. ✅ Select a different model
7. ✅ Go back and re-select original model
8. ✅ Click "Proceed to Styling"
9. **VERIFY:** Should see complete history (base model + revisions + try-ons)
10. **VERIFY:** Should restore to the selected revision

#### Test 2: Type Differentiation
1. Check that all history items have `type` field
2. Check that Create Model items have `model-generation` or `model-revision`
3. Check that Image Studio items have `try-on` or `try-on-revision`
4. Verify Version History Panel shows different icons/colors per type

#### Test 3: Security
1. Try to access Firestore data without authentication → Should be denied
2. Try to access another user's project → Should be denied
3. Try to upload file larger than 50MB → Should be denied
4. Try to upload non-image/video file → Should be denied

#### Test 4: Migration
1. Load app with old data (no `type` field)
2. Verify migration runs automatically
3. Verify all history items now have `type` and `baseModelId`
4. Verify migration doesn't run again on next load

## Rollback Plan

If issues arise:

1. **Security Rules:**
   - Can revert via Firebase Console
   - Previous rules saved in console history

2. **Code Changes:**
   ```bash
   git revert <commit-hash>
   ```

3. **Data Migration:**
   - Migration creates backup before changes
   - Can restore from IndexedDB backup if needed

## Performance Considerations

1. **IndexedDB remains primary storage** - No latency added
2. **Firestore sync is background** - Debounced 2 seconds
3. **Unified history** - Slight overhead in merge/split logic
4. **Security rules** - May add ~10-50ms to Firestore operations

## Cost Implications

### Current (Before Sync):
- Storage: Firebase Storage only (images/videos)
- Reads: Minimal (only predefined content)
- Writes: Minimal (only usage tracking)

### After Full Implementation:
- Storage: + Firestore for project data (~1-10KB per project)
- Reads: + 1 read per project load (if not in IndexedDB)
- Writes: + 1 write per save (every 2-5 seconds while editing)
- Listeners: + 1 real-time listener per active project

### Estimated Monthly Cost (100 active users):
- Storage: <$1/month
- Reads: ~$0.10/month
- Writes: ~$0.50/month
- **Total: <$2/month** (well within free tier limits)

## Next Steps

1. **CRITICAL:** Deploy security rules immediately
2. **HIGH:** Complete CreateModel type updates
3. **HIGH:** Add visual differentiation to Version History Panel
4. **MEDIUM:** Implement Firestore sync service
5. **MEDIUM:** Add sync UI components
6. **LOW:** Add collaboration features

## Support

For issues or questions:
- Check Firebase Console for rule errors
- Check browser console for JavaScript errors
- Verify IndexedDB data structure in DevTools → Application → IndexedDB

---

*Last Updated: 2025-11-20*
*Version: 1.0.0*
