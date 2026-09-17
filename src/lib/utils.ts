import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes, resolving conflicts. Use it in every component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
