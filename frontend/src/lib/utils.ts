import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a timestamp (nanoseconds) to Asia/Ulaanbaatar timezone
 * Format: YYYY-MM-DD HH:mm:ss
 */
export function formatTimestamp(timestamp: bigint): string {
  // Convert nanoseconds to milliseconds
  const milliseconds = Number(timestamp) / 1_000_000;
  
  // Handle invalid or zero timestamps
  if (milliseconds === 0 || !isFinite(milliseconds)) {
    return '-';
  }

  const date = new Date(milliseconds);

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return '-';
  }

  try {
    // Format date in Asia/Ulaanbaatar timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ulaanbaatar',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const dateParts: Record<string, string> = {};
    
    parts.forEach(part => {
      if (part.type !== 'literal') {
        dateParts[part.type] = part.value;
      }
    });

    return `${dateParts.year}-${dateParts.month}-${dateParts.day} ${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '-';
  }
}
