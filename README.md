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

```bash
npm run generate:proof-report
```

Generates a comprehensive content proof report for the website. This report allows temple administrators and proofreaders to manually verify every piece of content before publishing.

**Output:**
- `reports/proof-report.pdf` - A4 printable PDF report
- `reports/proof-report.html` - HTML report for browser viewing
- `reports/screenshots/` - Full-page screenshots for each page

**The report includes:**
- Summary dashboard with statistics
- Page-by-page analysis with screenshots
- Accessibility validation (alt text, headings, etc.)
- SEO validation (titles, meta descriptions, etc.)
- Link and image validation
- Content quality checks
- Temple-specific validation (timings, sevas, contact info)
- Firestore database content export
- AI knowledge base (seed files) verification
- Review checklists for manual verification

**Environment Variables:**
- `PROOF_REPORT_BASE_URL` - Base URL of the website (default: configured in script)
- `PROOF_REPORT_OUTPUT_DIR` - Output directory (default: `./reports`)

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
