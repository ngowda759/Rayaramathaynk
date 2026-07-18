# Rayara Math Temple Portal

A modern, responsive temple management portal built using **Next.js**, **TypeScript**, **Tailwind CSS**, and **Firebase**. The application provides devotees with an easy way to explore temple information, book sevas, make donations, view events, and allows administrators to efficiently manage temple operations.

----

## Features

### Public Website

* Modern responsive homepage
* Temple history and information
* Sevas listing and booking
* Online donations
* Events and festivals
* Gallery
* Contact information
* Mobile-friendly design
* Search engine optimized pages

### Admin Portal

* Secure authentication
* Dashboard
* Seva management
* Event management
* Donation management
* User management
* Reports and analytics
* Content management

---

## Technology Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Firebase Authentication
* Firestore Database
* Firebase Storage
* Firebase Hosting (optional)

### Deployment

* Vercel
* Firebase Hosting

---

## Project Structure

```text
app/
components/
context/
hooks/
lib/
public/
services/
styles/
types/
utils/
```

---

## Getting Started

### Prerequisites

* Node.js (LTS)
* npm
* Git

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd Rayaramathaynk
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env.local
```

Fill in the required Firebase configuration values.

Start the development server:

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

---

## Available Scripts

```bash
npm run dev
```

Runs the development server.

```bash
npm run build
```

Creates a production build.

```bash
npm run start
```

Starts the production server.

```bash
npm run lint
```

Runs ESLint.

---

## Development Guidelines

* Use TypeScript for all new code.
* Prefer reusable components.
* Keep pages responsive.
* Follow the existing folder structure.
* Avoid duplicate components.
* Run lint before committing.
* Ensure the project builds successfully before pushing changes.

---

## Deployment

### Vercel

```bash
vercel
```

### Firebase

```bash
firebase deploy
```

---

## AI Settings & Seed API

The portal includes an AI chatbot (Raya) that provides information about temple services. The AI needs initial data to work properly.

### Initializing AI Settings

After deployment, you need to seed the AI settings to Firestore. Follow these steps:

#### Option 1: Using the Admin UI (Recommended)

1. Log in to the admin portal at `/admin`
2. Navigate to AI Settings (`/admin/ai/settings`)
3. Click the **"Initialize Data"** button
4. Wait for the success message

#### Option 2: Using the API Directly

```bash
# Development mode
curl -X GET http://localhost:3000/api/seed-ai-settings

# Production mode (requires authenticated request)
curl -X POST https://your-domain.com/api/seed-ai-settings
```

### What Gets Seeded

The seed operation creates the following Firestore documents:

| Collection | Document | Description |
|------------|----------|-------------|
| `ai_settings` | ` RayaAI` | Main AI configuration |
| `ai_settings` | `prompts` | Chatbot prompts and responses |
| `ai_settings` | `intents` | Intent mappings for Q&A |
| `ai_settings` | `unknown_questions` | Unknown questions for learning |
| `ai_settings` | `welcome` | Welcome message |
| `settings` | `temple` | Temple information |
| `settings` | `contact` | Contact details |
| `settings` | `visitor` | Visitor information |

### Required Environment Variables

For the seed API to work in production, ensure these environment variables are set:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account private key |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account email |

### Firebase Firestore Rules

The seed API requires write access to `ai_settings` and `settings` collections. Update your Firestore rules:

```javascript
match /ai_settings/{docId} {
  allow read: if true;
  allow write: if true;
}

match /settings/{docId} {
  allow read: if true;
  allow write: if true;
}
```

To deploy rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## Roadmap

### Phase 1

* Homepage improvements
* Temple information
* Gallery
* Responsive UI

### Phase 2

* Seva booking
* Donations
* Events
* Authentication

### Phase 3

* Admin dashboard
* Reports
* Notifications
* User management

### Phase 4

* SEO improvements
* Performance optimization
* Accessibility enhancements
* AI-powered features

---

## Contributing

1. Create a feature branch.
2. Make focused, well-tested changes.
3. Run lint and build successfully.
4. Open a pull request with a clear description.

---

## License

This project is intended for the Rayara Math Temple Portal. Licensing terms will be defined by the project owner.

---

## Acknowledgements

Built with:

* Next.js
* React
* TypeScript
* Tailwind CSS
* Firebase
* Vercel

---

**Maintainer:** Naveen C
