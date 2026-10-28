type ImportMetaWithEnv = ImportMeta & { env?: { DEV?: boolean } };

const env = (import.meta as ImportMetaWithEnv).env;
const isDev = env?.DEV === true;

export const APP_ID = 'com.emdash.stable';
export const PRODUCT_NAME = 'Emdash';
export const APP_NAME_LOWER = 'emdash';
export const LINUX_DESKTOP_ID = 'Emdash';
export const USER_DATA_DIR_NAME = isDev ? 'emdash-dev' : 'emdash';
/** Off in this fork: the update feed serves upstream Emdash builds, which would replace it. */
export const AUTO_UPDATE_ENABLED = false;
export const UPDATE_CHANNEL = 'v1-stable';
export const ARTIFACT_PREFIX = 'emdash';
export const R2_BASE_URL = 'https://releases.emdash.sh';
