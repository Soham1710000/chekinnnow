-- Create profiles table for user data
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  bio text,
  role text,
  industry text,
  goals text[],
  skills text[],
  looking_for text,
  interests text[],
  communication_style text,
  connection_intent text,
  learning_complete boolean DEFAULT false,
  learning_messages_count integer DEFAULT 0,
  ai_insights jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create chat_messages table for ChekInn bot conversations
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'intro_card', 'system')),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create introductions table for admin-created matches
CREATE TABLE public.introductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_b_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  intro_message text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted_a', 'accepted_b', 'active', 'ended', 'declined')),
  user_a_accepted boolean DEFAULT false,
  user_b_accepted boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  ended_by uuid REFERENCES auth.users(id),
  end_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.introductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own introductions" ON public.introductions FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Users can update own introductions" ON public.introductions FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Admins can view all introductions" ON public.introductions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert introductions" ON public.introductions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update introductions" ON public.introductions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_chats table for user-to-user messaging
CREATE TABLE public.user_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  introduction_id uuid REFERENCES public.introductions(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats" ON public.user_chats FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert chats in active intros" ON public.user_chats FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND 
  EXISTS (
    SELECT 1 FROM public.introductions 
    WHERE id = introduction_id 
    AND status = 'active' 
    AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
  )
);
CREATE POLICY "Admins can view all chats" ON public.user_chats FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.introductions;

-- Create updated_at trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_introductions_updated_at
  BEFORE UPDATE ON public.introductions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();