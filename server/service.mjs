// @ts-check
// The Composer service declaration — the doorway through which the server
// gets everything the deployment provides. Composer reads this file to wire
// the app; server.js imports it at runtime for its port and input values.
import node from '@prisma/composer/node';
import { compute } from '@prisma/composer-prisma-cloud';
import { type } from 'arktype';
import { secretString } from '@prisma/composer/arktype';

// Values only the deployment has, each optional so that absence keeps
// meaning exactly what it meant as an unset environment variable: no
// session secret → one is generated and persisted, no static base URL →
// the static folder is served locally, no S3 vars → uploads land on the
// local disk, no admin usernames → data/admins.json is used.
const input = type({
  sessionSecret: secretString().optional(),
  staticBaseUrl: secretString().optional(),
  adminUsernames: secretString().optional(),
  s3Endpoint: secretString().optional(),
  s3Region: secretString().optional(),
  s3Bucket: secretString().optional(),
  s3AccessKeyId: secretString().optional(),
  s3SecretAccessKey: secretString().optional(),
  s3PublicUrlBase: secretString().optional(),
});

export default compute({
  name: 'site',
  deps: {},
  input,
  // The app runs from source (no compile step); the build (npm run build)
  // assembles the deployable output in dist/, and the deploy stages the
  // runtime packages the entry imports.
  build: node({ module: import.meta.url, dir: 'dist', entry: 'server.js', dependencies: 'external' }),
});
