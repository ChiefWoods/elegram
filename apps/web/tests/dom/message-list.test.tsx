import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Message } from "@/types/message";

import { MessageList } from "@/components/chat/MessageList";
import { toMessageList } from "@/lib/chat";

import { renderWithQueryClient } from "./test-utils";

const { editMessageMock, deleteMessageMock, toastErrorMock } = vi.hoisted(() => ({
  editMessageMock: vi.fn(),
  deleteMessageMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  editMessage: editMessageMock,
  deleteMessage: deleteMessageMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorMock,
  },
}));

describe("MessageList", () => {
  afterEach(() => {
    editMessageMock.mockReset();
    deleteMessageMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("renders grouped rows with edited label and deleted tombstone", () => {
    const items: Message[] = [
      {
        id: "1",
        authorName: "Alice",
        body: "First message",
        time: "10:00",
        date: "2026-05-18",
        showAuthor: true,
        showAvatar: true,
        isLastInRun: false,
      },
      {
        id: "2",
        authorName: "Alice",
        body: "Second message",
        time: "10:01",
        date: "2026-05-18",
        edited: true,
        showAuthor: false,
        showAvatar: false,
        isLastInRun: true,
      },
      {
        id: "3",
        authorName: "Me",
        body: "deleted",
        time: "10:02",
        date: "2026-05-18",
        deleted: true,
        isLastInRun: true,
      },
    ];

    renderWithQueryClient(
      <MessageList conversationId="conv-1" currentUserName="Me" items={items} hasMore={false} />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Second message")).toBeInTheDocument();
    expect(screen.getByText("10:01 · edited")).toBeInTheDocument();
    expect(screen.getByText("Message deleted")).toBeInTheDocument();
  });

  it("hides edit/delete actions once message falls outside mutation window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:16:00.000Z"));
    const items = toMessageList(
      [
        {
          id: "old-1",
          senderId: "me",
          body: "stale message",
          createdAt: "2026-05-18T10:00:00.000Z",
          editedAt: null,
          deletedAt: null,
          attachmentKey: null,
          attachment: null,
        },
      ] as never,
      "me",
      undefined,
      false,
    );

    renderWithQueryClient(
      <MessageList conversationId="conv-1" currentUserName="You" items={items} hasMore={false} />,
    );

    fireEvent.contextMenu(screen.getByText("stale message"));
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows inline edit and surfaces error on failed save", async () => {
    editMessageMock.mockRejectedValue(new Error("edit failed"));
    const user = userEvent.setup();
    const items: Message[] = [
      {
        id: "mine-1",
        authorName: "Me",
        body: "hello world",
        time: "10:00",
        date: "2026-05-18",
        mutable: true,
        isLastInRun: true,
      },
    ];

    renderWithQueryClient(
      <MessageList conversationId="conv-1" currentUserName="Me" items={items} hasMore={false} />,
    );

    fireEvent.contextMenu(screen.getByText("hello world"));
    await user.click(screen.getByText("Edit"));
    const editor = screen.getByDisplayValue("hello world");
    await user.clear(editor);
    await user.type(editor, "  updated copy  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(editMessageMock).toHaveBeenCalledWith("conv-1", "mine-1", { body: "updated copy" }),
    );
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to edit message."));
  });

  it("keeps message visible and shows error on failed delete", async () => {
    deleteMessageMock.mockRejectedValue(new Error("delete failed"));
    const user = userEvent.setup();
    const items: Message[] = [
      {
        id: "mine-2",
        authorName: "Me",
        body: "cannot delete",
        time: "10:00",
        date: "2026-05-18",
        mutable: true,
        isLastInRun: true,
      },
    ];

    renderWithQueryClient(
      <MessageList conversationId="conv-1" currentUserName="Me" items={items} hasMore={false} />,
    );

    fireEvent.contextMenu(screen.getByText("cannot delete"));
    await user.click(screen.getByText("Delete"));

    await waitFor(() => expect(deleteMessageMock).toHaveBeenCalledWith("conv-1", "mine-2"));
    expect(screen.getByText("cannot delete")).toBeInTheDocument();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete message."));
  });
});
