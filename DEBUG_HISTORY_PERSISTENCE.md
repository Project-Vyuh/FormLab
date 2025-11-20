# Debugging History Persistence Issue

## Problem
Try-ons created in Image Studio are not showing in Version History Panel when returning to the same model after switching to a different model.

## Debug Logs Added

I've added comprehensive console logging to track the data flow. Here's what to look for:

### When Saving (in Image Studio)

After making a try-on, you should see in the console:

```
[saveStylingHistory] baseModelId: rev-XXXXXXXXX
[saveStylingHistory] total history items: X
[saveStylingHistory] createModelHistory: [{id: "rev-XXX", type: "model-generation"}, ...]
[saveStylingHistory] stylingOnlyHistory: [{id: "hist-XXX", type: "try-on"}, ...]
[saveStylingHistory] Saving stylingHistory[rev-XXXXXXXXX] with X items
[saveStylingHistory] Saved successfully
```

### When Loading (in Image Studio)

When you return to Image Studio (after switching models), you should see:

```
[loadUnifiedHistory] baseModelId: rev-XXXXXXXXX
[loadUnifiedHistory] createModelHistory count: X
[loadUnifiedHistory] stylingHistory count: X
[loadUnifiedHistory] createModelHistory: [{id: "rev-XXX", type: "model-generation"}, ...]
[loadUnifiedHistory] stylingHistory: [{id: "hist-XXX", type: "try-on"}, ...]
[loadUnifiedHistory] unifiedHistory count: X
[loadUnifiedHistory] unifiedHistory: [{id: "rev-XXX", type: "model-generation"}, {id: "hist-XXX", type: "try-on"}, ...]
```

---

## Testing Steps with Console Monitoring

### Step 1: Create Model A with Try-Ons

1. Open Browser DevTools (F12)
2. Go to Console tab
3. Clear console
4. In app: Create Model → Generate a base model
5. Check console for `[saveStylingHistory]` logs (from Create Model auto-save)
6. Click "Proceed to Styling"
7. Check console for `[loadUnifiedHistory]` logs
   - **Expected:** `stylingHistory count: 0` (first time)
   - **Expected:** `createModelHistory count: 1` (the base model)

8. In Image Studio: Add a try-on
   - Select wardrobe item
   - Click Generate
9. Wait for try-on to complete
10. **CRITICAL:** Wait 2+ seconds for auto-save
11. Check console for `[saveStylingHistory]` logs
    - **Expected:** `stylingOnlyHistory` should show the try-on
    - **Expected:** "Saved successfully" message

12. Add another try-on (repeat step 8-11)
13. Note the `baseModelId` value in the console logs

### Step 2: Switch to Model B

1. Click "Create Model" in header
2. Create or select a different model (Model B)
3. Click "Proceed to Styling"
4. Check console for `[loadUnifiedHistory]` logs
   - **Expected:** Different `baseModelId`
   - **Expected:** Different history items

### Step 3: Return to Model A (CRITICAL TEST)

1. Click "Change Model" button in Image Studio
2. From "Your Models" gallery, select Model A (the first one with try-ons)
3. Click "Proceed to Styling"
4. **Check console logs carefully:**

```
[loadUnifiedHistory] baseModelId: rev-XXXXXXXXX  ← Should be same as Step 1
[loadUnifiedHistory] createModelHistory count: X
[loadUnifiedHistory] stylingHistory count: X     ← Should be 2 (the try-ons)
[loadUnifiedHistory] createModelHistory: [...]
[loadUnifiedHistory] stylingHistory: [...]        ← Should show hist-XXX items
[loadUnifiedHistory] unifiedHistory count: X     ← Should be createModel + styling counts
```

---

## Diagnosis Guide

### Issue 1: stylingHistory count is 0 when it should have items

**Possible Causes:**
1. Save didn't complete before you switched models
2. baseModelId mismatch
3. Data not persisted to IndexedDB

**How to Check:**
1. In DevTools → Application → Storage → IndexedDB → FormLabProjectsDB → modelProjects
2. Find your project entry
3. Look at the JSON structure:
   ```json
   {
     "stylingHistory": {
       "rev-XXXXXXXXX": [
         {"id": "hist-XXX", "type": "try-on", ...},
         {"id": "hist-YYY", "type": "try-on", ...}
       ]
     }
   }
   ```
4. Verify the `rev-XXXXXXXXX` key matches the `baseModelId` in console logs

**Solutions:**
- If `stylingHistory` is empty/missing → Save function not working
- If key doesn't match → baseModelId inconsistency
- If data exists but not loading → Load function not finding it

### Issue 2: baseModelId doesn't match between save and load

**Symptoms:**
```
[saveStylingHistory] baseModelId: rev-123456
[loadUnifiedHistory] baseModelId: rev-789012  ← DIFFERENT!
```

**Cause:** The `selectedStylingModel.baseModelId` changes between sessions

**How to Check:**
1. When you first create the model in Create Model, note its ID
2. Check what baseModelId is used when saving try-ons
3. Check what baseModelId is used when loading again

**Solution:**
- Need to ensure `baseModelId` is consistently the root ancestor ID
- Check `findRootAncestor` logic in CreateModel.tsx

### Issue 3: Data saved but stylingHistory is not an object

**Symptoms:**
```
[loadUnifiedHistory] stylingHistory count: 0
```
But in IndexedDB you see: `"stylingHistory": []` (array instead of object)

**Cause:** Old data structure or incorrect initialization

**Solution:**
- Need to migrate old data
- Check `saveStylingHistory` initializes as object: `state.stylingHistory = {}`

---

## Quick Diagnostics

Run this in browser console after returning to Model A:

```javascript
// Get the current project from IndexedDB
const dbRequest = indexedDB.open('FormLabProjectsDB', 1);
dbRequest.onsuccess = (event) => {
  const db = event.target.result;
  const transaction = db.transaction(['modelProjects'], 'readonly');
  const store = transaction.objectStore('modelProjects');
  const getAllRequest = store.getAll();

  getAllRequest.onsuccess = () => {
    const projects = getAllRequest.result;
    console.log('All projects:', projects);

    // Find your current project (replace with your project ID)
    const currentProject = projects[0]; // or find by ID
    console.log('Current project styling history:', currentProject.stylingHistory);

    // Check all baseModelIds
    Object.keys(currentProject.stylingHistory || {}).forEach(baseId => {
      console.log(`baseModelId: ${baseId}, items:`, currentProject.stylingHistory[baseId].length);
    });
  };
};
```

---

## Expected Behavior

### After creating 2 try-ons on Model A (baseModelId: rev-123):

**In IndexedDB:**
```json
{
  "id": "project-abc",
  "generatedModelHistory": [
    {"id": "rev-123", "type": "model-generation", "baseModelId": "rev-123", ...}
  ],
  "stylingHistory": {
    "rev-123": [
      {"id": "hist-001", "type": "try-on", "baseModelId": "rev-123", ...},
      {"id": "hist-002", "type": "try-on", "baseModelId": "rev-123", ...}
    ]
  }
}
```

**When loading:**
```
[loadUnifiedHistory] baseModelId: rev-123
[loadUnifiedHistory] createModelHistory count: 1
[loadUnifiedHistory] stylingHistory count: 2  ✅
[loadUnifiedHistory] unifiedHistory count: 3  ✅
```

**In Version History Panel:**
- Should show 3 items total
- 1 blue badge (base model)
- 2 green badges (try-ons)

---

## Common Issues & Solutions

### 1. "Saved successfully" appears but items count is 0

```
[saveStylingHistory] stylingOnlyHistory: []  ← EMPTY!
[saveStylingHistory] Saving stylingHistory[rev-XXX] with 0 items
```

**Problem:** Items don't have `type: 'try-on'` field, so they're filtered out

**Check:** In ImageStudio.tsx, verify try-on items are created with:
```typescript
{
  type: 'try-on',
  baseModelId: selectedStylingModel.baseModelId,
  ...
}
```

### 2. stylingHistory count loads correctly but Version History Panel is empty

**Problem:** UI not rendering, not a data issue

**Check:**
- Version History Panel component receiving correct data
- React DevTools → Components → VersionHistoryPanel → props.history

### 3. Intermittent - sometimes works, sometimes doesn't

**Problem:** Race condition - switching models before auto-save completes

**Solution:**
- Wait 2+ seconds after try-on before switching
- Or reduce debounce time in ImageStudio.tsx from 1000ms to 500ms

---

## Next Steps

1. **Run Test 4 with console open**
2. **Copy all console logs** from save and load operations
3. **Check IndexedDB data structure**
4. **Report findings:**
   - What does `stylingHistory count` show when loading?
   - What's in IndexedDB `stylingHistory` object?
   - Does baseModelId match between save and load?

---

## If All Logs Look Correct But Still Not Working

Possible issue: **Version History Panel filtering**

Check `VersionHistoryPanel.tsx`:
- Does `lineageFilteredHistory` include try-on items?
- Is filtering logic correct?
- Add console logs to VersionHistoryPanel to see what it receives

---

**Please run the test again with console open and share the logs!**
