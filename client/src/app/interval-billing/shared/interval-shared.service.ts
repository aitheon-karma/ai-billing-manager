import { Injectable } from '@angular/core';

import * as moment from 'moment';

@Injectable({
  providedIn: 'root',
})
export class IntervalSharedService {

  formatTime(time: number, defaultValue = 0) {
    const tempTime = moment.duration(time);

    const days = tempTime.days() || 0;
    const hours = tempTime.hours();
    const minutes = tempTime.minutes();
    const formatUnits = (value: number, descr: string) => {
      return value && `${value}${descr} ` || '';
    };
    if (hours || minutes) {
      return `${formatUnits(hours + days * 24, 'h')}${formatUnits(minutes, 'm')}`;
    }
    return defaultValue;
  }

  roundNumber(value: number, decimals = 4) {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
  }
}
