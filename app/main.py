from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from telethon import TelegramClient, errors
from telethon.tl.types import ChannelParticipantsAdmins, ChannelParticipantsRecent
from telethon.tl.functions.channels import GetFullChannelRequest
import asyncio
import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = FastAPI(title="Telegram Group Parser")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class GroupInfo(BaseModel):
    group_id: str
    name: str
    member_count: Optional[int]
    description: Optional[str]

class MemberInfo(BaseModel):
    user_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    is_premium: Optional[bool]
    can_message: bool
    is_admin: bool
    admin_title: Optional[str]

class GroupMembersResponse(BaseModel):
    success: bool
    data: Optional[List[MemberInfo]]
    error: Optional[str]
    total_count: Optional[int]
    has_more: bool

class TelegramResponse(BaseModel):
    success: bool
    data: Optional[dict]
    error: Optional[str]

# Initialize Telegram client
API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not all([API_ID, API_HASH, BOT_TOKEN]):
    raise ValueError("TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_BOT_TOKEN must be set in environment variables")

# Create the client but don't start it yet
client = TelegramClient('bot_session', API_ID, API_HASH)

@app.on_event("startup")
async def startup_event():
    """Start the Telegram client when the FastAPI app starts"""
    try:
        await client.start(bot_token=BOT_TOKEN)
        logger.info("Telegram client started successfully")
    except Exception as e:
        logger.error(f"Failed to start Telegram client: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Disconnect the Telegram client when the FastAPI app shuts down"""
    try:
        await client.disconnect()
        logger.info("Telegram client disconnected successfully")
    except Exception as e:
        logger.error(f"Error disconnecting Telegram client: {e}")

def extract_group_identifier(group_link: str) -> str:
    """Extract group username or chat_id from various link formats."""
    group_link = group_link.strip()
    
    if "t.me/" in group_link:
        group_link = re.sub(r'^https?://', '', group_link)
        match = re.search(r"t\.me/([^/?]+)", group_link)
        if match:
            return match.group(1)
    
    if group_link.startswith("@"):
        return group_link[1:]
    
    if "/" not in group_link and "." not in group_link:
        return group_link
    
    return group_link

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Telegram Group Parser API"}

@app.post("/api/parse-group", response_model=TelegramResponse)
async def parse_group(group_link: str = Query(..., description="Telegram group link or username")):
    try:
        group_id = extract_group_identifier(group_link)
        logger.info(f"Attempting to parse group with identifier: {group_id}")
        
        if not group_id:
            return TelegramResponse(
                success=False,
                data=None,
                error="Invalid group link format"
            )
        
        try:
            # Get group info
            entity = await client.get_entity(group_id)
            logger.info(f"Found entity type: {type(entity).__name__}")
            
            # Get member count
            full_chat = await client(GetFullChannelRequest(entity))
            member_count = full_chat.full_chat.participants_count
            
            # Store the ID with -100 prefix for supergroups/channels
            proper_id = f"-100{entity.id}" if str(entity.id).isdigit() else str(entity.id)
            
            group_info = GroupInfo(
                group_id=proper_id,
                name=entity.title,
                member_count=member_count,
                description=getattr(entity, 'about', None)
            )
            
            return TelegramResponse(
                success=True,
                data=group_info.dict(),
                error=None
            )
            
        except errors.ChatAdminRequiredError:
            return TelegramResponse(
                success=False,
                data=None,
                error="Bot needs to be an admin of the group to access this information"
            )
        except errors.ChannelPrivateError:
            return TelegramResponse(
                success=False,
                data=None,
                error="This is a private group. The bot needs to be a member."
            )
        except ValueError as e:
            if "Could not find the input entity" in str(e):
                return TelegramResponse(
                    success=False,
                    data=None,
                    error="Group not found. Please check if the group exists and is accessible."
                )
            raise
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return TelegramResponse(
            success=False,
            data=None,
            error=f"An unexpected error occurred: {str(e)}"
        )

@app.get("/api/group-members/{group_id}", response_model=GroupMembersResponse)
async def get_group_members(
    group_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    try:
        logger.info(f"Fetching members for group: {group_id} (offset: {offset}, limit: {limit})")
        
        try:
            # Convert group_id to proper format
            if group_id.startswith('-100'):
                entity_id = int(group_id)
            elif group_id.isdigit():
                entity_id = int(f"-100{group_id}")
            else:
                entity_id = group_id
                
            logger.info(f"Using entity ID: {entity_id}")
            
            # Get the entity first
            try:
                entity = await client.get_entity(entity_id)
            except ValueError:
                # If numeric ID fails, try as username
                entity = await client.get_entity(group_id)
            
            members = []
            total_count = 0
            
            # Get total member count
            try:
                full_chat = await client(GetFullChannelRequest(entity))
                total_count = full_chat.full_chat.participants_count
            except Exception as e:
                logger.warning(f"Could not get total member count: {str(e)}")
            
            # Get administrators first (always include them)
            admin_ids = set()
            if offset == 0:  # Only fetch admins for the first page
                async for admin in client.iter_participants(entity, filter=ChannelParticipantsAdmins):
                    try:
                        member_info = MemberInfo(
                            user_id=admin.id,
                            username=getattr(admin, 'username', None),
                            first_name=getattr(admin, 'first_name', None),
                            last_name=getattr(admin, 'last_name', None),
                            is_premium=getattr(admin, 'premium', None),
                            can_message=bool(getattr(admin, 'username', None)),
                            is_admin=True,
                            admin_title=getattr(admin, 'rank', None)
                        )
                        members.append(member_info)
                        admin_ids.add(admin.id)
                    except Exception as e:
                        logger.warning(f"Error processing admin {admin.id}: {str(e)}")
                        continue
            
            # Calculate how many regular members to fetch
            remaining_limit = limit
            if offset == 0:
                remaining_limit = max(0, limit - len(members))
                regular_offset = 0
            else:
                regular_offset = offset - len(admin_ids) if offset > len(admin_ids) else 0
            
            # Get regular members
            if remaining_limit > 0:
                all_participants = []
                async for p in client.iter_participants(entity):
                    if len(all_participants) >= regular_offset + remaining_limit:
                        break
                    if p.id not in admin_ids:
                        all_participants.append(p)
                
                # Get the slice we need
                participants_slice = all_participants[regular_offset:regular_offset + remaining_limit]
                
                for participant in participants_slice:
                    try:
                        member_info = MemberInfo(
                            user_id=participant.id,
                            username=getattr(participant, 'username', None),
                            first_name=getattr(participant, 'first_name', None),
                            last_name=getattr(participant, 'last_name', None),
                            is_premium=getattr(participant, 'premium', None),
                            can_message=bool(getattr(participant, 'username', None)),
                            is_admin=False,
                            admin_title=None
                        )
                        members.append(member_info)
                    except Exception as e:
                        logger.warning(f"Error processing member {participant.id}: {str(e)}")
                        continue
            
            # Calculate if there are more members to fetch
            has_more = (offset + len(members)) < total_count if total_count > 0 else len(members) >= limit
            
            return GroupMembersResponse(
                success=True,
                data=members,
                error=None,
                total_count=total_count,
                has_more=has_more
            )
            
        except errors.ChatAdminRequiredError:
            return GroupMembersResponse(
                success=False,
                data=None,
                error="Bot needs to be an admin of the group to access member list",
                total_count=None,
                has_more=False
            )
        except errors.ChannelPrivateError:
            return GroupMembersResponse(
                success=False,
                data=None,
                error="This is a private group. The bot needs to be a member.",
                total_count=None,
                has_more=False
            )
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return GroupMembersResponse(
            success=False,
            data=None,
            error=f"An unexpected error occurred: {str(e)}",
            total_count=None,
            has_more=False
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 