#!/usr/bin/env node
// Split question_bank_v2.json into per-subject files + index.json
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QB_FILE = join(ROOT, 'questions', 'question_bank_v2.json');
const OUT_DIR = join(ROOT, 'questions');

const SUBJECTS = ['math', 'english', 'chinese', 'physics', 'chemistry', 'biology', 'history', 'geography', 'politics'];

const raw = JSON.parse(readFileSync(QB_FILE, 'utf8'));
console.log(`Loaded ${raw.length} questions from question_bank_v2.json`);

// Group by subject
const grouped = {};
for (const subj of SUBJECTS) grouped[subj] = [];
for (const q of raw) {
  const s = q.subject;
  if (grouped[s] !== undefined) {
    grouped[s].push(q);
  } else {
    console.warn(`Unknown subject: ${s} in question ${q.id}`);
  }
}

// Write per-subject files
const indexSubjects = {};
for (const [subj, questions] of Object.entries(grouped)) {
  const file = `${subj}.json`;
  const path = join(OUT_DIR, file);
  writeFileSync(path, JSON.stringify(questions, null, 2), 'utf8');
  const bytes = readFileSync(path).length;
  indexSubjects[subj] = {
    file,
    count: questions.length,
    version: '20260415-1'
  };
  console.log(`Written ${file}: ${questions.length} questions (~${(bytes/1024).toFixed(0)}KB)`);
}

// Write index.json
const index = {
  version: '20260415-1',
  updatedAt: '2026-04-15',
  subjects: indexSubjects
};
writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
console.log(`Written index.json: ${SUBJECTS.length} subjects, total ${raw.length} questions`);
console.log('Done.');
