import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Log a warning if environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Les variables d\'environnement Supabase ne sont pas définies.');
}

// Create a Supabase client with type safety
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Name of the storage bucket for PDF templates
export const TEMPLATES_BUCKET = 'modeles';
// Bucket for generated PDFs
export const GENERATED_BUCKET = 'generated_pdfs';

// Function to initialize storage
export const initializeStorage = async () => {
  try {
    // First, check if the user is authenticated
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      console.log('Utilisateur non authentifié. Mode anonyme activé.');
      console.log('Les opérations de stockage utiliseront localStorage comme solution de repli.');
      return; // Sortir tôt si non authentifié
    } else {
      console.log('Utilisateur authentifié. Session active.');
    }

    console.log('Vérification de l\'accès aux buckets:', TEMPLATES_BUCKET, 'et', GENERATED_BUCKET);
    
    // Instead of listing buckets (which requires admin privileges),
    // directly check if each bucket exists by trying to list files in it
    await checkAndCreateBuckets();
    
  } catch (error) {
    console.error('Erreur d\'initialisation du stockage:', error);
    console.log('Les PDFs seront stockés localement uniquement.');
  }
};

// Check if buckets exist and create them if needed
const checkAndCreateBuckets = async () => {
  // Check template bucket
  await checkAndCreateBucket(TEMPLATES_BUCKET);
  
  // Check generated bucket
  await checkAndCreateBucket(GENERATED_BUCKET);
};

// Helper function to check if a bucket exists and create it if needed
const checkAndCreateBucket = async (bucketName: string) => {
  try {
    console.log(`Vérification de l'accès au bucket ${bucketName}...`);
    
    // Try to list files in the bucket to check if it exists and is accessible
    const { data, error } = await supabase.storage.from(bucketName).list('', {
      limit: 1,
      offset: 0,
    });
    
    if (error) {
      console.warn(`Erreur lors de l'accès au bucket ${bucketName}:`, error.message);
      
      // If bucket doesn't exist or we don't have access, try to create it
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        await createBucket(bucketName);
      } else if (error.message.includes('violates row-level security policy')) {
        console.warn(`Problème de permission pour accéder au bucket ${bucketName}. Utilisation du stockage local.`);
      }
    } else {
      console.log(`Accès réussi au bucket ${bucketName}. Fichiers disponibles:`, data?.length || 0);
    }
  } catch (error) {
    console.warn(`Exception lors de l'accès au bucket ${bucketName}:`, error);
  }
};

// Helper function to create a bucket
const createBucket = async (bucketName: string) => {
  try {
    console.log(`Tentative de création du bucket ${bucketName}...`);
    
    const { error } = await supabase.storage.createBucket(bucketName, { 
      public: true,
      fileSizeLimit: 5242880 // 5MB limit
    });
    
    if (error) {
      console.warn(`Erreur lors de la création du bucket ${bucketName}:`, error.message);
      
      if (error.message.includes('violates row-level security policy')) {
        console.warn(`Permissions insuffisantes pour créer le bucket ${bucketName}. Les PDFs seront stockés localement.`);
      }
    } else {
      console.log(`Bucket ${bucketName} créé avec succès!`);
    }
  } catch (error) {
    console.warn(`Exception lors de la création du bucket ${bucketName}:`, error);
  }
};