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
      .select('*')
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
    .select('*')
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
    const { data: coaches, error: coachesError } = await supabase
      .from('coaches')
      .select('*')
      .order('last_name', { ascending: true });
    
    if (coachesError) {
      console.error('Error fetching coaches:', coachesError);
      throw coachesError;
    }

    if (!coaches || coaches.length === 0) {
      console.log('No coaches found');
      return [];
    }

    console.log(`Successfully fetched ${coaches.length} coaches`);
    
    // Now fetch coach categories for all coaches at once
    const coachIds = coaches.map(coach => coach.id);
    const { data: coachCategories, error: categoriesError } = await supabase
      .from('coach_categories')
      .select('coach_id, age_category_id')
      .in('coach_id', coachIds);
      
    if (categoriesError) {
      console.error('Error fetching coach categories:', categoriesError);
      throw categoriesError;
    }
    
    console.log(`Fetched ${coachCategories?.length || 0} coach-category relationships`);
    
    // Map categories to coaches
    const coachesWithCategories = coaches.map(coach => {
      const categories = coachCategories
        ?.filter(cc => cc.coach_id === coach.id)
        .map(cc => cc.age_category_id) || [];
        
      return {
        ...coach,
        coach_categories: categories.map(cat_id => ({ age_category_id: cat_id }))
      };
    });
    
    return coachesWithCategories;
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
    
    // Return coach with categories
    return {
      ...coachData[0],
      coach_categories: categoryIds.map(id => ({ age_category_id: id }))
    };
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
  
  // Return coach with updated categories
  return {
    ...(coachData?.[0] || {}),
    coach_categories: categoryIds.map(id => ({ age_category_id: id }))
  };
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
  try {
    const { data: tournaments, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .order('date', { ascending: false });
    
    if (tournamentError) {
      console.error('Error fetching tournaments:', tournamentError);
      throw tournamentError;
    }
    
    if (!tournaments || tournaments.length === 0) {
      console.log('No tournaments found');
      return [];
    }
    
    console.log(`Successfully fetched ${tournaments.length} tournaments`);
    
    // Now fetch tournament categories for all tournaments at once
    const tournamentIds = tournaments.map(tournament => tournament.id);
    const { data: tournamentCategories, error: categoriesError } = await supabase
      .from('tournament_categories')
      .select('tournament_id, age_category_id')
      .in('tournament_id', tournamentIds);
      
    if (categoriesError) {
      console.error('Error fetching tournament categories:', categoriesError);
      throw categoriesError;
    }
    
    console.log(`Fetched ${tournamentCategories?.length || 0} tournament-category relationships`);
    
    // Map categories to tournaments
    const tournamentsWithCategories = tournaments.map(tournament => {
      const categories = tournamentCategories
        ?.filter(tc => tc.tournament_id === tournament.id)
        .map(tc => tc.age_category_id) || [];
        
      return {
        ...tournament,
        tournament_categories: categories.map(cat_id => ({ age_category_id: cat_id }))
      };
    });
    
    return tournamentsWithCategories;
  } catch (error) {
    console.error('Exception during tournaments fetch:', error);
    throw error;
  }
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
    
    // Return tournament with categories
    return {
      ...tournamentData[0],
      tournament_categories: categoryIds.map(id => ({ age_category_id: id }))
    };
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
  
  // Return tournament with updated categories
  return {
    ...(tournamentData?.[0] || {}),
    tournament_categories: categoryIds.map(id => ({ age_category_id: id }))
  };
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
  try {
    const { data: templates, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .order('name', { ascending: true });
    
    if (templateError) {
      console.error('Error fetching templates:', templateError);
      throw templateError;
    }
    
    if (!templates || templates.length === 0) {
      console.log('No templates found');
      return [];
    }
    
    console.log(`Successfully fetched ${templates.length} templates`);
    
    // Now fetch template categories for all templates at once
    const templateIds = templates.map(template => template.id);
    const { data: templateCategories, error: categoriesError } = await supabase
      .from('template_categories')
      .select('template_id, age_category_id')
      .in('template_id', templateIds);
      
    if (categoriesError) {
      console.error('Error fetching template categories:', categoriesError);
      throw categoriesError;
    }
    
    console.log(`Fetched ${templateCategories?.length || 0} template-category relationships`);
    
    // Map categories to templates
    const templatesWithCategories = templates.map(template => {
      const categories = templateCategories
        ?.filter(tc => tc.template_id === template.id)
        .map(tc => tc.age_category_id) || [];
        
      return {
        ...template,
        template_categories: categories.map(cat_id => ({ age_category_id: cat_id }))
      };
    });
    
    return templatesWithCategories;
  } catch (error) {
    console.error('Exception during templates fetch:', error);
    throw error;
  }
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
    
    // Return template with categories
    return {
      ...templateData[0],
      template_categories: categoryIds.map(id => ({ age_category_id: id }))
    };
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
  
  // Return template with updated categories
  return {
    ...(templateData?.[0] || {}),
    template_categories: categoryIds.map(id => ({ age_category_id: id }))
  };
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
  try {
    const { data: matchSheets, error: matchSheetsError } = await supabase
      .from('match_sheets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (matchSheetsError) {
      console.error('Error fetching match sheets:', matchSheetsError);
      throw matchSheetsError;
    }
    
    if (!matchSheets || matchSheets.length === 0) {
      console.log('No match sheets found');
      return [];
    }
    
    console.log(`Successfully fetched ${matchSheets.length} match sheets`);
    
    // Fetch players for each match sheet
    const matchSheetIds = matchSheets.map(ms => ms.id);
    
    // Get players
    const { data: matchSheetPlayers, error: playersError } = await supabase
      .from('match_sheet_players')
      .select('match_sheet_id, player_id')
      .in('match_sheet_id', matchSheetIds);
      
    if (playersError) {
      console.error('Error fetching match sheet players:', playersError);
      throw playersError;
    }
    
    console.log(`Fetched ${matchSheetPlayers?.length || 0} player relationships`);
    
    // Get coaches
    const { data: matchSheetCoaches, error: coachesError } = await supabase
      .from('match_sheet_coaches')
      .select('match_sheet_id, coach_id')
      .in('match_sheet_id', matchSheetIds);
      
    if (coachesError) {
      console.error('Error fetching match sheet coaches:', coachesError);
      throw coachesError;
    }
    
    console.log(`Fetched ${matchSheetCoaches?.length || 0} coach relationships`);
    
    // Map players and coaches to match sheets
    const completeMatchSheets = matchSheets.map(matchSheet => {
      const players = matchSheetPlayers
        ?.filter(msp => msp.match_sheet_id === matchSheet.id)
        .map(msp => ({ player_id: msp.player_id })) || [];
        
      const coaches = matchSheetCoaches
        ?.filter(msc => msc.match_sheet_id === matchSheet.id)
        .map(msc => ({ coach_id: msc.coach_id })) || [];
        
      return {
        ...matchSheet,
        match_sheet_players: players,
        match_sheet_coaches: coaches
      };
    });
    
    return completeMatchSheets;
  } catch (error) {
    console.error('Exception during match sheets fetch:', error);
    throw error;
  }
};

export const getMatchSheet = async (id: string) => {
  console.log(`Fetching match sheet ${id}`);
  try {
    const { data: matchSheet, error: matchSheetError } = await supabase
      .from('match_sheets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (matchSheetError) {
      console.error('Error fetching match sheet:', matchSheetError);
      throw matchSheetError;
    }
    
    console.log(`Successfully fetched match sheet ${id}`);
    
    // Get players for this match sheet
    const { data: matchSheetPlayers, error: playersError } = await supabase
      .from('match_sheet_players')
      .select('player_id')
      .eq('match_sheet_id', id);
      
    if (playersError) {
      console.error('Error fetching match sheet players:', playersError);
      throw playersError;
    }
    
    // Get coaches for this match sheet
    const { data: matchSheetCoaches, error: coachesError } = await supabase
      .from('match_sheet_coaches')
      .select('coach_id')
      .eq('match_sheet_id', id);
      
    if (coachesError) {
      console.error('Error fetching match sheet coaches:', coachesError);
      throw coachesError;
    }
    
    // Return complete match sheet with relationships
    return {
      ...matchSheet,
      match_sheet_players: matchSheetPlayers || [],
      match_sheet_coaches: matchSheetCoaches || []
    };
  } catch (error) {
    console.error('Exception during match sheet fetch:', error);
    throw error;
  }
};

export const addMatchSheet = async (
  matchSheet: {
    tournament_id: string;
    template_id: string;
    age_category_id: string;
    referent_coach_id: string;
    pdf_url?: string; // Ajout du champ pdf_url
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
    
    // Return match sheet with relationships
    return {
      ...matchSheetData[0],
      match_sheet_players: playerIds.map(id => ({ player_id: id })),
      match_sheet_coaches: coachIds.map(id => ({ coach_id: id }))
    };
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
    pdf_url?: string; // Ajout du champ pdf_url
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
  
  // Return match sheet with updated relationships
  return {
    ...(matchSheetData?.[0] || {}),
    match_sheet_players: playerIds.map(id => ({ player_id: id })),
    match_sheet_coaches: coachIds.map(id => ({ coach_id: id }))
  };
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