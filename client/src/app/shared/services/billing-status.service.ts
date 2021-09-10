import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { first, map } from "rxjs/operators";
import { AuthService } from "@aitheon/core-client";

export interface CurrentBillingStatus {
  name: string;
  className: string;
}

@Injectable({
  providedIn: 'root'
})
export class BillingStatusService {

  constructor(
    private authService: AuthService
  ) { }

  currentUser$: Observable<any>;

  getCurrentUser(): Observable<any> {
    return <any>this.authService.currentUser.pipe(
      first(),
      map(user => {
        return {
          name: user.billing.status,
          className: this.getStatusClass(user.billing.status)
        }
      })
    );
  }

  getStatusClass(status) {
    let labelColor;

    switch (status.toLowerCase()) {
      case 'frozen':
        labelColor = 'status-label--frozen';
        break;
      case 'active':
        labelColor = 'status-label--active';
        break;
      case 'suspended':
        labelColor = 'status-label--suspended';
        break;
    }
    return labelColor;
  }
}
