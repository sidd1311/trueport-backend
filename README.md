# TruePortMe Backend

A career passport platform where students and professionals can store their experiences and have them verified by mentors. Each user gets a public portfolio showcasing their verified achievements.

## 🚀 Features

### Core Features
- **User Authentication**: JWT-based auth with bcrypt password hashing
- **Experience Management**: Create, update, and manage career experiences
- **Education Management**: Add and verify educational qualifications
- **GitHub Projects**: Showcase projects with learnings and live URLs
- **Portfolio Display**: Public portfolios with latest education and projects highlighted
- **File Upload**: Cloudinary integration for certificates and proof documents
- **GitHub Integration**: Display public repositories in portfolios

### 🔥 Enhanced Verification System
- **🎯 Visual Verifier Selection**: Browse and select verifiers instead of guessing emails
- **🔍 Smart Search & Filters**: Find verifiers by expertise, department, or name
- **🏫 Institute-Based Matching**: Only verifiers from same institution can verify
- **📧 Professional Email Notifications**: Beautiful, branded verification emails
- **📊 Verifier Dashboard**: Complete management system for verifiers
- **⚡ One-Click Verification**: Direct email-to-dashboard access for verifiers
- **📈 Analytics & Insights**: Comprehensive verification tracking and stats
- **🔒 Enhanced Security**: Token-based verification with auto-expiry
- **📱 Mobile-Optimized**: Responsive design for all verification workflows

### 👥 Role-Based Experience
- **Students**: Netflix-like browsing for verifier selection
- **Verifiers**: Centralized dashboard with institution-wide oversight
- **Institutions**: Complete verification ecosystem with analytics

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **File Storage**: Cloudinary
- **Email**: SendGrid
- **External APIs**: GitHub API

## 🏢 Admin System (SAAS Hierarchy)

### Overview

TruePortMe implements a comprehensive 3-tier admin system:

1. **� Super Admin (SAAS Provider)** - Complete system control
2. **🏫 Institute Admins** - Manage their institution's users and data  
3. **👥 Regular Users** - Students and Verifiers

### 🚀 Initial Setup

1. **Create Default Super Admin**
   ```bash
   npm run setup-admin
   ```
   
   **Default Credentials:**
   - Email: `admin@trueportme.com`
   - Password: `admin123456`
   - ⚠️ **Change password immediately after first login!**

2. **Login to Super Admin Panel**
   ```http
   POST /api/super-admin/login
   Content-Type: application/json

   {
     "email": "admin@trueportme.com",
     "password": "admin123456"
   }
   ```

### 🔑 Super Admin APIs

#### Authentication
```http
POST /api/super-admin/login
Content-Type: application/json

{
  "email": "admin@trueportme.com",
  "password": "your-password"
}
```

#### Profile Management
```http
GET /api/super-admin/me
Authorization: Bearer <super_admin_token>

PUT /api/super-admin/me
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "Updated Admin Name",
  "profilePicture": "https://cloudinary.url/profile.jpg"
}

PUT /api/super-admin/change-password
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "currentPassword": "current-password",
  "newPassword": "new-secure-password"
}
```

#### Institution Management
```http
POST /api/super-admin/institutions
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "harvard-university",
  "displayName": "Harvard University",
  "description": "Prestigious Ivy League university",
  "website": "https://harvard.edu",
  "logo": "https://cloudinary.url/harvard-logo.png",
  "address": {
    "street": "Massachusetts Hall",
    "city": "Cambridge",
    "state": "MA",
    "zipCode": "02138",
    "country": "USA"
  },
  "contactInfo": {
    "email": "info@harvard.edu",
    "phone": "+1-617-495-1000"
  },
  "settings": {
    "allowSelfRegistration": true,
    "requireVerifierApproval": true,
    "maxUsersLimit": 5000
  }
}

GET /api/super-admin/institutions?page=1&limit=10&search=harvard&status=ACTIVE
Authorization: Bearer <super_admin_token>

PUT /api/super-admin/institutions/:id
Authorization: Bearer <super_admin_token>

DELETE /api/super-admin/institutions/:id
Authorization: Bearer <super_admin_token>
```

#### Institute Admin Management
```http
POST /api/super-admin/institute-admins
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "Dr. John Smith",
  "email": "admin@harvard.edu",
  "phone": "+1-617-495-2000",
  "password": "secure-password123",
  "institution": "harvard-university",
  "permissions": {
    "manageUsers": true,
    "manageVerifiers": true,
    "viewAnalytics": true,
    "manageSettings": false
  }
}

GET /api/super-admin/institute-admins?page=1&limit=10&institution=harvard-university
Authorization: Bearer <super_admin_token>

PUT /api/super-admin/institute-admins/:id
Authorization: Bearer <super_admin_token>

DELETE /api/super-admin/institute-admins/:id
Authorization: Bearer <super_admin_token>
```

#### System Analytics
```http
GET /api/super-admin/analytics
Authorization: Bearer <super_admin_token>
```

**Response:**
```json
{
  "overview": {
    "totalInstitutions": 150,
    "totalInstituteAdmins": 300,
    "totalUsers": 50000,
    "totalStudents": 45000,
    "totalVerifiers": 5000,
    "activeInstitutions": 142
  },
  "recentInstitutions": [...],
  "topInstitutions": [...]
}
```

### 🏫 Institute Admin APIs

#### Authentication
```http
POST /api/institute-admin/login
Content-Type: application/json

{
  "email": "admin@harvard.edu",
  "password": "your-password"
}
```

#### Profile Management
```http
GET /api/institute-admin/me
Authorization: Bearer <institute_admin_token>

PUT /api/institute-admin/me
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "phone": "+1-617-495-2001",
  "profilePicture": "https://cloudinary.url/profile.jpg"
}

PUT /api/institute-admin/change-password
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "currentPassword": "current-password",
  "newPassword": "new-secure-password"
}
```

#### Institution Information
```http
GET /api/institute-admin/institution
Authorization: Bearer <institute_admin_token>
```

#### User Management
```http
GET /api/institute-admin/users?page=1&limit=10&search=john&role=STUDENT
Authorization: Bearer <institute_admin_token>

GET /api/institute-admin/users/:userId
Authorization: Bearer <institute_admin_token>

POST /api/institute-admin/users
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@university.edu",
  "password": "secure123",
  "role": "STUDENT",
  "bio": "Computer Science student",
  "githubUsername": "johndoe"
}

PUT /api/institute-admin/users/:userId
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "newemail@university.edu",
  "bio": "Updated bio",
  "role": "VERIFIER"
}

PUT /api/institute-admin/users/:userId/role
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "newRole": "VERIFIER"
}

PUT /api/institute-admin/users/:userId/reset-password
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "newPassword": "newSecurePassword123"
}

DELETE /api/institute-admin/users/:userId
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "action": "remove"  // "remove" or "delete"
}
```

#### Bulk User Operations
```http
POST /api/institute-admin/users/bulk-action
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "action": "update-role",
  "userIds": ["user1_id", "user2_id", "user3_id"],
  "data": {
    "newRole": "VERIFIER"
  }
}

POST /api/institute-admin/users/bulk-import
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "users": [
    {
      "name": "Alice Smith",
      "email": "alice@university.edu",
      "password": "password123",
      "role": "STUDENT",
      "bio": "Math student"
    },
    {
      "name": "Bob Johnson",
      "email": "bob@university.edu", 
      "password": "password123",
      "role": "VERIFIER",
      "bio": "CS Professor"
    }
  ]
}

GET /api/institute-admin/users/export?format=csv&role=STUDENT
Authorization: Bearer <institute_admin_token>
```

#### Association Request Management
```http
GET /api/institute-admin/association-requests?page=1&limit=10&status=PENDING
Authorization: Bearer <institute_admin_token>

PUT /api/institute-admin/association-requests/:requestId/respond
Authorization: Bearer <institute_admin_token>
Content-Type: application/json

{
  "action": "approve",
  "response": "Welcome to Harvard University!"
}
```

#### Institute Analytics
```http
GET /api/institute-admin/analytics
Authorization: Bearer <institute_admin_token>
```

**Response:**
```json
{
  "overview": {
    "totalUsers": 1250,
    "totalStudents": 1100,
    "totalVerifiers": 150,
    "pendingAssociations": 25
  },
  "recentUsers": [...],
  "userGrowth": [...],
  "roleDistribution": [...]
}
```

### 🛡️ Admin Security Features

- **🔐 Enhanced Password Security**: 8+ character minimum with bcrypt hashing
- **🚫 Account Lockout**: 5 failed attempts = 2-4 hour lockout  
- **⏰ Extended Sessions**: 8-hour admin tokens (vs 1-hour user tokens)
- **🎯 Permission-Based Access**: Granular permission control for institute admins
- **📊 Audit Trails**: Complete tracking of admin actions
- **🔄 Separate Authentication**: Independent admin auth system

### 🎯 Admin Workflow

#### Super Admin Workflow:
1. **Login** with default credentials
2. **Change Password** for security
3. **Create Institutions** with proper details
4. **Create Institute Admins** for each institution
5. **Monitor System Analytics** and manage platform

#### Institute Admin Workflow:
1. **Login** with credentials provided by Super Admin
2. **View Institution Dashboard** and analytics
3. **Manage Users** - approve associations, change roles
4. **Handle Association Requests** from students
5. **Monitor Institute Analytics** and user activity

### 🔑 Permission System

#### Super Admin Permissions (All Enabled):
- ✅ Manage Institutions
- ✅ Manage Institute Admins  
- ✅ View System Analytics
- ✅ Manage System Settings
- ✅ Access All Data

#### Institute Admin Permissions (Configurable):
- 🔧 **manageUsers**: Add/remove/update users
- 👥 **manageVerifiers**: Manage verifier accounts
- 📊 **viewAnalytics**: Access institute analytics
- ⚙️ **manageSettings**: Modify institute settings

### 📱 Frontend Integration

#### React Admin Dashboard Example:
```jsx
// Super Admin Dashboard
const SuperAdminDashboard = () => {
  const [institutions, setInstitutions] = useState([]);
  const [analytics, setAnalytics] = useState({});

  useEffect(() => {
    fetchInstitutions();
    fetchAnalytics();
  }, []);

  return (
    <div className="admin-dashboard">
      <h1>Super Admin Dashboard</h1>
      <AnalyticsCards data={analytics} />
      <InstitutionTable data={institutions} />
      <CreateInstitutionModal />
    </div>
  );
};

// Institute Admin Dashboard  
const InstituteAdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  return (
    <div className="institute-dashboard">
      <h1>Institute Admin Dashboard</h1>
      <UserManagementTable users={users} />
      <AssociationRequestsTable requests={pendingRequests} />
    </div>
  );
};
```

## 📋 API Quick Reference

```
src/
├── server.js              # Main application entry point
├── config/
│   └── db.js              # MongoDB connection setup
├── middlewares/
│   └── auth.js            # Authentication middleware
├── models/
│   ├── User.js            # User model with bio
│   ├── Experience.js      # Experience model  
│   ├── Education.js       # Education model
│   ├── GithubProject.js   # GitHub project model
│   ├── Verification.js    # Unified verification model
│   └── VerificationLog.js # Verification audit log
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── users.js           # User profile routes
│   ├── experiences.js     # Experience management routes
│   ├── education.js       # Education management routes
│   ├── githubProjects.js  # GitHub project management routes
│   ├── verification.js    # Unified verification workflow routes
│   ├── portfolio.js       # Public portfolio routes (with education & projects)
│   └── github.js          # GitHub integration routes
└── utils/
    ├── jwt.js             # JWT token utilities
    ├── email.js           # Email sending utilities
    └── cloudinary.js      # File upload utilities
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Cloudinary account (for file uploads)
- SendGrid account (for emails, optional)

## 🎬 Quick Start Example

### For Students: Request Verification in 3 Steps

1. **Browse Available Verifiers**
```javascript
// Get verifiers from your institute
const response = await fetch('/api/users/institute-verifiers?search=computer science', {
  headers: { Authorization: `Bearer ${studentToken}` }
});
const { verifiers } = await response.json();
// Shows: Dr. Smith (AI Expert), Prof. Johnson (Web Dev), etc.
```

2. **Select and Request**
```javascript
// Choose verifier and submit request
await fetch('/api/verify/request/EXPERIENCE/experience_id', {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${studentToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ verifierId: 'prof_smith_123' })
});
// ✅ Professional email sent to Dr. Smith automatically
```

3. **Get Notified**
```javascript
// Student receives email when verifier approves/rejects
// Portfolio automatically updates with verification status
```

### For Verifiers: Manage Requests from Dashboard

1. **Access Dashboard**
```javascript
// Get pending verification requests
const stats = await fetch('/api/verifier/stats', {
  headers: { Authorization: `Bearer ${verifierToken}` }
});
// Shows: 12 pending, 420 students, 188 completed
```

2. **Review & Approve**
```javascript
// Approve with comment
await fetch('/api/verifier/approve/request_id', {
  method: 'POST',
  headers: { Authorization: `Bearer ${verifierToken}` }, 
  body: JSON.stringify({ comment: "Excellent work!" })
});
// ✅ Student gets approval notification automatically
```

### 🎯 Why This is Better

| Old Way | 🆕 Enhanced Way |
|---------|----------------|
| Student guesses verifier email | 🎨 Visual verifier browsing |
| No verifier information | 📊 See expertise, stats, activity |
| Basic text emails | 📧 Professional branded emails |
| Manual verification tracking | 📈 Complete dashboard & analytics |
| No search/filtering | 🔍 Smart search by expertise |
| Email-only verification | ⚡ One-click email-to-dashboard |

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TruePortMe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/trueportme
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=1h
   CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
   CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret
   SENDGRID_API_KEY=your-sendgrid-api-key
   FROM_EMAIL=noreply@trueportme.com
   FRONTEND_URL=http://localhost:3001
   ```

4. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start at `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "STUDENT",
  "institute": "MIT"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### User Profile

#### Get Profile
```http
GET /users/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "githubUsername": "johndoe",
  "bio": "Full-stack developer passionate about AI",
  "institute": "MIT",
  "profileJson": {
    "skills": ["JavaScript", "Python", "React"]
  }
}
```

#### Get Users by Institute
```http
GET /users/institute/:instituteName
```

Query parameters:
- `role`: Filter by role (STUDENT, VERIFIER, ADMIN)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

Example:
```http
GET /users/institute/MIT?role=VERIFIER
```### Education

#### Create Education Entry
```http
POST /education
Authorization: Bearer <token>
Content-Type: application/json

{
  "courseType": "BACHELORS",
  "courseName": "Bachelor of Technology in Computer Science",
  "boardOrUniversity": "XYZ University",
  "schoolOrCollege": "ABC College of Engineering",
  "passingYear": 2024,
  "isExpected": false,
  "grade": "A+",
  "percentage": 85.5,
  "cgpa": 8.5,
  "description": "Specialized in Software Engineering and AI",
  "attachments": ["https://cloudinary-url/degree-certificate.pdf"]
}
```

#### Get My Education Entries
```http
GET /education
Authorization: Bearer <token>
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `verified`: Filter by verification status (true/false)
- `courseType`: Filter by course type (10TH, 12TH, DIPLOMA, BACHELORS, MASTERS, PHD, CERTIFICATE, OTHER)

### GitHub Projects

#### Create GitHub Project Entry
```http
POST /github-projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "repositoryUrl": "https://github.com/username/project-name",
  "projectName": "E-commerce Platform",
  "description": "A full-stack e-commerce platform built with React and Node.js",
  "learnings": "Learned advanced React patterns, payment integration, and microservices architecture",
  "technologies": ["React", "Node.js", "MongoDB", "Stripe"],
  "liveUrl": "https://myproject.herokuapp.com",
  "projectType": "PERSONAL"
}
```

#### Get My GitHub Projects
```http
GET /github-projects
Authorization: Bearer <token>
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `verified`: Filter by verification status (true/false)
- `projectType`: Filter by project type (PERSONAL, ACADEMIC, PROFESSIONAL, OPEN_SOURCE, HACKATHON, OTHER)
- `technologies`: Comma-separated technologies
- `isLive`: Filter by live status (true/false)

### Experiences

#### Create Experience
```http
POST /experiences
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Software Engineer Intern",
  "description": "Worked on web development projects",
  "role": "Intern",
  "startDate": "2023-06-01",
  "endDate": "2023-08-31",
  "tags": ["JavaScript", "React", "Node.js"],
  "attachments": ["https://cloudinary-url/certificate.pdf"]
}
```

#### Get My Experiences
```http
GET /experiences
Authorization: Bearer <token>
```

Query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `verified`: Filter by verification status (true/false)
- `tags`: Comma-separated tags

#### Upload File
```http
POST /experiences/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary-file>
```

### 🔐 Enhanced Verification System

> **Better UX**: Students can now browse and select verifiers from their institute instead of guessing email addresses!

#### 1. Browse Available Verifiers (Students)
```http
GET /users/institute-verifiers
Authorization: Bearer <student_token>
```

**Query Parameters:**
- `search` (optional): Search by name, department, expertise
- `department` (optional): Filter by department
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response:**
```json
{
  "institute": "Harvard University",
  "verifiers": [
    {
      "id": "verifier_id_123",
      "name": "Dr. John Smith",
      "email": "john.smith@harvard.edu",
      "bio": "Professor of Computer Science specializing in AI",
      "department": "Computer Science",
      "designation": "Professor",
      "expertise": ["AI", "Machine Learning", "Data Science"],
      "verificationsCompleted": 45,
      "joinedAt": "2023-01-15T00:00:00Z",
      "isActive": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 15, "pages": 2 }
}
```

**Example Requests:**
```http
GET /users/institute-verifiers?search=computer&department=CS
GET /users/institute-verifiers?search=AI&page=1&limit=10
```

#### 2. Request Verification (Enhanced)
```http
POST /verify/request/:itemType/:itemId
Authorization: Bearer <student_token>
Content-Type: application/json
```

**Enhanced Options - Use Either:**
```json
{
  "verifierId": "verifier_id_123"  // ✅ Recommended: Use verifier ID
}
```
```json
{
  "verifierEmail": "mentor@university.edu"  // Legacy: Still supported
}
```

**Item Types:**
- `EXPERIENCE`: For work experiences and internships
- `EDUCATION`: For educational qualifications
- `GITHUB_PROJECT`: For coding projects

**Security Features:**
- ✅ **Institute Matching**: Only verifiers from same institute
- ✅ **Duplicate Prevention**: No multiple pending requests
- ✅ **Auto-Expiry**: Requests expire in 72 hours
- ✅ **Email Notifications**: Professional verification emails sent

**Examples:**
```http
POST /verify/request/EXPERIENCE/64a1b2c3d4e5f6789012345
Body: { "verifierId": "prof_smith_123" }

POST /verify/request/EDUCATION/64a1b2c3d4e5f6789012346  
Body: { "verifierId": "dr_johnson_456" }

POST /verify/request/GITHUB_PROJECT/64a1b2c3d4e5f6789012347
Body: { "verifierId": "prof_davis_789" }
```

**Response:**
```json
{
  "message": "Verification request sent successfully",
  "verification": {
    "id": "verification_request_id",
    "itemType": "EXPERIENCE",
    "verifierEmail": "john.smith@harvard.edu",
    "verifierName": "Dr. John Smith",
    "status": "PENDING",
    "expiresAt": "2025-09-30T15:30:00Z"
  }
}
```

#### 3. Get Verification Details (Public - For Verifiers)
```http
GET /verify/:token
```

**Enhanced Response:**
```json
{
  "id": "verification_id",
  "student": {
    "name": "John Doe",
    "email": "john@university.edu",
    "institute": "Harvard University"
  },
  "verifier": {
    "name": "Prof. Smith",
    "email": "prof@university.edu", 
    "institute": "Harvard University"
  },
  "itemType": "EXPERIENCE",
  "item": {
    "title": "Software Engineering Intern",
    "description": "Worked on React applications...",
    "startDate": "2023-06-01",
    "endDate": "2023-08-31",
    "attachments": ["certificate.pdf"]
  },
  "status": "PENDING",
  "requestedAt": "2025-09-27T10:30:00Z"
}
```

#### 4. Approve/Reject Verification (Public)
```http
POST /verify/:token/approve
Content-Type: application/json

{
  "actorEmail": "mentor@example.com",
  "comment": "Excellent work and genuine experience"
}
```

```http
POST /verify/:token/reject
Content-Type: application/json

{
  "actorEmail": "mentor@example.com", 
  "comment": "Unable to verify this experience"
}
```

### 📊 Verifier Dashboard APIs

> **Complete verifier management system with institution-based access control**

#### Get Dashboard Statistics
```http
GET /verifier/stats
Authorization: Bearer <verifier_token>
```

**Response:**
```json
{
  "pendingVerifications": 12,
  "studentsInInstitute": 420,
  "completedVerifications": 188,
  "totalRequests": 200
}
```

#### Get Pending Requests (Quick Dashboard View)
```http
GET /verifier/pending-requests?limit=5
Authorization: Bearer <verifier_token>
```

**Response:**
```json
{
  "requests": [
    {
      "_id": "req123",
      "studentId": "user456", 
      "studentName": "John Doe",
      "studentEmail": "john@university.edu",
      "type": "EXPERIENCE",
      "title": "Software Intern at Google",
      "description": "Worked on React applications...",
      "createdAt": "2025-09-26T10:30:00Z"
    }
  ]
}
```

#### Get All Verification Requests (Paginated)
```http
GET /verifier/requests?status=PENDING&page=1&limit=20
Authorization: Bearer <verifier_token>
```

**Query Parameters:**
- `status`: PENDING | APPROVED | REJECTED | ALL
- `itemType`: EXPERIENCE | EDUCATION | GITHUB_PROJECT  
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search student names or item titles

#### Get Single Request Details
```http
GET /verifier/request/:requestId
Authorization: Bearer <verifier_token>
```

#### Approve/Reject Requests (Verifier Dashboard)
```http
POST /verifier/approve/:requestId
Authorization: Bearer <verifier_token>
Content-Type: application/json

{
  "comment": "Excellent work and genuine experience"
}
```

```http
POST /verifier/reject/:requestId  
Authorization: Bearer <verifier_token>
Content-Type: application/json

{
  "comment": "Unable to verify this experience"
}
```

**Response:**
```json
{
  "ok": true,
  "requestId": "req123", 
  "status": "APPROVED"
}
```

#### Get Institute Students
```http
GET /verifier/institute-students?page=1&limit=12&search=
Authorization: Bearer <verifier_token>
```

#### Get Student Details
```http
GET /verifier/student/:studentId
Authorization: Bearer <verifier_token>
```

#### Get Analytics Data
```http
GET /verifier/analytics?from=2025-01-01&to=2025-09-30
Authorization: Bearer <verifier_token>
```

#### Resend Verification Email
```http
POST /verifier/notify-resend/:requestId
Authorization: Bearer <verifier_token>
Content-Type: application/json

{
  "email": "override@university.edu"  // Optional email override
}
```

### 🎯 Student Verification Workflow

1. **Browse Verifiers**: Student calls `/users/institute-verifiers` to see available verifiers
2. **Visual Selection**: Frontend shows verifier cards with profiles, expertise, and stats  
3. **Smart Filtering**: Search by name, department, or expertise areas
4. **One-Click Request**: Submit verification with verifier ID (no email guessing!)
5. **Professional Emails**: Verifier receives beautiful verification email with direct links
6. **Dashboard Access**: Verifier can manage all requests from centralized dashboard
7. **Real-time Notifications**: Both parties get email updates on status changes

### 🔒 Security & Features

- **🏫 Institute-Based Access**: Only same-institute verifications allowed
- **📧 Enhanced Emails**: Professional, branded verification emails
- **⏰ Auto-Expiry**: Requests expire in 72 hours
- **📊 Rich Analytics**: Comprehensive verification tracking
- **🔍 Smart Search**: Advanced filtering and search capabilities
- **📱 Mobile-Friendly**: Responsive design for all devices
- **♿ Accessible**: ARIA compliance and keyboard navigation

### Portfolio

#### Get Public Portfolio
```http
GET /portfolio/:userId
```

**Response includes:**
- User profile with bio
- Verified experiences (with verifier comments and timestamps)
- **Latest education entry** (at top, with verification details)
- **Latest GitHub project** (at top, with verification details)  
- All verified education entries (with verifier comments)
- All verified GitHub projects (with verifier comments)
- GitHub repositories
- Portfolio statistics

**Verification Details in Response:**
Each verified item includes:
- `verified`: Boolean status
- `verifiedAt`: Timestamp of verification
- `verifiedBy`: Email of verifier
- `verifierComment`: Comment from verifier (if provided)

#### Search Portfolios
```http
GET /portfolio
```

Query parameters:
- `search`: Search in name, email, GitHub username, or institute
- `tags`: Filter by experience tags
- `role`: Filter by user role (STUDENT, VERIFIER, ADMIN)
- `institute`: Filter by institute name
- `hasGithub`: Filter users with GitHub profiles (true/false)
- `page`: Page number
- `limit`: Items per page

### GitHub Integration

#### Get User's Repositories
```http
GET /github/public/:username
```

Query parameters:
- `page`: Page number
- `per_page`: Items per page (max 100)
- `sort`: Sort order (updated, created, pushed, full_name)

#### Get Repository Details
```http
GET /github/repo/:username/:repo
```

## 🎨 Frontend Integration

### React Component Example

```jsx
import { useState } from 'react';

function VerificationRequestButton({ item, itemType }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        🔍 Request Verification
      </button>
      
      {showModal && (
        <VerificationRequestModal
          item={item}
          itemType={itemType}
          onClose={() => setShowModal(false)}
          onSuccess={(result) => {
            toast.success(`Verification request sent to ${result.verifierName}!`);
          }}
        />
      )}
    </>
  );
}
```

### Key Frontend Features to Implement

- **📋 Verifier Browser**: Card-based verifier selection with search/filter
- **🔍 Smart Search**: Real-time search by expertise, department, name
- **📊 Verifier Profiles**: Show bio, expertise, verification stats
- **✨ Smooth UX**: Multi-step modal (Select → Confirm → Loading → Success)
- **📱 Responsive**: Mobile-optimized verification flow
- **♿ Accessible**: ARIA compliance and keyboard navigation

### Recommended Frontend Stack

- **React 18** with hooks for component logic
- **CSS Modules** or **Styled Components** for styling
- **React Query** or **SWR** for data fetching and caching
- **React Hook Form** for form handling
- **React Hot Toast** for notifications
- **Framer Motion** for smooth animations (optional)

### API Integration Pattern

```javascript
// Custom hook for verifier management
const useVerifiers = (searchTerm, department) => {
  return useQuery({
    queryKey: ['verifiers', searchTerm, department],
    queryFn: () => fetchVerifiers({ search: searchTerm, department }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Custom hook for verification requests
const useVerificationRequest = () => {
  return useMutation({
    mutationFn: ({ itemType, itemId, verifierId }) => 
      submitVerificationRequest(itemType, itemId, verifierId),
    onSuccess: (data) => {
      toast.success(`Request sent to ${data.verifierName}!`);
    }
  });
};
```

---

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For support, email [support@trueportme.com](mailto:support@trueportme.com) or create an issue in the repository.

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Expiration**: 1-hour token expiry
- **Rate Limiting**: API rate limits to prevent abuse
- **Input Validation**: Mongoose schema validation
- **File Upload Security**: Type and size restrictions
- **CORS Configuration**: Controlled cross-origin access

## 🚀 Deployment

### Environment Variables (Production)

Ensure all environment variables are set in your production environment:

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trueportme
JWT_SECRET=your-production-jwt-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://your-frontend-domain.com
```



## 🆘 Support

For support, email support@trueportme.com or create an issue in the repository.
