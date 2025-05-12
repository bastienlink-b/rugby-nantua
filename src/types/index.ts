export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  licenseNumber: string;
  canPlayForward: boolean;
  canReferee: boolean;
  ageCategoryId: string;
}

export interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  diploma: string;
  ageCategoryIds: string[]; // Array of age categories the coach is responsible for
}

export interface Tournament {
  id: string;
  date: string;
  location: string;
  ageCategoryIds: string[]; // Array of age category IDs
}

export interface AgeCategory {
  id: string;
  name: string;
  description?: string;
}

export interface PdfFieldMapping {
  champ_pdf: string;
  type: 'joueur' | 'educateur' | 'global' | 'autre';
  mapping: string;
  valeur_possible?: string[];
  obligatoire?: boolean;
  format?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  fileUrl: string;
  ageCategoryIds: string[]; // Changé de ageCategoryId à ageCategoryIds (array)
  fieldMappings?: PdfFieldMapping[]; // Mappings des champs du PDF
}

export interface MatchSheet {
  id: string;
  tournamentId: string;
  templateId: string;
  ageCategoryId: string;
  referentCoachId: string; // Coach assigned as referent for this match sheet
  playerIds: string[];
  coachIds: string[]; // Array of coach IDs assigned to this match sheet
  createdAt: Date;
}