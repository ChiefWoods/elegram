import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ResizablePanel } from "@workspace/ui/components/resizable";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  ArrowLeft,
  AtSign,
  CircleAlert,
  Plus,
  Lock,
  LogOut,
  Menu,
  Moon,
  Pencil,
  Settings as SettingsIcon,
  Sun,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AvatarRemoveButton } from "@/components/common/AvatarRemoveButton";
import { DetailRow } from "@/components/common/DetailRow";
import { HeaderIconButton } from "@/components/common/HeaderIconButton";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { PanelHeader } from "@/components/common/PanelHeader";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { useTheme } from "@/components/theme-provider";
import {
  getMe,
  presignUpload,
  updateMe,
  type ConversationSummaryDTO,
  type SearchUserDTO,
} from "@/lib/api";
import { changePassword, signOut, updateUser, useSession } from "@/lib/auth-client";
import { AVATAR_MIMES, validateAvatar, type AvatarMime } from "@/lib/avatar";
import { env } from "@/lib/env";

import type { ConversationSummary } from "./types/conversation";

import { ChangePasswordForm, type ChangePasswordValues } from "./ChangePasswordForm";
import { ConversationList } from "./ConversationList";
import { CreateGroupFlow } from "./CreateGroupFlow";
import { GlobalSearch, SearchResults } from "./GlobalSearch";
import { PasskeysSection } from "./PasskeysSection";
import { ProfileDetailsForm, type EditProfileValues } from "./ProfileDetailsForm";

type SidebarView = "chats" | "profile" | "edit-profile" | "settings" | "create-group";

function ProfileSummaryView({
  onBack,
  onEdit,
  avatarName,
  avatarImage,
  displayUsername,
  bio,
}: {
  onBack: () => void;
  onEdit: () => void;
  avatarName: string;
  avatarImage?: string | null;
  displayUsername: string;
  bio: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader>
        <HeaderIconButton onClick={onBack} aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </HeaderIconButton>
        <h1 className="text-base font-semibold">Profile</h1>
        <HeaderIconButton onClick={onEdit} aria-label="Edit profile" className="ml-auto">
          <Pencil className="size-5" />
        </HeaderIconButton>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        <section className="px-6 py-7">
          <ProfileIdentity
            name={avatarName}
            imageUrl={avatarImage}
            displayName={displayUsername}
            status="online"
          />

          <ul className="mt-7 space-y-4">
            <DetailRow icon={AtSign} value={avatarName} label="Username" />
            <DetailRow icon={CircleAlert} value={bio.length > 0 ? bio : "-"} label="Bio" />
          </ul>
        </section>
      </div>
    </div>
  );
}

function AvatarSection({
  avatarName,
  avatarImage,
  onPickFile,
  onRemoveAvatar,
  isUploading,
  isRemoving,
}: {
  avatarName: string;
  avatarImage?: string | null;
  onPickFile: (file: File) => void;
  onRemoveAvatar: () => void;
  isUploading: boolean;
  isRemoving: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const displayImage = previewUrl ?? avatarImage ?? null;
  const isBusy = isUploading || isRemoving;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePickFile = (file: File): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    onPickFile(file);
  };

  const handleRemove = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onRemoveAvatar();
  };

  return (
    <section className="flex flex-col items-center gap-3 pb-6">
      <div className="relative">
        <button
          type="button"
          aria-label="Upload avatar"
          aria-busy={isBusy}
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className="relative grid size-24 place-items-center rounded-full disabled:opacity-60"
        >
          {displayImage ? (
            <img
              src={displayImage}
              alt="Avatar preview"
              className="size-full rounded-full object-cover"
            />
          ) : (
            <span className="relative">
              <InitialsAvatar name={avatarName} imageUrl={null} size="xl" />
            </span>
          )}
          {isUploading && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
              <Spinner aria-label="Uploading avatar" />
            </span>
          )}
        </button>
        {displayImage && (
          <AvatarRemoveButton
            ariaLabel="Remove avatar"
            onClick={(event) => {
              event.stopPropagation();
              handleRemove();
            }}
            disabled={isBusy}
            isLoading={isRemoving}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_MIMES.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            handlePickFile(file);
          }}
        />
      </div>
    </section>
  );
}

function EditProfileView({
  onBack,
  displayUsername,
  email,
  bio,
  avatarName,
  avatarImage,
  onSaveProfile,
  onUploadAvatar,
  onRemoveAvatar,
  isUploadingAvatar,
  isRemovingAvatar,
}: {
  onBack: () => void;
  displayUsername: string;
  email: string;
  bio: string;
  avatarName: string;
  avatarImage?: string | null;
  onSaveProfile: (values: EditProfileValues) => Promise<void>;
  onUploadAvatar: (file: File) => void;
  onRemoveAvatar: () => void;
  isUploadingAvatar: boolean;
  isRemovingAvatar: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader>
        <HeaderIconButton onClick={onBack} aria-label="Back to profile">
          <ArrowLeft className="size-5" />
        </HeaderIconButton>
        <h1 className="text-base font-semibold">Edit Profile</h1>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AvatarSection
          avatarName={avatarName}
          avatarImage={avatarImage}
          onPickFile={onUploadAvatar}
          onRemoveAvatar={onRemoveAvatar}
          isUploading={isUploadingAvatar}
          isRemoving={isRemovingAvatar}
        />
        <ProfileDetailsForm
          key={`${displayUsername}:${bio}`}
          displayUsername={displayUsername}
          bio={bio}
          email={email}
          onSubmit={onSaveProfile}
        />
      </div>
    </div>
  );
}

function SettingsView({
  onBack,
  onChangePassword,
}: {
  onBack: () => void;
  onChangePassword: (values: ChangePasswordValues) => Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader>
        <HeaderIconButton onClick={onBack} aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </HeaderIconButton>
        <h1 className="text-base font-semibold">Settings</h1>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Privacy and Security</h2>
          </div>
          <ChangePasswordForm onSubmit={onChangePassword} />
          <PasskeysSection />
        </section>
      </div>
    </div>
  );
}

export function Sidebar({
  conversations,
  conversationDTOs,
  currentUserId,
  activeId,
  onSelect,
  onSelectUser,
}: {
  conversations: ConversationSummary[];
  conversationDTOs: ConversationSummaryDTO[];
  currentUserId: string;
  activeId?: string;
  onSelect: (id: string) => void;
  onSelectUser?: (user: SearchUserDTO) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<SidebarView>("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSearching = searchQuery.length > 0;
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await getMe();
      } catch {
        throw new Error("Failed to load your profile.");
      }
    },
  });

  const displayUsername = meQuery.data?.displayUsername ?? session?.user.name ?? "";
  const profileName = meQuery.data?.username ?? "";
  const profileEmail = meQuery.data?.email ?? session?.user.email ?? "";
  const profileBio = meQuery.data?.bio ?? "";
  const profileImage = meQuery.data
    ? meQuery.data.avatarKey
      ? new URL(`/api/uploads/${meQuery.data.avatarKey}`, env.VITE_SERVER_URL).toString()
      : null
    : (session?.user.image ?? null);
  const groupFlowContacts = useMemo(() => {
    const unique = new Map<
      string,
      {
        id: string;
        displayUsername: string;
        username: string;
        avatarKey: string | null;
      }
    >();
    for (const conversation of conversationDTOs) {
      if (conversation.isGroup) continue;
      const peer = conversation.members.find((member) => member.userId !== currentUserId)?.user;
      if (!peer || unique.has(peer.id)) continue;
      unique.set(peer.id, {
        id: peer.id,
        displayUsername: peer.displayUsername ?? peer.username ?? "Unknown",
        username: peer.username ?? "",
        avatarKey: peer.avatarKey,
      });
    }
    return [...unique.values()];
  }, [conversationDTOs, currentUserId]);
  const saveMutation = useMutation({
    mutationFn: async (values: EditProfileValues) => {
      const trimmedDisplayUsername = values.displayUsername.trim();
      const trimmedBio = values.bio.trim();

      if (!trimmedDisplayUsername) {
        throw new Error("Display name is required.");
      }

      const updated = await updateMe({
        displayUsername: trimmedDisplayUsername,
        bio: trimmedBio,
      });

      const { error } = await updateUser({ name: trimmedDisplayUsername });
      if (error) {
        throw new Error("Failed to sync auth profile after save.");
      }

      return updated;
    },
    onSuccess: async () => {
      toast.success("Profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    },
  });
  const changePasswordMutation = useMutation({
    mutationFn: async (values: ChangePasswordValues) => {
      const currentPassword = values.currentPassword.trim();
      const newPassword = values.newPassword.trim();
      const confirmPassword = values.confirmPassword.trim();

      if (!currentPassword) {
        throw new Error("Current password is required.");
      }
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }

      const { error } = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      toast.success("Password changed.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      validateAvatar(file);

      let key: string;
      let url: string;
      let headers: Record<string, string>;
      try {
        const result = await presignUpload({
          mime: file.type as AvatarMime,
          size: file.size,
          name: file.name,
        });

        key = result.key;
        url = result.url;
        headers = result.headers;
      } catch {
        throw new Error("Failed to prepare upload.");
      }

      const putRes = await fetch(url, {
        method: "PUT",
        headers,
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Failed to upload image.");
      }

      try {
        await updateMe({ avatarKey: key });
      } catch {
        throw new Error("Failed to update profile avatar.");
      }

      const imageUrl = new URL(`/api/uploads/${key}`, env.VITE_SERVER_URL).toString();
      await updateUser({ image: imageUrl });
    },
    onSuccess: async () => {
      toast.success("Avatar updated.");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar.");
    },
  });
  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      await updateMe({ avatarKey: null });
    },
    onSuccess: async () => {
      toast.success("Avatar removed.");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove avatar.");
    },
  });

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <ResizablePanel
      defaultSize={320}
      className="relative flex w-80 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      {view === "chats" ? (
        <>
          <header className="relative flex items-center gap-2 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu"
                  className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-sidebar-accent"
                >
                  <Menu className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuItem onSelect={() => setView("profile")} className="cursor-pointer">
                  <InitialsAvatar name={profileName} imageUrl={profileImage} size="xs" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setView("settings")} className="cursor-pointer">
                  <SettingsIcon className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setTheme(isDark ? "light" : "dark");
                  }}
                  className="cursor-pointer"
                >
                  {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  {isDark ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <GlobalSearch value={searchQuery} onChange={setSearchQuery} inputRef={searchInputRef} />
          </header>
          <div className="flex-1 overflow-y-auto">
            {isSearching ? (
              <SearchResults
                query={searchQuery}
                conversations={conversations}
                onPickConversation={(id) => {
                  setSearchQuery("");
                  onSelect(id);
                }}
                onPickUser={(user) => {
                  setSearchQuery("");
                  const existingDm = conversationDTOs.find(
                    (conversation) =>
                      !conversation.isGroup &&
                      conversation.members.some((member) => member.userId === user.id),
                  );
                  if (existingDm) {
                    onSelect(existingDm.id);
                    return;
                  }
                  onSelectUser?.(user);
                }}
              />
            ) : (
              <ConversationList items={conversations} activeId={activeId} onSelect={onSelect} />
            )}
          </div>
          <div className="pointer-events-none absolute right-4 bottom-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Add"
                  className="pointer-events-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
                >
                  <Plus className="size-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="min-w-44">
                <DropdownMenuItem
                  onSelect={() => setView("create-group")}
                  className="cursor-pointer"
                >
                  <Users className="size-4" />
                  New Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : view === "profile" ? (
        <ProfileSummaryView
          onBack={() => setView("chats")}
          onEdit={() => setView("edit-profile")}
          avatarName={profileName}
          avatarImage={profileImage}
          displayUsername={displayUsername}
          bio={profileBio}
        />
      ) : view === "edit-profile" ? (
        <EditProfileView
          onBack={() => setView("profile")}
          displayUsername={displayUsername}
          email={profileEmail}
          bio={profileBio}
          avatarName={profileName}
          avatarImage={profileImage}
          onSaveProfile={async (values) => {
            await saveMutation.mutateAsync(values);
          }}
          onUploadAvatar={(file) => uploadAvatarMutation.mutate(file)}
          onRemoveAvatar={() => removeAvatarMutation.mutate()}
          isUploadingAvatar={uploadAvatarMutation.isPending}
          isRemovingAvatar={removeAvatarMutation.isPending}
        />
      ) : view === "settings" ? (
        <SettingsView
          onBack={() => setView("chats")}
          onChangePassword={(values) => changePasswordMutation.mutateAsync(values)}
        />
      ) : (
        <CreateGroupFlow
          contacts={groupFlowContacts}
          onCancel={() => setView("chats")}
          onCreated={(conversationId) => {
            setView("chats");
            onSelect(conversationId);
          }}
        />
      )}
    </ResizablePanel>
  );
}
