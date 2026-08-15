import type { DerivedProfile } from "../astrology/types";

export type GroupDynamic =
  | "SAME_GROUP"
  | "MOON_OVER_EARTH"
  | "EARTH_OVER_SUN"
  | "SUN_OVER_MOON";

export interface RelationshipDetail {
  attractionJa: string;
  frictionJa: string;
  unspokenJa: string;
  communicationJa: string;
  reconciliationJa: string;
  longTermJa: string;
}

export interface RelationshipResult {
  pairKey: string;
  dynamic: GroupDynamic;
  freeTitleJa: string;
  freeSummaryJa: string;
  detail: RelationshipDetail;
}

export interface RelationshipMember {
  id: string;
  profile: DerivedProfile;
}

export interface CreateRelationshipInput {
  memberA: RelationshipMember;
  memberB: RelationshipMember;
}
