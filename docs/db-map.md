# Database Usage Map - Outsider Royale

> **Audit Date:** 2026-01-12  
> **Last Updated:** 2026-01-13 (Documentation Sync - Code Verified)
> **Purpose:** Complete inventory of all Supabase interactions in the application

---

## Cost Optimization Status Summary

All high-priority cost fixes have been verified as **implemented in code**:

| Fix | Status | Implementation |
|-----|--------|----------------|
| Clues realtime filter | ✅ DONE | `filter: round_id=eq.${currentRound.id}` (useGameState.ts:404) |
| Clues payload apply | ✅ DONE | INSERT/UPDATE/DELETE update local state directly (useGameState.ts:410-435) |
| Votes payload apply | ✅ DONE | INSERT/UPDATE/DELETE update local state directly (useGameState.ts:450-463) |
| lobby_players payload apply | ✅ DONE | UPDATE/DELETE inline, INSERT uses debounced refetch for avatar (useGameState.ts:237-251) |
| Words RPC usage | ✅ DONE | All files use `get_random_words_from_categories()` and `get_imposter_word()` RPCs |
| Broadcast channel cleanup | ✅ DONE | try/finally with `removeChannel()` in Game.tsx:619-621 and Results.tsx:607 |
| Auth centralized | ✅ DONE | AuthProvider context at src/contexts/AuthContext.tsx |
| Preload cache integration | ✅ DONE | useGameState checks cache first via getCachedGameData/getCachedResultsData |

---

## DB Cost Impact Summary

### Queries Removed
| Query | Files | Est. Rows Before | Est. Rows After |
|-------|-------|------------------|-----------------|
| `words.select('*').in('category', [...])` | Lobby.tsx, Results.tsx, InPersonGame.tsx | 100-1000+ | 1-2 (RPC returns only needed rows) |
| Full votes refetch on each vote | useGameState.ts | N votes × M events | 0 (payload applied) |
| Full lobby_players refetch on each change | useGameState.ts | N players × M events | 1 per INSERT (avatar fetch) |
| Full clues refetch on each clue | useGameState.ts | N clues × M events | 0 (payload applied) |

### Realtime Subscription Efficiency
| Subscription | Filter | Handler |
|--------------|--------|---------|
| Clues | `round_id=eq.${currentRound.id}` | Payload applied to local state |
| Votes | `game_id=eq.${game.id}` | Payload applied to local state |
| Lobby Players | `lobby_id=eq.${lobbyId}` | Payload applied (debounced avatar fetch on INSERT) |

### RPC Functions Used
| Function | Purpose | Called From |
|----------|---------|-------------|
| `get_random_words_from_categories(p_categories, p_count, p_exclude_word_id)` | Server-side random word selection (returns 1-2 rows) | Lobby.tsx, Results.tsx, InPersonGame.tsx |
| `get_imposter_word(p_secret_word_id, p_categories)` | Get different word for hidden_imposter mode (returns 1 row) | Lobby.tsx, Results.tsx |

---

## Table of Contents

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
13. [Remaining Risk Flags](#b-remaining-risk-flags)

---

## Authentication Operations

### 1. supabase.auth.getSession()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/contexts/AuthContext.tsx` |
| **Function** | `AuthProvider` useEffect |
| **Trigger** | On provider mount |
| **Operation** | Auth session read |
| **Query Shape** | `supabase.auth.getSession()` |
| **Used For** | Centralized session management |
| **Duplicated?** | No - centralized in AuthProvider |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/AuthCallback.tsx` |
| **Function** | `handleCallback` |
| **Trigger** | On OAuth callback |
| **Operation** | Auth session read |
| **Query Shape** | `supabase.auth.getSession()` |
| **Used For** | OAuth callback handling |

### 2. supabase.auth.signUp()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` |
| **Trigger** | On form submit (signup mode) |
| **Operation** | Auth signup |
| **Query Shape** | `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })` |

### 3. supabase.auth.signInWithPassword()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Auth.tsx` |
| **Function** | `handleEmailAuth` |
| **Trigger** | On form submit (signin mode) |
| **Operation** | Auth signin |
| **Query Shape** | `supabase.auth.signInWithPassword({ email, password })` |

### 4. supabase.auth.signOut()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleLogout` |
| **Trigger** | On logout button click |
| **Operation** | Auth signout |
| **Query Shape** | `supabase.auth.signOut()` |

### 5. supabase.auth.onAuthStateChange()

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/contexts/AuthContext.tsx` |
| **Function** | `AuthProvider` useEffect |
| **Trigger** | On provider mount |
| **Operation** | Auth state subscription |
| **Query Shape** | `supabase.auth.onAuthStateChange(callback)` |
| **Used For** | React to auth state changes centrally |

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

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/components/GameHeader.tsx` |
| **Function** | `fetchAvatar` |
| **Trigger** | On mount/userId change |
| **Tables** | `profiles` |
| **Operation** | SELECT |
| **Query Shape** | `.from('profiles').select('avatar_url').eq('id', userId).maybeSingle()` |
| **Used For** | Fetch avatar for header display |

### 2. INSERT into profiles

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Onboarding.tsx` |
| **Function** | `handleContinue` |
| **Trigger** | On form submit |
| **Tables** | `profiles` |
| **Operation** | INSERT |
| **Query Shape** | `.from('profiles').insert({ display_name: displayName.trim() }).select().single()` |

### 3. UPDATE profiles

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx` |
| **Function** | `handleAvatarSelect` |
| **Trigger** | On avatar selection |
| **Tables** | `profiles` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('profiles').update({ avatar_url: avatarId }).eq('id', profileId)` |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/components/AccountSettings.tsx` |
| **Function** | `handleUpdateDisplayName` |
| **Trigger** | On display name update |
| **Tables** | `profiles` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('profiles').update({ display_name: newDisplayName.trim() }).eq('id', profileId)` |

---

## Lobby Operations

### 1. SELECT from lobbies

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On mount/lobbyId change (if not in cache) |
| **Tables** | `lobbies` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobbies').select('id, code, host_user_id, status, current_game_id, created_at').eq('id', lobbyId).single()` |
| **Used For** | Initial lobby data fetch |
| **Cache Aware?** | Yes - skips if getCachedGameData/getCachedResultsData has data |

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

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/lib/gamePreloadCache.ts` |
| **Function** | `preloadGameData`, `preloadResultsData` |
| **Trigger** | On page transitions |
| **Tables** | `lobbies` |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobbies').select('id, code, host_user_id, status, current_game_id, created_at').eq('id', lobbyId).single()` |
| **Used For** | Preload lobby for instant render |

### 2. INSERT into lobbies

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `createLobby` |
| **Trigger** | On create lobby button click |
| **Tables** | `lobbies` |
| **Operation** | INSERT |
| **Query Shape** | `.from('lobbies').insert({ code, host_user_id: userId }).select().single()` |

### 3. UPDATE lobbies

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game button click |
| **Tables** | `lobbies` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobbies').update({ status: 'in_progress', current_game_id: game.id }).eq('id', lobbyId)` |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `moveToResults`, `processEliminationVotes`, `submitGuess` |
| **Trigger** | When game ends |
| **Tables** | `lobbies` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobbies').update({ status: 'results' }).eq('id', lobbyId)` |

---

## Lobby Players Operations

### 1. SELECT from lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On mount/lobbyId change (if not in cache) |
| **Tables** | `lobby_players`, `profiles` (join) |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('id, lobby_id, user_id, is_host, is_connected, is_spectator, joined_at, display_name, profiles:user_id(avatar_url)').eq('lobby_id', lobbyId).order('joined_at')` |
| **Used For** | Initial players fetch with avatars |
| **Cache Aware?** | Yes - skips if cache has data |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `debouncedRefetchPlayers` |
| **Trigger** | On lobby_players INSERT realtime event (debounced 300ms) |
| **Tables** | `lobby_players`, `profiles` (join) |
| **Operation** | SELECT |
| **Query Shape** | `.from('lobby_players').select('id, lobby_id, user_id, is_host, is_connected, is_spectator, joined_at, display_name, profiles:user_id(avatar_url)').eq('lobby_id', lobbyId).order('joined_at')` |
| **Used For** | Resolve avatar_url for new player |
| **Runs Repeatedly?** | Only on INSERT events, debounced |

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

### 2. INSERT into lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Home.tsx` |
| **Function** | `createLobby`, `joinLobby` |
| **Trigger** | On create/join lobby |
| **Tables** | `lobby_players` |
| **Operation** | INSERT |
| **Query Shape** | `.from('lobby_players').insert({ lobby_id, user_id, display_name, is_host })` |

### 3. UPDATE lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `processEliminationVotes` |
| **Trigger** | When player eliminated |
| **Tables** | `lobby_players` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('lobby_players').update({ is_spectator: true }).eq('id', eliminatedPlayerId)` |

### 4. DELETE from lobby_players

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx`, `src/pages/Game.tsx`, `src/pages/Results.tsx` |
| **Function** | `leaveLobby`, `goHome` |
| **Trigger** | On leave button |
| **Tables** | `lobby_players` |
| **Operation** | DELETE |
| **Query Shape** | `.from('lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', userId)` |

---

## Game Operations

### 1. SELECT from games

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On mount if lobby has current_game_id, or when current_game_id changes |
| **Tables** | `games` |
| **Operation** | SELECT |
| **Query Shape** | `.from('games').select('id, lobby_id, secret_word_id, outsider_player_id, total_rounds, current_round_number, status, created_at, game_mode, imposter_word_id').eq('id', gameId).single()` |
| **Cache Aware?** | Yes - skips if cache has data |

### 2. INSERT into games

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx`, `src/pages/Results.tsx` |
| **Function** | `startGame`, `playAgain` |
| **Trigger** | On start/replay game |
| **Tables** | `games` |
| **Operation** | INSERT |
| **Query Shape** | `.from('games').insert({ lobby_id, secret_word_id, outsider_player_id, imposter_word_id, total_rounds, current_round_number: 1, status: 'clue_round', game_mode }).select().single()` |

### 3. UPDATE games

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `startNextRound`, `moveToResults`, `skipToVoting`, `processEliminationVotes`, `submitGuess` |
| **Trigger** | Game state transitions |
| **Tables** | `games` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('games').update({ status / current_round_number }).eq('id', game.id)` |

---

## Round Operations

### 1. SELECT from rounds

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On game load |
| **Tables** | `rounds` |
| **Operation** | SELECT |
| **Query Shape** | `.from('rounds').select('id, game_id, round_number, is_complete, created_at').eq('game_id', gameId).eq('round_number', currentRoundNumber).single()` |
| **Cache Aware?** | Yes |

### 2. INSERT into rounds

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx`, `src/pages/Game.tsx`, `src/pages/Results.tsx` |
| **Function** | `startGame`, `startNextRound`, `playAgain` |
| **Trigger** | On game start or round advance |
| **Tables** | `rounds` |
| **Operation** | INSERT |
| **Query Shape** | `.from('rounds').insert({ game_id, round_number, is_complete: false })` |

### 3. UPDATE rounds

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `startNextRound`, `skipToVoting` |
| **Trigger** | On round complete |
| **Tables** | `rounds` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('rounds').update({ is_complete: true }).eq('id', currentRound.id)` |

---

## Clue Operations

### 1. SELECT from clues

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On game/round load |
| **Tables** | `clues` |
| **Operation** | SELECT |
| **Query Shape** | `.from('clues').select('id, round_id, player_id, clue_text, created_at').eq('round_id', roundId).order('created_at')` |
| **Used For** | Fetch clues for current round |
| **Cache Aware?** | Yes |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData` |
| **Trigger** | On game load |
| **Tables** | `clues`, `rounds` |
| **Operation** | SELECT |
| **Query Shape** | `.from('clues').select('id, round_id, player_id, clue_text, created_at').in('round_id', roundIds).order('created_at')` |
| **Used For** | Fetch ALL clues for turn calculation |
| **Runs Repeatedly?** | No - once per game load (not on realtime events) |

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

### 2. INSERT into clues

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `submitClue`, `handleSpeedRoundTimeUp` |
| **Trigger** | On clue submit or timer expiry |
| **Tables** | `clues` |
| **Operation** | INSERT |
| **Query Shape** | `.from('clues').insert({ round_id, player_id, clue_text })` |

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
| **Query Shape** | `.from('votes').select('id, game_id, voter_player_id, suspected_outsider_player_id, created_at').eq('game_id', gameId)` |
| **Used For** | Initial votes fetch |
| **Runs Repeatedly?** | No - payload applied on realtime events |

### 2. INSERT into votes

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `submitVotes` |
| **Trigger** | On vote submit button |
| **Tables** | `votes` |
| **Operation** | INSERT |
| **Query Shape** | `.from('votes').insert(voteInserts)` |

### 3. DELETE from votes

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Function** | `processEliminationVotes` |
| **Trigger** | After elimination round processed |
| **Tables** | `votes` |
| **Operation** | DELETE |
| **Query Shape** | `.from('votes').delete().eq('game_id', game.id)` |

---

## Word Operations

### 1. RPC: get_random_words_from_categories

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx` |
| **Function** | `startGame` |
| **Trigger** | On start game |
| **Operation** | RPC |
| **Query Shape** | `.rpc('get_random_words_from_categories', { p_categories, p_count: 1 })` |
| **Returns** | 1 row (random word from categories) |
| **Used For** | Select secret word for game |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `playAgain` |
| **Trigger** | On play again |
| **Operation** | RPC |
| **Query Shape** | `.rpc('get_random_words_from_categories', { p_categories, p_count: 1 })` |
| **Returns** | 1 row |
| **Used For** | Select secret word for new game |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/InPersonGame.tsx` |
| **Function** | `loadGame`, `playAgain` |
| **Trigger** | On game init or replay |
| **Operation** | RPC |
| **Query Shape** | `.rpc('get_random_words_from_categories', { p_categories, p_count: 1 })` |
| **Returns** | 1 row |
| **Used For** | Select word for in-person game |

### 2. RPC: get_imposter_word

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx`, `src/pages/Results.tsx` |
| **Function** | `startGame`, `playAgain` |
| **Trigger** | On start game (hidden_imposter mode) |
| **Operation** | RPC |
| **Query Shape** | `.rpc('get_imposter_word', { p_secret_word_id, p_categories })` |
| **Returns** | 1 row (different word from secret) |
| **Used For** | Select imposter word for hidden_imposter mode |

### 3. SELECT from words (by ID only)

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Function** | `fetchData`, `fetchNewGame` |
| **Trigger** | On game load |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('id, text, category').eq('id', secretWordId).single()` |
| **Used For** | Fetch secret word by ID |
| **Note** | Single row by ID - not bulk fetch |

---

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx`, `src/pages/Results.tsx` |
| **Function** | `startGame`, `playAgain` (custom word placeholder) |
| **Trigger** | When using custom words |
| **Tables** | `words` |
| **Operation** | SELECT |
| **Query Shape** | `.from('words').select('id').limit(1).single()` |
| **Used For** | Get placeholder word ID for custom words |
| **Note** | Single row with limit - not bulk fetch |

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
| **Query Shape** | `.from('game_outsiders').select('id, game_id, player_id, created_at').eq('game_id', gameId)` |

### 2. INSERT into game_outsiders

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Lobby.tsx`, `src/pages/Results.tsx` |
| **Function** | `startGame`, `playAgain` |
| **Trigger** | On game start |
| **Tables** | `game_outsiders` |
| **Operation** | INSERT |
| **Query Shape** | `.from('game_outsiders').insert(outsiderInserts)` |

---

## User Stats Operations

### 1. SELECT from user_stats

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Stats.tsx`, `src/pages/Results.tsx` |
| **Function** | `fetchStats`, `updateUserStats` |
| **Trigger** | On mount, on results ready |
| **Tables** | `user_stats` |
| **Operation** | SELECT |
| **Query Shape** | `.from('user_stats').select('*').eq('user_id', userId).maybeSingle()` |

### 2. INSERT into user_stats

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/AuthCallback.tsx`, `src/pages/Auth.tsx`, `src/pages/Results.tsx` |
| **Function** | Various |
| **Trigger** | On new user creation |
| **Tables** | `user_stats` |
| **Operation** | INSERT |
| **Query Shape** | `.from('user_stats').insert({ user_id })` |

### 3. UPDATE user_stats

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Function** | `updateUserStats` |
| **Trigger** | On results ready |
| **Tables** | `user_stats` |
| **Operation** | UPDATE |
| **Query Shape** | `.from('user_stats').update({ games_played, games_won_as_outsider, ... }).eq('user_id', userId)` |

---

## A) Realtime Channels

### 1. Lobby + Lobby Players Channel

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Channel Name** | `lobby-${lobbyId}-${random}` |
| **postgres_changes** | `table: 'lobbies', filter: id=eq.${lobbyId}` AND `table: 'lobby_players', filter: lobby_id=eq.${lobbyId}` |
| **Event Types** | `*` (all events) |
| **When Starts** | On hook mount with lobbyId |
| **When Stops** | On hook unmount |
| **Cleanup** | `supabase.removeChannel(lobbyChannel)` in useEffect return |
| **Handler** | Payload applied to local state (debounced refetch on INSERT for avatar) |

### 2. Game + Clues + Votes Channel

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/hooks/useGameState.ts` |
| **Channel Name** | `game-${game.id}-${random}` |
| **postgres_changes** | `table: 'games', filter: id=eq.${game.id}` AND `table: 'clues', filter: round_id=eq.${currentRound.id}` AND `table: 'votes', filter: game_id=eq.${game.id}` |
| **Event Types** | `*` (all events) |
| **When Starts** | When game.id is available |
| **When Stops** | When game.id changes or component unmounts |
| **Cleanup** | `supabase.removeChannel(gameChannel)` in useEffect return |
| **Handler** | Payload applied to local state for all three tables |

### 3. Game Metadata Broadcast Channel

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Channel Name** | `game-metadata-${game.id}` |
| **Type** | Broadcast only (no postgres_changes) |
| **Event Types** | `metadata`, `request-metadata` |
| **When Starts** | When game.id and currentPlayer exist |
| **When Stops** | When game.id changes or component unmounts |
| **Cleanup** | `supabase.removeChannel(channel)` in useEffect return |

### 4. Game Metadata on Results Page

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Channel Name** | `game-metadata-${game.id}` |
| **Type** | Broadcast only |
| **Event Types** | `metadata` |
| **When Starts** | When game.id exists |
| **When Stops** | When game.id changes or component unmounts |
| **Cleanup** | `supabase.removeChannel(channel)` in useEffect return |

### 5. New Game Transition Broadcast (Listener)

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Channel Name** | `new-game-transition-${lobbyId}` |
| **Type** | Broadcast only |
| **Event Types** | `new-game-starting` (receiving) |
| **When Starts** | On mount for non-host players |
| **When Stops** | On component unmount |
| **Cleanup** | `supabase.removeChannel(channel)` in useEffect return |

### 6. New Game Transition Broadcast (Host Sending)

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Results.tsx` |
| **Channel Name** | `new-game-transition-${lobbyId}` |
| **Type** | Broadcast only (send-only) |
| **Event Types** | `new-game-starting` (sending) |
| **When Starts** | In playAgain function |
| **When Stops** | After broadcast sent |
| **Cleanup** | `supabase.removeChannel(channel)` in finally block (line 607) |

### 7. Outsider Guess Metadata Broadcast

| Attribute | Value |
|-----------|-------|
| **File Path** | `src/pages/Game.tsx` |
| **Channel Name** | `game-metadata-${game.id}` |
| **Type** | Broadcast only (send-only) |
| **Event Types** | `metadata` (sending) |
| **When Starts** | On correct outsider guess |
| **When Stops** | After broadcast |
| **Cleanup** | `supabase.removeChannel(channel)` in finally block (line 621) |

---

## B) Remaining Risk Flags

### 🟡 LOW RISK (Acceptable)

#### 1. Polling in gamePreloadCache
- **File:** `src/lib/gamePreloadCache.ts`
- **Issue:** Polls up to 10 times (100ms intervals) waiting for game to exist
- **Impact:** Up to 10 queries per transition if game not ready
- **Status:** Acceptable for transition reliability

#### 2. User Stats Insert Duplication
- **Files:** `AuthCallback.tsx`, `Auth.tsx`, `Stats.tsx`, `Results.tsx`
- **Issue:** Same insert logic in 4 places
- **Impact:** Code maintenance issue, not performance
- **Fix:** Could create shared utility function

#### 3. Auth getSession in AuthCallback.tsx
- **File:** `src/pages/AuthCallback.tsx`
- **Issue:** Calls getSession directly instead of using AuthContext
- **Impact:** One extra call during OAuth flow only
- **Status:** Acceptable - OAuth callback runs before context is available

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total DB Interactions** | ~60 |
| **SELECT Operations** | ~35 |
| **INSERT Operations** | ~15 |
| **UPDATE Operations** | ~10 |
| **DELETE Operations** | 3 |
| **RPC Calls** | 5 |
| **Auth Operations** | 6 |
| **Realtime Subscriptions** | 7 |
| **Channel Leaks** | 0 |
| **High Risk Issues** | 0 |
| **Medium Risk Issues** | 0 |
| **Low Risk Issues** | 3 |

---

## Verification Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| No global clues realtime listener | ✅ | `filter: round_id=eq.${currentRound.id}` at useGameState.ts:404 |
| No unlimited word table fetch | ✅ | All word selection uses RPC functions returning 1-2 rows |
| Realtime does not trigger full refetch for players | ✅ | Payload applied at useGameState.ts:237-251, debounced refetch only on INSERT |
| Realtime does not trigger full refetch for clues | ✅ | Payload applied at useGameState.ts:410-435 |
| Realtime does not trigger full refetch for votes | ✅ | Payload applied at useGameState.ts:450-463 |
| No channel leaks | ✅ | All send-only channels use try/finally cleanup |
| useGameState uses preload cache | ✅ | Checks getCachedGameData/getCachedResultsData before fetching |
