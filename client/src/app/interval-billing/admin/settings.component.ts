import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'ai-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  selectedSettingsType = 'SERVICES';
  statisticsOpened = true;

  constructor() { }

  ngOnInit() {
  }

  get title() {
    if (this.selectedSettingsType === 'GLOBAL') {
      return 'Global settings';
    }
    if (this.selectedSettingsType === 'ORG_SERVICES') {
      return 'Organization services settings';
    }
    return 'User services settings';
  }

  toggleStatistics(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.statisticsOpened = !this.statisticsOpened;
  }

  selectSettingsType(type: string) {
    this.selectedSettingsType = type;
  }
}
