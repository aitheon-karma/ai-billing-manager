import { Injectable } from '@angular/core';
import { RestService } from '@aitheon/core-client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SERVICE_IGNORE_LIST, Service } from './service.model';


@Injectable({
  providedIn: 'root'
})
export class ServiceService {

  constructor(private restService: RestService) { }

  private readonly serviceListUrl = `${this.restService.baseApi}/users/api/services`;

  listPersonal(): Observable<Service[]> {
    return this.list()
    .pipe(map(s => s.filter((ser: Service) => (ser.serviceType === 'any' || ser.serviceType === 'personal'))));
  }



  listOrganization(): Observable<Service[]> {

    return this.list()
    .pipe(map(s => s.filter((ser: Service) => (ser.serviceType === 'any' || ser.serviceType === 'organization'))));

  }

  list(): Observable<Service[]> {
    return this.restService.fetch(this.serviceListUrl, undefined, true)
    .pipe(map(s => s.sort((ser: Service) => ser.core ? 1 : -1)),
          map(s => s.filter((ser: Service) => !SERVICE_IGNORE_LIST.includes(ser._id))),
          map(s =>  s.map(service => { service.slug = this.slugify(service._id) ; return service; })));
  }


  // Slug helper
  private slugify(serviceId: string) {
    return serviceId.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  }

}
