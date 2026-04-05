export const STORAGE_USERS = "lene_users_v1";
export const STORAGE_SESSION = "lene_session_v1";

export function txKey(userId: string) {
  return `lene_tx_${userId}`;
}

export function efKey(userId: string) {
  return `lene_ef_${userId}`;
}
