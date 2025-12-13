-- Update function to ensure new signups start at position 7912
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(waitlist_position), 7911) INTO max_position FROM public.waitlist;
  -- Ensure minimum position is 7912
  IF max_position < 7911 THEN
    max_position := 7911;
  END IF;
  RETURN max_position + 1;
END;
$$;