-- Admin policies for reputation and undercurrents (service role already has full access)
CREATE POLICY "Admins can view all reputation"
ON public.user_reputation
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all reputation"
ON public.user_reputation
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all undercurrents"
ON public.undercurrents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert undercurrents"
ON public.undercurrents
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update undercurrents"
ON public.undercurrents
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all interactions"
ON public.user_undercurrent_interactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));