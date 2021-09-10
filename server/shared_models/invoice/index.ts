import PDFdoc from './pdf-generation';
import { randomBytes } from 'crypto';
import * as FormData from 'form-data';
import axios, { AxiosRequestConfig } from 'axios';
import * as path from 'path';
import { SUBSCRIPTION_ITEM_TYPE } from '../models/subscription.model';
import { ObjectID } from 'mongodb';

const DRIVE_INTERNAL_UPLOAD_ENDPOINT_PATH = '/api/documents/internal';
const INTERNAL_REQUEST_IDENTIFIER_HEADER = 'x-service-string';
const SIGNED_URL_EXPIRATION_SECONDS = 60 * 60 * 24 * 365;
const INTERNAL_REQUEST_IDENTIFIER_PREFIX = 'rip_';

const shipping = {
  country: 'United States',
  code: '01001',
  regionState: 'Colorado',
  mobileNumber: '380674545454',
  addressLine1: 'Bowker Blvd Tongping Kololo Road',
  addressLine2: 'Bowker Blvd Tongping Kololo Road',
  email: 'test@test.com',
  phoneNumber: '380674545454'
};

export async function generatePDF(
  organizationId: any,
  userName: any,
  paymentHistory: any,
  db: any,
  redis: any,
  service: string,
  driveHost: string
): Promise<any> {
  let doc: PDFdoc = undefined;
  try {
    doc = new PDFdoc({ margin: PDFdoc.TOP_MARGIN }, {logoPath:  path.join(__dirname, './logo.png')});
    const headerLeft = [
      [`Country: `, shipping.country],
      [`ZIP: `, shipping.code],
      [`State: `, shipping.regionState],
      [`Mobile No: `, shipping.mobileNumber],
      [`Address line 1: `, shipping.addressLine1],
      [`Address line 2: `, shipping.addressLine2],
      [],
      [`Customer name: `, userName],
      [`Email: `, shipping.email],
      [`Phone No: `, shipping.phoneNumber],
    ];
    const headerRight = [
      [`Invoice Number: `, paymentHistory._id],
      [`Invoice Date: `, new Date(paymentHistory.createdAt).toLocaleDateString()],
      [`Balance Due: `, parseFloat(paymentHistory.totalBillAmount).toFixed(2)]
    ];
    const tableColumns = [
      'DESCRIPTION',
      'UNIT',
      'UNIT PRICE',
      `TIME PERIOD`,
      'AMOUNT'
    ];
    const tableRowsByService: any = {};

    paymentHistory.charges = paymentHistory.charges.reduce((a: any, c: any) => {
      if (!a[c.service]) {
        a[c.service] = [];
      }
      a[c.service].push(c);
      return a;
    }, {});
    for (const service in paymentHistory.charges) {
      for (const item of paymentHistory.charges[service]) {
        if (!tableRowsByService[service]) {
          tableRowsByService[service] = [];
        }
        tableRowsByService[service].push([
          await itemDescription(item.itemType, item.itemReference, db),
          item.quantity,
          `$${parseFloat(item.itemPrice).toFixed(2)}`,
          item.period && `${item.period[0]} - ${item.period[1]}`,
          `$${(item.quantity * parseFloat(item.itemPrice)).toFixed(2)}`
        ]);
      }
    }
    const tableColumnsNumber = tableColumns.length;
    // Percentage width of segments
    const segments = [27.5, 10, 15, 27.5, 12];
    const padding = 2;
    const tableHeading = 'PAYMENT DETAILS';
    const tableSummaryString = 'Total: ';
    const tableSummaryAmountString = `$${parseFloat(paymentHistory.totalBillAmount).toFixed(2)}`;

    const cardDetails = [
      `You're curently using the following payment method: (card details)`,
      `Please contact us at contact@aitheon.com if you have any questions regarding your invoice`
    ];
    doc.generateHeaderLeftAndAdvance(headerLeft, path.join(__dirname, './logo.png'));
    doc.generateHeaderRight(headerRight, 'Invoice');
    doc.generateInvoiceTableAndAdvance(tableColumnsNumber, segments, padding, tableHeading, tableColumns, tableRowsByService);
    doc.generateInvoiceTableSummaryAndAdvance(tableSummaryString, tableSummaryAmountString);
    doc.generateCardDetailsAndAdvance(cardDetails);
    doc.generateFooter( path.join(__dirname, './logo.png'));
  } catch (err) {
    throw new Error(`Error generating invoice pdf: ${err && err.message}`);
  }

  if (!doc) {
    throw new Error(`Error generating invoice pdf`);
  }
  return new Promise(async (resolve, reject) => {
    try {
      const id = randomBytes(20).toString('hex');
      if (await redis.insert(INTERNAL_REQUEST_IDENTIFIER_PREFIX + id, service) !== 'OK') {
        throw new Error('Internal Server Error');
      }

      const form = new FormData();
      form.append('file', doc, {filename: 'invoice', contentType: 'application/pdf'});
      const url = driveHost +
      DRIVE_INTERNAL_UPLOAD_ENDPOINT_PATH +
      '?organization=' + organizationId +
      '&signedUrlExpire=' + SIGNED_URL_EXPIRATION_SECONDS;

      const requestOptions: any = {
        method: 'post',
        url,
        data: form,
        headers: {
          ...form.getHeaders(),
          [INTERNAL_REQUEST_IDENTIFIER_HEADER]: id,
          ['x-service-target']: service
        }
      } as AxiosRequestConfig;

      axios(requestOptions).then((response) => {
        resolve({_id: response.data._id, signedUrl: response.data.signedUrl});
      }).catch(err => {
        console.error(err);
        reject(err);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function itemDescription(itemType: SUBSCRIPTION_ITEM_TYPE, itemReference: string, db: any) {
  switch (itemType) {
    case SUBSCRIPTION_ITEM_TYPE.DEVICE: {
      const deviceType = await db.connection.collection('device_manager__device-type').findOne({
        _id: new ObjectID(itemReference)
      }, {name: 1});
      return `${itemType}: ${deviceType && deviceType.name}`;
    }
    default: {
      return `${itemType}`;
    }
  }
}
