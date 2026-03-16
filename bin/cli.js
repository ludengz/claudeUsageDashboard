#!/usr/bin/env node

// Keep stdin open so the process stays in the terminal foreground
// (workaround for npx not attaching the child to the foreground process group)
process.stdin.resume();

import '../server/index.js';
