# WareFlow Project Documentation

## 1. Project overview

WareFlow is a full-stack retail billing, inventory, sales-operations, and business-intelligence system. It is designed for a multi-branch electronics retailer whose catalog includes laptops, desktops, all-in-one computers (AIOs), and accessories.

The application brings the daily work of administrators and salespeople into one system:

- Create and retain customer invoices, product details, split-payment details, proof documents, and sales attribution.
- Manage branches, salespeople, branch assignments, products, godowns, ledgers, stock transfers, and advance bookings.
- Track individual sales targets, product-category targets, incentives, and progress as new invoices are recorded.
- Review operational dashboards, day books, branch comparisons, device/category breakdowns, payment-mode breakdowns, and monthly/daily trends.
- Export operational data to Excel, CSV, PDF, and Tally-oriented formats.
- Email invoices and new-salesperson credentials.
- Notify internal recipients through WhatsApp.
- Let administrators ask natural-language questions about live business data through WareFlow AI.

The system has two role types:

- **Admin:** full operational views, branch and salesperson administration, targets, reporting, and the AI assistant.
- **Sales person:** billing, advance bookings, personal targets, and inventory-transfer workflows. Backend authorization is applied per endpoint.

## 2. Architecture

| Layer | Implementation | Responsibility |
|---|---|---|
| Web client | Next.js 15, React 19, TypeScript | Responsive admin/sales UI, forms, reports, charts, scanning, and client-side exports |
| API | Node.js, Express 5, JavaScript ES modules | Authentication, validation, business rules, analytics, integrations, and REST endpoints |
| Database | MongoDB through Mongoose | Operational records, users, targets, AI conversations, notification/config data |
| File storage | Cloudinary | Customer IDs, payment slips, inventory pictures, reviews, and QR-assisted uploads |
| AI | Google Gemini through `@google/genai` | Read-only, natural-language analytics over live MongoDB data |
| Messaging | Gmail SMTP, Meta WhatsApp Cloud API, Twilio WhatsApp | Invoices, credentials, internal notifications, reminders, and templates |

The frontend and backend are separate projects. The browser uses `NEXT_PUBLIC_API_URL` to call the Express API and sends the authentication cookie with `credentials: "include"`.

## 3. Main features

### 3.1 Authentication and role-based access

- Login uses a phone number and six-digit PIN.
- PINs are hashed with bcrypt before storage.
- Successful login creates a signed JWT and places it in an HTTP-only cookie; bearer tokens are also accepted by the API.
- Users can be active or inactive and can save a light/dark theme preference.
- Only an admin can create users, manage branches, delete protected records, administer targets, access admin reports, and use WareFlow AI.
- Login and GST verification are rate-limited. AI chat is limited to 30 requests per minute per IP.

### 3.2 Billing and invoice workflow

An invoice can store:

- Company, branch, salesperson, transaction date, and sale type.
- Customer/contact information, address, PIN code, email, mobile, GSTIN, and referral source.
- One or more products with category, model, serial number, check code, and price.
- Split payments across cash, bank transfer/cheque, UPI, card machine, Bajaj Finance, and supported brand-order types.
- Payment-specific identifiers such as UTR, transaction ID, cheque number, card suffix, loan ID, and validated Aadhaar/PAN fields where applicable.
- Customer ID, payment slip, up to three inventory pictures, Google review proof, and arbitrary custom fields.

On a successful billing operation, WareFlow:

1. Saves the invoice and resolves the related branch, salesperson, and product records.
2. Sends a detailed HTML/plain-text invoice to the customer if an email address was supplied.
3. Starts a non-blocking WhatsApp notification to the configured internal/admin recipient.
4. Updates active targets for the salesperson: invoice count, billing amount, or product-category progress.
5. Marks a target completed when its required value is reached.

Users can browse and filter billing records, view details, generate invoice PDFs, export data, and use the day book for date-specific review and Excel downloads.

### 3.3 Product and inventory management

- Product categories are laptops, desktops, AIOs, and accessories.
- Products include pricing, model/serial/check identifiers, branch, sales support and incentive metadata, claim/program data, and active status.
- Products can be created individually or uploaded in bulk from Excel.
- The UI supports external barcode/QR scanner input for model, serial-number, and check-code fields.
- Inventory transfers record multiple items, quantities, batch numbers, source/destination godowns, date, and creator.
- Transfer dashboards support filters, detail views, Excel output, and Tally-related actions.

### 3.4 QR-assisted mobile document upload

During invoice entry, the desktop UI can generate a session QR code. A user scans it on a mobile device, takes or selects a picture, and uploads it to that session. The invoice screen polls for uploads and can attach or remove the returned files.

Uploads are stored in Cloudinary under `billing_uploads`. Supported formats are JPEG, PNG, and PDF, with a 5 MB per-file limit. QR upload metadata is retained in MongoDB.

### 3.5 Branches, salespeople, and performance

- Admins create branches and assign one or more branches to each salesperson.
- Salesperson records contain contact data, employment ID, assigned branches, status, and theme.
- Creating a salesperson can automatically email their phone/PIN credentials and branch assignment.
- Dashboard analytics include today/week/month totals, branch performance, salesperson performance, and recent activity.
- Additional reports cover filtered billings, product performance, payment modes, and custom reporting periods.

### 3.6 Targets and incentives

Admins can create monthly, quarterly, or yearly targets for:

- Billing count.
- Billing amount.
- General sales.
- Product-category quantities.

Targets track current progress, active/completed/overdue status, incentive value, and incentive payment state. They can also be imported/exported through Excel. Salespeople have a personal target dashboard with progress visualization, time remaining, and pending incentives.

The backend contains a weekly reminder service that can send each salesperson an HTML email and WhatsApp progress summary. **Current status:** the service is implemented, but no active route or cron registration invokes it, so it will not run automatically until wired into a scheduler or endpoint.

### 3.7 Advance booking

Advance booking supports reserving products before final delivery. Each booking receives an ID such as `BID0001` and stores customer, branch, salesperson, products, payment splits, advance amount, calculated balance, delivery details, attachments, notes, and a pending/confirmed/delivered/cancelled status.

### 3.8 Ledger, GST, and Tally support

- Customer/business ledgers store contact, GST/PAN, postal address, country/state, Tally ledger group, and GST-registration type.
- GSTIN verification calls a RapidAPI GST service and can fill legal/trade name and address metadata.
- Ledger creation can generate Tally XML and post it to a locally running Tally HTTP server at `http://localhost:9000`.
- Billing and inventory-transfer controllers contain “create-and-tally” JSON preparation workflows.
- The frontend contains Excel and Tally-oriented exports for selected operational records.

Tally support is mixed: ledger XML transmission is implemented, while some historical XML/client paths are explicitly removed or stubbed. Any deployment should test each Tally button against its matching backend route before treating all Tally actions as production-ready.

## 4. Best features

### WareFlow AI over live operational data

The strongest differentiator is not a generic chatbot. WareFlow AI is an admin-only analytics agent connected to live MongoDB records through a controlled set of read-only functions. Gemini decides which function to call, the backend executes it, and Gemini turns the returned records into readable Markdown tables and insights.

It can answer questions such as:

- What are today’s, this week’s, and this month’s revenue and billing totals?
- Which branches or salespeople perform best?
- Who is assigned to each branch, and who performed within each branch?
- Which product categories and specific product models sell the most?
- Who are the top repeat customers?
- How do monthly sales and payment modes compare?
- What is the progress of all assigned targets?
- What inventory moved between particular godowns?
- What business datasets exist, and what detailed records do they contain?

Its data tools cover dashboard totals, branch performance, salesperson performance, branch-salesperson performance, assignments, inventory transfers, database overview, detailed business records, category breakdown, top products, top customers, monthly trends, payment modes, and targets.

Important AI design details:

- Uses `gemini-3.1-flash-lite` through the Google Gen AI SDK.
- Supports an agentic loop of up to five tool-call rounds per prompt.
- Executes multiple tool requests in parallel when Gemini asks for them together.
- Uses MongoDB aggregation and populated references, so answers contain current business values and readable entity names.
- Excludes the configuration collection, PIN hashes, and selected full identity-proof values from AI-accessible queries.
- Limits detailed record pages to 100 records and exposes offset/total metadata.
- Keeps conversation history in MongoDB per user; chat history can be listed, opened, renamed, searched in the UI, and deleted.
- Uses only the last ten saved messages as model context and does not trust client-supplied history.
- Renders answers with GitHub-flavored Markdown and tables in the frontend.
- Is explicitly presented as read-only and admin-only.

### End-to-end invoice automation

One submitted invoice ties together customer data, products, payment evidence, email delivery, an internal WhatsApp alert, target progress, analytics, and multiple export formats. Communication failure does not roll back an invoice that has already been saved.

### Mobile-to-desktop document capture

The session QR workflow removes the need to transfer customer or payment photos manually from a phone to the billing computer. Cloudinary then gives the application durable hosted URLs.

### Detailed Indian retail payment handling

The billing model supports Indian payment patterns—including UPI, NEFT/RTGS/IMPS, cheque, Pinelabs/Paytm machines, financing, GSTIN, PAN/Aadhaar validation, and INR-formatted reporting—rather than using a single generic payment field.

## 5. How email is sent

### Configuration

The backend uses Nodemailer with Gmail SMTP:

```env
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASSWORD=your-google-app-password
```

The transport connects to `smtp.gmail.com` on port `587` with STARTTLS (`secure: false`). For Gmail accounts with two-step verification, use an app password rather than the normal account password.

### Customer invoice email

1. Enter a valid customer email on the Invoice Form.
2. Submit the invoice.
3. `POST /api/billing` saves the billing record.
4. The backend calls `sendInvoiceEmail()` after the database transaction has committed.
5. The customer receives HTML and plain-text invoice details containing invoice ID/date, company/branch/salesperson, customer details, products, payment details, and total.

The API’s billing response reports email delivery information. If email is absent or SMTP fails, the invoice remains saved.

### New-salesperson credentials

When an admin registers a salesperson through `POST /api/auth/register`, the response returns immediately and an asynchronous task emails the user’s phone number, initial PIN, and assigned branches.

### Weekly target email

`sendWeeklyTargetReminders()` is ready to generate a progress table and email every user with active/overdue targets. It must first be connected to a cron schedule, job runner, or protected admin endpoint.

## 6. How WhatsApp messages are sent

WareFlow includes two providers for different use cases.

### Meta WhatsApp Cloud API

Used by automatic billing notifications and by the target-reminder service.

```env
WHATSAPP_API_URL=https://graph.facebook.com/v22.0
WHATSAPP_PHONE_NUMBER_ID=your-meta-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_APP_ID=your-meta-app-id
WHATSAPP_APP_SECRET=your-meta-app-secret
```

The service posts a text message to:

```text
{WHATSAPP_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages
```

The access token is read first from the MongoDB `configs` collection (`WHATSAPP_ACCESS_TOKEN`) and falls back to the environment. A non-Vercel cron in `server.js` attempts a long-lived token exchange every 30 days and saves the new token in MongoDB.

When an invoice is created, `sendWhatsAppAdminText()` sends an internal billing summary asynchronously. **Current limitation:** the destination is hard-coded in `billingController.js`; it should be changed to an environment variable before reuse or multi-tenant deployment.

Although comments call this sender “admin-only,” Meta’s conversation-window, opt-in, and message-template policies still apply. Production use should use an approved template whenever required by Meta.

### Twilio WhatsApp

Used for Twilio Content Template messages:

```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=+14155238886
```

Send a template with:

```http
POST /api/twilio/send-template
Content-Type: application/json

{
  "to": "+919876543210",
  "contentSid": "HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "variables": {
    "1": "Customer name",
    "2": "Invoice value"
  }
}
```

The service also contains `sendWhatsAppText(to, message)` for India-normalized free-form messages, but it currently has no REST route. **Security warning:** the existing Twilio template route has no authentication middleware. Protect it before exposing the API publicly to prevent unauthorized sends and billing abuse.

## 7. Technology stack

### Frontend

| Technology | Use |
|---|---|
| Next.js 15 App Router | Pages, routing, middleware, API proxy routes, production build |
| React 19 + TypeScript | Component UI and typed client logic |
| Tailwind CSS | Responsive design and dark-mode styling |
| Radix UI | Accessible dialogs, dropdowns, labels, progress, selects, toasts, and alert dialogs |
| Redux Toolkit + React Redux | Shared branch, product, salesperson, and theme state |
| Chart.js + react-chartjs-2 | Billing, sales, product, and trend charts |
| Framer Motion | Animated target progress and UI motion |
| Lucide React + React Icons | Application iconography |
| jsPDF + html2pdf.js | Browser-generated invoice/report PDFs |
| SheetJS (`xlsx`) | Excel import/export workflows |
| `qrcode` | Session QR generation for mobile uploads |
| ZXing | Barcode/QR scanner integration |
| React Markdown + remark-gfm | AI response and table rendering |
| Axios / Fetch | HTTP communication |
| Jest + Testing Library | Frontend unit/component testing |

`bcrypt` and `jsonwebtoken` also appear in frontend dependencies, but authentication is performed by the backend; these packages do not need to be shipped to browser code unless a concrete client/server use is added.

### Backend

| Library/technology | Use |
|---|---|
| Node.js ES modules | Runtime and module system |
| Express 5 | REST API and middleware pipeline |
| Mongoose 8 | MongoDB schemas, validation, indexes, aggregation, and population |
| `@google/genai` | Gemini model and function calling |
| JSON Web Token | Signed session authentication |
| bcrypt / bcryptjs | PIN hashing and verification |
| Nodemailer | Gmail SMTP emails |
| Twilio SDK | WhatsApp text/template delivery through Twilio |
| Axios | Meta, RapidAPI, Tally, and token-refresh HTTP calls |
| Multer + multer-storage-cloudinary | Multipart upload handling and Cloudinary storage |
| ExcelJS | Server-side Excel parsing/export |
| json2csv | CSV exports |
| node-cron | WhatsApp token-refresh schedule |
| express-rate-limit | Login, GST, and AI quota protection |
| cors, cookie-parser, compression | Cross-origin cookies, cookie parsing, compressed responses |
| xmlbuilder | XML construction for integrations |
| ODBC | Installed for database/integration connectivity; no active application import was found |
| dotenv | Environment configuration |
| Nodemon | Development server reload |

`body-parser` is installed but Express’s built-in JSON parser is used. Both `bcrypt` and `bcryptjs` are installed, while backend source code primarily uses `bcryptjs`.

## 8. Database

The primary database is **MongoDB**, configured by `MONGO_URI` and accessed through Mongoose. This is not a PostgreSQL or relational-database application.

| Collection/model | Purpose and important relationships |
|---|---|
| Users | Admins and salespeople; references assigned branches |
| Branches | Store locations and status |
| Products | Catalog/inventory units and sales-support metadata |
| Billings | Customer invoices; references branch, salesperson, and products |
| Targets | Sales goals; references assignee and assigning admin |
| InventoryTransfers | Item movement; references products, godowns, and creator |
| Godowns | Warehouse/source/destination master data |
| Ledgers | Customer/business ledger and GST/Tally data |
| AdvanceBookings | Reservations; references branch, users, and products |
| QRUploads | Session-based uploaded-file metadata |
| Notifications | Email/WhatsApp delivery metadata linked optionally to billing |
| AIConversations | Per-user persisted AI messages and titles |
| Configs | Runtime service configuration such as WhatsApp access token |

Indexes exist on common date, branch, salesperson, status, name, phone, and relationship fields. MongoDB connection reuse is designed for both a long-running Node process and serverless cold starts.

## 9. Third-party services

| Service | Purpose | Required configuration |
|---|---|---|
| Google Gemini | WareFlow AI analytics and function calling | `GEMINI_API_KEY` |
| MongoDB / MongoDB Atlas | Main database | `MONGO_URI` |
| Cloudinary | Billing and QR-uploaded documents | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Gmail SMTP | Invoice, credentials, and reminder emails | `EMAIL_USER`, `EMAIL_PASSWORD` |
| Meta WhatsApp Cloud API | Internal billing alerts and reminder messages | `WHATSAPP_*` variables |
| Twilio WhatsApp | Content-template and service-level text messages | `TWILIO_*` variables |
| RapidAPI GST service | GSTIN lookup and company/address metadata | `RAPIDAPI_KEY`, `RAPIDAPI_HOST` |
| Tally Prime HTTP server | Ledger XML import and Tally-oriented workflows | Local Tally server on port 9000 |
| Vercel | Supported deployment target for frontend/backend | `VERCEL`, public API/client URLs |

## 10. Configuration reference

Backend variables:

```env
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGO_URI=mongodb://127.0.0.1:27017/wareflow
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRE=1d

GEMINI_API_KEY=

EMAIL_USER=
EMAIL_PASSWORD=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RAPIDAPI_KEY=
RAPIDAPI_HOST=gst-return-status.p.rapidapi.com

WHATSAPP_API_URL=https://graph.facebook.com/v22.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_ID=
WHATSAPP_APP_SECRET=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
```

Frontend variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
# Optional server-only fallback:
API_URL=http://localhost:4000
```

Never commit real credentials. In production, use the deployment platform’s secret manager and rotate any value that has been exposed.

## 11. Running locally

Backend:

```bash
cd WareFlow-Backend
npm install
npm run dev
```

Frontend:

```bash
cd WareFlow-Frontend
npm install
npm run dev
```

The default frontend is `http://localhost:3000`; the backend is `http://localhost:4000`. `CLIENT_URL` must exactly match the frontend origin because credentialed CORS is enabled.

## 12. Implementation status and important cautions

- WareFlow AI is implemented and read-only, but it can retrieve broad operational datasets. Keep it admin-only and review output for personal/customer data before wider use.
- Invoice and credential emails are actively connected to business flows. Weekly target reminders are implemented but inactive until scheduled.
- Automatic billing WhatsApp notification uses Meta Cloud API and a hard-coded destination number.
- The Twilio template endpoint is unauthenticated and should be secured.
- QR upload create/read/delete backend endpoints do not apply authentication. Session IDs should be unguessable, expired after use, and access should be tightened for production.
- `GET /api/billing/export` and `GET /api/godowns/all` are also currently unauthenticated.
- Notification delivery records have a model, but the inspected email/WhatsApp senders do not consistently create those records.
- The frontend middleware does not list `/ai-assistant` among protected paths, although the page performs a client role check and the backend correctly enforces admin authentication. Add it to middleware for a cleaner first line of defense.
- Some frontend Tally calls and comments refer to routes no longer present in the current backend. Treat Tally integration as partially implemented and reconcile route names before production use.
- The backend has no automated test suite configured. The frontend has Jest/Testing Library configuration and an invoice-form test.

## 13. Concise product description

WareFlow is a multi-branch retail operations platform that connects invoice creation, customer and payment documentation, product movement, salesperson targets, analytics, communication, and accounting exports. Its standout capability is WareFlow AI: an administrator-facing Gemini agent that safely invokes read-only analytics functions against live MongoDB data and turns operational records into direct, human-readable answers.
