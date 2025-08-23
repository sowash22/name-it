# GEMINI.md

## Project Overview

This is a Next.js 15 web application called "Name It" that helps users generate names for pets, characters, projects, etc. using AI-powered suggestions. It's built with React 19 and styled with Tailwind CSS. The application supports both Google GenAI and has a fallback to mock data for name generation. It also uses Firebase for database storage.

The main application is served from the `/v1` route.

## Building and Running

The following scripts are available in `package.json`:

*   `npm install`: Install dependencies.
*   `npm run dev`: Start the development server with Turbopack.
*   `npm run build`: Create a production build.
*   `npm run start`: Start the production server.
*   `npm run lint`: Run ESLint to check for code quality.

To run the application in development mode:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Conventions

*   **Language**: TypeScript
*   **Framework**: Next.js 15 with React 19
*   **Styling**: Tailwind CSS
*   **Linting**: ESLint is configured to maintain code quality.
*   **API**: The backend API is located in `src/app/api`. The main endpoint is `/api/generate-names`.
*   **Environment Variables**: The application uses environment variables to configure features like which AI provider to use and database settings. You can see these in the `src/app/api/generate-names/route.ts` file.
*   **Firebase**: The project is integrated with Firebase for database storage. The configuration is in `src/lib/firebaseAdmin.ts`.
*   **Mock Data**: Mock data is used as a fallback for name generation and is located in `src/lib/mock.ts`.
