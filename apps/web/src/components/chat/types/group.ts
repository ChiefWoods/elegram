export type Role = "OWNER" | "ADMIN" | "MEMBER";

export type GroupMember = {
  id: string;
  name: string;
  username: string;
  avatarKey: string | null;
  status: string;
  role: Role;
  online?: boolean;
};
