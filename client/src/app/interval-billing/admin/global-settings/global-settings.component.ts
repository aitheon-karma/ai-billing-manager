import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'ai-global-settings',
  templateUrl: './global-settings.component.html',
  styleUrls: ['./global-settings.component.scss']
})
export class GlobalSettingsComponent implements OnInit {
  globalSettingsForm: FormGroup;

  dropdownOpen: boolean;
  filledSelect: boolean = false;
  submitted: boolean = false;
  
  options = [
    "Week", "Two Weeks", "Month"
  ]

  config = {
    displayKey: "name", //if objects array passed which key to be displayed defaults to description
    placeholder: 'Choose period',
    searchPlaceholder: 'SDFGDSFDSFDSFDSF',
    search: false,
    limitTo: 3
  };


  constructor(
    private fb: FormBuilder
  ) { 
  }

  ngOnInit() {
    this.globalSettingsForm = this.fb.group({
      period: ['',Validators.required],
      price: ['',Validators.required],
      entries: ['',Validators.required],
      storage: ['',Validators.required],
    });
  }

  onSubmit() {
    this.submitted = true;
    if (!this.globalSettingsForm.valid) {
      return;
    }
  }
}
