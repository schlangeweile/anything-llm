import React, { useState, useEffect } from "react";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Workspace from "@/models/workspace";
import ManageWorkspace, {
  useManageWorkspaceModal,
} from "../../Modals/ManageWorkspace";
import paths from "@/utils/paths";
import { Link, useParams, useNavigate, useMatch } from "react-router-dom";
import {
  CaretRight,
  GearSix,
  UploadSimple,
  DotsSixVertical,
} from "@phosphor-icons/react";
import useUser from "@/hooks/useUser";
import ThreadContainer from "./ThreadContainer";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import showToast from "@/utils/toast";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";
import { useTranslation } from "react-i18next";

export const REFETCH_WORKSPACES_EVENT = "refetchWorkspaces";
const COLLAPSED_WORKSPACES_KEY = "anythingllm-collapsed-workspaces";

export default function ActiveWorkspaces() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState(null);
  const { showing, showModal, hideModal } = useManageWorkspaceModal();
  const { user } = useUser();
  const isInWorkspaceSettings = !!useMatch("/workspace/:slug/settings/:tab");
  const isHomePage = !!useMatch("/");
  const { t } = useTranslation();
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState(() => {
    const stored = safeJsonParse(localStorage.getItem(COLLAPSED_WORKSPACES_KEY));
    return new Set(Array.isArray(stored) ? stored : []);
  });

  function persistCollapsed(next) {
    setCollapsedWorkspaces(next);
    try {
      localStorage.setItem(
        COLLAPSED_WORKSPACES_KEY,
        JSON.stringify(Array.from(next))
      );
    } catch (error) {
      console.error("Could not store collapsed workspaces:", error);
    }
  }

  function toggleWorkspace(workspaceSlug) {
    const next = new Set(collapsedWorkspaces);
    if (next.has(workspaceSlug)) next.delete(workspaceSlug);
    else next.add(workspaceSlug);
    persistCollapsed(next);
  }

  // Clicking the name of another workspace navigates AND opens it. Clicking
  // the name of the workspace that is already open (chat/thread route)
  // toggles its thread list instead, so collapsing no longer requires the
  // chevron. In workspace settings the name keeps navigating back to the
  // chat, because that is the established way out of the settings page.
  function handleWorkspaceNameClick(workspaceSlug, event) {
    if (workspaceSlug === slug && !isInWorkspaceSettings) {
      event.preventDefault();
      toggleWorkspace(workspaceSlug);
      return;
    }
    openWorkspace(workspaceSlug);
  }

  function openWorkspace(workspaceSlug) {
    if (!collapsedWorkspaces.has(workspaceSlug)) return;
    const next = new Set(collapsedWorkspaces);
    next.delete(workspaceSlug);
    persistCollapsed(next);
  }

  useEffect(() => {
    async function getWorkspaces() {
      const workspaces = await Workspace.all();
      setLoading(false);
      setWorkspaces(Workspace.orderWorkspaces(workspaces));
    }
    getWorkspaces();

    // Refetch when a workspace is created elsewhere in the app (eg: the
    // NewWorkspace modal) since those flows navigate via the router and no
    // longer trigger a full page reload.
    window.addEventListener(REFETCH_WORKSPACES_EVENT, getWorkspaces);
    return () =>
      window.removeEventListener(REFETCH_WORKSPACES_EVENT, getWorkspaces);
  }, []);

  if (loading) {
    return (
      <Skeleton.default
        height={40}
        width="100%"
        count={5}
        baseColor="var(--theme-sidebar-item-default)"
        highlightColor="var(--theme-sidebar-item-hover)"
        enableAnimation={true}
        className="my-1"
      />
    );
  }

  /**
   * Reorders workspaces in the UI via localstorage on client side.
   * @param {number} startIndex - the index of the workspace to move
   * @param {number} endIndex - the index to move the workspace to
   */
  function reorderWorkspaces(startIndex, endIndex) {
    const reorderedWorkspaces = Array.from(workspaces);
    const [removed] = reorderedWorkspaces.splice(startIndex, 1);
    reorderedWorkspaces.splice(endIndex, 0, removed);
    setWorkspaces(reorderedWorkspaces);
    const success = Workspace.storeWorkspaceOrder(
      reorderedWorkspaces.map((w) => w.id)
    );
    if (!success) {
      showToast("Failed to reorder workspaces", "error");
      Workspace.all().then((workspaces) => setWorkspaces(workspaces));
    }
  }

  const onDragEnd = (result) => {
    if (!result.destination) return;
    reorderWorkspaces(result.source.index, result.destination.index);
  };

  // When on the home page, resolve which workspace should be virtually active
  const virtualActiveSlug = (() => {
    if (!isHomePage || workspaces.length === 0) return null;
    const lastVisited = safeJsonParse(
      localStorage.getItem(LAST_VISITED_WORKSPACE)
    );
    if (
      lastVisited?.slug &&
      workspaces.some((ws) => ws.slug === lastVisited.slug)
    )
      return lastVisited.slug;
    return workspaces[0]?.slug ?? null;
  })();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="workspaces">
        {(provided) => (
          <div
            role="list"
            aria-label="Workspaces"
            className="flex flex-col gap-y-2"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {workspaces.map((workspace, index) => {
              const isVirtuallyActive = workspace.slug === virtualActiveSlug;
              const isActive = workspace.slug === slug || isVirtuallyActive;
              return (
                <Draggable
                  key={workspace.id}
                  draggableId={workspace.id.toString()}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex flex-col w-full group ${
                        snapshot.isDragging ? "opacity-50" : ""
                      }`}
                      role="listitem"
                    >
                      <div className="flex gap-x-2 items-center justify-between">
                        <Link
                          to={paths.workspace.chat(workspace.slug)}
                          onClick={(e) => handleWorkspaceNameClick(workspace.slug, e)}
                          aria-current={isActive ? "page" : ""}
                          className={`
                            transition-all duration-[200ms]
                            flex flex-grow w-[75%] gap-x-2 py-[6px] pl-[4px] pr-[6px] rounded-[4px] text-white justify-start items-center
                            bg-theme-sidebar-item-default
                            ${isActive ? "light:bg-blue-200 font-bold" : "hover:bg-theme-sidebar-subitem-hover light:hover:bg-slate-300"}
                          `}
                        >
                          <div className="flex flex-row justify-between w-full items-center">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab mr-[3px]"
                            >
                              <DotsSixVertical
                                size={20}
                                className={`${isActive ? "text-white light:text-blue-800" : ""}`}
                                weight="bold"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleWorkspace(workspace.slug);
                              }}
                              aria-label={
                                collapsedWorkspaces.has(workspace.slug)
                                  ? t("thread-list.expand")
                                  : t("thread-list.collapse")
                              }
                              aria-expanded={
                                !collapsedWorkspaces.has(workspace.slug)
                              }
                              className={`border-none p-0 mr-1 shrink-0 flex items-center justify-center transition-transform duration-200 ${
                                collapsedWorkspaces.has(workspace.slug)
                                  ? ""
                                  : "rotate-90"
                              } ${isActive ? "text-white light:text-blue-800" : "text-zinc-400 light:text-slate-500"}`}
                            >
                              <CaretRight size={12} weight="bold" />
                            </button>
                            <div
                              data-tooltip-id="workspace-name"
                              data-tooltip-content={workspace.name}
                              className="flex items-center space-x-2 overflow-hidden flex-grow"
                            >
                              <div className="w-[130px] overflow-hidden">
                                <p
                                  className={`
                                  text-[14px] leading-loose whitespace-nowrap overflow-hidden
                                  ${isActive ? "font-bold text-white light:text-blue-900" : "font-medium "} truncate
                                  w-full group-hover:w-[130px] group-hover:duration-200
                                `}
                                >
                                  {workspace.name}
                                </p>
                              </div>
                            </div>
                            {user?.role !== "default" && (
                              <div
                                className={`flex items-center gap-x-[2px] transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSelectedWs(workspace);
                                    showModal();
                                  }}
                                  data-tooltip-id="upload-workspace"
                                  data-tooltip-content="Upload documents to this workspace for RAG indexing"
                                  className={`group/upload border-none rounded-md flex items-center justify-center ml-auto p-[2px] ${isActive ? "hover:bg-zinc-500 light:hover:bg-sky-800/30" : "hover:bg-zinc-500 light:hover:bg-slate-400"}`}
                                >
                                  <UploadSimple
                                    className={`h-[20px] w-[20px] ${isActive ? "text-zinc-400 hover:text-white light:text-blue-700 light:group-hover/upload:text-blue-900" : "text-zinc-400 hover:text-white light:text-slate-600 light:group-hover/upload:text-slate-950"}`}
                                  />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    navigate(
                                      isInWorkspaceSettings
                                        ? paths.workspace.chat(workspace.slug)
                                        : paths.workspace.settings.generalAppearance(
                                            workspace.slug
                                          )
                                    );
                                  }}
                                  className={`group/gear rounded-md flex items-center justify-center ml-auto p-[2px] ${isActive ? "hover:bg-zinc-500 light:hover:bg-sky-800/30" : "hover:bg-zinc-500 light:hover:bg-slate-400"}`}
                                  aria-label="General appearance settings"
                                  data-tooltip-id="gear-workspace"
                                  data-tooltip-content="General appearance settings"
                                >
                                  <GearSix
                                    color={
                                      isInWorkspaceSettings &&
                                      workspace.slug === slug
                                        ? "#46C8FF"
                                        : undefined
                                    }
                                    className={`h-[20px] w-[20px] ${isActive ? "text-zinc-400 hover:text-white light:text-blue-700 light:group-hover/gear:text-blue-900" : "text-zinc-400 hover:text-white light:text-slate-600 light:group-hover/gear:text-slate-950"}`}
                                  />
                                </button>
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>
                      {isActive && !collapsedWorkspaces.has(workspace.slug) && (
                        <ThreadContainer
                          workspace={workspace}
                          isActive={isActive}
                          isVirtualThread={isVirtuallyActive}
                        />
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
            {showing && (
              <ManageWorkspace
                hideModal={hideModal}
                providedSlug={selectedWs ? selectedWs.slug : null}
              />
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
