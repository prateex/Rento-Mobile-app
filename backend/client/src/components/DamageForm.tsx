import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, UploadCloud } from 'lucide-react';
import { Damage, DamageType } from '@/lib/store';

export interface DamageFormData {
  type: DamageType;
  severity: 'minor' | 'moderate' | 'major';
  notes: string;
  photoUrls: string[];
}

interface DamageFormProps {
  /**
   * Initial damage data (for edit mode)
   * If not provided, renders in create mode
   */
  initialDamage?: Damage | null;
  
  /**
   * Called with form data on submit
   * Caller responsible for Supabase persistence
   */
  onSubmit: (data: DamageFormData) => Promise<void>;
  
  /**
   * Called when user clicks cancel
   */
  onCancel: () => void;
  
  /**
   * Loading state (shows during Supabase call)
   */
  isLoading?: boolean;
  
  /**
   * Dialog/form title (e.g., "Report Damage" or "Edit Damage")
   */
  title?: string;
  
  /**
   * Submit button label (e.g., "Report Damage" or "Save Changes")
   */
  submitLabel?: string;
}

/**
 * Shared damage form component used by:
 * 1. Vehicle → Report Damage
 * 2. Vehicle → Edit Damage
 * 3. Return Vehicle → Add Damage
 * 
 * Handles:
 * - type (Scratch, Dent, Broken Mirror, Tyre, Mechanical, Other)
 * - severity (Minor, Moderate, Major - exactly 3 options)
 * - notes (textarea)
 * - photo uploads (up to 4)
 */
export const DamageForm = ({
  initialDamage,
  onSubmit,
  onCancel,
  isLoading = false,
  title = 'Report Damage',
  submitLabel = 'Save Damage',
}: DamageFormProps) => {
  const { register, handleSubmit, watch, setValue } = useForm<DamageFormData>({
    defaultValues: {
      type: initialDamage?.type || 'Scratch',
      severity: initialDamage?.severity || 'minor',
      notes: initialDamage?.notes || '',
      photoUrls: initialDamage?.photoUrls || [],
    },
  });

  const [photos, setPhotos] = useState<string[]>(initialDamage?.photoUrls || []);
  const [type, setType] = useState<DamageType>(initialDamage?.type || 'Scratch');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'major'>(
    initialDamage?.severity || 'minor'
  );

  const damageTypes: DamageType[] = ['Scratch', 'Dent', 'Broken Mirror', 'Tyre', 'Mechanical', 'Other'];

  const handleAddPhoto = () => {
    if (photos.length < 4) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            const newPhotos = [...photos, imageData];
            setPhotos(newPhotos);
            setValue('photoUrls', newPhotos);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    setValue('photoUrls', newPhotos);
  };

  const onSubmitForm = async (data: DamageFormData) => {
    try {
      console.log('[DamageForm] Submitting damage...', { type, severity, notes: data.notes, photoCount: photos.length });
      await onSubmit({
        ...data,
        type,
        severity,
        photoUrls: photos,
      });
      console.log('[DamageForm] Submit successful');
    } catch (err) {
      console.error('[DamageForm] submit failed', err);
      // Re-throw so parent component can handle it
      throw err;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
      {/* Type & Severity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <Select value={type} onValueChange={(val) => setType(val as DamageType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {damageTypes.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Severity</label>
          <Select value={severity} onValueChange={(val) => setSeverity(val as 'minor' | 'moderate' | 'major')}>
            <SelectTrigger>
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="major">Major</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Textarea
          {...register('notes')}
          placeholder="Describe the damage location and details..."
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Photos (Max 4)</label>
        <div className="flex gap-2 flex-wrap">
          {photos.map((url, i) => (
            <div key={i} className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden group">
              <img src={url} className="h-full w-full object-cover" alt={`Damage ${i + 1}`} />
              <button
                type="button"
                onClick={() => handleRemovePhoto(i)}
                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {photos.length < 4 && (
            <div
              onClick={handleAddPhoto}
              className="h-16 w-16 flex-shrink-0 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:bg-zinc-50 transition-colors"
            >
              <UploadCloud size={16} className="text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Add</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" className="flex-1" disabled={isLoading}>
          {isLoading ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default DamageForm;
