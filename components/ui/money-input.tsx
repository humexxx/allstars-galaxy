"use client";

import type * as React from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

/**
 * The symbol a currency is written with, from the currency itself.
 *
 * Derived through Intl rather than kept as a lookup table: a hand-written map
 * is wrong for most of the world's currencies and silently so.
 */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * An amount field that looks like money.
 *
 * The symbol sits inside the field rather than in the label, so a row of
 * amounts reads as a column of money instead of a column of bare numbers —
 * which is what made these look wrong beside the dates and codes around them.
 *
 * Deliberately a text input and not a slider: a price range is often open at
 * the top ("from $600"), a slider needs bounds nobody has, and it cannot
 * express "exactly 1900" without fighting the user's aim.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (value: string) => void;
  currency: string;
}): React.JSX.Element {
  const symbol = currencySymbol(currency);

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <InputGroupText>{symbol}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        {...props}
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          // Keep digits and a single dot. Typing a comma or a stray symbol is
          // a slip, not an instruction, and rejecting the whole keystroke
          // makes the field feel broken.
          // Everything after the first dot is the fraction, capped at two
          // digits. The old regex dropped only one extra dot per pass and
          // concatenated the rest ("1.2.3" → 1.23, a 10× slip on paste).
          const raw = e.target.value.replace(/[^\d.]/g, "");
          const [head, ...rest] = raw.split(".");
          const cleaned = rest.length > 0 ? `${head}.${rest.join("").slice(0, 2)}` : head;
          onChange(cleaned);
        }}
        // Figures aligned so a column of prices compares at a glance.
        className="text-right tabular-nums"
      />
    </InputGroup>
  );
}
