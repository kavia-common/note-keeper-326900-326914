/**
 * notesStore.js
 * Local persistence and query utilities for Notes.
 *
 * Data model:
 *  - Note: { id, title, content, tags: string[], updatedAt, createdAt }
 */

const STORAGE_KEY = "note_keeper.notes.v1";

/**
 * Generates a reasonably unique ID without external dependencies.
 * @returns {string}
 */
function generateId() {
  // Use crypto if available; fall back to timestamp+random.
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Defensive parse for localStorage JSON.
 * @returns {Array<object>}
 */
function safeLoadArray() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist notes array to localStorage.
 * @param {Array<object>} notes
 */
function saveArray(notes) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/**
 * Normalize tags from user input.
 * Accepts either comma separated string or array; returns cleaned unique array.
 * @param {string|string[]} tags
 * @returns {string[]}
 */
function normalizeTags(tags) {
  const arr = Array.isArray(tags) ? tags : String(tags || "").split(",");
  const cleaned = arr
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, " "));
  // Unique, preserve order
  return [...new Set(cleaned)];
}

/**
 * Basic full-text match across title/content/tags.
 * @param {object} note
 * @param {string} query
 * @returns {boolean}
 */
function matchesQuery(note, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    note.title || "",
    note.content || "",
    ...(Array.isArray(note.tags) ? note.tags : []),
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(q);
}

/**
 * Sort notes by updatedAt desc.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function sortByUpdatedDesc(a, b) {
  return (b.updatedAt || 0) - (a.updatedAt || 0);
}

// PUBLIC_INTERFACE
export function loadNotes() {
  /** Load all notes from localStorage. */
  const notes = safeLoadArray()
    .map((n) => ({
      id: n.id,
      title: n.title || "",
      content: n.content || "",
      tags: normalizeTags(n.tags || []),
      createdAt: Number(n.createdAt || Date.now()),
      updatedAt: Number(n.updatedAt || n.createdAt || Date.now()),
    }))
    .sort(sortByUpdatedDesc);

  return notes;
}

// PUBLIC_INTERFACE
export function seedIfEmpty() {
  /** Seed example notes if storage is empty to improve first-run UX. */
  const existing = loadNotes();
  if (existing.length > 0) return existing;

  const now = Date.now();
  const seeded = [
    {
      id: generateId(),
      title: "Welcome to Note Keeper",
      content:
        "Create notes, add optional tags, and search instantly.\n\nEverything is stored locally in your browser.",
      tags: ["welcome", "tips"],
      createdAt: now - 1000 * 60 * 10,
      updatedAt: now - 1000 * 60 * 10,
    },
    {
      id: generateId(),
      title: "Ideas",
      content: "• Build a habit tracker\n• Plan weekend trip\n• Draft blog outline",
      tags: ["personal"],
      createdAt: now - 1000 * 60 * 3,
      updatedAt: now - 1000 * 60 * 3,
    },
  ];

  saveArray(seeded);
  return seeded.sort(sortByUpdatedDesc);
}

// PUBLIC_INTERFACE
export function createNote({ title, content, tags }) {
  /** Create a new note and persist it. Returns created note. */
  const notes = loadNotes();
  const now = Date.now();
  const note = {
    id: generateId(),
    title: (title || "").trim() || "Untitled",
    content: content || "",
    tags: normalizeTags(tags || []),
    createdAt: now,
    updatedAt: now,
  };

  notes.unshift(note);
  saveArray(notes);
  return note;
}

// PUBLIC_INTERFACE
export function updateNote(noteId, patch) {
  /** Update an existing note by id. Returns updated note or null if not found. */
  const notes = loadNotes();
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return null;

  const current = notes[idx];
  const updated = {
    ...current,
    title:
      patch.title !== undefined
        ? (patch.title || "").trim() || "Untitled"
        : current.title,
    content: patch.content !== undefined ? patch.content : current.content,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
    updatedAt: Date.now(),
  };

  notes[idx] = updated;
  notes.sort(sortByUpdatedDesc);
  saveArray(notes);
  return updated;
}

// PUBLIC_INTERFACE
export function deleteNote(noteId) {
  /** Delete note by id. Returns boolean indicating success. */
  const notes = loadNotes();
  const filtered = notes.filter((n) => n.id !== noteId);
  if (filtered.length === notes.length) return false;
  saveArray(filtered);
  return true;
}

// PUBLIC_INTERFACE
export function searchNotes({ query, tag }) {
  /**
   * Search notes by query and optional tag filter.
   * @param {{query: string, tag?: string}} params
   * @returns {Array<object>}
   */
  const notes = loadNotes();
  const normalizedTag = (tag || "").trim().toLowerCase();

  return notes.filter((n) => {
    const tagOk =
      !normalizedTag ||
      (Array.isArray(n.tags) ? n.tags : []).some((t) => t.toLowerCase() === normalizedTag);
    return tagOk && matchesQuery(n, query || "");
  });
}

// PUBLIC_INTERFACE
export function getAllTags() {
  /** Get all tags with counts: [{tag, count}] sorted alphabetically. */
  const notes = loadNotes();
  const counts = new Map();

  for (const n of notes) {
    for (const t of normalizeTags(n.tags || [])) {
      const key = t;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}
