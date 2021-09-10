import { InjectionToken } from '@angular/core';

export interface Allocation {
  itemType: string;
  itemReference: string;
  billingInterval: number;
  quantity: number;
  itemPrice: {
    ranges: number[]
    prices: [number, number][]
  };
  name: string;
  used: number;
  monthlyPriceMultiplier: number;
}

export interface PaymentStatus {
  success?: boolean;
  serviceName?: string;
  serviceUrl?: string;
  error?: boolean;
  updateOnly?: boolean;
  processing?: boolean;
}

export interface AllocationCalculated {
  changedQuantity: number;
  oneTimePrice: number;
  pricePerQuantity: number;
  totalPrice: number;
  totalQuantity: number;
  oneTimePriceWithModifier: number;
}

export enum BillingEvents {
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_UPDATE_ERROR = 'SUBSCRIPTION_UPDATE_ERROR'
}



export function getNameFromItemType(type: string) {
  const splitType = type.split('_');
  let displayText = '';
  splitType.forEach((t, i) => {
    displayText += ' ' + (splitType[i].length > 2 ?
      splitType[i].charAt(0).toUpperCase() + splitType[0].toLocaleLowerCase().slice(1) : splitType[i]);
  });
  return displayText.trim();
}

export function toFixedNumber(num: number, fix: number = 8) {
  return Number(num.toFixed(fix));
}


export const BILLING_CLIENT_OPTIONS = new InjectionToken('BILLING_CLIENT_OPTIONS');

export interface IBillingClientOptions {
  service?: string;
}
