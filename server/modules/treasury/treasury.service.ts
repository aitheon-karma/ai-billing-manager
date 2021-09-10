import Container, { Service } from 'typedi';
import { Transporter, TransporterService, param } from '@aitheon/transporter';
import {  Current } from '@aitheon/core-server';
import { environment } from '../../environment';
import { Account, Exchange, Purchase, FiatAccount, Transaction } from '@aitheon/treasury-server';


@Service()
@Transporter()
export class TreasuryService extends TransporterService {

  private SERVICE: string;

  constructor() {
    super(Container.get('TransporterBroker'));
    this.SERVICE = environment.production ? 'TREASURY.BillingManagerService' : 'TREASURY.BillingManagerService';
  }

  async listAccounts(user: string, organization?: string) {
    return this.broker.call<Account[], any>(`${this.SERVICE}.accounts`, { user, organization });
  }

  async listFiatAccount(user: string, organization?: string) {
    return this.broker.call<FiatAccount[], any>(`${this.SERVICE}.fiatAccounts`, { user, organization });
  }

  async currentExchangeRate() {
    return this.broker.call<Exchange>(`${this.SERVICE}.currentExchangePrice`);
  }

  /** This method debits money from the the account, if account is not specified. it uses the default account */
  async chargeFiatAccountCard(accountId: string, amount: number, current: Current, description?: string, meta?: any) {
    const chargeCardBody = {
      account: accountId,
      body: { amount: amount, description },
      user: current.user._id,
      organization: current.organization ? current.organization._id : undefined,
      meta
    };
    return this.broker.call<Transaction, any>(`${this.SERVICE}.chargeFaitAccount`, chargeCardBody);
  }

  async listActiveInboundFiatAccounts(user: string, organization: string) {
    return this.broker.call<FiatAccount[], any>(`${this.SERVICE}.linkedInboundFaitAccount`, {user, organization});
  }



  /** This is used in interval billing, ACU is credited to the user/org */
  async chargeCard(accountId: string, amount: number, current: Current) {
    const chargeCardBody = {
      account: accountId,
      body: { amount: amount },
      user: current.user._id,
      organization: current.organization ? current.organization._id : undefined
    };
    return this.broker.call<Purchase, any>(`${this.SERVICE}.chargeCard`, chargeCardBody);
  }


  async listBillingTransactions(user: string, organization: string, fromDate: string, toDate: string) {
    const billingTransactions = await this.broker.call<Transaction[], any>(`${this.SERVICE}.billingTransactions`, { user, organization, fromDate, toDate });
    return billingTransactions;
  }


  async createFiatInboundAccount(payload: any) {
     return this.broker.call<Transaction[], any>(`${this.SERVICE}.createFiatInboundAccount`, payload);
  }

  async aitheonAccountBalance(user: string, organization?: string) {
    const fiatAccountStatus = await this.broker.call<{disabled: boolean}>(`${this.SERVICE}.fiatAccountDisabledStatus`);
    const acuBalance = await this.broker.call<any, any>(`${this.SERVICE}.aitheonAccountBalance`, {user, organization});
    return {acuBalance, fiatAccountStatus };
  }

  async organizationTrialBalance(createdBy: string) {
    return this.broker.call<any, any>(`${this.SERVICE}.organizationTrialBalance`, {createdBy});
 }

 async personalTrialBalance(createdBy: string) {
  return this.broker.call<any, any>(`${this.SERVICE}.personalTrialBalance`, {createdBy});
 }

}
