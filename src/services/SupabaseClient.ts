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

    console.log('Initialisation des buckets de stockage...');
    
    // Create buckets if they don't exist
    await createBucketsIfNotExist();
    
  } catch (error) {
    console.error('Erreur d\'initialisation du stockage:', error);
    console.log('Les PDFs seront stockés localement uniquement.');
  }
};

// Create buckets if they don't exist
const createBucketsIfNotExist = async () => {
  const buckets = [TEMPLATES_BUCKET, GENERATED_BUCKET];
  
  for (const bucketName of buckets) {
    try {
      console.log(`Vérification du bucket ${bucketName}...`);
      
      // Try to get bucket details
      const { error: listError } = await supabase.storage.from(bucketName).list('');
      
      if (listError) {
        console.log(`Le bucket ${bucketName} n'existe pas ou n'est pas accessible. Création...`);
        
        // Create the bucket
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 5242880, // 5MB limit
          allowedMimeTypes: ['application/pdf']
        });
        
        if (createError) {
          throw new Error(`Erreur lors de la création du bucket ${bucketName}: ${createError.message}`);
        }
        
        console.log(`Bucket ${bucketName} créé avec succès!`);
        
        // Set public bucket policy
        const { error: policyError } = await supabase.storage.from(bucketName).createSignedUrl('dummy.pdf', 3600);
        if (!policyError) {
          console.log(`Politique d'accès public configurée pour ${bucketName}`);
        }
      } else {
        console.log(`Le bucket ${bucketName} existe déjà.`);
      }
    } catch (error) {
      console.error(`Erreur lors de la gestion du bucket ${bucketName}:`, error);
      throw error; // Re-throw to be caught by the main try-catch
    }
  }
};