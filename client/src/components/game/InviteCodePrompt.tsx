import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeInviteCode } from "@/lib/inviteCode";

interface InviteCodePromptProps {
  shareCode: string;
  onJoined: () => void;
  onSkip: () => void;
}

export default function InviteCodePrompt({
  shareCode,
  onJoined,
  onSkip,
}: InviteCodePromptProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError("Введите код приглашения");
      return;
    }
    storeInviteCode(shareCode, trimmed);
    onJoined();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 mb-4">
      <p className="text-sm font-medium">Участвовать в игре</p>
      <p className="text-xs text-muted-foreground">
        Введите 4-значный код приглашения, чтобы бросать дротики.
        Без кода — только просмотр.
      </p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          placeholder="1234"
          maxLength={4}
          inputMode="numeric"
          className="w-24 text-center text-lg font-mono min-h-[44px]"
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
        <Button onClick={handleJoin} className="min-h-[44px]">
          Войти
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="min-h-[44px] text-muted-foreground"
        >
          Смотреть
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
