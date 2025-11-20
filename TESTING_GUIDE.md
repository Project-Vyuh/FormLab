# FormLab Unified History - Testing Guide

## Pre-Testing Checklist

### ✅ Verify Deployment
- [x] Firestore security rules deployed
- [x] Storage security rules deployed
- [ ] App running locally without errors
- [ ] No TypeScript compilation errors
- [ ] Browser console clear of errors

### 🔧 Setup
```bash
# Start the development server
npm run dev

# Open browser
# Navigate to http://localhost:5173 (or your dev server URL)
```

---

## Test Suite

### Test 1: Migration of Existing Data ⏱️ 5 min

**Objective:** Verify that existing history items get proper types assigned.

**Steps:**
1. If you have existing projects with history:
   - Open the app
   - Check browser console for migration message
   - Look for: `"Migrated X history items to include type field"`

2. Open Create Model
3. Select an existing model from "Your Models" gallery
4. Check Version History Panel (bottom of screen)

**Expected Results:**
- ✅ All history items have type badges (colored icons)
- ✅ Base models (first in tree) have blue badges
- ✅ Other items have purple badges (default to revision)
- ✅ Console shows successful migration

**If Failed:**
- Check browser console for errors
- Verify `migrateHistoryItemTypes()` is called in App.tsx
- Check IndexedDB: DevTools → Application → IndexedDB → FormLabProjectsDB

---

### Test 2: Create New Model with Types ⏱️ 5 min

**Objective:** Verify new models get proper types assigned.

**Steps:**
1. Go to Create Model view
2. Create a new base model:
   - Click "Create Model"
   - Enter prompt: "Professional fashion model in studio"
   - Click "Generate"
   - Wait for generation

3. Check Version History Panel
4. Verify the first item has:
   - Blue badge (🟦)
   - User icon
   - Tooltip says "Base Model"

5. Make a revision:
   - Enter revision prompt: "Change hair to blonde"
   - Click "Apply Changes"

6. Check Version History Panel

**Expected Results:**
- ✅ Base model: Blue badge + User icon + "Base Model" label
- ✅ Revision: Purple badge + Wand icon + "Model Revision" label
- ✅ Both items visible in history
- ✅ Tree structure shows revision as child of base

**If Failed:**
- Check browser console for errors
- Verify `addHistoryItem()` in CreateModel.tsx has type logic
- Check that HistoryItemType is imported

---

### Test 3: Unified History in Image Studio ⏱️ 10 min

**Objective:** Verify Create Model and Image Studio histories are merged.

**Setup:**
1. Create a new base model in Create Model
2. Make 2 revisions (rev1, rev2)
3. Note the names/prompts for identification

**Steps:**
1. With rev2 selected, click "Proceed to Styling"
2. Image Studio should open
3. Check Version History Panel at bottom

**Expected Results - Initial Load:**
- ✅ Shows ALL history: base + rev1 + rev2
- ✅ Base model has blue badge
- ✅ Revisions have purple badges
- ✅ Current item is rev2 (the one selected in Create Model)
- ✅ Timeline is chronological (left to right or top to bottom)

**Steps - Add Try-Ons:**
4. In Image Studio:
   - Click "Wardrobe" section in left sidebar
   - Select a clothing item
   - Click to add to outfit stack
   - Click "Generate" button

5. Wait for try-on to complete
6. Check Version History Panel

**Expected Results - After Try-On:**
- ✅ New item appears in history with green badge (🟢)
- ✅ Shirt icon visible
- ✅ Tooltip says "Try-On"
- ✅ Connected to the base/revision it was applied to

**Steps - Add Try-On Revision:**
7. In "Create Model Revision" section (left sidebar):
   - Enter prompt: "Change background to white studio"
   - Click "Apply Revision"

8. Check Version History Panel

**Expected Results - After Try-On Revision:**
- ✅ New item with amber/orange badge (🟠)
- ✅ Pen icon visible
- ✅ Tooltip says "Try-On Revision"
- ✅ Connected as child of previous try-on

**If Failed:**
- Check `loadUnifiedHistory()` is being called in ImageStudio.tsx
- Verify console for errors
- Check IndexedDB to see if both histories exist

---

### Test 4: History Persistence Across Model Switches ⏱️ 10 min

**Objective:** THE CRITICAL TEST - Verify history is NOT lost when switching models.

**Setup:**
1. Have Model A with some try-ons in Image Studio
2. Note the number of try-ons and their images

**Steps:**
1. From Image Studio, click "Create Model" in header
2. You're now back in Create Model view
3. Create or select a DIFFERENT model (Model B)
4. Click "Proceed to Styling"
5. Image Studio loads with Model B
6. Verify it shows Model B's history (should be empty or different)

**Critical Step - Return to Model A:**
7. Click "Change Model" button in Image Studio left sidebar
8. You're back in Create Model view
9. From "Your Models" gallery, click Model A (the original)
10. Click "Proceed to Styling"

**Expected Results:**
- ✅ All previous try-ons for Model A are VISIBLE
- ✅ Version History Panel shows complete timeline:
  - Base model (blue)
  - Revisions (purple)
  - Try-ons (green)
  - Try-on revisions (amber)
- ✅ Can click on any history item to view it
- ✅ NO HISTORY LOST
- ✅ Images and prompts match what you created earlier

**This is Success Criteria for the Fix!**

**If Failed:**
- **CRITICAL BUG** - History is still being lost
- Check `loadUnifiedHistory()` implementation
- Verify `baseModelId` is consistent across histories
- Check IndexedDB: `stylingHistory[baseModelId]` should contain try-ons
- Verify `saveStylingHistory()` is saving properly

---

### Test 5: Visual Differentiation ⏱️ 5 min

**Objective:** Verify type badges are clear and helpful.

**Setup:**
1. Have a model with all 4 types:
   - Model Generation (blue)
   - Model Revision (purple)
   - Try-On (green)
   - Try-On Revision (amber)

**Steps - Collapsed View:**
1. In Version History Panel, click the collapse button (top-left)
2. Panel should shrink to ~96px height
3. History items appear in horizontal row

**Expected Results:**
- ✅ Small thumbnails visible
- ✅ Type badge in top-left corner of each thumbnail
- ✅ Icons visible and distinct
- ✅ Can differentiate types at a glance
- ✅ Star icon (if starred) in bottom-right

**Steps - Expanded View:**
4. Click expand button to restore panel height
5. History items appear in tree/graph layout

**Expected Results:**
- ✅ Larger thumbnails (96x96px)
- ✅ Type badge in top-left with icon
- ✅ Colors clearly visible:
  - Blue for base models
  - Purple for revisions
  - Green for try-ons
  - Amber for try-on revisions
- ✅ Star button in top-right (shows on hover)
- ✅ Tooltips show type label on hover
- ✅ Tree lines connect parent → child

**Steps - Tooltips:**
6. Hover over each history item

**Expected Results:**
- ✅ Tooltip appears with format: "[Type Label]: [Name or Prompt]"
- ✅ Examples:
  - "Base Model: Professional fashion model"
  - "Model Revision: Change hair to blonde"
  - "Try-On: Applied Blue Dress, White Shoes"
  - "Try-On Revision: Change background to white"

**If Failed:**
- Check `getTypeInfo()` function in VersionHistoryPanel.tsx
- Verify icons are imported correctly
- Check Tailwind classes for colors

---

### Test 6: Specific Revision Selection ⏱️ 5 min

**Objective:** Verify exact revision is restored when selected in Create Model.

**Setup:**
1. Create base model
2. Make 3 revisions: rev1, rev2, rev3
3. Each with distinct prompt/image

**Steps:**
1. In Create Model, select rev2 in Version History Panel
2. Verify rev2 is the current/active item (blue border)
3. Click "Proceed to Styling"
4. Image Studio opens

**Expected Results:**
- ✅ Current displayed image is rev2
- ✅ Version History Panel shows rev2 as selected (blue border)
- ✅ Can navigate to rev1 or rev3 in history
- ✅ Settings reflect rev2's generation settings

**Steps - Different Selection:**
5. Go back to Create Model
6. Select rev1 this time
7. Click "Proceed to Styling"

**Expected Results:**
- ✅ Image Studio shows rev1 as current
- ✅ Different image from previous test
- ✅ Correct item highlighted in history

**If Failed:**
- Check `selectedStylingModel.historyItemId` is set correctly in CreateModel
- Verify ImageStudio initialization finds the item by ID
- Check console for "selectedItem" logs

---

### Test 7: Data Integrity ⏱️ 5 min

**Objective:** Verify data is correctly saved and split.

**Steps:**
1. Create complete workflow:
   - Base model
   - 2 revisions
   - Proceed to styling
   - 2 try-ons
   - 1 try-on revision

2. Open Browser DevTools
3. Navigate to: Application → Storage → IndexedDB → FormLabProjectsDB → modelProjects
4. Find your project entry
5. Click to view JSON

**Expected Data Structure:**
```json
{
  "id": "project-123",
  "generatedModelHistory": [
    {
      "id": "rev-xxx",
      "type": "model-generation",
      "baseModelId": "rev-xxx",
      "parentId": null,
      ...
    },
    {
      "id": "rev-yyy",
      "type": "model-revision",
      "baseModelId": "rev-xxx",
      "parentId": "rev-xxx",
      ...
    }
  ],
  "stylingHistory": {
    "rev-xxx": [
      {
        "id": "hist-aaa",
        "type": "try-on",
        "baseModelId": "rev-xxx",
        ...
      },
      {
        "id": "hist-bbb",
        "type": "try-on-revision",
        "baseModelId": "rev-xxx",
        ...
      }
    ]
  }
}
```

**Expected Results:**
- ✅ `generatedModelHistory` contains only model-generation and model-revision types
- ✅ `stylingHistory[baseModelId]` contains only try-on and try-on-revision types
- ✅ All items have `type` field
- ✅ All items have `baseModelId` field
- ✅ baseModelId is consistent within a model tree
- ✅ Try-on items reference correct baseModelId

**If Failed:**
- Check `saveStylingHistory()` split logic
- Verify types are set correctly when creating items
- Check migration ran successfully

---

## Performance Testing

### Test 8: Large History Performance ⏱️ 10 min

**Objective:** Verify system handles large histories well.

**Steps:**
1. Create a model
2. Make 20-30 revisions/try-ons (or use existing project)
3. Navigate between Create Model and Image Studio
4. Switch to different model and back

**Expected Results:**
- ✅ Load time < 2 seconds for unified history
- ✅ UI remains responsive
- ✅ Version History Panel renders without lag
- ✅ Scrolling is smooth
- ✅ No memory leaks (check DevTools → Memory)

**If Performance Issues:**
- Consider adding pagination to Version History Panel
- Implement virtual scrolling for large lists
- Add indexing to history lookup

---

## Edge Cases

### Test 9: Empty History
- Create new project
- Click "Proceed to Styling" without generating model
- Expected: Informative message, no errors

### Test 10: Deleted History Items
- Create model with history
- Delete a middle item
- Verify children are re-parented correctly
- Check no broken connections in tree view

### Test 11: Offline Functionality
- Disconnect internet
- Create models, try-ons
- Verify saved to IndexedDB
- Reconnect
- Verify data persists

### Test 12: Multiple Projects
- Create 3 different projects
- Each with different models
- Switch between projects
- Verify histories don't mix
- Verify correct history loads per project

---

## Regression Testing

### Verify Old Features Still Work:

- [ ] Model generation in Create Model
- [ ] Image uploads
- [ ] Camera settings (lighting, composition, etc.)
- [ ] Try-on generation in Image Studio
- [ ] Wardrobe management
- [ ] Starring versions
- [ ] Renaming versions
- [ ] Deleting versions
- [ ] Undo/Redo
- [ ] Download images
- [ ] Project switching

---

## Bug Reporting Template

If you find issues, report with:

```markdown
### Bug Report

**Test Number:** Test X - [Name]
**Step:** Step Y
**Expected:** [What should happen]
**Actual:** [What actually happened]

**Console Errors:**
```
[Paste console errors here]
```

**Screenshots:**
[Attach if applicable]

**IndexedDB State:**
[If data-related, export and attach IndexedDB state]

**Reproducible:**
[ ] Yes [ ] Sometimes [ ] No

**Additional Notes:**
```

---

## Success Criteria Summary

✅ **Must Pass:**
1. Test 4 - History Persistence (THE CRITICAL ONE)
2. Test 2 - New models get types
3. Test 3 - Unified history loads
4. Test 7 - Data integrity

✅ **Should Pass:**
5. Test 1 - Migration works
6. Test 5 - Visual differentiation
7. Test 6 - Specific revision selection

✅ **Nice to Have:**
8. Test 8 - Performance acceptable
9. All edge cases handled gracefully

---

## Post-Testing Checklist

After successful testing:

- [ ] Document any minor issues found
- [ ] Note any UX improvements needed
- [ ] Verify security rules are active in Firebase Console
- [ ] Check Firebase Storage has user-uploaded files
- [ ] Verify no sensitive data in console logs
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices (responsive design)
- [ ] Prepare for user acceptance testing
- [ ] Update DEPLOYMENT.md with any findings

---

## Next Steps After Testing

### If All Tests Pass:
1. ✅ Mark unified history system as complete
2. 🚀 Deploy to staging/production
3. 📊 Monitor Firebase usage and costs
4. 👥 Begin user acceptance testing
5. 📝 Plan Phase 3: Firestore Sync

### If Tests Fail:
1. 🐛 Document failures
2. 🔍 Debug issues
3. 🔧 Fix and re-test
4. 📋 Update documentation

---

**Happy Testing! 🎉**

*Remember: Test 4 (History Persistence) is the most critical - that's the original bug we fixed!*
