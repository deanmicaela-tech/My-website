import { getStore } from '@netlify/blobs';
import { createHandler } from '../lib/mats-core.mjs';

export default (req, context) =>
  createHandler({ store: getStore({ name: 'mat-bookings', consistency: 'strong' }) })(req, context);

export const config = { path: '/api/mats' };
