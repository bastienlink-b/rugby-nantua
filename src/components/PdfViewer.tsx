import React, { useEffect, useState } from 'react';
import { getPdf, createPdfBlobUrl, getPublicUrl } from '../services/PdfStorage';
import { convertDocxToPdf } from '../services/DocxService';
import { FileText, AlertCircle, Loader } from 'lucide-react';

interface PdfViewerProps {
  url: string;
  height?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, height = '600px' }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) {
      setError('URL non fournie');
      setLoading(false);
      return;
    }

    // Function to handle local PDF files
    const handleLocalPdf = async () => {
      // Extract filename from URL (e.g., /templates/file.pdf -> file.pdf)
      const filename = url.split('/').pop();
      
      if (!filename) {
        setError('Nom de fichier non valide');
        setLoading(false);
        return;
      }

      try {
        // Récupérer le fichier du stockage (local ou Supabase)
        console.log(`Tentative de récupération du PDF: ${filename}`);
        const fileContent = await getPdf(filename);
        
        if (!fileContent) {
          // Si le fichier n'est pas trouvé localement, essayer d'utiliser l'URL publique Supabase
          console.log('Fichier non trouvé, tentative avec URL publique');
          const publicUrl = getPublicUrl(filename);
          setPdfUrl(publicUrl);
          setLoading(false);
          return;
        }

        console.log('Fichier trouvé, traitement...');
        
        // Handle Word documents
        if (fileContent.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,')) {
          console.log('Conversion du document Word en PDF...');
          const base64Data = fileContent.split('base64,')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const pdfBytes = await convertDocxToPdf(bytes.buffer);
          const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(pdfBlob);
          setPdfUrl(blobUrl);
        } else {
          // Handle PDF files
          console.log('Création de l\'URL de blob pour le PDF');
          const blobUrl = createPdfBlobUrl(fileContent);
          setPdfUrl(blobUrl);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors de la création de l\'URL du PDF:', err);
        setError('Erreur lors de la création de l\'URL du PDF');
        setLoading(false);
      }
    };

    // Function to handle external PDF files
    const handleExternalPdf = () => {
      // For external URLs, use them directly
      setPdfUrl(url);
      setLoading(false);
    };

    // Function to handle data URIs
    const handleDataUri = () => {
      setPdfUrl(url);
      setLoading(false);
    };

    // Check what kind of URL we're dealing with
    if (url.startsWith('data:')) {
      handleDataUri();
    } else if (url.startsWith('/templates/') || url.startsWith('/generated_pdfs/')) {
      handleLocalPdf();
    } else {
      handleExternalPdf();
    }

    // Cleanup function to revoke any blob URLs when component unmounts
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-100 rounded-md">
        <div className="text-gray-500 flex items-center">
          <Loader size={16} className="mr-2 animate-spin" />
          Chargement du PDF...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-gray-100 rounded-md p-4">
        <AlertCircle size={32} className="text-red-500 mb-2" />
        <div className="text-red-500 text-center">{error}</div>
        <p className="text-gray-500 text-sm mt-2">
          Vérifiez que le fichier existe et que l'URL est correcte.
        </p>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-100 rounded-md">
        <FileText size={32} className="text-gray-400 mr-2" />
        <div className="text-gray-500">PDF non disponible</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-md border border-gray-200">
      <iframe
        src={pdfUrl}
        width="100%"
        height={height}
        style={{ border: 'none' }}
        title="PDF Viewer"
      ></iframe>
    </div>
  );
};

export default PdfViewer;