import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretDown, CaretUp, CircleNotch, Plus, Trash } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import ThreadItem from "../ThreadItem";

/**
 * Renders the thread list for the single active workspace.
 *
 * The container keeps state and handlers; this component owns order, the
 * optional older-thread fold (R1), the missing connector lines (R2), the
 * New Thread button at the top (R3) and newest-first sorting (R4).
 *
 * Upstream's virtual "*New Thread" row is intentionally not rendered: it
 * duplicated the New Thread button and appeared as a phantom row on every
 * bare workspace route (after deleting the active thread, on a new
 * workspace). The button is now the only way to start a chat.
 */
export default function ThreadList({
  containerRef,
  workspace,
  threads = [],
  threadSlug = null,
  isVirtualThread = false,
  defaultThreadHasChats = false,
  ctrlPressed = false,
  onNewThread,
  onDeleteAll,
  onRemove,
  toggleMarkForDeletion,
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const limit = Math.max(0, Number(Appearance.get("threadListLimit")) || 0);

  // R4: newest activity first. R5 keeps lastUpdatedAt current; fall back to
  // createdAt for rows created before the server patch existed.
  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const aTime = new Date(a.lastUpdatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.lastUpdatedAt ?? b.createdAt ?? 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [threads]);

  const activeThreadIndex =
    limit > 0
      ? sortedThreads.findIndex((thread) => thread.slug === threadSlug)
      : -1;
  // Keep the active thread reachable when it falls outside the limit. The
  // group is expanded automatically, so no "show less" control is offered
  // while an older thread is active.
  const activeThreadIsOlder = activeThreadIndex >= limit && limit > 0;
  const expanded = showAll || activeThreadIsOlder;
  const visibleThreads =
    limit > 0 && !expanded ? sortedThreads.slice(0, limit) : sortedThreads;
  const olderCount = sortedThreads.length - visibleThreads.length;

  const defaultThreadIsActive =
    !isVirtualThread && !threadSlug && defaultThreadHasChats;

  return (
    <div ref={containerRef} className="flex flex-col">
      <NewThreadButton workspace={workspace} onNewThread={onNewThread} />
      <div
        role="list"
        aria-label="Threads"
        className="flex flex-col pl-3 mt-1 border-l border-zinc-700/50 light:border-slate-300"
      >
        {defaultThreadHasChats && (
          <ThreadItem
            isActive={defaultThreadIsActive}
            workspace={workspace}
            thread={{ slug: null, name: "default" }}
          />
        )}
        {visibleThreads.map((thread) => (
          <ThreadItem
            key={thread.slug}
            ctrlPressed={ctrlPressed}
            toggleMarkForDeletion={toggleMarkForDeletion}
            isActive={!isVirtualThread && thread.slug === threadSlug}
            workspace={workspace}
            onRemove={onRemove}
            thread={thread}
          />
        ))}
        {limit > 0 && (olderCount > 0 || (showAll && !activeThreadIsOlder)) && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setShowAll((current) => !current)}
            className="w-full flex items-center gap-x-2 h-[32px] pl-2 text-left text-xs text-zinc-400 light:text-slate-500 hover:text-white light:hover:text-slate-900"
          >
            {expanded ? (
              <CaretUp size={12} weight="bold" className="shrink-0" />
            ) : (
              <CaretDown size={12} weight="bold" className="shrink-0" />
            )}
            <span>
              {expanded
                ? t("thread-list.show-less")
                : t("thread-list.show-older", { count: olderCount })}
            </span>
          </button>
        )}
      </div>
      <DeleteAllThreadButton
        ctrlPressed={ctrlPressed}
        threads={threads}
        onDelete={onDeleteAll}
      />
    </div>
  );
}

function NewThreadButton({ workspace, onNewThread }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    const { thread, error } = await Workspace.threads.new(workspace.slug);
    if (!!error) {
      showToast(`Could not create thread - ${error}`, "error", { clear: true });
      setLoading(false);
      return;
    }
    // Show the new thread in the sidebar immediately - if the navigation below
    // gets blocked (ActiveGenerationGuard) and cancelled, the thread still
    // exists and remains reachable. Router navigation also ensures the guard
    // can intercept and the button never wedges in its loading state.
    onNewThread?.(thread);
    navigate(paths.workspace.thread(workspace.slug, thread.slug), {
      replace: true,
    });
    setLoading(false);
  };

  return (
    <button
      onClick={onClick}
      className="w-full relative flex h-[40px] items-center border-none hover:bg-[var(--theme-sidebar-thread-selected)] light:hover:bg-slate-300 hover:light:bg-theme-sidebar-subitem-hover rounded-lg"
    >
      <div className="flex w-full gap-x-2 items-center pl-4">
        <div className="bg-zinc-800 light:bg-slate-50 p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
          {loading ? (
            <CircleNotch
              weight="bold"
              size={14}
              className="shrink-0 animate-spin text-white light:text-theme-text-primary"
            />
          ) : (
            <Plus
              weight="bold"
              size={14}
              className="shrink-0 text-white light:text-theme-text-primary"
            />
          )}
        </div>

        {loading ? (
          <p className="text-left text-white light:text-theme-text-primary text-sm">
            {t("thread-list.starting")}
          </p>
        ) : (
          <p className="text-left text-white light:text-theme-text-primary text-sm font-semibold">
            {t("thread-list.new")}
          </p>
        )}
      </div>
    </button>
  );
}

function DeleteAllThreadButton({ ctrlPressed, threads, onDelete }) {
  const { t } = useTranslation();
  if (!ctrlPressed || threads.filter((thread) => thread.deleted).length === 0)
    return null;
  return (
    <button
      type="button"
      onClick={onDelete}
      className="w-full relative flex h-[40px] items-center border-none hover:bg-red-400/20 rounded-lg group"
    >
      <div className="flex w-full gap-x-2 items-center pl-4">
        <div className="bg-transparent p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
          <Trash
            weight="bold"
            size={14}
            className="shrink-0 text-white light:text-red-500/50 group-hover:text-red-400"
          />
        </div>
        <p className="text-white light:text-theme-text-secondary text-left text-sm group-hover:text-red-400">
          {t("thread-list.delete-selected")}
        </p>
      </div>
    </button>
  );
}
