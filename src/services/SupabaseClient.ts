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
      console.warn('Utilisateur non authentifié. Certaines fonctionnalités de stockage pourraient être limitées.');
      console.log('Les opérations de stockage utiliseront localStorage comme solution de repli.');
      return; // Sortir tôt si non authentifié
    } else {
      console.log('Utilisateur authentifié. Session active.');
    }

    console.log('Vérification de l\'accès aux buckets:', TEMPLATES_BUCKET, 'et', GENERATED_BUCKET);
    
    // Vérifier l'existence et l'accès aux buckets
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.warn('Erreur lors de la liste des buckets:', bucketError);
      // Si on ne peut pas lister les buckets, essayons quand même de les créer
      await createBucketsIfNeeded();
    } else {
      console.log('Buckets disponibles:', buckets?.map(b => b.name) || []);
      
      // Vérifier si les buckets nécessaires existent
      const templateBucketExists = buckets?.some(b => b.name === TEMPLATES_BUCKET);
      const generatedBucketExists = buckets?.some(b => b.name === GENERATED_BUCKET);
      
      console.log(`Le bucket ${TEMPLATES_BUCKET} existe: ${templateBucketExists ? 'Oui' : 'Non'}`);
      console.log(`Le bucket ${GENERATED_BUCKET} existe: ${generatedBucketExists ? 'Oui' : 'Non'}`);
      
      // Créer les buckets manquants
      if (!templateBucketExists || !generatedBucketExists) {
        await createBucketsIfNeeded(templateBucketExists, generatedBucketExists);
      }
    }
    
    // Vérifier l'accès aux buckets individuellement
    await verifyBucketsAccess();
    
  } catch (error) {
    console.error('Erreur d\'initialisation du stockage:', error);
    console.log('Les PDFs seront stockés localement uniquement.');
  }
};

// Helper function to create buckets if they don't exist
const createBucketsIfNeeded = async (templateBucketExists = false, generatedBucketExists = false) => {
  // Create template bucket if it doesn't exist
  if (!templateBucketExists) {
    try {
      console.log(`Tentative de création du bucket ${TEMPLATES_BUCKET}...`);
      const { error } = await supabase.storage.createBucket(TEMPLATES_BUCKET, { 
        public: true,
        fileSizeLimit: 5242880 // 5MB limit
      });
      
      if (error) {
        console.warn(`Erreur lors de la création du bucket ${TEMPLATES_BUCKET}:`, error);
      } else {
        console.log(`Bucket ${TEMPLATES_BUCKET} créé avec succès!`);
        
        // Set CORS policy for the bucket
        const { error: corsError } = await supabase.storage.getBucket(TEMPLATES_BUCKET);
        if (corsError) {
          console.warn(`Erreur lors de la configuration CORS pour ${TEMPLATES_BUCKET}:`, corsError);
        }
      }
    } catch (error) {
      console.warn(`Exception lors de la création du bucket ${TEMPLATES_BUCKET}:`, error);
    }
  }
  
  // Create generated PDFs bucket if it doesn't exist
  if (!generatedBucketExists) {
    try {
      console.log(`Tentative de création du bucket ${GENERATED_BUCKET}...`);
      const { error } = await supabase.storage.createBucket(GENERATED_BUCKET, { 
        public: true,
        fileSizeLimit: 5242880 // 5MB limit
      });
      
      if (error) {
        console.warn(`Erreur lors de la création du bucket ${GENERATED_BUCKET}:`, error);
      } else {
        console.log(`Bucket ${GENERATED_BUCKET} créé avec succès!`);
        
        // Set CORS policy for the bucket
        const { error: corsError } = await supabase.storage.getBucket(GENERATED_BUCKET);
        if (corsError) {
          console.warn(`Erreur lors de la configuration CORS pour ${GENERATED_BUCKET}:`, corsError);
        }
      }
    } catch (error) {
      console.warn(`Exception lors de la création du bucket ${GENERATED_BUCKET}:`, error);
    }
  }
};

// Helper function to verify access to buckets
const verifyBucketsAccess = async () => {
  for (const bucket of [TEMPLATES_BUCKET, GENERATED_BUCKET]) {
    try {
      console.log(`Vérification de l'accès au bucket ${bucket}...`);
      const { data, error } = await supabase.storage.from(bucket).list('', {
        limit: 1,
        offset: 0,
      });
      
      if (error) {
        console.warn(`Erreur lors de l'accès au bucket ${bucket}:`, error);
        // If error.message includes "The resource was not found", the bucket doesn't exist
        if (error.message && error.message.includes('not found')) {
          console.log(`Le bucket ${bucket} n'existe pas, nouvelle tentative de création...`);
          await createBucketsIfNeeded(bucket !== TEMPLATES_BUCKET, bucket !== GENERATED_BUCKET);
        }
      } else {
        console.log(`Accès réussi au bucket ${bucket}. Fichiers disponibles:`, data?.length || 0);
      }
    } catch (error) {
      console.warn(`Exception lors de l'accès au bucket ${bucket}:`, error);
    }
  }
};