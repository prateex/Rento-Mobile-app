import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Button } from '@/components/common/Button';

export function LicenseKyc() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profile,
    isComplete,
    isLicenseValid,
    hasLicenseImage,
    loading,
    error,
    saveProfile,
    uploadDocument,
    loadProfile,
    loadDocuments,
  } = useCustomerProfile();

  const [licenseNumber, setLicenseNumber] = useState(profile?.driving_license_number || '');
  const [expiry, setExpiry] = useState(profile?.driving_license_expiry || '');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const returnTo = (location.state as any)?.from || '/checkout';

  useEffect(() => {
    if (isLicenseValid) {
      navigate(returnTo, { replace: true });
    }
  }, [isLicenseValid, navigate, returnTo]);

  useEffect(() => {
    if (!loading && !isComplete) {
      navigate('/profile', { state: { from: '/kyc' }, replace: true });
    }
  }, [isComplete, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setLicenseNumber(profile.driving_license_number || '');
      setExpiry(profile.driving_license_expiry || '');
    }
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!licenseNumber.trim()) {
      setFormError('Enter your driving license number.');
      return;
    }

    if (expiry) {
      const expiryDate = new Date(expiry);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() < Date.now()) {
        setFormError('Enter a valid, non-expired license date.');
        return;
      }
    }

    if (!hasLicenseImage && !file) {
      setFormError('Upload the front image of your driving license.');
      return;
    }

    setFormError(null);

    if (!profile) {
      setFormError('Complete your profile before uploading a license.');
      return;
    }

    const profileSaved = await saveProfile({
      full_name: profile.full_name,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      emergency_contact: profile.emergency_contact,
      id_type: profile.id_type || 'Driving License',
      driving_license_number: licenseNumber.trim(),
      driving_license_expiry: expiry || null,
    });

    if (!profileSaved) {
      setFormError('Unable to save license details. Please try again.');
      return;
    }

    if (file) {
      const uploaded = await uploadDocument(file, 'DRIVING_LICENSE_FRONT');
      if (!uploaded) {
        setFormError('Unable to upload license image. Please try again.');
        return;
      }
    }

    await loadProfile();
    await loadDocuments();
    navigate(returnTo, { replace: true });
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <LoadingSpinner text="Loading license details..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Driving License Verification</h1>
        <p className="mb-6 text-gray-600">
          We require a valid driving license to keep riders safe and comply with local regulations.
          Your information is encrypted and used only for booking verification.
        </p>

        {(error || formError) && (
          <ErrorMessage message={formError || error || 'Failed to load license details'} variant="error" />
        )}

        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">License Number</label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="DL-XXXX-XXXX-XXXX"
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Expiry Date (optional)</label>
            <input
              type="date"
              value={expiry || ''}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">Leave blank if your license does not show an expiry date.</p>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h2 className="mb-2 text-lg font-semibold">License Image</h2>
            <p className="text-sm text-gray-600">Upload the front image of your driving license.</p>
            <div className="mt-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {hasLicenseImage && !file && (
                <p className="mt-2 text-xs text-green-600">License image already on file.</p>
              )}
              {file && (
                <p className="mt-2 text-xs text-gray-600">Selected: {file.name}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-primary/10 p-4 text-sm text-secondary">
            Your license details are stored securely and shared only with the rental partner during pickup.
          </div>

          <Button type="submit" loading={loading} fullWidth>
            Save and Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
