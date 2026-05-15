# Business Model — Flow Diagram

## Overview

- **User** — System account (one per person). Can belong to many businesses.
- **Business** — One tenant (e.g. one dental office or clinic). Has many members.
- **BusinessUser** — Link between User and Business with a **role** (owner / admin / staff) and optional **permissions**. Unique per `(business_id, user_id)`.

---

## 1. Entity relationship (current)

```mermaid
erDiagram
    User ||--o{ BusinessUser : "has many"
    Business ||--o{ BusinessUser : "has many"
    BusinessUser }o--|| User : "belongs to"
    BusinessUser }o--|| Business : "belongs to"

    User {
        int id PK
        string email
        string hashed_password
        string full_name
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    Business {
        int id PK
        string name
        string business_type
        string email
        string phone
        text address
        string timezone
        string subscription_plan
        string subscription_status
        datetime created_at
        datetime updated_at
    }

    BusinessUser {
        int id PK
        int business_id FK
        int user_id FK
        string role
        json permissions
        datetime created_at
    }
```

**Constraint:** One `(business_id, user_id)` pair is unique — a user can have only one role per business.

---

## 2. Multi-tenant flow (how users and businesses connect)

```mermaid
flowchart LR
    subgraph System
        A[User\nsystem account]
        B[Business\ntenant]
        C[BusinessUser\nlink + role]
    end

    A -->|"1 user can join"| C
    C -->|"many businesses"| B
    B -->|"many members"| C
    C -->|"1 role per business"| A

    style B fill:#e1f5fe
    style C fill:#fff3e0
    style A fill:#f3e5f5
```

- **User:** Global account (email, password). Can belong to 0, 1, or many businesses.
- **Business:** One tenant (e.g. dental office, clinic). Has many members via **BusinessUser**.
- **BusinessUser:** Join between User and Business; stores **role** (owner / admin / staff) and optional **permissions**.

---

## 3. Relationship cardinality

```mermaid
flowchart TB
    subgraph One User
        U[User]
    end

    subgraph Many Businesses
        B1[Business 1]
        B2[Business 2]
        B3[Business 3]
    end

    subgraph Link table
        BU1[BusinessUser\nrole: owner]
        BU2[BusinessUser\nrole: admin]
        BU3[BusinessUser\nrole: staff]
    end

    U --> BU1
    U --> BU2
    U --> BU3
    BU1 --> B1
    BU2 --> B2
    BU3 --> B3
```

- **User → BusinessUser:** 1 user → many BusinessUser rows (one per business).
- **Business → BusinessUser:** 1 business → many BusinessUser rows (one per member).
- **BusinessUser:** Unique on `(business_id, user_id)`.

---

## 4. Typical flows

### A. User creates or joins a business

```mermaid
sequenceDiagram
    participant U as User
    participant API as API
    participant DB as Database

    Note over U,DB: Create business
    U->>API: Create Business
    API->>DB: INSERT business
    API->>DB: INSERT business_user (user_id, business_id, role=owner)
    DB-->>API: OK
    API-->>U: Business + membership

    Note over U,DB: Invite / join existing business
    U->>API: Add user to business
    API->>DB: INSERT business_user (user_id, business_id, role=staff)
    DB-->>API: OK
    API-->>U: Membership created
```

### B. Resolving “current business” for a request

```mermaid
flowchart LR
    A[JWT: user_id] --> B[Load User]
    B --> C[Load user.business_users]
    C --> D{Which business?}
    D -->|Header / param| E[Business A]
    D -->|Default / first| F[Business B]
    E --> G[Scope all data by business_id]
    F --> G
```

All tenant-scoped data (appointments, customers, etc.) will be filtered by the chosen **business_id** for that request.

---

## 5. Roles (BusinessUser.role)

| Role   | Typical use                          |
|--------|--------------------------------------|
| owner  | Created the business; full control   |
| admin  | Manage settings and users            |
| staff  | Day-to-day use (appointments, etc.)   |

`permissions` (JSON) can extend this with fine-grained flags later.

---

## 6. Summary

- **Business:** The tenant (one dental office, clinic, etc.).
- **User:** A person with a system account; can belong to many businesses.
- **BusinessUser:** Links User ↔ Business with one **role** (and optional permissions) per pair; unique on `(business_id, user_id)`.

If you want, we can add flows for “invite member” or “switch current business” next.
