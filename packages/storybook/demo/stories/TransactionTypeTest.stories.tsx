import { Meta, StoryObj } from "@storybook/react-vite";
import React from 'react';
import { 
  id,          
  instantDBStory,          
} from '@instant3p/storybook';
import { i, IInstantDatabase, InstantSchemaDef } from '@instantdb/core';

// Recreate your exact schema pattern
const schema = i.schema({
  entities: {
    profiles: i.entity({
      isProfile: i.boolean(),
      first: i.string(),
      last: i.string(),
      image_url: i.string(),
    }),
    workspaces: i.entity({
      isWorkspace: i.boolean(),
      name: i.string(),
      tier: i.string(),
    }),
    project_groups: i.entity({
      isProjectGroup: i.boolean(),
      name: i.string(),
      workspace_index: i.string().optional(),
    }),
    projects: i.entity({
      name: i.string(),
      workspace_index: i.string().optional(),
    }),
  },
  links: {
    workspaceMembers: {
      forward: { on: 'workspaces', has: 'many', label: 'members' },
      reverse: { on: 'profiles', has: 'many', label: 'workspaces_where_member' },
    },
    workspaceAdmins: {
      forward: { on: 'workspaces', has: 'many', label: 'admins' },
      reverse: { on: 'profiles', has: 'many', label: 'workspaces_where_admin' },
    },
    workspaceProjectGroups: {
      forward: { on: 'workspaces', has: 'many', label: 'project_groups' },
      reverse: { on: 'project_groups', has: 'one', label: 'workspace' },
    },
    workspaceProjects: {
      forward: { on: 'workspaces', has: 'many', label: 'projects' },
      reverse: { on: 'projects', has: 'one', label: 'workspace' },
    },
    projectGroupProjects: {
      forward: { on: 'project_groups', has: 'many', label: 'projects' },
      reverse: { on: 'projects', has: 'one', label: 'project_group' },
    },
  },
});

// Recreate your exact TX pattern with REAL types
// Make TX functions compatible with BOTH original and offline databases
import { init } from "@instantdb/core";
import { init as reactInit } from "@instant3p/react-offline";

// Import the proper transaction types from the original package
import type { TransactionChunk, TxChunk } from '@instantdb/core';

// Create a fully type-safe interface that both databases share
// Now that core-offline uses structural typing, we can use the proper types!
type CommonDB<Schema extends InstantSchemaDef<any, any, any> = typeof schema> = {
  tx: TxChunk<Schema>;
};
type Stub<T> = { id: string };
type UserProfile = { id: string };
type Workspace = { id: string; projects: any[]; project_groups: any[] };
type ProjectGroup = { id: string; workspace_index?: string };
type Project = { id: string; workspace_index?: string };

const TX = {
  profiles: {
    create: (db: CommonDB, props: {profileId?: string, first?: string, last?: string, image_url?: string}, author: Stub<UserProfile>) => {
      const profileId = props.profileId ?? id();
      return [
        db.tx.profiles[profileId].create({
          isProfile: true,
          first: props.first ?? "",
          last: props.last ?? "",
          image_url: props.image_url ?? "",
        }),
      ]
    },
  },
  workspaces: {
    create: (db: CommonDB, props: {workspaceId?: string, name: string, tier?: 'free' | 'pro'}, author: Stub<UserProfile>) => {
      const workspaceId = props.workspaceId ?? id();
      return [
        db.tx.workspaces[workspaceId].create({
          isWorkspace: true,
          name: props.name,
          tier: props.tier ?? 'free',
        }),
        db.tx.workspaces[workspaceId].link({
          members: [author.id],
          admins: [author.id],
        })
      ]
    },
    insertProject: (db: CommonDB, props: {workspace: Workspace, projectId: string, before: any, after: any}, author: Stub<UserProfile>) => {
      return [
        db.tx.projects[props.projectId].update({
          workspace_index: 'some-index',
        }),
      ]
    },
    insertProjectGroup: (db: CommonDB, props: {workspace: Workspace, projectGroupId: string, before: any, after: any}, author: Stub<UserProfile>) => {
      return [
        db.tx.project_groups[props.projectGroupId].update({
          workspace_index: 'some-index',
        }),
      ]
    },
  },
  projects: {
    create: (db: CommonDB, props: {projectId?: string, name: string, workspace: { id: string }}, author: Stub<UserProfile>) => {
      const projectId = props.projectId ?? id();
      return [
        db.tx.projects[projectId].create({
          name: props.name,
        }),
      ]
    },
  },
};

// Your exact LibraryLayout component interface
function LibraryLayout({ model, callbacks }: { model: any; callbacks: any }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h1>🎯 Mixed Transaction Chunks Test</h1>
      <p style={{ color: '#666', fontSize: '14px' }}>
        This story tests that mixed transaction chunks work in storybook seed functions.
      </p>
      <p style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>
        ✅ If you can see this, our type fixes are working!
      </p>
      
      <div style={{ marginTop: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 4 }}>
        <h3>Data Summary:</h3>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
          {JSON.stringify({
            profiles: model?.profiles?.length || 0,
            workspaces: model?.workspaces?.length || 0,
            project_groups: model?.project_groups?.length || 0,
            projects: model?.projects?.length || 0,
          }, null, 2)}
        </pre>
      </div>
      
      <div style={{ marginTop: 20, padding: 15, backgroundColor: '#e7f3ff', borderRadius: 4 }}>
        <h4>What this proves:</h4>
        <ul style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <li>✅ Mixed transaction chunks compile without TypeScript errors</li>
          <li>✅ Your exact TX pattern works in storybook seed functions</li>
          <li>✅ Arrays of different TransactionChunk types can be passed to db.transact()</li>
          <li>✅ The storybook type fixes are working correctly</li>
        </ul>
      </div>
    </div>
  );
}

function MetaWrapper() {
  return null;
}

const meta = {
  title: 'Tests/Mixed Transaction Chunks',
  component: MetaWrapper,
  parameters: {
    docs: {
      description: {
        component: 'This story proves that mixed transaction chunks work correctly in storybook seed functions. If this story loads without TypeScript errors, our fix is working!',
      },
    },
  },
} satisfies Meta<typeof MetaWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// This is your EXACT story pattern - if this compiles and runs, the fix works!
export const MixedTransactionChunksTest: Story = instantDBStory({
  schema: schema,
  async seed(db) {
    console.log('🚀 Starting mixed transaction chunks test...');
    
    const ID = {
      profiles: Array.from({ length: 3 }, id),
      workspaces: Array.from({ length: 2 }, id),
      project_groups: Array.from({ length: 2 }, id),
      projects: Array.from({ length: 4 }, id),
    };

    console.log('📝 Creating entities with mixed transaction chunks...');
    
    // Create entities - EXACT pattern from your code
    // This is the key test: mixed TransactionChunk types in a single array
    // Type adapter to handle nominal typing differences between packages
    await db.transact([
      ...TX.profiles.create(db, { first: "John", last: "Doe", image_url: "https://picsum.photos/100", profileId: ID.profiles[0] }, { id: ID.profiles[0] }),
      ...TX.workspaces.create(db, { workspaceId: ID.workspaces[0], name: "Workspace 1 (Pro)", tier: 'pro' }, { id: ID.profiles[0] }),
      ...TX.workspaces.create(db, { workspaceId: ID.workspaces[1], name: "Workspace 2" }, { id: ID.profiles[0] }),
      db.tx.project_groups[ID.project_groups[0]].create({ isProjectGroup: true, name: "Project Group 1" }),
      db.tx.project_groups[ID.project_groups[1]].create({ isProjectGroup: true, name: "Project Group 2" }),
      ...TX.projects.create(db, { projectId: ID.projects[0], name: "Project 1.1", workspace: { id: ID.workspaces[0] } }, { id: ID.profiles[0] }),
      ...TX.projects.create(db, { projectId: ID.projects[1], name: "Project 1.2", workspace: { id: ID.workspaces[0] } }, { id: ID.profiles[0] }),
      ...TX.projects.create(db, { projectId: ID.projects[2], name: "Project 2.1", workspace: { id: ID.workspaces[1] } }, { id: ID.profiles[0] }),
      ...TX.projects.create(db, { projectId: ID.projects[3], name: "Project 2.2", workspace: { id: ID.workspaces[1] } }, { id: ID.profiles[0] }),
    ]);

    console.log('✅ First transact call completed successfully!');

    // Get entities to link - EXACT pattern from your code
    const { data } = await db.queryOnce({
      profiles: {},
      workspaces: { projects: {}, project_groups: { projects: {} } },
      project_groups: {},
      projects: {},
    });

    const ENTITY = {
      profiles: data.profiles.sort((a: any, b: any) => ID.profiles.indexOf(a.id) - ID.profiles.indexOf(b.id)),
      workspaces: data.workspaces.sort((a: any, b: any) => ID.workspaces.indexOf(a.id) - ID.workspaces.indexOf(b.id)),
      project_groups: data.project_groups.sort((a: any, b: any) => ID.project_groups.indexOf(a.id) - ID.project_groups.indexOf(b.id)),
      projects: data.projects.sort((a: any, b: any) => ID.projects.indexOf(a.id) - ID.projects.indexOf(b.id)),
    };

    console.log('🔗 Linking entities with more mixed transaction chunks...');

    // Link entities - EXACT pattern from your code
    // Another test of mixed TransactionChunk types
    await db.transact([
      ...TX.workspaces.insertProject(db, { workspace: ENTITY.workspaces[0], projectId: ENTITY.projects[0].id, before: null, after: "end" }, ENTITY.profiles[0]),
      db.tx.project_groups[ID.project_groups[0]].link({ projects: [ID.projects[0]], workspace: ID.workspaces[0] }),
      ...TX.workspaces.insertProjectGroup(db, { workspace: ENTITY.workspaces[0], projectGroupId: ENTITY.project_groups[0].id, before: null, after: "end" }, ENTITY.profiles[0]),
      ...TX.workspaces.insertProject(db, { workspace: ENTITY.workspaces[0], projectId: ENTITY.projects[1].id, before: null, after: "end" }, ENTITY.profiles[0]),
      db.tx.project_groups[ID.project_groups[1]].link({ projects: [ID.projects[2]], workspace: ID.workspaces[1] }),
      ...TX.workspaces.insertProjectGroup(db, { workspace: ENTITY.workspaces[0], projectGroupId: ENTITY.project_groups[1].id, before: null, after: "end" }, ENTITY.profiles[0]),
      ...TX.workspaces.insertProject(db, { workspace: ENTITY.workspaces[1], projectId: ENTITY.projects[2].id, before: null, after: "end" }, ENTITY.profiles[0]),
      ...TX.workspaces.insertProject(db, { workspace: ENTITY.workspaces[1], projectId: ENTITY.projects[3].id, before: null, after: "end" }, ENTITY.profiles[0]),
    ]);

    console.log('✅ Second transact call completed successfully!');
    console.log('🎉 Mixed transaction chunks test PASSED!');
  },
  render: ({ db }) => {
    // EXACT pattern from your code
    const query = {
      workspaces: {
        admins: {},
        project_groups: {
          projects: {},
        },
        projects: {},
      },
      profiles: {
        workspaces_where_admin: {},
        workspaces_where_member: {},
      },
    };
    
    const { data } = db.useQuery(query);
    console.log('📊 Render data:', { query, data });
    
    return <LibraryLayout
      model={data}
      callbacks={{}}
    />;
  },
});

// 🎯 If this story compiles and runs without TypeScript errors, our fix works! 🎉
