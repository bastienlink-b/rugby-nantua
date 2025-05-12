/*
  # Add sample players and coaches data
  
  1. New Data
    - Add sample players for M14 category
    - Add sample coaches with their categories
    - Create relationships between coaches and their categories
  
  2. Purpose
    - Provide initial data for testing and demonstration purposes
    - Ensure consistent data is available in all environments
*/

-- First check if we already have sample data (to make migration idempotent)
DO $$
DECLARE
    player_count INTEGER;
    coach_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO player_count FROM players;
    SELECT COUNT(*) INTO coach_count FROM coaches;
    
    -- Only insert sample data if tables are empty
    IF player_count = 0 THEN
        -- Insert sample players (M14 category)
        INSERT INTO players (first_name, last_name, date_of_birth, license_number, can_play_forward, can_referee, age_category_id)
        SELECT
            first_name,
            last_name,
            date_of_birth::date,
            license_number,
            can_play_forward,
            can_referee,
            (SELECT id FROM age_categories WHERE name = 'M14')
        FROM (
            VALUES
                ('Antonin', 'Januzzi', '2012-01-01', '2012061600285', true, false),
                ('Sarah', 'Vailloud', '2011-01-01', '2011072706233', true, false),
                ('Matthew', 'Poncet', '2012-01-01', '2012021714645', true, false),
                ('Alexis', 'Previtali', '2011-01-01', '2011091654732', false, false),
                ('Robin', 'Hugon', '2012-01-01', '2012051697490', true, false),
                ('Eva', 'Vion-Dury', '2011-01-01', '20111002714154', true, false),
                ('Nathan', 'Vanderme', '2012-01-01', '2012101580348', true, false),
                ('Antoine', 'Grasset', '2011-01-01', '2011011117072', true, false),
                ('Émile', 'Joux', '2012-01-01', '2012011555631', true, false),
                ('Erwan', 'Gautheron-Cercy', '2012-01-01', '2012031354290', true, true),
                ('Collyne', 'Poncet', '2010-01-01', '2010032739453', true, false),
                ('Ilia', 'Verhassell', '2011-01-01', '2011051369516', true, false),
                ('Maxence', 'Caetano', '2011-01-01', '2011021123308', true, false),
                ('Amaury', 'Salvi', '2011-01-01', '2011051191187', true, true),
                ('Vincent', 'Chapon', '2012-01-01', '2012121053543', true, true),
                ('Bastien', 'Vion-Delphin', '2011-01-01', '2011121156367', true, false),
                ('Jean-Tristan', 'Marchio', '2012-01-01', '2012031078189', true, false),
                ('Léna', 'Pernot', '2010-01-01', '2010112186571', true, true),
                ('Matteo', 'Colley', '2011-01-01', '2011081491281', true, false),
                ('Léon', 'Ducret', '2011-01-01', '2011051614345', true, false),
                ('Léa', 'Leitao', '2010-01-01', '2010092678194', true, false),
                ('Nathan', 'Guichard', '2011-01-01', '2011061727211', false, false)
        ) AS sample_players(first_name, last_name, date_of_birth, license_number, can_play_forward, can_referee);
        
        RAISE NOTICE 'Added sample players to database';
    ELSE
        RAISE NOTICE 'Players table not empty, skipping sample player data insertion';
    END IF;
    
    -- Insert sample coaches and their relationships to categories
    IF coach_count = 0 THEN
        -- Insert coaches
        WITH inserted_coaches AS (
            INSERT INTO coaches (first_name, last_name, license_number, diploma)
            VALUES
                ('Bastien', 'Buquet', '1993111162969', 'DU développement'),
                ('Thomas', 'Goudey', '', ''),
                ('Maxime', 'Pertreux', '', 'DU développement'),
                ('Elodie', 'Dubois', '1995932131433', '')
            RETURNING id, first_name, last_name
        )
        -- Add their category relationships (all coaches are M14 category in this sample)
        INSERT INTO coach_categories (coach_id, age_category_id)
        SELECT 
            c.id,
            (SELECT id FROM age_categories WHERE name = 'M14')
        FROM inserted_coaches c;
        
        RAISE NOTICE 'Added sample coaches to database';
    ELSE
        RAISE NOTICE 'Coaches table not empty, skipping sample coach data insertion';
    END IF;
END $$;