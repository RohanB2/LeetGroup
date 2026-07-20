import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getValidStreak(currentStreak: number | undefined | null, lastSubmissionDate: string | undefined | null): number {
  if (!currentStreak || !lastSubmissionDate) return 0;

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const lastDate = new Date(lastSubmissionDate + "T00:00:00");
  const current = new Date(today + "T00:00:00");
  
  const diffDays = Math.round((current.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
  
  if (diffDays > 1) {
    return 0;
  }
  
  return currentStreak;
}
