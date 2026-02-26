import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  createNote,
  deleteNote,
  getAllTags,
  searchNotes,
  seedIfEmpty,
  updateNote,
} from "./services/notesStore";

/**
 * Format a timestamp as a compact "date time" string.
 * @param {number} ts
 * @returns {string}
 */
function formatUpdated(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Parse comma-separated tags.
 * @param {string} value
 * @returns {string[]}
 */
function parseTagsInput(value) {
  return String(value || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Convert tags array to input string.
 * @param {string[]} tags
 * @returns {string}
 */
function tagsToInput(tags) {
  return (Array.isArray(tags) ? tags : []).join(", ");
}

// PUBLIC_INTERFACE
function App() {
  /** Main Notes application component. */
  const [theme, setTheme] = useState("light");

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(""); // empty = all tags
  const [notesVersion, setNotesVersion] = useState(0); // force refresh from store
  const [selectedId, setSelectedId] = useState(null);

  // Editor state (controlled)
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const lastLoadedIdRef = useRef(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Seed notes on first mount and select first note.
  useEffect(() => {
    const seeded = seedIfEmpty();
    if (!selectedId && seeded.length > 0) {
      setSelectedId(seeded[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tags = useMemo(() => getAllTags(), [notesVersion]);

  const filteredNotes = useMemo(() => {
    return searchNotes({ query, tag: activeTag });
  }, [query, activeTag, notesVersion]);

  const selectedNote = useMemo(() => {
    return filteredNotes.find((n) => n.id === selectedId) || null;
  }, [filteredNotes, selectedId]);

  // When selection changes, load note into editor draft.
  useEffect(() => {
    if (!selectedNote) return;
    if (lastLoadedIdRef.current === selectedNote.id) return;

    lastLoadedIdRef.current = selectedNote.id;
    setDraftTitle(selectedNote.title || "");
    setDraftTags(tagsToInput(selectedNote.tags || []));
    setDraftContent(selectedNote.content || "");
  }, [selectedNote]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedNote) return false;
    const tagsArr = parseTagsInput(draftTags);
    const originalTags = Array.isArray(selectedNote.tags) ? selectedNote.tags : [];
    return (
      (draftTitle || "").trim() !== (selectedNote.title || "").trim() ||
      draftContent !== (selectedNote.content || "") ||
      tagsToInput(tagsArr) !== tagsToInput(originalTags)
    );
  }, [draftTitle, draftTags, draftContent, selectedNote]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    /** Toggle between light and dark theme. */
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // PUBLIC_INTERFACE
  const handleNewNote = () => {
    /** Create a new note and select it. */
    const note = createNote({ title: "Untitled", content: "", tags: [] });
    setNotesVersion((v) => v + 1);
    setSelectedId(note.id);
    setQuery("");
    setActiveTag("");
  };

  // PUBLIC_INTERFACE
  const handleDeleteSelected = () => {
    /** Delete currently selected note. */
    if (!selectedNote) return;
    const ok = window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`);
    if (!ok) return;

    deleteNote(selectedNote.id);

    const remaining = searchNotes({ query, tag: activeTag });
    setNotesVersion((v) => v + 1);

    // Choose a new selected note deterministically.
    const next = remaining.find((n) => n.id !== selectedNote.id) || null;
    setSelectedId(next ? next.id : null);
    lastLoadedIdRef.current = null;
  };

  // PUBLIC_INTERFACE
  const handleSave = () => {
    /** Save draft changes into selected note. */
    if (!selectedNote) return;
    updateNote(selectedNote.id, {
      title: draftTitle,
      content: draftContent,
      tags: parseTagsInput(draftTags),
    });
    setNotesVersion((v) => v + 1);
  };

  const onSelectNote = (noteId) => {
    if (noteId === selectedId) return;
    if (hasUnsavedChanges) {
      const proceed = window.confirm("You have unsaved changes. Discard them and switch notes?");
      if (!proceed) return;
    }
    setSelectedId(noteId);
    lastLoadedIdRef.current = null;
  };

  const clearFilters = () => {
    setQuery("");
    setActiveTag("");
  };

  return (
    <div className="App">
      <div className="appShell">
        <header className="appHeader">
          <div className="appHeader__left">
            <div className="brand">
              <div className="brand__mark" aria-hidden="true">
                NK
              </div>
              <div className="brand__text">
                <div className="brand__name">Note Keeper</div>
                <div className="brand__tagline">Local, fast, searchable notes</div>
              </div>
            </div>
          </div>

          <div className="appHeader__right">
            <button className="btn btn--primary" onClick={handleNewNote}>
              New note
            </button>

            <button
              className="btn btn--ghost"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title="Toggle theme"
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>
          </div>
        </header>

        <main className="appMain">
          <aside className="sidebar" aria-label="Sidebar">
            <div className="sidebar__section">
              <label className="fieldLabel" htmlFor="searchInput">
                Search
              </label>
              <div className="searchRow">
                <input
                  id="searchInput"
                  className="input"
                  placeholder="Search notes…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="btn btn--ghost btn--icon" onClick={clearFilters} title="Clear">
                  ⟲
                </button>
              </div>
            </div>

            <div className="sidebar__section">
              <div className="sidebar__sectionHeader">
                <div className="fieldLabel">Tags</div>
                <button
                  className={`chip ${activeTag === "" ? "chip--active" : ""}`}
                  onClick={() => setActiveTag("")}
                >
                  All
                </button>
              </div>

              <div className="tagList" role="list">
                {tags.length === 0 ? (
                  <div className="muted">No tags yet</div>
                ) : (
                  tags.map((t) => (
                    <button
                      key={t.tag}
                      className={`tagItem ${activeTag === t.tag ? "tagItem--active" : ""}`}
                      onClick={() => setActiveTag((prev) => (prev === t.tag ? "" : t.tag))}
                      role="listitem"
                      title={`Filter by ${t.tag}`}
                    >
                      <span className="tagItem__name">{t.tag}</span>
                      <span className="tagItem__count">{t.count}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="sidebar__section sidebar__footerHint">
              <div className="muted">
                Stored locally in your browser.
                <br />
                No account required.
              </div>
            </div>
          </aside>

          <section className="content" aria-label="Notes content">
            <div className="contentGrid">
              <div className="noteListPane" aria-label="Note list">
                <div className="paneHeader">
                  <div>
                    <div className="paneTitle">Notes</div>
                    <div className="paneSubtitle">
                      {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
                      {activeTag ? ` • tag: ${activeTag}` : ""}
                    </div>
                  </div>
                  <div className="paneActions">
                    <button className="btn btn--ghost" onClick={handleNewNote}>
                      + New
                    </button>
                  </div>
                </div>

                <div className="noteList" role="list">
                  {filteredNotes.length === 0 ? (
                    <div className="emptyState">
                      <div className="emptyState__title">No notes found</div>
                      <div className="emptyState__desc">
                        Try a different search or create a new note.
                      </div>
                      <button className="btn btn--primary" onClick={handleNewNote}>
                        Create note
                      </button>
                    </div>
                  ) : (
                    filteredNotes.map((n) => (
                      <button
                        key={n.id}
                        className={`noteCard ${selectedId === n.id ? "noteCard--active" : ""}`}
                        onClick={() => onSelectNote(n.id)}
                        role="listitem"
                      >
                        <div className="noteCard__top">
                          <div className="noteCard__title">{n.title || "Untitled"}</div>
                          <div className="noteCard__time">{formatUpdated(n.updatedAt)}</div>
                        </div>
                        <div className="noteCard__preview">
                          {(n.content || "").replace(/\n/g, " ").slice(0, 120) || "—"}
                        </div>
                        <div className="noteCard__tags">
                          {(Array.isArray(n.tags) ? n.tags : []).slice(0, 3).map((t) => (
                            <span className="pill" key={`${n.id}-${t}`}>
                              {t}
                            </span>
                          ))}
                          {(Array.isArray(n.tags) ? n.tags : []).length > 3 ? (
                            <span className="pill pill--muted">
                              +{(n.tags || []).length - 3}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="editorPane" aria-label="Note editor">
                {!selectedNote ? (
                  <div className="editorEmpty">
                    <div className="emptyState__title">Select a note</div>
                    <div className="emptyState__desc">
                      Choose a note from the list or create a new one.
                    </div>
                    <button className="btn btn--primary" onClick={handleNewNote}>
                      New note
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="paneHeader paneHeader--editor">
                      <div>
                        <div className="paneTitle">Editor</div>
                        <div className="paneSubtitle">
                          Updated {formatUpdated(selectedNote.updatedAt)}
                          {hasUnsavedChanges ? " • Unsaved changes" : ""}
                        </div>
                      </div>

                      <div className="paneActions">
                        <button
                          className="btn btn--danger"
                          onClick={handleDeleteSelected}
                          title="Delete note"
                        >
                          Delete
                        </button>
                        <button
                          className="btn btn--primary"
                          onClick={handleSave}
                          disabled={!hasUnsavedChanges}
                          title="Save changes"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="editorBody">
                      <div className="formRow">
                        <div className="formCol">
                          <label className="fieldLabel" htmlFor="titleInput">
                            Title
                          </label>
                          <input
                            id="titleInput"
                            className="input"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            placeholder="Note title"
                          />
                        </div>

                        <div className="formCol">
                          <label className="fieldLabel" htmlFor="tagsInput">
                            Tags (comma separated)
                          </label>
                          <input
                            id="tagsInput"
                            className="input"
                            value={draftTags}
                            onChange={(e) => setDraftTags(e.target.value)}
                            placeholder="e.g. work, ideas"
                          />
                        </div>
                      </div>

                      <div className="formRow">
                        <div className="formCol formCol--full">
                          <label className="fieldLabel" htmlFor="contentInput">
                            Content
                          </label>
                          <textarea
                            id="contentInput"
                            className="textarea"
                            value={draftContent}
                            onChange={(e) => setDraftContent(e.target.value)}
                            placeholder="Write your note…"
                            rows={14}
                          />
                        </div>
                      </div>

                      <div className="editorFooter">
                        <div className="muted">
                          Tip: Use tags to organize notes and click a tag in the sidebar to filter.
                        </div>
                        <div className="editorFooter__actions">
                          <button className="btn btn--ghost" onClick={handleSave} disabled={!hasUnsavedChanges}>
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
