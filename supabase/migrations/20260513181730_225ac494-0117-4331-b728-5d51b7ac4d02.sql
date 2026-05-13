CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at);
CREATE INDEX idx_ai_conversations_updated ON public.ai_conversations(updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read conversations" ON public.ai_conversations FOR SELECT USING (true);
CREATE POLICY "anon insert conversations" ON public.ai_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update conversations" ON public.ai_conversations FOR UPDATE USING (true);

CREATE POLICY "anon read messages" ON public.ai_messages FOR SELECT USING (true);
CREATE POLICY "anon insert messages" ON public.ai_messages FOR INSERT WITH CHECK (true);