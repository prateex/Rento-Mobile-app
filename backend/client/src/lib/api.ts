/**
 * API Configuration
 * Handles API base URL for development and production
 */

// Get API base URL from environment or default to same origin
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build full API endpoint URL
 * @param path - API path (e.g., '/api/vehicles')
 * @returns Full URL to API endpoint
 */
export function apiUrl(path: string): string {
  // If path already starts with http, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // In development with no API_URL set, use relative paths (Vite proxy)
  if (!API_BASE_URL) {
    return normalizedPath;
  }
  
  // In production, use full URL to backend service
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Example usage:
 * - Development (local): apiUrl('/api/vehicles') → '/api/vehicles' (proxied by Vite)
 * - Production: apiUrl('/api/vehicles') → 'https://backend.onrender.com/api/vehicles'
 */
