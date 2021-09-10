/**
 * Module dependencies.
 */
import { Schema, Document, Model, model, Types } from 'mongoose';
import { Connection } from 'mongoose';

export enum BILLING_INTERVAL_STATUS {
  PAID = 'PAID',
  SUSPENDED = 'SUSPENDED',
}

export enum BILLING_SUBSCRIPTION_STATUS {
  SUSPENDED = 'SUSPENDED',
  FROZEN = 'FROZEN',
  TRIAL = 'TRIAL',
  WARNING = 'WARNING',
  PAID = 'PAID',
}

export class Organization {
  subscription: {
    status: BILLING_SUBSCRIPTION_STATUS;
    warningCount: number;
  };
}

const organizationSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    unique: true,
    required: true
  },
  billing: {
    lowBalance: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: Object.keys(BILLING_INTERVAL_STATUS),
      default: BILLING_INTERVAL_STATUS.PAID
    }
  },
   // For prepaid subscription billing process
   subscription: {
    status: {
      type: String,
      enum: Object.keys(BILLING_SUBSCRIPTION_STATUS)
    },
    warningCount: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export type IOrganization = Document & Organization;
export const GetOrganizationSchema = (connection: Connection) => connection.model<IOrganization>('Organization', organizationSchema);

export const organizationPopulateDefaults = '_id name profile.avatarResolutions.thumbnail';
