import { withInstantDB } from './decorator.js';

// Add the decorator globally
export const decorators = [withInstantDB];

// The reset functionality is now handled directly in the decorator
// via the channel communication with the ResetPanel component 