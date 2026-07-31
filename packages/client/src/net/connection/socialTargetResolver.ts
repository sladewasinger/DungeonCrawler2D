import type { Connection } from "./connection.js";

export function socialTargetId(
  connection: Connection,
  nameOrId: string,
): string | undefined {
  const lower = nameOrId.toLowerCase();
  const matches = socialTargetMatcher(nameOrId, lower);
  return partyTargetId(connection, matches)
    ?? entityTargetId(connection, matches)
    ?? contactTargetId(connection, matches)
    ?? outgoingTargetId(connection, matches);
}

function socialTargetMatcher(nameOrId: string, lower: string) {
  return (id: string | undefined, name: string | undefined): boolean =>
    id === nameOrId || name?.toLowerCase() === lower;
}

type SocialTargetMatcher = ReturnType<typeof socialTargetMatcher>;

function partyTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return connection.party?.members.find(({ id, name }) => matches(id, name))?.id;
}

function entityTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return [...connection.entities.values()].find(({ snap }) => matches(snap.id, snap.name))?.snap.id;
}

function contactTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return connection.contacts.find(({ id, name }) => matches(id, name))?.id;
}

function outgoingTargetId(connection: Connection, matches: SocialTargetMatcher): string | undefined {
  return [...connection.outgoingPartyInvites].find(([id, name]) => matches(id, name))?.[0];
}
