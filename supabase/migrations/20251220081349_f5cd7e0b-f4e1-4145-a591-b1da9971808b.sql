-- Add restrictive policy to explicitly block unauthenticated access to profiles
CREATE POLICY "Require authentication for profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);