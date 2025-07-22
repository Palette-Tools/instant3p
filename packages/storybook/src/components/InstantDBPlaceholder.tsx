import React from 'react';

export interface InstantDBPlaceholderProps {
  storyName?: string;
  schema?: any;
  onViewStory?: () => void;
}

export const InstantDBPlaceholder: React.FC<InstantDBPlaceholderProps> = ({
  storyName = "this story",
  schema,
  onViewStory,
}) => {
  const schemaEntities = schema?.entities ? Object.keys(schema.entities) : [];
  const schemaLinks = schema?.links ? Object.keys(schema.links) : [];

  return (
    <div style={{
      border: '2px dashed #e0e0e0',
      borderRadius: '8px',
      padding: '24px',
      textAlign: 'center',
      backgroundColor: '#fafafa',
      color: '#666',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '400px',
      margin: '0 auto',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>
        🗄️
      </div>
      
      <h3 style={{ 
        margin: '0 0 8px 0', 
        fontSize: '16px', 
        fontWeight: '600', 
        color: '#333' 
      }}>
        InstantDB Story
      </h3>
      
      <p style={{ 
        margin: '0 0 16px 0', 
        fontSize: '14px', 
        lineHeight: '1.4' 
      }}>
        This story uses InstantDB with an isolated database.
        {schemaEntities.length > 0 && (
          <span>
            <br />
            <strong>Entities:</strong> {schemaEntities.join(', ')}
          </span>
        )}
        {schemaLinks.length > 0 && (
          <span>
            <br />
            <strong>Relations:</strong> {schemaLinks.join(', ')}
          </span>
        )}
      </p>

      <button
        onClick={onViewStory}
        style={{
          backgroundColor: '#1ea7fd',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#1976d2';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#1ea7fd';
        }}
      >
        View Interactive Story →
      </button>

      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#999',
        fontStyle: 'italic'
      }}>
        Multiple InstantDB stories can't run simultaneously.<br />
        Click above to see the full interactive experience.
      </div>
    </div>
  );
}; 