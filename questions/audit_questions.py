#!/usr/bin/env python3
"""Audit JSON question files for data quality issues."""

import json
import os
import re
from pathlib import Path

QUESTIONS_DIR = Path("/Users/fuweineng/projects/bairichuang-pwa/questions")
PLACEHOLDER_PATTERNS = [
    r'^TODO$', r'^XXX$', r'^\.\.\.$', r'^xxx$', r'^kkk$',
    r'^欠[缺]?$', r'^待[填写]?$', r'^空$'
]

def is_placeholder(text):
    """Check if text is a placeholder."""
    text = text.strip()
    for pattern in PLACEHOLDER_PATTERNS:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    if len(text) <= 2 and text in ['..', '--', '__', '??', '??', '[]']:
        return True
    return False

def is_single_letter(text):
    """Check if text is single letter only (a-z, a-z, chinese single char counted as 1)."""
    text = text.strip()
    if len(text) == 1 and text.isalpha():
        return True
    return False

def audit_file(filepath):
    """Audit a single JSON file and return list of issues."""
    issues = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        data = json.loads(content)
    except json.JSONDecodeError as e:
        issues.append({
            'line': 1,
            'type': 'JSON_PARSE_ERROR',
            'msg': f"JSON parse error: {e}"
        })
        return issues
    except Exception as e:
        issues.append({
            'line': 1,
            'type': 'FILE_READ_ERROR',
            'msg': f"File read error: {e}"
        })
        return issues

    questions = data if isinstance(data, list) else data.get('questions', [])
    if not isinstance(questions, list):
        issues.append({
            'line': 1,
            'type': 'INVALID_STRUCTURE',
            'msg': "Root is not a list and no 'questions' key found"
        })
        return issues

    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            issues.append({
                'line': idx + 1,
                'type': 'INVALID_QUESTION',
                'msg': f"Question at index {idx} is not a dict"
            })
            continue

        qid = q.get('id', f"index_{idx}")
        qtype = q.get('type', 'unknown')

        # (1) Check missing answer field
        if 'answer' not in q:
            issues.append({
                'line': idx + 1,
                'type': 'MISSING_ANSWER',
                'id': qid,
                'msg': "Question missing 'answer' field"
            })

        # Get options/choices
        options = q.get('options', q.get('choices', []))
        if not isinstance(options, list):
            options = []

        # (3) Check empty options array
        if options == [] and 'options' in q:
            issues.append({
                'line': idx + 1,
                'type': 'EMPTY_OPTIONS',
                'id': qid,
                'msg': "Question has 'options' field but array is empty"
            })

        # (2) Check options/choices for empty or single-letter text
        for oidx, opt in enumerate(options):
            if isinstance(opt, dict):
                opt_text = opt.get('text', opt.get('label', opt.get('content', '')))
                opt_id = opt.get('id', f"opt_{oidx}")
            elif isinstance(opt, str):
                opt_text = opt
                opt_id = f"opt_{oidx}"
            else:
                opt_text = str(opt)
                opt_id = f"opt_{oidx}"

            if not opt_text or opt_text.strip() == '':
                issues.append({
                    'line': idx + 1,
                    'type': 'EMPTY_OPTION_TEXT',
                    'id': qid,
                    'option_id': opt_id,
                    'msg': f"Option '{opt_id}' has empty text"
                })
            elif is_single_letter(opt_text):
                issues.append({
                    'line': idx + 1,
                    'type': 'SINGLE_LETTER_OPTION',
                    'id': qid,
                    'option_id': opt_id,
                    'msg': f"Option '{opt_id}' has single-letter text: '{opt_text}'"
                })
            elif is_placeholder(opt_text):
                issues.append({
                    'line': idx + 1,
                    'type': 'PLACEHOLDER_OPTION',
                    'id': qid,
                    'option_id': opt_id,
                    'msg': f"Option '{opt_id}' has placeholder text: '{opt_text}'"
                })

        # (4) Check type=choice but no options/choices
        if qtype == 'choice' and len(options) == 0:
            issues.append({
                'line': idx + 1,
                'type': 'CHOICE_NO_OPTIONS',
                'id': qid,
                'msg': "Question type is 'choice' but has no options/choices"
            })

        # (5) Check for placeholder text in question itself
        question_text = q.get('question', q.get('text', q.get('title', '')))
        if is_placeholder(question_text):
            issues.append({
                'line': idx + 1,
                'type': 'PLACEHOLDER_QUESTION',
                'id': qid,
                'msg': f"Question text is placeholder: '{question_text}'"
            })

        # Check for placeholder in answer
        answer_val = q.get('answer', '')
        if isinstance(answer_val, str) and is_placeholder(answer_val):
            issues.append({
                'line': idx + 1,
                'type': 'PLACEHOLDER_ANSWER',
                'id': qid,
                'msg': f"Answer is placeholder: '{answer_val}'"
            })

    return issues

def main():
    """Main audit function."""
    json_files = list(QUESTIONS_DIR.rglob("*.json"))
    json_files = [f for f in json_files if 'audit_questions.py' not in str(f)]
    json_files.sort()

    total_files = len(json_files)
    total_issues = 0

    print("=" * 80)
    print("JSON QUESTION FILE AUDIT REPORT")
    print("=" * 80)
    print(f"Scanning directory: {QUESTIONS_DIR}")
    print(f"Total JSON files: {total_files}")
    print("=" * 80)

    for filepath in json_files:
        rel_path = filepath.relative_to(QUESTIONS_DIR)
        issues = audit_file(filepath)

        if issues:
            print(f"\n{'=' * 80}")
            print(f"FILE: {rel_path}")
            print(f"Issues found: {len(issues)}")
            print("-" * 80)

            for issue in issues:
                print(f"  Line {issue['line']:>4} | [{issue['type']}] {issue['msg']}")
                if 'id' in issue:
                    print(f"             | Question ID: {issue['id']}")
                if 'option_id' in issue:
                    print(f"             | Option ID: {issue['option_id']}")

            total_issues += len(issues)

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Files scanned: {total_files}")
    print(f"Files with issues: {sum(1 for f in json_files if audit_file(f))}")
    print(f"Total issues: {total_issues}")
    print("=" * 80)

    if total_issues > 0:
        print(f"\nAudit complete. {total_issues} issue(s) found.")
    else:
        print("\nAudit complete. No issues found.")

if __name__ == "__main__":
    main()
