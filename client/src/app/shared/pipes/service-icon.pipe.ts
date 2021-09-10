import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'serviceIcon'
})
export class ServiceIconPipe implements PipeTransform {

  transform(serviceId: string) {
    let iconClass = '';

    if (serviceId) {
      iconClass = serviceId.toLowerCase();
    } else {
      iconClass = 'no-service-icon'
    }

    return iconClass;
  }
}
