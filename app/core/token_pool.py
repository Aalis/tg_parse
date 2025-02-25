from typing import List, Optional
from telethon import TelegramClient
import os
import logging
import random
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class TokenInfo:
    def __init__(self, token: str):
        self.token = token
        self.client: Optional[TelegramClient] = None
        self.last_used: datetime = datetime.min
        self.error_count: int = 0
        self.is_available: bool = True
        self.cooldown_until: datetime = datetime.min

    def mark_error(self):
        self.error_count += 1
        if self.error_count >= 3:  # After 3 errors, put the token in cooldown
            self.is_available = False
            self.cooldown_until = datetime.now() + timedelta(minutes=15)
            logger.warning(f"Token {self.token[:8]}... placed in cooldown until {self.cooldown_until}")

    def check_cooldown(self):
        if not self.is_available and datetime.now() > self.cooldown_until:
            self.is_available = True
            self.error_count = 0
            logger.info(f"Token {self.token[:8]}... restored from cooldown")

class TokenPool:
    def __init__(self, api_id: str, api_hash: str):
        self.api_id = api_id
        self.api_hash = api_hash
        self.tokens: List[TokenInfo] = []
        self._initialize_tokens()

    def _initialize_tokens(self):
        tokens_str = os.getenv('TELEGRAM_BOT_TOKENS', '')
        if not tokens_str:
            raise ValueError("No bot tokens found in environment variables")
        
        tokens = [token.strip() for token in tokens_str.split(',')]
        self.tokens = [TokenInfo(token) for token in tokens]
        logger.info(f"Initialized token pool with {len(self.tokens)} tokens")

    async def initialize_clients(self):
        """Initialize TelegramClient for each token"""
        for token_info in self.tokens:
            try:
                client = TelegramClient(
                    f'bot_session_{token_info.token[:8]}',
                    self.api_id,
                    self.api_hash
                )
                await client.start(bot_token=token_info.token)
                token_info.client = client
                logger.info(f"Successfully initialized client for token {token_info.token[:8]}...")
            except Exception as e:
                logger.error(f"Failed to initialize client for token {token_info.token[:8]}: {str(e)}")
                token_info.is_available = False

    async def get_client(self) -> Optional[TelegramClient]:
        """Get the next available client using a weighted random selection"""
        available_tokens = [t for t in self.tokens if t.is_available]
        
        # Check cooldowns and restore tokens if possible
        for token in self.tokens:
            token.check_cooldown()
        
        if not available_tokens:
            logger.error("No available tokens in the pool")
            return None

        # Weight tokens by their last use time (prefer less recently used tokens)
        now = datetime.now()
        weights = []
        for token in available_tokens:
            time_since_last_use = (now - token.last_used).total_seconds()
            weight = min(time_since_last_use / 60, 10)  # Cap at 10 minutes
            weights.append(1 + weight)  # Add 1 to ensure all tokens have a chance

        chosen_token = random.choices(available_tokens, weights=weights, k=1)[0]
        chosen_token.last_used = now
        return chosen_token.client

    def mark_error(self, client: TelegramClient):
        """Mark a token as having an error"""
        for token_info in self.tokens:
            if token_info.client == client:
                token_info.mark_error()
                break

    async def close_all(self):
        """Close all client connections"""
        for token_info in self.tokens:
            if token_info.client:
                await token_info.client.disconnect()

    @property
    def active_token_count(self) -> int:
        """Return the number of currently available tokens"""
        return len([t for t in self.tokens if t.is_available])

    def get_pool_status(self) -> dict:
        """Get the current status of the token pool"""
        return {
            "total_tokens": len(self.tokens),
            "active_tokens": self.active_token_count,
            "tokens": [
                {
                    "id": token.token[:8],
                    "status": "available" if token.is_available else "cooldown",
                    "error_count": token.error_count,
                    "cooldown_until": token.cooldown_until.isoformat() if not token.is_available else None
                }
                for token in self.tokens
            ]
        } 