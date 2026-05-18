import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GroupMember } from "@/types/group";

import { GroupInfoPanel } from "@/components/chat/GroupInfoPanel";

import { renderWithQueryClient } from "./test-utils";

const {
  navigateMock,
  removeMemberMock,
  updateMemberRoleMock,
  leaveConversationMock,
  deleteConversationMock,
  transferOwnershipMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  removeMemberMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  leaveConversationMock: vi.fn(),
  deleteConversationMock: vi.fn(),
  transferOwnershipMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/api", () => ({
  removeMember: removeMemberMock,
  updateMemberRole: updateMemberRoleMock,
  leaveConversation: leaveConversationMock,
  deleteConversation: deleteConversationMock,
  transferOwnership: transferOwnershipMock,
}));

function renderPanel(members: GroupMember[], currentUserId: string, onClose = vi.fn()) {
  return renderWithQueryClient(
    <GroupInfoPanel
      onClose={onClose}
      conversationId="group-1"
      title="Project Group"
      description="Team room"
      members={members}
      currentUserId={currentUserId}
      conversationDTOs={[]}
    />,
  );
}

describe("GroupInfoPanel", () => {
  afterEach(() => {
    navigateMock.mockReset();
    removeMemberMock.mockReset();
    updateMemberRoleMock.mockReset();
    leaveConversationMock.mockReset();
    deleteConversationMock.mockReset();
    transferOwnershipMock.mockReset();
  });

  it("shows owner-only controls for owners", () => {
    const members: GroupMember[] = [
      {
        id: "owner",
        name: "Owner User",
        username: "owner",
        avatarKey: null,
        status: "online",
        role: "OWNER",
      },
      {
        id: "member-1",
        name: "Member User",
        username: "member",
        avatarKey: null,
        status: "offline",
        role: "MEMBER",
      },
    ];
    renderPanel(members, "owner");

    expect(screen.getByLabelText("Edit group")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete group" })).toBeInTheDocument();
    expect(screen.getByLabelText("Actions for Member User")).toBeInTheDocument();
  });

  it("hides admin controls for regular members", () => {
    const members: GroupMember[] = [
      {
        id: "owner",
        name: "Owner User",
        username: "owner",
        avatarKey: null,
        status: "online",
        role: "OWNER",
      },
      {
        id: "member-1",
        name: "Member User",
        username: "member",
        avatarKey: null,
        status: "offline",
        role: "MEMBER",
      },
    ];
    renderPanel(members, "member-1");

    expect(screen.queryByLabelText("Edit group")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete group" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave group" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Actions for Owner User")).not.toBeInTheDocument();
  });

  it("shows admin action menu without owner transfer controls", async () => {
    const user = userEvent.setup();
    const members: GroupMember[] = [
      {
        id: "owner",
        name: "Owner User",
        username: "owner",
        avatarKey: null,
        status: "online",
        role: "OWNER",
      },
      {
        id: "admin",
        name: "Admin User",
        username: "admin",
        avatarKey: null,
        status: "online",
        role: "ADMIN",
      },
      {
        id: "member-1",
        name: "Member User",
        username: "member",
        avatarKey: null,
        status: "offline",
        role: "MEMBER",
      },
    ];
    renderPanel(members, "admin");

    await user.click(screen.getByLabelText("Actions for Member User"));
    expect(screen.getByText("Promote to admin")).toBeInTheDocument();
    expect(screen.getByText("Remove from group")).toBeInTheDocument();
    expect(screen.queryByText("Transfer ownership")).not.toBeInTheDocument();
  });

  it("handles leave-group dialog cancel and confirm flows", async () => {
    leaveConversationMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const members: GroupMember[] = [
      {
        id: "owner",
        name: "Owner User",
        username: "owner",
        avatarKey: null,
        status: "online",
        role: "OWNER",
      },
      {
        id: "member-1",
        name: "Member User",
        username: "member",
        avatarKey: null,
        status: "offline",
        role: "MEMBER",
      },
    ];

    renderPanel(members, "member-1");

    await user.click(screen.getByRole("button", { name: "Leave group" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Leave group" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Leave group" }));
    const confirmDialog = await screen.findByRole("dialog");
    await user.click(within(confirmDialog).getByRole("button", { name: "Leave group" }));
    await waitFor(() => expect(leaveConversationMock).toHaveBeenCalledWith("group-1"));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/chat" }));
  });

  it("requires title confirmation before deleting group", async () => {
    deleteConversationMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onClose = vi.fn();
    const members: GroupMember[] = [
      {
        id: "owner",
        name: "Owner User",
        username: "owner",
        avatarKey: null,
        status: "online",
        role: "OWNER",
      },
      {
        id: "member-1",
        name: "Member User",
        username: "member",
        avatarKey: null,
        status: "offline",
        role: "MEMBER",
      },
    ];

    renderPanel(members, "owner", onClose);
    await user.click(screen.getByRole("button", { name: "Delete group" }));

    const dialog = await screen.findByRole("dialog");
    const deleteButton = within(dialog).getByRole("button", { name: "Delete group" });
    expect(deleteButton).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Project Group");
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    await waitFor(() => expect(deleteConversationMock).toHaveBeenCalledWith("group-1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("supports transfer ownership from owner action menu", async () => {
    transferOwnershipMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const members: GroupMember[] = [
      {
        id: "owner",
        name: "Owner User",
        username: "owner",
        avatarKey: null,
        status: "online",
        role: "OWNER",
      },
      {
        id: "member-1",
        name: "Member User",
        username: "member",
        avatarKey: null,
        status: "offline",
        role: "MEMBER",
      },
    ];

    renderPanel(members, "owner");
    await user.click(screen.getByLabelText("Actions for Member User"));
    await user.click(screen.getByText("Transfer ownership"));
    await user.click(screen.getByRole("button", { name: "Transfer ownership" }));

    await waitFor(() => expect(transferOwnershipMock).toHaveBeenCalledWith("group-1", "member-1"));
  });
});
