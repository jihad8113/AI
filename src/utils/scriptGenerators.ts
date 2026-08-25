import { MailAccount, TelegramSettings } from '../types';

export function generatePythonScript(accounts: MailAccount[], telegram: TelegramSettings): string {
  const token = telegram.botToken || 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
  const defaultChatId = telegram.defaultChatId || '0';

  const accountsJson = JSON.stringify(
    accounts.map((acc) => ({
      email: acc.email,
      password: acc.password || '',
      refresh_token: acc.refreshToken,
      client_id: acc.clientId,
      user_id: Number(acc.userId) || Number(defaultChatId) || 0
    })),
    null,
    4
  );

  return `# =========================================================
# Windows 11 Multi-Account Mail Checker & Telegram Alert Bot
# Generated via WinMail Telegram Controller
# =========================================================

import asyncio
import logging
import json
import os
import sys
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

# Setup Windows-friendly logging
logging.basicConfig(
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("WinMailBot")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "${token}")
DEFAULT_USER_ID = int(os.getenv("DEFAULT_CHAT_ID", "${defaultChatId || '0'}"))

class MailAccount:
    def __init__(self, email, password, refresh_token, client_id, user_id):
        self.email = email
        self.password = password
        self.refresh_token = refresh_token
        self.client_id = client_id
        self.user_id = int(user_id) if user_id else DEFAULT_USER_ID
        self.messages = []
        self.last_error = None
    
    def get_access_token(self):
        try:
            response = requests.post(
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                data={
                    'client_id': self.client_id,
                    'refresh_token': self.refresh_token,
                    'grant_type': 'refresh_token',
                    'scope': 'https://graph.microsoft.com/Mail.Read offline_access'
                },
                timeout=12
            )
            if response.status_code == 200:
                data = response.json()
                # Update refresh token if Microsoft returned a new one
                if 'refresh_token' in data and data['refresh_token']:
                    self.refresh_token = data['refresh_token']
                self.last_error = None
                return data.get('access_token')
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                logger.error(f"Token error for {self.email}: {self.last_error}")
                return None
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Token exception for {self.email}: {e}")
            return None
    
    def fetch_inbox(self, limit=20, show_old=False):
        token = self.get_access_token()
        if not token:
            return []
        
        params = {
            '$top': 100 if show_old else limit,
            '$orderby': 'receivedDateTime desc',
            '$select': 'id,subject,from,receivedDateTime,bodyPreview,isRead,importance,hasAttachments'
        }
        
        try:
            response = requests.get(
                "https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages",
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json',
                    'Prefer': 'outlook.body-content-type="text"'
                },
                params=params,
                timeout=15
            )
            if response.status_code == 200:
                return response.json().get('value', [])
            else:
                logger.error(f"Graph error for {self.email}: {response.status_code} - {response.text[:200]}")
                return []
        except Exception as e:
            logger.error(f"Fetch exception for {self.email}: {e}")
            return []

# In-memory accounts dictionary: email -> MailAccount
mail_accounts = {}

# Preload configured accounts
INITIAL_ACCOUNTS = ${accountsJson}
DEFAULT_STATIC_PASSWORD = "S-and-T@7-2026"

def get_stp_file_paths():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return [
        os.path.join(base_dir, "STP.txt"),
        os.path.join(base_dir, "src", "STP.txt"),
    ]

def read_static_password_from_stp():
    for p in get_stp_file_paths():
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    lines = [l.strip() for l in f.read().splitlines() if l.strip()]
                    if lines and not lines[-1].startswith("@") and "@" not in lines[-1]:
                        return lines[-1]
            except Exception:
                pass
    return DEFAULT_STATIC_PASSWORD

def sync_stp_and_accounts_files():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_pass = read_static_password_from_stp()
    
    # 1. Update STP.txt
    emails = [e for e in mail_accounts.keys() if "@" in e]
    stp_content = "\\n".join(emails) + ("\\n" if emails else "") + static_pass + "\\n"
    for p in get_stp_file_paths():
        try:
            parent = os.path.dirname(p)
            if parent and not os.path.exists(parent):
                os.makedirs(parent, exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(stp_content)
        except Exception as e:
            logger.warning(f"Could not write {p}: {e}")
            
    # 2. Update accounts.txt
    acc_path = os.path.join(base_dir, "accounts.txt")
    try:
        acc_lines = []
        for acc in mail_accounts.values():
            acc_lines.append(f"{acc.email}|{acc.password}|{acc.refresh_token}|{acc.client_id}|{acc.user_id}")
        with open(acc_path, "w", encoding="utf-8") as f:
            f.write("\\n".join(acc_lines) + "\\n")
    except Exception as e:
        logger.warning(f"Could not write accounts.txt: {e}")

def init_preloaded_accounts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    acc_path = os.path.join(base_dir, "accounts.txt")
    
    # Load from accounts.txt first if exists
    if os.path.exists(acc_path):
        try:
            with open(acc_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("|")
                    if len(parts) >= 4:
                        em, pw, rt, cid = parts[0].strip(), parts[1].strip(), parts[2].strip(), parts[3].strip()
                        uid = int(parts[4].strip()) if len(parts) >= 5 and parts[4].strip().isdigit() else DEFAULT_USER_ID
                        mail_accounts[em] = MailAccount(em, pw, rt, cid, uid)
        except Exception as e:
            logger.warning(f"Failed to read accounts.txt: {e}")
            
    # Preload configured initial accounts
    for item in INITIAL_ACCOUNTS:
        if item.get("email") and item.get("refresh_token") and item.get("client_id"):
            if item["email"] not in mail_accounts:
                acc = MailAccount(
                    email=item["email"],
                    password=item.get("password", ""),
                    refresh_token=item["refresh_token"],
                    client_id=item["client_id"],
                    user_id=item.get("user_id", DEFAULT_USER_ID)
                )
                mail_accounts[item["email"]] = acc
                
    # Sync initial state to files
    sync_stp_and_accounts_files()
    logger.info(f"Loaded {len(mail_accounts)} accounts into memory and synchronized STP.txt.")

def main_keyboard():
    keyboard = [
        [KeyboardButton("📧 Mail Accounts"), KeyboardButton("🔄 Check All")],
        [KeyboardButton("➕ Add Account"), KeyboardButton("🗑️ Remove Account")]
    ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def mail_keyboard(email):
    keyboard = [
        [
            InlineKeyboardButton("🔄 Refresh Inbox", callback_data=f"refresh_{email}"),
            InlineKeyboardButton("📂 View 100 Old", callback_data=f"old_{email}")
        ],
        [
            InlineKeyboardButton("🔙 Back to Accounts", callback_data="back_accounts")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def messages_keyboard(email, messages, show_old=False):
    keyboard = []
    for i, msg in enumerate(messages[:10]):
        subject = msg.get('subject', '(No subject)') or '(No subject)'
        subject_trim = (subject[:26] + '..') if len(subject) > 26 else subject
        sender_name = msg.get('from', {}).get('emailAddress', {}).get('name', '')
        btn_text = f"📧 {subject_trim}"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"msg_{email}_{i}")])
    
    row = []
    if len(messages) > 10:
        row.append(InlineKeyboardButton(f"📂 More ({len(messages)})", callback_data=f"more_{email}_{show_old}"))
    row.append(InlineKeyboardButton("🔄 Refresh", callback_data=f"refresh_{email}"))
    if row:
        keyboard.append(row)
    keyboard.append([InlineKeyboardButton("🔙 Accounts List", callback_data="back_accounts")])
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_name = update.effective_user.first_name or "User"
    welcome_text = (
        f"👋 Welcome {user_name} to <b>WinMail Alert Bot</b>!\\n\\n"
        f"🖥️ <i>Connected to Windows 11 Mail Controller</i>\\n\\n"
        f"<b>Commands:</b>\\n"
        f"• Use the keyboard buttons below to manage accounts\\n"
        f"• To add a new account, send:\\n"
        f"  <code>mail|password|refresh_token|clientid</code>"
    )
    await update.message.reply_text(welcome_text, parse_mode='HTML', reply_markup=main_keyboard())

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    user_id = update.effective_user.id
    
    if text == "📧 Mail" or text == "📧 Mail Accounts":
        user_mails = {e: a for e, a in mail_accounts.items() if a.user_id == user_id or a.user_id == 0}
        if not user_mails:
            await update.message.reply_text(
                "❌ No mail accounts added yet!\\n\\nSend:\\n<code>mail|password|refresh_token|clientid</code>",
                parse_mode='HTML'
            )
            return
        keyboard = []
        for email in user_mails:
            keyboard.append([InlineKeyboardButton(f"📬 {email}", callback_data=f"select_{email}")])
        await update.message.reply_text(
            f"📬 <b>Your Connected Inboxes ({len(user_mails)}):</b>\\nClick an account to inspect:",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    elif text == "🔄 Check All":
        user_mails = {e: a for e, a in mail_accounts.items() if a.user_id == user_id or a.user_id == 0}
        if not user_mails:
            await update.message.reply_text("❌ No accounts registered to check.")
            return
        status_msg = await update.message.reply_text(f"⏳ Checking {len(user_mails)} accounts...")
        summary = []
        for email, acc in user_mails.items():
            msgs = acc.fetch_inbox(limit=5)
            acc.messages = msgs
            if msgs:
                latest = msgs[0].get('subject', 'No subject')
                summary.append(f"✅ <b>{email}</b>: {len(msgs)} msgs (Latest: {latest[:25]})")
            else:
                err = f" ({acc.last_error})" if acc.last_error else ""
                summary.append(f"⚠️ <b>{email}</b>: 0 msgs or token expired{err}")
        await status_msg.edit_text("📊 <b>Check Results:</b>\\n\\n" + "\\n".join(summary), parse_mode='HTML')

    elif text == "➕ Add Account":
        await update.message.reply_text(
            "📝 <b>Add Microsoft Outlook/Graph Account</b>\\n\\n"
            "Send the credentials formatted as:\\n"
            "<code>mail|password|refresh_token|clientid</code>",
            parse_mode='HTML'
        )

    elif text == "🗑️ Remove" or text == "🗑️ Remove Account":
        user_mails = {e: a for e, a in mail_accounts.items() if a.user_id == user_id or a.user_id == 0}
        if not user_mails:
            await update.message.reply_text("❌ No mail accounts to remove!")
            return
        keyboard = []
        for email in user_mails:
            keyboard.append([InlineKeyboardButton(f"❌ Remove {email}", callback_data=f"remove_{email}")])
        await update.message.reply_text("Select an account to remove:", reply_markup=InlineKeyboardMarkup(keyboard))
    
    elif '|' in text:
        parts = [p.strip() for p in text.split('|')]
        if len(parts) >= 4:
            email, password, refresh_token, client_id = parts[0], parts[1], parts[2], parts[3]
            acc = MailAccount(email, password, refresh_token, client_id, user_id)
            mail_accounts[email] = acc
            sync_stp_and_accounts_files()
            
            auth_msg = await update.message.reply_text(f"🔐 Authenticating <code>{email}</code> via Microsoft Graph...", parse_mode='HTML')
            messages = acc.fetch_inbox(limit=5)
            
            if messages:
                acc.messages = messages
                await auth_msg.edit_text(
                    f"✅ <b>Account Added Successfully!</b>\\n"
                    f"📧 <b>Email:</b> {email}\\n"
                    f"🔑 <b>Password:</b> {password}\\n"
                    f"📬 <b>Found {len(messages)} messages!</b>",
                    parse_mode='HTML',
                    reply_markup=mail_keyboard(email)
                )
            else:
                token = acc.get_access_token()
                if token:
                    await auth_msg.edit_text(
                        f"✅ <b>{email} Added</b>\\n"
                        f"🔑 Password: {password}\\n"
                        f"📬 Token is valid, but inbox is empty or no unread messages.",
                        parse_mode='HTML',
                        reply_markup=mail_keyboard(email)
                    )
                else:
                    await auth_msg.edit_text(
                        f"⚠️ <b>Authentication Failed for {email}</b>\\n"
                        f"❌ Reason: {acc.last_error or 'Invalid refresh token/client ID.'}\\n"
                        f"Please check your credentials and try again.",
                        parse_mode='HTML',
                        reply_markup=mail_keyboard(email)
                    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    user_id = update.effective_user.id
    
    if data == "back_accounts":
        user_mails = {e: a for e, a in mail_accounts.items() if a.user_id == user_id or a.user_id == 0}
        keyboard = [[InlineKeyboardButton(f"📬 {email}", callback_data=f"select_{email}")] for email in user_mails]
        await query.edit_message_text("📬 <b>Your Connected Accounts:</b>", parse_mode='HTML', reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if data.startswith("select_"):
        email = data.replace("select_", "")
        if email in mail_accounts:
            acc = mail_accounts[email]
            await query.edit_message_text(f"🔄 Fetching messages for <code>{email}</code>...", parse_mode='HTML')
            messages = acc.fetch_inbox(limit=10)
            acc.messages = messages
            if messages:
                await query.edit_message_text(
                    f"📬 <b>Inbox for {email}</b> ({len(messages)} messages):",
                    parse_mode='HTML',
                    reply_markup=messages_keyboard(email, messages)
                )
            else:
                await query.edit_message_text(
                    f"📭 No messages found for <b>{email}</b>\\n{acc.last_error or ''}",
                    parse_mode='HTML',
                    reply_markup=mail_keyboard(email)
                )
    
    elif data.startswith("refresh_"):
        email = data.replace("refresh_", "")
        if email in mail_accounts:
            acc = mail_accounts[email]
            await query.edit_message_text(f"🔄 Refreshing <code>{email}</code>...", parse_mode='HTML')
            messages = acc.fetch_inbox(limit=10)
            acc.messages = messages
            if messages:
                await query.edit_message_text(
                    f"📬 <b>Updated Inbox for {email}</b> ({len(messages)} messages):",
                    parse_mode='HTML',
                    reply_markup=messages_keyboard(email, messages)
                )
            else:
                await query.edit_message_text(
                    f"📭 No messages found for <b>{email}</b>",
                    parse_mode='HTML',
                    reply_markup=mail_keyboard(email)
                )
    
    elif data.startswith("old_"):
        email = data.replace("old_", "")
        if email in mail_accounts:
            acc = mail_accounts[email]
            await query.edit_message_text(f"🔄 Fetching old messages for <code>{email}</code>...", parse_mode='HTML')
            messages = acc.fetch_inbox(show_old=True)
            acc.messages = messages
            if messages:
                await query.edit_message_text(
                    f"📂 <b>Archive/Old Messages for {email}</b> ({len(messages)} total):",
                    parse_mode='HTML',
                    reply_markup=messages_keyboard(email, messages, True)
                )
            else:
                await query.edit_message_text(
                    f"📭 No old messages found for <b>{email}</b>",
                    parse_mode='HTML',
                    reply_markup=mail_keyboard(email)
                )
    
    elif data.startswith("remove_"):
        email = data.replace("remove_", "")
        if email in mail_accounts:
            del mail_accounts[email]
            sync_stp_and_accounts_files()
            await query.edit_message_text(f"✅ <b>{email}</b> removed from monitor and STP.txt.", parse_mode='HTML')
    
    elif data.startswith("msg_"):
        parts = data.split("_")
        email = parts[1]
        idx = int(parts[2])
        if email in mail_accounts and len(mail_accounts[email].messages) > idx:
            msg = mail_accounts[email].messages[idx]
            sender_data = msg.get('from', {}).get('emailAddress', {})
            sender_name = sender_data.get('name', 'Unknown')
            sender_email = sender_data.get('address', 'Unknown')
            subject = msg.get('subject', '(No subject)')
            date = msg.get('receivedDateTime', 'Unknown')
            preview = msg.get('bodyPreview', '(No preview content)')
            
            back_markup = InlineKeyboardMarkup([
                [InlineKeyboardButton("🔙 Back to Inbox", callback_data=f"select_{email}")]
            ])
            
            msg_text = (
                f"📧 <b>From:</b> {sender_name} &lt;{sender_email}&gt;\\n"
                f"📝 <b>Subject:</b> {subject}\\n"
                f"🕐 <b>Date:</b> {date}\\n"
                f"👤 <b>Account:</b> {email}\\n"
                f"────────────────────\\n"
                f"{preview}"
            )
            await query.edit_message_text(msg_text, parse_mode='HTML', reply_markup=back_markup)
    
    elif data.startswith("more_"):
        parts = data.split("_")
        email = parts[1]
        show_old = parts[2] if len(parts) > 2 else "False"
        if email in mail_accounts:
            acc = mail_accounts[email]
            messages = acc.fetch_inbox(show_old=(show_old == "True"))
            acc.messages = messages
            await query.edit_message_text(
                f"📬 <b>All messages for {email}</b> ({len(messages)}):",
                parse_mode='HTML',
                reply_markup=messages_keyboard(email, messages, show_old == "True")
            )

async def check_mails_background_task(app: Application):
    """Periodic background task that monitors inboxes and dispatches Telegram notifications"""
    logger.info("Auto-sync background loop active (Checking every 60 seconds)...")
    while True:
        try:
            for email, acc in list(mail_accounts.items()):
                try:
                    new_messages = acc.fetch_inbox(limit=5)
                    if new_messages and acc.messages:
                        existing_ids = {m.get('id') for m in acc.messages if m.get('id')}
                        unread_arrivals = [m for m in new_messages if m.get('id') not in existing_ids]
                        
                        if unread_arrivals:
                            logger.info(f"Detected {len(unread_arrivals)} new email(s) for {email}")
                            for msg in unread_arrivals[:3]:
                                subject = msg.get('subject', '(No subject)')
                                sender_info = msg.get('from', {}).get('emailAddress', {})
                                sender_name = sender_info.get('name') or sender_info.get('address') or 'Unknown'
                                preview = msg.get('bodyPreview', '')[:120]
                                
                                alert_text = (
                                    f"🔔 <b>NEW EMAIL RECEIVED!</b>\\n\\n"
                                    f"👤 <b>Account:</b> <code>{email}</code>\\n"
                                    f"📧 <b>From:</b> {sender_name}\\n"
                                    f"📝 <b>Subject:</b> {subject}\\n"
                                    f"📄 <b>Preview:</b> <i>{preview}...</i>"
                                )
                                target_id = acc.user_id if acc.user_id != 0 else DEFAULT_USER_ID
                                if target_id != 0:
                                    try:
                                        await app.bot.send_message(
                                            chat_id=target_id,
                                            text=alert_text,
                                            parse_mode='HTML',
                                            reply_markup=mail_keyboard(email)
                                        )
                                    except Exception as send_err:
                                        logger.error(f"Failed to send Telegram alert: {send_err}")
                    acc.messages = new_messages
                except Exception as acc_err:
                    logger.error(f"Error checking account {email}: {acc_err}")
        except Exception as loop_err:
            logger.error(f"Error in background task loop: {loop_err}")
        
        await asyncio.sleep(60)

def main():
    init_preloaded_accounts()
    
    if not BOT_TOKEN or "YOUR_TELEGRAM_BOT_TOKEN" in BOT_TOKEN:
        print("❌ Please configure BOT_TOKEN in the script or via TELEGRAM_BOT_TOKEN environment variable.")
        sys.exit(1)
        
    print(f"🤖 Starting WinMail Telegram Bot on Windows 11...")
    print(f"📡 Registered accounts: {len(mail_accounts)}")
    
    application = Application.builder().token(BOT_TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    # Start auto-checking loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.create_task(check_mails_background_task(application))
    
    print("✅ Bot is polling for updates... Press CTRL+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
`;
}

export function generateWindowsBatchFile(): string {
  return `@echo off
title WinMail Telegram Bot Runner - Windows 11
color 0B
cls
echo ================================================================
echo           WinMail Microsoft Graph + Telegram Bot Runner
echo ================================================================
echo.

:: Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from python.org or Microsoft Store.
    pause
    exit /b 1
)

echo [1/3] Checking dependencies...
pip install python-telegram-bot requests python-dotenv >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Installing required packages...
    pip install python-telegram-bot requests python-dotenv
)

echo [2/3] Verified dependencies (python-telegram-bot, requests).
echo [3/3] Launching Bot Process...
echo.
echo ================================================================
echo Bot is now running! Keep this window open.
echo Press Ctrl+C to stop the bot.
echo ================================================================
echo.

:RUN_LOOP
python bot.py
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Bot stopped unexpectedly. Restarting in 5 seconds...
    timeout /t 5
    goto RUN_LOOP
)

pause
`;
}

export function generateExeBuilderBatchFile(): string {
  return `@echo off
title WinMail Standalone EXE Builder (Windows 11)
color 0b

echo ===================================================================
echo             WinMail Standalone .EXE 1-Click Builder
echo ===================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python is not installed or not in PATH.
    echo [*] Attempting to launch Windows winget installer...
    winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Could not auto-install Python.
        echo Please install Python from https://www.python.org/downloads/
        echo Make sure to check "Add python.exe to PATH" during installation.
        echo.
        pause
        exit /b 1
    )
    echo [OK] Python installed successfully!
)

echo [1/3] Checking environment & installing PyInstaller...
pip install --upgrade pyinstaller requests python-telegram-bot python-dotenv --quiet --no-warn-script-location

echo.
echo [2/3] Compiling bot.py into standalone "WinMail_Bot.exe"...
echo       Packaging Microsoft Graph API client + Telegram Bot engine...
echo       Please wait ~15 seconds...
echo.

pyinstaller --noconfirm --onefile --console --name "WinMail_Bot" bot.py

if %errorlevel% equ 0 (
    echo.
    echo ===================================================================
    echo  [SUCCESS] WinMail_Bot.exe has been compiled successfully!
    echo ===================================================================
    echo.
    echo  Your standalone executable is ready:
    echo  Location: %~dp0dist\\WinMail_Bot.exe
    echo.
    echo  Copy "WinMail_Bot.exe" and "accounts.txt" anywhere on your Windows 11 PC!
    echo  Double-click "WinMail_Bot.exe" to start monitoring your inboxes 24/7.
    echo.
    copy "%~dp0accounts.txt" "%~dp0dist\\accounts.txt" >nul 2>&1
    explorer.exe "%~dp0dist"
) else (
    echo.
    echo [ERROR] Build encountered an error.
    echo Retrying with minimal flags...
    pyinstaller --onefile "bot.py" -n "WinMail_Bot"
    if %errorlevel% equ 0 (
        echo [SUCCESS] dist\\WinMail_Bot.exe created!
        explorer.exe "%~dp0dist"
    ) else (
        echo [!] Please check if Windows Defender temporarily quarantined PyInstaller build files.
    )
)

echo.
pause
`;
}

export function generatePowerShellScript(): string {
  return `# WinMail Telegram Bot Runner for Windows 11 PowerShell
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "    WinMail Microsoft Graph + Telegram Bot Runner (PowerShell)   " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Check Python
try {
    $pyVersion = python --version
    Write-Host "[OK] Detected $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Download Python from https://www.python.org/downloads/"
    Read-Host "Press Enter to exit..."
    Exit
}

Write-Host "\`n[1/2] Verifying Python modules..." -ForegroundColor Yellow
pip install --quiet python-telegram-bot requests python-dotenv

Write-Host "[2/2] Starting Bot Process..." -ForegroundColor Green
Write-Host "Press Ctrl+C at any time to terminate.\`n" -ForegroundColor Gray

while ($true) {
    python bot.py
    Write-Host "\`n[!] Bot exited. Restarting in 5 seconds..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 5
}
`;
}

export function generateAccountsText(accounts: MailAccount[]): string {
  return accounts
    .map(
      (acc) =>
        `${acc.email}|${acc.password || ''}|${acc.refreshToken}|${acc.clientId}`
    )
    .join('\n');
}

export function generateStandaloneHtmlFile(accounts: MailAccount[], telegram: TelegramSettings): string {
  const accountsJson = JSON.stringify(
    accounts.map((acc) => ({
      email: acc.email,
      password: acc.password || '',
      refreshToken: acc.refreshToken,
      clientId: acc.clientId || '9e5f94bc-e8a4-4e73-b8be-63364c29d753',
      clientSecret: acc.clientSecret || '',
      label: acc.label || acc.email.split('@')[0]
    })),
    null,
    2
  );

  const botToken = telegram.botToken || '';
  const defaultChatId = telegram.defaultChatId || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>WinMail Web Controller & Universal Live Mail Monitor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --card-inner: #1a2234;
      --card-border: #1f293d;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --accent: #06b6d4;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --error: #ef4444;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 16px;
    }
    .container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 16px 20px;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      width: 40px; height: 40px; border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; font-weight: 800; color: white;
      box-shadow: 0 4px 12px rgba(59,130,246,0.3);
    }
    h1 { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; }
    .badge {
      font-size: 0.7rem; font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border: none;
      padding: 9px 16px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(37,99,235,0.25);
    }
    .btn:hover { background: linear-gradient(135deg, #1d4ed8, #1e40af); transform: translateY(-1px); }
    .btn-secondary {
      background: var(--card-inner);
      color: var(--text);
      border: 1px solid var(--card-border);
      box-shadow: none;
    }
    .btn-secondary:hover { background: #243048; border-color: #334155; }
    .btn-success { background: linear-gradient(135deg, #059669, #10b981); }
    .btn-danger { background: linear-gradient(135deg, #dc2626, #ef4444); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
    .stat-item {
      background: var(--card);
      padding: 14px;
      border-radius: 12px;
      border: 1px solid var(--card-border);
      text-align: center;
    }
    .stat-num { font-size: 1.4rem; font-weight: 800; color: #60a5fa; font-family: 'JetBrains Mono', monospace; }
    .stat-label { font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-top: 2px; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }

    .card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-title {
      font-size: 0.9rem; font-weight: 700; color: #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }

    .input, textarea {
      width: 100%;
      background: #060911;
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 9px 12px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
    }
    .input:focus, textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }

    .accounts-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; padding-right: 4px; }
    .account-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      gap: 8px;
    }
    .acc-email { font-weight: 600; font-size: 0.85rem; word-break: break-all; }
    .acc-status { font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 9999px; }
    .status-ok { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .status-err { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .status-idle { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
    .status-syncing { background: rgba(59, 130, 246, 0.2); color: #60a5fa; animation: pulse 1.5s infinite; }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .inbox-viewer {
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px;
    }
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .message-card {
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .message-card:hover { border-color: #3b82f6; transform: translateY(-1px); }
    .msg-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); }
    .msg-sender { font-weight: 700; color: #60a5fa; }
    .msg-subject { font-weight: 700; font-size: 0.9rem; color: #f1f5f9; }
    .msg-body { font-size: 0.8rem; color: #cbd5e1; line-height: 1.5; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8);
      backdrop-filter: blur(4px); display: none; align-items: center;
      justify-content: center; z-index: 999; padding: 16px;
    }
    .modal {
      background: var(--card); border: 1px solid var(--card-border);
      border-radius: 16px; width: 100%; max-width: 700px; max-height: 85vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .modal-header {
      padding: 16px 20px; border-bottom: 1px solid var(--card-border);
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem; }

    .switch-label {
      display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-muted); cursor: pointer;
    }
  </style>
</head>
<body>

<div class="container">
  <!-- Header -->
  <header>
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <h1>WinMail Universal Web Controller</h1>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
          Standalone Client • Microsoft Graph API • Auto Poller • Telegram Dispatcher
        </p>
      </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
      <button class="btn" id="btn-sync-all" onclick="syncAllInboxes()">🔄 Sync Inboxes</button>
      <button class="btn btn-secondary" id="btn-toggle-loop" onclick="toggleAutoLoop()">▶ Start Auto-Check (15s)</button>
    </div>
  </header>

  <!-- Live Stats -->
  <div class="stats">
    <div class="stat-item">
      <div class="stat-num" id="total-accounts-count">0</div>
      <div class="stat-label">Inboxes Configured</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" id="total-messages-count" style="color: #34d399;">0</div>
      <div class="stat-label">Emails Loaded</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" id="auto-loop-status" style="font-size: 1.1rem; color: #94a3b8; padding-top: 4px;">Paused</div>
      <div class="stat-label">Background Poller</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" id="telegram-status" style="font-size: 1.1rem; color: #f59e0b; padding-top: 4px;">Ready</div>
      <div class="stat-label">Telegram Link</div>
    </div>
  </div>

  <div class="grid">
    <!-- Instant Parser & Bulk Input -->
    <div class="card">
      <div class="card-title">
        <span>⚡ Bulk Accounts Importer</span>
        <span class="badge">Multi-Line Paste</span>
      </div>
      <p style="font-size: 0.75rem; color: var(--text-muted);">
        Paste 1 or 100+ accounts (one per line):<br>
        <code>email|password|refresh_token|client_id</code>
      </p>
      <textarea
        id="bulk-input"
        class="input"
        rows="4"
        style="resize: vertical; min-height: 80px;"
        placeholder="user1@hotmail.com|pass|M.C514...|9e5f94bc...
user2@outlook.com|pass|M.C514...|9e5f94bc...
user3@hotmail.com|pass|M.C514...|9e5f94bc..."
      ></textarea>
      <div style="display: flex; gap: 8px;">
        <button class="btn" style="flex: 1;" onclick="importBulkAccounts()">📥 Import All Accounts</button>
        <button class="btn btn-secondary" onclick="clearBulkInput()">Clear</button>
      </div>
    </div>

    <!-- Telegram Settings -->
    <div class="card">
      <div class="card-title">
        <span>✈️ Telegram Alerts Forwarder</span>
        <label class="switch-label">
          <input type="checkbox" id="telegram-auto-forward" checked /> Auto-forward new emails
        </label>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <input
          type="text"
          id="bot-token"
          class="input"
          placeholder="Telegram Bot Token (e.g. 123456:ABC-DEF...)"
          value="${botToken}"
          onchange="saveSettings()"
        />
        <input
          type="text"
          id="chat-id"
          class="input"
          placeholder="Telegram Chat ID (e.g. 987654321)"
          value="${defaultChatId}"
          onchange="saveSettings()"
        />
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="flex: 1;" onclick="testTelegramAlert()">🔔 Test Telegram</button>
          <button class="btn btn-secondary" onclick="testSoundChime()">🔊 Sound Test</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Accounts List -->
  <div class="card">
    <div class="card-title">
      <span>📋 Active Inboxes</span>
      <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="exportAccountsTxt()">📥 Export accounts.txt</button>
    </div>
    <div class="accounts-list" id="accounts-list"></div>
  </div>

  <!-- Messages Feed -->
  <div class="inbox-viewer">
    <div class="card-title">
      <span style="font-size: 1rem;">📬 Real-Time Inbox Feed</span>
      <input
        type="text"
        id="search-filter"
        class="input"
        style="max-width: 200px; padding: 4px 8px; font-size: 0.75rem;"
        placeholder="Filter subject/sender..."
        oninput="renderMessages()"
      />
    </div>
    <div class="messages-container" id="messages-container">
      <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 40px;">
        Click <b>"Sync Inboxes"</b> or <b>"Start Auto-Check"</b> to fetch messages.
      </p>
    </div>
  </div>
</div>

<!-- Email Modal -->
<div class="modal-overlay" id="email-modal" onclick="closeModal(event)">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div style="font-weight: 700; font-size: 1rem;" id="modal-subject">Subject</div>
      <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
        <span id="modal-sender">From: </span>
        <span id="modal-date">Date: </span>
      </div>
      <div style="font-size: 0.75rem; color: #60a5fa;" id="modal-account">Account: </div>
      <hr style="border: none; border-top: 1px solid var(--card-border);" />
      <div id="modal-content" style="white-space: pre-wrap; line-height: 1.6; color: #e2e8f0;"></div>
    </div>
  </div>
</div>

<script>
  // Storage Key
  const STORAGE_KEY = 'WINMAIL_LOCAL_DATA_V2';

  // State
  let ACCOUNTS = ${accountsJson};
  let ALL_MESSAGES = [];
  let SEEN_MESSAGE_IDS = new Set();
  let AUTO_LOOP_TIMER = null;

  // Web Audio Chime (Zero External Files)
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
  }

  function testSoundChime() {
    playBeep();
  }

  // Load from localStorage if present
  function loadPersistedData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.accounts && saved.accounts.length > 0) {
          ACCOUNTS = saved.accounts;
        }
        if (saved.botToken) document.getElementById('bot-token').value = saved.botToken;
        if (saved.chatId) document.getElementById('chat-id').value = saved.chatId;
      }
    } catch (e) {}
  }

  function saveSettings() {
    try {
      const botToken = document.getElementById('bot-token').value.trim();
      const chatId = document.getElementById('chat-id').value.trim();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        accounts: ACCOUNTS,
        botToken,
        chatId
      }));
    } catch (e) {}
  }

  // Resilient multi-tier Fetch & Microsoft Token Exchange for Standalone HTML
  async function exchangeMicrosoftToken(acc) {
    const clientId = acc.clientId || '9e5f94bc-e8a4-4e73-b8be-63364c29d753';
    const postBody = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: acc.refreshToken,
      scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite offline_access'
    }).toString();

    const tokenEndpoints = [
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    ];

    // Method 1: Direct Fetch (works when CORS is permitted by browser or same-origin)
    for (const ep of tokenEndpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postBody
        });
        if (res.ok) {
          const json = await res.json();
          if (json.access_token) return json;
        }
      } catch (e) {}
    }

    // Method 2: High-speed POST CORS Proxies
    for (const ep of tokenEndpoints) {
      try {
        // Proxy 1: corsproxy.io
        const p1 = 'https://corsproxy.io/?' + encodeURIComponent(ep);
        const res1 = await fetch(p1, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postBody
        });
        if (res1.ok) {
          const json1 = await res1.json();
          if (json1.access_token) return json1;
        }
      } catch (e) {}

      try {
        // Proxy 2: thingproxy
        const p2 = 'https://thingproxy.freeboard.io/fetch/' + ep;
        const res2 = await fetch(p2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postBody
        });
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2.access_token) return json2;
        }
      } catch (e) {}
    }

    throw new Error('Token acquisition failed on all direct and proxy channels.');
  }

  async function fetchGraphMessages(accessToken) {
    const graphUrl = 'https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=20&$select=id,subject,from,receivedDateTime,bodyPreview,body,isRead';

    // 1. Direct GET
    try {
      const res = await fetch(graphUrl, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 2. Proxy 1: corsproxy.io
    try {
      const p1 = 'https://corsproxy.io/?' + encodeURIComponent(graphUrl);
      const res = await fetch(p1, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 3. Proxy 2: allorigins
    try {
      const p2 = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(graphUrl);
      const res = await fetch(p2, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    throw new Error('Failed to fetch messages from Microsoft Graph.');
  }

  async function getAccessToken(acc) {
    acc.status = 'syncing';
    renderAccounts();

    try {
      const data = await exchangeMicrosoftToken(acc);
      if (data && data.access_token) {
        if (data.refresh_token) acc.refreshToken = data.refresh_token;
        acc.accessToken = data.access_token;
        acc.status = 'ok';
        saveSettings();
        return data.access_token;
      }
    } catch (err) {
      console.error('OAuth error for ' + acc.email, err);
    }

    acc.status = 'err';
    renderAccounts();
    throw new Error('Could not authenticate ' + acc.email + ' (Check refresh token / network)');
  }

  async function syncSingleAccount(index) {
    const acc = ACCOUNTS[index];
    if (!acc) return;
    try {
      const token = await getAccessToken(acc);
      const data = await fetchGraphMessages(token);

      const messages = data.value || [];
      acc.status = 'ok';

      let newCount = 0;
      messages.forEach(m => {
        if (!SEEN_MESSAGE_IDS.has(m.id)) {
          SEEN_MESSAGE_IDS.add(m.id);
          newCount++;
          ALL_MESSAGES.unshift({ ...m, accountEmail: acc.email });

          // Forward to Telegram
          if (document.getElementById('telegram-auto-forward').checked) {
            forwardEmailToTelegram(acc.email, m);
          }
        }
      });

      if (newCount > 0) {
        playBeep();
      }

      renderAccounts();
      renderMessages();
    } catch (e) {
      acc.status = 'err';
      renderAccounts();
    }
  }

  async function syncAllInboxes() {
    const btn = document.getElementById('btn-sync-all');
    btn.disabled = true;
    btn.innerText = 'Syncing...';

    for (let i = 0; i < ACCOUNTS.length; i++) {
      try {
        await syncSingleAccount(i);
      } catch (e) {}
    }

    btn.disabled = false;
    btn.innerText = '🔄 Sync Inboxes';
  }

  function toggleAutoLoop() {
    const btn = document.getElementById('btn-toggle-loop');
    const statusEl = document.getElementById('auto-loop-status');

    if (AUTO_LOOP_TIMER) {
      clearInterval(AUTO_LOOP_TIMER);
      AUTO_LOOP_TIMER = null;
      btn.innerText = '▶ Start Auto-Check (15s)';
      btn.className = 'btn btn-secondary';
      statusEl.innerText = 'Paused';
      statusEl.style.color = '#94a3b8';
    } else {
      syncAllInboxes();
      AUTO_LOOP_TIMER = setInterval(syncAllInboxes, 15000);
      btn.innerText = '⏸ Pause Auto-Check';
      btn.className = 'btn btn-danger';
      statusEl.innerText = 'Running (15s)';
      statusEl.style.color = '#34d399';
    }
  }

  async function forwardEmailToTelegram(accountEmail, msg) {
    const token = document.getElementById('bot-token').value.trim();
    const chatId = document.getElementById('chat-id').value.trim();
    if (!token || !chatId) return;

    const sender = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown';
    const address = msg.from?.emailAddress?.address || '';
    const subject = msg.subject || '(No Subject)';
    const preview = msg.bodyPreview || '';

    const text = 
      '📬 <b>New Email Alert!</b>\\n' +
      '📧 <b>Inbox:</b> ' + accountEmail + '\\n' +
      '👤 <b>From:</b> ' + sender + ' (' + address + ')\\n' +
      '📌 <b>Subject:</b> ' + subject + '\\n\\n' +
      '📝 <b>Preview:</b>\\n' + (preview.substring(0, 300)) + '...';

    try {
      await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
    } catch (e) {}
  }

  async function testTelegramAlert() {
    const token = document.getElementById('bot-token').value.trim();
    const chatId = document.getElementById('chat-id').value.trim();
    const statusEl = document.getElementById('telegram-status');

    if (!token || !chatId) {
      alert('Please fill Telegram Bot Token and Chat ID first.');
      return;
    }

    statusEl.innerText = 'Testing...';
    try {
      const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🔔 <b>WinMail Universal Web Controller</b> is connected and active!\\n\\nYou will receive live email notifications here.',
          parse_mode: 'HTML'
        })
      });
      const data = await res.json();
      if (data.ok) {
        statusEl.innerText = 'Online ✅';
        statusEl.style.color = '#34d399';
        playBeep();
        alert('Telegram test alert sent successfully!');
      } else {
        throw new Error(data.description || 'Error');
      }
    } catch (e) {
      statusEl.innerText = 'Failed ❌';
      statusEl.style.color = '#ef4444';
      alert('Telegram test error: ' + e.message);
    }
  }

  function renderAccounts() {
    const container = document.getElementById('accounts-list');
    document.getElementById('total-accounts-count').innerText = ACCOUNTS.length;

    if (ACCOUNTS.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; padding: 10px 0;">No accounts added yet.</p>';
      return;
    }

    container.innerHTML = ACCOUNTS.map((acc, index) => \`
      <div class="account-item">
        <div style="overflow: hidden;">
          <div class="acc-email">\${acc.email}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
            Client ID: \${acc.clientId ? acc.clientId.substring(0, 8) : 'Default'}...
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; shrink-0;">
          <span class="acc-status \${acc.status === 'ok' ? 'status-ok' : acc.status === 'err' ? 'status-err' : acc.status === 'syncing' ? 'status-syncing' : 'status-idle'}">
            \${acc.status === 'ok' ? 'Connected' : acc.status === 'err' ? 'Error' : acc.status === 'syncing' ? 'Syncing...' : 'Ready'}
          </span>
          <button class="btn" style="font-size: 0.7rem; padding: 4px 8px;" onclick="syncSingleAccount(\${index})">Fetch</button>
          <button class="btn btn-secondary" style="font-size: 0.7rem; padding: 4px 8px; color: #ef4444;" onclick="deleteAccount(\${index})">✕</button>
        </div>
      </div>
    \`).join('');
  }

  function renderMessages() {
    const container = document.getElementById('messages-container');
    const filter = (document.getElementById('search-filter').value || '').toLowerCase();
    
    const filtered = ALL_MESSAGES.filter(m => 
      (m.subject || '').toLowerCase().includes(filter) ||
      (m.from?.emailAddress?.name || '').toLowerCase().includes(filter) ||
      (m.from?.emailAddress?.address || '').toLowerCase().includes(filter) ||
      (m.accountEmail || '').toLowerCase().includes(filter)
    );

    document.getElementById('total-messages-count').innerText = ALL_MESSAGES.length;

    if (filtered.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 30px;">No messages match filter.</p>';
      return;
    }

    container.innerHTML = filtered.map((msg, i) => \`
      <div class="message-card" onclick="openModal(\${i})">
        <div class="msg-header">
          <span class="msg-sender">\${msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown'} &lt;\${msg.from?.emailAddress?.address || ''}&gt;</span>
          <span>\${new Date(msg.receivedDateTime).toLocaleTimeString()}</span>
        </div>
        <div class="msg-subject">\${msg.subject || '(No Subject)'}</div>
        <div class="msg-body">\${(msg.bodyPreview || '').substring(0, 180)}...</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
          Inbox: <b style="color: #60a5fa;">\${msg.accountEmail}</b>
        </div>
      </div>
    \`).join('');
  }

  function openModal(index) {
    const msg = ALL_MESSAGES[index];
    if (!msg) return;
    document.getElementById('modal-subject').innerText = msg.subject || '(No Subject)';
    document.getElementById('modal-sender').innerText = 'From: ' + (msg.from?.emailAddress?.name || '') + ' <' + (msg.from?.emailAddress?.address || '') + '>';
    document.getElementById('modal-date').innerText = 'Date: ' + new Date(msg.receivedDateTime).toLocaleString();
    document.getElementById('modal-account').innerText = 'Account: ' + msg.accountEmail;
    document.getElementById('modal-content').innerText = msg.body?.content || msg.bodyPreview || '(No Body Content)';
    document.getElementById('email-modal').style.display = 'flex';
  }

  function closeModal(e) {
    document.getElementById('email-modal').style.display = 'none';
  }

  function addAccountFromQuickString() {
    const input = document.getElementById('quick-input');
    const val = input.value.trim();
    if (!val) return;

    const parts = val.split(/[|:\\t,]/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) {
      alert('Format: email|password|refresh_token|client_id');
      return;
    }

    const email = parts[0];
    const password = parts[1] || '';
    const refreshToken = parts[2];
    const clientId = parts[3] || '9e5f94bc-e8a4-4e73-b8be-63364c29d753';

    ACCOUNTS.unshift({
      email,
      password,
      refreshToken,
      clientId,
      label: email.split('@')[0],
      status: 'idle'
    });

    input.value = '';
    saveSettings();
    renderAccounts();
    syncSingleAccount(0);
  }

  function deleteAccount(index) {
    if (confirm('Remove ' + ACCOUNTS[index].email + '?')) {
      ACCOUNTS.splice(index, 1);
      saveSettings();
      renderAccounts();
    }
  }

  function exportAccountsTxt() {
    const text = ACCOUNTS.map(a => \`\${a.email}|\${a.password || ''}|\${a.refreshToken}|\${a.clientId}\`).join('\\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initialization
  loadPersistedData();
  renderAccounts();
</script>
</body>
</html>`;
}

export function generateStpPythonScript(): string {
  return `#!/usr/bin/env python3
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
        return [], DEFAULT_PASSWORD, f"{DEFAULT_PASSWORD}\\n"

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
    ensure_directories()
    current_emails, current_pass, _ = read_stp()
    
    final_pass = (password.strip() if password and password.strip() else current_pass) or DEFAULT_PASSWORD
    clean_emails = [e.strip() for e in emails if e and e.strip() and "@" in e]
    
    seen = set()
    unique_emails = []
    for e in clean_emails:
        if e.lower() not in seen:
            seen.add(e.lower())
            unique_emails.append(e)

    if unique_emails:
        formatted_content = "\\n".join(unique_emails) + "\\n" + final_pass + "\\n"
    else:
        formatted_content = final_pass + "\\n"

    for path in FILE_PATHS:
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(formatted_content)
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to write {path}: {e}\\n")

    return formatted_content

def main():
    parser = argparse.ArgumentParser(description="STP.txt Manager (Python)")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    subparsers.add_parser("read", help="Read STP.txt and output JSON")

    write_parser = subparsers.add_parser("write", help="Write emails and static password")
    write_parser.add_argument("--emails", nargs="*", default=[], help="List of email addresses")
    write_parser.add_argument("--password", type=str, default="", help="Static password")

    add_parser = subparsers.add_parser("add", help="Add email(s)")
    add_parser.add_argument("emails", nargs="+", help="Email addresses to add")

    remove_parser = subparsers.add_parser("remove", help="Remove email(s)")
    remove_parser.add_argument("emails", nargs="+", help="Email addresses to remove")

    pass_parser = subparsers.add_parser("set-pass", help="Set static password")
    pass_parser.add_argument("password", type=str, help="New static password")

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
        print(json.dumps({"ok": True, "message": "STP.txt updated successfully", "content": res}))
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
    else:
        emails, password, raw = read_stp()
        print(raw)

if __name__ == "__main__":
    main()
`;
}


