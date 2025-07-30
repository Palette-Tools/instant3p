import { STORY_CHANGED } from 'storybook/internal/core-events';
import { addons, types } from 'storybook/manager-api';
import { createElement } from 'react';
import { ResetPanel } from './components/ResetPanel.js';

const ADDON_ID = 'instant-db';
const PANEL_ID = `${ADDON_ID}/panel`;
const PARAM_KEY = 'instantdb';

// Register the addon
addons.register(ADDON_ID, () => {
  // Add the reset button to the toolbar
  addons.add(PANEL_ID, {
    type: types.TOOL,
    title: 'Reset InstantDB',
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
    render: () => createElement(ResetPanel),
  });
});

export const instant = {
  ADDON_ID,
  PANEL_ID,
  PARAM_KEY,
}; 