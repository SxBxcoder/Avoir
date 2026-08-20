#!/usr/bin/env node
/**
 * Avoir — VAPID Key Generator
 *
 * Run once to generate a VAPID keypair for Web Push notifications.
 * Copy the output into your .env file:
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
 *   VAPID_PRIVATE_KEY=<privateKey>
 *
 * Usage: node scripts/generate-vapid-keys.mjs
 */

import webPush from 'web-push';

const vapidKeys = webPush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env file:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('\n============================\n');
