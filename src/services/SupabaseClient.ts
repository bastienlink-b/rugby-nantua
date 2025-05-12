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

    console.log('Vérification de l\'accès au bucket:', TEMPLATES_BUCKET);
    
    // Check if we can access the bucket directly
    try {
      const { data: fileList, error: fileListError } = await supabase.storage
        .from(TEMPLATES_BUCKET)
        .list();
        
      if (fileListError) {
        // Amélioration de la détection des erreurs RLS
        if (fileListError.message?.includes('policy') || fileListError.message?.includes('Unauthorized') || 
            fileListError.status === 403 || fileListError.status === 400) {
          console.warn(`Erreur RLS: Accès non autorisé au bucket ${TEMPLATES_BUCKET}. Utilisation du stockage local uniquement.`);
          console.log('Assurez-vous que les politiques RLS sont correctement configurées dans Supabase.');
          console.log('Vérifiez que l\'utilisateur a des autorisations suffisantes pour accéder au bucket.');
          return; // Sortir tôt en cas d'erreur RLS
        }
        
        // Try to list the root folder (works with or without creating the bucket)
        console.log('Tentative de liste des buckets disponibles...');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          // Amélioration de la détection des erreurs RLS
          if (bucketsError.message?.includes('policy') || bucketsError.message?.includes('Unauthorized') || 
              bucketsError.status === 403 || bucketsError.status === 400) {
            console.warn('Erreur RLS: Accès non autorisé pour lister les buckets. Utilisation du stockage local uniquement.');
            return; // Sortir tôt en cas d'erreur RLS
          } else {
            console.warn('Erreur lors de la liste des buckets:', bucketsError);
          }
        } else {
          console.log('Buckets disponibles:', buckets?.map(b => b.name) || []);
          
          // Check if our target bucket exists
          const bucketExists = buckets?.some(b => b.name === TEMPLATES_BUCKET);
          console.log(`Le bucket ${TEMPLATES_BUCKET} existe: ${bucketExists ? 'Oui' : 'Non'}`);
          
          if (!bucketExists) {
            console.log(`Le bucket ${TEMPLATES_BUCKET} n'existe pas. Les PDFs seront stockés localement uniquement.`);
            console.log('Les utilisateurs avec des privilèges d\'administrateur peuvent créer ce bucket dans la console Supabase.');
          }
        }
      } else {
        console.log(`Accès réussi au bucket ${TEMPLATES_BUCKET}. Fichiers disponibles:`, 
          fileList?.map(f => f.name) || []);
      }
    } catch (error) {
      console.warn('Erreur inattendue lors de l\'accès au bucket:', error);
      console.log('Les PDFs seront stockés localement uniquement.');
    }
    
    // We don't attempt to create buckets anymore as it requires admin privileges
    // Instead, we just adapt to work with what's available
    
  } catch (error) {
    console.error('Erreur d\'initialisation du stockage:', error);
    console.log('Les PDFs seront stockés localement uniquement.');
  }
};