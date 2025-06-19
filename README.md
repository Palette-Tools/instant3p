# Instant 3rd Party
<img src="instant3p-logo.png" height="100px"/>

<!-- Badges -->
[![npm](https://img.shields.io/npm/v/@instant3p/electron?label=@instant3p/electron)](https://www.npmjs.com/package/@instant3p/electron)
[![npm](https://img.shields.io/npm/v/@instant3p/cli?label=@instant3p/cli)](https://www.npmjs.com/package/@instant3p/cli)

## 🎯 Mission

**Extending InstantDB to every platform, maintained by the community.**

We believe InstantDB's real-time database should work everywhere developers want to build. When official support isn't available, `@instant3p` ecosystem provides additional production-ready InstantDB clients and tools.

## 📦 Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@instant3p/electron`](packages/electron/) | ![npm](https://img.shields.io/npm/v/@instant3p/electron) | InstantDB client for Electron apps with secure auth bridge |
| [`@instant3p/cli`](packages/cli/) | ![npm](https://img.shields.io/npm/v/@instant3p/cli) | Enhanced CLI that supports third-party InstantDB clients |

## 🚀 Quick Start

The `@instant3p/cli` is a drop-in replacement for the official `instant-cli` with additional support for third-party clients:

```bash
# Works with 3rd party InstantDB packages
❯ npx @instant3p/cli@latest init
Checking for an Instant SDK...
Couldn't find an Instant SDK in your package.json, let's install one!
? Which package would you like to use?
  @instantdb/react
  @instantdb/react-native
  @instantdb/core
  @instantdb/admin
❯ @instant3p/electron
```



## 🛠 Development

This monorepo uses **pnpm workspaces** and **Turborepo** for efficient development and building.

### Setup

```bash
# Clone with submodules (includes InstantDB source for version sync)
git clone --recursive https://github.com/your-username/instant3p.git
cd instant3p

# Install dependencies and build
pnpm setup
```

### Key Commands

```bash
# Development
pnpm dev                    # Watch mode for all packages
pnpm build                  # Build all packages  

# Version Management
pnpm sync-versions          # Sync all packages with InstantDB submodule versions

# Local Testing with Verdaccio
pnpm verdaccio:start        # Start local npm registry
pnpm verdaccio:publish      # Publish packages to local registry
pnpm verdaccio:cleanup      # Shut down and clean up local registry
```

## 🔄 Developer Workflows

### Version Synchronization

All `@instant3p` packages automatically stay in sync with the official InstantDB packages:

```bash
# This script reads versions from the InstantDB submodule
# and updates all package.json files to match
pnpm sync-versions
```

**How it works:**
- InstantDB is included as a Git submodule at `./instant/`
- The `sync-versions` script reads package versions from `instant/client/packages/`
- All `@instant3p` packages get updated to match the latest InstantDB version
- Both package versions and dependency versions are synchronized

### Testing with Verdaccio

Before publishing to npm, test the complete package installation flow:

```bash
# Or run step by step:
pnpm verdaccio:start       # Start local registry
pnpm verdaccio:publish     # Publish to local registry

# Test installing packages as a user would
pnpm verdaccio:cleanup     # Clean up
```

**What this tests:**
- Package builds correctly
- Dependencies resolve properly
- CLI tools work after installation
- Real-world user experience

### CLI Maintenance

The `@instant3p/cli` is a **fork** of the official InstantDB CLI with enhancements:

```bash
# See differences from upstream
cd packages/cli
pnpm diff-original

# When InstantDB CLI updates, manually sync changes
# (This is a manual process since we maintain a fork)
```

**Important:** CLI updates require manual intervention since we maintain our own fork to add third-party client support.

## 🏗 Architecture

### Monorepo Structure

```
instant3p/
├── packages/
│   ├── cli/                # @instant3p/cli - Enhanced CLI
│   ├── electron/           # @instant3p/electron - Electron client  
│   └── scripts/            # Development and testing scripts
├── instant/                # InstantDB submodule for version sync
├── turbo.json              # Turborepo configuration
└── package.json            # Workspace configuration
```

### Third-Party Client Registration

New clients can be added to the CLI by updating `packages/cli/supported-clients.json`:

```json
{
  "modules": [
    "@instantdb/react",
    "@instantdb/react-native", 
    "@instantdb/core",
    "@instantdb/admin",
    "@instant3p/electron",
    "@instant3p/your-new-client"
  ]
}
```

### Version Management Strategy

All packages follow a **universal versioning** approach:
- Package versions match the InstantDB version they're compatible with
- Dependencies on `@instantdb/*` packages use exact versions from the submodule
- Internal dependencies between `@instant3p/*` packages use the same universal version

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Adding a New Client

1. **Create the package** in `packages/your-client/`
2. **Add to supported clients** in `packages/cli/supported-clients.json`
3. **Follow versioning** - use `pnpm sync-versions` to match InstantDB versions
4. **Test thoroughly** with the Verdaccio workflow
5. **Submit a PR** with documentation

### Development Guidelines

- **Use the InstantDB submodule** to ensure compatibility
- **Follow existing patterns** for package structure
- **Test with Verdaccio** before submitting PRs
- **Document your client** with examples and demos
- **Keep dependencies minimal** and aligned with InstantDB

## 📚 Documentation

- **[Electron Client Guide](packages/electron/README.md)** - Complete Electron guide
  - **[Electron Auth Demo](packages/electron/demos/auth/README.md)** - Auth sync between NodeJS & browser
  - **[Electron Notifications Demo](packages/electron/demos/notifications/README.md)** - Native desktop push notifications
- **[CLI Documentation](packages/cli/README.md)** - Enhanced CLI features and usage
- **[Development Scripts](packages/scripts/README.md)** - Testing and development workflows

## 🔗 Links

- **InstantDB** - [Website](https://instantdb.com) | [GitHub](https://github.com/instantdb/instant)
- **Community** - [Discord](https://discord.gg/VU53p7uQcE) | [Twitter](https://twitter.com/instantdb)

---
**Made with ❤️ by the InstantDB community**