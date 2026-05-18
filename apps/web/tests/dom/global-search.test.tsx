import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationSummary } from "@/types/conversation";

import { SearchResults } from "@/components/chat/GlobalSearch";

import { renderWithQueryClient } from "./test-utils";

const { searchEverythingMock } = vi.hoisted(() => ({
  searchEverythingMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  searchEverything: searchEverythingMock,
}));

describe("SearchResults", () => {
  afterEach(() => {
    searchEverythingMock.mockReset();
  });

  it("debounces global API search and renders sectioned results", async () => {
    searchEverythingMock.mockResolvedValue({
      users: [{ id: "u-1", username: "alice", displayUsername: "Alice" }],
      groups: [],
    });

    const conversations: ConversationSummary[] = [
      { id: "c-1", name: "Alice DM", preview: "hey", time: "10:00" },
      { id: "c-2", name: "General", preview: "welcome", time: "10:01" },
    ];

    const { rerender } = renderWithQueryClient(
      <SearchResults query="" conversations={conversations} />,
    );

    expect(screen.getByText("Chats")).toBeInTheDocument();
    expect(screen.getByText("Global search")).toBeInTheDocument();
    expect(searchEverythingMock).not.toHaveBeenCalled();

    rerender(<SearchResults query="ali" conversations={conversations} />);

    expect(screen.getByText("Alice DM")).toBeInTheDocument();
    expect(searchEverythingMock).not.toHaveBeenCalled();

    await waitFor(() => expect(searchEverythingMock).toHaveBeenCalledWith("ali"));
    expect(await screen.findByText("@alice")).toBeInTheDocument();
  });
});
