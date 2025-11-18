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
- **AI Integration**: Google GenAI SDK

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

1. Create a `.env.local` file in the root directory.
2. Add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port shown in your terminal).

## Project Structure

- `src/components`: UI components for the application features.
- `src/services`: Database and API service integrations.
- `src/types.ts`: TypeScript definitions for models and application state.
