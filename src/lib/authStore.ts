import type { User } from "../types";
import { STORAGE_SESSION, STORAGE_USERS } from "./storageKeys";

export function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS);
    if (!raw) return [];
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

export function getSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw) as { userId: string };
    return s.userId ?? null;
  } catch {
    return null;
  }
}

export function setSessionUserId(userId: string | null): void {
  if (!userId) localStorage.removeItem(STORAGE_SESSION);
  else localStorage.setItem(STORAGE_SESSION, JSON.stringify({ userId }));
}

export function registerUser(
  email: string,
  password: string,
  name: string,
): User {
  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const user: User = {
    id: `u_${Date.now().toString(36)}`,
    email: email.trim(),
    name: name.trim() || email.split("@")[0]!,
    password,
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export function loginUser(email: string, password: string): User {
  const users = loadUsers();
  const u = users.find(
    (x) =>
      x.email.toLowerCase() === email.toLowerCase() && x.password === password,
  );
  if (!u) throw new Error("Invalid email or password.");
  return u;
}
