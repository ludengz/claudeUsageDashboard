#!/usr/bin/env node
'use strict';
const { join } = require('path');
const { pathToFileURL } = require('url');

const serverPath = join(__dirname, '..', 'server', 'index.js');
import(pathToFileURL(serverPath).href);
