const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mode = process.argv[2];
if (mode !== 'sqlite' && mode !== 'postgres') {
    console.error('Usage: node scripts/switch-db.js [sqlite|postgres]');
    process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const envPath = path.join(rootDir, '.env');

console.log(`Switching database configuration to: ${mode.toUpperCase()}...`);

// 1. Update schema.prisma
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

if (mode === 'sqlite') {
    // Replace datasource block
    schemaContent = schemaContent.replace(
        /datasource db \{[\s\S]*?\}/,
        `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`
    );

    // Replace Json features default (SQLite does not support JSON defaults in Prisma)
    schemaContent = schemaContent.replace(
        /features\s+Json\s+@default\([\s\S]*?\)/,
        `features      Json // Default removed for SQLite compatibility`
    );
} else {
    // Replace datasource block
    schemaContent = schemaContent.replace(
        /datasource db \{[\s\S]*?\}/,
        `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
    );

    // Restore Json features default
    schemaContent = schemaContent.replace(
        /features\s+Json\s+\/\/.*|features\s+Json\s*$/,
        `features      Json     @default("{\\"voice\\":false,\\"video\\":false,\\"api\\":false,\\"priority\\":false}")`
    );
}

fs.writeFileSync(schemaPath, schemaContent, 'utf8');
console.log('✓ Updated prisma/schema.prisma');

// 2. Update .env
let envContent = fs.readFileSync(envPath, 'utf8');

if (mode === 'sqlite') {
    // Comment out postgres database URLs if they are not already commented
    envContent = envContent.replace(/^(DATABASE_URL="postgres.*")/m, '# $1');
    envContent = envContent.replace(/^(DIRECT_URL="postgres.*")/m, '# $1');

    // Add or uncomment sqlite URL
    if (envContent.includes('DATABASE_URL="file:./dev.db"')) {
        // Already active
    } else if (envContent.includes('# DATABASE_URL="file:./dev.db"')) {
        envContent = envContent.replace('# DATABASE_URL="file:./dev.db"', 'DATABASE_URL="file:./dev.db"');
    } else {
        envContent += '\n# SQLite Local Database Configuration\nDATABASE_URL="file:./dev.db"\n';
    }
} else {
    // Uncomment postgres database URLs
    envContent = envContent.replace(/^#\s*(DATABASE_URL="postgres.*")/m, '$1');
    envContent = envContent.replace(/^#\s*(DIRECT_URL="postgres.*")/m, '$1');

    // Comment out sqlite URL
    envContent = envContent.replace(/^(DATABASE_URL="file:.*")/m, '# $1');
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✓ Updated .env');

// 3. Regenerate Prisma Client
try {
    console.log('Regenerating Prisma client...');
    execSync('npx prisma generate', { cwd: rootDir, stdio: 'inherit' });
    console.log('✓ Prisma client generated successfully.');
} catch (error) {
    console.error('Error generating Prisma client:', error.message);
    process.exit(1);
}

console.log(`\nSuccessfully switched to ${mode.toUpperCase()} mode!`);
if (mode === 'sqlite') {
    console.log('Next steps:');
    console.log('  1. Sync schema to local DB:  npx prisma db push');
    console.log('  2. Seed admin user:          npx tsx prisma/setup-admin-user.ts');
}
