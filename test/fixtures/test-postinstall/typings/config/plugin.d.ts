// This file is created by egg-ts-helper@3.1.1
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
import '@eggjs/onerror';
import '@eggjs/session';
import '@eggjs/i18n';
import '@eggjs/watcher';
import '@eggjs/multipart';
import '@eggjs/security';
import '@eggjs/development';
import '@eggjs/logrotator';
import '@eggjs/schedule';
import '@eggjs/static';
import '@eggjs/jsonp';
import '@eggjs/view';
import { EggPluginItem } from 'egg';
declare module 'egg' {
  interface EggPlugin {
    onerror?: EggPluginItem;
    session?: EggPluginItem;
    i18n?: EggPluginItem;
    watcher?: EggPluginItem;
    multipart?: EggPluginItem;
    security?: EggPluginItem;
    development?: EggPluginItem;
    logrotator?: EggPluginItem;
    schedule?: EggPluginItem;
    static?: EggPluginItem;
    jsonp?: EggPluginItem;
    view?: EggPluginItem;
  }
}