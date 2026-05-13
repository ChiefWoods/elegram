-- Enforce exactly one OWNER per conversation (for group chats)
CREATE UNIQUE INDEX "conversation_member_one_owner_idx"
ON "conversation_member" ("conversationId")
WHERE "role" = 'OWNER';

-- Cover message list/unread queries with INCLUDE columns
CREATE INDEX "message_conv_created_covering_idx"
ON "message" ("conversationId", "createdAt")
INCLUDE ("senderId", "deletedAt");

-- Enforce DM members can only have MEMBER role
CREATE OR REPLACE FUNCTION enforce_dm_member_role() RETURNS trigger AS $$
BEGIN
  IF NEW."role" <> 'MEMBER'
     AND (SELECT NOT "isGroup" FROM "conversation" WHERE "id" = NEW."conversationId")
  THEN
    RAISE EXCEPTION 'DM members must have role MEMBER';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "conversation_member_dm_role" ON "conversation_member";

CREATE TRIGGER "conversation_member_dm_role"
BEFORE INSERT OR UPDATE ON "conversation_member"
FOR EACH ROW EXECUTE FUNCTION enforce_dm_member_role();
