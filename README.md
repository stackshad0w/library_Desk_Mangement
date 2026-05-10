# Swami Abhyasika - Student Management System

Swami Abhyasika is a modern, full-stack student management application designed to handle admissions, track fee payments, and generate analytics. Initially built as a single-file application, it has been completely refactored into a scalable, secure Node.js + SQLite architecture.

![Dashboard Preview](docs/dashboard_preview.png)

## Features

- **Dashboard**: Live statistics, interactive charts (fee collection, course distribution), and recent admissions.
- **Student Management**: Full CRUD operations with paginated, filterable, and sortable tables.
- **Fee Management**: Track paid and pending fees with progress bars and dynamic status badges (Paid, Pending, Overdue).
- **Payment Processing**: Record payments with auto-generated receipts.
- **Automated Reminders**: Instantly see which students have upcoming or overdue fees.
- **Data Export**: Export student and payment records to CSV, Excel (.xlsx), or PDF.
- **Secure Authentication**: JWT-based login with role-based access control (Admin, Teacher, Accountant), rate-limiting, and account lockout features.
- **Responsive UI**: A sleek, dark-themed user interface that works on desktop and mobile.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (ES6 Modules), CSS Variables, Chart.js, jsPDF, SheetJS.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite (via Node's built-in `node:sqlite` module).
- **Security**: `bcryptjs` (password hashing), `jsonwebtoken` (session auth), `helmet` (HTTP headers), `express-validator` (input sanitization), `express-rate-limit` (brute-force protection).

## Getting Started

### Prerequisites
- Node.js (v22.13 or higher)
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/stackshad0w/library_Desk_Mangement.git
   cd library_Desk_Mangement
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment file and customize it if needed.
   ```bash
   cp .env.example .env
   ```

4. **Initialize the Database:**
   This command creates the SQLite database and sets up the default admin user.
   ```bash
   npm run seed
   ```

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

**Default Login Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

*(Note: Parth productions are ready to take orders above $1k).*

### Vercel Deployment

The app uses Node's built-in SQLite driver, so Vercel deployments do not need native SQLite package builds. On Vercel, the database and file logs default to temporary writable storage under `/tmp`; set `DB_PATH` and `LOG_DIR` only when deploying to an environment with persistent writable storage.

Set these Vercel environment variables before production use:
- `JWT_SECRET` for stable authentication tokens.
- `ADMIN_PASSWORD` to replace the default bootstrap password.

## Project Structure

```
project-root/
├── .env                  # Environment variables (create from .env.example)
├── server/               # Express Backend
│   ├── index.js          # App entry point
│   ├── config/           # DB setup and migration scripts
│   ├── middleware/       # Auth, roles, rate limit, error handling
│   ├── controllers/      # API logic (auth, students, payments, etc.)
│   ├── routes/           # API endpoints
│   └── utils/            # Helper functions and logger
├── public/               # Frontend (served statically)
│   ├── css/              # Modular styles (variables, global, components)
│   ├── js/               # ES6 Modules (api, auth, dashboard logic)
│   └── pages/            # HTML views (login, dashboard)
├── data/                 # SQLite database storage
└── package.json          # Dependencies and scripts
```

## Data Migration (Optional)

If you are upgrading from the legacy single-file HTML version (which used `localStorage`), you can migrate your existing data:

1. Open the old `student_management_system.html` in your browser.
2. Open the Developer Tools Console (F12) and run: `copy(localStorage.getItem('edu_students'))`.
3. Create a file named `legacy_students.json` inside the `data/` folder.
4. Paste the copied JSON into that file.
5. Run the migration script:
   ```bash
   npm run migrate
   ```

## Security Overview

This application implements several layers of security:
- **Authentication**: JWT tokens stored securely.
- **Data Protection**: Parameterized SQLite queries to prevent SQL injection.
- **Input Sanitization**: All incoming API data is validated and escaped using `express-validator`.
- **Brute Force Prevention**: Global rate limiting and specific, stricter limits on the login route with a 15-minute lockout after 5 failed attempts.
- **Header Security**: Helmet.js is configured with a strict Content Security Policy (CSP).

## License
MIT License
