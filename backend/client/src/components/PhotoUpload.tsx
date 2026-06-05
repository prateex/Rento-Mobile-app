import { useState } from 'react';
import { Upload, X, Download, AlertCircle, Clock } from 'lucide-react';

interface PhotoUploadProps {
  label: string;
  currentPhotoUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  accept?: string;
  disabled?: boolean;
  expiryInfo?: {
    expiresAt?: string;
    daysUntilExpiry?: number;
  };
}

export function PhotoUpload({
  label,
  currentPhotoUrl,
  onUpload,
  onDelete,
  accept = 'image/*',
  disabled = false,
  expiryInfo
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmed = window.confirm('Are you sure you want to delete this photo?');
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!currentPhotoUrl) return;

    try {
      const response = await fetch(currentPhotoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed');
    }
  };

  const getExpiryStatus = () => {
    if (!expiryInfo?.daysUntilExpiry) return null;

    const days = expiryInfo.daysUntilExpiry;
    
    if (days < 0) {
      return { color: 'text-red-600', icon: AlertCircle, text: 'Expired' };
    } else if (days === 0) {
      return { color: 'text-red-600', icon: Clock, text: 'Expires today' };
    } else if (days <= 2) {
      return { color: 'text-orange-600', icon: Clock, text: `${days} day${days > 1 ? 's' : ''} left` };
    } else {
      return { color: 'text-gray-600', icon: Clock, text: `${days} days left` };
    }
  };

  const expiryStatus = getExpiryStatus();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {expiryStatus && (
          <span className={`ml-2 inline-flex items-center gap-1 text-xs ${expiryStatus.color}`}>
            <expiryStatus.icon className="w-3 h-3" />
            {expiryStatus.text}
          </span>
        )}
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {currentPhotoUrl ? (
        <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden">
          <img
            src={currentPhotoUrl}
            alt={label}
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 shadow-lg"
              title="Download photo"
            >
              <Download className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || disabled}
                className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg disabled:opacity-50"
                title="Delete photo"
              >
                {deleting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading || disabled}
            className="hidden"
            id={`photo-upload-${label.replace(/\s+/g, '-')}`}
          />
          <label
            htmlFor={`photo-upload-${label.replace(/\s+/g, '-')}`}
            className={`
              flex flex-col items-center justify-center
              w-full h-48 border-2 border-dashed border-gray-300 rounded-lg
              cursor-pointer hover:bg-gray-50 transition-colors
              ${uploading || disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">Click to upload</span>
                <span className="text-xs text-gray-500">Max 5MB, images only</span>
              </div>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
