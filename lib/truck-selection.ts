"use client";

import { useSyncExternalStore } from "react";
import { findMovingPackage, isBookablePackageId, type MovingPackageId } from "./site-data";

/**
 * The visitor's chosen truck, shared by the homepage truck cards, the quote form and
 * the booking wizard. Held in sessionStorage so it survives the hop to /book, and
 * announced through a window event so every picker on the page stays in step.
 * Only ids that exist in the canonical package table are ever accepted.
 */
const STORAGE_KEY = "hf-selected-truck";
const EVENT_NAME = "hf-truck-selection";

function read(): MovingPackageId | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored && isBookablePackageId(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** In-memory fallback for browsers where sessionStorage is blocked. */
let memorySelection: MovingPackageId | null = null;

function snapshot(): MovingPackageId | null {
  return read() ?? memorySelection;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setSelectedTruck(id: MovingPackageId | null): void {
  if (id !== null && !findMovingPackage({ id })) return;
  memorySelection = id;
  try {
    if (id) window.sessionStorage.setItem(STORAGE_KEY, id);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the in-memory copy still keeps this page consistent.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useSelectedTruck(): MovingPackageId | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function getSelectedTruck(): MovingPackageId | null {
  return typeof window === "undefined" ? null : snapshot();
}
