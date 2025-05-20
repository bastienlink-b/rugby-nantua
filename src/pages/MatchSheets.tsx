import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Plus, Search, FileText, Check, ArrowLeft, Download, ChevronDown, ChevronUp, X, User, Award, Loader, Edit
} from 'lucide-react';
import PdfViewer from '../components/PdfViewer';
import { getPdf, createPdfBlobUrl } from './PdfStorage';
import { generateAndDownloadMatchSheet } from '../services/PdfExportService';

const MatchSheets: React.FC = () => {
  const { matchSheets, tournaments, templates, players, coaches, deleteMatchSheet } = useAppContext();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    // Check for tournament filter in URL params
    const tournamentId = searchParams.get('tournamentId');
    if (tournamentId) {
      setSelectedTournamentId(tournamentId);
    }
  }, [searchParams]);

  const handlePreviewMatchSheet = async (matchSheet: any) => {
    try {
      setIsGenerating(matchSheet.id);

      // Si la feuille de match a déjà un PDF généré, l'utiliser
      if (matchSheet.pdfUrl) {
        console.log("Utilisation du PDF déjà généré:", matchSheet.pdfUrl);
        
        // Extraire le nom du fichier depuis l'URL
        const fileName = matchSheet.pdfUrl.split('/').pop();
        
        if (fileName) {
          try {
            // Récupérer le PDF du stockage
            const pdfContent = await getPdf(fileName);
            
            if (pdfContent) {
              // Créer une URL pour l'affichage
              const blobUrl = createPdfBlobUrl(pdfContent);
              setPreviewUrl(blobUrl);
              
              // Stocker le template pour les références
              const template = templates.find(t => t.id === matchSheet.templateId);
              if (template) {
                setSelectedTemplate(template.id);
              }
              
              setIsGenerating(null);
              return;
            }
          } catch (error) {
            console.warn("Erreur lors de la récupération du PDF stocké, génération à la volée:", error);
            // En cas d'erreur, continuer avec la génération à la volée
          }
        }
      }

      // Si pas de PDF ou erreur, générer à la volée
      const template = templates.find(t => t.id === matchSheet.templateId);
      const tournament = tournaments.find(t => t.id === matchSheet.tournamentId);
      
      if (!template || !template.fileUrl) {
        alert('Template not found or has no file associated.');
        setIsGenerating(null);
        return;
      }
      
      const selectedPlayers = players.filter(p => matchSheet.playerIds.includes(p.id));
      const selectedCoaches = coaches.filter(c => matchSheet.coachIds.includes(c.id));
      
      // Generate the preview PDF
      const pdfBytes = await generateAndDownloadMatchSheet(
        matchSheet.templateId,
        matchSheet.tournamentId,
        selectedPlayers,
        selectedCoaches,
        matchSheet.referentCoachId,
        template,
        tournament,
        true // preview mode - don't trigger download
      );
      
      // Convert PDF bytes to base64 and create blob URL
      const base64Pdf = btoa(
        Array.from(new Uint8Array(pdfBytes))
          .map(byte => String.fromCharCode(byte))
          .join('')
      );
      const pdfDataUri = `data:application/pdf;base64,${base64Pdf}`;
      setPreviewUrl(pdfDataUri);
      setSelectedTemplate(template.id);
    } catch (error) {
      console.error('Error previewing match sheet:', error);
      alert('Failed to preview match sheet.');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDownloadMatchSheet = async (matchSheet: any) => {
    try {
      setIsGenerating(matchSheet.id);
      
      // Si la feuille de match a déjà un PDF généré, l'utiliser
      if (matchSheet.pdfUrl) {
        console.log("Téléchargement du PDF déjà généré:", matchSheet.pdfUrl);
        
        // Extraire le nom du fichier depuis l'URL
        const fileName = matchSheet.pdfUrl.split('/').pop();
        
        if (fileName) {
          try {
            // Récupérer le PDF du stockage
            const pdfContent = await getPdf(fileName);
            
            if (pdfContent) {
              // Créer une URL pour le téléchargement
              const blobUrl = createPdfBlobUrl(pdfContent);
              
              // Télécharger le fichier
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
              
              setIsGenerating(null);
              return;
            }
          } catch (error) {
            console.warn("Erreur lors de la récupération du PDF stocké, génération à la volée:", error);
            // En cas d'erreur, continuer avec la génération à la volée
          }
        }
      }
      
      // Find the related template and tournament
      const template = templates.find(t => t.id === matchSheet.templateId);
      const tournament = tournaments.find(t => t.id === matchSheet.tournamentId);
      
      if (!template || !tournament) {
        alert('Template or tournament not found.');
        setIsGenerating(null);
        return;
      }
      
      // Get the selected players and coaches for this match sheet
      const selectedPlayers = players.filter(p => matchSheet.playerIds.includes(p.id));
      const selectedCoaches = coaches.filter(c => matchSheet.coachIds.includes(c.id));
      
      // Generate and download the PDF
      await generateAndDownloadMatchSheet(
        matchSheet.templateId,
        matchSheet.tournamentId,
        selectedPlayers,
        selectedCoaches,
        matchSheet.referentCoachId,
        template,
        tournament
      );
    } catch (error) {
      console.error('Error downloading match sheet:', error);
      alert('Failed to download match sheet.');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleDeleteMatchSheet = async (id: string, locationName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la feuille de match pour "${locationName}" ?`)) {
      setIsDeleting(id);
      try {
        await deleteMatchSheet(id);
        // Reset preview if the deleted match sheet was being previewed
        if (previewUrl) {
          setPreviewUrl(null);
          setSelectedTemplate(null);
        }
      } catch (error) {
        console.error('Error deleting match sheet:', error);
        alert('Failed to delete match sheet.');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter match sheets by search term and tournament
  const filteredMatchSheets = matchSheets.filter(sheet => {
    const tournament = tournaments.find(t => t.id === sheet.tournamentId);
    const tournamentName = tournament ? tournament.location : '';
    
    const matchesSearch = tournamentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTournament = selectedTournamentId ? sheet.tournamentId === selectedTournamentId : true;
    
    return matchesSearch && matchesTournament;
  });

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feuilles de Match</h1>
          <p className="text-gray-600 mt-1">
            Gérez et générez des feuilles de match pour les tournois
          </p>
        </div>
        <Link
          to="/match-sheets/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        >
          <Plus size={18} className="mr-1" />
          <span>Nouvelle feuille</span>
        </Link>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un tournoi..."
            className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-1/3">
          <select
            className="w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
          >
            <option value="">Tous les tournois</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.location} - {new Date(tournament.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">Feuilles disponibles</h2>
            </div>
            
            {filteredMatchSheets.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredMatchSheets.map((sheet) => {
                  const tournament = tournaments.find(t => t.id === sheet.tournamentId);
                  const template = templates.find(t => t.id === sheet.templateId);
                  
                  return (
                    <div key={sheet.id} className="p-4">
                      <div 
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => toggleExpand(sheet.id)}
                      >
                        <div className="flex items-center">
                          <FileText size={18} className="text-blue-500 mr-2" />
                          <span className="font-medium">
                            {tournament ? tournament.location : 'Tournoi inconnu'}
                          </span>
                        </div>
                        {expandedItems[sheet.id] ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </div>
                      
                      {expandedItems[sheet.id] && (
                        <div className="mt-3 pl-6">
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Date:</span> {' '}
                            {tournament ? new Date(tournament.date).toLocaleDateString() : 'N/A'}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Modèle:</span> {' '}
                            {template ? template.name : 'N/A'}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Joueurs:</span> {' '}
                            {sheet.playerIds.length}
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">PDF:</span> {' '}
                            {sheet.pdfUrl ? 'Généré' : 'Non généré'}
                          </p>
                          <p className="text-sm text-gray-600 mb-3">
                            <span className="font-medium">Créée le:</span> {' '}
                            {sheet.createdAt.toLocaleDateString()}
                          </p>
                          
                          {/* Améliorations UI des boutons d'actions */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Aperçu */}
                            <button
                              className="w-full text-sm bg-blue-100 text-blue-700 px-3 py-2 rounded-md flex items-center justify-center hover:bg-blue-200 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewMatchSheet(sheet);
                              }}
                              disabled={isGenerating === sheet.id}
                            >
                              {isGenerating === sheet.id ? (
                                <Loader size={14} className="mr-1.5 animate-spin" />
                              ) : (
                                <FileText size={14} className="mr-1.5" />
                              )}
                              Aperçu
                            </button>
                            
                            {/* Télécharger */}
                            <button
                              className="w-full text-sm bg-green-100 text-green-700 px-3 py-2 rounded-md flex items-center justify-center hover:bg-green-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadMatchSheet(sheet);
                              }}
                              disabled={isGenerating === sheet.id}
                            >
                              {isGenerating === sheet.id ? (
                                <Loader size={14} className="mr-1.5 animate-spin" />
                              ) : (
                                <Download size={14} className="mr-1.5" />
                              )}
                              Télécharger
                            </button>
                            
                            {/* Éditer */}
                            <Link 
                              to={`/match-sheets/edit/${sheet.id}`}
                              className="w-full text-sm bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md flex items-center justify-center hover:bg-indigo-200 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit size={14} className="mr-1.5" />
                              Éditer
                            </Link>
                            
                            {/* Supprimer */}
                            <button
                              className="w-full text-sm bg-red-100 text-red-700 px-3 py-2 rounded-md flex items-center justify-center hover:bg-red-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMatchSheet(sheet.id, tournament?.location || 'Inconnu');
                              }}
                              disabled={isDeleting === sheet.id}
                            >
                              {isDeleting === sheet.id ? (
                                <Loader size={14} className="mr-1.5 animate-spin" />
                              ) : (
                                <X size={14} className="mr-1.5" />
                              )}
                              Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune feuille trouvée</h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm || selectedTournamentId
                    ? "Aucune feuille ne correspond aux critères de recherche."
                    : "Commencez par créer votre première feuille de match."}
                </p>
                {!searchTerm && !selectedTournamentId && (
                  <Link
                    to="/match-sheets/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={18} className="mr-2" />
                    Créer une feuille
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {previewUrl ? (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full">
              <div className="p-4 border-b flex justify-between items-center">
                <div className="flex items-center">
                  <button 
                    onClick={() => {
                      setPreviewUrl(null);
                      setSelectedTemplate(null);
                    }}
                    className="mr-3 text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-medium">
                    {templates.find(t => t.id === selectedTemplate)?.name || 'Aperçu de la feuille'}
                  </h2>
                </div>
              </div>
              <div className="p-4">
                <PdfViewer url={previewUrl} height="600px" />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center h-full min-h-[600px]">
              <FileText size={64} className="text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aperçu de la feuille de match</h3>
              <p className="text-gray-500 text-center max-w-md">
                Sélectionnez une feuille de match dans la liste pour afficher son aperçu ici.
                Vous pourrez ensuite la télécharger ou l'imprimer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchSheets;