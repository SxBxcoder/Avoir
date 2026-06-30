/**
 * Avoir — Database Module Index
 * 
 * Clean barrel export for the entire data layer.
 * Import everything from '@/lib/db' in your API routes.
 */

// DynamoDB Client
export { getDynamoClient, TABLES } from './dynamodb';

// User Repository (Subscriptions)
export {
  getSubscription,
  upsertSubscription,
  deductCredits,
} from './users';

// Campaign Repository
export {
  createCampaign,
  getCampaign,
  listCampaigns,
  deleteCampaign,
  type Campaign,
} from './campaigns';

// Redis Cache
export {
  getCachedQuota,
  setCachedQuota,
  incrementCachedQuota,
  checkRateLimit,
  getCachedCampaign,
  setCachedCampaign,
} from './cache';
