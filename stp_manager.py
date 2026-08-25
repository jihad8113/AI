#!/usr/bin/env python3
"""
STP Manager (Static Password & Fleet Email Synchronization)
Manages reading, writing, and synchronization for STP.txt and src/STP.txt.
Default Static Password: S-and-T@7-2026
"""

import sys
import os
import json
import re
import argparse
from typing import List, Tuple

DEFAULT_PASSWORD = "S-and-T@7-2026"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILE_PATHS = [
    os.path.join(BASE_DIR, "src", "STP.txt"),
    os.path.join(BASE_DIR, "STP.txt"),
    os.path.join(BASE_DIR, "public", "STP.txt"),
    os.path.join(BASE_DIR, "dist", "STP.txt"),
]

def is_valid_email(s: str) -> bool:
    """Check if string is a valid email (must contain @ and dot in domain)"""
    if not s or not isinstance(s, str):
        return False
    s = s.strip()
    return bool(re.search(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', s))

def ensure_directories():
    for p in FILE_PATHS:
        parent = os.path.dirname(p)
        if parent and not os.path.exists(parent):
            try:
                os.makedirs(parent, exist_ok=True)
            except Exception:
                pass

def read_stp() -> Tuple[List[str], str, str]:
    """
    Reads STP.txt and returns (emails, password, raw_content)
    The last line is always the static password (or DEFAULT_PASSWORD if file has only emails).
    """
    content = ""
    for path in FILE_PATHS:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                if content.strip():
                    break
            except Exception:
                pass

    if not content.strip():
        return [], DEFAULT_PASSWORD, f"{DEFAULT_PASSWORD}\n"

    lines = [l.strip() for l in content.splitlines() if l.strip()]
    emails = []
    password = DEFAULT_PASSWORD

    if len(lines) == 1:
        if is_valid_email(lines[0]):
            emails = [lines[0]]
            password = DEFAULT_PASSWORD
        else:
            password = lines[0]
            emails = []
    elif len(lines) > 1:
        # Last line is the static password
        last_line = lines[-1]
        if not is_valid_email(last_line):
            password = last_line
            emails = [l for l in lines[:-1] if is_valid_email(l) or ("@" in l and "." in l)]
        else:
            # If every line is an email, use DEFAULT_PASSWORD
            emails = [l for l in lines if is_valid_email(l) or ("@" in l and "." in l)]
            password = DEFAULT_PASSWORD

    return emails, password, content

def write_stp(emails: List[str], password: str = None) -> str:
    """
    Writes emails and password to STP.txt and src/STP.txt.
    Preserves existing password if password is None or empty.
    """
    ensure_directories()
    current_emails, current_pass, _ = read_stp()
    
    final_pass = (password.strip() if password and password.strip() else current_pass) or DEFAULT_PASSWORD
    clean_emails = [e.strip() for e in emails if e and e.strip() and (is_valid_email(e) or ("@" in e and "." in e))]
    
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
                f.flush()
                os.fsync(f.fileno())
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
    add_parser.add_argument("emails", nargs="*", default=[], help="Email addresses to add")
    add_parser.add_argument("--email", "--emails", dest="flag_emails", nargs="*", default=[], help="Email addresses via flag")

    # Remove email
    remove_parser = subparsers.add_parser("remove", help="Remove email(s)")
    remove_parser.add_argument("emails", nargs="*", default=[], help="Email addresses to remove")
    remove_parser.add_argument("--email", "--emails", dest="flag_emails", nargs="*", default=[], help="Email addresses to remove via flag")

    # Set password
    pass_parser = subparsers.add_parser("set-pass", help="Set static password")
    pass_parser.add_argument("password", nargs="?", default="", help="New static password")
    pass_parser.add_argument("--password", "--pass", dest="flag_password", type=str, default="", help="Static password via flag")

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
        to_add = list(args.emails) + list(args.flag_emails)
        for item in to_add:
            for e in item.split(","):
                e_clean = e.strip()
                if e_clean and e_clean not in current_emails:
                    current_emails.append(e_clean)
        res = write_stp(current_emails, current_pass)
        print(json.dumps({"ok": True, "emails": current_emails, "password": current_pass}))

    elif args.command == "remove":
        current_emails, current_pass, _ = read_stp()
        to_remove = []
        for item in list(args.emails) + list(args.flag_emails):
            to_remove.extend([e.strip().lower() for e in item.split(",") if e.strip()])
        remove_set = set(to_remove)
        current_emails = [e for e in current_emails if e.lower() not in remove_set]
        res = write_stp(current_emails, current_pass)
        print(json.dumps({"ok": True, "emails": current_emails, "password": current_pass}))

    elif args.command == "set-pass":
        current_emails, current_pass, _ = read_stp()
        new_pass = args.flag_password if args.flag_password else (args.password if args.password else current_pass)
        res = write_stp(current_emails, new_pass)
        print(json.dumps({"ok": True, "emails": current_emails, "password": new_pass}))

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
