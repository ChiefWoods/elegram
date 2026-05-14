import type { AppType } from "@elegram/server";

import { hc, parseResponse, type InferRequestType, type InferResponseType } from "hono/client";

const baseURL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

const honoClient = hc<AppType>(baseURL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});

export type HonoClient = typeof honoClient;

type UpdateMeBody = InferRequestType<typeof honoClient.api.me.$patch>["json"];
type PresignUploadBody = InferRequestType<typeof honoClient.api.uploads.presign.$post>["json"];
type CreateConversationBody = InferRequestType<typeof honoClient.api.conversations.$post>["json"];
type PatchConversationBody = InferRequestType<
  (typeof honoClient.api.conversations)[":id"]["$patch"]
>["json"];
type SendMessageBody = InferRequestType<
  (typeof honoClient.api.conversations)[":id"]["messages"]["$post"]
>["json"];
type SendDirectMessageBody = InferRequestType<
  (typeof honoClient.api.conversations)["dm"][":userId"]["messages"]["$post"]
>["json"];
type EditMessageBody = InferRequestType<
  (typeof honoClient.api.conversations)[":id"]["messages"][":messageId"]["$patch"]
>["json"];
type AddMembersBody = InferRequestType<
  (typeof honoClient.api.conversations)[":id"]["members"]["$post"]
>["json"];
type MemberRoleBody = InferRequestType<
  (typeof honoClient.api.conversations)[":id"]["members"][":userId"]["role"]["$patch"]
>["json"];

export type MeResponse = InferResponseType<typeof honoClient.api.me.$get, 200>;
export type UpdateMeResponse = InferResponseType<typeof honoClient.api.me.$patch, 200>;
export type PresignUploadResponse = InferResponseType<
  typeof honoClient.api.uploads.presign.$post,
  200
>;
export type ValidateEmailResponse = InferResponseType<
  (typeof honoClient.api.auth)["validate-email"]["$get"],
  200
>;
export type EmailExistsResponse = InferResponseType<
  (typeof honoClient.api.auth)["email-exists"]["$get"],
  200
>;

export type ConversationsResponse = InferResponseType<
  typeof honoClient.api.conversations.$get,
  200
>;
export type ConversationSummaryDTO = ConversationsResponse["conversations"][number];
export type ConversationDetailResponse = InferResponseType<
  (typeof honoClient.api.conversations)[":id"]["$get"],
  200
>;
export type ConversationDetailDTO = ConversationDetailResponse["conversation"];
export type CreateConversationResponse = InferResponseType<
  typeof honoClient.api.conversations.$post,
  201
>;
export type UpdateConversationResponse = InferResponseType<
  (typeof honoClient.api.conversations)[":id"]["$patch"],
  200
>;
export type MessagesResponse = InferResponseType<
  (typeof honoClient.api.conversations)[":id"]["messages"]["$get"],
  200
>;
export type MessageDTO = MessagesResponse["messages"][number];
export type SendDirectMessageResponse = InferResponseType<
  (typeof honoClient.api.conversations)["dm"][":userId"]["messages"]["$post"],
  201
>;
export type SearchResponse = InferResponseType<typeof honoClient.api.search.$get, 200>;
export type UsersResponse = InferResponseType<typeof honoClient.api.users.$get, 200>;
export type SearchUserDTO = SearchResponse["users"][number];
export type SearchGroupDTO = SearchResponse["groups"][number];
export type PresenceResponse = InferResponseType<typeof honoClient.api.presence.$get, 200>;

export async function getMe(): Promise<MeResponse> {
  return await parseResponse(honoClient.api.me.$get());
}

export async function updateMe(json: UpdateMeBody): Promise<UpdateMeResponse> {
  return await parseResponse(honoClient.api.me.$patch({ json }));
}

export async function presignUpload(json: PresignUploadBody): Promise<PresignUploadResponse> {
  return await parseResponse(honoClient.api.uploads.presign.$post({ json }));
}

export async function validateEmail(email: string): Promise<ValidateEmailResponse> {
  return await parseResponse(
    honoClient.api.auth["validate-email"].$get({
      query: { email },
    }),
  );
}

export async function emailExists(email: string): Promise<EmailExistsResponse> {
  return await parseResponse(
    honoClient.api.auth["email-exists"].$get({
      query: { email },
    }),
  );
}

export async function getConversations(): Promise<ConversationsResponse> {
  return await parseResponse(honoClient.api.conversations.$get());
}

export async function getConversation(id: string): Promise<ConversationDetailResponse> {
  return await parseResponse(honoClient.api.conversations[":id"].$get({ param: { id } }));
}

export async function createConversation(
  json: CreateConversationBody,
): Promise<CreateConversationResponse> {
  return (await parseResponse(
    honoClient.api.conversations.$post({ json }),
  )) as CreateConversationResponse;
}

export async function updateConversation(
  id: string,
  json: PatchConversationBody,
): Promise<UpdateConversationResponse> {
  return await parseResponse(honoClient.api.conversations[":id"].$patch({ param: { id }, json }));
}

export async function deleteConversation(id: string): Promise<void> {
  await parseResponse(honoClient.api.conversations[":id"].$delete({ param: { id } }));
}

export async function leaveConversation(id: string): Promise<void> {
  await parseResponse(honoClient.api.conversations[":id"].leave.$delete({ param: { id } }));
}

export async function transferOwnership(id: string, newOwnerId: string): Promise<void> {
  await parseResponse(
    honoClient.api.conversations[":id"].transfer.$post({ param: { id }, json: { newOwnerId } }),
  );
}

export async function markConversationRead(id: string): Promise<void> {
  await parseResponse(honoClient.api.conversations[":id"].read.$post({ param: { id } }));
}

export async function getMessages(id: string, cursor?: string): Promise<MessagesResponse> {
  return await parseResponse(
    honoClient.api.conversations[":id"].messages.$get({
      param: { id },
      query: cursor ? { cursor } : {},
    }),
  );
}

export async function sendMessage(id: string, json: SendMessageBody): Promise<MessageDTO> {
  const result = await parseResponse(
    honoClient.api.conversations[":id"].messages.$post({ param: { id }, json }),
  );
  return result.message;
}

export async function sendDirectMessage(
  userId: string,
  json: SendDirectMessageBody,
): Promise<SendDirectMessageResponse> {
  return await parseResponse(
    honoClient.api.conversations.dm[":userId"].messages.$post({
      param: { userId },
      json,
    }),
  );
}

export async function editMessage(
  id: string,
  messageId: string,
  json: EditMessageBody,
): Promise<MessageDTO> {
  const result = await parseResponse(
    honoClient.api.conversations[":id"].messages[":messageId"].$patch({
      param: { id, messageId },
      json,
    }),
  );
  return result.message;
}

export async function deleteMessage(id: string, messageId: string): Promise<MessageDTO> {
  const result = await parseResponse(
    honoClient.api.conversations[":id"].messages[":messageId"].$delete({
      param: { id, messageId },
    }),
  );
  return result.message;
}

export async function addMembers(id: string, json: AddMembersBody): Promise<string[]> {
  const result = await parseResponse(
    honoClient.api.conversations[":id"].members.$post({ param: { id }, json }),
  );
  return result.addedUserIds;
}

export async function removeMember(id: string, userId: string): Promise<void> {
  await parseResponse(
    honoClient.api.conversations[":id"].members[":userId"].$delete({ param: { id, userId } }),
  );
}

export async function updateMemberRole(
  id: string,
  userId: string,
  json: MemberRoleBody,
): Promise<void> {
  await parseResponse(
    honoClient.api.conversations[":id"].members[":userId"].role.$patch({
      param: { id, userId },
      json,
    }),
  );
}

export async function searchEverything(q: string): Promise<SearchResponse> {
  return await parseResponse(honoClient.api.search.$get({ query: { q } }));
}

export async function searchUsers(q: string): Promise<UsersResponse> {
  return await parseResponse(honoClient.api.users.$get({ query: { q } }));
}

export async function getPresence(): Promise<PresenceResponse> {
  return await parseResponse(honoClient.api.presence.$get());
}
