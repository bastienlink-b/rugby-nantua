import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Plus, Search, FileText, Check, ArrowLeft, Download, ChevronDown, ChevronUp, X, User, Award, Loader
} from 'lucide-react';
import PdfViewer from '../components/PdfViewer';
import { getPdf, createPdfBlobUrl } from '../services/PdfStorage';
import { generateAndDownloadMatchSheet } from '../services/PdfExportService';

const MatchSheets: React.FC = () => {
  const { matchSheets, tournaments, templates, players, coaches } = useAppContext();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  useEffect(() => {
    // Check for tournament filter in URL params
    const tournamentId = searchParams.get('tournamentId');
    if (tournamentId) {
      setSelectedTournamentId(tournamentId);
    }
  }, [searchParams]);

  const handlePreviewMatchSheet = async (matchSheet: any) => {
    try {
      // Find the related template and tournament
      const template = templates.find(t => t.id === matchSheet.templateId);
      const tournament = tournaments.find(t => t.id === matchSheet.tournamentId);
      
      if (!template || !template.fileUrl) {
        alert('Template not found or has no file associated.');
        return;
      }
      
      // Get the selected players and coaches for this match sheet
      const selectedPlayers = players.filter(p => matchSheet.playerIds.includes(p.id));
      const selectedCoaches = coaches.filter(c => matchSheet.coachIds.includes(c.id));
      
      // Set the preview URL to the template PDF for now
      // In a real implementation, we would generate a filled PDF on the fly
      setPreviewUrl(template.fileUrl);
      setSelectedTemplate(template.id);
    } catch (error) {
      console.error('Error previewing match sheet:', error);
      alert('Failed to preview match sheet.');
    }
  };

  const handleDownloadMatchSheet = async (matchSheet: any) => {
    try {
      setIsGenerating(matchSheet.id);
      
      // Find the related template and tournament
      const template = templates.find(t => t.id === matchSheet.templateId);
      const tournament = tournaments.find(t => t.id === matchSheet.tournamentId);
      
      if (!template || !tournament) {
        alert('Template or tournament not found.');
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
          to="/match-sheets/create" // This would be the route to create a new match sheet
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
                          <p className="text-sm text-gray-600 mb-3">
                            <span className="font-medium">Créée le:</span> {' '}
                            {sheet.createdAt.toLocaleDateString()}
                          </p>
                          
                          <div className="flex space-x-2">
                            <button
                              className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md flex items-center"
                              onClick={() => handlePreviewMatchSheet(sheet)}
                            >
                              <FileText size={14} className="mr-1" /> Aperçu
                            </button>
                            {isGenerating === sheet.id ? (
                              <button
                                className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-md flex items-center cursor-not-allowed opacity-75"
                                disabled
                              >
                                <Loader size={14} className="mr-1 animate-spin" /> Génération...
                              </button>
                            ) : (
                              <button
                                className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-md flex items-center hover:bg-green-200"
                                onClick={() => handleDownloadMatchSheet(sheet)}
                              >
                                <Download size={14} className="mr-1" /> Télécharger
                              </button>
                            )}
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