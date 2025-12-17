-- Enable REPLICA IDENTITY FULL for complete row data on delete events
ALTER TABLE public.lobby_players REPLICA IDENTITY FULL;