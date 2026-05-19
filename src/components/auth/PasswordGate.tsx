import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ACCESS_KEY = "grax.access.v1";
const ACCESS_PASSWORD = "admin";

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(ACCESS_KEY) === "1") setUnlocked(true);
    setReady(true);
  }, []);

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      localStorage.setItem(ACCESS_KEY, "1");
      setUnlocked(true);
    } else {
      setError("Senha incorreta");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-lg"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="size-12 rounded-full soma-brand-gradient flex items-center justify-center text-primary-foreground shadow-md">
            <Lock className="size-5" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold">GRAx Group</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Acesso restrito · informe a senha para continuar
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </div>
      </form>
    </div>
  );
}
