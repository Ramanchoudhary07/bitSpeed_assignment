# Bitespeed Backend Task – Identity Reconciliation

---

## 🔗 Live Link

https://bitespeed-identity-service-1uh8.onrender.com

---

## 🧠 Scenario

Doc Emmett Brown ("Doc") is using FluxKart.com to buy parts for his time
machine. To remain incognito, he orders using different email addresses and
phone numbers. Bitespeed needs to unify these contact details to provide a
personalized experience.

Each order sent to the Bitespeed backend contains either an email or phone
number or both. The backend stores these in a `Contact` table and must map
each new order to an existing customer if any matching contact exists,
creating new rows or linking contacts as necessary.

### Contact table structure

```ts
model Contact {
  id             Int       @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?      // points to another Contact
  linkPrecedence String    @default("primary") // "primary" or "secondary"
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?
}
```

- Contacts are linked if they share the same email or phone number.
- The oldest contact in a linked group is marked `primary`; others are
  `secondary` and reference the primary via `linkedId`.

---

## ✅ Business rules

1. **New contact**: if no existing record matches the incoming email or phone,
   create a new primary contact and return it with an empty list of
   secondaries.
2. **Secondary creation**: if at least one field matches an existing contact
   but the other field contains new information, insert a secondary contact
   linked to the primary.
3. **Primary demotion**: when an incoming request connects two different
   primaries (one via email, the other via phone), the older contact remains
   primary; the newer becomes secondary and all its secondaries are
   re-linked.
4. The `primaryContactId` in the response always refers to the oldest contact
   in the consolidated set.

---

## 📦 Repository structure

```
.
├── prisma/
│   ├── schema.prisma
│   └── migrations/…
├── src/
│   ├── controllers/identify.controller.ts
│   ├── db/prisma.ts
│   ├── routes/identify.route.ts
│   └── server.ts
├── package.json
├── tsconfig.json
└── README.md
```

- `src/server.ts`: Express app entrypoint.
- `src/routes/identify.route.ts`: registers the `/api/v1/identify` route.
- `src/controllers/identify.controller.ts`: reconciles contacts according to the
  above rules.
- `src/db/prisma.ts`: Prisma client configured for PostgreSQL.

Generated Prisma code resides under `src/generated/prisma`

---

## ⚙️ Setup instructions

1. Clone the repository and install dependencies:

   ```bash
   git clone <repo-url>
   cd bitSpeed_assignment
   npm install
   ```

2. Create a `.env` file with the following variables (modify as needed):

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
   PORT=3000
   ```

3. Run migrations to create the `Contact` table:

   ```bash
   npx prisma migrate dev --name init
   ```

   This executes the SQL located in `prisma/migrations/`.

---

## 🚀 Running the service

- **Development** (TypeScript directly):

  ```bash
  npm run dev
  ```

- **With watch mode** (restarts on changes):

  ```bash
  npm run dev:watch
  ```

- **Build & start**:

  ```bash
  npm run build
  npm start
  ```

The server listens on the port defined by `PORT` (default `3000`).

---

## 📬 API documentation

### `POST /api/v1/identify`

**Request body** (JSON):

```json
{
  "email"?: "string",
  "phoneNumber"?: "string" | "number"
}
```

At least one of `email` or `phoneNumber` must be provided, otherwise the
service returns a `400 Bad Request`.

**Response** (`200 OK`):

```json
{
  "contact": {
    "primaryContactId": number,
    "emails": string[],          // first element is primary’s email
    "phoneNumbers": string[],    // first element is primary’s phone
    "secondaryContactIds": number[]
  }
}
```

**Example flow**

- Database initially has a primary contact with email
  `lorraine@hillvalley.edu` and phone `123456`.
- Incoming request:

  ```json
  { "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }
  ```

- Service responds with a consolidated contact:

  ```json
  {
    "contact": {
      "primaryContactId": 1,
      "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
      "phoneNumbers": ["123456"],
      "secondaryContactIds": [23]
    }
  }
  ```

The full reconciliation logic is implemented in
`src/controllers/identify.controller.ts`.

---
