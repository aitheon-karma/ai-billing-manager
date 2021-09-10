import { Component, OnInit, Input } from '@angular/core';
import { ServiceService } from '../../shared/services/services.service';
import { Service } from '../../shared/services/service.model';
import { THIS_EXPR } from '@angular/compiler/src/output/output_ast';
import {Price} from '@aitheon/billing-manager';
import { AdminRestService } from '@aitheon/billing-manager';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FormGroup, FormBuilder } from '@angular/forms';

@Component({
  selector: 'ai-services-settings',
  templateUrl: './services-settings.component.html',
  styleUrls: ['./services-settings.component.scss']
})
export class ServicesSettingsComponent implements OnInit {
  @Input() tab: string;
  
  searchForm: FormGroup;
  TabType =  Price.TypeEnum;
  detailsVisible = false;
  services: Service[];
  selectedService: Service;
  allServices: Service[];
  prices: Price[];
  requests$: Observable<[Service[], Price[]]>;

  constructor(private servicesService: ServiceService,
              private adminRestService: AdminRestService,
              private fb: FormBuilder,) { }

  ngOnInit() {
    this.loadServicesPrices();
    this.buildForm();
  }

  buildForm() {
    this.searchForm = this.fb.group({
      search: ['']
    });
  }

  loadServicesPrices() {
    const serviceRequest$ = this.tab === this.TabType.PERSONAL
    ? this.servicesService.listPersonal() : this.servicesService.listOrganization();

    forkJoin([serviceRequest$, this.adminRestService.getPrices(this.tab)])
    .pipe(map(results => ({services: results[0], prices: results[1]})))
    .subscribe(results => {
      this.services = results.services;
      this.allServices = results.services;
      this.prices = results.prices;
    });
  }

  selectService(service: Service) {
    this.selectedService = service;
  }

  onServiceSearch(text: string) {
    const searchText = text.toLowerCase();
    if (searchText) {
      this.services = this.allServices.filter(s => s.name.toLowerCase().includes(searchText));
    } else {
      this.services = [...this.allServices];
    }
    if (!this.services.includes(this.selectedService)) {
      this.selectedService = null;
    }
  }

  clearSearch() {
    this.searchForm.get('search').setValue('');
  }
}