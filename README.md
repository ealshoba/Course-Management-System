# Course Management System

A full-stack Course Management System developed independently as a university project. The application supports three roles: **Administrators, Teaching Assistants, and Students**.

## Features

- User authentication and role-based authorization
- Course and section management
- Student enrollment and management
- Signup sheet and time-slot management
- Grade entry, modification, and audit history
- Password hashing and JWT-based authentication
- Protected frontend routes and backend API endpoints
- Persistent JSON-based data storage
- REST API communication between the frontend and backend

## Running the Project

### Backend

Navigate to the `server` folder and install the required dependencies:

```bash
cd server
npm install
npm install bcryptjs jsonwebtoken dotenv nodemon
```

Create a `.env` file inside the `server` folder:

```bash
JWT_SECRET=mySuperSecretKey
JWT_EXPIRES=10h
```

The application requires an administrator account to be created manually in `server/data/users.json`.
Add the following object to the `users.json` file:

```bash
{
  "memberId": "M0000001",
  "email": "admin@gmail.com",
  "password": "$2b$10$8m42dXdhw1MreHROo3Et0.QGkhCG4aLwn3jrn4qYUqYRpCeV/P8G2",
  "role": "admin",
  "mustChangePassword": true
}
```

The password for this account is: `admin`

Start the backend server:
```bash
npx nodemon server.js
```

### Frontend
Open a new terminal and navigate to the `client` folder:
```bash
cd client
npm install
npm install jwt-decode
```

Start the frontend development server:
```bash
npm run dev
```
Vite will display the local URL where the application can be accessed.
