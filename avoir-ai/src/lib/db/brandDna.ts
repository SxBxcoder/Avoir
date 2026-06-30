import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDynamoClient, TABLES } from './dynamodb';

export interface BrandDNA {
  userId: string;
  brandName: string;
  industry: string;
  targetAudience: string;
  toneOfVoice: string;
  coreValues: string;
  uniqueSellingProposition: string;
  referenceUrl?: string;
  updatedAt: string;
}

export async function getBrandDNA(userId: string): Promise<BrandDNA | null> {
  const params = {
    TableName: TABLES.BRAND_DNA,
    Key: { userId },
  };

  try {
    const { Item } = await getDynamoClient().send(new GetCommand(params));
    return Item ? (Item as BrandDNA) : null;
  } catch (error) {
    console.error('DynamoDB Error [getBrandDNA]:', error);
    return null;
  }
}

export async function saveBrandDNA(userId: string, dna: Omit<BrandDNA, 'userId' | 'updatedAt'>): Promise<BrandDNA> {
  const newDNA: BrandDNA = {
    userId,
    ...dna,
    updatedAt: new Date().toISOString(),
  };

  const params = {
    TableName: TABLES.BRAND_DNA,
    Item: newDNA,
  };

  try {
    await getDynamoClient().send(new PutCommand(params));
    return newDNA;
  } catch (error) {
    console.error('DynamoDB Error [saveBrandDNA]:', error);
    throw new Error('Failed to save Brand DNA');
  }
}
