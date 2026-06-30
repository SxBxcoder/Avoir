# Quick Start - Authentication

## 🚀 Run Locally (3 Steps)

### 1. Install Dependencies
```bash
cd avoir-ai
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Browser
```
http://localhost:3000
```

## 📝 What You'll See

- **Homepage**: Campaign generator with Login/Sign Up buttons
- **Login Page**: http://localhost:3000/login
- **Register Page**: http://localhost:3000/register

## ⚠️ Important: AWS Cognito Setup Required

The authentication won't work until you:

1. Create AWS Cognito User Pool (see SETUP_AUTH.md)
2. Add credentials to `.env.local`

## 🧪 Test Without AWS (Demo Mode)

For now, you can test the UI without AWS:
- Pages will load
- Forms will work
- But actual login/register will fail (need AWS Cognito)

## 📚 MERN vs AWS Cognito

### MERN (What You Know):
```javascript
// Register
app.post('/register', async (req, res) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ email, password: hashedPassword });
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const user = await User.findOne({ email });
  const valid = await bcrypt.compare(password, user.password);
  const token = jwt.sign({ userId: user._id }, SECRET);
  res.json({ token });
});

// Protected Route
app.get('/api/data', verifyToken, (req, res) => {
  // req.userId available from JWT
});
```

### AWS Cognito (What We Built):
```typescript
// Register - AWS handles hashing, storage, email verification
await signUp({ username: email, password });

// Login - AWS handles verification, JWT generation
await signIn({ username: email, password });

// Protected Route - AWS handles JWT verification
const token = await getAccessToken();
fetch('/api/generate', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🎯 Key Concepts

### 1. No Backend Auth Routes Needed
AWS Cognito IS your auth backend. You don't need:
- `/register` route in Express
- `/login` route in Express
- Password hashing logic
- JWT signing logic

### 2. JWT Tokens Automatic
When user logs in, AWS gives you 3 tokens:
- **ID Token**: User identity (like passport user object)
- **Access Token**: API authorization (like JWT token in MERN)
- **Refresh Token**: Get new tokens when expired

### 3. Email Verification Built-in
AWS automatically:
- Sends verification email
- Validates code
- Marks email as verified

## 📁 File Structure

```
avoir-ai/
├── src/
│   ├── lib/
│   │   ├── auth.ts           # Configure Cognito (like passport config)
│   │   └── authHelpers.ts    # Helper functions (like JWT middleware)
│   ├── app/
│   │   ├── login/page.tsx    # Login page
│   │   ├── register/page.tsx # Register page
│   │   ├── page.tsx          # Homepage (protected)
│   │   └── api/
│   │       └── generate/
│   │           └── route.ts  # API endpoint (needs JWT verification)
├── .env.local                # Your Cognito credentials (create this)
└── .env.example              # Template
```

## 🔐 How Authentication Works

```
1. User Registration
   ↓
   User fills form → AWS Cognito creates account
   ↓
   AWS sends email → User enters code
   ↓
   Account verified ✅

2. User Login
   ↓
   User enters credentials → AWS verifies
   ↓
   AWS returns JWT tokens → Stored automatically
   ↓
   User logged in ✅

3. Generate Campaign (Protected)
   ↓
   Get JWT token → Send in Authorization header
   ↓
   Backend verifies token → Returns campaign
   ↓
   Campaign generated ✅
```

## 🛠️ Next Steps

1. **Test UI locally** (works without AWS)
2. **Create AWS Cognito User Pool** (see SETUP_AUTH.md)
3. **Add credentials to .env.local**
4. **Test full authentication flow**
5. **Update backend to verify JWT tokens**

## 💡 Pro Tips

- Use `console.log()` to see JWT tokens in browser console
- Check Network tab to see Authorization headers
- AWS Cognito free tier: 50,000 users/month
- Tokens expire after 1 hour (auto-refresh handled by Amplify)

## 🆘 Need Help?

Read `SETUP_AUTH.md` for detailed AWS Cognito setup instructions.
