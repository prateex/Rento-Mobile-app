/**
 * Helper utility for customer ID photo auto-deletion logic
 * IDs are deleted 7 days after booking completion
 */

export interface IdPhotoDeletionInfo {
  canDelete: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  deletionDate: Date | null;
  isExpired: boolean;
}

/**
 * Calculate time remaining before customer ID photos can be deleted
 * @param bookingCompletedAt - Date when the last booking was completed
 * @returns Deletion timing information
 */
export function calculateIdPhotoDeletionTime(bookingCompletedAt: Date | null): IdPhotoDeletionInfo {
  if (!bookingCompletedAt) {
    // No booking completed - can delete immediately
    return {
      canDelete: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      deletionDate: null,
      isExpired: true,
    };
  }

  const RETENTION_DAYS = 7;
  const deletionDate = new Date(bookingCompletedAt);
  deletionDate.setDate(deletionDate.getDate() + RETENTION_DAYS);

  const now = new Date();
  const timeRemaining = deletionDate.getTime() - now.getTime();

  if (timeRemaining <= 0) {
    return {
      canDelete: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      deletionDate,
      isExpired: true,
    };
  }

  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));

  return {
    canDelete: false,
    daysRemaining,
    hoursRemaining,
    deletionDate,
    isExpired: false,
  };
}

/**
 * Format the deletion timer text for display
 */
export function formatDeletionTimer(info: IdPhotoDeletionInfo): string {
  if (info.isExpired) {
    return 'Can delete now';
  }

  if (info.daysRemaining > 1) {
    return `Delete in ${info.daysRemaining} days`;
  }

  return `Delete in ${info.hoursRemaining}h`;
}
