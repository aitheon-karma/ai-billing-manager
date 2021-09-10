
'use strict';
import 'ts-helpers';
import 'reflect-metadata';
import { environment } from './environment';
import { Container } from 'typedi';
Container.set('environment', environment);
import { Application } from './config/application';

export default new Application();
