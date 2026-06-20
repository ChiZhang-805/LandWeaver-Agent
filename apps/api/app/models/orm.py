from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ProjectORM(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")


class ParcelORM(Base):
    __tablename__ = "parcels"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True, nullable=False)
    boundary: Mapped[dict] = mapped_column(JSONB, nullable=False)
    north_angle_deg: Mapped[float] = mapped_column(Float, default=0)
    area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)


class ConstraintSetORM(Base):
    __tablename__ = "constraint_sets"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)


class BuildingPrototypeORM(Base):
    __tablename__ = "building_prototypes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)


class SiteOptionORM(Base):
    __tablename__ = "site_options"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True, nullable=False)
    strategy: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)

