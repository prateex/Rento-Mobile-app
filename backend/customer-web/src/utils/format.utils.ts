/**
 * Format currency (Indian Rupee)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Truncate text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Get booking status color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-primary/30 text-secondary',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    expired: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get booking status label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    requested: 'Waiting for owner confirmation',
    confirmed: 'Booking confirmed by owner',
    active: 'Bike picked up',
    completed: 'Ride completed',
    cancelled: 'Booking cancelled',
    expired: 'Booking expired',
  };
  return labels[status] || 'Unknown status';
}

/**
 * Get payment status color
 */
export function getPaymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    unpaid: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indian)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Generate placeholder image URL
 */
export function getPlaceholderImage(text: string = 'Vehicle'): string {
  return `https://via.placeholder.com/400x300/e2e8f0/64748b?text=${encodeURIComponent(text)}`;
}

/**
 * Get vehicle type icon
 */
export function getVehicleTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    bike: '🏍️',
    scooter: '🛵',
    car: '🚗',
  };
  return icons[type.toLowerCase()] || '🚗';
}

/**
 * Get cancellation policy text
 */
export function getCancellationPolicyText(policyType: string): string {
  const policies: Record<string, string> = {
    strict: 'Non-refundable - No cancellation allowed',
    moderate: 'Full refund if cancelled 24 hours before pickup',
    standard: 'Full refund if cancelled 48 hours before pickup',
    flexible: 'Full refund if cancelled anytime before pickup',
  };
  return policies[policyType] || policies.standard;
}
