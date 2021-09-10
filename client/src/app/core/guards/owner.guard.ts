import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';
import { AuthService } from '@aitheon/core-client';
import {  map, first } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OwnerGuard implements CanActivate {

  constructor(public authService: AuthService, public router: Router) {}

  canActivate() {
    const user$ = this.authService.currentUser.pipe(first());
    const org$ = this.authService.activeOrganization.pipe(first());

   return forkJoin([user$, org$]).pipe(map(results => {
      const user = results[0];
      const org = results[1];
      if (!org) {
        return true;
      }
      const role = user.roles.find((r: any) => (r.organization && r.organization._id) === (org && org._id));
      if (!role) {
        return false;
      }
      const serviceRole = role.services.find(s => s.service === environment.service);
      const isServiceAdmin = serviceRole.role === 'ServiceAdmin';
      return (['Owner', 'SuperAdmin', 'OrgAdmin'].includes(role.role) || isServiceAdmin);
    }));

   }
}
