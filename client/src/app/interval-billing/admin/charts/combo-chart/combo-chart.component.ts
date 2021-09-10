import {
  Component,
  Input,
  ViewEncapsulation,
  Output,
  EventEmitter,
  ViewChild,
  HostListener,
  ContentChild,
  TemplateRef
} from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';

import {
  BaseChartComponent,
  LineSeriesComponent,
  calculateViewDimensions,
  ViewDimensions,
  ColorHelper
} from '@swimlane/ngx-charts';
import { curveLinear } from 'd3-shape';
import { scaleBand, scaleLinear } from 'd3-scale';

import * as _ from 'lodash';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'ngx-combo-chart',
  templateUrl: './combo-chart.component.html',
  styleUrls: ['./combo-chart.component.scss'],
  encapsulation: ViewEncapsulation.None,
  animations: [
    trigger('animationState', [
      transition(':leave', [
        style({
          opacity: 1,
          transform: '*'
        }),
        animate(500, style({ opacity: 0, transform: 'scale(0)' }))
      ])
    ])
  ]
})
export class ComboChartComponent extends BaseChartComponent {
  @Input() curve: any = curveLinear;
  @Input() legend = false;
  @Input() legendTitle = 'Legend';
  @Input() legendPosition = 'right';
  @Input() xAxis;
  @Input() yAxis;
  @Input() showXAxisLabel;
  @Input() showYAxisLabel;
  @Input() showRightYAxisLabel;
  @Input() xAxisLabel;
  @Input() yAxisLabel;
  @Input() yAxisLabelRight;
  @Input() tooltipDisabled = false;
  @Input() gradient: boolean;
  @Input() showGridLines = true;
  @Input() activeEntries: any[] = [];
  @Input() schemeType: string;
  @Input() trimXAxisTicks = true;
  @Input() trimYAxisTicks = true;
  @Input() rotateXAxisTicks = true;
  @Input() maxXAxisTickLength = 16;
  @Input() maxYAxisTickLength = 16;
  @Input() xAxisTickFormatting: any;
  @Input() yAxisTickFormatting: any;
  @Input() xAxisTicks: any[];
  @Input() yAxisTicks: any[];
  @Input() groupPadding = 16;
  @Input() roundEdges = true;
  @Input() yScaleMax: number;
  @Input() showDataLabel = false;
  @Input() dataLabelFormatting: any;
  @Input() yRightAxisTickFormatting: any;
  @Input() roundDomains = false;
  @Input() colorSchemeLine: any;
  @Input() autoScale;
  @Input() lineChart: any;
  @Input() yLeftAxisScaleFactor: any;
  @Input() yRightAxisScaleFactor: any;
  @Input() rangeFillOpacity: number;
  @Input() animations = true;
  @Input() noBarWhenZero = true;

  @Output() activate: EventEmitter<any> = new EventEmitter();
  @Output() deactivate: EventEmitter<any> = new EventEmitter();

  // @ts-ignore
  @ContentChild('tooltipTemplate', { 'static': false }) tooltipTemplate: TemplateRef<any>;
  // @ts-ignore
  @ContentChild('seriesTooltipTemplate', { static: false }) seriesTooltipTemplate: TemplateRef<any>;
  // @ts-ignore
  @ViewChild(LineSeriesComponent, { static: false }) lineSeriesComponent: LineSeriesComponent;

  groupDomain: any[];
  innerDomain: any[];
  valuesDomain: any[];
  groupScale: any;
  innerScale: any;
  valueScale: any;
  dataLabelMaxHeight: any = { negative: 0, positive: 0 };
  dims: ViewDimensions;
  lineXScale: any;
  xScale: any;
  yScale: any;
  xDomain: any;
  yDomain: any;
  transform: string;
  colors: ColorHelper;
  colorsLine: ColorHelper;
  margin: any[] = [10, 20, 10, 20];
  xAxisHeight = 0;
  yAxisWidth = 0;
  legendOptions: any;
  scaleType = 'linear';
  yScaleLine;
  xDomainLine;
  yDomainLine;
  seriesDomain;
  scaledAxis;
  combinedSeries;
  xSet;
  filteredDomain;
  hoveredVertical;
  yOrientLeft = 'left';
  yOrientRight = 'right';
  legendSpacing = 0;
  bandwidth;
  barPadding = 8;

  trackBy(index, item): string {
    return item.name;
  }

  update(): void {
    super.update();

    if (!this.showDataLabel) {
      this.dataLabelMaxHeight = { negative: 0, positive: 0 };
    }
    this.margin = [10 + this.dataLabelMaxHeight.positive, 20, 10 + this.dataLabelMaxHeight.negative, 0];

    this.dims = calculateViewDimensions({
      width: this.width,
      height: this.height,
      margins: this.margin,
      showXAxis: this.xAxis,
      showYAxis: this.yAxis,
      xAxisHeight: this.xAxisHeight,
      yAxisWidth: this.yAxisWidth,
      showXLabel: this.showXAxisLabel,
      showYLabel: this.showYAxisLabel,
      showLegend: this.legend,
      legendType: this.schemeType,
      legendPosition: this.legendPosition
    });

    if (this.showDataLabel) {
      this.dims.height -= this.dataLabelMaxHeight.negative;
    }

    this.formatDates();

    this.groupDomain = this.getGroupDomain();
    this.innerDomain = this.getInnerDomain();
    this.valuesDomain = this.getValueDomain();

    this.groupScale = this.getGroupScale();
    this.lineXScale = this.getLineScale();
    this.innerScale = this.getInnerScale();
    this.valueScale = this.getValueScale();

    if (!this.yAxis) {
      this.legendSpacing = 0;
    } else if (this.showYAxisLabel && this.yAxis) {
      this.legendSpacing = 100;
    } else {
      this.legendSpacing = 40;
    }
    this.xScale = this.getXScale();
    this.yScale = this.getYScale();

    this.xDomainLine = this.getXDomainLine();
    if (this.filteredDomain) {
      this.xDomainLine = this.filteredDomain;
    }

    this.yDomainLine = this.getYDomainLine();
    this.seriesDomain = this.getSeriesDomain();

    this.scaleLines();

    this.setColors();
    this.legendOptions = this.getLegendOptions();

    this.transform = `translate(${this.dims.xOffset} , ${this.margin[0] + this.dataLabelMaxHeight.negative})`;
  }

  onDataLabelMaxHeightChanged(event, groupIndex) {
    if (event.size.negative) {
      this.dataLabelMaxHeight.negative = Math.max(this.dataLabelMaxHeight.negative, event.size.height);
    } else {
      this.dataLabelMaxHeight.positive = Math.max(this.dataLabelMaxHeight.positive, event.size.height);
    }
    if (groupIndex === this.results.length - 1) {
      setTimeout(() => this.update());
    }
  }

  getGroupScale(): any {
    const spacing = this.groupDomain.length / (this.dims.height / this.groupPadding + 1);

    return scaleBand()
      .rangeRound([0, this.dims.width])
      .paddingInner(spacing)
      .paddingOuter(spacing / 2)
      .domain(this.groupDomain);
  }

  getLineScale(): any {
    const spacing = this.groupDomain.length / (this.dims.height / this.groupPadding + 1);
    const bandWidth = this.getGroupScale().bandwidth() / 2;

    return scaleBand()
      .rangeRound([bandWidth, this.dims.width + bandWidth])
      .paddingInner(spacing)
      .paddingOuter(spacing / 2)
      .domain(this.groupDomain);
  }

  getInnerScale(): any {
    const width = this.groupScale.bandwidth();
    const spacing = this.innerDomain.length / (width / this.barPadding + 1);
    return scaleBand()
      .rangeRound([0, width])
      .paddingInner(spacing)
      .domain(this.innerDomain);
  }

  getValueScale(): any {
    const scale = scaleLinear()
      .range([this.dims.height, 0])
      .domain(this.valuesDomain);
    return this.roundDomains ? scale.nice() : scale;
  }

  getGroupDomain() {
    const domain = [];
    for (const group of this.results) {
      if (!domain.includes(group.label)) {
        domain.push(group.label);
      }
    }

    return domain;
  }

  getInnerDomain() {
    const domain = this.lineChart.map(({ name }) => name);
    for (const group of this.results) {
      for (const d of group.series) {
        if (!domain.includes(d.label)) {
          domain.push(d.label);
        }
      }
    }
    return domain;
  }

  getValueDomain() {
    const series = this.lineChart.reduce((values, { series: currentSeries }) => [...values, ...currentSeries], []);
    const domain = series.reduce((result, { value }) => {
      if (!result.includes(value)) {
        result.push(value);
      }
      return result;
    }, []);

    const min = Math.min(0, ...domain);
    const max = this.yScaleMax ? Math.max(this.yScaleMax, ...domain) : Math.max(0, ...domain);
    return [min, max];
  }

  groupTransform(group) {
    return `translate(${this.groupScale(group.label)}, 0)`;
  }

  deactivateAll() {
    this.activeEntries = [...this.activeEntries];
    for (const entry of this.activeEntries) {
      this.deactivate.emit({ value: entry, entries: [] });
    }
    this.activeEntries = [];
  }

  @HostListener('mouseleave')
  hideCircles(): void {
    this.hoveredVertical = null;
    this.deactivateAll();
  }

  updateHoveredVertical(item): void {
    this.hoveredVertical = item.value;
    this.deactivateAll();
  }

  updateDomain(domain): void {
    this.filteredDomain = domain;
    this.xDomainLine = this.filteredDomain;
  }

  scaleLines() {
    this.yScaleLine = this.getYScaleLine(this.yDomainLine, this.dims.height);
  }

  getSeriesDomain(): any[] {
    this.combinedSeries = this.lineChart.slice(0);
    return this.combinedSeries.map(d => d.name);
  }

  isDate(value): boolean {
    return value instanceof Date;
  }

  getScaleType(values): string {
    let date = true;
    let num = true;

    for (const value of values) {
      if (!this.isDate(value)) {
        date = false;
      }

      if (typeof value !== 'number') {
        num = false;
      }
    }

    if (date) {
      return 'time';
    }
    if (num) {
      return 'linear';
    }
    return 'ordinal';
  }

  getXDomainLine(): any[] {
    let values = [];

    for (const results of this.lineChart) {
      for (const d of results.series) {
        if (!values.includes(d.name)) {
          values.push(d.name);
        }
      }
    }

    this.scaleType = this.getScaleType(values);
    let domain = [];

    if (this.scaleType === 'time') {
      const min = Math.min(...values);
      const max = Math.max(...values);
      domain = [min, max];
    } else if (this.scaleType === 'linear') {
      values = values.map(v => Number(v));
      const min = Math.min(...values);
      const max = Math.max(...values);
      domain = [min, max];
    } else {
      domain = values;
    }

    this.xSet = values;
    return domain;
  }

  getYDomainLine(): any[] {
    const domain = [];

    for (const results of this.lineChart) {
      for (const d of results.series) {
        if (domain.indexOf(d.value) < 0) {
          domain.push(d.value);
        }
        if (d.min !== undefined) {
          if (domain.indexOf(d.min) < 0) {
            domain.push(d.min);
          }
        }
        if (d.max !== undefined) {
          if (domain.indexOf(d.max) < 0) {
            domain.push(d.max);
          }
        }
      }
    }

    let min = Math.min(...domain);
    const max = Math.max(...domain);
    if (this.yRightAxisScaleFactor) {
      const minMax = this.yRightAxisScaleFactor(min, max);
      return [Math.min(0, minMax.min), minMax.max];
    } else {
      min = Math.min(0, min);
      return [min, max];
    }
  }

  getYScaleLine(domain, height): any {
    const scale = scaleLinear()
      .range([height, 0])
      .domain(domain);

    return this.roundDomains ? scale.nice() : scale;
  }

  getXScale(): any {
    this.xDomain = this.getXDomain();
    const spacing = this.xDomain.length / (this.dims.width / this.barPadding + 1);
    return scaleBand()
      .range([0, this.dims.width])
      .paddingInner(spacing)
      .domain(this.xDomain);
  }

  getYScale(): any {
    this.yDomain = this.getYDomain();
    const scale = scaleLinear()
      .range([this.dims.height, 0])
      .domain(this.yDomain);
    return this.roundDomains ? scale.nice() : scale;
  }

  getXDomain(): any[] {
    return this.results.map(d => d.name);
  }

  getYDomain() {
    const values = this.results.map(d => d.value);
    const min = Math.min(0, ...values);
    const max = Math.max(...values);
    if (this.yLeftAxisScaleFactor) {
      const minMax = this.yLeftAxisScaleFactor(min, max);
      return [Math.min(0, minMax.min), minMax.max];
    } else {
      return [min, max];
    }
  }

  onClick(data, group?) {
    if (group) {
      data.series = group.name;
    }
    this.select.emit(data);
  }

  setColors(): void {
    let domain;
    if (this.schemeType === 'ordinal') {
      domain = this.innerDomain;
    } else {
      domain = this.valuesDomain;
    }

    this.colors = new ColorHelper(this.scheme, this.schemeType, domain, this.customColors);
    this.colorsLine = new ColorHelper(this.colorSchemeLine, this.schemeType, domain, this.customColors);
  }

  getLegendOptions() {
    const opts = {
      scaleType: this.schemeType,
      colors: undefined,
      domain: [],
      title: undefined,
      position: this.legendPosition
    };
    if (opts.scaleType === 'ordinal') {
      opts.domain = this.innerDomain;
      opts.colors = this.colors;
      opts.title = this.legendTitle;
    } else {
      opts.domain = this.seriesDomain;
      opts.colors = this.colors.scale;
    }
    return opts;
  }

  updateYAxisWidth(event: any) {
    const { width } = event;
    this.yAxisWidth = width;
    this.update();
  }

  updateXAxisHeight(event: any) {
    const { height } = event;
    this.xAxisHeight = height;
    this.update();
  }

  updateLineWidth(width): void {
    this.bandwidth = width;
    this.scaleLines();
  }

  onActivate(item, group) {
    const idx = this.activeEntries.findIndex(d => {
      return d.name === item.name && d.value === item.value && d.series === item.series;
    });
    if (group) {
      item.series = group.name;
    }
    if (idx > -1) {
      return;
    }

    this.activeEntries = [item, ...this.activeEntries];
    this.activate.emit({ value: item, entries: this.activeEntries });
  }

  onDeactivate(event, group, fromLegend = false) {
    const item = Object.assign({}, event);
    if (group) {
      item.series = group.name;
    }

    this.activeEntries = this.activeEntries.filter(i => {
      if (fromLegend) {
        return i.label !== item.name;
      } else {
        return !(i.name === item.name && i.series === item.series);
      }
    });

    this.deactivate.emit({ value: item, entries: this.activeEntries });
  }

  getTooltipInfo(model: any) {
    const { name, value, tooltip, series: lineSeries } = Array.isArray(model) ? model[0] : model;
    const colorDomain = _.get(this.legendOptions, 'colors.colorDomain', []);
    const domain = _.get(this.legendOptions, 'colors.domain', []);
    const currentBarItem = this.results
      .find(({ name: itemName }) => itemName === name) || {};
    const iconStyles = {
      width: '8px',
      height: '8px',
      display: 'inline-block',
      borderRadius: '50%',
      marginRight: '5px',
    };
    const items = _.sortBy((currentBarItem.series || []).map(item => {
      const i = domain.indexOf(item.name);
      return {
        label: item.name,
        tooltip: item.tooltip,
        value: item.value,
        iconStyles: {
          ...iconStyles,
          background: colorDomain[i],
        },
      };
    }), 'value').reverse();

    if (Array.isArray(model)) {
      for (const series of model) {
        items.push({
          label: series.series,
          tooltip: series.tooltip,
          value: series.value,
          iconStyles: {
            ...iconStyles,
            background: series.color,
          },
        });
      }
    } else {
      items.push({
        label: lineSeries,
        tooltip,
        value,
        iconStyles: {
          ...iconStyles,
          background: lineSeries === 'Paid'
            ? this.colorSchemeLine.domain[0]
            : this.colorSchemeLine.domain[1],
        },
      });
    }
    return {
      title: name,
      items,
    };
  }
}
