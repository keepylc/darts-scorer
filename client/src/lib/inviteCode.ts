const PREFIX = "darts:invite:";

export function storeInviteCode(shareCode: string, code: string): void {
  localStorage.setItem(PREFIX + shareCode, code);
}

export function getInviteCode(shareCode: string): string | null {
  return localStorage.getItem(PREFIX + shareCode);
}

export function clearInviteCode(shareCode: string): void {
  localStorage.removeItem(PREFIX + shareCode);
}
