/**
 * TerminalChat send path — the client half of the chat signature handshake.
 *
 * useSignMessage is mocked at the wagmi seam but backed by a REAL viem
 * account, so the assertion is cryptographic: the body TerminalChat POSTs
 * must pass the exact verifyMessage check the server runs. Covers the
 * declined-signature path too (no request, text preserved, no cooldown).
 */
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { buildChatSignMessage } from "@/lib/chatAuth";

const account = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000042"
);

const mockSignMessageAsync = vi.fn();
vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
}));

import { TerminalChat } from "@/components/TerminalChat";

const fetchMock = vi.fn();

function renderChat() {
  return render(
    createElement(TerminalChat, {
      statusMessages: [],
      walletAddress: account.address,
    })
  );
}

function type(container: HTMLElement, text: string) {
  const input = container.querySelector(".terminal-chat__input") as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  return input;
}

beforeEach(() => {
  cleanup();
  fetchMock.mockReset();
  mockSignMessageAsync.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("TerminalChat handleSend", () => {
  it("signs the canonical chat message and POSTs a body the server verification accepts", async () => {
    mockSignMessageAsync.mockImplementation(({ message }: { message: string }) =>
      account.signMessage({ message })
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, message: { id: "srv-1" } }), { status: 200 })
    );

    const { container } = renderChat();
    const input = type(container, "gm from the test");
    fireEvent.click(container.querySelector(".terminal-chat__send") as HTMLButtonElement);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat/send");
    const body = JSON.parse(String(init.body));
    expect(body.wallet).toBe(account.address);
    expect(body.message).toBe("gm from the test");
    expect(typeof body.timestamp).toBe("number");

    // The exact check the route runs — real crypto, no shortcuts.
    await expect(
      verifyMessage({
        address: body.wallet,
        message: buildChatSignMessage(body.wallet, body.message, body.timestamp),
        signature: body.signature,
      })
    ).resolves.toBe(true);

    // Input cleared after a successful handoff
    expect(input.value).toBe("");
  });

  it("keeps the text and sends nothing when the wallet declines the signature", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("User rejected the request."));

    const { container } = renderChat();
    const input = type(container, "precious draft");
    fireEvent.click(container.querySelector(".terminal-chat__send") as HTMLButtonElement);

    await waitFor(() => expect(mockSignMessageAsync).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(input.value).toBe("precious draft");

    // No cooldown after a decline — the send button is usable again.
    // (The label is an AeroIcons glyph now, so assert the accessible name
    // rather than text content.)
    await waitFor(() => {
      const send = container.querySelector(".terminal-chat__send") as HTMLButtonElement;
      expect(send.getAttribute("aria-label")).toBe("Send message");
      expect(send.disabled).toBe(false);
    });
  });

  it("does not attempt to sign without a wallet", () => {
    const { container } = render(
      createElement(TerminalChat, { statusMessages: [] })
    );
    const input = container.querySelector(".terminal-chat__input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe("connect wallet to chat");
    expect(mockSignMessageAsync).not.toHaveBeenCalled();
  });
});
