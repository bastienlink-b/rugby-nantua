/*
  # Add Sample Players and Coaches Data
  
  1. New Data
    - Adds 22 M14 players with all their details
    - Adds 4 coaches with their credentials
    - Links all coaches to the M14 age category
  
  2. Security
    - Ensures data is accessible to authenticated users
    - Grants appropriate permissions for read access
*/

-- First check if we already have sample data (to make migration idempotent)
DO $$
DECLARE
    player_count INTEGER;
    coach_count INTEGER;
    m14_category_id UUID;
BEGIN
    SELECT COUNT(*) INTO player_count FROM players;
    SELECT COUNT(*) INTO coach_count FROM coaches;
    
    -- Get the M14 category ID first
    SELECT id INTO m14_category_id FROM age_categories WHERE name = 'M14';
    
    IF m14_category_id IS NULL THEN
        RAISE EXCEPTION 'M14 age category not found! Please ensure age categories are created first.';
    END IF;
    
    -- Only insert sample data if tables are empty
    IF player_count = 0 THEN
        -- Insert sample players (M14 category)
        INSERT INTO players (first_name, last_name, date_of_birth, license_number, can_play_forward, can_referee, age_category_id)
        VALUES
            ('Antonin', 'Januzzi', '2012-01-01', '2012061600285', true, false, m14_category_id),
            ('Sarah', 'Vailloud', '2011-01-01', '2011072706233', true, false, m14_category_id),
            ('Matthew', 'Poncet', '2012-01-01', '2012021714645', true, false, m14_category_id),
            ('Alexis', 'Previtali', '2011-01-01', '2011091654732', false, false, m14_category_id),
            ('Robin', 'Hugon', '2012-01-01', '2012051697490', true, false, m14_category_id),
            ('Eva', 'Vion-Dury', '2011-01-01', '20111002714154', true, false, m14_category_id),
            ('Nathan', 'Vanderme', '2012-01-01', '2012101580348', true, false, m14_category_id),
            ('Antoine', 'Grasset', '2011-01-01', '2011011117072', true, false, m14_category_id),
            ('Émile', 'Joux', '2012-01-01', '2012011555631', true, false, m14_category_id),
            ('Erwan', 'Gautheron-Cercy', '2012-01-01', '2012031354290', true, true, m14_category_id),
            ('Collyne', 'Poncet', '2010-01-01', '2010032739453', true, false, m14_category_id),
            ('Ilia', 'Verhassell', '2011-01-01', '2011051369516', true, false, m14_category_id),
            ('Maxence', 'Caetano', '2011-01-01', '2011021123308', true, false, m14_category_id),
            ('Amaury', 'Salvi', '2011-01-01', '2011051191187', true, true, m14_category_id),
            ('Vincent', 'Chapon', '2012-01-01', '2012121053543', true, true, m14_category_id),
            ('Bastien', 'Vion-Delphin', '2011-01-01', '2011121156367', true, false, m14_category_id),
            ('Jean-Tristan', 'Marchio', '2012-01-01', '2012031078189', true, false, m14_category_id),
            ('Léna', 'Pernot', '2010-01-01', '2010112186571', true, true, m14_category_id),
            ('Matteo', 'Colley', '2011-01-01', '2011081491281', true, false, m14_category_id),
            ('Léon', 'Ducret', '2011-01-01', '2011051614345', true, false, m14_category_id),
            ('Léa', 'Leitao', '2010-01-01', '2010092678194', true, false, m14_category_id),
            ('Nathan', 'Guichard', '2011-01-01', '2011061727211', false, false, m14_category_id);
        
        RAISE NOTICE 'Added 22 sample players to database';
    ELSE
        RAISE NOTICE 'Players table not empty, skipping sample player data insertion';
    END IF;
    
    -- Insert sample coaches and their relationships to categories
    IF coach_count = 0 THEN
        -- Insert coaches and track their IDs
        WITH coaches_insert AS (
            INSERT INTO coaches (first_name, last_name, license_number, diploma)
            VALUES
                ('Bastien', 'Buquet', '1993111162969', 'DU développement'),
                ('Thomas', 'Goudey', NULL, NULL),
                ('Maxime', 'Pertreux', NULL, 'DU développement'),
                ('Elodie', 'Dubois', '1995932131433', NULL)
            RETURNING id
        )
        -- Add relationships to M14 category for each coach
        INSERT INTO coach_categories (coach_id, age_category_id)
        SELECT id, m14_category_id FROM coaches_insert;
        
        RAISE NOTICE 'Added 4 sample coaches to database';
    ELSE
        RAISE NOTICE 'Coaches table not empty, skipping sample coach data insertion';
    END IF;
END $$;

-- Ensure RLS policies are correctly set up
DO $$
BEGIN
    -- Create or update RLS policy for players table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'players' AND policyname = 'Allow authenticated CRUD for players'
    ) THEN
        CREATE POLICY "Allow authenticated CRUD for players" 
        ON players FOR ALL TO authenticated USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Created RLS policy for players table';
    END IF;
    
    -- Create or update RLS policy for coaches table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'coaches' AND policyname = 'Allow authenticated CRUD for coaches'
    ) THEN
        CREATE POLICY "Allow authenticated CRUD for coaches" 
        ON coaches FOR ALL TO authenticated USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Created RLS policy for coaches table';
    END IF;
    
    -- Create or update RLS policy for coach_categories table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'coach_categories' AND policyname = 'Allow authenticated CRUD for coach_categories'
    ) THEN
        CREATE POLICY "Allow authenticated CRUD for coach_categories" 
        ON coach_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
        
        RAISE NOTICE 'Created RLS policy for coach_categories table';
    END IF;
END $$;