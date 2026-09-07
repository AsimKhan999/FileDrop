import { FILE_DROP_CONSTANTS } from "../constants";

export function validateFileSize(size: number): boolean {
  return size <= FILE_DROP_CONSTANTS.MAX_FILE_SIZE;
}

export function validateShareToken(token: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(token) && token.length > 0;
}

export function validateExpiration(minutes: number): boolean {
  return FILE_DROP_CONSTANTS.ALLOWED_EXPIRATION_OPTIONS.includes(minutes);
}
