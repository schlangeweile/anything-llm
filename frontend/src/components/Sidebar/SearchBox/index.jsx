import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import paths from "@/utils/paths";
import Preloader from "@/components/Preloader";
import debounce from "lodash.debounce";
import Workspace from "@/models/workspace";
import { Tooltip } from "react-tooltip";

const DEFAULT_SEARCH_RESULTS = {
  workspaces: [],
  threads: [],
};

const SEARCH_RESULT_SELECTED = "search-result-selected";
export default function SearchBox({ user, showNewWsModal }) {
  const { t } = useTranslation();
  const searchRef = useRef(null);
  const containerRef = useRef(null);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState(DEFAULT_SEARCH_RESULTS);

  // Stable debounce instance: recreating it on every render would leave one
  // pending timer per keystroke.
  const handleSearch = useMemo(
    () =>
      debounce(async (searchValue) => {
        if (String(searchValue).trim().length < 3) {
          setShowResults(false);
          setSearchResults(DEFAULT_SEARCH_RESULTS);
          setLoading(false);
          return;
        }
        setLoading(true);
        setShowResults(true);
        try {
          const results = await Workspace.searchWorkspaceOrThread(searchValue);
          setSearchResults(results);
        } catch (error) {
          console.error(error);
          setSearchResults(DEFAULT_SEARCH_RESULTS);
        } finally {
          setLoading(false);
        }
      }, 500),
    []
  );

  function handleChange(event) {
    const value = event.target.value;
    setSearchTerm(value);
    // Close immediately once the term is too short; the debounced request
    // only controls the results themselves.
    if (value.trim().length < 3) setShowResults(false);
    handleSearch(value);
  }

  function closeResults() {
    handleSearch.cancel();
    setShowResults(false);
  }

  function handleReset() {
    handleSearch.cancel();
    if (searchRef.current) searchRef.current.value = "";
    setSearchTerm("");
    setLoading(false);
    setSearchResults(DEFAULT_SEARCH_RESULTS);
    setShowResults(false);
  }

  function handleClear() {
    handleReset();
    searchRef.current?.focus();
  }

  // Dismiss the overlay on any click outside of the search area, on Escape
  // and on navigation. Clicking an open thread used to leave the results
  // covering the sidebar.
  useEffect(() => {
    function onPointerDown(event) {
      if (containerRef.current?.contains(event.target)) return;
      closeResults();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    closeResults();
  }, [location.pathname]);

  useEffect(() => {
    if (!showResults) return;
    function onKeyDown(event) {
      if (event.key === "Escape") closeResults();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showResults]);

  useEffect(() => {
    window.addEventListener(SEARCH_RESULT_SELECTED, handleReset);
    return () =>
      window.removeEventListener(SEARCH_RESULT_SELECTED, handleReset);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex gap-x-[5px] w-full items-center h-[32px]"
    >
      <div className="relative h-full w-full flex">
        <input
          ref={searchRef}
          type="search"
          placeholder={t("common.search")}
          onChange={handleChange}
          onReset={handleReset}
          onFocus={(e) => {
            e.target.select();
            if (searchTerm.trim().length >= 3) setShowResults(true);
          }}
          // Reopen on click too: after Escape the input can still have focus,
          // so no focus event fires when the user clicks back into it.
          onClick={() => {
            if (searchTerm.trim().length >= 3) setShowResults(true);
          }}
          className="border-none w-full h-full rounded-lg bg-theme-sidebar-item-default pl-9 focus:pl-4 pr-8 placeholder:text-white/50 light:placeholder:text-slate-500 placeholder:font-semibold outline-none text-theme-text-primary search-input sidebar-search-input peer text-sm"
        />
        <MagnifyingGlass
          size={14}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-settings-input-placeholder peer-focus:invisible"
          weight="bold"
          hidden={!!searchTerm}
        />
        {searchTerm.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("common.clear-search")}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center justify-center rounded p-[2px] text-zinc-400 hover:text-white light:text-slate-500 light:hover:text-slate-900"
          >
            <X size={12} weight="bold" />
          </button>
        )}
      </div>
      <ShortWidthNewWorkspaceButton
        user={user}
        showNewWsModal={showNewWsModal}
      />
      {showResults && (
        <SearchResults
          searchResults={searchResults}
          searchTerm={searchTerm}
          loading={loading}
        />
      )}
    </div>
  );
}

function SearchResultWrapper({ children }) {
  return (
    <div
      data-search-results="true"
      className="absolute right-0 top-[6.2%] w-full flex flex-col gap-y-[24px] h-auto bg-theme-modal-border light:bg-theme-bg-primary light:border-2 light:border-theme-modal-border rounded-lg p-[16px] z-10 max-h-[calc(100%-24px)] overflow-y-scroll no-scroll"
    >
      {children}
    </div>
  );
}

function SearchResults({ searchResults, searchTerm, loading }) {
  if (!searchTerm || searchTerm.length < 3) return null;
  if (loading)
    return (
      <SearchResultWrapper>
        <div className="flex flex-col gap-y-[8px] h-[200px] justify-center items-center">
          <Preloader size={5} />
          <p className="text-theme-text-secondary text-xs font-semibold text-center">
            Searching for "{searchTerm}"
          </p>
        </div>
      </SearchResultWrapper>
    );

  if (
    searchResults.workspaces.length === 0 &&
    searchResults.threads.length === 0
  ) {
    return (
      <SearchResultWrapper>
        <div className="flex flex-col gap-y-[8px] h-[200px] justify-center items-center">
          <p className="text-theme-text-secondary text-xs font-semibold text-center">
            No results found for
            <br />
            <span className="text-theme-text-primary font-semibold text-sm">
              "{searchTerm}"
            </span>
          </p>
        </div>
      </SearchResultWrapper>
    );
  }

  return (
    <SearchResultWrapper>
      <SearchResultCategory
        name="Workspaces"
        items={searchResults.workspaces?.map((workspace) => ({
          id: workspace.slug,
          to: paths.workspace.chat(workspace.slug),
          name: workspace.name,
        }))}
      />
      <SearchResultCategory
        name="Threads"
        items={searchResults.threads?.map((thread) => ({
          id: thread.slug,
          to: paths.workspace.thread(thread.workspace.slug, thread.slug),
          name: thread.name,
          hint: thread.workspace.name,
        }))}
      />
    </SearchResultWrapper>
  );
}

function SearchResultCategory({ items, name }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-col gap-y-[8px]">
      <p className="text-theme-text-secondary text-xs uppercase font-semibold px-[4px]">
        {name}
      </p>
      <div className="flex flex-col gap-y-[6px]">
        {items.map((item) => (
          <SearchResultItem
            key={item.id}
            to={item.to}
            name={item.name}
            hint={item.hint}
          />
        ))}
      </div>
    </div>
  );
}

function SearchResultItem({ to, name, hint }) {
  return (
    <Link
      to={to}
      onClick={() => window.dispatchEvent(new Event(SEARCH_RESULT_SELECTED))}
      className="hover:bg-[#FFF]/10 light:hover:bg-[#000]/10 transition-all duration-300 rounded-sm px-[8px] py-[2px]"
    >
      <p className="text-theme-text-primary text-sm truncate w-full">
        {name}
        {hint && (
          <span className="text-theme-text-secondary text-xs ml-[4px]">
            | {hint}
          </span>
        )}
      </p>
    </Link>
  );
}

function ShortWidthNewWorkspaceButton({ user, showNewWsModal }) {
  const { t } = useTranslation();
  if (!!user && user?.role === "default") return null;

  return (
    <>
      <button
        data-tooltip-id="new-workspace-tooltip"
        data-tooltip-content={t("new-workspace.title")}
        onClick={showNewWsModal}
        className="border-none flex items-center justify-center bg-white  rounded-lg p-[8px] hover:bg-white/80 light:hover:bg-slate-300 transition-all duration-300"
      >
        <Plus
          size={16}
          weight="bold"
          className="text-black light:text-slate-500"
        />
      </button>
      <Tooltip
        id="new-workspace-tooltip"
        place="top"
        delayShow={300}
        className="tooltip !text-xs"
      />
    </>
  );
}
