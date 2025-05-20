import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, Coach, Tournament, MatchSheet, AgeCategory, Template, PdfFieldMapping } from '../types';
import * as supabaseService from '../services/supabase';

interface AppContextType {
  players: Player[];
  coaches: Coach[];
  tournaments: Tournament[];
  matchSheets: MatchSheet[];
  ageCategories: AgeCategory[];
  templates: Template[];
  loading: boolean;
  error: string | null;
  
  addPlayer: (player: Player) => Promise<void>;
  updatePlayer: (id: string, player: Player) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  
  addCoach: (coach: Coach) => Promise<void>;
  updateCoach: (id: string, coach: Coach) => Promise<void>;
  deleteCoach: (id: string) => Promise<void>;
  
  addTournament: (tournament: Tournament) => Promise<void>;
  updateTournament: (id: string, tournament: Tournament) => Promise<void>;
  deleteTournament: (id: string) => Promise<void>;
  
  addMatchSheet: (matchSheet: MatchSheet) => Promise<void>;
  updateMatchSheet: (id: string, matchSheet: MatchSheet) => Promise<void>;
  deleteMatchSheet: (id: string) => Promise<void>;
  
  addTemplate: (template: Template) => Promise<void>;
  updateTemplate: (id: string, template: Template) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper function to map data from Supabase to our App types
const mapAgeCategoryFromSupabase = (category: any): AgeCategory => ({
  id: category.id,
  name: category.name,
  description: category.description || ''
});

const mapPlayerFromSupabase = (player: any): Player => ({
  id: player.id,
  firstName: player.first_name,
  lastName: player.last_name,
  dateOfBirth: player.date_of_birth,
  licenseNumber: player.license_number,
  canPlayForward: player.can_play_forward,
  canReferee: player.can_referee,
  ageCategoryId: player.age_category_id,
});

const mapCoachFromSupabase = (coach: any): Coach => ({
  id: coach.id,
  firstName: coach.first_name,
  lastName: coach.last_name,
  licenseNumber: coach.license_number || '',
  diploma: coach.diploma || '',
  ageCategoryIds: coach.coach_categories?.map((cc: any) => cc.age_category_id) || [],
});

const mapTournamentFromSupabase = (tournament: any): Tournament => ({
  id: tournament.id,
  date: tournament.date,
  location: tournament.location,
  ageCategoryIds: tournament.tournament_categories?.map((tc: any) => tc.age_category_id) || [],
});

const mapTemplateFromSupabase = (template: any): Template => ({
  id: template.id,
  name: template.name,
  description: template.description || '',
  fileUrl: template.file_url,
  ageCategoryIds: template.template_categories?.map((tc: any) => tc.age_category_id) || [],
  fieldMappings: template.field_mappings as PdfFieldMapping[] || [],
});

const mapMatchSheetFromSupabase = (matchSheet: any): MatchSheet => ({
  id: matchSheet.id,
  tournamentId: matchSheet.tournament_id,
  templateId: matchSheet.template_id,
  ageCategoryId: matchSheet.age_category_id,
  referentCoachId: matchSheet.referent_coach_id,
  playerIds: matchSheet.match_sheet_players?.map((msp: any) => msp.player_id) || [],
  coachIds: matchSheet.match_sheet_coaches?.map((msc: any) => msc.coach_id) || [],
  pdfUrl: matchSheet.pdf_url, // Ajout du champ pdfUrl
  createdAt: new Date(matchSheet.created_at),
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matchSheets, setMatchSheets] = useState<MatchSheet[]>([]);
  const [ageCategories, setAgeCategories] = useState<AgeCategory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("-- FETCHING APPLICATION DATA --");
      
      // Fetch age categories
      console.log("Fetching age categories...");
      const ageCategoriesData = await supabaseService.getAgeCategories();
      console.log(`Retrieved ${ageCategoriesData.length} age categories from Supabase`);
      setAgeCategories(ageCategoriesData.map(mapAgeCategoryFromSupabase));
      
      // Fetch players
      console.log("Fetching players...");
      const playersData = await supabaseService.getPlayers();
      console.log(`Retrieved ${playersData.length} players from Supabase`);
      const mappedPlayers = playersData.map(mapPlayerFromSupabase);
      setPlayers(mappedPlayers);
      console.log("Players set in state:", mappedPlayers.length);
      
      // Fetch coaches
      console.log("Fetching coaches...");
      const coachesData = await supabaseService.getCoaches();
      console.log(`Retrieved ${coachesData.length} coaches from Supabase`);
      const mappedCoaches = coachesData.map(mapCoachFromSupabase);
      setCoaches(mappedCoaches);
      console.log("Coaches set in state:", mappedCoaches.length);
      
      // Fetch tournaments
      console.log("Fetching tournaments...");
      const tournamentsData = await supabaseService.getTournaments();
      console.log(`Retrieved ${tournamentsData.length} tournaments from Supabase`);
      setTournaments(tournamentsData.map(mapTournamentFromSupabase));
      
      // Fetch templates
      console.log("Fetching templates...");
      const templatesData = await supabaseService.getTemplates();
      console.log(`Retrieved ${templatesData.length} templates from Supabase`);
      setTemplates(templatesData.map(mapTemplateFromSupabase));
      
      // Fetch match sheets
      console.log("Fetching match sheets...");
      const matchSheetsData = await supabaseService.getMatchSheets();
      console.log(`Retrieved ${matchSheetsData.length} match sheets from Supabase`);
      setMatchSheets(matchSheetsData.map(mapMatchSheetFromSupabase));
      
      console.log("Data fetching complete.");
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchData();
  }, []);

  const addPlayer = async (player: Player) => {
    try {
      setError(null);
      const newPlayer = await supabaseService.addPlayer({
        first_name: player.firstName,
        last_name: player.lastName,
        date_of_birth: player.dateOfBirth,
        license_number: player.licenseNumber,
        can_play_forward: player.canPlayForward,
        can_referee: player.canReferee,
        age_category_id: player.ageCategoryId,
      });
      
      if (newPlayer) {
        setPlayers(prev => [...prev, mapPlayerFromSupabase(newPlayer)]);
      }
    } catch (err) {
      console.error('Error adding player:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'ajout du joueur.');
      throw err;
    }
  };

  const updatePlayer = async (id: string, player: Player) => {
    try {
      setError(null);
      const updatedPlayer = await supabaseService.updatePlayer(id, {
        first_name: player.firstName,
        last_name: player.lastName,
        date_of_birth: player.dateOfBirth,
        license_number: player.licenseNumber,
        can_play_forward: player.canPlayForward,
        can_referee: player.canReferee,
        age_category_id: player.ageCategoryId,
      });
      
      if (updatedPlayer) {
        setPlayers(prev => prev.map(p => p.id === id ? mapPlayerFromSupabase(updatedPlayer) : p));
      }
    } catch (err) {
      console.error('Error updating player:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour du joueur.');
      throw err;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      setError(null);
      await supabaseService.deletePlayer(id);
      setPlayers(prev => prev.filter(player => player.id !== id));
    } catch (err) {
      console.error('Error deleting player:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression du joueur.');
      throw err;
    }
  };

  const addCoach = async (coach: Coach) => {
    try {
      setError(null);
      const newCoach = await supabaseService.addCoach(
        {
          first_name: coach.firstName,
          last_name: coach.lastName,
          license_number: coach.licenseNumber,
          diploma: coach.diploma,
        },
        coach.ageCategoryIds
      );
      
      if (newCoach) {
        const mappedCoach: Coach = {
          ...mapCoachFromSupabase(newCoach),
          ageCategoryIds: coach.ageCategoryIds
        };
        setCoaches(prev => [...prev, mappedCoach]);
      }
    } catch (err) {
      console.error('Error adding coach:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'ajout de l\'entraîneur.');
      throw err;
    }
  };

  const updateCoach = async (id: string, coach: Coach) => {
    try {
      setError(null);
      const updatedCoach = await supabaseService.updateCoach(
        id,
        {
          first_name: coach.firstName,
          last_name: coach.lastName,
          license_number: coach.licenseNumber,
          diploma: coach.diploma,
        },
        coach.ageCategoryIds
      );
      
      if (updatedCoach) {
        const mappedCoach: Coach = {
          ...mapCoachFromSupabase(updatedCoach),
          ageCategoryIds: coach.ageCategoryIds
        };
        setCoaches(prev => prev.map(c => c.id === id ? mappedCoach : c));
      }
    } catch (err) {
      console.error('Error updating coach:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour de l\'entraîneur.');
      throw err;
    }
  };

  const deleteCoach = async (id: string) => {
    try {
      setError(null);
      await supabaseService.deleteCoach(id);
      setCoaches(prev => prev.filter(coach => coach.id !== id));
    } catch (err) {
      console.error('Error deleting coach:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression de l\'entraîneur.');
      throw err;
    }
  };

  const addTournament = async (tournament: Tournament) => {
    try {
      setError(null);
      const newTournament = await supabaseService.addTournament(
        {
          date: tournament.date,
          location: tournament.location,
        },
        tournament.ageCategoryIds
      );
      
      if (newTournament) {
        const mappedTournament: Tournament = {
          ...mapTournamentFromSupabase(newTournament),
          ageCategoryIds: tournament.ageCategoryIds
        };
        setTournaments(prev => [...prev, mappedTournament]);
      }
    } catch (err) {
      console.error('Error adding tournament:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'ajout du tournoi.');
      throw err;
    }
  };

  const updateTournament = async (id: string, tournament: Tournament) => {
    try {
      setError(null);
      const updatedTournament = await supabaseService.updateTournament(
        id,
        {
          date: tournament.date,
          location: tournament.location,
        },
        tournament.ageCategoryIds
      );
      
      if (updatedTournament) {
        const mappedTournament: Tournament = {
          ...mapTournamentFromSupabase(updatedTournament),
          ageCategoryIds: tournament.ageCategoryIds
        };
        setTournaments(prev => prev.map(t => t.id === id ? mappedTournament : t));
      }
    } catch (err) {
      console.error('Error updating tournament:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour du tournoi.');
      throw err;
    }
  };

  const deleteTournament = async (id: string) => {
    try {
      setError(null);
      await supabaseService.deleteTournament(id);
      setTournaments(prev => prev.filter(tournament => tournament.id !== id));
    } catch (err) {
      console.error('Error deleting tournament:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression du tournoi.');
      throw err;
    }
  };

  const addTemplate = async (template: Template) => {
    try {
      setError(null);
      const newTemplate = await supabaseService.addTemplate(
        {
          name: template.name,
          description: template.description,
          file_url: template.fileUrl,
          field_mappings: template.fieldMappings,
        },
        template.ageCategoryIds
      );
      
      if (newTemplate) {
        const mappedTemplate: Template = {
          ...mapTemplateFromSupabase(newTemplate),
          ageCategoryIds: template.ageCategoryIds,
          fieldMappings: template.fieldMappings
        };
        setTemplates(prev => [...prev, mappedTemplate]);
      }
    } catch (err) {
      console.error('Error adding template:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'ajout du modèle.');
      throw err;
    }
  };

  const updateTemplate = async (id: string, template: Template) => {
    try {
      setError(null);
      const updatedTemplate = await supabaseService.updateTemplate(
        id,
        {
          name: template.name,
          description: template.description,
          file_url: template.fileUrl,
          field_mappings: template.fieldMappings,
        },
        template.ageCategoryIds
      );
      
      if (updatedTemplate) {
        const mappedTemplate: Template = {
          ...mapTemplateFromSupabase(updatedTemplate),
          ageCategoryIds: template.ageCategoryIds,
          fieldMappings: template.fieldMappings
        };
        setTemplates(prev => prev.map(t => t.id === id ? mappedTemplate : t));
      }
    } catch (err) {
      console.error('Error updating template:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour du modèle.');
      throw err;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      setError(null);
      await supabaseService.deleteTemplate(id);
      setTemplates(prev => prev.filter(template => template.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression du modèle.');
      throw err;
    }
  };

  const addMatchSheet = async (matchSheet: MatchSheet) => {
    try {
      setError(null);
      const newMatchSheet = await supabaseService.addMatchSheet(
        {
          tournament_id: matchSheet.tournamentId,
          template_id: matchSheet.templateId,
          age_category_id: matchSheet.ageCategoryId,
          referent_coach_id: matchSheet.referentCoachId,
          pdf_url: matchSheet.pdfUrl, // Ajout du champ pdfUrl
        },
        matchSheet.playerIds,
        matchSheet.coachIds
      );
      
      if (newMatchSheet) {
        const mappedMatchSheet: MatchSheet = {
          ...mapMatchSheetFromSupabase(newMatchSheet),
          playerIds: matchSheet.playerIds,
          coachIds: matchSheet.coachIds,
          pdfUrl: matchSheet.pdfUrl, // Conserver le pdfUrl
        };
        setMatchSheets(prev => [...prev, mappedMatchSheet]);
      }
    } catch (err) {
      console.error('Error adding match sheet:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'ajout de la feuille de match.');
      throw err;
    }
  };

  const updateMatchSheet = async (id: string, matchSheet: MatchSheet) => {
    try {
      setError(null);
      const updatedMatchSheet = await supabaseService.updateMatchSheet(
        id,
        {
          tournament_id: matchSheet.tournamentId,
          template_id: matchSheet.templateId,
          age_category_id: matchSheet.ageCategoryId,
          referent_coach_id: matchSheet.referentCoachId,
          pdf_url: matchSheet.pdfUrl, // Ajout du champ pdfUrl
        },
        matchSheet.playerIds,
        matchSheet.coachIds
      );
      
      if (updatedMatchSheet) {
        const mappedMatchSheet: MatchSheet = {
          ...mapMatchSheetFromSupabase(updatedMatchSheet),
          playerIds: matchSheet.playerIds,
          coachIds: matchSheet.coachIds,
          pdfUrl: matchSheet.pdfUrl, // Conserver le pdfUrl
        };
        setMatchSheets(prev => prev.map(ms => ms.id === id ? mappedMatchSheet : ms));
      }
    } catch (err) {
      console.error('Error updating match sheet:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour de la feuille de match.');
      throw err;
    }
  };

  const deleteMatchSheet = async (id: string) => {
    try {
      setError(null);
      await supabaseService.deleteMatchSheet(id);
      setMatchSheets(prev => prev.filter(matchSheet => matchSheet.id !== id));
    } catch (err) {
      console.error('Error deleting match sheet:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression de la feuille de match.');
      throw err;
    }
  };

  const refreshData = async () => {
    await fetchData();
  };

  return (
    <AppContext.Provider
      value={{
        players,
        coaches,
        tournaments,
        matchSheets,
        ageCategories,
        templates,
        loading,
        error,
        addPlayer,
        updatePlayer,
        deletePlayer,
        addCoach,
        updateCoach,
        deleteCoach,
        addTournament,
        updateTournament,
        deleteTournament,
        addMatchSheet,
        updateMatchSheet,
        deleteMatchSheet,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};