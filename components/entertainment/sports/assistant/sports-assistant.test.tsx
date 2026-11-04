// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { SportsAssistantEvent } from "@/types/sports-assistant";

import { SportsAssistant } from "./sports-assistant";

const HUB = "/portal/entertainment/sports";

/** A fetch whose every call streams the next scripted list of events. */
function stream(...replies: SportsAssistantEvent[][]) {
  const fetchMock = vi.fn(async () => {
    const events = replies.shift() ?? [];
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const e of events) controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof stream>, call: number) =>
  JSON.parse((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].body as string);

async function say(text: string): Promise<void> {
  fireEvent.change(screen.getByLabelText("Message the sports assistant"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", `${HUB}?sport=football`);
  Element.prototype.scrollIntoView = vi.fn();
  render(<SportsAssistant />);
  fireEvent.click(screen.getByRole("button", { name: "Open the sports assistant" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SportsAssistant", () => {
  it("fills the box with a suggestion", () => {
    expect(screen.getByRole("dialog", { name: /Sports assistant/ })).toHaveAttribute(
      "data-slot",
      "sports-assistant-window"
    );
    fireEvent.click(screen.getByRole("button", { name: "Add the NBA to my favourites" }));
    expect(screen.getByLabelText("Message the sports assistant")).toHaveValue("Add the NBA to my favourites");
  });

  it("sends the message with the page open, streams the answer and keeps the turn", async () => {
    const fetchMock = stream(
      [
        { type: "status", label: "Reading Football" },
        { type: "text", text: "El Real Madrid juega " },
        { type: "text", text: "el sábado." },
        { type: "turn", messages: [{ role: "assistant", content: "…" }] },
      ],
      [{ type: "text", text: "De nada" }]
    );

    await say("¿Cuándo juega el Real Madrid?");

    expect(fetchMock).toHaveBeenCalledWith("/api/sports/assistant", expect.objectContaining({ method: "POST" }));
    expect(bodyOf(fetchMock, 0)).toEqual({
      messages: [{ role: "user", content: [{ type: "text", text: "¿Cuándo juega el Real Madrid?" }] }],
      context: { path: `${HUB}?sport=football` },
    });
    expect(await screen.findByText("El Real Madrid juega el sábado.")).toBeInTheDocument();

    await say("Gracias");
    const second = bodyOf(fetchMock, 1);
    expect(second.messages[1]).toEqual({ role: "assistant", content: "…" });
    // Still on the same page: no need to say so again.
    expect(second.context).toBeUndefined();
  });

  it("follows the assistant to the page it opens", async () => {
    stream([
      { type: "navigate", href: `${HUB}?sport=football&league=uefa-champions-league&tab=knockout` },
      { type: "text", text: "Listo" },
    ]);
    await say("Abrí el cuadro de la Champions");
    expect(router.push).toHaveBeenCalledWith(`${HUB}?sport=football&league=uefa-champions-league&tab=knockout`);
  });

  it("re-renders the page when a favourite changed", async () => {
    stream([{ type: "refresh" }, { type: "text", text: "Agregué la NBA" }]);
    await say("Agregá la NBA a mis favoritos");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tells the model the new page after the user moved", async () => {
    const fetchMock = stream([{ type: "text", text: "Hola" }], [{ type: "text", text: "Hola" }]);
    await say("Hola");
    window.history.replaceState(null, "", `${HUB}?sport=nba`);
    await say("¿Y acá?");
    expect(bodyOf(fetchMock, 1).context).toEqual({ path: `${HUB}?sport=nba` });
  });

  it("shows the server's error instead of an answer", async () => {
    stream([{ type: "error", message: "The Claude API key was rejected." }]);
    await say("Hola");
    expect(await screen.findByText("The Claude API key was rejected.")).toBeInTheDocument();
  });

  it("starts over on New chat", async () => {
    const fetchMock = stream([{ type: "text", text: "Hola" }], [{ type: "text", text: "Hola" }]);
    await say("Hola");
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.queryByText("Hola")).toBeNull();
    await say("Otra vez");
    expect(bodyOf(fetchMock, 1).messages).toHaveLength(1);
    expect(bodyOf(fetchMock, 1).context).toEqual({ path: `${HUB}?sport=football` });
  });
});
