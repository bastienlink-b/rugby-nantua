import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Get the URL and anon key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

// Create a single supabase client for the whole app
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Check authentication on init
(async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error checking auth session:', error);
  } else {
    console.log('Auth session check: ', data.session ? 'Authenticated' : 'Not authenticated');
  }
})();

// Helper functions for data access

// Age Categories
export const getAgeCategories = async () => {
  console.log('Fetching age categories from Supabase');
  const { data, error } = await supabase
    .from('age_categories')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching age categories:', error);
    if (error.code === 'PGRST301' || error.message.includes('JWT')) {
      console.warn('Authentication error when fetching age categories. Check if you are logged in.');
    }
    throw error;
  }
  console.log(`Successfully fetched ${data?.length || 0} age categories`);
  return data || [];
};

// Players
export const getPlayers = async () => {
  console.log('Fetching players from Supabase');
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*, age_categories(*)')
      .order('last_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching players:', error);
      if (error.code === 'PGRST301' || error.message.includes('JWT')) {
        console.warn('Authentication error when fetching players. Check if you are logged in.');
      }
      throw error;
    }
    
    console.log(`Successfully fetched ${data?.length || 0} players`);
    return data || [];
  } catch (error) {
    console.error('Exception during players fetch:', error);
    throw error;
  }
};

export const getPlayersByCategory = async (categoryId: string) => {
  console.log(`Fetching players for category ${categoryId}`);
  const { data, error } = await supabase
    .from('players')
    .select('*, age_categories(*)')
    .eq('age_category_id', categoryId)
    .order('last_name', { ascending: true });
  
  if (error) {
    console.error('Error fetching players by category:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} players for category ${categoryId}`);
  return data || [];
};

export const addPlayer = async (player: {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  license_number: string;
  can_play_forward: boolean;
  can_referee: boolean;
  age_category_id: string;
}) => {
  console.log('Adding new player:', player);
  const { data, error } = await supabase
    .from('players')
    .insert([player])
    .select();
  
  if (error) {
    console.error('Error adding player:', error);
    throw error;
  }
  
  console.log('Player added successfully:', data?.[0]);
  return data?.[0];
};

export const updatePlayer = async (id: string, player: {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  license_number?: string;
  can_play_forward?: boolean;
  can_referee?: boolean;
  age_category_id?: string;
}) => {
  console.log(`Updating player ${id}:`, player);
  const { data, error } = await supabase
    .from('players')
    .update(player)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Error updating player:', error);
    throw error;
  }
  
  console.log('Player updated successfully:', data?.[0]);
  return data?.[0];
};

export const deletePlayer = async (id: string) => {
  console.log(`Deleting player ${id}`);
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting player:', error);
    throw error;
  }
  
  console.log(`Player ${id} deleted successfully`);
};

// Coaches
export const getCoaches = async () => {
  console.log('Fetching coaches from Supabase');
  try {
    const { data, error } = await supabase
      .from('coaches')
      .select(`
        *,
        coach_categories(
          age_category_id,
          age_categories(*)
        )
      `)
      .order('last_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching coaches:', error);
      if (error.code === 'PGRST301' || error.message.includes('JWT')) {
        console.warn('Authentication error when fetching coaches. Check if you are logged in.');
      }
      throw error;
    }
    
    console.log(`Successfully fetched ${data?.length || 0} coaches`);
    return data || [];
  } catch (error) {
    console.error('Exception during coaches fetch:', error);
    throw error;
  }
};

export const getCoachesByCategory = async (categoryId: string) => {
  console.log(`Fetching coaches for category ${categoryId}`);
  const { data, error } = await supabase
    .from('coaches')
    .select(`
      *,
      coach_categories!inner(
        age_category_id,
        age_categories(*)
      )
    `)
    .eq('coach_categories.age_category_id', categoryId)
    .order('last_name', { ascending: true });
  
  if (error) {
    console.error('Error fetching coaches by category:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} coaches for category ${categoryId}`);
  return data || [];
};

export const addCoach = async (coach: {
  first_name: string;
  last_name: string;
  license_number?: string;
  diploma?: string;
}, categoryIds: string[]) => {
  console.log('Adding new coach:', coach, 'with categories:', categoryIds);
  
  // Start a transaction
  const { data: coachData, error: coachError } = await supabase
    .from('coaches')
    .insert([coach])
    .select();
  
  if (coachError) {
    console.error('Error adding coach:', coachError);
    throw coachError;
  }
  
  if (coachData && coachData.length > 0) {
    const coachId = coachData[0].id;
    console.log(`Coach added with ID: ${coachId}, now adding category relationships`);
    
    // Add coach-category relationships
    const coachCategoryInserts = categoryIds.map(categoryId => ({
      coach_id: coachId,
      age_category_id: categoryId
    }));
    
    const { error: categoryError } = await supabase
      .from('coach_categories')
      .insert(coachCategoryInserts);
    
    if (categoryError) {
      console.error('Error adding coach categories:', categoryError);
      throw categoryError;
    }
    
    console.log('Coach categories added successfully');
    
    // Fetch the coach with relationships to return complete data
    const { data: completeCoach, error: fetchError } = await supabase
      .from('coaches')
      .select(`
        *,
        coach_categories(
          age_category_id,
          age_categories(*)
        )
      `)
      .eq('id', coachId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching complete coach data:', fetchError);
      return coachData[0]; // Return partial data if full data fetch fails
    }
    
    return completeCoach;
  }
  
  throw new Error('Failed to create coach');
};

export const updateCoach = async (
  id: string, 
  coach: {
    first_name?: string;
    last_name?: string;
    license_number?: string;
    diploma?: string;
  }, 
  categoryIds: string[]
) => {
  console.log(`Updating coach ${id}:`, coach, 'with categories:', categoryIds);
  
  // Start by updating the coach
  const { data: coachData, error: coachError } = await supabase
    .from('coaches')
    .update(coach)
    .eq('id', id)
    .select();
  
  if (coachError) {
    console.error('Error updating coach:', coachError);
    throw coachError;
  }
  
  console.log('Coach updated, now updating categories');
  
  // Delete existing coach-category relationships
  const { error: deleteError } = await supabase
    .from('coach_categories')
    .delete()
    .eq('coach_id', id);
  
  if (deleteError) {
    console.error('Error deleting existing coach categories:', deleteError);
    throw deleteError;
  }
  
  console.log('Old categories deleted, adding new ones');
  
  // Add new coach-category relationships
  const coachCategoryInserts = categoryIds.map(categoryId => ({
    coach_id: id,
    age_category_id: categoryId
  }));
  
  const { error: categoryError } = await supabase
    .from('coach_categories')
    .insert(coachCategoryInserts);
  
  if (categoryError) {
    console.error('Error adding new coach categories:', categoryError);
    throw categoryError;
  }
  
  console.log('Coach categories updated successfully');
  
  // Fetch the coach with relationships to return complete data
  const { data: completeCoach, error: fetchError } = await supabase
    .from('coaches')
    .select(`
      *,
      coach_categories(
        age_category_id,
        age_categories(*)
      )
    `)
    .eq('id', id)
    .single();
    
  if (fetchError) {
    console.error('Error fetching complete coach data:', fetchError);
    return coachData?.[0]; // Return partial data if full data fetch fails
  }
  
  return completeCoach;
};

export const deleteCoach = async (id: string) => {
  console.log(`Deleting coach ${id}`);
  // The coach_categories will be deleted automatically because of ON DELETE CASCADE
  const { error } = await supabase
    .from('coaches')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting coach:', error);
    throw error;
  }
  
  console.log(`Coach ${id} deleted successfully`);
};

// Tournaments
export const getTournaments = async () => {
  console.log('Fetching tournaments from Supabase');
  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      tournament_categories(
        age_category_id,
        age_categories(*)
      )
    `)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching tournaments:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} tournaments`);
  return data || [];
};

export const getTournamentsByCategory = async (categoryId: string) => {
  console.log(`Fetching tournaments for category ${categoryId}`);
  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      tournament_categories!inner(
        age_category_id,
        age_categories(*)
      )
    `)
    .eq('tournament_categories.age_category_id', categoryId)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching tournaments by category:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} tournaments for category ${categoryId}`);
  return data || [];
};

export const addTournament = async (tournament: {
  date: string;
  location: string;
}, categoryIds: string[]) => {
  console.log('Adding new tournament:', tournament, 'with categories:', categoryIds);
  
  // Start a transaction
  const { data: tournamentData, error: tournamentError } = await supabase
    .from('tournaments')
    .insert([tournament])
    .select();
  
  if (tournamentError) {
    console.error('Error adding tournament:', tournamentError);
    throw tournamentError;
  }
  
  if (tournamentData && tournamentData.length > 0) {
    const tournamentId = tournamentData[0].id;
    console.log(`Tournament added with ID: ${tournamentId}, now adding category relationships`);
    
    // Add tournament-category relationships
    const tournamentCategoryInserts = categoryIds.map(categoryId => ({
      tournament_id: tournamentId,
      age_category_id: categoryId
    }));
    
    const { error: categoryError } = await supabase
      .from('tournament_categories')
      .insert(tournamentCategoryInserts);
    
    if (categoryError) {
      console.error('Error adding tournament categories:', categoryError);
      throw categoryError;
    }
    
    console.log('Tournament categories added successfully');
    
    // Fetch the tournament with relationships to return complete data
    const { data: completeTournament, error: fetchError } = await supabase
      .from('tournaments')
      .select(`
        *,
        tournament_categories(
          age_category_id,
          age_categories(*)
        )
      `)
      .eq('id', tournamentId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching complete tournament data:', fetchError);
      return tournamentData[0]; // Return partial data if full data fetch fails
    }
    
    return completeTournament;
  }
  
  throw new Error('Failed to create tournament');
};

export const updateTournament = async (
  id: string, 
  tournament: {
    date?: string;
    location?: string;
  }, 
  categoryIds: string[]
) => {
  console.log(`Updating tournament ${id}:`, tournament, 'with categories:', categoryIds);
  
  // Start by updating the tournament
  const { data: tournamentData, error: tournamentError } = await supabase
    .from('tournaments')
    .update(tournament)
    .eq('id', id)
    .select();
  
  if (tournamentError) {
    console.error('Error updating tournament:', tournamentError);
    throw tournamentError;
  }
  
  console.log('Tournament updated, now updating categories');
  
  // Delete existing tournament-category relationships
  const { error: deleteError } = await supabase
    .from('tournament_categories')
    .delete()
    .eq('tournament_id', id);
  
  if (deleteError) {
    console.error('Error deleting existing tournament categories:', deleteError);
    throw deleteError;
  }
  
  console.log('Old categories deleted, adding new ones');
  
  // Add new tournament-category relationships
  const tournamentCategoryInserts = categoryIds.map(categoryId => ({
    tournament_id: id,
    age_category_id: categoryId
  }));
  
  const { error: categoryError } = await supabase
    .from('tournament_categories')
    .insert(tournamentCategoryInserts);
  
  if (categoryError) {
    console.error('Error adding new tournament categories:', categoryError);
    throw categoryError;
  }
  
  console.log('Tournament categories updated successfully');
  
  // Fetch the tournament with relationships to return complete data
  const { data: completeTournament, error: fetchError } = await supabase
    .from('tournaments')
    .select(`
      *,
      tournament_categories(
        age_category_id,
        age_categories(*)
      )
    `)
    .eq('id', id)
    .single();
    
  if (fetchError) {
    console.error('Error fetching complete tournament data:', fetchError);
    return tournamentData?.[0]; // Return partial data if full data fetch fails
  }
  
  return completeTournament;
};

export const deleteTournament = async (id: string) => {
  console.log(`Deleting tournament ${id}`);
  // The tournament_categories will be deleted automatically because of ON DELETE CASCADE
  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting tournament:', error);
    throw error;
  }
  
  console.log(`Tournament ${id} deleted successfully`);
};

// Templates
export const getTemplates = async () => {
  console.log('Fetching templates from Supabase');
  const { data, error } = await supabase
    .from('templates')
    .select(`
      *,
      template_categories(
        age_category_id,
        age_categories(*)
      )
    `)
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} templates`);
  return data || [];
};

export const getTemplatesByCategory = async (categoryId: string) => {
  console.log(`Fetching templates for category ${categoryId}`);
  const { data, error } = await supabase
    .from('templates')
    .select(`
      *,
      template_categories!inner(
        age_category_id,
        age_categories(*)
      )
    `)
    .eq('template_categories.age_category_id', categoryId)
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching templates by category:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} templates for category ${categoryId}`);
  return data || [];
};

export const addTemplate = async (template: {
  name: string;
  description?: string;
  file_url: string;
  field_mappings?: any;
}, categoryIds: string[]) => {
  console.log('Adding new template:', template, 'with categories:', categoryIds);
  
  // Start a transaction
  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .insert([template])
    .select();
  
  if (templateError) {
    console.error('Error adding template:', templateError);
    throw templateError;
  }
  
  if (templateData && templateData.length > 0) {
    const templateId = templateData[0].id;
    console.log(`Template added with ID: ${templateId}, now adding category relationships`);
    
    // Add template-category relationships
    const templateCategoryInserts = categoryIds.map(categoryId => ({
      template_id: templateId,
      age_category_id: categoryId
    }));
    
    const { error: categoryError } = await supabase
      .from('template_categories')
      .insert(templateCategoryInserts);
    
    if (categoryError) {
      console.error('Error adding template categories:', categoryError);
      throw categoryError;
    }
    
    console.log('Template categories added successfully');
    
    // Fetch the template with relationships to return complete data
    const { data: completeTemplate, error: fetchError } = await supabase
      .from('templates')
      .select(`
        *,
        template_categories(
          age_category_id,
          age_categories(*)
        )
      `)
      .eq('id', templateId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching complete template data:', fetchError);
      return templateData[0]; // Return partial data if full data fetch fails
    }
    
    return completeTemplate;
  }
  
  throw new Error('Failed to create template');
};

export const updateTemplate = async (
  id: string, 
  template: {
    name?: string;
    description?: string;
    file_url?: string;
    field_mappings?: any;
  }, 
  categoryIds: string[]
) => {
  console.log(`Updating template ${id}:`, template, 'with categories:', categoryIds);
  
  // Start by updating the template
  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .update(template)
    .eq('id', id)
    .select();
  
  if (templateError) {
    console.error('Error updating template:', templateError);
    throw templateError;
  }
  
  console.log('Template updated, now updating categories');
  
  // Delete existing template-category relationships
  const { error: deleteError } = await supabase
    .from('template_categories')
    .delete()
    .eq('template_id', id);
  
  if (deleteError) {
    console.error('Error deleting existing template categories:', deleteError);
    throw deleteError;
  }
  
  console.log('Old categories deleted, adding new ones');
  
  // Add new template-category relationships
  const templateCategoryInserts = categoryIds.map(categoryId => ({
    template_id: id,
    age_category_id: categoryId
  }));
  
  const { error: categoryError } = await supabase
    .from('template_categories')
    .insert(templateCategoryInserts);
  
  if (categoryError) {
    console.error('Error adding new template categories:', categoryError);
    throw categoryError;
  }
  
  console.log('Template categories updated successfully');
  
  // Fetch the template with relationships to return complete data
  const { data: completeTemplate, error: fetchError } = await supabase
    .from('templates')
    .select(`
      *,
      template_categories(
        age_category_id,
        age_categories(*)
      )
    `)
    .eq('id', id)
    .single();
    
  if (fetchError) {
    console.error('Error fetching complete template data:', fetchError);
    return templateData?.[0]; // Return partial data if full data fetch fails
  }
  
  return completeTemplate;
};

export const deleteTemplate = async (id: string) => {
  console.log(`Deleting template ${id}`);
  // The template_categories will be deleted automatically because of ON DELETE CASCADE
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
  
  console.log(`Template ${id} deleted successfully`);
};

// Match Sheets
export const getMatchSheets = async () => {
  console.log('Fetching match sheets from Supabase');
  const { data, error } = await supabase
    .from('match_sheets')
    .select(`
      *,
      tournaments(*),
      templates(*),
      age_categories(*),
      coaches(*),
      match_sheet_players(
        player_id,
        players(*)
      ),
      match_sheet_coaches(
        coach_id,
        coaches(*)
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching match sheets:', error);
    throw error;
  }
  
  console.log(`Successfully fetched ${data?.length || 0} match sheets`);
  return data || [];
};

export const getMatchSheet = async (id: string) => {
  console.log(`Fetching match sheet ${id}`);
  const { data, error } = await supabase
    .from('match_sheets')
    .select(`
      *,
      tournaments(*),
      templates(*),
      age_categories(*),
      coaches(*),
      match_sheet_players(
        player_id,
        players(*)
      ),
      match_sheet_coaches(
        coach_id,
        coaches(*)
      )
    `)
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching match sheet:', error);
    throw error;
  }
  
  console.log(`Successfully fetched match sheet ${id}`);
  return data;
};

export const addMatchSheet = async (
  matchSheet: {
    tournament_id: string;
    template_id: string;
    age_category_id: string;
    referent_coach_id: string;
  },
  playerIds: string[],
  coachIds: string[]
) => {
  console.log('Adding new match sheet:', matchSheet, 'with players:', playerIds, 'and coaches:', coachIds);
  
  // Start a transaction
  const { data: matchSheetData, error: matchSheetError } = await supabase
    .from('match_sheets')
    .insert([matchSheet])
    .select();
  
  if (matchSheetError) {
    console.error('Error adding match sheet:', matchSheetError);
    throw matchSheetError;
  }
  
  if (matchSheetData && matchSheetData.length > 0) {
    const matchSheetId = matchSheetData[0].id;
    console.log(`Match sheet added with ID: ${matchSheetId}, now adding player relationships`);
    
    // Add players
    if (playerIds.length > 0) {
      const playerInserts = playerIds.map(playerId => ({
        match_sheet_id: matchSheetId,
        player_id: playerId
      }));
      
      const { error: playerError } = await supabase
        .from('match_sheet_players')
        .insert(playerInserts);
      
      if (playerError) {
        console.error('Error adding match sheet players:', playerError);
        throw playerError;
      }
      
      console.log(`Added ${playerIds.length} players to match sheet`);
    }
    
    console.log('Now adding coach relationships');
    
    // Add coaches
    if (coachIds.length > 0) {
      const coachInserts = coachIds.map(coachId => ({
        match_sheet_id: matchSheetId,
        coach_id: coachId
      }));
      
      const { error: coachError } = await supabase
        .from('match_sheet_coaches')
        .insert(coachInserts);
      
      if (coachError) {
        console.error('Error adding match sheet coaches:', coachError);
        throw coachError;
      }
      
      console.log(`Added ${coachIds.length} coaches to match sheet`);
    }
    
    // Fetch the match sheet with relationships to return complete data
    const { data: completeMatchSheet, error: fetchError } = await supabase
      .from('match_sheets')
      .select(`
        *,
        tournaments(*),
        templates(*),
        age_categories(*),
        coaches(*),
        match_sheet_players(
          player_id,
          players(*)
        ),
        match_sheet_coaches(
          coach_id,
          coaches(*)
        )
      `)
      .eq('id', matchSheetId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching complete match sheet data:', fetchError);
      return matchSheetData[0]; // Return partial data if full data fetch fails
    }
    
    return completeMatchSheet;
  }
  
  throw new Error('Failed to create match sheet');
};

export const updateMatchSheet = async (
  id: string,
  matchSheet: {
    tournament_id?: string;
    template_id?: string;
    age_category_id?: string;
    referent_coach_id?: string;
  },
  playerIds: string[],
  coachIds: string[]
) => {
  console.log(`Updating match sheet ${id}:`, matchSheet, 'with players:', playerIds, 'and coaches:', coachIds);
  
  // Start by updating the match sheet
  const { data: matchSheetData, error: matchSheetError } = await supabase
    .from('match_sheets')
    .update(matchSheet)
    .eq('id', id)
    .select();
  
  if (matchSheetError) {
    console.error('Error updating match sheet:', matchSheetError);
    throw matchSheetError;
  }
  
  console.log('Match sheet updated, now updating player relationships');
  
  // Delete existing player relationships
  const { error: deletePlayerError } = await supabase
    .from('match_sheet_players')
    .delete()
    .eq('match_sheet_id', id);
  
  if (deletePlayerError) {
    console.error('Error deleting existing match sheet players:', deletePlayerError);
    throw deletePlayerError;
  }
  
  console.log('Old player relationships deleted, now deleting coach relationships');
  
  // Delete existing coach relationships
  const { error: deleteCoachError } = await supabase
    .from('match_sheet_coaches')
    .delete()
    .eq('match_sheet_id', id);
  
  if (deleteCoachError) {
    console.error('Error deleting existing match sheet coaches:', deleteCoachError);
    throw deleteCoachError;
  }
  
  console.log('Adding new player relationships');
  
  // Add players
  if (playerIds.length > 0) {
    const playerInserts = playerIds.map(playerId => ({
      match_sheet_id: id,
      player_id: playerId
    }));
    
    const { error: playerError } = await supabase
      .from('match_sheet_players')
      .insert(playerInserts);
    
    if (playerError) {
      console.error('Error adding match sheet players:', playerError);
      throw playerError;
    }
    
    console.log(`Added ${playerIds.length} players to match sheet`);
  }
  
  console.log('Adding new coach relationships');
  
  // Add coaches
  if (coachIds.length > 0) {
    const coachInserts = coachIds.map(coachId => ({
      match_sheet_id: id,
      coach_id: coachId
    }));
    
    const { error: coachError } = await supabase
      .from('match_sheet_coaches')
      .insert(coachInserts);
    
    if (coachError) {
      console.error('Error adding match sheet coaches:', coachError);
      throw coachError;
    }
    
    console.log(`Added ${coachIds.length} coaches to match sheet`);
  }
  
  // Fetch the match sheet with relationships to return complete data
  const { data: completeMatchSheet, error: fetchError } = await supabase
    .from('match_sheets')
    .select(`
      *,
      tournaments(*),
      templates(*),
      age_categories(*),
      coaches(*),
      match_sheet_players(
        player_id,
        players(*)
      ),
      match_sheet_coaches(
        coach_id,
        coaches(*)
      )
    `)
    .eq('id', id)
    .single();
    
  if (fetchError) {
    console.error('Error fetching complete match sheet data:', fetchError);
    return matchSheetData?.[0]; // Return partial data if full data fetch fails
  }
  
  return completeMatchSheet;
};

export const deleteMatchSheet = async (id: string) => {
  console.log(`Deleting match sheet ${id}`);
  // The match_sheet_players and match_sheet_coaches will be deleted automatically because of ON DELETE CASCADE
  const { error } = await supabase
    .from('match_sheets')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting match sheet:', error);
    throw error;
  }
  
  console.log(`Match sheet ${id} deleted successfully`);
};