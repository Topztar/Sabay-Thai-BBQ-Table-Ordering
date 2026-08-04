# Sabay Thai BBQ Table Ordering

![Sabay Thai BBQ Order App](/screenshots/customer_view.png)

A high-performance, modern React application serving as the primary digital ordering interface for Sabay Thai BBQ. The application operates in three core modes: **Customer View** (for tableside ordering), **Kitchen Display System (KDS)** (for chefs), and **Manager Dashboard** (for business analytics and settings).

## 🚀 Key Features

* **Real-time Order Synchronization**: Powered by Firebase Firestore (or a local Node server fallback), orders seamlessly transmit from Customer $\rightarrow$ Kitchen.
* **Senior-Friendly Mode**: Includes a `SimplifiedModeContext` that scales up UI elements and boosts contrast for visually impaired customers, with `localStorage` persistence.
* **Offline-Resilient**: An intelligent offline queue stores orders and syncing requests locally when the network drops, automatically pushing them in bulk upon reconnection.
* **Internationalization (i18n)**: Fully supports multiple languages with easy toggling for tourists and diverse demographics.

---

## 🏗️ Architecture

The app was recently heavily refactored (Phase 1-4) to achieve enterprise-level standards:

1. **Routing & Code Splitting**: Utilizes `React.lazy` and `Suspense` for route-level code splitting. The heavy charts in the Manager Dashboard or KDS logic don't impact the Customer View's initial load time.
2. **State Management**:
   - `GlobalContext.tsx`: The source of truth for restaurant data (Menu, Categories, Tables).
   - `SimplifiedModeContext.tsx`: The source of truth for user accessibility preferences.
3. **Data Layer (TanStack Query)**:
   - Uses `useQuery` from `@tanstack/react-query` to manage global data fetching. The app polls endpoints gracefully and deduplicates requests.
4. **Performance**:
   - Vite `manualChunks` configuration isolates heavy vendor libraries (`react`, `firebase`, `@tanstack/react-query`) into independent cacheable chunks, ensuring lightning-fast updates.

---

## 🛠️ Tech Stack

* **Core**: React 18, TypeScript, Vite
* **Styling**: Tailwind CSS, Lucide React (Icons)
* **Data Fetching**: TanStack Query (React Query)
* **Backend Integration**: Firebase Firestore / Local Express Node Server
* **Testing**: Vitest, React Testing Library
* **Documentation**: TypeDoc

---

## 💻 Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Topztar/Sabay-Thai-BBQ-Table-Ordering.git
   cd Sabay-Thai-BBQ-Table-Ordering
   ```

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *The app will be available at `http://localhost:3000`.*

---

## 🧪 Testing

The repository uses **Vitest** for incredibly fast unit tests and React Testing Library for simulating UI interactions.

* **Run all tests**:
  ```bash
  npm run test
  ```

* **Run tests in watch mode** (default behavior for Vitest):
  ```bash
  vitest
  ```

---

## 📖 API Documentation

This project uses **TypeDoc** to automatically generate an interactive HTML site from the TypeScript type definitions and interfaces (like `Order`, `MenuItem`, `Category`).

* **Generate the Docs**:
  ```bash
  npm run docs
  ```
* **View the Docs**: Open the newly generated `docs/index.html` file in your browser.

---

## 🚢 CI/CD & Deployment

This project includes a **GitHub Actions** workflow (`.github/workflows/ci.yml`). On every push or pull request to the `main` or `dev` branch, the pipeline will automatically:
1. Install dependencies (`npm ci`)
2. Enforce code quality (`npm run lint`)
3. Enforce type safety (`npx tsc --noEmit`)
4. Verify tests (`npm run test`)
5. Validate production build (`npm run build`)

To deploy to production, you can connect this repository to platforms like Vercel, Netlify, or Firebase Hosting. The output directory for production is `dist`.

```bash
# Build for production
npm run build
```
