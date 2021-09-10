import * as PDFDocument from 'pdfkit';


export default class PDFdoc extends PDFDocument {
  static RIGHT_MARGIN = 50;
  static TOP_MARGIN = 50;
  static FONT_LARGE = 20;
  static FONT_DEFAULT = 10;
  static FONT_MEDIUM = 15;
  static FONT_BOLD = 'Helvetica-Bold';
  static FONT_REGULAR = 'Helvetica';

  FOOTER_Y: number;
  position = 50;
  currentPage = 1;
  logoPath: string;

  constructor(docOpts: any, opts: any) {
    super(docOpts);
    this.lineGap(4);
    this.logoPath = opts.logoPath;
    this.FOOTER_Y = this.generateFooter(this.logoPath, true);
    this.generateFooter(this.logoPath);
  }

  reservePosition(text?: string | number) {
    let add = 0;
    if (text && typeof text === 'string') {
      add += this.heightOfString(text);
    } else if (text && typeof text === 'number') {
      add += text;
    } else {
      add += this.currentLineHeight();
    }
    if (typeof add !== 'number' || Number.isFinite(add) !== true) {
      console.error(new Error('PDF generation reserve position "add" is not a number'));
      return this;
    }
    if (this.position + add > this.FOOTER_Y) {
      this.addPage();
      this.generateFooter(this.logoPath);
      this.currentPage += 1;
      this.position = 50;
    }
    return this;
  }
  advancePosition(text?: string | number) {
    let add = 0;
    if (text && typeof text === 'string') {
      add += this.heightOfString(text);
    } else if (text && typeof text === 'number') {
      add += text;
    } else {
      add += this.currentLineHeight();
    }
    if (typeof add !== 'number' || Number.isFinite(add) !== true) {
      console.error(new Error('PDF generation advance position "add" is not a number'));
      return this;
    }
    this.position += add;
    this.position = Math.round(this.position);
    return this;
  }
  __boldItem (args: string[]) {
    if (args.length === 0) {
      this.moveDown();
    }
    args.forEach((text: any, i) => {
      if (i === 0 || (i % 2) === 0) {
        this.font('Helvetica-Bold');
        this.text(text || ' ', PDFdoc.RIGHT_MARGIN, this.position, {continued: true});
      } else {
        this.font('Helvetica');
        this.text(text || ' ');
      }
    });
    return this;
  }

  __boldItemRight (args: string[], width: number) {
    args.forEach((text: any, i) => {
      if (i === 0 || (i % 2) === 0) {
        this.font('Helvetica-Bold');
        this.text(text || ' ', this.page.width - (PDFdoc.RIGHT_MARGIN + 5) - width, undefined, {continued: true});
      } else {
        this.font('Helvetica');
        this.text(text || ' ');
      }
    });
    return this;
  }

  alignRight(str: string) {
    return this.page.width - (PDFdoc.RIGHT_MARGIN + 2) - this.widthOfString(str);
  }

  generateHeaderLeftAndAdvance(strings: string[][], logoPath: string) {
    this
      .fontSize(PDFdoc.FONT_LARGE)
      .reservePosition(PDFdoc.TOP_MARGIN)
      .image(logoPath, PDFdoc.TOP_MARGIN, PDFdoc.TOP_MARGIN, {height: PDFdoc.FONT_LARGE})
      .advancePosition(PDFdoc.FONT_LARGE)
      .advancePosition()
      .advancePosition()
      .fontSize(PDFdoc.FONT_DEFAULT);
    strings.forEach((s: string[]) => {
      this.reservePosition(s.join()).__boldItem(s).advancePosition(s.join());
    });
    this.position += PDFdoc.TOP_MARGIN;
  }

  generateHeaderRight(strings: string[][], heading: string) {
    const width = strings.reduce((a, s) => {
      const length = (s[0].length + s[1].length);
      if (a < length) {
        a = this.widthOfString(s.join());
      }
      return a;
    }, 0);
    this
      .fontSize(PDFdoc.FONT_LARGE)
      .text(heading, this.page.width - (PDFdoc.RIGHT_MARGIN + 5) - width, PDFdoc.TOP_MARGIN)
      .moveDown()
      .fontSize(PDFdoc.FONT_DEFAULT);
    strings.forEach(s => this.__boldItemRight(s, width));
  }

  generateInvoiceTableAndAdvance(
    tableColumnsNumber: number,
    segments: number[],
    padding: number,
    tableHeading: string,
    tableColumns: string[],
    tableRowsByService: {[key: string]: string[][]}
  ) {
    this
      .advancePosition()
      .fontSize(PDFdoc.FONT_MEDIUM)
      .font(PDFdoc.FONT_BOLD)
      .reservePosition(tableHeading)
      .text(tableHeading, PDFdoc.RIGHT_MARGIN, this.position)
      .advancePosition(tableHeading)
      .advancePosition()
      .font(PDFdoc.FONT_REGULAR);
    this.fontSize(PDFdoc.FONT_DEFAULT);
    const {highest, execute} = this.generateTableRow(
      tableColumnsNumber,
      segments,
      tableColumns,
      padding,
      this.page.width - (PDFdoc.RIGHT_MARGIN * 2)
    );
    this.reservePosition(highest);
    execute(this, this.position);
    this.advancePosition(highest);
    this.moveTo(PDFdoc.RIGHT_MARGIN, this.position);
    this.lineWidth(0.5).lineTo(this.page.width - (PDFdoc.RIGHT_MARGIN + 5), this.position).stroke();
    this.advancePosition();

    for (const service in tableRowsByService) {
      this.font(PDFdoc.FONT_BOLD);
      this.advancePosition();
      this.reservePosition(service);
      this.text(service, PDFdoc.RIGHT_MARGIN, this.position);
      this.font(PDFdoc.FONT_REGULAR);
      this.advancePosition(service);
      for (let i = 0; i < tableRowsByService[service].length; i++) {
        const items = tableRowsByService[service][i];
        this.advancePosition();
        const {highest, execute} = this.generateTableRow(
          tableColumnsNumber,
          segments,
          items,
          padding,
          this.page.width - (PDFdoc.RIGHT_MARGIN * 2)
        );
        this.reservePosition(highest);
        execute(this, this.position);
        this.advancePosition(highest);
      }
    }
    this.advancePosition();
    this.moveTo(PDFdoc.RIGHT_MARGIN, this.position);
    this.lineWidth(0.5).lineTo(this.page.width - (PDFdoc.RIGHT_MARGIN + 5), this.position).stroke();
    this.advancePosition();
  }

  generateInvoiceTableSummaryAndAdvance(summaryString: string, summaryAmountString: string) {
    this
      .fontSize(PDFdoc.FONT_MEDIUM)
      .font(PDFdoc.FONT_BOLD)
      .advancePosition()
      .text(summaryString, PDFdoc.RIGHT_MARGIN, this.position)
      .font(PDFdoc.FONT_REGULAR);

    this
      .fontSize(PDFdoc.FONT_MEDIUM)
      .font(PDFdoc.FONT_BOLD)
      .text(summaryAmountString, this.alignRight(summaryAmountString), this.position)
      .font(PDFdoc.FONT_REGULAR);


    this.advancePosition();
    this.fontSize(10);
    this.advancePosition();
  }

  generateCardDetailsAndAdvance(details: string[]) {
    this.reservePosition(30);
    this.advancePosition(30);
    for (const s of details) {
      this
        .reservePosition(s)
        .text(s, PDFdoc.RIGHT_MARGIN, this.position)
        .advancePosition(s)
        .advancePosition();
    }
  }


  generateFooter(logoPath: string, dry: boolean = false) {
    const string = 'Powered by ';
    if (!dry) {
      this
        .fontSize(PDFdoc.FONT_MEDIUM)
        .font(PDFdoc.FONT_BOLD);
      const center = Math.floor(this.page.width / 2);
      const stringWidth = this.widthOfString(string);
      const stringHeight = this.heightOfString(string);
      const imageHeight = Math.floor(stringHeight);
      const imageWidth = imageHeight * 7;
      const y = Math.floor(this.page.height - (PDFdoc.TOP_MARGIN + stringHeight));

      this
        .text(
          string,
          Math.floor(center - (0.5 * (stringWidth + imageWidth + 5))),
          y,
          {baseline: 'middle'}
        )
        .image(
          logoPath,
          Math.floor(center - (0.5 * (stringWidth + imageWidth + 5)) + stringWidth + 5),
          y - Math.floor(0.5 * imageHeight),
          {height: imageHeight, width: imageWidth }
        );
        this.fontSize(PDFdoc.FONT_DEFAULT).font(PDFdoc.FONT_REGULAR);
      return y;
    } else {
      this.fontSize(PDFdoc.FONT_MEDIUM).font(PDFdoc.FONT_BOLD);
      const footerPosition = Math.floor(this.page.height - (PDFdoc.TOP_MARGIN + (this.heightOfString(string) * 2)));
      this.fontSize(PDFdoc.FONT_DEFAULT).font(PDFdoc.FONT_REGULAR);
      return footerPosition;
    }
  }

  generateTableRow(tableColumnsNumber: number, segments: number[], data: string[], paddingPercentage: number, totalWidth: number) {
    const padding = Math.floor((totalWidth / 100) * paddingPercentage);
    const widths = segments.map(s => Math.floor((totalWidth / 100) * s));
    const positions = widths.reduce((a, w, i) => {
      if (i === 0) {
        a.push(PDFdoc.RIGHT_MARGIN);
      } else {
        a.push(a[i - 1] + widths[i - 1]);
      }
      return a;
    }, []);
    const highest = data.reduce((a, s, i) => {
      const height = this.heightOfString(s, {width: widths[i] - padding});
      if (a < height) {
        a = height;
      }
      return a;
    }, 0);

    return {
      highest: Math.round(highest),
      execute: (doc: PDFdoc, y: number) => {
        doc
        .fontSize(PDFdoc.FONT_DEFAULT)
        .font(PDFdoc.FONT_REGULAR);
        for (let i = 0, l = data.length; i < l; i++) {
          if (i === 0) {
            doc.text(data[i], positions[i], y, {width: widths[i] - padding});

          } else {
            const opts: any = {width: widths[i] - padding};
            if (i === 2) {
              opts['align'] = 'center';
            } else if (i === 4) {
              opts['align'] = 'right';
            }
            doc
              .text('', positions[i], y, {width: padding})
              .text(data[i], positions[i], y, opts);
          }
        }
      }
    };
  }


}

