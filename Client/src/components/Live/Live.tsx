import {
  useBroadcastEvent,
  useEventListener,
  useMyPresence,
  useOthers,
} from "@liveblocks/react/suspense";
import React, { useCallback, useEffect, useState } from "react";
import { useInterval } from "../../hook/useInterval";
import {
  CursorMode,
  CursorState,
  Reaction,
  ReactionEvent,
} from "../../type/type";
import { CursorChat } from "../Cursor/CursorChat";
import { LiveCursor } from "../Cursor/LiveCursor";
import FlyingReaction from "../Reaction/FlyingReact";
import ReactionSelector from "../Reaction/ReactionButton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@radix-ui/react-context-menu";
import { shortcuts } from "../../utils";
import { Comments } from "../CommentOverPlay/Comments";
import { useMutation } from "@apollo/client";
import { ADD_COMMENT } from "../../utils/Comment/Comment";
import { useSelector } from "react-redux";
import { RootState } from "../../Redux/store";

interface Props {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  role: any;
  undo: () => void;
  redo: () => void;
}

export const Live = ({ canvasRef, role, undo, redo }: Props) => {
  const others = useOthers();
  const [{ cursor }, updatePersence] = useMyPresence() as any;
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentPosition, setCommentPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [newComment, setNewComment] = useState("");
  const [cursorState, setCursorState] = useState<CursorState>({
    mode: CursorMode.Hidden,
  });
  const [addComment] = useMutation(ADD_COMMENT);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const currentUser = useSelector(
    (state: RootState) => state.user.user.currentUser
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        setIsCommenting(true);
        setCommentPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }); // Hiển thị ở giữa màn hình
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleKeyDownInInput = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newComment.trim() !== "") {
      console.log("New comment:", newComment, "at position:", commentPosition);
      const x = commentPosition?.x;
      const y = commentPosition?.y;
      await addComment({
        variables: {
          content: newComment,
          x: x,
          y: y,
          userId: currentUser?.sub,
        },
      });

      setIsCommenting(false);
      setNewComment("");
      setCommentPosition(null);
    }
  };

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (role === "ROLE_READ") return;
      event.preventDefault();
      if (cursor === null || cursorState.mode !== CursorMode.ReactionSelector) {
        const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
        const y = event.clientY - event.currentTarget.getBoundingClientRect().y;
        updatePersence({
          cursor: { x, y },
        });
      }
    },
    [cursor, cursorState.mode, updatePersence, role]
  );

  const handlePointerLeave = useCallback(
    (event: React.PointerEvent) => {
      if (role === "ROLE_READ") return;
      event.preventDefault();
      updatePersence({
        cursor: null,
        message: null,
      });
      setCursorState({ mode: CursorMode.Hidden });
    },
    [updatePersence, role]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (role === "ROLE_READ") return;
      const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
      const y = event.clientY - event.currentTarget.getBoundingClientRect().y;
      updatePersence({
        cursor: { x, y },
      });
      setCursorState((state) =>
        state.mode === CursorMode.Reaction
          ? { ...state, isPressed: true }
          : state
      );
    },
    [updatePersence, role]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (role === "ROLE_READ") return;
      setCursorState((state) =>
        state.mode === CursorMode.Reaction
          ? { ...state, isPressed: false }
          : state
      );
    },
    [role]
  );

  const setReaction = useCallback(
    (reaction: string) => {
      if (role === "ROLE_READ") return;
      setCursorState({
        mode: CursorMode.Reaction,
        reaction,
        isPressed: false,
      });
    },
    [role]
  );

  useEffect(() => {
    if (role === "ROLE_READ") return;
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === "/") {
        setCursorState({
          mode: CursorMode.Chat,
          previousMessage: null,
          message: "",
        });
      } else if (e.key === "Escape") {
        updatePersence({ message: "" });
        setCursorState({
          mode: CursorMode.Hidden,
        });
      } else if (e.key === "e") {
        setCursorState({
          mode: CursorMode.ReactionSelector,
        });
      }
    };
    const keyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
      }
    };
    window.addEventListener("keyup", keyUp);
    window.addEventListener("keydown", keyDown);
    return () => {
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("keydown", keyDown);
    };
  }, [updatePersence, role]);

  const broadcast = useBroadcastEvent();
  useInterval(() => {
    if (
      cursorState.mode === CursorMode.Reaction &&
      cursorState.isPressed &&
      cursor
    ) {
      setReactions((prevReactions) => [
        ...prevReactions,
        {
          point: { x: cursor.x, y: cursor.y },
          value: cursorState.reaction,
          timestamp: Date.now(),
        },
      ]);
      broadcast({
        x: cursor.x,
        y: cursor.y,
        value: cursorState.reaction,
      });
    }
  }, 5);

  useEventListener((eventData) => {
    const event = eventData.event as ReactionEvent;
    setReactions((prevReactions) => [
      ...prevReactions,
      {
        point: { x: event.x, y: event.y },
        value: event.value,
        timestamp: Date.now(),
      },
    ]);
  });

  const handleContextMenuClick = useCallback((key: string) => {
    console.log(key);
    switch (key) {
      case "Chat":
        setCursorState({
          mode: CursorMode.Chat,
          previousMessage: null,
          message: "",
        });
        break;
      case "Undo":
        undo();
        break;
      case "Redo":
        redo();
        break;
      case "Reactions":
        setCursorState({
          mode: CursorMode.ReactionSelector,
        });
        break;
      default:
        break;
    }
  }, []);

  const handleEmojiClick = (emojiObject: any) => {
    setNewComment((prev) => prev + emojiObject.emoji); // Thêm emoji vào nội dung comment
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        id="canvas"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="relative flex h-full w-full  items-center "
      >
        <canvas ref={canvasRef} className="w-full h-full" />
        {reactions.map((reaction) => (
          <FlyingReaction
            key={reaction.timestamp.toString()}
            x={reaction.point.x}
            y={reaction.point.y}
            timestamp={reaction.timestamp}
            value={reaction.value}
          />
        ))}
        {cursor && (
          <CursorChat
            cursor={cursor}
            cursorState={cursorState}
            setCursorState={setCursorState}
            updateMyPresence={updatePersence}
          />
        )}
        {cursorState.mode === CursorMode.ReactionSelector &&
          role !== "ROLE_READ" && (
            <ReactionSelector setReaction={setReaction} />
          )}
        <LiveCursor others={others} />
        <Comments />
      </ContextMenuTrigger>
      <ContextMenuContent className="right-menu-content bg-white border border-gray-200 shadow-lg rounded-lg p-2 w-64">
        {shortcuts.map((shortcut) => (
          <ContextMenuItem
            key={shortcut.key}
            className="right-menu-item flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleContextMenuClick(shortcut.name)}
          >
            <span className="right-menu-name font-medium text-gray-800">
              {shortcut.name}
            </span>
            <span className="right-menu-shortcut text-xs text-gray-500">
              {shortcut.shortcut}
            </span>
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
};
