-- Add unique constraint on gmail_message_id for upserts
ALTER TABLE public.email_signals 
ADD CONSTRAINT email_signals_gmail_message_id_key UNIQUE (gmail_message_id);