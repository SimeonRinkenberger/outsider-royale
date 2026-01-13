# Database Usage Map - Outsider Royale

> **Audit Date:** 2026-01-12  
> **Last Updated:** 2026-01-12 (Cost Optimization Pass)
> **Purpose:** Complete inventory of all Supabase interactions in the application

---

## Before vs After Summary (Cost Optimization)

### 1. Global Clues Listener → FIXED ✅
- **Before:** `useGameState.ts` subscribed to ALL clues table changes globally with no filter
- **After:** Subscription filtered to `filter: round_id=eq.${currentRound.id}` - only current round
- **Payload Applied:** INSERT/UPDATE/DELETE events now update local state directly instead of refetching

### 2. Wide Words SELECT → FIXED ✅
- **Before:** `Lobby.tsx`, `Results.tsx` fetched ALL words with `select('*').in('category', [...])` (potentially thousands)
- **After:** New RPC functions `get_random_words_from_categories()` and `get_imposter_word()` return only 1-2 words server-side
- **Queries Removed:** Unlimited word fetches replaced with single RPC calls

### 3. Refetch-on-Realtime → FIXED ✅
- **Before:** `lobby_players`, `votes`, `clues` changes triggered full table refetch
- **After:** Payload applied directly to local state:
  - INSERT → append to array (debounced refetch only for player avatar joins)
  - UPDATE → update matching item
  - DELETE → filter out item
- **Debouncing:** Player refetch debounced to 300ms for avatar resolution

### 4. Duplicate Initial Fetch → FIXED ✅
- **Before:** `useGameState.ts` and `gamePreloadCache.ts` both fetched same lobby/game/players data
- **After:** `useGameState` checks cache first via `getCachedGameData()` and `getCachedResultsData()`, skips initial fetch if cache hit

### 5. Channel Leak → FIXED ✅
- **Before:** `Game.tsx` outsider guess broadcast channel created but never removed
- **After:** Channel wrapped in try/finally with `supabase.removeChannel(channel)` cleanup

### 6. Auth Centralized → ADDED ✅
- **New:** `AuthProvider` context reads session once, provides to all components
- **Location:** `src/contexts/AuthContext.tsx`

### 7. SELECT(*) Reduced → FIXED ✅
- **Before:** Most queries used `select('*')`
- **After:** Explicit columns: `select('id, text, category')` for words, explicit columns for lobbies, games, players, etc.

### New RPC Functions Added
| Function | Purpose |
|----------|---------|
| `get_random_words_from_categories(p_categories, p_count, p_exclude_word_id)` | Server-side random word selection |
| `get_imposter_word(p_secret_word_id, p_categories)` | Get different word for hidden_imposter mode |

---

1. [Authentication Operations](#authentication-operations)
2. [Profile Operations](#profile-operations)
3. [Lobby Operations](#lobby-operations)
4. [Lobby Players Operations](#lobby-players-operations)
5. [Game Operations](#game-operations)
6. [Round Operations](#round-operations)
7. [Clue Operations](#clue-operations)
8. [Vote Operations](#vote-operations)
9. [Word Operations](#word-operations)
10. [Game Outsiders Operations](#game-outsiders-operations)
11. [User Stats Operations](#user-stats-operations)
12. [Realtime Channels](#a-realtime-channels)
13. [Cost Risk Flags](#b-cost-risk-flags)

---

## Authentication Operations

### 1. supabase.auth.getSession()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/AuthCallback.tsx` |
| **Function** | `handleCallback` (useEffect) |
| **Trigger** | On component mount |
| **Operation** | Auth session read |
| **Query Shape** | `supabase.auth.getSession()` |
| **Used For** | OAuth callback handling, session verification |
| **Duplicated?** | Yes - appears in multiple files |
| **Runs Repeatedly?** | No - once per auth callback |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `fetchStats` (useEffect) |
| **Trigger** | On component mount |
| **Operation** | Auth session read |
| **Query Shape** | `supabase.auth.getSession()` |
| **Used For** | Check if user is authenticated before fetching stats |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per mount |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Menu.tsx` |
| **Function** | `checkAuth` (useEffect) |
| **Trigger** | On component mount |
| **Operation** | Auth session read |
| **Query Shape** | `supabase.auth.getSession()` |
| **Used For** | Check if user is authenticated for UI display |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per mount |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `updateUserStats` (useEffect) |
| **Trigger** | When results are ready |
| **Operation** | Auth session read |
| **Query Shape** | `supabase.auth.getSession()` |
| **Used For** | Verify auth before updating stats |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per game end |

### 2. supabase.auth.signUp()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` |
| **Trigger** | On form submit (signup mode) |
| **Operation** | Auth signup |
| **Query Shape** | `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` |
| **Used For** | Create new account |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleGuestAuth` |
| **Trigger** | On form submit (guest upgrade) |
| **Operation** | Auth signup |
| **Query Shape** | `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` |
| **Used For** | Convert guest to authenticated user |
| **Duplicated?** | Yes - similar to Auth.tsx |
| **Runs Repeatedly?** | No - user triggered |

### 3. supabase.auth.signInWithPassword()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` |
| **Trigger** | On form submit (signin mode) |
| **Operation** | Auth signin |
| **Query Shape** | `supabase.auth.signInWithPassword({ email, password })` |
| **Used For** | Sign in existing user |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleGuestAuth` |
| **Trigger** | On form submit (signin mode) |
| **Operation** | Auth signin |
| **Query Shape** | `supabase.auth.signInWithPassword({ email, password })` |
| **Used For** | Sign in from guest flow |
| **Duplicated?** | Yes - similar to Auth.tsx |
| **Runs Repeatedly?** | No - user triggered |

### 4. supabase.auth.signOut()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleLogout` |
| **Trigger** | On logout button click |
| **Operation** | Auth signout |
| **Query Shape** | `supabase.auth.signOut()` |
| **Used For** | Log user out |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

### 5. supabase.auth.onAuthStateChange()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Menu.tsx` |
| **Function** | `useEffect` subscription |
| **Trigger** | On mount, listens for auth changes |
| **Operation** | Auth state subscription |
| **Query Shape** | `supabase.auth.onAuthStateChange(callback)` |
| **Used For** | React to auth state changes |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - subscription that cleans up |

---

## Profile Operations

### 1. SELECT from profiles

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/AuthCallback.tsx` |
| **Function** | `handleCallback` |
| **Trigger** | On OAuth callback |
| **Tables** | `profiles` |
| **Operation** | SELECT |
| **Query Shape** | `.from('profiles').select('*').eq('auth_user_id', session.user.id).single()` |
| **Used For** | Check if profile exists for OAuth user |
| **Duplicated?** | Yes - similar patterns in multiple files |
| **Runs Repeatedly?** | No - once per callback |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` (signin branch) |
| **Trigger** | On signin |
| **Tables** | `profiles` |
| **Operation** | SELECT |
| **Query Shape** | `.from('profiles').select('*').eq('auth_user_id', data.user.id).single()` |
| **Used For** | Fetch profile after signin |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per signin |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `fetchStats` |
| **Trigger** | On mount |
| **Tables** | `profiles` |
| **Operation** | SELECT |
| **Query Shape** | `.from('profiles').select('id, avatar_url, display_name').eq('auth_user_id', session.user.id).single()` |
| **Used For** | Fetch user profile for display |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per mount |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleGuestAuth` (signin branch) |
| **Trigger** | On guest signin |
| **Tables** | `profiles` |
| **Operation** | SELECT |
| **Query Shape** | `.from('profiles').select('*').eq('auth_user_id', data.user.id).single()` |
| **Used For** | Fetch profile after guest signin |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/components/GameHeader.tsx` |
| **Function** | `fetchAvatar` (useEffect) |
| **Trigger** | On mount/userId change |
| **Tables** | `profiles` |
| **Operation** | SELECT |
| **Query Shape** | `.from('profiles').select('avatar_url').eq('id', userId).maybeSingle()` |
| **Used For** | Fetch avatar for header display |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per userId change |

### 2. INSERT into profiles

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Onboarding.tsx` |
| **Function** | `handleContinue` |
| **Trigger** | On form submit |
| **Tables** | `profiles` |
| **Operation** | INSERT |
| **Query Shape** | `.from('profiles').insert({ display_name: displayName.trim() }).select().single()` |
| **Used For** | Create guest profile |
| **Duplicated?** | Yes - similar in Menu.tsx |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Menu.tsx` |
| **Function** | `handleGuestContinue` |
| **Trigger** | On guest name submit |
| **Tables** | `profiles` |
| **Operation** | INSERT |
| **Query Shape** | `.from('profiles').insert({ display_name: guestName.trim() }).select().single()` |
| **Used For** | Create guest profile |
| **Duplicated?** | Yes - similar in Onboarding.tsx |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/AuthCallback.tsx` |
| **Function** | `handleCallback` |
| **Trigger** | On OAuth callback (new user) |
| **Tables** | `profiles` |
| **Operation** | INSERT |
| **Query Shape** | `.from('profiles').insert({ display_name, auth_user_id, is_guest: false }).select().single()` |
| **Used For** | Create profile for new OAuth user |
| **Duplicated?** | Yes - similar patterns |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` (signup branch) |
| **Trigger** | On signup |
| **Tables** | `profiles` |
| **Operation** | INSERT |
| **Query Shape** | `.from('profiles').insert({ display_name, auth_user_id, is_guest: false }).select().single()` |
| **Used For** | Create profile for new signup |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleGuestAuth` (signup branch) |
| **Trigger** | On guest upgrade signup |
| **Tables** | `profiles` |
| **Operation** | INSERT |
| **Query Shape** | `.from('profiles').insert({ display_name, auth_user_id, is_guest: false }).select().single()` |
| **Used For** | Create profile for guest upgrading to auth |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 3. UPDATE profiles

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` (signup branch, linking guest) |
| **Trigger** | On signup with existing guest profile |
| **Tables** | `profiles` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('profiles').update({ auth_user_id, is_guest: false, display_name }).eq('id', guestProfileId).select().single()` |
| **Used For** | Link guest profile to auth account |
| **Duplicated?** | Yes - similar in Stats.tsx |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleGuestAuth` (signup branch, linking guest) |
| **Trigger** | On guest upgrade with existing profile |
| **Tables** | `profiles` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('profiles').update({ auth_user_id, is_guest: false, display_name }).eq('id', guestProfileId).select().single()` |
| **Used For** | Link guest profile to auth account |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleAvatarSelect` |
| **Trigger** | On avatar selection |
| **Tables** | `profiles` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('profiles').update({ avatar_url: avatarId }).eq('id', profileId)` |
| **Used For** | Update user avatar |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/components/AccountSettings.tsx` |
| **Function** | `handleUpdateDisplayName` |
| **Trigger** | On display name update |
| **Tables** | `profiles` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('profiles').update({ display_name: newDisplayName.trim() }).eq('id', profileId)` |
| **Used For** | Update display name |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

---

## Lobby Operations

### 1. SELECT from lobbies

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On mount/lobbyId change |
| **Tables** | `lobbies` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobbies').select('*').eq('id', lobbyId).single()` |
| **Used For** | Initial lobby data fetch |
| **Duplicated?** | Yes - also in gamePreloadCache.ts |
| **Runs Repeatedly?** | No - once per lobbyId change |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `joinLobby` |
| **Trigger** | On join button click |
| **Tables** | `lobbies` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobbies').select('*').eq('code', joinCode.toUpperCase()).in('status', ['waiting', 'results']).single()` |
| **Used For** | Find lobby by code |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData` |
| **Trigger** | On Lobby→Game transition |
| **Tables** | `lobbies` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobbies').select('*').eq('id', lobbyId).single()` |
| **Used For** | Preload lobby for instant render |
| **Duplicated?** | Yes - also in useGameState.ts |
| **Runs Repeatedly?** | Yes - polling up to 10 times waiting for game |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadResultsData` |
| **Trigger** | On Game→Results transition |
| **Tables** | `lobbies` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobbies').select('*').eq('id', lobbyId).single()` |
| **Used For** | Preload lobby for results page |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per transition |

### 2. INSERT into lobbies

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `createLobby` |
| **Trigger** | On create lobby button click |
| **Tables** | `lobbies` |
| **Operation** | INSERT |
| **Query Shape** | `.from('lobbies').insert({ code, host_user_id: userId }).select().single()` |
| **Used For** | Create new lobby |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - user triggered |

### 3. UPDATE lobbies

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game button click |
| **Tables** | `lobbies` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobbies').update({ status: 'in_progress', current_game_id: game.id }).eq('id', lobbyId)` |
| **Used For** | Update lobby status when game starts |
| **Duplicated?** | Yes - also in Results.tsx playAgain |
| **Runs Repeatedly?** | No - host triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again button click |
| **Tables** | `lobbies` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobbies').update({ status: 'in_progress', current_game_id: newGame.id }).eq('id', lobbyId)` |
| **Used For** | Update lobby for new game |
| **Duplicated?** | Yes - also in Lobby.tsx |
| **Runs Repeatedly?** | No - host triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `moveToResults`, `processEliminationVotes`, `submitGuess` |
| **Trigger** | When game ends |
| **Tables** | `lobbies` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobbies').update({ status: 'results' }).eq('id', lobbyId)` |
| **Used For** | Update lobby status to results |
| **Duplicated?** | Yes - multiple places in Game.tsx |
| **Runs Repeatedly?** | No - once per game end |

---

## Lobby Players Operations

### 1. SELECT from lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On mount/lobbyId change |
| **Tables** | `lobby_players`, `profiles` (join) |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('*, profiles:user_id(avatar_url)').eq('lobby_id', lobbyId).order('joined_at')` |
| **Used For** | Initial players fetch with avatars |
| **Duplicated?** | Yes - also in realtime handler, gamePreloadCache |
| **Runs Repeatedly?** | No - once per lobbyId |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | Realtime handler for lobby_players |
| **Trigger** | On any lobby_players change (realtime) |
| **Tables** | `lobby_players`, `profiles` (join) |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('*, profiles:user_id(avatar_url)').eq('lobby_id', lobbyId).order('joined_at')` |
| **Used For** | Refetch players on realtime change |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | **YES - on every player join/leave/update** |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `joinLobby` |
| **Trigger** | On join lobby |
| **Tables** | `lobby_players` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('*').eq('lobby_id', lobby.id).eq('user_id', userId).single()` |
| **Used For** | Check if user already in lobby |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per join attempt |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData`, `preloadResultsData` |
| **Trigger** | On page transitions |
| **Tables** | `lobby_players`, `profiles` (join) |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('*, profiles:user_id(avatar_url)').eq('lobby_id', lobbyId).order('joined_at')` |
| **Used For** | Preload players for instant render |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per transition |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again |
| **Tables** | `lobby_players` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('*').eq('lobby_id', lobbyId)` |
| **Used For** | Get fresh player list for new game |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per play again |

### 2. INSERT into lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `createLobby` |
| **Trigger** | On create lobby |
| **Tables** | `lobby_players` |
| **Operation** | INSERT |
| **Query Shape** | `.from('lobby_players').insert({ lobby_id, user_id, display_name, is_host: true })` |
| **Used For** | Add host as first player |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `joinLobby` |
| **Trigger** | On join lobby |
| **Tables** | `lobby_players` |
| **Operation** | INSERT |
| **Query Shape** | `.from('lobby_players').insert({ lobby_id, user_id, display_name, is_host })` |
| **Used For** | Add player to lobby |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No |

### 3. UPDATE lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `processEliminationVotes` |
| **Trigger** | When player eliminated |
| **Tables** | `lobby_players` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobby_players').update({ is_spectator: true }).eq('id', eliminatedPlayerId)` |
| **Used For** | Mark eliminated player as spectator |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per elimination |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again |
| **Tables** | `lobby_players` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobby_players').update({ is_spectator: false }).eq('lobby_id', lobbyId)` |
| **Used For** | Reset all spectators to active |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No |

### 4. DELETE from lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `leaveLobby` |
| **Trigger** | On leave lobby button |
| **Tables** | `lobby_players` |
| **Operation** | DELETE |
| **Query Shape** | `.from('lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', userId)` |
| **Used For** | Remove player from lobby |
| **Duplicated?** | Yes - also in Game.tsx, Results.tsx |
| **Runs Repeatedly?** | No - user triggered |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `leaveLobby` |
| **Trigger** | On leave during game |
| **Tables** | `lobby_players` |
| **Operation** | DELETE |
| **Query Shape** | `.from('lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', userId)` |
| **Used For** | Remove player from lobby |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `goHome` |
| **Trigger** | On exit to home |
| **Tables** | `lobby_players` |
| **Operation** | DELETE |
| **Query Shape** | `.from('lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', userId)` |
| **Used For** | Remove player from lobby |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

## Game Operations

### 1. SELECT from games

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On mount if lobby has current_game_id |
| **Tables** | `games` |
| **Operation** | SELECT |
| **Query Shape** | `.from('games').select('*').eq('id', lobbyData.current_game_id).single()` |
| **Used For** | Initial game fetch |
| **Duplicated?** | Yes - also in fetchNewGame |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchNewGame` |
| **Trigger** | When lobby.current_game_id changes |
| **Tables** | `games` |
| **Operation** | SELECT |
| **Query Shape** | `.from('games').select('*').eq('id', lobby.current_game_id).single()` |
| **Used For** | Fetch game when lobby updates |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per game change |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData`, `preloadResultsData` |
| **Trigger** | On page transitions |
| **Tables** | `games` |
| **Operation** | SELECT |
| **Query Shape** | `.from('games').select('*').eq('id', gameId).single()` |
| **Used For** | Preload game for instant render |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 2. INSERT into games

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game button |
| **Tables** | `games` |
| **Operation** | INSERT |
| **Query Shape** | `.from('games').insert({ lobby_id, secret_word_id, outsider_player_id, imposter_word_id, total_rounds, current_round_number: 1, status: 'clue_round', game_mode }).select().single()` |
| **Used For** | Create new game |
| **Duplicated?** | Yes - also in Results.tsx playAgain |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again |
| **Tables** | `games` |
| **Operation** | INSERT |
| **Query Shape** | `.from('games').insert({ ... }).select().single()` |
| **Used For** | Create new game on replay |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 3. UPDATE games

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `startNextRound` |
| **Trigger** | When all clues submitted and host clicks next |
| **Tables** | `games` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('games').update({ current_round_number: nextRound }).eq('id', game.id)` or `.update({ status: 'voting' })` |
| **Used For** | Advance round or move to voting |
| **Duplicated?** | Yes - multiple update patterns |
| **Runs Repeatedly?** | No - once per round transition |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `moveToResults` |
| **Trigger** | When voting complete |
| **Tables** | `games` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('games').update({ status: 'results' }).eq('id', game.id)` |
| **Used For** | End game |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `skipToVoting` |
| **Trigger** | Host skip button |
| **Tables** | `games` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('games').update({ status: 'voting' }).eq('id', game.id)` |
| **Used For** | Skip to voting phase |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `processEliminationVotes`, `submitGuess` |
| **Trigger** | Elimination mode voting complete, outsider correct guess |
| **Tables** | `games` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('games').update({ status: 'results' / current_round_number / status: 'clue_round' }).eq('id', game.id)` |
| **Used For** | Update game state |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

## Round Operations

### 1. SELECT from rounds

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame`, realtime handler |
| **Trigger** | On game load, game change, round number change |
| **Tables** | `rounds` |
| **Operation** | SELECT |
| **Query Shape** | `.from('rounds').select('*').eq('game_id', gameData.id).eq('round_number', gameData.current_round_number).single()` |
| **Used For** | Fetch current round |
| **Duplicated?** | Yes - multiple places |
| **Runs Repeatedly?** | Yes - on every round change (realtime) |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame`, realtime handler |
| **Trigger** | On game load |
| **Tables** | `rounds` |
| **Operation** | SELECT |
| **Query Shape** | `.from('rounds').select('id').eq('game_id', gameData.id)` |
| **Used For** | Get all round IDs for fetching all clues |
| **Duplicated?** | Yes - in multiple places |
| **Runs Repeatedly?** | Yes - on clue changes |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData` |
| **Trigger** | On transition |
| **Tables** | `rounds` |
| **Operation** | SELECT |
| **Query Shape** | `.from('rounds').select('*').eq('game_id', game.id).eq('round_number', game.current_round_number).single()` |
| **Used For** | Preload current round |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 2. INSERT into rounds

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game |
| **Tables** | `rounds` |
| **Operation** | INSERT |
| **Query Shape** | `.from('rounds').insert({ game_id: game.id, round_number: 1, is_complete: false })` |
| **Used For** | Create first round |
| **Duplicated?** | Yes - also in Results.tsx, Game.tsx |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `startNextRound`, `processEliminationVotes` |
| **Trigger** | On round advance |
| **Tables** | `rounds` |
| **Operation** | INSERT |
| **Query Shape** | `.from('rounds').insert({ game_id, round_number: nextRound, is_complete: false }).select().single()` |
| **Used For** | Create new round |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No - once per round advance |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again |
| **Tables** | `rounds` |
| **Operation** | INSERT |
| **Query Shape** | `.from('rounds').insert({ game_id: newGame.id, round_number: 1, is_complete: false })` |
| **Used For** | Create first round of new game |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 3. UPDATE rounds

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `startNextRound`, `skipToVoting` |
| **Trigger** | On round complete |
| **Tables** | `rounds` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('rounds').update({ is_complete: true }).eq('id', currentRound.id)` |
| **Used For** | Mark round as complete |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

## Clue Operations

### 1. SELECT from clues

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On game load, round change |
| **Tables** | `clues` |
| **Operation** | SELECT |
| **Query Shape** | `.from('clues').select('*').eq('round_id', roundData.id).order('created_at')` |
| **Used For** | Fetch clues for current round |
| **Duplicated?** | Yes - also in realtime handler |
| **Runs Repeatedly?** | Yes - on every clue change (realtime) |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame`, realtime handler |
| **Trigger** | On clue changes |
| **Tables** | `clues` |
| **Operation** | SELECT |
| **Query Shape** | `.from('clues').select('*').in('round_id', roundIds).order('created_at')` |
| **Used For** | Fetch all clues for turn calculation |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | **YES - on every clue submission (realtime)** |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData` |
| **Trigger** | On transition |
| **Tables** | `clues` |
| **Operation** | SELECT |
| **Query Shape** | `.from('clues').select('*').eq('round_id', currentRound.id).order('created_at')` |
| **Used For** | Preload clues |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `submitClue` |
| **Trigger** | Before submitting clue (validation) |
| **Tables** | `clues` |
| **Operation** | SELECT (count) |
| **Query Shape** | `.from('clues').select('*', { count: 'exact', head: true }).eq('round_id', currentRound.id)` |
| **Used For** | Server-side turn validation |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per clue submit |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `updateUserStats` |
| **Trigger** | On results load |
| **Tables** | `clues` |
| **Operation** | SELECT |
| **Query Shape** | `.from('clues').select('id').eq('player_id', currentPlayer.id)` |
| **Used For** | Count clues for stats update |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per game end |

### 2. INSERT into clues

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `submitClue` |
| **Trigger** | On clue submit button |
| **Tables** | `clues` |
| **Operation** | INSERT |
| **Query Shape** | `.from('clues').insert({ round_id, player_id, clue_text })` |
| **Used For** | Submit player clue |
| **Duplicated?** | Yes - also in handleSpeedRoundTimeUp |
| **Runs Repeatedly?** | No - once per turn |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `handleSpeedRoundTimeUp` |
| **Trigger** | On timer expiry (timed round) |
| **Tables** | `clues` |
| **Operation** | INSERT |
| **Query Shape** | `.from('clues').insert({ round_id, player_id, clue_text: clueToSubmit })` |
| **Used For** | Auto-submit on timeout |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

## Vote Operations

### 1. SELECT from votes

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On game load if voting/results status |
| **Tables** | `votes` |
| **Operation** | SELECT |
| **Query Shape** | `.from('votes').select('*').eq('game_id', gameData.id)` |
| **Used For** | Initial votes fetch |
| **Duplicated?** | Yes - also in realtime handler |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | Realtime handler for votes |
| **Trigger** | On any vote change (realtime) |
| **Tables** | `votes` |
| **Operation** | SELECT |
| **Query Shape** | `.from('votes').select('*').eq('game_id', game.id)` |
| **Used For** | Refetch votes on change |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | **YES - on every vote submission** |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadResultsData` |
| **Trigger** | On Game→Results transition |
| **Tables** | `votes` |
| **Operation** | SELECT |
| **Query Shape** | `.from('votes').select('*').eq('game_id', gameId)` |
| **Used For** | Preload votes for results |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 2. INSERT into votes

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `submitVotes` |
| **Trigger** | On vote submit button |
| **Tables** | `votes` |
| **Operation** | INSERT |
| **Query Shape** | `.from('votes').insert(voteInserts)` (array of votes) |
| **Used For** | Submit player votes |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per voting phase |

### 3. DELETE from votes

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `processEliminationVotes` |
| **Trigger** | After elimination round processed |
| **Tables** | `votes` |
| **Operation** | DELETE |
| **Query Shape** | `.from('votes').delete().eq('game_id', game.id)` |
| **Used For** | Clear votes for next round |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per elimination round |

---

## Word Operations

### 1. SELECT from words

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On game load |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('*').eq('id', gameData.secret_word_id).single()` |
| **Used For** | Fetch secret word |
| **Duplicated?** | Yes - also for imposter word |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On game load (hidden_imposter mode) |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('*').eq('id', gameData.imposter_word_id).single()` |
| **Used For** | Fetch imposter word |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game (for built-in categories) |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('*').in('category', selectedCategories)` |
| **Used For** | Get words for game |
| **Duplicated?** | Yes - also in Results.tsx playAgain |
| **Runs Repeatedly?** | No |
| **⚠️ RISK** | **NO LIMIT - fetches all words in categories** |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` (hidden_imposter mode) |
| **Trigger** | On start game for placeholder |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('id').limit(1).single()` |
| **Used For** | Get placeholder word ID for custom words |
| **Duplicated?** | Yes - also in Results.tsx |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('*').in('category', gameConfig.selectedCategories)` |
| **Used For** | Get words for new game |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |
| **⚠️ RISK** | **NO LIMIT - fetches all words in categories** |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/InPersonGame.tsx` |
| **Function** | Game initialization (useEffect) |
| **Trigger** | On mount |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('text, category').in('category', selectedCats)` |
| **Used For** | Get words for in-person game |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No |
| **⚠️ RISK** | **NO LIMIT - fetches all words in categories** |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData`, `preloadResultsData` |
| **Trigger** | On transitions |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('*').eq('id', game.secret_word_id).single()` |
| **Used For** | Preload secret word |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

## Game Outsiders Operations

### 1. SELECT from game_outsiders

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchOutsiders` |
| **Trigger** | On game change |
| **Tables** | `game_outsiders` |
| **Operation** | SELECT |
| **Query Shape** | `.from('game_outsiders').select('*').eq('game_id', game.id)` |
| **Used For** | Fetch outsiders for game |
| **Duplicated?** | Yes - also in gamePreloadCache |
| **Runs Repeatedly?** | No - once per game |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData`, `preloadResultsData` |
| **Trigger** | On transitions |
| **Tables** | `game_outsiders` |
| **Operation** | SELECT |
| **Query Shape** | `.from('game_outsiders').select('*').eq('game_id', game.id)` |
| **Used For** | Preload outsiders |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 2. INSERT into game_outsiders

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game |
| **Tables** | `game_outsiders` |
| **Operation** | INSERT |
| **Query Shape** | `.from('game_outsiders').insert(outsiderInserts)` (array) |
| **Used For** | Record outsiders for game |
| **Duplicated?** | Yes - also in Results.tsx |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` (prepare) |
| **Trigger** | On play again |
| **Tables** | `game_outsiders` |
| **Operation** | INSERT |
| **Query Shape** | `.from('game_outsiders').insert(outsiderInserts)` |
| **Used For** | Record outsiders for new game |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

## User Stats Operations

### 1. SELECT from user_stats

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `fetchStats` |
| **Trigger** | On mount |
| **Tables** | `user_stats` |
| **Operation** | SELECT |
| **Query Shape** | `.from('user_stats').select('*').eq('user_id', session.user.id).single()` |
| **Used For** | Fetch user stats for display |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `updateUserStats` |
| **Trigger** | On results ready |
| **Tables** | `user_stats` |
| **Operation** | SELECT |
| **Query Shape** | `.from('user_stats').select('*').eq('user_id', session.user.id).maybeSingle()` |
| **Used For** | Fetch current stats before update |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per game end |

### 2. INSERT into user_stats

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/AuthCallback.tsx` |
| **Function** | `handleCallback` |
| **Trigger** | On OAuth new user |
| **Tables** | `user_stats` |
| **Operation** | INSERT |
| **Query Shape** | `.from('user_stats').insert({ user_id: session.user.id })` |
| **Used For** | Create stats for new user |
| **Duplicated?** | Yes - also in Auth.tsx, Stats.tsx, Results.tsx |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` |
| **Trigger** | On signup |
| **Tables** | `user_stats` |
| **Operation** | INSERT |
| **Query Shape** | `.from('user_stats').insert({ user_id: data.user.id })` |
| **Used For** | Create stats for new user |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleGuestAuth` |
| **Trigger** | On guest upgrade |
| **Tables** | `user_stats` |
| **Operation** | INSERT |
| **Query Shape** | `.from('user_stats').insert({ user_id: data.user.id })` |
| **Used For** | Create stats for upgraded user |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `updateUserStats` |
| **Trigger** | On results if no stats exist |
| **Tables** | `user_stats` |
| **Operation** | INSERT |
| **Query Shape** | `.from('user_stats').insert({ user_id: session.user.id })` |
| **Used For** | Create stats if missing |
| **Duplicated?** | Yes |
| **Runs Repeatedly?** | No |

### 3. UPDATE user_stats

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `updateUserStats` |
| **Trigger** | On results ready |
| **Tables** | `user_stats` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('user_stats').update({ games_played, games_played_as_outsider, games_played_as_safe, games_won_as_outsider, games_won_as_safe, current_win_streak, best_win_streak, total_clues_submitted, total_votes_cast, total_correct_votes }).eq('user_id', session.user.id)` |
| **Used For** | Record game results |
| **Duplicated?** | No |
| **Runs Repeatedly?** | No - once per game end |

---

## A) Realtime Channels

### 1. Lobby + Lobby Players Channel

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Channel Name** | `lobby-${lobbyId}-${random}` |
| **Filter** | `table: 'lobbies', filter: id=eq.${lobbyId}` AND `table: 'lobby_players', filter: lobby_id=eq.${lobbyId}` |
| **Event Types** | `*` (all events) |
| **When Starts** | On hook mount with lobbyId |
| **When Stops** | On hook unmount (cleanup) |
| **Cleanup Logic** | `supabase.removeChannel(lobbyChannel)` in useEffect return |
| **⚠️ Leak Risk** | **LOW** - Proper cleanup in useEffect |

### 2. Game + Clues + Votes Channel

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Channel Name** | `game-${game.id}-${random}` |
| **Filter** | `table: 'games', filter: id=eq.${game.id}` AND `table: 'clues'` (no filter!) AND `table: 'votes', filter: game_id=eq.${game.id}` |
| **Event Types** | `*` (all events) |
| **When Starts** | When game.id is available |
| **When Stops** | When game.id changes or component unmounts |
| **Cleanup Logic** | `supabase.removeChannel(gameChannel)` in useEffect return |
| **⚠️ Leak Risk** | **MEDIUM** - Clues listener has NO FILTER, receives all clue changes globally |

### 3. Game Metadata Broadcast Channel

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Channel Name** | `game-metadata-${game.id}` |
| **Filter** | Broadcast only (no postgres_changes) |
| **Event Types** | `metadata`, `request-metadata` |
| **When Starts** | When game.id and currentPlayer exist |
| **When Stops** | When game.id changes or component unmounts |
| **Cleanup Logic** | `supabase.removeChannel(channel)` in useEffect return |
| **⚠️ Leak Risk** | **LOW** - Proper cleanup |

### 4. Game Metadata on Results Page

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Channel Name** | `game-metadata-${game.id}` |
| **Filter** | Broadcast only |
| **Event Types** | `metadata` |
| **When Starts** | When game.id exists |
| **When Stops** | When game.id changes or component unmounts |
| **Cleanup Logic** | `supabase.removeChannel(channel)` in useEffect return |
| **⚠️ Leak Risk** | **LOW** - Proper cleanup |

### 5. New Game Transition Broadcast

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Channel Name** | `new-game-transition-${lobbyId}` |
| **Filter** | Broadcast only |
| **Event Types** | `new-game-starting` |
| **When Starts** | On mount for non-host players |
| **When Stops** | On component unmount |
| **Cleanup Logic** | `supabase.removeChannel(channel)` in useEffect return |
| **⚠️ Leak Risk** | **LOW** - Proper cleanup |

### 6. New Game Transition Broadcast (Host Sending)

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Channel Name** | `new-game-transition-${lobbyId}` |
| **Filter** | Broadcast only |
| **Event Types** | `new-game-starting` (sending) |
| **When Starts** | In playAgain prepare function |
| **When Stops** | After broadcast sent |
| **Cleanup Logic** | `supabase.removeChannel(channel)` in finally block |
| **⚠️ Leak Risk** | **LOW** - Cleanup in finally |

### 7. Outsider Guess Metadata Broadcast

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Channel Name** | `game-metadata-${game.id}` |
| **Filter** | Broadcast only |
| **Event Types** | `metadata` (sending) |
| **When Starts** | On correct outsider guess |
| **When Stops** | After broadcast |
| **Cleanup Logic** | **MISSING** - channel created but not removed |
| **⚠️ Leak Risk** | **HIGH** - No cleanup for this send-only channel |

---

## B) Cost Risk Flags

### 🔴 HIGH RISK

#### 1. Global Clues Listener (No Filter)
- **File:** `src/hooks/useGameState.ts` lines 323-358
- **Issue:** The realtime subscription for `clues` table has **no filter**, meaning it receives ALL clue insertions across ALL games globally
- **Impact:** Every clue submitted by any player in any game triggers a refetch
- **Fix:** Add filter `.eq('round_id', currentRound.id)` or track which round IDs belong to current game

#### 2. Wide SELECT on Words Table (No Limit)
- **Files:** `src/pages/Lobby.tsx`, `src/pages/Results.tsx`, `src/pages/InPersonGame.tsx`
- **Issue:** `select('*').in('category', selectedCategories)` with **no limit**
- **Impact:** Could fetch thousands of words if many categories selected
- **Fix:** Add `.limit(500)` or paginate

### 🟠 MEDIUM RISK

#### 3. Duplicate Queries on Realtime Events
- **File:** `src/hooks/useGameState.ts`
- **Issue:** On every lobby_players change, a full refetch occurs. On every clue change, all rounds + all clues are refetched.
- **Impact:** N+1 query pattern on realtime events
- **Fix:** Use payload data from realtime event instead of refetching

#### 4. Duplicate Initial Fetches
- **Files:** `src/hooks/useGameState.ts` and `src/lib/gamePreloadCache.ts`
- **Issue:** Both files fetch the same data (lobby, players, game, words, etc.)
- **Impact:** Double fetches on page transitions
- **Fix:** Share cache between them or have hook consume cache

#### 5. Auth Session Checked Multiple Times
- **Files:** `Auth.tsx`, `AuthCallback.tsx`, `Stats.tsx`, `Menu.tsx`, `Results.tsx`
- **Issue:** `supabase.auth.getSession()` called independently in 5+ places
- **Impact:** Multiple auth checks on app load/navigation
- **Fix:** Centralize auth state in a context provider

### 🟡 LOW RISK

#### 6. Multiple SELECT(*) Patterns
- **Files:** Various
- **Issue:** Many queries use `select('*')` instead of specific columns
- **Impact:** Fetches more data than needed
- **Fix:** Select only needed columns

#### 7. Polling in gamePreloadCache
- **File:** `src/lib/gamePreloadCache.ts` lines 59-73
- **Issue:** Polls up to 10 times (100ms intervals) waiting for game to exist
- **Impact:** Up to 10 queries per transition if game not ready
- **Fix:** Acceptable for transition reliability, but could use exponential backoff

#### 8. User Stats Insert Duplication
- **Files:** `AuthCallback.tsx`, `Auth.tsx`, `Stats.tsx`, `Results.tsx`
- **Issue:** Same insert logic for user_stats in 4 places
- **Impact:** Code maintenance issue, not performance
- **Fix:** Create shared utility function

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total DB Interactions** | ~75 |
| **SELECT Operations** | ~45 |
| **INSERT Operations** | ~18 |
| **UPDATE Operations** | ~12 |
| **DELETE Operations** | 4 |
| **Auth Operations** | 8 |
| **Realtime Subscriptions** | 7 |
| **Potential Channel Leaks** | 1 |
| **High Risk Issues** | 2 |
| **Medium Risk Issues** | 3 |
| **Low Risk Issues** | 4 |

---

## UNKNOWN / Expected But Not Found

| Expected | Status |
|----------|--------|
| Storage bucket operations | NOT FOUND - No file uploads in app |
| RPC function calls | NOT FOUND - All operations use direct table access |
| Soft deletes | NOT FOUND - Uses hard DELETE |
| Transactions | NOT FOUND - No multi-table atomic operations |
