import React, { useCallback, useState } from 'react';
import { useGlobals, useStorybookApi } from '@storybook/manager-api';
import { IconButton, TooltipLinkList, WithTooltip } from '@storybook/components';
import { useChannel } from '@storybook/manager-api';

const RESET_EVENT = 'instant-db/reset';

export const ResetPanel: React.FC = () => {
  const [globals] = useGlobals();
  const api = useStorybookApi();
  const [isResetting, setIsResetting] = useState(false);
  
  const emit = useChannel({
    [RESET_EVENT]: () => {
      setIsResetting(false);
    },
  });

  const handleReset = useCallback(() => {
    setIsResetting(true);
    
    // Emit reset event to the preview frame
    emit(RESET_EVENT);
    
    // Reset state after a short delay
    setTimeout(() => {
      setIsResetting(false);
    }, 1000);
  }, [emit]);

  const currentStory = api.getCurrentStoryData();
  const hasInstantDB = currentStory?.parameters?.instantdb;

  if (!hasInstantDB) {
    return null;
  }

  return React.createElement(WithTooltip, {
    placement: "top",
    trigger: "click",
    tooltip: ({ onHide }: any) => React.createElement(TooltipLinkList, {
      links: [
        {
          id: 'reset',
          title: 'Reset Database',
          onClick: () => {
            handleReset();
            onHide();
          },
        },
      ]
    }),
    children: React.createElement(IconButton as any, {
      key: "instant-db-reset",
      active: isResetting,
      title: "Reset InstantDB"
    }, isResetting ? '🔄' : '🗄️')
  });
}; 