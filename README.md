# 🚗 AutoFlow Management System

A modern full-stack car cleaning subscription and payment management platform built using React, Node.js, Express, and MongoDB.

AutoFlow helps car cleaning businesses manage customers, monthly subscriptions, payment tracking, service records, and WhatsApp billing reminders through a clean and responsive dashboard.

---

# ✨ Features

- 👥 Customer Management
- 📅 Monthly Billing Cycle
- 💰 Payment Tracking
- ✅ Daily Cleaning Status
- ❌ Missed Day Management
- 📊 Revenue Analytics Dashboard
- 📱 WhatsApp Payment Reminder Integration
- 🗂 Global Ledger History
- 🔍 Search & Filter Customers
- 📈 Paid & Pending Tracking
- 📲 Mobile Responsive UI
- ⚡ Fast and Optimized Performance

---

# 🛠 Tech Stack

## Frontend
- React 19
- Vite
- Tailwind CSS 4
- Axios
- Lucide React Icons

## Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- dotenv
- CORS
- QRCode

---

# 📂 Project Structure

```bash
autoflow-management/
│
├── client/
│   ├── src/
│   ├── public/
│   ├── package.json
│
├── server/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   ├── package.json
│
├── README.md
```

---

# 🚀 Main Functionalities

## 👤 Customer Management
- Add customers
- Edit customer details
- Remove/deactivate customers
- Store customer phone numbers and monthly plans

## 📅 Monthly Billing System
- Initialize monthly billing cycle
- Generate monthly payment records
- Track monthly subscriptions

## 💳 Payment Management
- Mark payments as Paid or Pending
- View collected revenue
- Track pending dues
- Maintain payment history

## 🚗 Daily Service Tracking
- Track daily cleaning status
- Mark cleaned or missed services
- Calculate deductions automatically

## 📲 WhatsApp Integration
- Send payment bills
- Send payment reminders
- Send thank-you messages
- Auto-generate WhatsApp payment texts

## 📊 Dashboard Analytics
- Total customers
- Expected revenue
- Collected payments
- Pending dues

## 🗃 Global History Ledger
- Month-wise payment records
- Customer payment history
- Revenue history tracking

---

# 🎨 UI Highlights

- Modern responsive dashboard
- Mobile-friendly design
- Interactive cards and tables
- Smooth modal interactions
- Real-time updates
- Toast notifications
- Clean Tailwind CSS interface

---

# ⚙️ Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on:

```bash
http://localhost:5173
```

---

# ⚙️ Backend Setup

```bash
cd server
npm install
npm start
```

Backend runs on:

```bash
http://localhost:5000
```

---

# 🔐 Environment Variables

Create a `.env` file inside the server folder.

```env
MONGO_URI=your_mongodb_connection
PORT=5000
```

---

# 📦 Frontend Dependencies

```json
{
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "vite": "^8.0.4",
  "tailwindcss": "^4.2.2",
  "axios": "^1.15.0",
  "lucide-react": "^1.8.0"
}
```

---

# 📦 Backend Dependencies

```json
{
  "express": "^5.2.1",
  "mongoose": "^9.4.1",
  "dotenv": "^17.4.2",
  "cors": "^2.8.6",
  "qrcode": "^1.5.4",
  "nodemon": "^3.1.14"
}
```

---

# 🔄 Application Workflow

```text
Add Customer
      ↓
Initialize Billing Month
      ↓
Track Daily Cleaning
      ↓
Calculate Missed Days
      ↓
Send Payment Request
      ↓
Receive Payment
      ↓
Mark as Paid
      ↓
Store in Global History
```

---

# 🌟 Future Improvements

- 🔐 Authentication System
- ☁ Cloud Backup
- 📱 Mobile Application
- 📈 Advanced Analytics
- 💳 Online Payment Gateway
- 📄 Invoice PDF Generation
- 🔔 SMS Notifications
- 📅 Automated Billing

---

# 🧠 Learning Outcomes

This project demonstrates:

- Full Stack MERN Development
- REST API Integration
- MongoDB Database Management
- React State Management
- Responsive UI Design
- Business Workflow Automation
- Subscription Billing Logic
- Payment Tracking System

---

# 📌 Use Case

AutoFlow is designed for:

- Car Cleaning Services
- Subscription Businesses
- Customer Billing Management
- Small Business Payment Tracking

---

# 👨‍💻 Author

Developed by **Ajith K**

Frontend Developer | MERN Stack Developer

---

# 📃 License

This project is licensed under the MIT License.

---

# ⭐ Project Summary

AutoFlow Management System is a professional car cleaning subscription management platform that simplifies customer handling, payment collection, service tracking, and monthly billing operations using a clean modern dashboard experience.
