# SmartFlow - Intelligence in Motion

SmartFlow is an intelligent, real-time stadium navigation and crowd management platform designed to optimize the matchday experience. By combining real-time crowd intelligence, predictive queue modeling, and smart routing, SmartFlow ensures fans spend less time waiting and more time enjoying the event.

## 🚀 Main Features

*   **Real-Time Crowd Intelligence**: Visualizes stadium density and stand occupancy using a live, dynamic 3D heatmap overlaid on satellite imagery.
*   **Predictive Gate Routing**: Employs a heuristic predictive ETA engine to recommend the optimal entry gate based on live queue density, flow rates, and capacity.
*   **Event Lifecycle Management**: Context-aware dashboards that adapt between "Pre-Event" and "Live Matchday" modes. Concluded events are automatically archived.
*   **Seamless In-Seat Food Ordering**: Allows users to pre-order food and beverages from stadium stalls, skipping the queues.
*   **Responsive Mobile-First UI**: A fully fluid interface that provides crucial navigation and stat tracking natively on mobile devices.

## 💻 Tech Stack

### Frontend
*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
*   **UI Library**: [React 19](https://react.dev/)
*   **Styling**: Pure CSS (`globals.css`) with custom responsive CSS Grid layouts.
*   **Visualizations & Maps**: [Three.js](https://threejs.org/), [@googlemaps/js-api-loader](https://www.npmjs.com/package/@googlemaps/js-api-loader), [Recharts](https://recharts.org/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **State Management**: React Context (`AuthContext`) + Local Component State.

### Backend
*   **Runtime**: [Node.js](https://nodejs.org/)
*   **Framework**: [Express.js](https://expressjs.com/)
*   **Language**: TypeScript
*   **Security & Utils**: Helmet, Morgan, Express Rate Limit, CORS.
*   **Database**: Firebase Admin SDK (Firestore).

### Database (Firebase Firestore)
The application utilizes a hybrid data approach:
*   **REST API Layer**: Used for standard CRUD operations (User profiles, Event listings, Food ordering).
*   **Real-time Listeners**: Utilizes Firebase Client SDK snapshots for real-time telemetry (Gate Metrics, Stand Occupancy).

## 🗂️ Folder Structure

```text
SmartFlow-Intelligence_in_Motion/
├── smartflow-app/                  # Frontend Application
│   ├── src/
│   │   ├── app/                    # Next.js App Router Pages
│   │   │   ├── dashboard/          # User Dashboard
│   │   │   ├── discover/           # Event Exploration
│   │   │   ├── event/[id]/         # Contextual Event Hub (Pre-event/Live)
│   │   │   ├── login/              # Authentication Flow
│   │   │   ├── orders/             # Food & Beverage Management
│   │   │   └── globals.css         # Application-wide styling & responsive grids
│   │   ├── components/             # Reusable UI Components
│   │   │   ├── layout/             # Navigation, Sidebar, Page Headers
│   │   │   ├── discover/           # Event Cards
│   │   │   └── event/              # StadiumHeatmap3D, Stat Chips
│   │   ├── context/                # Global React Contexts
│   │   ├── lib/                    # API wrappers and Firebase client configuration
│   │   └── types/                  # TypeScript interface definitions
│   └── package.json
│
└── smartflow-backend/              # Express API Server
    ├── src/
    │   ├── controllers/            # Route business logic
    │   ├── middleware/             # Auth and security checks
    │   ├── routes/                 # Express route definitions
    │   └── services/               # Firebase Admin interactions
    └── package.json
```

## 🗄️ Database Structure

*   `events`: Global list of matches and concerts.
*   `users`: User profile information.
    *   `users/{userId}/events`: Events the user has enrolled in.
    *   `users/{userId}/orders`: In-stadium food and merchandise orders.
*   `gates` / `gateMetrics`: Real-time queue density, flow rates, and wait times per venue.
*   `standMetrics`: Real-time fill percentages for stadium stands.
*   `food`: Available catalog of food and beverages for pre-ordering.
*   `stadium_live_data`: Time-series mock data for historical crowd intelligence visualizations.

## ⚙️ How to Run Locally

1.  **Clone the repository.**
2.  **Start the Backend**:
    ```bash
    cd smartflow-backend
    npm install
    npm run dev
    ```
3.  **Start the Frontend**:
    ```bash
    cd smartflow-app
    npm install
    npm run dev
    ```
4.  Open `http://localhost:3000` in your browser.

> **Note**: A valid `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is required in the frontend `.env.local` to enable the 3D satellite heatmaps.