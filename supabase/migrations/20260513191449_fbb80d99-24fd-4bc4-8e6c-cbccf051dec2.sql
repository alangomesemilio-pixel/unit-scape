CREATE POLICY "anon delete conversations" ON public.ai_conversations FOR DELETE TO public USING (true);
CREATE POLICY "anon delete messages" ON public.ai_messages FOR DELETE TO public USING (true);