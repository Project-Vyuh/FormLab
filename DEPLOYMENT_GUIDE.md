# FormLab Deployment Guide

This guide will walk you through deploying FormLab with Firebase Cloud Functions and securing your Gemini API key.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] A Firebase account (https://firebase.google.com)
- [ ] A Google Cloud account
- [ ] Gemini API key from https://aistudio.google.com/apikey
- [ ] Firebase CLI installed globally

## Step-by-Step Deployment

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

Verify installation:
```bash
firebase --version
```

### 2. Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

### 3. Link Your Firebase Project

```bash
firebase use --add
```

Select your Firebase project from the list (or create a new one at https://console.firebase.google.com).

### 4. Install Dependencies

#### Frontend dependencies:
```bash
npm install
```

#### Cloud Functions dependencies:
```bash
cd functions
npm install
cd ..
```

### 5. Configure Gemini API Key

Set your Gemini API key for Cloud Functions:

```bash
firebase functions:config:set gemini.key="YOUR_ACTUAL_GEMINI_API_KEY"
```

**Important:** Replace `YOUR_ACTUAL_GEMINI_API_KEY` with your real API key from Google AI Studio.

Verify the configuration:
```bash
firebase functions:config:get
```

You should see:
```json
{
  "gemini": {
    "key": "YOUR_ACTUAL_GEMINI_API_KEY"
  }
}
```

### 6. Enable Firebase Services

Go to Firebase Console (https://console.firebase.google.com) and enable:

1. **Authentication**
   - Navigate to Build → Authentication
   - Click "Get Started"
   - Enable Email/Password provider
   - Enable Google provider

2. **Firestore Database**
   - Navigate to Build → Firestore Database
   - Click "Create database"
   - Start in production mode
   - Choose a location closest to your users

3. **Storage**
   - Navigate to Build → Storage
   - Click "Get started"
   - Start in production mode

4. **Upgrade to Blaze Plan** (Required for Cloud Functions)
   - Navigate to Upgrades
   - Select Blaze (pay-as-you-go) plan
   - Add payment method
   - **Note:** Free tier is generous, but external API calls require Blaze plan

### 7. Set Firestore Security Rules

In Firebase Console → Firestore Database → Rules, use:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Usage tracking (for rate limiting)
    match /usage/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Projects metadata
    match /projectMetadata/{document=**} {
      allow read, write: if request.auth != null;
    }

    // Model projects
    match /modelProjects/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 8. Set Storage Security Rules

In Firebase Console → Storage → Rules, use:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 9. Build and Test Locally (Optional but Recommended)

#### Test frontend:
```bash
npm run dev
```

Visit http://localhost:3000 and test the UI.

#### Test Cloud Functions with emulator:
```bash
# In a separate terminal
firebase emulators:start
```

**Note:** For emulator to work, you need `functions/.runtimeconfig.json`:
```json
{
  "gemini": {
    "key": "YOUR_GEMINI_API_KEY"
  }
}
```

### 10. Deploy to Production

#### Deploy Cloud Functions:
```bash
firebase deploy --only functions
```

**First deployment takes 5-10 minutes.**

Expected output:
```
✔ functions: Finished running predeploy script.
i functions: preparing codebase default for deployment
i functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i functions: ensuring required API cloudbuild.googleapis.com is enabled...
✔ functions: required API cloudfunctions.googleapis.com is enabled
✔ functions: required API cloudbuild.googleapis.com is enabled
i functions: uploading functions code to...
...
✔ Deploy complete!
```

#### Deploy Frontend to Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

#### Deploy Everything:
```bash
npm run build
firebase deploy
```

### 11. Verify Deployment

1. **Check Cloud Functions:**
   ```bash
   firebase functions:list
   ```

   You should see all functions listed:
   - generateModelImage
   - generateModelFromDescription
   - generateVirtualTryOn
   - reviseGeneratedImage
   - upscaleImage
   - selectivelyEnhanceImage
   - enhancePrompt
   - analyzeGarment
   - generateVideo

2. **Visit your app:**
   - Firebase Hosting URL: `https://YOUR_PROJECT_ID.web.app`
   - Custom domain (if configured): Your domain

3. **Test the flow:**
   - Sign up with email/password
   - Verify email
   - Log in
   - Create a project
   - Generate a model
   - **Watch for any errors in browser console**

### 12. Monitor Logs

View Cloud Functions logs:
```bash
firebase functions:log
```

Or in Firebase Console:
- Go to Functions
- Click on a function
- View Logs tab

### 13. Set Up API Key Restrictions (Critical!)

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to **APIs & Services → Credentials**
3. Find your Gemini API key
4. Click "Edit"
5. Under "API restrictions":
   - Select "Restrict key"
   - Enable only:
     - Generative Language API
     - Google AI API (if available)
6. Save

### 14. Set Up Monitoring

1. **Firebase Performance Monitoring**
   ```bash
   firebase init performance
   ```

2. **Set up billing alerts** in Google Cloud Console
   - Budgets & Alerts
   - Create budget
   - Set alert thresholds

3. **Monitor API usage** in Google Cloud Console
   - APIs & Services → Dashboard
   - Watch Gemini API quotas

## Post-Deployment Checklist

- [ ] Cloud Functions deployed successfully
- [ ] Frontend deployed to Firebase Hosting
- [ ] Can access the app via URL
- [ ] User signup and login works
- [ ] Email verification emails are sent
- [ ] Model generation works
- [ ] Virtual try-on works
- [ ] Video generation works
- [ ] Images upload to Firebase Storage
- [ ] API key restrictions configured
- [ ] Billing alerts set up
- [ ] Monitoring enabled

## Troubleshooting

### "API key not configured" error in Cloud Functions

**Solution:**
```bash
firebase functions:config:set gemini.key="YOUR_KEY"
firebase deploy --only functions
```

### Cloud Functions failing to deploy

**Check:**
1. Billing enabled (Blaze plan)?
2. Node version in functions/package.json is 18?
3. No syntax errors in functions/src/index.ts?

**Debug:**
```bash
cd functions
npm run build
```

### "Insufficient permissions" errors

**Solution:**
- Update Firestore rules
- Update Storage rules
- Ensure user is authenticated

### Rate limit exceeded

This is expected! Your rate limits are:
- 100 requests/hour per user
- 500 requests/day per user

Adjust in `functions/src/index.ts` if needed.

### High costs

**Actions:**
1. Check Google Cloud Console → Billing
2. Review API usage
3. Lower rate limits
4. Add cost caps
5. Review logs for abuse

## Updating Your App

### Update Cloud Functions:
```bash
cd functions
# Make your changes
cd ..
firebase deploy --only functions
```

### Update Frontend:
```bash
npm run build
firebase deploy --only hosting
```

### Update Firebase config (API key):
```bash
firebase functions:config:set gemini.key="NEW_KEY"
firebase deploy --only functions
```

## Rollback

If something goes wrong:

```bash
firebase functions:rollback FUNCTION_NAME@VERSION
```

Or in Firebase Console → Functions → select function → Rollback

## Support

For issues:
1. Check Firebase Functions logs
2. Check browser console
3. Review Cloud Function documentation
4. Check Gemini API status

---

**Your FormLab app is now securely deployed with production-ready architecture!** 🎉
