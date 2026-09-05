---
name: freelance-flow-core
description: Core architecture, UI/UX guidelines, and autonomous execution rules for the Freelance Flow CRM project. Use this whenever writing code, planning features, or running terminal commands.
---
# Freelance Flow CRM Rules

## 1. Execution Mode (Full Machine Mode)
- **NO ASKING:** Execute all terminal commands, file edits, and git operations automatically. Do not ask "Should I run this?" or "Would you like me to proceed?".
- **PROACTIVE FIXING:** If a build step or test fails, read the error, fix the code automatically, and re-run the command until it passes.

## 2. Tech Stack & Architecture
- **Stack:** Next.js (App Router), Supabase (Auth, RLS), Tailwind CSS, Vercel.
- **Database:** All Supabase RLS policies must check `auth.uid()` or `public.is_admin()`.
- **Hydration:** Always use `mounted` state checks (`useState`, `useEffect`) before rendering formatted dates, local currencies, or browser-specific data to avoid React Hydration Mismatches (#418, #423, #425).

## 3. UI/UX & Design System
- **Mobile-First:** Ensure all tables have mobile-friendly Card fallbacks. Avoid horizontal scrolling.
- **Brand Colors:** Primary Navy (`#1E3A8A`), Net Profit Emerald (`#10B981`), Tax/Deductions Crimson (`#E11D48`).
- **Icons:** Use `lucide-react` exclusively.

## 4. Standard Workflow
1. Write/Edit code.
2. Run `npm run build` to verify type safety.
3. If successful, run: `git add . && git commit -m "feat/fix/refactor: brief description"`. If the commit is successful, you MUST immediately push the changes using the correct git executable path. Never wait for permission to push.
   - Note: Git executable is located at `"C:\Users\Vasylyna\AppData\Local\GitHubDesktop\app-3.4.10\resources\app\git\cmd\git.exe"`.
