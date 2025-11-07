Frontend
- **React** 18.2.0 - UI framework
- **React Router** 6.8.0 - Client-side routing
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **Recharts** - Data visualization
- **jsPDF** - PDF generation
- React Hot Toast - Notifications
- TailwindCSS- Styling (via CDN)

Backend
- Node.js - Runtime environment
- Express.js- Web framework
- Firebase Admin SDK- Backend Firebase integration
- Nodemailer - Email service
- PDFKit - PDF generation
- Node-Cron- Scheduled tasks


Database & Storage
- Firebase Firestore - NoSQL database
- Firebase Storage - File storage
- Firebase Authentication - User authentication

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** (v6 or higher) - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Firebase Account** - [Sign up](https://firebase.google.com/)
- **Gmail Account** (for email notifications) - [Sign up](https://gmail.com/)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/freelancedash.git
cd freelancedash
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

**Backend Dependencies:**
```json
{
  "axios": "^1.10.0",
  "bcryptjs": "^3.0.2",
  "cors": "^2.8.5",
  "dotenv": "^16.6.1",
  "express": "^4.21.2",
  "firebase": "^12.2.1",
  "firebase-admin": "^12.0.0",
  "http-proxy-middleware": "^3.0.5",
  "joi": "^18.0.1",
  "multer": "^1.4.5-lts.1",
  "node-cron": "^4.2.1",
  "nodemailer": "^6.9.7",
  "otp-generator": "^4.0.1",
  "pdfkit": "^0.14.0"
}
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

**Frontend Dependencies:**
```json
{
  "axios": "^1.10.0",
  "date-fns": "^2.30.0",
  "firebase": "^10.14.1",
  "jspdf": "^3.0.3",
  "jspdf-autotable": "^5.0.2",
  "lucide-react": "^0.294.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-hook-form": "^7.48.2",
  "react-hot-toast": "^2.4.1",
  "react-router-dom": "^6.8.0",
  "react-scripts": "5.0.1",
  "recharts": "^2.8.0"
}
```

---

## 🔐 Environment Variables

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Firebase Admin SDK Configuration
# Option 1: Using individual fields
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Option 2: Using service account JSON (alternative to Option 1)
# FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"..."}'

# Firebase API Key (for password verification)
FIREBASE_API_KEY=your-firebase-api-key

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Client URL (for invitation links)
CLIENT_URL=http://localhost:3000
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# API Configuration
REACT_APP_API_URL=http://localhost:5000
```

---

## 🔥 Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "FreelanceDash")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Firebase Services

#### **Firestore Database**
1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** or **Test mode**
4. Select your region
5. Click "Enable"

#### **Authentication**
1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication
3. Click "Save"

#### **Storage**
1. Go to **Storage**
2. Click "Get started"
3. Choose **Production mode** or **Test mode**
4. Click "Done"

### 3. Get Firebase Configuration

#### **For Frontend (Web App)**
1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click **Web** icon (`</>`)
4. Register your app (e.g., "FreelanceDash Web")
5. Copy the `firebaseConfig` object
6. Add values to `frontend/.env`

#### **For Backend (Admin SDK)**
1. Go to **Project Settings** → **Service accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Extract values and add to `backend/.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - etc.

**OR** use the entire JSON:
```env
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

### 4. Firestore Security Rules

Go to **Firestore Database** → **Rules** and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Projects collection
    match /projects/{projectId} {
      allow read: if request.auth.uid == resource.data.freelancerId 
                  || request.auth.uid == resource.data.clientId;
      allow write: if request.auth.uid == resource.data.freelancerId;
    }
    
    // Invoices collection
    match /invoices/{invoiceId} {
      allow read: if request.auth.uid == resource.data.freelancerId 
                  || request.auth.uid == resource.data.clientId;
      allow write: if request.auth.uid == resource.data.freelancerId;
    }
    
    // Allow read/write for other collections based on user authentication
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Storage Security Rules

Go to **Storage** → **Rules** and add:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /progress_updates/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    match /contracts/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📧 Email Configuration

### Gmail App Password Setup

1. Go to your [Google Account](https://myaccount.google.com/)
2. Navigate to **Security**
3. Enable **2-Step Verification** (if not already enabled)
4. Go to **App passwords**
5. Select app: **Mail**
6. Select device: **Other** (enter "FreelanceDash")
7. Click **Generate**
8. Copy the 16-character password
9. Add to `backend/.env`:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   ```

### Email Features

The system sends emails for:
- ✅ User registration (OTP verification)
- ✅ Password reset (OTP)
- ✅ Project invitations
- ✅ Contract signing
- ✅ Milestone approvals
- ✅ Payment reminders (automated cron job)
- ✅ Progress update notifications
- ✅ Invoice delivery

---

## 🏃 Running the Application

### Development Mode

#### 1. Start Backend Server

```bash
cd backend
npm run dev
```

Server runs on: `http://localhost:5000`

#### 2. Start Frontend Development Server

```bash
cd frontend
npm start
```

Frontend runs on: `http://localhost:3000`

### Production Mode

#### Backend

```bash
cd backend
npm start
```

#### Frontend

```bash
cd frontend
npm run build
# Serve the build folder with a static server
```

---

## 📁 Project Structure

```
freelancedash/
├── backend/
│   ├── jobs/
│   │   └── reminderCron.js          # Scheduled payment reminders
│   ├── models/
│   │   ├── Invoice.js               # Invoice model
│   │   └── ...
│   ├── routes/
│   │   ├── auth.js                  # Authentication routes
│   │   ├── projects.js              # Project CRUD
│   │   ├── invoices.js              # Invoice management
│   │   ├── contracts.js             # Contract handling
│   │   ├── payments.js              # Payment processing
│   │   ├── approvals.js             # Milestone approvals
│   │   ├── email.js                 # Email sending
│   │   └── uploads.js               # File uploads
│   ├── services/
│   │   ├── emailService.js          # Email templates & sending
│   │   ├── paymentReminderService.js # Reminder logic
│   │   ├── progressTrackingService.js
│   │   ├── timeTrackingService.js
│   │   └── deadlineMonitoringService.js
│   ├── utils/
│   │   ├── pdfGenerator.js          # PDF invoice generation
│   │   ├── projectStatusUpdater.js  # Auto-update project status
│   │   └── validation.js            # Input validation
│   ├── firebase-admin.js            # Firebase Admin initialization
│   ├── server.js                    # Express server entry point
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddProjectModal.jsx
│   │   │   ├── ClientProgressView.jsx
│   │   │   ├── FreelancerProgressTracker.jsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Projects.jsx
│   │   │   ├── ProjectTracking.jsx
│   │   │   ├── Invoices.jsx
│   │   │   ├── Finances.jsx
│   │   │   ├── ClientDashboard.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── invoiceService.js
│   │   │   ├── projectService.js
│   │   │   ├── transactionService.js
│   │   │   ├── mockPaymentService.js
│   │   │   └── reminderSettingsService.js
│   │   ├── models/
│   │   │   ├── Invoice.js
│   │   │   ├── Transaction.js
│   │   │   └── ReminderSettings.js
│   │   ├── utils/
│   │   │   └── validation.js
│   │   ├── firebase-config.js       # Firebase client initialization
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── .env
│
└── README.md
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "role": "freelancer" // or "client"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Project Endpoints

#### Create Project
```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Website Redesign",
  "description": "Redesign company website",
  "startDate": "2024-01-01",
  "dueDate": "2024-03-01",
  "hourlyRate": 50,
  "clientEmail": "client@example.com",
  "milestones": [...]
}
```

#### Get Projects
```http
GET /api/projects
Authorization: Bearer <token>
```

### Invoice Endpoints

#### Create Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "project-id",
  "clientId": "client-id",
  "lineItems": [...],
  "dueDate": "2024-02-01"
}
```

#### Send Invoice Email
```http
POST /api/email/send-invoice
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "invoice-id"
}
```

### Payment Endpoints

#### Process Payment (Mock)
```http
POST /api/payments/process
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "invoice-id",
  "amount": 1000,
  "paymentMethod": "credit_card"
}
```

### Contract Endpoints

#### Sign Contract
```http
POST /api/contracts/:contractId/sign
Authorization: Bearer <token>
Content-Type: application/json

{
  "signature": "John Doe",
  "signedAt": "2024-01-15T10:00:00Z"
}
```

### File Upload Endpoints

#### Upload Progress Update File
```http
POST /api/uploads/progress-update
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "file": <file>,
  "projectId": "project-id",
  "userId": "user-id"
}
```

---

## 🗄️ Database Collections

### Firestore Collections

1. **users** - User accounts (freelancers & clients)
2. **projects** - Project information
3. **contracts** - Contract agreements
4. **invoices** - Billing invoices
5. **transactions** - Financial transactions
6. **invitations** - Project invitations
7. **progress_updates** - Project progress posts
8. **progress_replies** - Comments on updates
9. **tasks** - Project tasks
10. **notifications** - In-app notifications
11. **reminder_settings** - Payment reminder configuration
12. **payment_reminders** - Reminder logs

For detailed collection structure, see `FIREBASE-COLLECTIONS-ANALYSIS.md`

---

## ⏰ Scheduled Tasks

### Payment Reminder Cron Job

Runs daily at 9:00 AM to send payment reminders for:
- Upcoming invoices (7, 3, 1 days before due)
- Overdue invoices (1, 3, 7, 14 days after due)

**Configuration:** `backend/jobs/reminderCron.js`

**Cron Schedule:** `0 9 * * *` (9:00 AM daily)

To modify the schedule, edit the cron expression in `reminderCron.js`.

---

## 🚀 Deployment

### Backend Deployment (Heroku Example)

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   cd backend
   heroku create freelancedash-api
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set FIREBASE_PROJECT_ID=your-project-id
   heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   heroku config:set EMAIL_USER=your-email@gmail.com
   # ... set all other env variables
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

### Frontend Deployment (Netlify Example)

1. **Build the App**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to [Netlify](https://www.netlify.com/)
   - Drag and drop the `build` folder
   - Or connect your GitHub repository

3. **Set Environment Variables**
   - Go to Site settings → Environment variables
   - Add all `REACT_APP_*` variables

---

## 🧪 Testing

### Run Tests

```bash
# Frontend tests
cd frontend
npm test

# Backend tests (if implemented)
cd backend
npm test
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the ISC License.

---

## 🐛 Known Issues

- Payment processing is currently mocked (ready for Stripe/PayPal integration)
- Time tracking UI not fully implemented
- Mobile responsiveness needs improvement in some areas

---

## 🔮 Future Enhancements

- ✅ Real payment gateway integration (Stripe/PayPal)
- ✅ Real-time messaging between freelancers and clients
- ✅ Advanced analytics dashboards
- ✅ Mobile applications (iOS/Android)
- ✅ Multi-currency support
- ✅ Automated contract generation
- ✅ Third-party integrations (Trello, Asana, Jira)
- ✅ AI-powered time tracking and project estimation
- ✅ Two-factor authentication (2FA)
- ✅ Offline support (PWA)

---

## 📞 Support

For support, email support@freelancedash.com or open an issue on GitHub.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- Firebase for backend infrastructure
- React community for excellent documentation
- All contributors who helped with this project

---

**Made with ❤️ for freelancers worldwide**
