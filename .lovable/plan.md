

## Fix: Guest Profile Creation Flow

### Problem
When creating a guest profile from the Menu screen, the "Continue" button gets stuck showing "Creating..." if the profile insert fails. This happens because:

1. The profile creation runs inside the transition system's `prepare` callback
2. When `prepare` throws an error, the `TransitionContext` catches it silently -- no error toast is shown
3. The `isCreatingGuest` state is never reset to `false` on error, so the button stays permanently disabled
4. There is a UNIQUE constraint on `auth_user_id` in the profiles table, so if the anonymous session already has a profile, the insert fails silently

### Solution

**1. Add error feedback to the transition system**
- When the `prepare` callback in `TransitionContext` catches an error, show a toast notification so the user knows something went wrong

**2. Fix the stuck "Creating..." button in Menu.tsx**
- Wrap the `startTransition` call in a try/catch so `isCreatingGuest` is always reset on failure
- Alternatively, move the `setIsCreatingGuest(false)` into a `finally`-like pattern

**3. Use session user from AuthContext instead of calling `getUser()` again**
- The `handleGuestContinue` function calls `supabase.auth.getUser()` which could fail or hang
- Instead, use the `session.user.id` already available from `useAuth()` -- more reliable and avoids an extra network call

**4. Handle the "already has a profile" edge case**
- Before inserting, check if `profileId` already exists (it could have been set between when the guest input was shown and when Continue was clicked)
- If a profile already exists, just navigate without trying to create a duplicate

### Technical Changes

**`src/contexts/TransitionContext.tsx`**
- Import `toast` from `sonner`
- In the `onComplete` handler, when `prepare` throws, call `toast.error('Something went wrong. Please try again.')` before resetting state

**`src/pages/Menu.tsx`**
- Replace `supabase.auth.getUser()` call with `session.user.id` from `useAuth()`
- Add a guard at the top of `handleGuestContinue`: if `profileId` already exists, navigate directly to `/home` instead of inserting
- Move `setIsCreatingGuest(false)` to also execute in the error path (add it outside the `prepare` callback or use a cleanup pattern)

