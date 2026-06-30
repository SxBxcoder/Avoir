# Authentication Setup Guide

## What We Built (MERN Comparison)

### In MERN Stack:
- MongoDB stores users
- Express routes: `/register`, `/login`
- bcrypt for password hashing
- jsonwebtoken for JWT tokens
- Middleware to verify tokens

### In This Project (AWS Cognito):
- **Cognito User Pool** stores users (replaces MongoDB)
- **AWS Amplify** handles auth (replaces Express auth routes)
- **AWS** handles password hashing automatically
- **AWS** generates JWT tokens automatically
- **AWS** verifies tokens automatically

## Files Created

```
avoir-ai/
├── src/
│   ├── lib/
│   │   ├── auth.ts              # Cognito configuration (like passport.js)
│   │   └── authHelpers.ts       # Helper functions (like JWT middleware)
│   └── app/
│       ├── login/
│       │   └── page.tsx         # Login page
│       ├── register/
│       │   └── page.tsx         # Register page (with email verification)
│       └── page.tsx             # Updated homepage with auth
└── .env.example                 # Environment variables template
```

## Setup Steps

### 1. Install Dependencies

```bash
cd avoir-ai
npm install
```

This will install `aws-amplify` package.

### 2. Create AWS Cognito User Pool

Go to AWS Console → Cognito → Create User Pool:

1. **Sign-in options**: Email
2. **Password policy**: 
   - Minimum 8 characters
   - Require uppercase, lowercase, numbers, symbols
3. **MFA**: Optional (can skip for now)
4. **Email verification**: Required
5. **Custom attributes**: Add `brand_name` (String, optional)
6. **App client**: Create without client secret

After creation, you'll get:
- User Pool ID (e.g., `us-east-1_XXXXXXXXX`)
- App Client ID (e.g., `1234567890abcdefghij`)

### 3. Configure Environment Variables

Create `.env.local` file:

```bash
# Copy from example
cp .env.example .env.local
```

Edit `.env.local` and add your Cognito credentials:

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id-here
```

### 4. Run the Application

```bash
npm run dev
```

Open http://localhost:3000

## How It Works

### Registration Flow

1. User fills form at `/register`
2. AWS Cognito creates user account
3. AWS sends verification code to email
4. User enters code to verify email
5. Account is activated

**Code:**
```typescript
// This is like POST /register in MERN
await signUp({
  username: email,
  password,
  options: {
    userAttributes: { email, 'custom:brand_name': brandName }
  }
});
```

### Login Flow

1. User enters email/password at `/login`
2. AWS Cognito verifies credentials
3. AWS returns JWT tokens (ID token, Access token, Refresh token)
4. Tokens stored automatically by Amplify
5. User redirected to homepage

**Code:**
```typescript
// This is like POST /login in MERN
await signIn({ username: email, password });
```

### Protected API Calls

When generating campaigns, the JWT token is sent in headers:

```typescript
const accessToken = await getAccessToken();

fetch('/api/generate', {
  headers: {
    'Authorization': `Bearer ${accessToken}` // JWT token
  }
});
```

## Testing

### Test Registration:
1. Go to http://localhost:3000/register
2. Enter email, password (must meet requirements), brand name
3. Click "Sign Up"
4. Check email for verification code
5. Enter code and verify

### Test Login:
1. Go to http://localhost:3000/login
2. Enter registered email and password
3. Click "Sign In"
4. Should redirect to homepage with user email shown

### Test Protected Route:
1. Try generating campaign without login → redirects to login
2. Login first, then generate campaign → works!

## Next Steps (Backend Integration)

To fully secure your backend API:

1. **Update API Route** (`avoir-ai/src/app/api/generate/route.ts`):
   - Extract JWT token from headers
   - Verify token with Cognito
   - Get user ID from token
   - Pass user ID to backend

2. **Update Python Backend** (`backend/agent.py`):
   - Receive user ID from API
   - Store campaigns with user ID
   - Filter campaigns by user ID

## Troubleshooting

**Error: "User Pool not found"**
- Check if `NEXT_PUBLIC_COGNITO_USER_POOL_ID` is correct
- Ensure User Pool exists in AWS Console

**Error: "Invalid password"**
- Password must be 8+ chars with uppercase, lowercase, number, symbol

**Email not received:**
- Check spam folder
- Verify email configuration in Cognito User Pool settings

## Key Differences from MERN

| Feature | MERN | AWS Cognito |
|---------|------|-------------|
| User Storage | MongoDB | Cognito User Pool |
| Password Hashing | bcrypt (manual) | AWS (automatic) |
| JWT Generation | jsonwebtoken (manual) | AWS (automatic) |
| Email Verification | nodemailer (manual) | AWS SES (automatic) |
| Token Verification | Middleware (manual) | AWS (automatic) |
| Session Management | express-session | Amplify (automatic) |

## Benefits

✅ No need to manage password hashing
✅ No need to implement JWT logic
✅ Built-in email verification
✅ Automatic token refresh
✅ Secure by default
✅ Scales automatically
✅ Free tier: 50,000 MAUs (Monthly Active Users)

---

**Status**: ✅ Frontend authentication complete
**Next**: Backend API integration with JWT verification
