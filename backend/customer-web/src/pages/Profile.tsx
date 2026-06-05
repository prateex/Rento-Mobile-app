import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Button } from '@/components/common/Button';

export function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, documents, isComplete, loading, error, saveProfile, uploadDocument } = useCustomerProfile();

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    id_type: 'Aadhaar',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        emergency_contact: profile.emergency_contact || '',
        id_type: profile.id_type || 'Aadhaar',
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await saveProfile(form);
    if (ok) {
      const redirectTo = (location.state as any)?.from;
      if (redirectTo) {
        navigate(redirectTo);
      }
    }
  };

  const handleUpload = async (file: File | null, type: string) => {
    if (!file) return;
    await uploadDocument(file, type);
  };

  const hasFront = documents.some((d) => d.document_type === 'ID_FRONT');
  const hasBack = documents.some((d) => d.document_type === 'ID_BACK');

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <LoadingSpinner text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Profile</h1>
        <p className="mb-6 text-gray-600">Complete your profile to book a vehicle.</p>

        {error && <ErrorMessage message={error} variant="error" />}

        <form onSubmit={handleSave} className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Full Name</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                value={form.full_name}
                onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Emergency Contact</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
                value={form.emergency_contact}
                onChange={(e) => setForm((s) => ({ ...s, emergency_contact: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Address</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
              rows={3}
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">ID Type</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
              value={form.id_type}
              onChange={(e) => setForm((s) => ({ ...s, id_type: e.target.value }))}
              required
            >
              <option value="Aadhaar">Aadhaar</option>
              <option value="Voter ID">Voter ID</option>
              <option value="Passport">Passport</option>
              <option value="Driving License">Driving License</option>
            </select>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h2 className="mb-2 text-lg font-semibold">ID Documents</h2>
            <p className="text-sm text-gray-600">Upload front and back ID photos.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Front</label>
                <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0] || null, 'ID_FRONT')} />
                {hasFront && <p className="mt-1 text-xs text-green-600">Uploaded</p>}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Back</label>
                <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0] || null, 'ID_BACK')} />
                {hasBack && <p className="mt-1 text-xs text-green-600">Uploaded</p>}
              </div>
            </div>
          </div>

          <Button type="submit" loading={loading} fullWidth>
            Save Profile
          </Button>
        </form>

        {!isComplete && (
          <p className="mt-4 text-sm text-red-600">Please complete your profile before booking.</p>
        )}
      </div>
    </div>
  );
}
