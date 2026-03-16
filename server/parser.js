import fs from 'fs';
import path from 'path';

export function deriveProjectName(dirName) {
  const clean = dirName.startsWith('-') ? dirName.slice(1) : dirName;

  const workspaceIdx = clean.indexOf('-Workspace-');
  if (workspaceIdx !== -1) {
    return clean.slice(workspaceIdx + '-Workspace-'.length);
  }

  const homeIdx = clean.indexOf('-Home-');
  if (homeIdx !== -1) {
    const rest = clean.slice(homeIdx + '-Home-'.length);
    return rest;
  }

  const parts = clean.split('-');
  return parts[parts.length - 1];
}

export function parseLogFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const records = [];

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type !== 'assistant') continue;

    const model = entry.message?.model;
    if (!model || model === '<synthetic>') continue;

    const usage = entry.message?.usage;
    if (!usage) continue;

    records.push({
      sessionId: entry.sessionId,
      timestamp: entry.timestamp,
      model,
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_creation_tokens: usage.cache_creation_input_tokens || 0,
      cache_read_tokens: usage.cache_read_input_tokens || 0,
    });
  }

  return records;
}

export function parseLogDirectory(baseDir) {
  const allRecords = [];

  let projectDirs;
  try {
    projectDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
  } catch {
    return allRecords;
  }

  for (const dir of projectDirs) {
    const projectName = deriveProjectName(dir.name);
    const projectPath = path.join(baseDir, dir.name);

    let files;
    try {
      files = fs.readdirSync(projectPath)
        .filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(projectPath, file);
      const records = parseLogFile(filePath);
      for (const record of records) {
        record.project = projectName;
        record.projectDirName = dir.name;
      }
      allRecords.push(...records);
    }
  }

  return allRecords;
}
