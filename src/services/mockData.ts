import { Account, Contact, Opportunity, ProductCategory, RepProfile, DemoScenario } from '../types';

export const mockProfiles: RepProfile[] = [
  {
    id: 'rep-1',
    name: 'Sarah Jenkins',
    title: 'Senior Account Executive',
    territory: 'Midwest Agriculture',
    customVocabulary: [
      'Alfalfa Seed',
      'Nitrogen Booster Pro',
      'Ceres Grain Corp',
      'Green Valley Foods',
      'Valley Agro',
    ],
    contactShortnames: [
      { short: 'Greg', full: 'Gregory Peck' },
      { short: 'Rob', full: 'Robert Chen' },
    ],
  },
  {
    id: 'rep-2',
    name: 'Michael Scott',
    title: 'Regional Manager',
    territory: 'Northeast Logistics',
    customVocabulary: [
      'CargoShip XL',
      'Dunder Mifflin',
      'Pacific Logistics',
      'Apex Retailers',
      'Summit Energy',
    ],
    contactShortnames: [
      { short: 'Dwight', full: 'Dwight Schrute' },
      { short: 'Pam', full: 'Pam Beesly' },
    ],
  },
];

export const mockAccounts: Account[] = [
  { id: 'acc-1', name: 'Ceres Grain Corp', location: 'Omaha, NE', revenue: '$5,200,000' },
  { id: 'acc-2', name: 'Green Valley Foods', location: 'Chicago, IL', revenue: '$8,400,000' },
  { id: 'acc-3', name: 'Pacific Logistics', location: 'Seattle, WA', revenue: '$12,300,000' },
  { id: 'acc-4', name: 'Apex Retailers', location: 'New York, NY', revenue: '$2,100,000' },
  { id: 'acc-5', name: 'Summit Energy', location: 'Houston, TX', revenue: '$15,600,000' },
  { id: 'acc-6', name: 'Oakwood Health', location: 'Denver, CO', revenue: '$9,200,000' },
  { id: 'acc-7', name: 'Frontier Mining', location: 'Phoenix, AZ', revenue: '$7,800,000' },
  { id: 'acc-8', name: 'BlueSky Tech', location: 'San Francisco, CA', revenue: '$4,500,000' },
  { id: 'acc-9', name: 'Valley Agro', location: 'Omaha, NE', revenue: '$3,100,000' },
  { id: 'acc-10', name: 'Capital Investments', location: 'Boston, MA', revenue: '$11,000,000' },
];

export const mockContacts: Contact[] = [
  { id: 'con-1', name: 'Gregory Peck', title: 'Director of Procurement', accountId: 'acc-1' },
  { id: 'con-2', name: 'Robert Chen', title: 'VP Operations', accountId: 'acc-2' },
  { id: 'con-3', name: 'Dwight Schrute', title: 'Assistant to Regional Manager', accountId: 'acc-3' },
  { id: 'con-4', name: 'Pam Beesly', title: 'Office Administrator', accountId: 'acc-4' },
  { id: 'con-5', name: 'John Miller', title: 'Senior Engineer', accountId: 'acc-5' },
  { id: 'con-6', name: 'Susan Davis', title: 'Chief Medical Officer', accountId: 'acc-6' },
  { id: 'con-7', name: 'Mark Wilson', title: 'Safety Supervisor', accountId: 'acc-7' },
  { id: 'con-8', name: 'Alice Peterson', title: 'Lead Software Architect', accountId: 'acc-8' },
  { id: 'con-9', name: 'Arthur Pendelton', title: 'Managing Director', accountId: 'acc-9' },
  { id: 'con-10', name: 'Katherine Hepburn', title: 'Partner', accountId: 'acc-10' },
  { id: 'con-11', name: 'William Marshall', title: 'Grain Manager', accountId: 'acc-1' },
  { id: 'con-12', name: 'Janet Yellen', title: 'Chief Economist', accountId: 'acc-10' },
];

export const mockOpportunities: Opportunity[] = [
  { id: 'opp-1', name: 'Ceres Grain - Bulk Seed Contract', stage: 'Prospecting', amount: '45000', closeDate: '2026-12-05', accountId: 'acc-1' },
  { id: 'opp-2', name: 'Green Valley - Annual Feed supply', stage: 'Qualification', amount: '80000', closeDate: '2026-11-20', accountId: 'acc-2' },
  { id: 'opp-3', name: 'Pacific Logistics - Cargo Ship Contract', stage: 'Needs Analysis', amount: '120000', closeDate: '2026-10-15', accountId: 'acc-3' },
  { id: 'opp-4', name: 'Apex Retailers - Shelf Placement Deal', stage: 'Proposal/Price Quote', amount: '25000', closeDate: '2027-01-10', accountId: 'acc-4' },
];

export const mockProductCategories: ProductCategory[] = [
  { id: 'prod-1', name: 'Alfalfa Seed', description: 'Premium cold-hardy alfalfa seed mix' },
  { id: 'prod-2', name: 'Nitrogen Booster Pro', description: 'Advanced agricultural nitrogen fertilizer formula' },
  { id: 'prod-3', name: 'CargoShip XL', description: 'Large-capacity freight logistics container tracking units' },
  { id: 'prod-4', name: 'Dunder Paper Pack', description: 'High-quality office paper bundle deals' },
  { id: 'prod-5', name: 'Heavy Duty Tractor', description: 'Industrial agriculture vehicles' },
  { id: 'prod-6', name: 'Organic Corn Seed', description: 'Non-GMO organic certified sweet corn seeds' },
  { id: 'prod-7', name: 'Potassium Rich Mix', description: 'Potash compound for agricultural soil enhancement' },
  { id: 'prod-8', name: 'Soybean Bulk Supply', description: 'Roundup-ready bulk soybean seeds' },
  { id: 'prod-9', name: 'Wheat Harvest Blend', description: 'Durable winter wheat seed variation' },
];

export const demoScenarios: DemoScenario[] = [
  {
    id: 'scen-1',
    title: 'Agriculture Bulk Supply Deal',
    description: 'Sarah visiting Ceres Grain Corp in Omaha. Discusses Alfalfa Seed with Greg. Deal size is $40,000 closing in Dec 2026.',
    transcript: 'Met with Ceres Grain Corp and Gregory Peck in Omaha. We discussed Alfalfa Seed. Estimated deal value is forty thousand dollars, closing on December fifth, twenty twenty-six. Next step is to finalize shipping logs.',
  },
  {
    id: 'scen-2',
    title: 'Fertilizer Supply Agreement',
    description: 'Sarah visiting Green Valley Foods. Discusses Nitrogen Booster Pro with Rob. Deal size is $85,000 closing in November 2026.',
    transcript: 'Visited Green Valley Foods today. Robert Chen was very interested in the Nitrogen Booster Pro. We negotiated an annual supply contract valued at eighty-five thousand dollars. Estimated close date is November twentieth, twenty twenty-six. The pipeline stage is qualification. I need to email the SDS sheets by next Monday.',
  },
  {
    id: 'scen-3',
    title: 'Logistics Tracker Bulk Order',
    description: 'Michael Scott visiting Pacific Logistics. Discusses CargoShip XL with Dwight. Deal size is $150,000 closing in Oct 2026.',
    transcript: 'Had a successful meeting at Pacific Logistics. Dwight Schrute agreed to purchase CargoShip XL trackers. Value is approximately one hundred and fifty thousand dollars. Looking to close by October fifteenth, twenty twenty-six. The next step is to send a formal proposal by Friday.',
  },
];
