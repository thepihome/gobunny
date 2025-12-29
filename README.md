# Job Hunting Platform

A comprehensive web application for job hunting with multi-role support (Candidates, Consultants/HR, and Admins). Features include job search, resume matching, CRM integration, timesheet management, and customizable KPI dashboards.

## Features

### For Candidates
- Search and browse job openings
- Upload and manage multiple resumes
- Automatic resume-to-job matching with scoring
- View match scores and status for each job
- Customizable KPI dashboard

### For Consultants/HR
- View assigned candidates
- Browse all job listings
- View candidate match details and scores
- CRM integration for tracking candidate interactions
- Timesheet management for tracking work hours
- Customizable KPI dashboard

### For Admins
- Full user management (create, edit, delete users)
- Group management and assignment
- Access control and permissions
- View all data across the platform
- Customizable KPI dashboard

## Tech Stack

### Backend
- Node.js with Express
- PostgreSQL database
- JWT authentication
- RESTful API

### Frontend
- React 18
- React Router for navigation
- React Query for data fetching
- Axios for API calls
- Recharts for data visualization
- Modern, responsive UI

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gobunnyy
```

2. Install dependencies:
```bash
npm run install-all
```

3. Set up PostgreSQL database:
   - Create a new database named `job_hunting_db`
   - Update the database credentials in `backend/.env`

4. Create environment file:
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your database credentials:
```
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=job_hunting_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
NODE_ENV=development
```

5. Initialize the database:
   - The database schema will be automatically created when you start the backend server for the first time.

6. Start the development servers:

Option 1: Run both frontend and backend together:
```bash
npm run dev
```

Option 2: Run separately:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

7. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Default Admin User

On first startup, the application automatically creates a default admin user if no admin users exist:

- **Email**: `admin@jobhunting.com` (configurable via `ADMIN_EMAIL` in `.env`)
- **Password**: `admin123` (configurable via `ADMIN_PASSWORD` in `.env`)
- **Name**: Admin User (configurable via `ADMIN_FIRST_NAME` and `ADMIN_LAST_NAME` in `.env`)

**⚠️ Important**: Change the default password immediately after first login!

You can customize the default admin credentials by setting these environment variables in `backend/.env`:
```
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
ADMIN_FIRST_NAME=Your
ADMIN_LAST_NAME=Name
```

### Manual Admin Creation

To create an admin user manually (or if you need to create additional admins):

```bash
cd backend
npm run create-admin
```

Or with custom credentials:
```bash
node create-admin.js admin@example.com securepassword123 John Doe
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Jobs
- `GET /api/jobs` - Get all jobs (with filters)
- `GET /api/jobs/:id` - Get single job
- `POST /api/jobs` - Create job (consultant/admin)
- `PUT /api/jobs/:id` - Update job (consultant/admin)
- `DELETE /api/jobs/:id` - Delete job (admin)

### Resumes
- `GET /api/resumes/my-resumes` - Get user's resumes
- `GET /api/resumes` - Get all resumes (consultant/admin)
- `GET /api/resumes/:id` - Get single resume
- `POST /api/resumes/upload` - Upload resume
- `PUT /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume

### Matches
- `GET /api/matches/my-matches` - Get candidate's matches
- `GET /api/matches` - Get all matches (consultant/admin)
- `POST /api/matches/match` - Match resume to job
- `POST /api/matches/auto-match/:job_id` - Auto-match all resumes for a job
- `PUT /api/matches/:id/status` - Update match status

### Candidates
- `GET /api/candidates/assigned` - Get assigned candidates (consultant)
- `GET /api/candidates` - Get all candidates (admin)
- `GET /api/candidates/:id` - Get candidate details
- `POST /api/candidates/:id/assign` - Assign candidate to consultant (admin)

### Timesheets
- `GET /api/timesheets` - Get timesheets
- `GET /api/timesheets/:id` - Get single timesheet
- `POST /api/timesheets` - Create timesheet (consultant)
- `PUT /api/timesheets/:id` - Update timesheet
- `POST /api/timesheets/:id/submit` - Submit timesheet
- `POST /api/timesheets/:id/approve` - Approve/reject timesheet (admin)

### CRM
- `GET /api/crm` - Get CRM interactions
- `GET /api/crm/candidate/:candidate_id` - Get interactions for a candidate
- `POST /api/crm` - Create interaction (consultant)
- `PUT /api/crm/:id` - Update interaction
- `DELETE /api/crm/:id` - Delete interaction

### KPIs
- `GET /api/kpis/my-kpis` - Get user's KPIs
- `GET /api/kpis/metric-types` - Get available metric types
- `POST /api/kpis` - Create KPI
- `PUT /api/kpis/:id` - Update KPI
- `DELETE /api/kpis/:id` - Delete KPI

### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/password` - Update password
- `DELETE /api/users/:id` - Delete user

### Groups (Admin only)
- `GET /api/groups` - Get all groups
- `GET /api/groups/:id` - Get single group
- `POST /api/groups` - Create group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/:id/users/:user_id` - Add user to group
- `DELETE /api/groups/:id/users/:user_id` - Remove user from group

## Project Structure

```
gobunnyy/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── database/
│   │   └── schema.sql
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── jobs.js
│   │   ├── resumes.js
│   │   ├── matches.js
│   │   ├── candidates.js
│   │   ├── timesheets.js
│   │   ├── kpis.js
│   │   ├── users.js
│   │   ├── groups.js
│   │   └── crm.js
│   ├── uploads/
│   │   └── resumes/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.js
│   │   │   ├── Layout.css
│   │   │   └── PrivateRoute.js
│   │   ├── config/
│   │   │   └── api.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Jobs.js
│   │   │   ├── Resumes.js
│   │   │   ├── Matches.js
│   │   │   ├── Candidates.js
│   │   │   ├── Timesheets.js
│   │   │   ├── CRM.js
│   │   │   ├── Users.js
│   │   │   └── Groups.js
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── README.md
├── package.json
└── README.md
```

## Development

### Backend Development
- The backend uses Express.js with PostgreSQL
- Database schema is automatically initialized on first run
- API routes are organized by feature
- JWT authentication is used for securing endpoints

### Frontend Development
- React components are organized by pages and components
- React Query handles data fetching and caching
- Responsive design with modern CSS
- Role-based navigation and access control

## Production Deployment

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Set environment variables for production in `backend/.env`

3. Start the backend server:
```bash
cd backend
npm start
```

4. Serve the frontend build folder using a web server (nginx, Apache, etc.)

## License

ISC

## Support

For issues and questions, please open an issue in the repository.

