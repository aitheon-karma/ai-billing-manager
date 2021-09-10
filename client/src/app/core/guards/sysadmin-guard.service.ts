import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';
import { AuthService } from '@aitheon/core-client';
import { first } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class SysAdminGuardService {

  constructor(public authService: AuthService, public router: Router) {}

  async canActivate() {
    try {
      const user = await this.authService.currentUser.pipe(first()).toPromise();
      if (user && user.sysadmin) {
        return true;
      } else {
        this.router.navigate(['/']);
        return false;
      }
    } catch (err) {
      this.router.navigate(['/']);
      return false;
    }
  }

}
