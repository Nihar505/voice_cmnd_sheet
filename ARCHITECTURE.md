# 🏗️ Architecture Documentation - Voice Sheets Assistant

Complete architectural overview of the production-ready voice-driven Google Sheets application.

---

## 📊 **System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                   CLIENT LAYER (Next.js 14)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Components                                     │  │
│  │  - Voice Recorder (Web Audio API)                     │  │
│  │  - Live Transcription Display                         │  │
│  │  - State Indicator (10 states)                        │  │
│  │  - Conversation Panel                                 │  │
│  │  - Sheet Preview                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│               API LAYER (Next.js API Routes)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication: /api/auth/*                          │  │
│  │  Voice: /api/voice/transcribe                         │  │
│  │  Intent: /api/intent/parse                            │  │
│  │  Safety: /api/sheets/dry-run, /api/sheets/undo        │  │
│  │  Execution: /api/sheets/execute                       │  │
│  │  State: /api/conversation/state                       │  │
│  │  CRUD: /api/conversation/*, /api/user/*, /api/audit/* │  │
│  └──────────────────────────────────────────────────────┘  │
│  Middleware: Auth Check, Rate Limiting, Validation        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Intent       │  │ Dry-Run      │  │ State           │  │
│  │ Parser       │  │ Simulator    │  │ Machine         │  │
│  │ (GPT-4)      │  │              │  │ (10 states)     │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Google       │  │ Rollback     │  │ Conversation    │  │
│  │ Sheets       │  │ Manager      │  │ Context         │  │
│  │ Service      │  │ (24h window) │  │ Manager         │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Audit Logger - Full compliance trail                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ PostgreSQL   │  │ Redis        │  │ Encrypted       │  │
│  │ (Prisma ORM) │  │ (optional)   │  │ Token Store     │  │
│  │              │  │              │  │ (AES-256-GCM)   │  │
│  │ - Users      │  │ - Sessions   │  │                 │  │
│  │ - Convs      │  │ - Rate Limit │  │                 │  │
│  │ - Messages   │  │ - Cache      │  │                 │  │
│  │ - Rollbacks  │  │              │  │                 │  │
│  │ - Audit Log  │  │              │  │                 │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Google       │  │ OpenAI       │  │ Google          │  │
│  │ Sheets API   │  │ GPT-4 API    │  │ Speech-to-Text  │  │
│  │              │  │              │  │ (optional)      │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 **6-Step Safety Pipeline**

### Complete Flow

```
1. IDLE
   ↓ User clicks mic
2. LISTENING (capturing audio)
   ↓ User speaks
3. TRANSCRIBING (STT)
   ↓ Transcript ready
4. INTENT_CLASSIFIED (GPT-4 parsing)
   ↓ Intent extracted
5a. CLARIFICATION_REQUIRED (confidence < 60%)
    → Ask user to rephrase
5b. READY_TO_EXECUTE (low risk)
5c. CONFIRMATION_REQUIRED (high risk)
   ↓ User confirms (if needed)
6. EXECUTING
   ↓ Before: Dry-run simulation
   ↓ During: Sheets API call
   ↓ After: Rollback snapshot created
7. COMPLETED
   ↓ Audit log saved
8. IDLE (ready for next command)
```

### Error Path

```
Any step → ERROR
   ↓
Show error message
   ↓
Log to audit trail
   ↓
Offer retry or undo
   ↓
Return to IDLE
```

---

## 🗄️ **Database Schema**

### Core Models

```prisma
User
├── id, email, name, image
├── preferences (language, voice, defaultSheet)
└── relations:
    ├── conversations[]
    ├── spreadsheets[]
    ├── auditLogs[]
    └── rollbackActions[]

Conversation
├── id, userId, sheetId, title
├── state (ConversationState enum)
├── timestamps
└── messages[]

Message
├── id, conversationId, role
├── content, transcript
├── intent (JSON)
├── executionPlan (JSON)
├── dryRunResult (JSON)
└── executed, executionError

RollbackAction
├── id, userId, actionId
├── sheetId, undoAction
├── undoData (JSON)
├── executed, expiresAt
└── timestamps

AuditLog
├── id, userId, action
├── sheetId, sheetName
├── details (JSON)
├── success, errorMessage
├── executionTime
└── ipAddress, userAgent

GoogleToken
├── id, userId
├── accessToken (encrypted)
├── refreshToken (encrypted)
├── expiresAt, scope
└── timestamps
```

### Conversation State Enum

```typescript
enum ConversationState {
  IDLE,              // Ready to listen
  LISTENING,         // Capturing audio
  TRANSCRIBING,      // Converting speech
  INTENT_CLASSIFIED, // Parsed intent
  CLARIFICATION_REQUIRED,  // Need more info
  CONFIRMATION_REQUIRED,   // Waiting for approval
  READY_TO_EXECUTE,  // Validated, ready
  EXECUTING,         // Running operation
  COMPLETED,         // Success
  ERROR              // Failed
}
```

---

## 🔧 **Service Layer Design**

### Intent Parser Service

**Responsibility:** Convert natural language to structured commands

```typescript
Input: {
  transcript: "Create a sheet called Sales"
  context: { previousMessages, currentSheet }
}

Output: {
  action: "create_spreadsheet",
  parameters: { title: "Sales" },
  confidence: 0.95,
  requiresConfirmation: false
}
```

**Technology:** OpenAI GPT-4 with structured JSON output

### Dry-Run Service

**Responsibility:** Simulate actions without executing

```typescript
Input: {
  action: "delete_row",
  parameters: { rowIndex: 5, count: 1 }
}

Output: {
  cells_affected: [],
  risk_level: "high",
  reversible: true,
  preview: "⚠️ Will DELETE 1 row. Data will be removed.",
  warnings: ["This is a destructive action"]
}
```

### Rollback Service

**Responsibility:** Undo functionality

```typescript
Before execution:
  createSnapshot() → stores inverse operation

After user requests undo:
  executeUndo() → restores previous state

Cleanup:
  cleanupExpired() → removes snapshots > 24 hours
```

### State Machine Service

**Responsibility:** Manage conversation state transitions

```typescript
transitionState(conversationId, newState, reason)
  ↓
Validate transition (only allowed paths)
  ↓
Update database
  ↓
Log transition
```

**Valid Transitions:**
- IDLE → LISTENING
- LISTENING → TRANSCRIBING, ERROR
- TRANSCRIBING → INTENT_CLASSIFIED, ERROR
- INTENT_CLASSIFIED → CLARIFICATION_REQUIRED, CONFIRMATION_REQUIRED, READY_TO_EXECUTE
- CONFIRMATION_REQUIRED → READY_TO_EXECUTE, IDLE
- READY_TO_EXECUTE → EXECUTING
- EXECUTING → COMPLETED, ERROR
- COMPLETED → IDLE
- ERROR → IDLE, LISTENING

---

## 🔒 **Security Architecture**

### Authentication Flow

```
1. User clicks "Sign in with Google"
   ↓
2. NextAuth redirects to Google OAuth
   ↓
3. User approves scopes:
   - Sheets API access
   - Drive API access
   ↓
4. Google returns access + refresh tokens
   ↓
5. Tokens encrypted with AES-256-GCM
   ↓
6. Stored in database (GoogleToken model)
   ↓
7. Session created (database strategy)
   ↓
8. User redirected to dashboard
```

### Token Encryption

```typescript
Encryption: AES-256-GCM
Key: 32-byte key from ENCRYPTION_KEY env var
IV: Random per encryption (stored with ciphertext)
Tag: Authentication tag for integrity

Format: [IV][Ciphertext][Tag]
```

### Rate Limiting Strategy

```typescript
Per user/IP limits:
- API calls: 60/minute
- Voice transcribe: 20/minute
- Sheet operations: 30/minute
- Auth attempts: 5/15 minutes

Implementation: Database-backed (RateLimit model)
Cleanup: Cron job removes expired entries
```

---

## 📊 **Data Flow Examples**

### Example 1: Create Spreadsheet

```
User says: "Create a new sheet called Q1 Sales"
  ↓
1. IDLE → LISTENING (mic activated)
  ↓
2. LISTENING → TRANSCRIBING (audio captured)
  ↓
3. POST /api/voice/transcribe
   Returns: { transcript: "Create a new sheet called Q1 Sales" }
  ↓
4. TRANSCRIBING → INTENT_CLASSIFIED
  ↓
5. POST /api/intent/parse
   Returns: {
     action: "create_spreadsheet",
     parameters: { title: "Q1 Sales" },
     confidence: 0.98
   }
  ↓
6. POST /api/sheets/dry-run
   Returns: { risk_level: "low", reversible: false }
  ↓
7. INTENT_CLASSIFIED → READY_TO_EXECUTE (low risk, no confirmation)
  ↓
8. READY_TO_EXECUTE → EXECUTING
  ↓
9. POST /api/sheets/execute
   - Calls Google Sheets API
   - Creates spreadsheet
   - Saves to database
   - Creates audit log
  ↓
10. EXECUTING → COMPLETED
  ↓
11. Response: "Created spreadsheet Q1 Sales"
  ↓
12. COMPLETED → IDLE
```

### Example 2: Destructive Action with Confirmation

```
User says: "Delete row 5"
  ↓
[Steps 1-5 same as above]
  ↓
6. POST /api/sheets/dry-run
   Returns: {
     risk_level: "high",
     reversible: true,
     preview: "⚠️ Will DELETE 1 row. Data will be removed."
   }
  ↓
7. INTENT_CLASSIFIED → CONFIRMATION_REQUIRED (high risk)
  ↓
8. Show confirmation dialog:
   "This will delete 1 row. Should I proceed?"
  ↓
9. User clicks "Yes" / says "Yes"
  ↓
10. CONFIRMATION_REQUIRED → READY_TO_EXECUTE
  ↓
11. READY_TO_EXECUTE → EXECUTING
  ↓
12. POST /api/sheets/execute
    - Gets current row data (for rollback)
    - Calls Google Sheets API to delete
    - Creates rollback snapshot
    - Creates audit log
  ↓
13. EXECUTING → COMPLETED
  ↓
14. Response: "Deleted 1 row. You can undo this action."
  ↓
15. COMPLETED → IDLE
```

---

## 🔧 **Technology Decisions**

### Why Next.js 14?
- Server-side rendering for SEO
- API routes for backend
- React Server Components
- Built-in optimization
- Vercel deployment

### Why Prisma?
- Type-safe database access
- Auto-generated types
- Easy migrations
- Connection pooling
- Excellent PostgreSQL support

### Why PostgreSQL?
- ACID compliance
- JSON support (for intent, rollback data)
- Mature and reliable
- Great performance
- Horizontal scaling (with read replicas)

### Why GPT-4?
- Best-in-class NLP
- Structured JSON output
- Context understanding
- High accuracy
- Function calling support

### Why AES-256-GCM?
- Industry standard
- Authenticated encryption
- Fast performance
- Proven security

---

## 📈 **Scalability Strategy**

### Horizontal Scaling

**Stateless Design:**
- No in-memory state
- All state in database/Redis
- Can add API servers easily

**Database Scaling:**
- Primary-replica setup
- Read queries → replicas
- Write queries → primary
- Connection pooling (pgBouncer)

**Caching:**
- Redis for hot data
- Session cache
- Conversation context cache
- Rate limit cache

### Performance Optimization

**Database Indexes:**
- userId (all user-scoped queries)
- createdAt (time-based queries)
- conversationId, sheetId (joins)
- state (conversation filtering)

**API Optimization:**
- Response compression (gzip)
- CDN for static assets
- Image optimization (Next.js automatic)
- Code splitting (automatic)

---

## 🧪 **Testing Strategy**

### Unit Tests
- Service layer functions
- Utility functions (encryption, validation)
- State machine transitions

### Integration Tests
- API routes end-to-end
- Database operations
- External API mocks (Google, OpenAI)

### E2E Tests
- Full voice flow
- Authentication
- Undo functionality
- Error scenarios

---

## 📝 **Logging & Monitoring**

### Structured Logging

```typescript
logger.info('Action', {
  userId,
  action,
  sheetId,
  executionTime,
  success
});
```

**Log Levels:**
- DEBUG: Development only
- INFO: Normal operations
- WARN: Rate limits, validation failures
- ERROR: Exceptions, API failures

### Metrics to Monitor

- API response times
- Error rates by endpoint
- Rate limit hits
- Database query performance
- External API latency (Google, OpenAI)
- Conversation state distribution
- Rollback usage

---

## 🎯 **Design Principles**

1. **Safety First**: Dry-run before execution
2. **Reversibility**: Undo capability for all actions
3. **Transparency**: Clear state feedback
4. **Isolation**: Per-user data separation
5. **Auditability**: Complete action trail
6. **Fail Safe**: Errors don't corrupt data
7. **Performance**: Sub-second response times
8. **Scalability**: Horizontal scaling ready

---

Built with production quality from day one. 🚀
