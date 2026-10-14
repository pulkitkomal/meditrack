#!/usr/bin/env python3
"""
Standalone Telegram bot service. Runs as its own Docker service so that scaling the API
(e.g. multiple uvicorn workers) never starts duplicate bots polling the same token.
"""
import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("medical-records-app-bot")

from app.services.telegram_bot import setup_bot, start_bot


if __name__ == "__main__":
    if not setup_bot():
        logger.warning("[TELEGRAM] Bot not configured (TELEGRAM_BOT_TOKEN missing); exiting")
    else:
        try:
            asyncio.run(start_bot())
        except KeyboardInterrupt:
            logger.info("[TELEGRAM] Bot stopped by user")
