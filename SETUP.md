# WorkSync Setup Guide

## Phase 1: Foundation Setup (Current)

### ✅ Completed
- [x] Supabase client configuration
- [x] Authentication context and session management
- [x] Login, Signup, and Forgot Password screens
- [x] Protected routes and navigation guards
- [x] Database schema design
- [x] User profile integration

### 🔄 Next Steps

#### 1. Set up Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (usually takes 2-3 minutes)
3. Go to Settings → API to get your project URL and anon key
4. Create a `.env` file in your project root with:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

#### 2. Set up Database Schema
1. In your Supabase dashboard, go to SQL Editor
2. Copy and paste the contents of `supabase/schema.sql`
3. Run the SQL script to create all tables, policies, and functions
4. Verify the tables were created in the Table Editor

#### 3. Test Authentication
1. Run `npx expo start` to start the development server
2. Test the signup flow with a new user
3. Test the login flow
4. Verify the profile screen shows user data correctly

### 🚀 Phase 2: Core Time Tracking (Next)

Once Phase 1 is complete, we'll implement:
- Clock In/Out functionality with location capture
- Break management
- Geo-fencing validation
- Basic timesheet view
- Location services integration

### 📱 Current App Structure

```
app/
├── auth/                 # Authentication screens
│   ├── login.tsx
│   ├── signup.tsx
│   └── forgot-password.tsx
├── (tabs)/              # Main app tabs (protected)
│   ├── index.tsx        # Home/Dashboard
│   ├── schedule.tsx     # Schedule view
│   ├── timesheet.tsx    # Timesheet view
│   └── profile.tsx      # User profile
├── availability.tsx     # Availability submission
├── history.tsx          # Activity history
└── notifications.tsx    # Notifications

lib/
└── supabase.ts         # Supabase client config

contexts/
└── AuthContext.tsx     # Authentication state management

components/
└── ProtectedRoute.tsx  # Route protection wrapper

supabase/
└── schema.sql          # Database schema
```

### 🔧 Environment Setup

Make sure you have:
- Node.js 18+ installed
- Expo CLI installed (`npm install -g @expo/cli`)
- A Supabase account and project
- Environment variables configured

### 🐛 Troubleshooting

**Common Issues:**
1. **"Invalid API key"** - Check your environment variables are set correctly
2. **"Table doesn't exist"** - Make sure you've run the schema.sql script
3. **Authentication not working** - Verify your Supabase project is active and URL is correct

**Next Steps After Setup:**
1. Test all authentication flows
2. Verify database tables and policies
3. Move to Phase 2: Core Time Tracking implementation
