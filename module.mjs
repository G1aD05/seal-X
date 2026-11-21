// @ts-check
// The Composer module. Its name decides which project on Prisma Cloud the
// app deploys to.
import { module } from '@prisma/composer';
import { envSecret } from '@prisma/composer-prisma-cloud';
import site from './server/service.mjs';

export default module('seal-x', ({ provision }) => {
  provision(site, {
    input: {
      sessionSecret: envSecret('SESSION_SECRET'), // Signs session cookies.
      staticBaseUrl: envSecret('STATIC_BASE_URL'), // Serves games, tools and thumbnails from the static host.
      adminUsernames: envSecret('ADMIN_USERNAMES'), // Lists the site's Tier 3 admin usernames.
      s3Endpoint: envSecret('S3_ENDPOINT'), // Endpoint of the S3 bucket that stores uploaded files.
      s3Region: envSecret('S3_REGION'), // Region of the S3 bucket that stores uploaded files.
      s3Bucket: envSecret('S3_BUCKET'), // Name of the S3 bucket that stores uploaded files.
      s3AccessKeyId: envSecret('S3_ACCESS_KEY_ID'), // Access key id for the S3 bucket that stores uploaded files.
      s3SecretAccessKey: envSecret('S3_SECRET_ACCESS_KEY'), // Secret access key for the S3 bucket that stores uploaded files.
      s3PublicUrlBase: envSecret('S3_PUBLIC_URL_BASE'), // Public base URL under which uploaded files are served.
    },
  });
});
