#!/usr/bin/env python3
"""
STP Manager (Static Password & Fleet Email Synchronization)
Manages reading, writing, and synchronization for STP.txt and src/STP.txt.
Default Static Password: S-and-T@7-2026
"""

import sys
import os
import json
import argparse
from typing import List, Tuple

DEFAULT_PASSWORD = "S-and-T@7-2026"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILE_PATHS = [
    os.path.join(BASE_DIR, "src", "STP.txt"),
    os.path.join(BASE_DIR, "STP.txt"),
]

def ensure_directories():
    src_dir = os.path.join(BASE_DIR, "src")
    if not os.path.exists(src_dir):
        os.makedirs(src_dir, exist_ok=True)

def read_stp() -> Tuple[List[str], str, str]:
    """
    Reads STP.txt and returns (emails, password, raw_content)
    """
    content = ""
    for path in FILE_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if content.strip():
                    break
            except Exception as e:
                pass

    if not content.strip():
        # Fallback default if completely empty
        return [], DEFAULT_PASSWORD, f"{DEFAULT_PASSWORD}\n"

    lines = [l.strip() for l in content.splitlines() if l.strip()]
    emails = []
    password = DEFAULT_PASSWORD

    if lines:
        last_line = lines[-1]
        if "@" not in last_line:
            password = last_line
            emails = [l for l in lines[:-1] if "@" in l]
        else:
            emails = [l for l in lines if "@" in l]

    return emails, password, content

def write_stp(emails: List[str], password: str = None) -> str:
    """
    Writes emails and password to STP.txt and src/STP.txt.
    Preserves existing password if password is None or empty.
    """
    ensure_directories()
    current_emails, current_pass, _ = read_stp()
    
    final_pass = (password.strip() if password and password.strip() else current_pass) or DEFAULT_PASSWORD
    clean_emails = [e.strip() for e in emails if e and e.strip() and "@" in e]
    
    # Remove duplicates while preserving order
    seen = set()
    unique_emails = []
    for e in clean_emails:
        if e.lower() not in seen:
            seen.add(e.lower())
            unique_emails.append(e)

    if unique_emails:
        formatted_content = "\n".join(unique_emails) + "\n" + final_pass + "\n"
    else:
        formatted_content = final_pass + "\n"

    for path in FILE_PATHS:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(formatted_content)
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to write {path}: {e}\n")

    return formatted_content

def main():
    parser = argparse.ArgumentParser(description="STP.txt Manager (Python)")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Read command
    subparsers.add_parser("read", help="Read STP.txt and output JSON")

    # Write command
    write_parser = subparsers.add_parser("write", help="Write emails and static password")
    write_parser.add_argument("--emails", nargs="*", default=[], help="List of email addresses")
    write_parser.add_argument("--password", type=str, default="", help="Static password")

    # Add email
    add_parser = subparsers.add_parser("add", help="Add email(s)")
    add_parser.add_argument("emails", nargs="+", help="Email addresses to add")

    # Remove email
    remove_parser = subparsers.add_parser("remove", help="Remove email(s)")
    remove_parser.add_argument("emails", nargs="+", help="Email addresses to remove")

    # Set password
    pass_parser = subparsers.add_parser("set-pass", help="Set static password")
    pass_parser.add_argument("password", type=str, help="New static password")

    # JSON input pipe
    subparsers.add_parser("json-sync", help="Read JSON from stdin and sync")

    args = parser.parse_args()

    if args.command == "read":
        emails, password, raw = read_stp()
        print(json.dumps({
            "ok": True,
            "emails": emails,
            "password": password,
            "content": raw
        }, indent=2))

    elif args.command == "write":
        emails_list = []
        for item in args.emails:
            emails_list.extend([e.strip() for e in item.split(",") if e.strip()])
        res = write_stp(emails_list, args.password if args.password else None)
        print(json.dumps({
            "ok": True,
            "message": "STP.txt updated successfully",
            "content": res
        }))

    elif args.command == "add":
        current_emails, current_pass, _ = read_stp()
        for e in args.emails:
            if e not in current_emails:
                current_emails.append(e)
        res = write_stp(current_emails, current_pass)
        print(json.dumps({"ok": True, "emails": current_emails, "password": current_pass}))

    elif args.command == "remove":
        current_emails, current_pass, _ = read_stp()
        remove_set = set(args.emails)
        current_emails = [e for e in current_emails if e not in remove_set]
        res = write_stp(current_emails, current_pass)
        print(json.dumps({"ok": True, "emails": current_emails, "password": current_pass}))

    elif args.command == "set-pass":
        current_emails, _, _ = read_stp()
        res = write_stp(current_emails, args.password)
        print(json.dumps({"ok": True, "emails": current_emails, "password": args.password}))

    elif args.command == "json-sync":
        try:
            raw_input = sys.stdin.read()
            data = json.loads(raw_input) if raw_input.strip() else {}
            emails = data.get("emails", [])
            password = data.get("password")
            res = write_stp(emails, password)
            print(json.dumps({"ok": True, "content": res}))
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}))

    else:
        # Default action: read and print content
        emails, password, raw = read_stp()
        print(raw)

if __name__ == "__main__":
    main()
