from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base

class TelegramGroup(Base):
    __tablename__ = "telegram_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    member_count = Column(Integer)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by_user_id = Column(Integer, ForeignKey("users.id"))

    members = relationship("TelegramMember", back_populates="group")
    created_by = relationship("User")

class TelegramMember(Base):
    __tablename__ = "telegram_members"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    username = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    is_premium = Column(Boolean, default=False)
    can_message = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    admin_title = Column(String)
    group_id = Column(Integer, ForeignKey("telegram_groups.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    group = relationship("TelegramGroup", back_populates="members")

    class Config:
        orm_mode = True
