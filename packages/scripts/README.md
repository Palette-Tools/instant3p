# @instant3p/scripts

Development scripts for the instant3p monorepo.

## Scripts

### Verdaccio Testing

These scripts help test the package publishing workflow using a local Verdaccio registry:

- `verdaccio:start` - Start Verdaccio server and setup authentication
- `verdaccio:publish` - Build and publish packages to local registry  
- `verdaccio:cleanup` - Clean up everything (restore registry, stop server, clean files)

### Usage

Run from the monorepo root:

```bash
# Individual commands
pnpm verdaccio:start
pnpm verdaccio:publish  
pnpm verdaccio:cleanup
```

### What Each Script Does

#### `start.ts`
- Installs Verdaccio if not present
- Starts fresh Verdaccio instance on `http://localhost:4873`
- Sets up npm authentication with test user

#### `publish.ts`
- Fixes package dependencies for publishing
- Builds all packages
- Updates versions with test suffix
- Publishes to local registry

#### `cleanup.ts`
- Restores original npm registry
- Stops Verdaccio server
- Cleans up test files and global packages