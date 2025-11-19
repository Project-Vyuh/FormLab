# FormLab UGC App

FormLab is a professional AI-powered studio application designed for generating high-quality fashion content. It streamlines the workflow for creating custom AI models, simulating professional photography studios, and producing video content using advanced generative AI technologies.

## Features

### Model Creation
Generate custom AI models tailored for specific fashion showcases. Define physical attributes and style preferences to create consistent brand representatives.

### Image Studio
A comprehensive photography simulation environment.
- **Lighting Control**: Configure complex lighting rigs with key, fill, and rim lights.
- **Camera Settings**: Adjust aperture, focal length, and sensor size for photorealistic depth of field.
- **Environment**: Select from various studio backdrops including high-key, textured, and custom environments.
- **Virtual Try-On**: Upload garments and apply them to generated models with AI-powered try-on.

### Video Creator
Transform static images into dynamic videos using Google's Veo model. Supports image-to-video generation with customizable motion and style settings.

### Project Management
Organize creative work into distinct projects. Track deadlines, manage client details, and receive notifications for approaching due dates.

## Tech Stack

- **Frontend Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Backend**: Firebase (Authentication, Firestore, Storage, Cloud Functions)
- **AI Integration**: Google Gemini API (via Firebase Cloud Functions)

## Architecture

FormLab uses a **secure server-side architecture** where all Gemini API calls are proxied through Firebase Cloud Functions. This ensures:
- ✅ API keys are never exposed to the client
- ✅ Rate limiting and quota management
- ✅ User authentication required for all AI operations
- ✅ Protection against API key theft and abuse
- ✅ Production-ready security

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud account with Gemini API access
- Firebase project (create at https://console.firebase.google.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd formlab-ugc-app
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install Cloud Functions dependencies**
   ```bash
   cd functions
   npm install
   cd ..
   ```

### Firebase Setup

1. **Create a Firebase project**
   - Go to https://console.firebase.google.com
   - Create a new project
   - Enable Authentication (Email/Password and Google)
   - Enable Firestore Database
   - Enable Firebase Storage

2. **Initialize Firebase in your project**
   ```bash
   firebase login
   firebase use --add
   # Select your Firebase project
   ```

3. **Update Firebase configuration**
   - Copy your Firebase config from Project Settings
   - Update `services/firebase.ts` with your project credentials

### Gemini API Configuration

1. **Get your Gemini API key**
   - Visit https://aistudio.google.com/apikey
   - Create a new API key
   - Copy the key

2. **Configure API key for Cloud Functions**
   ```bash
   firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
   ```

3. **For local development (optional)**
   - Create `functions/.runtimeconfig.json`:
   ```json
   {
     "gemini": {
       "key": "YOUR_GEMINI_API_KEY"
     }
   }
   ```
   - **Note**: This file is gitignored and for local testing only

### API Key Security (Important!)

⚠️ **Security Best Practices:**

1. **Never commit API keys to git**
   - API keys in `.env.local` are gitignored
   - Functions config is stored in Firebase, not in code

2. **Restrict your API key in Google Cloud Console:**
   - Navigate to Google Cloud Console → APIs & Services → Credentials
   - Select your API key
   - Add API restrictions (allow only Gemini, Imagen, Veo APIs)
   - Optionally add IP restrictions (Cloud Functions IPs)

3. **Monitor usage:**
   - Check Google Cloud Console for API usage
   - Set up billing alerts
   - Monitor Firebase Functions logs

### Running the Application

#### Development Mode

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

2. **Test Cloud Functions locally (optional):**
   ```bash
   cd functions
   npm run serve
   cd ..
   # Then update your app to use local emulator
   ```

#### Production Deployment

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Deploy Cloud Functions:**
   ```bash
   firebase deploy --only functions
   ```
   - First deployment may take 5-10 minutes
   - Note the function URLs in the output

3. **Deploy frontend to Firebase Hosting:**
   ```bash
   firebase deploy --only hosting
   ```

4. **Deploy everything at once:**
   ```bash
   firebase deploy
   ```

### User Setup

1. **Create an account:**
   - Navigate to the app
   - Click "Sign Up"
   - Enter email and password
   - Verify your email

2. **Start creating:**
   - Create your first project
   - Generate AI models
   - Use virtual try-on features
   - Create videos from images

## Project Structure

```
formlab-ugc-app/
├── components/          # React UI components
│   ├── Auth.tsx        # Authentication UI
│   ├── CreateModel.tsx # Model generation
│   ├── ImageStudio.tsx # Virtual try-on studio
│   └── VideoCreator.tsx# Video generation
├── services/           # Service layer
│   ├── firebase.ts     # Firebase initialization
│   ├── authService.ts  # Authentication logic
│   ├── userService.ts  # User data management
│   ├── storageService.ts # File upload to Storage
│   ├── geminiService.ts  # (Now proxies to Cloud Functions)
│   └── geminiApiClient.ts# Cloud Functions client
├── functions/          # Firebase Cloud Functions
│   └── src/
│       └── index.ts    # All Gemini API endpoints
├── types.ts            # TypeScript definitions
├── firebase.json       # Firebase configuration
└── vite.config.ts      # Vite build configuration
```

## Cloud Functions Endpoints

All AI operations are handled by secure Cloud Functions:

- `generateModelImage` - Create model from photo
- `generateModelFromDescription` - Create model from text
- `generateVirtualTryOn` - Apply garment to model
- `reviseGeneratedImage` - Modify existing images
- `upscaleImage` - Increase image resolution
- `selectivelyEnhanceImage` - Enhance specific parts
- `enhancePrompt` - Improve user prompts
- `analyzeGarment` - Analyze clothing items
- `generateVideo` - Create videos from images

Each endpoint:
- ✅ Requires user authentication
- ✅ Implements rate limiting (100/hour, 500/day per user)
- ✅ Validates input data
- ✅ Returns structured responses

## Rate Limits

To prevent abuse and control costs:

- **100 requests per hour** per user
- **500 requests per day** per user

Limits are tracked in Firestore under the `usage` collection.

## Troubleshooting

### "API key not configured" error
- Ensure you've set the API key: `firebase functions:config:set gemini.key="YOUR_KEY"`
- For local development, create `functions/.runtimeconfig.json`

### "User must be authenticated" error
- Make sure you're logged in
- Check Firebase Authentication is enabled
- Verify your email address

### Cloud Functions deployment fails
- Check Node.js version (must be 18)
- Verify billing is enabled on your Firebase project
- Check `functions/package.json` dependencies

### Images/Videos not persisting
- Verify Firebase Storage is enabled
- Check Storage rules allow authenticated writes
- Ensure user is logged in

### Build errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`
- Update dependencies: `npm update`

## Cost Considerations

**Firebase:**
- Spark plan (free): Limited Functions invocations
- Blaze plan (pay-as-you-go): Required for Cloud Functions with external API calls

**Gemini API:**
- Charged per API call
- Different pricing for Gemini, Imagen, and Veo models
- Monitor usage in Google Cloud Console

**Recommendations:**
- Start with low rate limits
- Monitor usage daily
- Set up billing alerts
- Use Firebase Analytics to track user behavior

## Contributing

This is a private project. For issues or feature requests, contact the development team.

## License

Apache-2.0 License

## Support

For questions or support, please contact the FormLab development team.

---

**Built with ❤️ using React, Firebase, and Google Gemini AI**
