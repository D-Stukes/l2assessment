# Customer Inbox Triage App

## Overview

The Customer Inbox Triage app is a lightweight AI-powered tool that helps classify customer support messages and recommend actions. It uses Groq AI to categorize messages, applies rule-based urgency scoring, and suggests next steps based on predefined templates.

## Problem Statement

Support teams waste time manually reading and triaging customer messages. This tool provides an automated first pass at classification to help prioritize and route messages more efficiently.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express API (`server/`)
- **Database**: SQLite (built into Node 22+), stored in `server/data/relay.db`
- **Auth**: Email and password login with httpOnly session cookies
- **AI**: Groq API (Llama 3.3 70B - Free tier), called from the server

## Setup Instructions

### Prerequisites

- Node.js (v22.13 or higher, for the built-in SQLite module)
- npm or yarn
- Groq API key (FREE - get from https://console.groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "L2 assessment"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Groq API Key**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Groq API key:
   ```
   GROQ_API_KEY=gsk_your-actual-key-here
   ```

   Only the server reads this key, so it never reaches the browser.
   
   Get your FREE API key from: https://console.groq.com/keys
   
   **Why Groq?** Groq offers a generous free tier with fast inference and no credit card required!

4. **Run the application**
   ```bash
   npm run dev
   ```
   
   This starts the API on `http://localhost:3001` and the app on `http://localhost:5173`.
   On first run the server creates the database with two demo companies:

   | Email | Company |
   |---|---|
   | maria@acme.test, sam@acme.test | Acme Outfitters |
   | priya@brightside.test, leo@brightside.test | Brightside Dental |

   The password for every demo account is `relay123`. Delete `server/data/` to reset the data.

5. **Run the API tests**
   ```bash
   npm test
   ```

## Company Portal

Log in to see the **Portal** page for your company:

- Your company name
- **Open and pending tickets**, each with the date and time created, status, and assigned responder.
  Change the status or responder and click Save to store the change.
- **Message history and resolutions** for resolved tickets. A resolution is required to mark a ticket resolved.

Every API query is filtered by the logged-in user's company, so users only ever see their own company's data.

### API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Log in with `{ email, password }` |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Current user and company |
| GET | `/api/tickets?status=` | The company's tickets, optionally by status |
| POST | `/api/tickets` | Analyze `{ message }` and save it as an Open ticket |
| PATCH | `/api/tickets/:id` | Update `status`, `responderId`, and/or `resolution` |
| GET | `/api/responders` | The company's team members |

## How It Works

1. **Paste Message**: User pastes a customer support message into the text area
2. **Analyze**: Click "Analyze Message" to process the input
3. **Classification**: The app runs three processes in parallel:
   - **Category Classification** (LLM): Uses Groq AI (Llama 3.3 70B) to categorize the message
   - **Urgency Scoring** (Rule-based): Applies simple rules to determine urgency
   - **Recommendation** (Template-based): Maps category to a recommended action
4. **Display Results**: Shows category, urgency tag, recommended action, and AI reasoning
5. **History**: Each analysis is saved in the database as a ticket for your company, viewable in the History tab and the Portal


## Example Test Messages

Try analyzing these messages to see how the triage system works:

### Example 1: Production Issue
```
Our production server is down
```

### Example 2: Customer Feedback
```
Hi there! I just wanted to say thank you for your amazing customer service. I've been using your product for three years now and I'm really happy with it. Keep up the great work!
```

### Example 3: Feature Request
```
I would love to see a dark mode option in the app. It would be much easier on my eyes during night time usage.
```

### Example 4: Payment Issue
```
I tried to update my payment method but the page keeps loading forever. Is this a known issue?
```

### Example 5: Billing Question
```
Can I upgrade my subscription to the pro plan?
```

### Example 6: Technical Support
```
The dashboard won't load when I try to access it. I've tried refreshing but it keeps timing out.
```

## Security Note

⚠️ **Warning**: This application exposes the Groq API key in the browser (using `dangerouslyAllowBrowser: true`). This is acceptable for local development only but should **NEVER** be done in production. In a real application, API calls should be made from a secure backend server.

## Why Groq?

- ✅ **Completely Free** - No credit card required
- ✅ **Fast Inference** - Groq's LPU technology is incredibly fast
- ✅ **Generous Limits** - ~14,400 requests/day on free tier
- ✅ **High Quality** - Llama 3.3 70B performs excellently
- ✅ **Easy Signup** - Get started in minutes at https://console.groq.com

## License

This project is for educational purposes only.
