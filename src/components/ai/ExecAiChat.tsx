import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Sparkles, Plus, MessageSquare, Loader2, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  askExecAi,
  listAiConversations,
  loadAiConversation,
  deleteAiConversation,
  type AiConversationListItem,
  type AiMessage,
} from "@/lib/exec-ai.functions";
import { buildAiContext } from "@/lib/exec-ai-context";

const SUGGESTIONS = [
  "Ruptura de estoque está em 3.5%. Quem é responsável, qual reunião absorve, e qual o plano?",
  "Crescimento internacional 5.3% vs meta 12%. Como devo escalar a decisão?",
  "Quero aprovar +20% de budget em Performance. Qual o fluxo correto e quem decide?",
  "Pipeline B2B em R$920k mas fechamento 22%. Qual ação recomendada esta semana?",
];

export function ExecAiChat() {
  const ask = useServerFn(askExecAi);
  const listConvs = useServerFn(listAiConversations);
  const loadConv = useServerFn(loadAiConversation);
  const deleteConv = useServerFn(deleteAiConversation);

  const [convs, setConvs] = useState<AiConversationListItem[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listConvs().then((r) => setConvs(r.items)).catch(() => {});
  }, [listConvs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const startNew = () => {
    setConvId(null);
    setMessages([]);
    setInput("");
  };

  const openConv = async (id: string) => {
    setConvId(id);
    setMessages([]);
    try {
      const r = await loadConv({ data: { conversationId: id } });
      setMessages(r.messages);
    } catch (e) {
      toast.error("Não foi possível carregar a conversa");
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const ctx = buildAiContext();
      const payload = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const r = await ask({
        data: {
          conversationId: convId,
          messages: payload,
          context: ctx,
        },
      });
      setConvId(r.conversationId);
      setMessages((cur) => [
        ...cur,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: r.reply,
          created_at: new Date().toISOString(),
        },
      ]);
      // Refresh sidebar
      listConvs().then((res) => setConvs(res.items)).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar IA";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full w-full flex bg-background">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-card/40 flex flex-col">
        <div className="p-3 border-b border-border">
          <Button onClick={startNew} className="w-full justify-start gap-2" variant="default">
            <Plus className="size-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convs.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-4 text-center">
                Sem conversas ainda
              </div>
            )}
            {convs.map((c) => (
              <div
                key={c.id}
                className={`group w-full px-2 py-2 rounded-md text-sm flex items-start gap-2 transition-colors ${
                  convId === c.id ? "bg-primary/15 text-primary" : "hover:bg-secondary text-foreground"
                }`}
              >
                <button
                  onClick={() => openConv(c.id)}
                  className="flex-1 min-w-0 text-left flex items-start gap-2"
                >
                  <MessageSquare className="size-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-2 break-words">{c.title}</span>
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm("Excluir esta conversa?")) return;
                    try {
                      await deleteConv({ data: { conversationId: c.id } });
                      if (convId === c.id) {
                        setConvId(null);
                        setMessages([]);
                      }
                      setConvs((cur) => cur.filter((x) => x.id !== c.id));
                      toast.success("Conversa excluída");
                    } catch {
                      toast.error("Não foi possível excluir");
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/15 hover:text-destructive shrink-0"
                  title="Excluir conversa"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
          Histórico salvo no Lovable Cloud · Modelo: Gemini 2.5 Pro
        </div>
      </aside>

      {/* Chat panel */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="px-5 py-3 border-b border-border flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm">IA Executiva GRAx</h1>
            <p className="text-xs text-muted-foreground">
              Sistema operacional empresarial · governança, ownership, KPIs e fluxo de decisão
            </p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-card/60 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="size-5 text-primary" />
                    <h2 className="font-semibold text-sm">Como posso ajudar a executar a GRAx hoje?</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Eu enxergo o organograma, a cadência de reuniões e os KPIs do Cockpit em tempo real.
                    Para cada tema vou identificar responsável, decisores, KPIs envolvidos, nível da decisão e plano de ação.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Pensando como executivo…
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <footer className="border-t border-border p-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte algo… (Enter envia, Shift+Enter quebra linha)"
              className="min-h-[52px] max-h-40 resize-none"
              disabled={busy}
            />
            <Button onClick={() => send()} disabled={busy || !input.trim()} size="icon" className="size-11 shrink-0">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <p className="max-w-3xl mx-auto text-[11px] text-muted-foreground mt-2">
            As respostas usam o estado atual do Cockpit, organograma e cadência de reuniões.
          </p>
        </footer>
      </main>
    </div>
  );
}

function MessageBubble({ msg }: { msg: AiMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="size-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Bot className="size-4" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-foreground"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-foreground">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="size-8 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0">
          <User className="size-4" />
        </div>
      )}
    </div>
  );
}
