# TruePortMe Backend

A career passport platform where students and professionals can store their experiences and have them verified by mentors. Each user gets a public portfolio showcasing their verified achievements.

## 🚀 Features

- **User Authentication**: JWT-based auth with bcrypt password hashing
- **Experience Management**: Create, update, and manage career experiences
- **Education Management**: Add and verify educational qualifications
- **GitHub Projects**: Showcase projects with learnings and live URLs
- **Unified Verification System**: Request verification for experiences, education, and projects
- **Portfolio Display**: Public portfolios with latest education and projects highlighted
- **File Upload**: Cloudinary integration for certificates and proof documents
- **GitHub Integration**: Display public repositories in portfolios
- **Email Notifications**: SendGrid integration for verification requests

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens
- **File Storage**: Cloudinary
- **Email**: SendGrid
- **External APIs**: GitHub API

## 📁 Project Structure

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

### Verification

#### Request Verification (Universal)
```http
POST /verify/request/:itemType/:itemId
Authorization: Bearer <token>
Content-Type: application/json

{
  "verifierEmail": "mentor@example.com"
}
```

**Item Types:**
- `EXPERIENCE`: For work experiences
- `EDUCATION`: For education entries  
- `GITHUB_PROJECT`: For GitHub projects

**Examples:**
```http
POST /verify/request/EXPERIENCE/64a1b2c3d4e5f6789012345
POST /verify/request/EDUCATION/64a1b2c3d4e5f6789012346
POST /verify/request/GITHUB_PROJECT/64a1b2c3d4e5f6789012347
```

#### Get Verification Details (Public)
```http
GET /verify/:token
```

#### Approve Verification (Public)
```http
POST /verify/:token/approve
Content-Type: application/json

{
  "actorEmail": "mentor@example.com",
  "comment": "Excellent work and contribution"
}
```

#### Reject Verification (Public)
```http
POST /verify/:token/reject
Content-Type: application/json

{
  "actorEmail": "mentor@example.com",
  "comment": "Unable to verify this experience"
}
```

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

### Deployment Platforms

#### Heroku
```bash
# Install Heroku CLI and login
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your-mongodb-uri
# ... set other environment variables
git push heroku main
```

#### Render
1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically on push

## 🧪 Testing

```bash
# Run tests (add test scripts to package.json)
npm test
```

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🆘 Support

For support, email support@trueportme.com or create an issue in the repository.