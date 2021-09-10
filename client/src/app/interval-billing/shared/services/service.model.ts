export class Service {
  _id: string;
  name: string;
  description: string;
  enabled: boolean;
  dependencies: Array<string>;
  serviceType: string;
  image: string;
  core: boolean;

  // only in client
  slug: string;
}


export const SERVICE_IGNORE_LIST = ['ADMIN', 'USERS', 'AUTH', 'APP_SERVER', 'MAIL',
  'LANDING', 'COMMUNITY', 'STATUS', 'BUILD_SERVER', 'SYSTEM_GRAPH', 'UTILITIES', 'PLATFORM_SUPPORT', 'DRIVE'];
