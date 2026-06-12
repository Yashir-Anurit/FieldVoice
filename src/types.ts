export interface RepProfile {
  id: string;
  name: string;
  title: string;
  territory: string;
  customVocabulary: string[];
  contactShortnames: { short: string; full: string }[];
}

export interface ApiCredentials {
  geminiKey: string;
  azureSpeechKey?: string;
  azureSpeechRegion?: string;
  azureSpeechEndpoint?: string;
}

export interface Account {
  id: string;
  name: string;
  location: string;
  phone?: string;
  revenue?: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  accountId: string;
}

export interface Opportunity {
  id: string;
  name: string;
  stage: string;
  amount: string;
  closeDate: string;
  accountId: string;
  accountName?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
}

export interface ExtractedData {
  accountName: string;
  contactNames: string[];
  productsDiscussed: string[];
  dollarAmount: string;
  pipelineStage: string;
  estimatedCloseDate: string;
  nextSteps: string;
  textSummary: string;
  correctionsLog?: string; // Captures edits made by the rep
}

export interface OfflineNote {
  id: string;
  timestamp: string;
  duration: number;
  transcript: string;
  extractedData: ExtractedData | null;
  repProfileId: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  transcript: string;
}
