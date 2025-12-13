-- Update the function to start waitlist positions at 7913
CREATE OR REPLACE FUNCTION public.get_next_waitlist_position()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_position INTEGER;
BEGIN
  SELECT COALESCE(MAX(waitlist_position), 7912) INTO max_position FROM public.waitlist;
  RETURN max_position + 1;
END;
$function$;