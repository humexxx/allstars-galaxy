"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateAiSettingsAction } from "@/app/actions/ai-settings";
import { SettingRow } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { DateField } from "@/components/ui/date-field";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { daysUntil } from "@/lib/ai/key-expiry";
import { AI_MODELS, aiModel, MONTHLY_AI_CREDIT_USD } from "@/lib/ai/models";
import { formatDay, formatMonthLong } from "@/lib/utils/date";
import type { AiSettings, AiUsageSummary } from "@/types/ai";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** The first day of the month after `today`'s, as YYYY-MM-DD. */
function nextMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/**
 * The app's AI, for admins: which model answers, what it has spent against
 * the plan's monthly credit, and when the API key runs out.
 *
 * Spend is the app's own count — each answer's tokens at list prices — since
 * an individual Console account cannot read its balance through the API.
 */
export function AiSettingsPane({
  settings,
  usage,
  keyConfigured,
  today,
}: {
  settings: AiSettings;
  usage: AiUsageSummary;
  keyConfigured: boolean;
  /** The reader's day, YYYY-MM-DD. */
  today: string;
}) {
  const [model, setModel] = useState(settings.model);
  const [expiresOn, setExpiresOn] = useState(settings.apiKeyExpiresOn ?? "");
  const [saving, setSaving] = useState<"model" | "expiry" | null>(null);

  async function save(
    field: "model" | "expiry",
    patch: { model?: string; apiKeyExpiresOn?: string | null },
    undo: () => void
  ): Promise<void> {
    setSaving(field);
    const result = await updateAiSettingsAction(patch).catch(() => ({
      success: false as const,
      error: "Failed to save the setting",
    }));
    setSaving(null);
    if (!result.success) {
      undo();
      toast.error(result.error);
    }
  }

  const [month, ...earlier] = usage.months;
  const spent = month.costUsd;
  const daysLeft = expiresOn ? daysUntil(today, expiresOn) : null;

  return (
    <>
      <SettingRow
        label="Model"
        description={aiModel(model).blurb}
        control={
          <div className="flex items-center gap-2">
            {saving === "model" && <Spinner className="size-3.5 text-muted-foreground" />}
            <Select
              value={model}
              onValueChange={(next) => {
                const previous = model;
                setModel(next);
                void save("model", { model: next }, () => setModel(previous));
              }}
            >
              <SelectTrigger aria-label="Model the travel assistant uses" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <SettingRow
        label={formatMonthLong(`${month.month}-01`)}
        description="Estimated from each answer's tokens at list prices, by calendar month. Your exact balance is in Claude Console."
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <Mono className="text-xl font-semibold sm:text-2xl">{USD.format(spent)}</Mono>
            <Text variant="small" className="tabular-nums">
              of {USD.format(MONTHLY_AI_CREDIT_USD)} · {USD.format(Math.max(0, MONTHLY_AI_CREDIT_USD - spent))} left
            </Text>
          </div>
          <Progress
            value={Math.min(100, (spent / MONTHLY_AI_CREDIT_USD) * 100)}
            aria-label="Share of the monthly credit spent"
          />
          <Text variant="small" className="tabular-nums">
            Today {USD.format(usage.today.costUsd)} · {month.requests} calls this month · renews{" "}
            {formatDay(nextMonth(today))}
          </Text>
        </div>
      </SettingRow>

      {earlier.length > 0 && (
        <SettingRow label="Earlier months">
          <ul className="flex flex-col gap-1">
            {earlier.map((m) => (
              <li key={m.month} className="flex justify-between gap-3 text-sm">
                <span>{formatMonthLong(`${m.month}-01`)}</span>
                <Mono className="text-muted-foreground">
                  {USD.format(m.costUsd)} · {m.requests} calls
                </Mono>
              </li>
            ))}
          </ul>
        </SettingRow>
      )}

      <SettingRow
        label="API key"
        description={
          keyConfigured
            ? "ANTHROPIC_API_KEY is set on this server."
            : "ANTHROPIC_API_KEY is not set on this server, so the assistant is off."
        }
        control={
          keyConfigured ? <Badge variant="success">Set</Badge> : <Badge variant="warning">Missing</Badge>
        }
      />

      <SettingRow
        label="Key expires"
        description="The date Claude Console showed when you created the key. Admins are reminded 30, 20 and 10 days before, then every day."
        control={
          <div className="flex items-center gap-2">
            {saving === "expiry" && <Spinner className="size-3.5 text-muted-foreground" />}
            <DateField
              aria-label="API key expiry date"
              value={expiresOn}
              clearable
              placeholder="Never"
              onChange={(day) => {
                const previous = expiresOn;
                setExpiresOn(day);
                void save("expiry", { apiKeyExpiresOn: day || null }, () => setExpiresOn(previous));
              }}
              className="w-44"
            />
          </div>
        }
      >
        {daysLeft !== null && (
          <Badge variant={daysLeft < 0 ? "destructive" : daysLeft <= 30 ? "warning" : "secondary"}>
            {daysLeft < 0
              ? `Expired ${-daysLeft} day${daysLeft === -1 ? "" : "s"} ago`
              : daysLeft === 0
                ? "Expires today"
                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
          </Badge>
        )}
      </SettingRow>
    </>
  );
}
