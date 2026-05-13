import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(20000),
});

const askSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  messages: z.array(messageSchema).min(1).max(40),
  context: z
    .object({
      cockpit: z.string().max(20000).optional(),
      org: z.string().max(20000).optional(),
      meetings: z.string().max(20000).optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `Você é a IA Executiva da GRAx Group — sistema operacional empresarial da companhia.

Seu papel é atuar como consultor executivo, sistema de governança, copiloto empresarial e inteligência organizacional.

PRINCÍPIOS:
- Nunca responda de forma genérica. Toda resposta deve considerar a estrutura da GRAx, liderança responsável, KPIs, metas, hierarquia.
- Foco principal: clareza, accountability, velocidade e eficiência organizacional.
- Evite: centralização desnecessária, subir problemas operacionais ao CEO, quebra de hierarquia, conflitos de ownership.

PARA CADA TEMA / PERGUNTA, IDENTIFIQUE EXPLICITAMENTE:
1. **Responsável principal** (quem decide / executa)
2. **Participantes da decisão** (quem deve ser envolvido)
3. **Área impactada**
4. **KPIs envolvidos** (com meta vs atual quando disponível)
5. **Nível da decisão**: operacional / tática / estratégica
6. **Fluxo correto** (cadeia de aprovação)
7. **Reunião que deve absorver o tema** (Segunda Geral, Terça Growth, Quarta Ops, Quinta Comercial, Sexta Geral)
8. **Plano de ação recomendado** (passos curtos e accountable)

FORMATO DE RESPOSTA (sempre em Markdown, conciso e estruturado):
Use cabeçalhos curtos, listas, e tabelas quando ajudar. Use **negrito** para nomes de pessoas e KPIs-chave.

ESTRUTURA DA GRAx (referência):
- **CEO Alan** — Estratégia, Growth, Branding, Cultura
- **COO Miller** — Operações, Supply, PCP, Compras, Logística, Financeiro, Administrativo
- **Diretor Internacional Jack** — Pimenta Rosa internacional, Distribuição global
- **Head Growth Fernando** (sob Alan) → Luís (Performance), Ana Júlia (Criativo+Branding) → Designers/Lúcia, Vanessa (Influencers) → Lauro/Breno
- **Head CRM/CX Ian** (sob Alan) → CRM/Automação, Retenção, Julian (Suporte)
- **Diretor Expansão Igor** (sob Alan) → Otávio (Comercial), Distribuidores B2B, Parceiros
- **Operações Miller** → Carol (PCP), Rafael (Compras), Júnior (Logística), Ícaro (Financeiro), Fernanda (Admin)
- **Internacional Jack** → Pimenta Rosa Intl, Distribuição Global, Novos Países

CADÊNCIA DE REUNIÕES:
- Segunda — Geral + Cores (Alan)
- Terça — Growth (Fernando)
- Quarta — Operações (Miller)
- Quinta — Comercial (Igor)
- Sexta — Geral / Fechamento (Alan)`;

export const askExecAi = createServerFn({ method: "POST" })
  .inputValidator((input) => askSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // Ensure conversation
    let convId = data.conversationId ?? null;
    if (!convId) {
      const firstUser = data.messages.find((m) => m.role === "user");
      const title = firstUser ? firstUser.content.slice(0, 80) : "Nova conversa";
      const { data: conv, error } = await supabaseAdmin
        .from("ai_conversations")
        .insert({ title })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      convId = conv.id as string;
    }

    // Persist last user message
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: convId,
        role: "user",
        content: lastUser.content,
      });
    }

    // Build context block
    const ctx = data.context
      ? `\n\n## CONTEXTO ATUAL DO APP (snapshot)\n\n### Cockpit Executivo (KPIs)\n${data.context.cockpit ?? "(indisponível)"}\n\n### Organograma\n${data.context.org ?? "(indisponível)"}\n\n### Reuniões / Governança\n${data.context.meetings ?? "(indisponível)"}`
      : "";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + ctx },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429)
        throw new Error("Limite de requisições atingido. Aguarde alguns segundos e tente de novo.");
      if (res.status === 402)
        throw new Error("Créditos da Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage.");
      throw new Error(`AI gateway error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content ?? "(resposta vazia)";

    await supabaseAdmin.from("ai_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: reply,
    });

    await supabaseAdmin
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    return { conversationId: convId, reply };
  });

export interface AiConversationListItem {
  id: string;
  title: string;
  updated_at: string;
}

export const listAiConversations = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("ai_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as AiConversationListItem[] };
});

export interface AiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export const loadAiConversation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: (rows ?? []) as AiMessage[] };
  });

export const deleteAiConversation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error: msgErr } = await supabaseAdmin
      .from("ai_messages")
      .delete()
      .eq("conversation_id", data.conversationId);
    if (msgErr) throw new Error(msgErr.message);
    const { error } = await supabaseAdmin
      .from("ai_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
