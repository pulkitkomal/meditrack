import os
import re
import json
import logging
import io
import base64
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from bson import ObjectId

from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters
from pytesseract import pytesseract
from PIL import Image

logger = logging.getLogger("medical-records-app")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
USE_OPENAI_VISION = os.getenv("USE_OPENAI_VISION", "true").lower() == "true"

# Global application reference
app: Optional[Any] = None
scheduler = None

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    from app.main import app
    db = app.mongo_db
    
    # Check for start parameter (link token)
    if context.args:
        token = context.args[0]
        chat_id = update.effective_chat.id
        
        # Find user with this token
        user = await db.users.find_one({"telegram_link_token": token})
        
        if user:
            # Check if token expired
            expires = user.get("telegram_link_expires")
            if expires and expires < datetime.utcnow():
                await update.message.reply_text("❌ This link has expired. Please generate a new one from the Profile page.")
                return
            
            # Link the user with default settings
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "telegram_chat_id": str(chat_id), 
                    "telegram_enabled": True, 
                    "telegram_link_token": None, 
                    "telegram_link_expires": None,
                    "notification_times": ["08:00", "12:00", "18:00", "21:00"],
                    "tracking_types": ["glucose", "bp"]
                }}
            )
            
            await update.message.reply_text(
                "✅ *Successfully connected to HealthSync!*\n\n"
                "Your Telegram is now linked to your account. You can:\n"
                "• Send glucose readings (e.g., `150`)\n"
                "• Send blood pressure (e.g., `120/80`)\n"
                "• Send photos of your meters\n\n"
                "Use `/status` to see your latest readings.",
                parse_mode="Markdown"
            )
            return
        else:
            await update.message.reply_text("❌ Invalid or expired link. Please generate a new one from the Profile page.")
            return
    
    await update.message.reply_text(
        "🏥 *HealthSync Health Bot*\n\n"
        "Welcome! I'll help you track your glucose and blood pressure readings.\n\n"
        "📝 *How to use:*\n"
        "• Send text like `150` for glucose (mg/dL)\n"
        "• Send text like `120/80` for blood pressure\n"
        "• Send a photo of your glucometer or BP monitor\n"
        "• Type `/status` to see your latest readings\n"
        "• Type `/help` for more commands\n\n"
        "Use /settings to configure your notification preferences.",
        parse_mode="Markdown"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    await update.message.reply_text(
        "📖 *Commands:*\n\n"
        "• `/start` - Start the bot\n"
        "• `/status` - View latest readings\n"
        "• `/help` - Show this help message\n"
        "• `/settings` - Configure notifications\n"
        "• `/stop` - Disable notifications\n\n"
        "💡 *Quick Tips:*\n"
        "• Glucose: Send just the number (e.g., `150`)\n"
        "• Blood Pressure: Send as `systolic/diastolic` (e.g., `120/80`)\n"
        "• Photos: Send a clear photo of your meter",
        parse_mode="Markdown"
    )

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command"""
    chat_id = update.effective_chat.id
    
    # Get user by chat_id
    from app.main import app
    db = app.mongo_db
    
    user = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not user:
        await update.message.reply_text("❌ Your Telegram is not linked to HealthSync. Please connect from the Profile page.")
        return
    
    # Get latest readings
    glucose_reading = await db.health_readings.find_one(
        {"user_id": str(user["_id"]), "type": "glucose"},
        sort=[("timestamp", -1)]
    )
    bp_reading = await db.health_readings.find_one(
        {"user_id": str(user["_id"]), "type": "bp"},
        sort=[("timestamp", -1)]
    )
    
    msg = "📊 *Your Latest Readings:*\n\n"
    if glucose_reading:
        msg += f"🩸 Glucose: *{glucose_reading['value']} {glucose_reading.get('unit', 'mg/dL')}*\n"
        msg += f"   {glucose_reading['timestamp'].strftime('%b %d, %I:%M %p')}\n\n"
    else:
        msg += "🩸 Glucose: No readings yet\n\n"
    
    if bp_reading:
        msg += f"💓 Blood Pressure: *{bp_reading['systolic']}/{bp_reading['diastolic']} mmHg*\n"
        msg += f"   {bp_reading['timestamp'].strftime('%b %d, %I:%M %p')}\n"
    else:
        msg += "💓 Blood Pressure: No readings yet"
    
    await update.message.reply_text(msg, parse_mode="Markdown")

async def stop_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stop command - disable notifications"""
    chat_id = update.effective_chat.id
    
    from app.main import app
    db = app.mongo_db
    
    await db.users.update_one(
        {"telegram_chat_id": str(chat_id)},
        {"$set": {"telegram_enabled": False, "notification_times": []}}
    )
    
    await update.message.reply_text("✅ Notifications disabled. You can re-enable them from the HealthSync Profile page.")

async def settings_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /settings command"""
    chat_id = update.effective_chat.id
    
    from app.main import app
    db = app.mongo_db
    
    user = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not user:
        await update.message.reply_text("❌ Your Telegram is not linked to HealthSync.")
        return
    
    tracking = user.get("tracking_types", [])
    times = user.get("notification_times", [])
    enabled = user.get("telegram_enabled", False)
    
    msg = "⚙️ *Your Settings:*\n\n"
    msg += f"Status: {'✅ Enabled' if enabled else '❌ Disabled'}\n"
    msg += f"Tracking: {', '.join(tracking) if tracking else 'None'}\n"
    msg += f"Reminders: {len(times)} times daily\n"
    if times:
        msg += f"Times: {', '.join(times)}\n"
    msg += "\n📱 To change settings, visit the HealthSync Profile page."
    
    await update.message.reply_text(msg, parse_mode="Markdown")

def parse_health_value(text: str) -> Optional[Dict[str, Any]]:
    """Parse text to extract health values"""
    text = text.strip()
    
    # Blood pressure pattern: 120/80 or 120/80/90 (with pulse)
    bp_match = re.match(r'^(\d{2,3})\s*/\s*(\d{2,3})(?:\s*/\s*(\d{2,3}))?$', text)
    if bp_match:
        systolic = int(bp_match.group(1))
        diastolic = int(bp_match.group(2))
        if 60 <= systolic <= 250 and 40 <= diastolic <= 150:
            return {
                "type": "bp",
                "systolic": systolic,
                "diastolic": diastolic,
                "value": f"{systolic}/{diastolic}",
                "unit": "mmHg"
            }
    
    # Glucose pattern (mg/dL): 150 or 150 mg/dL
    glucose_match = re.match(r'^(\d{1,3})(?:\s*mg/dL)?$', text, re.IGNORECASE)
    if glucose_match:
        value = int(glucose_match.group(1))
        if 20 <= value <= 600:
            return {
                "type": "glucose",
                "value": value,
                "unit": "mg/dL"
            }
    
    # Glucose pattern (mmol/L): 5.5 or 5.5 mmol/L
    mmol_match = re.match(r'^(\d+\.?\d*)\s*mmol/L?$', text, re.IGNORECASE)
    if mmol_match:
        mmol = float(mmol_match.group(1))
        if 1.0 <= mmol <= 33.3:
            # Convert to mg/dL
            mg_dl = round(mmol * 18.0182)
            return {
                "type": "glucose",
                "value": mg_dl,
                "unit": "mg/dL"
            }
    
    return None

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle incoming text messages"""
    text = update.message.text
    chat_id = update.effective_chat.id
    
    if text.startswith('/'):
        return  # Ignore commands
    
    # Get user
    from app.main import app
    db = app.mongo_db
    
    user = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not user:
        await update.message.reply_text("❌ Your Telegram is not linked to HealthSync.")
        return
    
    # Parse the value
    parsed = parse_health_value(text)
    if not parsed:
        await update.message.reply_text(
            "❓ I couldn't understand that value. "
            "Try:\n"
            "• `150` for glucose\n"
            "• `120/80` for blood pressure"
        )
        return
    
    # Save to database
    reading = {
        "user_id": str(user["_id"]),
        "type": parsed["type"],
        "value": parsed["value"],
        "unit": parsed.get("unit", "mg/dL"),
        "timestamp": datetime.utcnow(),
        "source": "telegram_text"
    }
    
    if parsed["type"] == "bp":
        reading["systolic"] = parsed["systolic"]
        reading["diastolic"] = parsed["diastolic"]
    
    await db.health_readings.insert_one(reading)
    
    # Confirm
    if parsed["type"] == "glucose":
        await update.message.reply_text(f"✅ Saved! Glucose: *{parsed['value']} {parsed['unit']}*", parse_mode="Markdown")
    else:
        await update.message.reply_text(f"✅ Saved! BP: *{parsed['systolic']}/{parsed['diastolic']} mmHg*", parse_mode="Markdown")

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle incoming photos"""
    chat_id = update.effective_chat.id
    
    from app.main import app
    db = app.mongo_db
    
    user = await db.users.find_one({"telegram_chat_id": str(chat_id)})
    if not user:
        await update.message.reply_text("❌ Your Telegram is not linked to HealthSync.")
        return
    
    await update.message.reply_text("📸 Processing image...")
    
    try:
        # Get the photo
        photo = update.message.photo[-1]
        file = await context.bot.get_file(photo.file_id)
        
        # Download to memory
        with io.BytesIO() as f:
            await file.download_to_memory(f)
            f.seek(0)
            image_data = f.read()
        
        # Process based on config
        if USE_OPENAI_VISION:
            parsed = await parse_with_openai(image_data)
        else:
            parsed = await parse_with_tesseract(image_data)
        
        if not parsed:
            await update.message.reply_text(
                "❓ Couldn't extract readings from this image. "
                "Please try sending a clearer photo of your glucometer or BP monitor."
            )
            return
        
        # Save to database
        reading = {
            "user_id": str(user["_id"]),
            "type": parsed["type"],
            "value": parsed["value"],
            "unit": parsed.get("unit", "mg/dL"),
            "timestamp": datetime.utcnow(),
            "source": "telegram_image"
        }
        
        if parsed["type"] == "bp":
            reading["systolic"] = parsed["systolic"]
            reading["diastolic"] = parsed["diastolic"]
        
        await db.health_readings.insert_one(reading)
        
        if parsed["type"] == "glucose":
            await update.message.reply_text(f"✅ Saved from image! Glucose: *{parsed['value']} {parsed['unit']}*", parse_mode="Markdown")
        else:
            await update.message.reply_text(f"✅ Saved from image! BP: *{parsed['systolic']}/{parsed['diastolic']} mmHg*", parse_mode="Markdown")
            
    except Exception as e:
        logger.error(f"[TELEGRAM] Error processing image: {e}")
        await update.message.reply_text("❌ Error processing image. Please try again.")

async def parse_with_openai(image_data: bytes) -> Optional[Dict[str, Any]]:
    """Parse image using OpenAI Vision"""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
        
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the glucose reading (mg/dL) or blood pressure (systolic/diastolic) from this image. Return JSON with: type (glucose/bp), value, unit, systolic (if bp), diastolic (if bp)."
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ]
                }
            ],
            max_tokens=200
        )
        
        result = response.choices[0].message.content
        parsed = json.loads(result)
        
        if parsed.get("type") == "glucose" and parsed.get("value"):
            return {"type": "glucose", "value": int(parsed["value"]), "unit": "mg/dL"}
        elif parsed.get("type") == "bp" and parsed.get("systolic") and parsed.get("diastolic"):
            return {
                "type": "bp",
                "systolic": int(parsed["systolic"]),
                "diastolic": int(parsed["diastolic"]),
                "value": f"{parsed['systolic']}/{parsed['diastolic']}",
                "unit": "mmHg"
            }
    except Exception as e:
        logger.error(f"[TELEGRAM] OpenAI vision error: {e}")
    
    return None

async def parse_with_tesseract(image_data: bytes) -> Optional[Dict[str, Any]]:
    """Parse image using Tesseract OCR"""
    try:
        image = Image.open(io.BytesIO(image_data))
        text = pytesseract.image_to_string(image)
        
        # Try to find patterns in extracted text
        # Look for glucose (typically 2-3 digit number)
        # Look for BP (systolic/diastolic pattern)
        
        lines = text.split('\n')
        for line in lines:
            parsed = parse_health_value(line)
            if parsed:
                return parsed
                
    except Exception as e:
        logger.error(f"[TELEGRAM] Tesseract error: {e}")
    
    return None

async def send_reminder(chat_id: int, tracking_types: list, context: ContextTypes.DEFAULT_TYPE):
    """Send reminder to user"""
    try:
        msg = "⏰ Time to log your health readings!\n\n"
        
        if "glucose" in tracking_types and "bp" in tracking_types:
            msg += "• Send your glucose reading (e.g., `150`)\n"
            msg += "• Send your blood pressure (e.g., `120/80`)\n"
            msg += "• Or send a photo of your meter"
        elif "glucose" in tracking_types:
            msg += "• Send your glucose reading (e.g., `150`)"
        elif "bp" in tracking_types:
            msg += "• Send your blood pressure (e.g., `120/80`)"
        else:
            return
        
        await context.bot.send_message(chat_id=chat_id, text=msg)
    except Exception as e:
        logger.error(f"[TELEGRAM] Reminder error: {e}")

def setup_bot():
    """Initialize and setup the Telegram bot"""
    global app
    
    if not BOT_TOKEN:
        logger.warning("[TELEGRAM] Bot token not configured, skipping bot initialization")
        return
    
    logger.info(f"[TELEGRAM] Initializing bot (OpenAI Vision: {USE_OPENAI_VISION})")
    
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    # Commands
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("stop", stop_command))
    application.add_handler(CommandHandler("settings", settings_command))
    
    # Messages
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))
    
    app = application
    
    # Set up webhook asynchronously
    import asyncio
    from telegram import Bot
    webhook_url = os.getenv("TELEGRAM_WEBHOOK_URL", "")
    if webhook_url:
        asyncio.get_event_loop().run_until_complete(
            application.bot.set_webhook(f"{webhook_url}/api/telegram/webhook")
        )
        logger.info(f"[TELEGRAM] Webhook set to {webhook_url}/api/telegram/webhook")
    else:
        logger.warning("[TELEGRAM] No WEBHOOK_URL set, bot will use long polling (may not work in container)")
    
    return application

async def process_link_token(token: str, chat_id: int, db) -> bool:
    """Process a link token to connect a user"""
    from datetime import datetime
    
    user = await db.users.find_one({"telegram_link_token": token})
    
    if not user:
        return False
    
    # Check expiration
    expires = user.get("telegram_link_expires")
    if expires and expires < datetime.utcnow():
        return False
    
    # Link the account
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "telegram_chat_id": str(chat_id),
            "telegram_enabled": True,
            "telegram_link_token": None,
            "telegram_link_expires": None
        }}
    )
    
    logger.info(f"[TELEGRAM] User {user['_id']} linked to chat {chat_id}")
    return True

async def start_bot():
    """Start the bot polling using manual polling"""
    global app
    
    if not app:
        logger.warning("[TELEGRAM] No app to start")
        return
    
    logger.info("[TELEGRAM] Starting manual bot polling...")
    
    await app.initialize()
    
    from telegram.error import TelegramError
    bot = app.bot
    offset = None
    
    while True:
        try:
            updates = await bot.get_updates(offset=offset, timeout=60)
            
            for update in updates:
                try:
                    await app.process_update(update)
                    offset = update.update_id + 1
                except Exception as e:
                    logger.error(f"[TELEGRAM] Error processing update: {e}")
            
            if not updates:
                await asyncio.sleep(1)
                
        except TelegramError as e:
            if "Timeout" in str(e):
                await asyncio.sleep(1)
            else:
                logger.error(f"[TELEGRAM] Telegram error: {e}")
                await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"[TELEGRAM] Polling error: {e}")
            await asyncio.sleep(5)