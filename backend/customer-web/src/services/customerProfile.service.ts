import { supabase } from './supabase';
import type { CustomerProfile, CustomerIdDocument } from '@/types';

/**
 * Customer Profile Service
 * Handles profile and ID document operations
 */

export const customerProfileService = {
  async getProfile(): Promise<CustomerProfile | null> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching customer profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to get customer profile:', error);
      return null;
    }
  },

  async upsertProfile(payload: Omit<CustomerProfile, 'id' | 'auth_id' | 'created_at' | 'updated_at'>): Promise<CustomerProfile> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('customer_profiles')
        .upsert({
          auth_id: user.id,
          ...payload,
        }, { onConflict: 'auth_id' })
        .select('*')
        .single();

      if (error) {
        console.error('Error saving customer profile:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to save customer profile:', error);
      throw error;
    }
  },

  async getDocuments(): Promise<CustomerIdDocument[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('customer_id_documents')
        .select('*')
        .eq('customer_auth_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer ID documents:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get customer ID documents:', error);
      return [];
    }
  },

  async uploadDocument(file: File, documentType: string): Promise<CustomerIdDocument> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${documentType}-${Date.now()}.${fileExt}`;

      // TODO: Ensure storage bucket "customer-id-documents" exists with proper RLS policies
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('customer-id-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Error uploading ID document:', uploadError);
        throw uploadError;
      }

      const { data: publicUrl } = supabase.storage
        .from('customer-id-documents')
        .getPublicUrl(uploadData.path);

      const { data, error } = await supabase
        .from('customer_id_documents')
        .insert({
          customer_auth_id: user.id,
          document_type: documentType,
          image_url: publicUrl.publicUrl,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error saving ID document:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  },

  isProfileComplete(profile: CustomerProfile | null): boolean {
    if (!profile) return false;
    return Boolean(
      profile.full_name &&
      profile.phone &&
      profile.email &&
      profile.address &&
      profile.emergency_contact &&
      profile.id_type
    );
  },
};
