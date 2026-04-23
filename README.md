📚 Campus Life OS

[![Live Demo](https://img.shields.io/badge/Live-Demo-green?style=for-the-badge)](https://resident-rhythm-os.lovable.app/)

🌐 **Live Demo:** https://resident-rhythm-os.lovable.app/

A modern, full-featured campus management and student life platform built with React, TypeScript, Vite, TailwindCSS, and Supabase.

Campus Life OS centralizes everyday student activities — from issue reporting and resource booking to communication, scheduling, and dorm management — into a single intuitive interface.

🚀 Features

🏠 Student Onboarding & Dashboard

Dorm onboarding flow for new users
Personalized dashboard overview
Quick access to key campus services
🛠 Issue Reporting System
Report campus/dorm issues
Track issue status
View detailed issue threads
Admin management for issue resolution


📦 Inventory & Borrowing

Browse available resources/items
Request to borrow items
Track borrow requests and approvals
Admin inventory management system


📚 Resources & Bookings

Explore campus resources
View resource details
Book and manage reservations
Track personal bookings


🔔 Notifications & Announcements

Real-time notifications
Campus-wide announcements
Activity updates


💬 Social & Communication

Community feed
Chat functionality
Student interaction and updates


⚡ Utilities & Tools

Utility services module
Admin utility management
Helpful campus tools in one place


✅ Productivity Tools

Personal to-do list
Schedule planner/calendar


🛡 Admin Panel

Manage users and activities
Handle inventory and borrow requests
Oversee utilities and issues


🧱 Tech Stack

Frontend

React 18 + TypeScript
Vite
TailwindCSS
shadcn/ui (Radix UI components)
React Router

State & Data

React Query (TanStack Query)

Backend & Services

Supabase (Auth, Database, Realtime)

Other Tools

React Hook Form + Zod (forms & validation)
Recharts (data visualization)
Sonner (toast notifications)


📁 Project Structure (Simplified)

src/
├── components/        # Reusable UI & feature components
├── pages/             # Application pages (routes)
├── hooks/             # Custom hooks (e.g., auth)
├── lib/               # Utilities & configs
├── App.tsx            # Main app routing
└── main.tsx           # Entry point


🔐 Authentication

Powered by Supabase Auth
Protected routes for authenticated users
Role-based access (Admin vs User)


⚙️ Getting Started

1. Clone the repository
git clone <your-repo-url>
cd campus-life-os

3. Install dependencies
npm install

or

bun install

3. Setup environment variables

Create a .env file and add your Supabase credentials:

VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key

4. Run the development server
npm run dev
🧪 Testing
npm run test
📦 Build
npm run build

🌟 Key Highlights

Modular and scalable architecture
Clean UI using modern component systems
Real-time-ready backend (Supabase)
Covers multiple aspects of campus life in one system


📌 Future Improvements (Optional Ideas)

Mobile app version
Push notifications
Role-based dashboards (students, staff, admins)
Advanced analytics for campus management
