import type { ReactNode } from "react";

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConversationSummary } from "@/types/conversation";

import { Sidebar } from "@/components/chat/Sidebar";

import { renderWithQueryClient } from "./test-utils";

const { navigateMock, onSelectUserMock, searchEverythingMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  onSelectUserMock: vi.fn(),
  searchEverythingMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "me",
        name: "Me",
        email: "me@example.com",
      },
    },
  }),
  signOut: vi.fn(),
  changePassword: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getMe: vi.fn().mockResolvedValue({
    username: "me",
    displayUsername: "Me",
    email: "me@example.com",
    bio: "",
    avatarKey: null,
  }),
  presignUpload: vi.fn(),
  updateMe: vi.fn(),
  searchEverything: searchEverythingMock,
}));

vi.mock("@workspace/ui/components/resizable", () => ({
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function createConversationSummary(id: string, name: string): ConversationSummary {
  return {
    id,
    name,
    preview: "preview",
    time: "10:00",
  };
}

function renderSidebar(props: Parameters<typeof Sidebar>[0]) {
  return renderWithQueryClient(<Sidebar {...props} />);
}

describe("Sidebar keyboard and search flows", () => {
  afterEach(() => {
    navigateMock.mockReset();
    onSelectUserMock.mockReset();
    searchEverythingMock.mockReset();
  });

  it("focuses and clears search with keyboard shortcuts", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderSidebar({
      conversations: [createConversationSummary("c1", "Alpha")],
      conversationDTOs: [] as never,
      currentUserId: "me",
      onSelect,
    });

    await user.keyboard("/");
    const searchInput = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(searchInput).toHaveFocus());

    await user.type(searchInput, "abc");
    expect(searchInput).toHaveValue("abc");
    await user.keyboard("{Escape}");
    expect(searchInput).toHaveValue("");
  });

  it("navigates conversation list with Arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSidebar({
      conversations: [
        createConversationSummary("c1", "Alpha"),
        createConversationSummary("c2", "Bravo"),
      ],
      conversationDTOs: [] as never,
      currentUserId: "me",
      activeId: "c1",
      onSelect,
    });

    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("selects existing DM from search results", async () => {
    searchEverythingMock.mockResolvedValue({
      users: [{ id: "u-1", username: "alice", displayUsername: "Alice", avatarKey: null }],
      groups: [],
    });
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSidebar({
      conversations: [createConversationSummary("dm-1", "Alice")],
      conversationDTOs: [
        {
          id: "dm-1",
          isGroup: false,
          members: [{ userId: "me" }, { userId: "u-1" }],
        },
      ] as never,
      currentUserId: "me",
      onSelect,
      onSelectUser: onSelectUserMock,
    });

    const searchInput = screen.getByPlaceholderText("Search");
    await user.type(searchInput, "ali");
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    await user.click(screen.getByText("@alice"));

    expect(onSelect).toHaveBeenCalledWith("dm-1");
    expect(onSelectUserMock).not.toHaveBeenCalled();
  });

  it("passes user to draft DM callback when no existing DM exists", async () => {
    searchEverythingMock.mockResolvedValue({
      users: [{ id: "u-2", username: "bob", displayUsername: "Bob", avatarKey: null }],
      groups: [],
    });
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSidebar({
      conversations: [],
      conversationDTOs: [
        {
          id: "group-1",
          isGroup: true,
          members: [{ userId: "me" }],
        },
      ] as never,
      currentUserId: "me",
      onSelect,
      onSelectUser: onSelectUserMock,
    });

    const searchInput = screen.getByPlaceholderText("Search");
    await user.type(searchInput, "bob");
    expect(await screen.findByText("@bob")).toBeInTheDocument();
    await user.click(screen.getByText("@bob"));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onSelectUserMock).toHaveBeenCalledWith({
      id: "u-2",
      username: "bob",
      displayUsername: "Bob",
      avatarKey: null,
    });
  });
});
