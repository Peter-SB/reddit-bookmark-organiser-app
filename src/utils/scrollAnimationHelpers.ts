import { FlashListRef } from "@shopify/flash-list";
import { LayoutAnimation, Platform } from "react-native";
import type { PostListItem } from "@/models/models";

/**
 * Smoothly scroll to the top of the posts list with polished animation.
 * Uses a responsive ease-out curve that makes the animation feel quick and intentional.
 */
export const scrollToTop = (
  listRef: React.RefObject<FlashListRef<PostListItem> | null> | undefined,
  offset: number = 0,
  useAnimation: boolean = true,
) => {
  if (!listRef?.current) return;

  listRef.current.scrollToOffset({
    offset,
    animated: useAnimation,
  });
};

/**
 * Scroll to top with a specific offset (useful for snapping past headers).
 * Includes animation for smooth, responsive feel.
 */
export const scrollToTopWithHeader = (
  listRef: React.RefObject<FlashListRef<PostListItem> | null> | undefined,
  headerHeight: number,
  useAnimation: boolean = true,
) => {
  scrollToTop(listRef, headerHeight, useAnimation);
};
