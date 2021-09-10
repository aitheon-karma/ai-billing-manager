import { Service as TypeDiService, Inject } from 'typedi';
import Db from '@aitheon/core-server/dist/config/db';
import { Service } from './service.model';
import * as _ from 'lodash';
import { logger } from '@aitheon/core-server';
const SERVICES_COLLECTION_NAME = 'services';

export const SERVICE_IGNORE_LIST = ['ADMIN', 'USERS', 'AUTH', 'APP_SERVER', 'PLATFORM_SUPPORT',
                                    'LANDING', 'COMMUNITY', 'TEMPLATE', 'STATUS',
                                    'MAIL', 'BUILD_SERVER', 'SYSTEM_GRAPH', 'UTILITIES'];

@TypeDiService()
export class ServicesService {

 private serviceList: Service[];

 constructor() {
  this.init();
 }

 async init(refresh = false) {
    if (this.serviceList && !refresh) {
      return logger.info('[ServicesService.init]: Services already initialized');
    }
    const cursor = await Db.connection.collection(SERVICES_COLLECTION_NAME).find({envStatus: 'PROD'});
    this.serviceList = [];
    cursor.forEach((service) => {
     this.serviceList.push(service);
    }, (err) => {
      if (err) {
        this.serviceList = undefined;
        logger.error('[ServicesService.init]: Failed', err);
        // retry to get the services again
        return setTimeout(() => this.init(), 1000);
      }
      logger.info('[ServicesService.init]: Services initialized');
    });
  }

  get services() {
    if (!this.serviceList) {
      throw Error('Services not initialized');
    }
    return _.clone(this.serviceList);
  }

  get organizationServices() {
    if (!this.serviceList) {
      throw Error('Services not initialized');
    }
    const organizationServices = this.serviceList.filter(s => (s.serviceType == 'organization' || s.serviceType == 'any'));
    return _.clone(organizationServices);
  }


}
