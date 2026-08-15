export const EMPTY_MEMBER_ID_ERROR = "Member ID must not be empty";
export const DUPLICATE_MEMBER_ID_ERROR =
  "Relationship requires two distinct member IDs";

export function canonicalPairKey(memberAId: string, memberBId: string): string {
  if (memberAId.trim() === "" || memberBId.trim() === "") {
    throw new Error(EMPTY_MEMBER_ID_ERROR);
  }

  if (memberAId === memberBId) {
    throw new Error(DUPLICATE_MEMBER_ID_ERROR);
  }

  const [low, high] = [memberAId, memberBId].sort();

  return `${low}:${high}`;
}
