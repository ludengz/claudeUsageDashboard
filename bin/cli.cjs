#!/usr/bin/env node
'use strict';
const { join } = require('path');
const { spawnSync } = require('child_process');

const serverPath = join(__dirname, '..', 'server', 'index.js');
const result = spawnSync(process.execPath, [serverPath], { stdio: 'inherit' });
process.exit(result.status || 0);
