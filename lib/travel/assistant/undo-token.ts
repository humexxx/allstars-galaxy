import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The receipt Apply hands the browser so it can undo what it applied.
 *
 * The browser only carries it: the payload restores rows exactly as they were,
 * ids and timestamps included, so it is signed and bound to the user it was
 * issued to. A forged or edited receipt — or somebody else's — reads as null.
 *
 * Keyed off `CRON_SECRET` with its own label rather than a new secret to
 * configure; without it there is simply no undo.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const LABEL = "travel-assistant-undo";

type Envelope<T> = { v: 1; userId: string; exp: number; ops: T };

function key(): Buffer | null {
  const secret = process.env.CRON_SECRET;
  return secret ? createHmac("sha256", secret).update(LABEL).digest() : null;
}

function mac(key: Buffer, body: string): Buffer {
  return createHmac("sha256", key).update(body).digest();
}

export function signUndo<T>(userId: string, ops: T, now: number = Date.now()): string | null {
  const k = key();
  if (!k) return null;
  const envelope: Envelope<T> = { v: 1, userId, exp: now + TTL_MS, ops };
  const body = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${body}.${mac(k, body).toString("base64url")}`;
}

export function readUndo<T>(token: string, userId: string, now: number = Date.now()): T | null {
  const k = key();
  if (!k) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;

  const expected = mac(k, body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const envelope = JSON.parse(Buffer.from(body, "base64url").toString()) as Envelope<T>;
    if (envelope.v !== 1 || envelope.userId !== userId || envelope.exp < now) return null;
    return envelope.ops;
  } catch {
    return null;
  }
}
