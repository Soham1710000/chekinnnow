-- Allow users to view profiles of people they have active introductions with
CREATE POLICY "Users can view profiles of their connections" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM introductions i
    WHERE (
      (i.user_a_id = auth.uid() AND i.user_b_id = profiles.id)
      OR (i.user_b_id = auth.uid() AND i.user_a_id = profiles.id)
    )
  )
);