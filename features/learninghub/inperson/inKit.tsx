"use client";

import { initials } from "../teachKit";

/** "Ava Smith" — or, with the privacy switch on (a projected screen), just "AS". */
export const nameFor = (name: string, hide: boolean) => (hide ? initials(name) : name || "Student");
/** A fresh idempotency key for one tap of "Start" (a double tap / retry then returns the same session). */
export const newKey = () => `ip${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
