import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useHoverMetaKey from "./hooks";
import ThreadList from "./ThreadList";

export const THREAD_RENAME_EVENT = "renameThread";
export const THREAD_FORK_EVENT = "forkToThread";
export const THREAD_ACTIVITY_EVENT = "threadActivity";

export default function ThreadContainer({
  workspace,
  isVirtualThread = false,
}) {
  const navigate = useNavigate();
  const { threadSlug = null } = useParams();
  const [threads, setThreads] = useState([]);
  const [defaultThreadHasChats, setDefaultThreadHasChats] = useState(false);
  const [loading, setLoading] = useState(true);
  const { containerRef, ctrlPressed } = useHoverMetaKey(setThreads, !loading);

  useEffect(() => {
    const chatHandler = (event) => {
      const { threadSlug, newName } = event.detail;
      setThreads((prevThreads) =>
        prevThreads.map((thread) => {
          if (thread.slug === threadSlug) {
            return { ...thread, name: newName };
          }
          return thread;
        })
      );
    };

    window.addEventListener(THREAD_RENAME_EVENT, chatHandler);

    return () => {
      window.removeEventListener(THREAD_RENAME_EVENT, chatHandler);
    };
  }, []);

  // Handle new fork events from chat actions. Forking navigates via the router
  // now, so a blocked/cancelled navigation would otherwise leave the new thread
  // missing from this list until the next refetch.
  useEffect(() => {
    const forkHandler = () => {
      if (!workspace?.slug) return;
      Workspace.threads
        .all(workspace.slug)
        .then(({ threads }) => setThreads(threads))
        .catch((e) => console.error(e));
    };

    window.addEventListener(THREAD_FORK_EVENT, forkHandler);
    return () => {
      window.removeEventListener(THREAD_FORK_EVENT, forkHandler);
    };
  }, [workspace?.slug]);

  // R5: a message in the current thread does not change threadSlug, so the
  // fetch effect below does not run. The composer emits this event right after
  // sending; update the row locally and let ThreadList sort it to the top.
  // The server patch bumps lastUpdatedAt, so the next full fetch agrees.
  useEffect(() => {
    const activityHandler = (event) => {
      const { threadSlug: activeSlug, timestamp } = event.detail ?? {};
      if (!activeSlug) return;
      const lastUpdatedAt = new Date(timestamp ?? Date.now()).toISOString();
      setThreads((prevThreads) =>
        prevThreads.map((thread) =>
          thread.slug === activeSlug ? { ...thread, lastUpdatedAt } : thread
        )
      );
    };

    window.addEventListener(THREAD_ACTIVITY_EVENT, activityHandler);
    return () => {
      window.removeEventListener(THREAD_ACTIVITY_EVENT, activityHandler);
    };
  }, []);

  useEffect(() => {
    async function fetchThreads() {
      if (!workspace.slug) return;
      const { threads, defaultThreadChatCount } = await Workspace.threads.all(
        workspace.slug
      );
      setLoading(false);
      setThreads(threads);
      setDefaultThreadHasChats(defaultThreadChatCount > 0);
    }
    fetchThreads();
  }, [workspace.slug, threadSlug]);

  const toggleForDeletion = (id) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return { ...t, deleted: !t.deleted };
      })
    );
  };

  const handleDeleteAll = async () => {
    const slugs = threads.filter((t) => t.deleted === true).map((t) => t.slug);
    await Workspace.threads.deleteBulk(workspace.slug, slugs);
    setThreads((prev) => prev.filter((t) => !t.deleted));

    // Only redirect if current thread is being deleted. Use router navigation
    // so ActiveGenerationGuard can intercept if a response is generating.
    if (slugs.includes(threadSlug)) {
      navigate(paths.workspace.chat(workspace.slug));
    }
  };

  function removeThread(threadId) {
    setThreads((prev) =>
      prev.map((_t) => {
        if (_t.id !== threadId) return _t;
        return { ..._t, deleted: true };
      })
    );

    // Show thread was deleted, but then remove from threads entirely so it will
    // not appear in bulk-selection.
    setTimeout(() => {
      setThreads((prev) => prev.filter((t) => !t.deleted));
    }, 500);
  }

  if (loading) {
    return (
      <div className="flex flex-col bg-pulse w-full h-10 items-center justify-center">
        <p className="text-xs text-white animate-pulse">loading threads....</p>
      </div>
    );
  }

  return (
    <ThreadList
      containerRef={containerRef}
      workspace={workspace}
      threads={threads}
      threadSlug={threadSlug}
      isVirtualThread={isVirtualThread}
      defaultThreadHasChats={defaultThreadHasChats}
      ctrlPressed={ctrlPressed}
      onNewThread={(thread) => setThreads((prev) => [...prev, thread])}
      onDeleteAll={handleDeleteAll}
      onRemove={removeThread}
      toggleMarkForDeletion={toggleForDeletion}
    />
  );
}
