# Quick Start Guide - FormLab with Gemini API

## For Production Deployment (Recommended)

### 1. One-Time Setup (15 minutes)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Link your project
firebase use --add

# Install all dependencies
npm install
cd functions && npm install && cd ..

# Set your Gemini API key
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY_HERE"
```

### 2. Deploy Everything

```bash
# Build and deploy
npm run build
firebase deploy
```

### 3. Access Your App

Visit: `https://YOUR_PROJECT_ID.web.app`

**That's it!** Your app is now running with:
- ✅ Secure backend API
- ✅ Protected API keys
- ✅ User authentication
- ✅ Rate limiting
- ✅ Cloud storage

---

## For Local Development (Testing Only)

### 1. Setup

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Create local config (optional)
cat > functions/.runtimeconfig.json << EOF
{
  "gemini": {
    "key": "YOUR_GEMINI_API_KEY"
  }
}
EOF
```

### 2. Run Locally

```bash
# Start dev server
npm run dev

# In another terminal (optional - for Cloud Functions emulator)
firebase emulators:start
```

---

## Commands Reference

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
```

### Firebase Deployment
```bash
firebase deploy                    # Deploy everything
firebase deploy --only functions   # Deploy Cloud Functions only
firebase deploy --only hosting     # Deploy frontend only
```

### Firebase Configuration
```bash
firebase functions:config:set gemini.key="KEY"  # Set API key
firebase functions:config:get                   # View config
firebase functions:log                          # View logs
firebase functions:list                         # List all functions
```

### Testing
```bash
firebase emulators:start                        # Start local emulators
firebase emulators:start --only functions       # Functions only
```

---

## Where is Your API Key?

### ❌ OLD (Insecure - DO NOT USE):
```
.env.local → GEMINI_API_KEY=xxx
```

### ✅ NEW (Secure - Production Ready):
```bash
firebase functions:config:set gemini.key="xxx"
```

Your API key is now:
- Stored securely in Firebase (not in code)
- Never exposed to the browser
- Protected by authentication
- Rate-limited per user

---

## How It Works Now

```
User Browser
    ↓
    | Authenticated Request
    ↓
Firebase Cloud Functions (Backend)
    ↓
    | Secure API call with YOUR_API_KEY
    ↓
Google Gemini API
    ↓
    | Generated Image/Video
    ↓
Firebase Cloud Functions
    ↓
    | Returns result
    ↓
User Browser
```

**Key Benefits:**
- API key never leaves the server
- Users must be authenticated
- Rate limits prevent abuse
- You control all API access

---

## Troubleshooting Quick Fixes

### Functions not working?
```bash
firebase functions:config:set gemini.key="YOUR_KEY"
firebase deploy --only functions
```

### Frontend errors?
```bash
rm -rf node_modules
npm install
npm run build
firebase deploy --only hosting
```

### Need to check logs?
```bash
firebase functions:log --only generateModelImage
```

### Need to rollback?
```bash
firebase functions:rollback FUNCTION_NAME
```

---

## Cost Control

Your rate limits (in `functions/src/index.ts`):
- 100 requests/hour per user
- 500 requests/day per user

To change:
1. Edit `functions/src/index.ts`
2. Modify `RATE_LIMITS` object
3. Redeploy: `firebase deploy --only functions`

---

## Next Steps

1. ✅ Deploy using commands above
2. ✅ Test signup and login
3. ✅ Generate your first model
4. ✅ Set up API key restrictions in Google Cloud Console
5. ✅ Set up billing alerts
6. ✅ Monitor usage

**Documentation:**
- Full README: `README.md`
- Deployment guide: `DEPLOYMENT_GUIDE.md`
- This quick start: `QUICK_START.md`

---

**Need help?** Check the logs first:
```bash
firebase functions:log
```

**Ready to go live?** Follow `DEPLOYMENT_GUIDE.md` for production best practices.
