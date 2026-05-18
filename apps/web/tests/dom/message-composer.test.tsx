import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageComposer } from "@/components/chat/MessageComposer";

import { renderWithQueryClient } from "./test-utils";

const { sendMessageMock, sendDirectMessageMock, presignUploadMock, toastErrorMock } = vi.hoisted(
  () => ({
    sendMessageMock: vi.fn(),
    sendDirectMessageMock: vi.fn(),
    presignUploadMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }),
);

vi.mock("@/lib/api", () => ({
  sendMessage: sendMessageMock,
  sendDirectMessage: sendDirectMessageMock,
  presignUpload: presignUploadMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorMock,
  },
}));

describe("MessageComposer", () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
    sendDirectMessageMock.mockReset();
    presignUploadMock.mockReset();
    toastErrorMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("crypto", { randomUUID: () => "temp-id" });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("sends on Enter and trims whitespace", async () => {
    sendMessageMock.mockResolvedValue({ id: "m-1" });
    const user = userEvent.setup();
    renderWithQueryClient(<MessageComposer conversationId="conv-1" />);

    const input = screen.getByPlaceholderText("Message");
    await user.type(input, "  hello world  ");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(sendMessageMock).toHaveBeenCalledWith("conv-1", { body: "hello world" }),
    );
    expect(input).toHaveValue("");
  });

  it("does not send on Shift+Enter", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MessageComposer conversationId="conv-1" />);

    const input = screen.getByPlaceholderText("Message");
    await user.type(input, "line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(input).toHaveValue("line one\n");
  });

  it("clears input immediately while send request is in-flight", async () => {
    let resolveSend: (() => void) | undefined;
    sendMessageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = () => resolve({ id: "m-pending" });
        }),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<MessageComposer conversationId="conv-1" />);

    const input = screen.getByPlaceholderText("Message");
    await user.type(input, "pending send");
    await user.keyboard("{Enter}");

    expect(input).toHaveValue("");
    expect(sendMessageMock).toHaveBeenCalledWith("conv-1", { body: "pending send" });

    resolveSend?.();
    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1));
  });

  it("uploads image attachment and sends message after confirmation", async () => {
    presignUploadMock.mockResolvedValue({
      key: "asset-1",
      url: "https://upload.example/asset-1",
      headers: { "content-type": "image/png" },
    });
    sendMessageMock.mockResolvedValue({ id: "m-attach" });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();

    const { container } = renderWithQueryClient(<MessageComposer conversationId="conv-1" />);
    const input = container.querySelector('input[type="file"][accept*="image/jpeg"]');
    const file = new File(["png"], "photo.png", { type: "image/png" });
    if (!input) throw new Error("Media input not found");
    await user.upload(input as HTMLInputElement, file);

    expect(await screen.findByText("Send Attachment")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(presignUploadMock).toHaveBeenCalledWith({
        mime: "image/png",
        size: 3,
        name: "photo.png",
      }),
    );
    await waitFor(() =>
      expect(sendMessageMock).toHaveBeenCalledWith("conv-1", { attachmentKey: "asset-1" }),
    );
  });

  it("surfaces attachment upload errors (including rate-limit responses)", async () => {
    presignUploadMock.mockRejectedValue(new Error("Retry after 5 seconds"));
    const user = userEvent.setup();
    const { container } = renderWithQueryClient(<MessageComposer conversationId="conv-1" />);
    const input = container.querySelector('input[type="file"][accept*="image/jpeg"]');
    const file = new File(["png"], "rate-limited.png", { type: "image/png" });
    if (!input) throw new Error("Media input not found");
    await user.upload(input as HTMLInputElement, file);

    expect(await screen.findByText("Send Attachment")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Retry after 5 seconds"));
  });
});
