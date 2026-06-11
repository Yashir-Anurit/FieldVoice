import AsyncStorage from '@react-native-async-storage/async-storage';
import { Account, Contact, Opportunity, ExtractedData } from '../types';
import { mockAccounts, mockContacts, mockOpportunities } from './mockData';

export interface SalesforceConfig {
  instanceUrl: string;
  accessToken: string;
  isLive: boolean;
}

class SalesforceService {
  private localAccounts: Account[] = [];
  private localContacts: Contact[] = [];
  private localOpportunities: Opportunity[] = [];

  // Seed DB initially
  async initializeDb() {
    const cachedAcc = await AsyncStorage.getItem('sf_cached_accounts');
    const cachedCon = await AsyncStorage.getItem('sf_cached_contacts');
    const cachedOpp = await AsyncStorage.getItem('sf_cached_opportunities');

    if (!cachedAcc) {
      this.localAccounts = mockAccounts;
      await AsyncStorage.setItem('sf_cached_accounts', JSON.stringify(mockAccounts));
    } else {
      this.localAccounts = JSON.parse(cachedAcc);
    }

    if (!cachedCon) {
      this.localContacts = mockContacts;
      await AsyncStorage.setItem('sf_cached_contacts', JSON.stringify(mockContacts));
    } else {
      this.localContacts = JSON.parse(cachedCon);
    }

    if (!cachedOpp) {
      this.localOpportunities = mockOpportunities;
      await AsyncStorage.setItem('sf_cached_opportunities', JSON.stringify(mockOpportunities));
    } else {
      this.localOpportunities = JSON.parse(cachedOpp);
    }
  }

  // Get active Salesforce Config
  async getConfig(): Promise<SalesforceConfig> {
    const configStr = await AsyncStorage.getItem('fv_salesforce_config');
    if (configStr) {
      return JSON.parse(configStr);
    }
    return { instanceUrl: '', accessToken: '', isLive: false };
  }

  // Save Salesforce Config
  async saveConfig(config: SalesforceConfig) {
    let url = config.instanceUrl.trim().replace(/\/+$/, '');
    if (url) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      if (url.includes('.lightning.force.com')) {
        console.warn('Converting Lightning URL to My Domain API URL');
        url = url.replace(/\.lightning\.force\.com/i, '.my.salesforce.com');
      }
    }
    const cleanedConfig = {
      ...config,
      instanceUrl: url,
    };
    await AsyncStorage.setItem('fv_salesforce_config', JSON.stringify(cleanedConfig));
  }

  // Clear config
  async disconnect() {
    await AsyncStorage.removeItem('fv_salesforce_config');
  }

  // Reads Accounts
  async getAccounts(): Promise<Account[]> {
    const config = await this.getConfig();
    if (config.isLive && config.accessToken && config.instanceUrl) {
      try {
        const response = await fetch(
          `${config.instanceUrl}/services/data/v60.0/query/?q=SELECT+Id,Name,BillingCity,Phone,AnnualRevenue+FROM+Account+LIMIT+100`,
          {
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const records: Account[] = data.records.map((r: any) => ({
            id: r.Id,
            name: r.Name,
            location: r.BillingCity || 'Remote',
            phone: r.Phone || '',
            revenue: r.AnnualRevenue ? `$${r.AnnualRevenue.toLocaleString()}` : '',
          }));
          // Cache locally for offline use (FR-3.7)
          await AsyncStorage.setItem('sf_cached_accounts', JSON.stringify(records));
          this.localAccounts = records;
          return records;
        }
      } catch (err) {
        console.warn('Live Salesforce Account fetch failed, using local cache:', err);
      }
    }
    return this.localAccounts;
  }

  // Reads Contacts
  async getContacts(): Promise<Contact[]> {
    const config = await this.getConfig();
    if (config.isLive && config.accessToken && config.instanceUrl) {
      try {
        const response = await fetch(
          `${config.instanceUrl}/services/data/v60.0/query/?q=SELECT+Id,Name,Title,Email,Phone,AccountId+FROM+Contact+LIMIT+150`,
          {
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const records: Contact[] = data.records.map((r: any) => ({
            id: r.Id,
            name: r.Name,
            title: r.Title || 'Contact',
            email: r.Email || '',
            phone: r.Phone || '',
            accountId: r.AccountId || '',
          }));
          await AsyncStorage.setItem('sf_cached_contacts', JSON.stringify(records));
          this.localContacts = records;
          return records;
        }
      } catch (err) {
        console.warn('Live Salesforce Contact fetch failed, using local cache:', err);
      }
    }
    return this.localContacts;
  }

  // Reads Opportunities
  async getOpportunities(): Promise<Opportunity[]> {
    const config = await this.getConfig();
    if (config.isLive && config.accessToken && config.instanceUrl) {
      try {
        const response = await fetch(
          `${config.instanceUrl}/services/data/v60.0/query/?q=SELECT+Id,Name,StageName,Amount,CloseDate,AccountId+FROM+Opportunity+LIMIT+100`,
          {
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          const records: Opportunity[] = data.records.map((r: any) => ({
            id: r.Id,
            name: r.Name,
            stage: r.StageName || '',
            amount: r.Amount ? String(r.Amount) : '0',
            closeDate: r.CloseDate || '',
            accountId: r.AccountId || '',
          }));
          await AsyncStorage.setItem('sf_cached_opportunities', JSON.stringify(records));
          this.localOpportunities = records;
          return records;
        }
      } catch (err) {
        console.warn('Live Salesforce Opportunity fetch failed, using local cache:', err);
      }
    }
    return this.localOpportunities;
  }

  // Account disambiguation lookup
  async findAccountMatches(nameQuery: string): Promise<Account[]> {
    const accounts = await this.getAccounts();
    const cleanQuery = nameQuery.toLowerCase().trim();
    if (!cleanQuery) return [];
    return accounts.filter((acc) => acc.name.toLowerCase().includes(cleanQuery));
  }

  // Contact list matching for an Account
  async getContactsForAccount(accountId: string): Promise<Contact[]> {
    const contacts = await this.getContacts();
    return contacts.filter((c) => c.accountId === accountId);
  }

  // Write structured card submission to Salesforce
  async submitSalesforceRecord(data: ExtractedData): Promise<{ success: boolean; error?: string }> {
    // 1. Dynamic metadata validation (FR-3.6)
    if (!data.accountName) {
      return { success: false, error: 'Account Name is a required field.' };
    }
    if (!data.pipelineStage) {
      return { success: false, error: 'Pipeline Stage is required to create or update Opportunities.' };
    }
    if (!data.estimatedCloseDate) {
      return { success: false, error: 'Estimated Close Date is required.' };
    }

    const config = await this.getConfig();

    // If live integration is configured, perform REST post requests
    if (config.isLive && config.accessToken && config.instanceUrl) {
      try {
        // Step 1: Find/Create Account
        let accountId = '';
        const accMatches = await this.findAccountMatches(data.accountName);
        if (accMatches.length > 0) {
          accountId = accMatches[0].id;
        } else {
          // Create new Account
          const accRes = await fetch(`${config.instanceUrl}/services/data/v60.0/sobjects/Account`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ Name: data.accountName }),
          });
          if (accRes.ok) {
            const accData = await accRes.json();
            accountId = accData.id;
          }
        }

        if (!accountId) {
          throw new Error('Could not identify or create target Account in Salesforce.');
        }

        // Step 2: Create Opportunity
        const oppBody = {
          Name: `${data.accountName} - Opportunity`,
          StageName: data.pipelineStage,
          Amount: parseFloat(data.dollarAmount || '0') || 0,
          CloseDate: data.estimatedCloseDate,
          AccountId: accountId,
        };

        const oppRes = await fetch(`${config.instanceUrl}/services/data/v60.0/sobjects/Opportunity`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(oppBody),
        });

        if (!oppRes.ok) {
          const errTxt = await oppRes.text();
          throw new Error(`Opportunity creation failed: ${errTxt}`);
        }

        const oppData = await oppRes.json();
        const opportunityId = oppData.id;

        // Step 3: Create follow-up tasks if next steps exist
        if (data.nextSteps && data.nextSteps !== 'None') {
          await fetch(`${config.instanceUrl}/services/data/v60.0/sobjects/Task`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              Subject: `Follow-up: ${data.nextSteps.slice(0, 100)}`,
              Description: data.nextSteps,
              WhatId: opportunityId,
              Status: 'Not Started',
              Priority: 'Normal',
            }),
          });
        }

        return { success: true };
      } catch (err: any) {
        console.error('Salesforce write failed:', err);
        return { success: false, error: err.message || 'Salesforce write failed.' };
      }
    }

    // Mock local store fallback
    // Simulate successful write by creating mock entries
    const newOppId = `opp-${Date.now()}`;
    const newOpp: Opportunity = {
      id: newOppId,
      name: `${data.accountName} - Voice Opp`,
      stage: data.pipelineStage,
      amount: data.dollarAmount || '0',
      closeDate: data.estimatedCloseDate,
      accountId: `acc-${Date.now()}`,
    };

    this.localOpportunities.push(newOpp);
    await AsyncStorage.setItem('sf_cached_opportunities', JSON.stringify(this.localOpportunities));
    return { success: true };
  }
}

export const salesforceService = new SalesforceService();
export default salesforceService;
