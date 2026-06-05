import { useEffect, useState } from 'react';
import { customerProfileService } from '@/services/customerProfile.service';
import type { CustomerProfile, CustomerIdDocument } from '@/types';

export function useCustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [documents, setDocuments] = useState<CustomerIdDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = customerProfileService.isProfileComplete(profile);
  const licenseDocument = documents.find((doc) => doc.document_type === 'DRIVING_LICENSE_FRONT');
  const hasLicenseNumber = Boolean(profile?.driving_license_number);
  const hasLicenseImage = Boolean(licenseDocument);
  const hasValidExpiry = (() => {
    if (!profile?.driving_license_expiry) return true;
    const expiry = new Date(profile.driving_license_expiry);
    return expiry.getTime() >= Date.now();
  })();
  const isLicenseValid = hasLicenseNumber && hasLicenseImage && hasValidExpiry;

  useEffect(() => {
    loadProfile();
    loadDocuments();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError(null);
      const data = await customerProfileService.getProfile();
      setProfile(data);
    } catch (err: any) {
      console.error('Error loading customer profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments() {
    try {
      const docs = await customerProfileService.getDocuments();
      setDocuments(docs);
    } catch (err: any) {
      console.error('Error loading customer documents:', err);
    }
  }

  async function saveProfile(payload: Omit<CustomerProfile, 'id' | 'auth_id' | 'created_at' | 'updated_at'>) {
    try {
      setLoading(true);
      setError(null);
      const saved = await customerProfileService.upsertProfile(payload);
      setProfile(saved);
      return true;
    } catch (err: any) {
      console.error('Error saving customer profile:', err);
      setError(err.message || 'Failed to save profile');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument(file: File, documentType: string) {
    try {
      setLoading(true);
      setError(null);
      const doc = await customerProfileService.uploadDocument(file, documentType);
      setDocuments((prev) => [doc, ...prev]);
      return true;
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
      return false;
    } finally {
      setLoading(false);
    }
  }

  return {
    profile,
    documents,
    isComplete,
    isLicenseValid,
    hasLicenseImage,
    loading,
    error,
    loadProfile,
    loadDocuments,
    saveProfile,
    uploadDocument,
  };
}
